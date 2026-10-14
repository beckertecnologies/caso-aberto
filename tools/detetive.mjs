// Verificação do recorte do detetive e do mapa de direções.
//
// Por que existe
// --------------
// O personagem passou a usar sprite recortado de uma prancha. Duas coisas aí
// erram em silêncio e só aparecem olhando a tela:
//
// 1. O atlas pode estar fora de forma — célula que não divide o arquivo,
//    âncora fora da célula, linha com zero quadro.
// 2. O mapa de direções pode estar trocado: andar para a direita e o
//    personagem aparecer de costas. Isso não lança exceção nenhuma.
//
// O contexto 2D falso anota cada chamada de desenho, então dá para afirmar de
// qual linha do atlas veio o sprite e se houve espelhamento, direção por
// direção, sem navegador.

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { montarDom } from './dom-falso.mjs';
import { decodificar } from './png.mjs';

const RAIZ = resolve(import.meta.dirname, '..');

let falhas = 0;
let checagens = 0;

function conferir(descricao, acao) {
  checagens += 1;
  try {
    const resultado = typeof acao === 'function' ? acao() : acao;
    if (resultado === false) throw new Error('resultado falso');
    console.log(`  ok   ${descricao}`);
  } catch (erro) {
    falhas += 1;
    console.error(`  FALHA ${descricao} — ${erro?.message ?? erro}`);
  }
}

function secao(nome) {
  console.log(`\n${nome}`);
}

const dom = montarDom(new URL('../index.html', import.meta.url), { comImagem: true });
const palco = dom.porId.get('palco');

const { DETETIVE } = await import('../src/dados/detetive.js');
const { Camera } = await import('../src/core/camera.js');
const { Renderizador } = await import('../src/render/renderizador.js');
const { Acervo } = await import('../src/render/acervo.js');
const { VISUAL } = await import('../src/dados/visual.js');
const { CENAS } = await import('../src/dados/cenas.js');
const { Cena } = await import('../src/mundo/cena.js');

// ---------- o arquivo e o manifesto conversam ----------

secao('Detetive: atlas e manifesto');

const atlas = decodificar(await readFile(join(RAIZ, 'assets', DETETIVE.arquivo)));

conferir('o atlas existe e abre', () => atlas.largura > 0 && atlas.altura > 0);

conferir('a célula divide o atlas em linhas inteiras', () => {
  const linhas = atlas.altura / DETETIVE.celula.altura;
  if (!Number.isInteger(linhas)) {
    throw new Error(`${atlas.altura} / ${DETETIVE.celula.altura} = ${linhas}`);
  }
  return linhas === DETETIVE.vistas.length;
});

conferir('a célula divide o atlas em colunas inteiras', () => {
  const colunas = atlas.largura / DETETIVE.celula.largura;
  if (!Number.isInteger(colunas)) {
    throw new Error(`${atlas.largura} / ${DETETIVE.celula.largura} = ${colunas}`);
  }
  // Cabe a vista mais longa.
  return colunas >= Math.max(...DETETIVE.vistas.map((v) => v.quadros));
});

conferir('toda vista tem pelo menos um quadro', () =>
  DETETIVE.vistas.every((v) => v.quadros >= 1),
);

conferir('nenhum quadro declarado passa da borda do atlas', () => {
  const colunas = atlas.largura / DETETIVE.celula.largura;
  const fora = DETETIVE.vistas.filter((v) => v.quadros > colunas);
  if (fora.length) throw new Error(`${fora[0].nome} declara ${fora[0].quadros}`);
  return true;
});

conferir('a âncora cai dentro da célula', () => DETETIVE.ancora > 0.5 && DETETIVE.ancora <= 1);

// O recorte precisa ter deixado fundo transparente e figura opaca. Se o
// preenchimento falhasse, o atlas sairia opaco de ponta a ponta.
conferir('o atlas tem fundo transparente e figura opaca', () => {
  let transparentes = 0;
  let opacos = 0;
  for (let i = 3; i < atlas.rgba.length; i += 4) {
    if (atlas.rgba[i] === 0) transparentes += 1;
    else if (atlas.rgba[i] === 255) opacos += 1;
  }
  const total = atlas.rgba.length / 4;
  if (transparentes / total < 0.3) throw new Error(`só ${((transparentes / total) * 100) | 0}% transparente`);
  if (opacos / total < 0.1) throw new Error(`só ${((opacos / total) * 100) | 0}% opaco`);
  return true;
});

conferir('todo quadro declarado tem figura, nenhum vem vazio', () => {
  const { largura: cl, altura: ca } = DETETIVE.celula;
  const vazios = [];
  for (const vista of DETETIVE.vistas) {
    for (let q = 0; q < vista.quadros; q += 1) {
      let opacos = 0;
      for (let y = 0; y < ca; y += 1) {
        for (let x = 0; x < cl; x += 1) {
          const i = ((vista.linha * ca + y) * atlas.largura + q * cl + x) * 4 + 3;
          if (atlas.rgba[i] > 128) opacos += 1;
        }
      }
      if (opacos < 500) vazios.push(`${vista.nome}#${q} (${opacos} px)`);
    }
  }
  if (vazios.length) throw new Error(vazios.join(', '));
  return true;
});

// Os quadros de uma mesma vista precisam estar alinhados, senão a caminhada
// treme. O alinhamento é pelos pés: a última linha opaca de cada quadro.
conferir('os quadros de cada vista assentam na mesma linha de pés', () => {
  const { largura: cl, altura: ca } = DETETIVE.celula;
  const problemas = [];
  for (const vista of DETETIVE.vistas) {
    const bases = [];
    for (let q = 0; q < vista.quadros; q += 1) {
      let base = -1;
      for (let y = ca - 1; y >= 0 && base < 0; y -= 1) {
        for (let x = 0; x < cl; x += 1) {
          const i = ((vista.linha * ca + y) * atlas.largura + q * cl + x) * 4 + 3;
          if (atlas.rgba[i] > 128) {
            base = y;
            break;
          }
        }
      }
      bases.push(base);
    }
    const variacao = Math.max(...bases) - Math.min(...bases);
    if (variacao > 2) problemas.push(`${vista.nome}: ${variacao} px de variação`);
  }
  if (problemas.length) throw new Error(problemas.join('; '));
  return true;
});

// ---------- o mapa de direções ----------

secao('Detetive: direções');

const acervo = new Acervo(VISUAL);
const camera = new Camera();
const renderizador = new Renderizador(palco, camera, acervo);
const ctx = palco.getContext();

const cena = new Cena(CENAS[0]);
const detetive = {
  gx: cena.inicio.gx,
  gy: cena.inicio.gy,
  rota: [],
  andando: false,
  fase: 0,
  olhandoX: 0,
  olhandoY: 1,
};
const jogo = { cenaAtual: cena, detetive, vestigiosVisiveis: () => [] };

/** Desenha um quadro e devolve o que o atlas pintou do detetive. */
function desenharEObservar() {
  ctx.limparChamadas();
  renderizador.desenhar(jogo, null, null, 1);

  // O sprite do detetive é o único drawImage com recorte de origem na altura da
  // célula dele. Os losangos de chão vão com cinco argumentos.
  const doAtlas = ctx.chamadas.filter(
    (c) => c.metodo === 'drawImage' && c.args.length === 9 && c.args[4] === DETETIVE.celula.altura,
  );
  if (!doAtlas.length) return null;
  const ultima = doAtlas[doAtlas.length - 1];
  const [, origemX, origemY] = ultima.args;

  // Espelhar é um scale(-1, 1) dentro do save/restore do personagem.
  const espelhou = ctx.chamadas.some(
    (c) => c.metodo === 'scale' && c.args[0] === -1 && c.args[1] === 1,
  );

  return {
    quadro: origemX / DETETIVE.celula.largura,
    linha: origemY / DETETIVE.celula.altura,
    espelhou,
  };
}

// O primeiro quadro acontece antes de a imagem chegar: o acervo só começa a
// carregar quando alguém pede. Cair na figura geométrica nesse intervalo é o
// comportamento desejado — é o que permitiu adotar a arte sem nenhum instante
// de jogo quebrado.
conferir('no primeiro quadro, antes da imagem chegar, usa a figura geométrica', () => {
  return desenharEObservar() === null;
});

conferir('no quadro seguinte o detetive já vem do atlas', () => {
  const r = desenharEObservar();
  if (!r) throw new Error('nenhum desenho vindo do atlas');
  return true;
});

const porNome = new Map(DETETIVE.vistas.map((v) => [v.nome, v]));

/**
 * As oito direções da grade e a vista que cada uma deve usar.
 *
 * O rumo na tela sai da projeção: +gx vai para a direita e para baixo, +gy para
 * a esquerda e para baixo. Com cinco vistas para oito direções, as três que
 * faltam caem na mais próxima — e é exatamente isso que se confere aqui, para
 * ninguém trocar o lado sem perceber.
 */
const ESPERADO = [
  { dx: 1, dy: 1, vista: 'frente', espelhar: false, nota: 'direto para a câmera' },
  { dx: 0, dy: 1, vista: 'quarto', espelhar: false, nota: 'frente-esquerda' },
  { dx: 1, dy: 0, vista: 'quarto', espelhar: true, nota: 'frente-direita' },
  { dx: -1, dy: 0, vista: 'costasQuarto', espelhar: false, nota: 'costas-esquerda' },
  { dx: 0, dy: -1, vista: 'costasQuarto', espelhar: true, nota: 'costas-direita' },
  { dx: -1, dy: -1, vista: 'costasQuarto', espelhar: false, nota: 'direto para longe' },
];

for (const caso of ESPERADO) {
  conferir(`andar (${caso.dx},${caso.dy}) usa ${caso.vista}${caso.espelhar ? ' espelhada' : ''} — ${caso.nota}`, () => {
    const n = Math.hypot(caso.dx, caso.dy);
    detetive.olhandoX = caso.dx / n;
    detetive.olhandoY = caso.dy / n;
    detetive.andando = true;
    const r = desenharEObservar();
    if (!r) throw new Error('não desenhou do atlas');
    const esperada = porNome.get(caso.vista);
    if (r.linha !== esperada.linha) {
      const achada = DETETIVE.vistas.find((v) => v.linha === r.linha);
      throw new Error(`usou ${achada?.nome ?? r.linha} em vez de ${caso.vista}`);
    }
    if (r.espelhou !== caso.espelhar) {
      throw new Error(`espelhou=${r.espelhou}, esperado ${caso.espelhar}`);
    }
    return true;
  });
}

conferir('parado trava no primeiro quadro', () => {
  detetive.andando = false;
  detetive.fase = 37.5;
  return desenharEObservar().quadro === 0;
});

conferir('andando percorre os quadros e volta ao começo', () => {
  detetive.olhandoX = 0.7071;
  detetive.olhandoY = 0.7071;
  detetive.andando = true;
  const vista = porNome.get('frente');
  const vistos = new Set();
  for (let i = 0; i < 200; i += 1) {
    detetive.fase = i * 0.5;
    vistos.add(desenharEObservar().quadro);
  }
  if (vistos.size !== vista.quadros) {
    throw new Error(`viu ${vistos.size} quadros distintos de ${vista.quadros}`);
  }
  return [...vistos].every((q) => q >= 0 && q < vista.quadros);
});

conferir('nunca pede quadro fora da vista', () => {
  for (const caso of ESPERADO) {
    const n = Math.hypot(caso.dx, caso.dy);
    detetive.olhandoX = caso.dx / n;
    detetive.olhandoY = caso.dy / n;
    detetive.andando = true;
    const limite = porNome.get(caso.vista).quadros;
    for (let i = 0; i < 120; i += 1) {
      detetive.fase = i * 0.37;
      const r = desenharEObservar();
      if (r.quadro < 0 || r.quadro >= limite) {
        throw new Error(`${caso.vista} pediu quadro ${r.quadro} de ${limite}`);
      }
    }
  }
  return true;
});

conferir('sem imagem o jogo cai na figura geométrica sem quebrar', () => {
  const semArte = new Renderizador(palco, new Camera(), null);
  semArte.desenhar(jogo, null, null, 1);
  return true;
});

console.log();
if (falhas) {
  console.error(`Com falhas: ${checagens - falhas}/${checagens} checagens passaram.`);
  process.exit(1);
}
console.log(`Detetive em ordem: ${checagens}/${checagens} checagens passaram.`);
