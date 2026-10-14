// Acervo de imagens: texturas de chão e sprites de peças.
//
// Tudo é opcional. O jogo funciona inteiro sem nenhum arquivo de imagem — quando
// falta textura, o renderizador cai na pintura procedural de `chao.js`. Isso
// permite adotar arte aos poucos, material por material, sem período nenhum de
// jogo quebrado.
//
// O manifesto é gerado por `npm run assets`, que varre a pasta `assets/`.

import { ruido } from './chao.js';

export class Acervo {
  /**
   * @param {{chao?:object, pecas?:object}} manifesto
   * @param {string} raiz prefixo dos caminhos
   */
  constructor(manifesto = {}, raiz = './assets/') {
    this.raiz = raiz;
    this.manifesto = manifesto;
    /** @type {Map<string, HTMLImageElement>} arquivos já carregados */
    this.imagens = new Map();
    /** @type {Map<string, Function[]>} quem espera cada arquivo em trânsito */
    this.emEspera = new Map();
    /** @type {Set<string>} arquivos que falharam, para não tentar de novo */
    this.falhas = new Set();
    this.pendentes = 0;
    this.aoMudar = null;
    this.ativo = typeof Image !== 'undefined';
  }

  /** Quantos arquivos o manifesto declara. */
  get total() {
    const doChao = Object.values(this.manifesto.chao ?? {}).reduce((n, l) => n + l.length, 0);
    return doChao + Object.keys(this.manifesto.pecas ?? {}).length;
  }

  get carregadas() {
    return this.imagens.size;
  }

  /**
   * Carrega adiantado só as texturas de chão, que são poucas e aparecem no
   * primeiro quadro. Os sprites de peça são centenas de arquivos: carregá-los
   * todos na abertura faria a página baixar megabytes que talvez nunca sejam
   * usados. Eles vêm sob demanda, no primeiro pedido.
   *
   * `aoMudar` avisa quando um arquivo chega, para o chão ser repintado.
   */
  carregar(aoMudar = null) {
    this.aoMudar = aoMudar;
    if (!this.ativo) return;
    for (const arquivo of new Set(Object.values(this.manifesto.chao ?? {}).flat())) {
      this.#pedir(arquivo, () => this.aoMudar?.());
    }
  }

  /**
   * Garante que um arquivo está sendo carregado. Devolve a imagem quando já
   * chegou, ou nulo enquanto não chegou.
   * @param {string} arquivo
   * @param {(img:HTMLImageElement)=>void} [aoChegar] chamado uma vez, na chegada
   */
  #pedir(arquivo, aoChegar = null) {
    if (!arquivo) return null;

    const pronta = this.imagens.get(arquivo);
    if (pronta) return pronta;

    if (this.emEspera.has(arquivo)) {
      if (aoChegar) this.emEspera.get(arquivo).push(aoChegar);
      return null;
    }
    if (!this.ativo) return null;

    const avisos = aoChegar ? [aoChegar] : [];
    this.emEspera.set(arquivo, avisos);
    this.pendentes += 1;

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      this.imagens.set(arquivo, img);
      this.pendentes -= 1;
      this.emEspera.delete(arquivo);
      for (const aviso of avisos) aviso(img);
    };
    img.onerror = () => {
      // Arquivo faltando não quebra o jogo: aquele material segue procedural.
      this.pendentes -= 1;
      this.emEspera.delete(arquivo);
      this.falhas.add(arquivo);
      console.warn(`Acervo: não foi possível carregar ${arquivo}`);
    };
    img.src = this.raiz + arquivo;
    return null;
  }

  /** Pede uma peça pelo id do manifesto, avisando quando a imagem chegar. */
  garantir(id, aoChegar = null) {
    const def = this.manifesto.pecas?.[id];
    if (!def) return null;
    return this.#pedir(def.arquivo, aoChegar);
  }

  /**
   * Pede um arquivo direto, sem passar pelo manifesto de peças.
   *
   * Existe para o atlas do detetive, que não é peça de cenário: tem célula,
   * linha e quadro próprios, e não entra na paleta do editor. Mesmo assim vale
   * reusar o carregamento daqui, que já trata espera, falha e aviso de chegada.
   */
  garantirArquivo(arquivo, aoChegar = null) {
    return this.#pedir(arquivo, aoChegar);
  }

  /**
   * Qual das texturas do material cabe nesta tile. Devolve -1 quando o material
   * não tem textura. Separado de `texturaDeChao` para o renderizador poder usar
   * o índice como chave de cache.
   */
  indiceDeChao(material, gx, gy) {
    const lista = this.manifesto.chao?.[material];
    if (!lista?.length) return -1;
    return Math.floor(ruido(gx, gy, 777) * lista.length) % lista.length;
  }

  /** Textura de um material por índice, se já tiver chegado. */
  texturaPorIndice(material, indice) {
    const lista = this.manifesto.chao?.[material];
    if (!lista?.length) return null;
    return this.imagens.get(lista[indice]) ?? null;
  }

  /** Ids de todas as peças disponíveis, em ordem. */
  idsDePecas() {
    return Object.keys(this.manifesto.pecas ?? {}).sort();
  }

  /** Dados de posicionamento de uma peça, sem exigir que a imagem já exista. */
  dadosDePeca(id) {
    const def = this.manifesto.pecas?.[id];
    if (!def) return null;
    return { ancora: def.ancora ?? 0.82, escala: def.escala ?? 1 };
  }

  /**
   * Textura de chão para uma tile. Quando o material tem mais de um arquivo,
   * a escolha vem do ruído da própria posição — varia sem ficar aleatório a
   * cada quadro.
   * @returns {HTMLImageElement|null}
   */
  texturaDeChao(material, gx, gy) {
    const lista = this.manifesto.chao?.[material];
    if (!lista?.length) return null;
    const indice = Math.floor(ruido(gx, gy, 777) * lista.length) % lista.length;
    // Se a sorteada ainda não chegou, tenta qualquer outra já carregada.
    return this.imagens.get(lista[indice]) ?? this.#primeiraCarregada(lista);
  }

  /**
   * Imagem de uma peça para desenhar agora. Dispara o carregamento no primeiro
   * pedido, então basta o renderizador pedir que a peça aparece no quadro
   * seguinte à chegada.
   */
  imagemDePeca(id, aoChegar = null) {
    return this.garantir(id, aoChegar);
  }

  #primeiraCarregada(lista) {
    for (const arquivo of lista) {
      const img = this.imagens.get(arquivo);
      if (img) return img;
    }
    return null;
  }

  /**
   * Sprite de uma peça de cenário.
   * @returns {{img:HTMLImageElement, ancora:number, escala:number}|null}
   */
  spriteDePeca(id, aoChegar = null) {
    const def = this.manifesto.pecas?.[id];
    if (!def) return null;
    const img = this.#pedir(def.arquivo, aoChegar);
    if (!img) return null;
    return { img, ancora: def.ancora ?? 0.82, escala: def.escala ?? 1 };
  }
}
