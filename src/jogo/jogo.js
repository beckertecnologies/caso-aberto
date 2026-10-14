// Estado e regras da investigação. Não toca no DOM nem no canvas: recebe
// intenções ("ir para cá", "examinar isto", "confrontar com aquilo") e avisa a
// interface por eventos. É o que permite simular partidas inteiras no Node.

import { Cena } from '../mundo/cena.js';
import { buscarCaminho, ladoAcessivel } from '../mundo/caminho.js';
import { Detetive } from './detetive.js';
import { julgar, montarMisterio, pesarEvidencias, vestigiosQueDerrubam } from './misterio.js';

/** Distância máxima, em tiles, para conseguir examinar algo. */
const ALCANCE = 1.7;

export class Jogo {
  /**
   * @param {object[]} dadosCenas locais da investigação, na ordem de apresentação
   * @param {object} caso
   * @param {string} semente
   */
  constructor(dadosCenas, caso, semente) {
    if (!dadosCenas?.length) throw new Error('A investigação precisa de pelo menos um local.');

    /** @type {Map<string, Cena>} */
    this.cenas = new Map();
    this.ordemCenas = [];
    for (const dados of dadosCenas) {
      const cena = new Cena(dados);
      this.cenas.set(cena.id, cena);
      this.ordemCenas.push(cena.id);
    }

    this.caso = caso;
    this.misterio = montarMisterio(
      caso,
      this.ordemCenas.map((id) => ({ id, pontos: this.cenas.get(id).pontosDeVestigio })),
      semente,
    );

    this.cenaAtual = this.cenas.get(this.ordemCenas[0]);
    this.detetive = new Detetive(this.cenaAtual.inicio.gx, this.cenaAtual.inicio.gy);

    /** @type {object[]} vestígios já recolhidos, na ordem em que apareceram */
    this.recolhidos = [];
    /** @type {Set<string>} ids de documentos fixos já lidos */
    this.documentosLidos = new Set();
    /** @type {Set<string>} respostas já ouvidas, na forma "suspeito:pergunta" */
    this.respostasOuvidas = new Set();
    /** @type {{suspeito:string,pergunta:string,vestigio:string}[]} mentiras derrubadas */
    this.contradicoes = [];

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

  /** Vestígios ainda no chão do local atual. */
  vestigiosVisiveis() {
    return this.misterio.vestigios.filter((v) => !v.recolhido && v.cena === this.cenaAtual.id);
  }

  /** Quantos vestígios continuam no chão em cada local. */
  pendentesPorLocal() {
    const contagem = new Map(this.ordemCenas.map((id) => [id, 0]));
    for (const vestigio of this.misterio.vestigios) {
      if (!vestigio.recolhido) contagem.set(vestigio.cena, (contagem.get(vestigio.cena) ?? 0) + 1);
    }
    return contagem;
  }

  /** Locais para onde o detetive pode se deslocar agora. */
  outrosLocais() {
    const pendentes = this.pendentesPorLocal();
    return this.ordemCenas
      .filter((id) => id !== this.cenaAtual.id)
      .map((id) => {
        const cena = this.cenas.get(id);
        return { id, nome: cena.nome, endereco: cena.endereco, pendentes: pendentes.get(id) ?? 0 };
      });
  }

  /** O que existe de examinável no tile, seja vestígio ou objeto fixo. */
  alvoEm(gx, gy) {
    const vestigio = this.vestigiosVisiveis().find((v) => v.gx === gx && v.gy === gy);
    if (vestigio) {
      return { tipo: 'vestigio', gx, gy, rotulo: vestigio.nome, vestigio };
    }
    const fixo = this.cenaAtual.examinavelEm(gx, gy);
    if (fixo) {
      return {
        tipo: fixo.tipo,
        gx,
        gy,
        rotulo: fixo.rotulo ?? fixo.def.rotulo,
        def: fixo.def,
        para: fixo.para,
      };
    }
    return null;
  }

  pesos() {
    return pesarEvidencias(this.misterio, this.recolhidos);
  }

  /** A resposta desta pergunta já foi ouvida? */
  jaOuviu(idSuspeito, idPergunta) {
    return this.respostasOuvidas.has(`${idSuspeito}:${idPergunta}`);
  }

  contradicaoDe(idSuspeito, idPergunta) {
    return (
      this.contradicoes.find((c) => c.suspeito === idSuspeito && c.pergunta === idPergunta) ?? null
    );
  }

  /** Vestígios em mãos capazes de derrubar esta resposta, se ainda não caiu. */
  confrontosDisponiveis(idSuspeito, pergunta) {
    if (this.contradicaoDe(idSuspeito, pergunta.id)) return [];
    return vestigiosQueDerrubam(pergunta, this.recolhidos);
  }

  // ---------- intenções ----------

  /** Clique num tile: caminha até lá ou vai examinar o que estiver no caminho. */
  irPara(gx, gy) {
    if (this.encerrado) return;
    const cena = this.cenaAtual;
    const alvo = this.alvoEm(gx, gy);

    if (alvo) {
      if (this.detetive.distanciaAte(gx, gy) <= ALCANCE) {
        this.detetive.pararAgora();
        this.examinar(alvo);
        return;
      }
      const parada = ladoAcessivel(cena, { gx, gy }, this.detetive);
      if (!parada) return;
      const rota = buscarCaminho(cena, this.detetive, parada);
      if (!rota.length && this.detetive.distanciaAte(parada.gx, parada.gy) > 0.1) return;
      this.detetive.definirRota(rota, () => {
        const aindaVale = this.alvoEm(gx, gy);
        if (aindaVale) this.examinar(aindaVale);
      });
      return;
    }

    const destino = cena.andavelMaisProximo(gx, gy, this.detetive);
    if (!destino) return;
    const rota = buscarCaminho(cena, this.detetive, destino);
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

    // Passagem: entra no prédio ou volta para a rua, sem menu no caminho.
    if (alvo.tipo === 'ligacao') {
      this.viajarPara(alvo.para, this.cenaAtual.id);
      return;
    }

    const documento = this.#documentoPara(alvo);
    if (documento) {
      const novo = !this.documentosLidos.has(documento.id);
      this.documentosLidos.add(documento.id);
      this.#avisar('documento', { documento, novo });
    }
  }

  /**
   * Troca o local da investigação.
   * Quando o destino tem uma passagem de volta para onde o detetive estava, ele
   * chega nela — sai do prédio na porta do prédio, e não no ponto de partida do
   * mapa. Sem isso, voltar para a rua teleportaria o jogador para longe.
   * @param {string} idCena
   * @param {string|null} vindoDe
   */
  viajarPara(idCena, vindoDe = null) {
    if (this.encerrado) return false;
    const cena = this.cenas.get(idCena);
    if (!cena || cena.id === this.cenaAtual.id) return false;

    this.cenaAtual = cena;
    this.detetive.pararAgora();

    const volta = vindoDe ? cena.ligacaoPara(vindoDe) : null;
    const chegada =
      volta && cena.andavel(volta.gx, volta.gy)
        ? { gx: volta.gx, gy: volta.gy }
        : { gx: cena.inicio.gx, gy: cena.inicio.gy };

    this.detetive.gx = chegada.gx;
    this.detetive.gy = chegada.gy;
    this.#avisar('viagem', { cena, chegada });
    return true;
  }

  /** Marca uma resposta como ouvida no interrogatório. */
  ouvir(idSuspeito, idPergunta) {
    const chave = `${idSuspeito}:${idPergunta}`;
    if (this.respostasOuvidas.has(chave)) return false;
    this.respostasOuvidas.add(chave);
    this.#avisar('depoimento', { suspeito: idSuspeito, pergunta: idPergunta });
    return true;
  }

  /**
   * Confronta uma resposta com um vestígio. Só vale se o vestígio estiver em
   * mãos e se de fato desmentir aquela resposta.
   */
  confrontar(idSuspeito, idPergunta, idVestigio) {
    if (this.encerrado) return null;

    const suspeito = this.caso.suspeitos.find((s) => s.id === idSuspeito);
    const pergunta = suspeito?.perguntas?.find((p) => p.id === idPergunta);
    if (!pergunta) return null;
    if (!(pergunta.contradizPor ?? []).includes(idVestigio)) return null;
    if (this.contradicaoDe(idSuspeito, idPergunta)) return null;

    const vestigio = this.recolhidos.find((v) => v.id === idVestigio);
    if (!vestigio) return null;

    const registro = { suspeito: idSuspeito, pergunta: idPergunta, vestigio: idVestigio };
    this.contradicoes.push(registro);
    this.respostasOuvidas.add(`${idSuspeito}:${idPergunta}`);
    this.#avisar('contradicao', { registro, suspeito, pergunta, vestigio });
    return registro;
  }

  /** Fecha o caso nomeando um suspeito. */
  acusar(idSuspeito) {
    if (this.encerrado) return this.veredito;
    this.veredito = julgar(this.misterio, idSuspeito, this.recolhidos, this.contradicoes);
    this.encerrado = true;
    this.detetive.pararAgora();
    this.#avisar('veredito', this.veredito);
    return this.veredito;
  }

  atualizar(dt, direcaoTeclado) {
    this.detetive.atualizar(dt, this.cenaAtual, this.encerrado ? null : direcaoTeclado);
  }

  // ---------- progresso ----------

  /** Retrato serializável do progresso. */
  estado() {
    return {
      versao: 1,
      semente: this.semente,
      cena: this.cenaAtual.id,
      detetive: { gx: this.detetive.gx, gy: this.detetive.gy },
      recolhidos: this.recolhidos.map((v) => v.id),
      documentos: [...this.documentosLidos],
      respostas: [...this.respostasOuvidas],
      contradicoes: this.contradicoes.map((c) => ({ ...c })),
      encerrado: this.encerrado,
      acusado: this.veredito?.acusado?.id ?? null,
    };
  }

  /**
   * Recarrega um progresso salvo. Ignora dados de outra semente, porque o
   * mistério seria diferente e os ids não corresponderiam.
   */
  restaurar(estado) {
    if (!estado || estado.semente !== this.semente) return false;

    const porId = new Map(this.misterio.vestigios.map((v) => [v.id, v]));
    for (const vestigio of this.misterio.vestigios) vestigio.recolhido = false;
    this.recolhidos = [];
    for (const id of estado.recolhidos ?? []) {
      const vestigio = porId.get(id);
      if (!vestigio || vestigio.recolhido) continue;
      vestigio.recolhido = true;
      this.recolhidos.push(vestigio);
    }

    const idsDocumentos = new Set(this.caso.documentos.map((d) => d.id));
    this.documentosLidos = new Set((estado.documentos ?? []).filter((id) => idsDocumentos.has(id)));

    this.respostasOuvidas = new Set(estado.respostas ?? []);

    this.contradicoes = (estado.contradicoes ?? []).filter((registro) => {
      const suspeito = this.caso.suspeitos.find((s) => s.id === registro?.suspeito);
      const pergunta = suspeito?.perguntas?.find((p) => p.id === registro?.pergunta);
      if (!pergunta) return false;
      if (!(pergunta.contradizPor ?? []).includes(registro.vestigio)) return false;
      return this.recolhidos.some((v) => v.id === registro.vestigio);
    });

    const cena = this.cenas.get(estado.cena);
    if (cena) this.cenaAtual = cena;

    const pos = estado.detetive;
    const valida =
      pos && this.cenaAtual.andavel(Math.round(pos.gx), Math.round(pos.gy));
    this.detetive.gx = valida ? pos.gx : this.cenaAtual.inicio.gx;
    this.detetive.gy = valida ? pos.gy : this.cenaAtual.inicio.gy;
    this.detetive.pararAgora();

    this.encerrado = false;
    this.veredito = null;
    if (estado.encerrado && estado.acusado) {
      this.veredito = julgar(this.misterio, estado.acusado, this.recolhidos, this.contradicoes);
      this.encerrado = true;
    }

    return true;
  }

  // ---------- internos ----------

  /** Qual documento fixo pertence ao objeto examinado, dentro do local atual. */
  #documentoPara(alvo) {
    const doLocal = this.caso.documentos.filter((d) => d.cena === this.cenaAtual.id);
    if (alvo.def?.interacao === 'corpo') return doLocal.find((d) => d.alvo === 'corpo') ?? null;

    const pastas = this.cenaAtual.pecas
      .filter((p) => p.def.interacao === 'documento')
      .sort((a, b) => a.gy - b.gy || a.gx - b.gx);
    const indice = pastas.findIndex((p) => p.gx === alvo.gx && p.gy === alvo.gy);
    const disponiveis = doLocal.filter((d) => d.alvo === 'pasta');
    if (indice < 0 || !disponiveis.length) return null;
    return disponiveis[indice % disponiveis.length];
  }

  #recolher(vestigio) {
    if (vestigio.recolhido) return;
    vestigio.recolhido = true;
    this.recolhidos.push(vestigio);
    this.#avisar('vestigio', {
      vestigio,
      recolhidos: this.recolhidos.length,
      total: this.misterio.total,
    });
    if (this.recolhidos.length === this.caso.minimoParaAcusar) {
      this.#avisar('liberouAcusacao', {});
    }
  }
}
