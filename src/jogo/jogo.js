// Estado e regras da investigação. Não toca no DOM nem no canvas:
// recebe intenções ("ir para cá", "examinar isto") e avisa a interface por eventos.

import { Cena } from '../mundo/cena.js';
import { buscarCaminho, ladoAcessivel } from '../mundo/caminho.js';
import { Detetive } from './detetive.js';
import { julgar, montarMisterio, pesarEvidencias } from './misterio.js';

/** Distância máxima, em tiles, para conseguir examinar algo. */
const ALCANCE = 1.7;

export class Jogo {
  /**
   * @param {object} dadosCena
   * @param {object} caso
   * @param {string} semente
   */
  constructor(dadosCena, caso, semente) {
    this.cena = new Cena(dadosCena);
    this.caso = caso;
    this.misterio = montarMisterio(caso, this.cena.pontosDeVestigio, semente);
    this.detetive = new Detetive(this.cena.inicio.gx, this.cena.inicio.gy);

    /** @type {object[]} vestígios já recolhidos, na ordem em que apareceram */
    this.recolhidos = [];
    /** @type {Set<string>} ids de documentos fixos já lidos */
    this.documentosLidos = new Set();
    this.encerrado = false;
    this.veredito = null;

    /** @type {Map<string, Function[]>} */
    this.ouvintes = new Map();
  }

  // ---------- eventos ----------

  escutar(evento, acao) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, []);
    this.ouvintes.get(evento).push(acao);
  }

  #avisar(evento, dados) {
    for (const acao of this.ouvintes.get(evento) ?? []) acao(dados);
  }

  // ---------- consultas ----------

  get semente() {
    return this.misterio.semente;
  }

  get podeAcusar() {
    return this.recolhidos.length >= this.caso.minimoParaAcusar;
  }

  /** Vestígios ainda no chão. */
  vestigiosVisiveis() {
    return this.misterio.vestigios.filter((v) => !v.recolhido);
  }

  /** O que existe de examinável no tile, seja vestígio ou objeto fixo. */
  alvoEm(gx, gy) {
    const vestigio = this.misterio.vestigios.find((v) => !v.recolhido && v.gx === gx && v.gy === gy);
    if (vestigio) {
      return { tipo: 'vestigio', gx, gy, rotulo: vestigio.nome, vestigio };
    }
    const fixo = this.cena.examinavelEm(gx, gy);
    if (fixo) {
      return { tipo: fixo.tipo, gx, gy, rotulo: fixo.def.rotulo, def: fixo.def };
    }
    return null;
  }

  pesos() {
    return pesarEvidencias(this.misterio, this.recolhidos);
  }

  // ---------- intenções ----------

  /** Clique num tile: caminha até lá ou vai examinar o que estiver no caminho. */
  irPara(gx, gy) {
    if (this.encerrado) return;
    const alvo = this.alvoEm(gx, gy);

    if (alvo) {
      if (this.detetive.distanciaAte(gx, gy) <= ALCANCE) {
        this.detetive.pararAgora();
        this.examinar(alvo);
        return;
      }
      const parada = ladoAcessivel(this.cena, { gx, gy }, this.detetive);
      if (!parada) return;
      const rota = buscarCaminho(this.cena, this.detetive, parada);
      if (!rota.length && this.detetive.distanciaAte(parada.gx, parada.gy) > 0.1) return;
      this.detetive.definirRota(rota, () => {
        const aindaVale = this.alvoEm(gx, gy);
        if (aindaVale) this.examinar(aindaVale);
      });
      return;
    }

    const destino = this.cena.andavelMaisProximo(gx, gy, this.detetive);
    if (!destino) return;
    const rota = buscarCaminho(this.cena, this.detetive, destino);
    if (rota.length) this.detetive.definirRota(rota);
  }

  /** Examina um alvo já ao alcance. */
  examinar(alvo) {
    if (this.encerrado) return;
    if (this.detetive.distanciaAte(alvo.gx, alvo.gy) > ALCANCE) return;

    if (alvo.tipo === 'vestigio') {
      this.#recolher(alvo.vestigio);
      return;
    }

    if (alvo.tipo === 'saida') {
      this.#avisar('pedirAcusacao', { motivo: 'saida' });
      return;
    }

    // Documentos fixos: o contorno da vítima e as pastas da perícia.
    const documento = this.#documentoPara(alvo);
    if (documento) {
      const novo = !this.documentosLidos.has(documento.id);
      this.documentosLidos.add(documento.id);
      this.#avisar('documento', { documento, novo });
    }
  }

  /**
   * Escolhe qual documento fixo pertence ao objeto examinado.
   * O contorno tem o seu; as pastas distribuem os demais pela ordem do mapa.
   */
  #documentoPara(alvo) {
    const docs = this.caso.documentos;
    if (alvo.def?.interacao === 'corpo') return docs.find((d) => d.id === 'corpo') ?? null;

    const pastas = this.cena.pecas
      .filter((p) => p.def.interacao === 'documento')
      .sort((a, b) => a.gy - b.gy || a.gx - b.gx);
    const indice = pastas.findIndex((p) => p.gx === alvo.gx && p.gy === alvo.gy);
    const disponiveis = docs.filter((d) => d.id !== 'corpo');
    if (indice < 0 || !disponiveis.length) return null;
    return disponiveis[indice % disponiveis.length];
  }

  #recolher(vestigio) {
    if (vestigio.recolhido) return;
    vestigio.recolhido = true;
    this.recolhidos.push(vestigio);
    this.#avisar('vestigio', { vestigio, recolhidos: this.recolhidos.length, total: this.misterio.total });
    if (this.recolhidos.length === this.caso.minimoParaAcusar) {
      this.#avisar('liberouAcusacao', {});
    }
  }

  /** Fecha o caso nomeando um suspeito. */
  acusar(idSuspeito) {
    if (this.encerrado) return this.veredito;
    this.veredito = julgar(this.misterio, idSuspeito, this.recolhidos);
    this.encerrado = true;
    this.detetive.pararAgora();
    this.#avisar('veredito', this.veredito);
    return this.veredito;
  }

  atualizar(dt, direcaoTeclado) {
    if (this.encerrado) {
      this.detetive.atualizar(dt, this.cena, null);
      return;
    }
    this.detetive.atualizar(dt, this.cena, direcaoTeclado);
  }
}
