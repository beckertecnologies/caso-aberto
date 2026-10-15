// A cidade viva: a multidão anônima mais a vítima e os suspeitos, todos andando.
//
// Também guarda o relógio do pré-crime. A partida começa na fase 'pre-crime':
// ninguém está morto, as pistas ainda não nasceram, e o povo circula. Passados
// `SEGUNDOS_ATE_CRIME`, dispara o crime — a vítima some do passeio (foi para a
// casa de campo, onde o corpo será encontrado) — e avisa quem estiver ouvindo,
// para o jogo ligar a investigação.
//
// Fica só na cidade: é onde "mapa" e "povo andando" fazem sentido. Nos interiores
// não há multidão.

import { criarRng } from '../core/rng.js';
import { Npc } from './npc.js';

/** Quantos transeuntes anônimos a cidade recebe. */
const POVO_ANONIMO = 90;
/** Segundos de vida normal antes de o assassinato acontecer. */
export const SEGUNDOS_ATE_CRIME = 30;
/** Quantos NPCs podem calcular uma rota nova no mesmo quadro. */
const REPLANS_POR_QUADRO = 3;

export class Povo {
  /**
   * @param {import('../mundo/cena.js').Cena} cidade
   * @param {object} caso
   * @param {string} semente
   */
  constructor(cidade, caso, semente) {
    this.cidade = cidade;
    this.caso = caso;
    // Semente própria, derivada da do caso: o passeio é reproduzível, mas não
    // interfere nos sorteios do mistério.
    this.rng = criarRng(`${semente}:povo`);

    /** @type {'pre-crime'|'investigacao'} */
    this.fase = 'pre-crime';
    this.tempo = 0;
    this.crimeDisparado = false;

    /** @type {Npc[]} */
    this.npcs = [];
    /** @type {Map<string,Function[]>} */
    this.ouvintes = new Map();

    // Portas dos prédios: é por elas que os NPCs entram e saem. Vêm das
    // passagens da cidade (cada uma leva a um local).
    this.portas = this.cidade.ligacoes
      .filter((l) => this.cidade.andavel(l.gx, l.gy))
      .map((l) => ({ gx: l.gx, gy: l.gy }));

    this.#povoar();
  }

  escutar(evento, acao) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, []);
    this.ouvintes.get(evento).push(acao);
  }

  #avisar(evento, dados) {
    for (const acao of this.ouvintes.get(evento) ?? []) acao(dados);
  }

  /** Um tile andável qualquer da cidade, perto do centro para começar visível. */
  #tileAndavel(perto = null) {
    const { largura, altura } = this.cidade;
    for (let tentativa = 0; tentativa < 200; tentativa += 1) {
      let gx;
      let gy;
      if (perto) {
        gx = perto.gx + this.rng.inteiro(41) - 20;
        gy = perto.gy + this.rng.inteiro(41) - 20;
      } else {
        gx = this.rng.inteiro(largura);
        gy = this.rng.inteiro(altura);
      }
      if (this.cidade.andavel(gx, gy)) return { gx, gy };
    }
    return { gx: this.cidade.inicio.gx, gy: this.cidade.inicio.gy };
  }

  #povoar() {
    const centro = this.cidade.inicio;

    // Multidão anônima.
    for (let i = 0; i < POVO_ANONIMO; i += 1) {
      const p = this.#tileAndavel();
      this.npcs.push(new Npc(p.gx, p.gy, this.rng, { papel: 'povo' }));
    }

    // Vítima e suspeitos: personagens nomeados, perto do centro para o jogador
    // cruzar com eles. A vítima guarda referência para "matar" no disparo.
    const vitimaNome = this.caso.vitima?.nome ?? 'Vítima';
    const posV = this.#tileAndavel(centro);
    this.vitima = new Npc(posV.gx, posV.gy, this.rng, {
      papel: 'personagem',
      id: 'vitima',
      nome: vitimaNome,
    });
    this.npcs.push(this.vitima);

    for (const suspeito of this.caso.suspeitos ?? []) {
      const p = this.#tileAndavel(centro);
      this.npcs.push(
        new Npc(p.gx, p.gy, this.rng, {
          papel: 'personagem',
          id: suspeito.id,
          nome: suspeito.nome,
        }),
      );
    }
  }

  /** Segundos que faltam para o crime (0 quando já aconteceu). */
  segundosRestantes() {
    return Math.max(0, Math.ceil(SEGUNDOS_ATE_CRIME - this.tempo));
  }

  /**
   * Avança a vida da cidade. Só faz sentido chamar quando o detetive está na
   * cidade; nos interiores o jogo não atualiza o povo.
   */
  atualizar(dt) {
    // Orçamento de replanejamento por quadro: no máximo alguns NPCs calculam uma
    // rota nova por vez. Mesmo com o A* já limitado, deixar as dezenas de NPCs
    // recalcularem no mesmo quadro empilhava o custo e dava engasgo; espalhar
    // entre quadros mantém o movimento fluido sem travar.
    let cota = REPLANS_POR_QUADRO;
    for (const npc of this.npcs) {
      const consumiu = npc.atualizar(dt, this.cidade, this.rng, this.portas, cota > 0);
      if (consumiu) cota -= 1;
    }

    if (this.fase === 'pre-crime') {
      this.tempo += dt;
      if (this.tempo >= SEGUNDOS_ATE_CRIME) this.dispararCrime();
    }
  }

  /**
   * O assassinato. A vítima deixa o passeio (vai para a casa de campo, onde o
   * corpo é encontrado), a fase vira 'investigacao' e quem ouve é avisado para
   * plantar as pistas e revelar os relatórios.
   */
  dispararCrime() {
    if (this.crimeDisparado) return;
    this.crimeDisparado = true;
    this.fase = 'investigacao';

    // A vítima some do passeio da cidade: a história a leva para a casa de campo.
    this.vitima.morto = true;
    this.npcs = this.npcs.filter((n) => n !== this.vitima);

    this.#avisar('crime', { local: 'casa-de-campo' });
  }
}
