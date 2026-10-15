// Um transeunte: bonequinho que vive a vida andando pela cena sozinho.
//
// Mesma física de passo do detetive (posição em grade fracionária, rota do A*,
// interpolação entre nós), mas sem clique: ele escolhe um destino andável
// qualquer por perto, vai até lá, descansa um instante e repete. A aparência
// vem de uma paleta sorteada — casaco, calça, pele, cabelo e chapéu —, então o
// jogo "solta" um visual aleatório em vez de depender de vários sprites.

import { buscarCaminho } from '../mundo/caminho.js';

/**
 * Teto de nós que o A* de um transeunte pode abrir. Caminho curto fecha em
 * dezenas de nós; este teto só corta a busca por um destino inalcançável, que
 * sem ele varreria a cidade inteira. É o que mantém o quadro leve com dezenas
 * de NPCs sorteando rota.
 */
const ORCAMENTO_A = 1200;

/** Tons de pele plausíveis. */
const PELES = ['#f1c9a5', '#e0ac84', '#c68a5e', '#a66a43', '#8a5a3b', '#6b4428'];
/** Cabelos. */
const CABELOS = ['#1b1510', '#2d2016', '#4a2f1a', '#6b4a2a', '#8a6a3a', '#9a9a9a', '#d8d8d8', '#3a2a1a'];
/** Roupas: casacos e peças de cima. */
const ROUPAS = [
  '#3a4a5e', '#4a3a5e', '#5e3a3a', '#3a5e4a', '#5e5a3a', '#2e3744',
  '#6a4a3a', '#44506a', '#5a3a52', '#3a5a5a', '#704a3a', '#424242',
];
/** Calças/parte de baixo. */
const CALCAS = ['#20262f', '#2a2420', '#262a30', '#1f2420', '#2c2630', '#302824'];

export class Npc {
  /**
   * @param {number} gx
   * @param {number} gy
   * @param {import('../core/rng.js').criarRng extends (...a:any)=>infer R ? R : any} rng
   * @param {object} [opcoes]
   */
  constructor(gx, gy, rng, opcoes = {}) {
    this.gx = gx;
    this.gy = gy;
    this.rota = [];
    // Transeunte anda um pouco mais devagar que o detetive, e cada um no seu ritmo.
    this.velocidade = 1.8 + rng.decimal() * 1.1;
    this.olhandoX = 0;
    this.olhandoY = 1;
    this.andando = false;
    this.fase = rng.decimal() * Math.PI * 2;
    // Tempo de descanso antes de escolher o próximo destino.
    this.descanso = rng.decimal() * 2.5;
    /** Até onde ele costuma vagar de uma vez, em tiles. */
    this.alcance = 6 + rng.inteiro(10);

    /** Papel: 'povo' (anônimo) ou 'personagem' (suspeito/vítima). */
    this.papel = opcoes.papel ?? 'povo';
    /** Para personagens: id e nome, para o rótulo flutuante. */
    this.id = opcoes.id ?? null;
    this.nome = opcoes.nome ?? null;
    /** Vítima vira cadáver quando o crime dispara. */
    this.morto = false;

    /**
     * Dentro de um prédio: fica invisível por um tempo e depois sai por uma
     * porta. É o "entrando nos prédios" sem precisar simular o interior — o NPC
     * some na porta, espera e reaparece numa porta (a mesma ou outra).
     */
    this.dentro = false;
    this.tempoDentro = 0;

    this.paleta = opcoes.paleta ?? Npc.paletaAleatoria(rng);
  }

  /** Sorteia uma aparência completa. */
  static paletaAleatoria(rng) {
    return {
      pele: rng.sortear(PELES),
      cabelo: rng.sortear(CABELOS),
      roupa: rng.sortear(ROUPAS),
      calca: rng.sortear(CALCAS),
      // Nem todo mundo usa chapéu.
      chapeu: rng.decimal() < 0.35 ? rng.sortear(ROUPAS) : null,
      // Alturas levemente diferentes dão variedade sem destoar.
      altura: 0.9 + rng.decimal() * 0.22,
    };
  }

  /**
   * Escolhe o próximo destino. De vez em quando mira uma porta de prédio (para
   * "entrar"); senão, um ponto andável qualquer por perto.
   *
   * Todas as buscas usam um teto de expansões baixo (`ORCAMENTO_A`): o
   * transeunte anda pouco, então um destino que exigiria varrer meia cidade é
   * um destino ruim — melhor desistir rápido e sortear outro no próximo quadro
   * do que travar o jogo com um A* gigante.
   */
  #novoDestino(cena, rng, portas) {
    // ~25% das vezes, vai até uma porta — é o que o faz entrar e sair de prédios.
    if (portas?.length && rng.decimal() < 0.25) {
      const porta = rng.sortear(portas);
      const rota = buscarCaminho(cena, this, { gx: porta.gx, gy: porta.gy }, ORCAMENTO_A);
      if (rota.length) {
        this.rota = rota;
        this.indoParaPorta = { gx: porta.gx, gy: porta.gy };
        return;
      }
    }

    this.indoParaPorta = null;
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      const ang = rng.decimal() * Math.PI * 2;
      const dist = 2 + rng.inteiro(this.alcance);
      const alvoX = Math.round(this.gx + Math.cos(ang) * dist);
      const alvoY = Math.round(this.gy + Math.sin(ang) * dist);
      if (!cena.andavel(alvoX, alvoY)) continue;
      const rota = buscarCaminho(cena, this, { gx: alvoX, gy: alvoY }, ORCAMENTO_A);
      if (rota.length) {
        this.rota = rota;
        return;
      }
    }
  }

  /**
   * @param {number} dt segundos
   * @param {import('../mundo/cena.js').Cena} cena
   * @param {object} rng
   * @param {{gx:number,gy:number}[]} [portas] portas de prédio da cena
   * @param {boolean} [podeReplanejar] se false, o NPC espera outro quadro para
   *   escolher destino — é como a multidão espalha o custo do A* entre quadros.
   * @returns {boolean} true se consumiu a cota de replanejamento deste quadro
   */
  atualizar(dt, cena, rng, portas = [], podeReplanejar = true) {
    this.andando = false;

    // Morto não anda mais: fica caído onde está.
    if (this.morto) return false;

    // Dentro de um prédio: conta o tempo e sai por uma porta qualquer.
    if (this.dentro) {
      this.tempoDentro -= dt;
      if (this.tempoDentro <= 0) {
        this.dentro = false;
        const saida = portas.length ? rng.sortear(portas) : null;
        if (saida) {
          this.gx = saida.gx;
          this.gy = saida.gy;
        }
        this.descanso = 0.3 + rng.decimal() * 1.5;
      }
      return false;
    }

    if (this.rota.length) {
      this.#seguirRota(dt);
      // Chegou na porta que mirava: entra no prédio e some por uns segundos.
      if (!this.rota.length && this.indoParaPorta) {
        this.indoParaPorta = null;
        this.dentro = true;
        this.tempoDentro = 2 + rng.decimal() * 5;
      }
      this.fase += dt * (this.andando ? 8 : 1.6);
      return false;
    }

    // Parado: conta o descanso. Quando ele acaba, só replaneja se a multidão
    // deu a cota deste quadro; senão, tenta de novo no próximo.
    this.descanso -= dt;
    this.fase += dt * 1.6;
    if (this.descanso > 0) return false;
    if (!podeReplanejar) return false;

    this.descanso = 0.8 + rng.decimal() * 3.5;
    this.#novoDestino(cena, rng, portas);
    return true;
  }

  #seguirRota(dt) {
    let restante = this.velocidade * dt;
    while (restante > 0 && this.rota.length) {
      const no = this.rota[0];
      const dx = no.x - this.gx;
      const dy = no.y - this.gy;
      const distancia = Math.hypot(dx, dy);
      if (distancia < 0.02) {
        this.gx = no.x;
        this.gy = no.y;
        this.rota.shift();
        continue;
      }
      this.olhandoX = dx / distancia;
      this.olhandoY = dy / distancia;
      this.andando = true;
      const passo = Math.min(restante, distancia);
      this.gx += this.olhandoX * passo;
      this.gy += this.olhandoY * passo;
      restante -= passo;
    }
  }
}
