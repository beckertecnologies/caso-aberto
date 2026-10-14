// DOM mínimo para rodar código de navegador no Node, sem navegador.
//
// Existe porque a verificação de lógica não executa renderizador nem
// inicialização, e foi essa brecha que deixou passar um `jogo.cena` órfão no
// renderizador e, mais tarde, uma leitura de propriedade inexistente na montagem
// da paleta do editor — o segundo chegou ao usuário como "não deu para salvar"
// num save que, na verdade, havia gravado.
//
// Não é um DOM de verdade: elemento não tem filhos nem layout. É o bastante para
// o código rodar de ponta a ponta e qualquer exceção reprovar.

import { readFileSync } from 'node:fs';

/**
 * Contexto 2D que não desenha nada, mas anota o que foi pedido.
 *
 * O registro em `chamadas` é o que permite afirmar algo além de "não lançou
 * exceção": dá para conferir de qual linha do atlas veio o sprite e se houve
 * espelhamento, que é como se verifica o mapa de direções do personagem sem
 * abrir um navegador.
 */
export function contexto2d() {
  const gradiente = { addColorStop() {} };
  const chamadas = [];
  const base = {
    chamadas,
    canvas: { width: 1280, height: 720 },
    createLinearGradient: () => gradiente,
    createRadialGradient: () => gradiente,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    /** Esquece o histórico, para cada checagem olhar só o seu quadro. */
    limparChamadas: () => {
      chamadas.length = 0;
    },
  };

  const anotadas = new Map();
  return new Proxy(base, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (!anotadas.has(prop)) {
        anotadas.set(prop, (...args) => {
          chamadas.push({ metodo: String(prop), args });
        });
      }
      return anotadas.get(prop);
    },
    set: () => true,
  });
}

/** Casa um seletor simples — `.classe`, `#id` ou `tag` — com um elemento. */
function casa(no, seletor) {
  if (seletor.startsWith('.')) {
    const classe = seletor.slice(1);
    return String(no.className).split(/\s+/).includes(classe) || no.classList.contains(classe);
  }
  if (seletor.startsWith('#')) return no.id === seletor.slice(1);
  return no.tag === seletor.toLowerCase();
}

/** Todos os descendentes, em profundidade. */
function descendentes(no) {
  const saida = [];
  for (const filho of no.children) {
    saida.push(filho);
    if (filho.children) saida.push(...descendentes(filho));
  }
  return saida;
}

/**
 * Um elemento do DOM falso.
 *
 * Guarda filhos e classes de verdade. Isso não é luxo: sem filhos, os botões que
 * o editor monta na paleta ficam inalcançáveis, e um teste que não consegue
 * clicar num item da paleta não exercita a seleção de peça — foi assim que a
 * primeira versão desta fumaça passou com o bug ainda no lugar.
 */
export function elemento(id = '', tag = 'div') {
  const ouvintes = new Map();
  const classes = new Set();
  const no = {
    id,
    tag,
    children: [],
    className: '',
    textContent: '',
    value: '',
    checked: false,
    hidden: true,
    disabled: false,
    type: '',
    title: '',
    dataset: {},
    style: {},
    isConnected: true,
    clientWidth: 1280,
    clientHeight: 720,
    offsetWidth: 100,
    width: 0,
    height: 0,
    naturalWidth: 256,
    naturalHeight: 512,
    classList: {
      add(...nomes) {
        for (const n of nomes) classes.add(n);
      },
      remove(...nomes) {
        for (const n of nomes) classes.delete(n);
      },
      toggle(nome) {
        if (classes.has(nome)) classes.delete(nome);
        else classes.add(nome);
      },
      contains: (nome) => classes.has(nome),
    },
    append(...nos) {
      for (const filho of nos) if (filho && typeof filho === 'object') no.children.push(filho);
    },
    appendChild(filho) {
      no.append(filho);
      return filho;
    },
    replaceChildren(...nos) {
      no.children = [];
      no.append(...nos);
    },
    setAttribute() {},
    getAttribute: () => null,
    removeAttribute() {},
    focus() {},
    remove() {},
    scrollIntoView() {},
    closest: () => elemento(),
    querySelector: (seletor) => descendentes(no).find((f) => casa(f, seletor)) ?? null,
    querySelectorAll: (seletor) => descendentes(no).filter((f) => casa(f, seletor)),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    // Um contexto por elemento, memoizado. Devolver um novo a cada chamada
    // parecia inofensivo e não era: o teste inspecionava um gravador diferente
    // do que o código estava usando, e via zero desenho onde havia desenho.
    getContext: () => {
      if (!no.ctx) no.ctx = contexto2d();
      return no.ctx;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    addEventListener(tipo, fn) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, []);
      ouvintes.get(tipo).push(fn);
    },
    removeEventListener() {},
    /** Dispara um evento nos ouvintes registrados deste elemento. */
    disparar(tipo, evento = {}) {
      for (const fn of ouvintes.get(tipo) ?? []) fn({ preventDefault() {}, ...evento });
    },
    temOuvinte: (tipo) => (ouvintes.get(tipo) ?? []).length > 0,
  };
  return no;
}

/**
 * Instala os globais de navegador e devolve os ganchos para os testes.
 *
 * Os ids vêm do HTML de verdade, então um id que o código procura e o HTML não
 * declara aparece como elemento ausente — do mesmo jeito que apareceria na tela.
 *
 * @param {URL|string} caminhoHtml
 * @param {{comImagem?:boolean}} opcoes `comImagem` liga um `Image` falso, que faz
 *   o acervo tentar carregar sprite; por padrão fica desligado e o acervo segue
 *   inativo, sem tocar em rede nem em disco.
 */
export function montarDom(caminhoHtml, { comImagem = false } = {}) {
  const html = readFileSync(caminhoHtml, 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const porId = new Map([...ids].map((id) => [id, elemento(id)]));
  const ouvintesJanela = new Map();
  const estado = { aoQuadro: null };

  globalThis.document = {
    getElementById: (id) => porId.get(id) ?? null,
    createElement: (tag = 'div') => elemento('', String(tag).toLowerCase()),
    createTextNode: (texto) => ({ nodeValue: texto }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    visibilityState: 'visible',
    body: elemento('body'),
  };

  globalThis.window = {
    addEventListener(tipo, fn) {
      if (!ouvintesJanela.has(tipo)) ouvintesJanela.set(tipo, []);
      ouvintesJanela.get(tipo).push(fn);
    },
    removeEventListener() {},
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
  };

  globalThis.HTMLInputElement = class {};
  globalThis.HTMLTextAreaElement = class {};
  globalThis.HTMLSelectElement = class {};
  globalThis.performance = { now: () => 0 };
  globalThis.requestAnimationFrame = (cb) => {
    estado.aoQuadro = cb;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.location = { hash: '' };
  globalThis.history = { replaceState() {} };

  // Observador que nunca dispara: a miniatura só carrega quando aparece na
  // tela, e aqui nada aparece. É o comportamento certo para o teste — nenhuma
  // imagem é pedida.
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  if (comImagem) {
    // Resolve na hora, sem rede nem disco: o acervo só precisa que `onload`
    // dispare para a imagem entrar no cache.
    globalThis.Image = class {
      constructor() {
        this.naturalWidth = 256;
        this.naturalHeight = 512;
      }
      set src(valor) {
        this.caminho = valor;
        this.onload?.();
      }
      get src() {
        return this.caminho;
      }
    };
  } else {
    delete globalThis.Image;
  }

  const memoria = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  };

  return {
    ids,
    porId,
    /** O que o código gravou em localStorage, para os testes conferirem. */
    guardado: memoria,
    pegar: (id) => porId.get(id),
    dispararNaJanela(tipo, evento = {}) {
      for (const fn of ouvintesJanela.get(tipo) ?? []) fn({ preventDefault() {}, ...evento });
    },
    get aoQuadro() {
      return estado.aoQuadro;
    },
    /** Avança `n` quadros. Lança se o laço parar de pedir quadros. */
    rodarQuadros(n, inicio = 16) {
      for (let i = 0; i < n; i += 1) {
        if (!estado.aoQuadro) throw new Error('o laço parou de pedir quadros');
        estado.aoQuadro(inicio + i * 16);
      }
    },
  };
}
