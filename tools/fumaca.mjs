// Teste de fumaça do caminho do navegador.
//
// A verificação em `verificar.mjs` cobre mundo, mistério e regras, mas nada ali
// executa o renderizador nem a inicialização real. Foi essa a brecha que deixou
// passar um `jogo.cena` órfão no renderizador: a lógica passava, e o desenho
// quebrava no primeiro quadro.
//
// Aqui montamos um DOM mínimo, importamos o main.js como o navegador faria,
// rodamos vários quadros e acionamos os atalhos. Qualquer exceção reprova.

import { readFileSync } from 'node:fs';

let falhas = 0;
let checagens = 0;

function relatar(descricao, erro) {
  if (!erro) {
    console.log(`  ok   ${descricao}`);
    return true;
  }
  falhas += 1;
  console.error(`  FALHA ${descricao} — ${erro?.message ?? erro}`);
  if (erro?.stack) console.error(erro.stack.split('\n').slice(1, 4).join('\n'));
  return false;
}

function conferir(descricao, acao) {
  checagens += 1;
  try {
    const resultado = typeof acao === 'function' ? acao() : acao;
    if (resultado === false) throw new Error('resultado falso');
    if (resultado instanceof Promise) {
      // Guarda contra o erro que já aconteceu aqui: uma função async devolve uma
      // Promise, que não é `false`, e a checagem passaria sem esperar nada.
      throw new Error('use conferirAsync para ações assíncronas');
    }
    return relatar(descricao);
  } catch (erro) {
    return relatar(descricao, erro);
  }
}

/** Versão que realmente aguarda a ação antes de julgar o resultado. */
async function conferirAsync(descricao, acao) {
  checagens += 1;
  try {
    const resultado = await acao();
    if (resultado === false) throw new Error('resultado falso');
    return relatar(descricao);
  } catch (erro) {
    return relatar(descricao, erro);
  }
}

// ---------- DOM mínimo ----------

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const IDS = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

/** Contexto 2D no-op: aceita qualquer método de desenho e qualquer propriedade. */
function contexto2d() {
  const gradiente = { addColorStop() {} };
  const base = {
    canvas: { width: 1280, height: 720 },
    createLinearGradient: () => gradiente,
    createRadialGradient: () => gradiente,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
  };
  return new Proxy(base, {
    get: (obj, prop) => (prop in obj ? obj[prop] : () => {}),
    set: () => true,
  });
}

function elemento(id = '') {
  const ouvintes = new Map();
  return {
    id,
    className: '',
    textContent: '',
    hidden: true,
    disabled: false,
    type: '',
    dataset: {},
    style: {},
    isConnected: true,
    clientWidth: 1280,
    clientHeight: 720,
    width: 0,
    height: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    append() {},
    appendChild() {},
    replaceChildren() {},
    setAttribute() {},
    getAttribute: () => null,
    removeAttribute() {},
    focus() {},
    remove() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => contexto2d(),
    addEventListener(tipo, fn) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, []);
      ouvintes.get(tipo).push(fn);
    },
    removeEventListener() {},
    disparar(tipo, evento = {}) {
      for (const fn of ouvintes.get(tipo) ?? []) fn({ preventDefault() {}, ...evento });
    },
  };
}

const porId = new Map([...IDS].map((id) => [id, elemento(id)]));
const ouvintesJanela = new Map();
let aoQuadro = null;

globalThis.document = {
  getElementById: (id) => porId.get(id) ?? null,
  createElement: () => elemento(),
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
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = (cb) => {
  aoQuadro = cb;
  return 1;
};
globalThis.cancelAnimationFrame = () => {};
globalThis.location = { hash: '' };
globalThis.history = { replaceState() {} };

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};

function dispararNaJanela(tipo, evento) {
  for (const fn of ouvintesJanela.get(tipo) ?? []) fn({ preventDefault() {}, ...evento });
}

/** Avança `n` quadros. Lança se algum deles quebrar. */
function rodarQuadros(n, inicio = 16) {
  for (let i = 0; i < n; i += 1) {
    if (!aoQuadro) throw new Error('o laço parou de pedir quadros');
    aoQuadro(inicio + i * 16);
  }
}

// ---------- execução ----------

console.log('Teste de fumaça (DOM mínimo, caminho real de inicialização)');

const palco = porId.get('palco');

conferir('o index.html declara todos os ids que o código procura', IDS.size > 20);

// O import é aguardado de verdade. Quando o módulo termina de avaliar, o
// main.js já chamou requestAnimationFrame, então não há corrida de tempo aqui.
const importou = await conferirAsync('main.js importa sem lançar', () => import('../src/main.js'));

if (!importou) {
  console.error('\nSem carregar o main.js não há o que medir. Interrompendo.');
  process.exit(1);
}

conferir('o laço pediu o primeiro quadro', () => aoQuadro !== null);

if (!aoQuadro) {
  console.error('\nO laço nunca pediu um quadro, então os testes seguintes não diriam nada.');
  process.exit(1);
}
conferir('primeiro quadro desenha sem lançar', () => rodarQuadros(1) ?? true);
conferir('sessenta quadros seguidos sem lançar', () => rodarQuadros(60) ?? true);

conferir('mover o ponteiro sobre a cena não quebra', () => {
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  rodarQuadros(3);
  return true;
});

conferir('clicar na cena não quebra e o detetive responde', () => {
  palco.disparar('pointerdown', { button: 0, pointerType: 'mouse', clientX: 700, clientY: 380 });
  rodarQuadros(30);
  return true;
});

conferir('ponteiro fora da cena não quebra', () => {
  palco.disparar('pointerleave', {});
  rodarQuadros(3);
  return true;
});

conferir('examinar pelo teclado não quebra', () => {
  dispararNaJanela('keydown', { code: 'KeyE', key: 'KeyE' });
  rodarQuadros(5);
  return true;
});

for (const [tecla, nome] of [
  ['KeyC', 'caderno'],
  ['KeyF', 'suspeitos'],
  ['KeyL', 'locais'],
  ['KeyG', 'acusação'],
]) {
  conferir(`atalho de ${nome} não quebra`, () => {
    dispararNaJanela('keydown', { code: tecla, key: tecla });
    rodarQuadros(5);
    dispararNaJanela('keydown', { code: 'Escape', key: 'Escape' });
    rodarQuadros(5);
    return true;
  });
}

conferir('caminhada pelo teclado não quebra', () => {
  dispararNaJanela('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', target: {} });
  rodarQuadros(20);
  dispararNaJanela('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' });
  rodarQuadros(5);
  return true;
});

conferir('nova investigação reinicia sem quebrar', () => {
  dispararNaJanela('keydown', { code: 'KeyN', key: 'KeyN' });
  rodarQuadros(30);
  return true;
});

conferir('redimensionar a janela não quebra', () => {
  dispararNaJanela('resize', {});
  rodarQuadros(5);
  return true;
});

conferir('o progresso foi gravado no depósito', () => memoria.size > 0);

console.log(
  `\n${falhas === 0 ? 'Fumaça limpa' : 'Com falhas'}: ${checagens - falhas}/${checagens} checagens passaram.`,
);
process.exit(falhas === 0 ? 0 : 1);
