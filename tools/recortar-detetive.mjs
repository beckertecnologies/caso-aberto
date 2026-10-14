// Recorta a folha de referência do detetive num atlas de caminhada.
//
// Uso: `npm run detetive`
//
// O que entra
// -----------
// `assets/detetive/folha-original.png`, uma folha gerada por IA. Ela não é um
// sprite sheet de jogo: é uma prancha de referência. As figuras estão soltas,
// sem grade, com rótulo de texto embutido, em três escalas diferentes, e o PNG
// não tem canal alfa — o fundo é um cinza chapado (44,44,44).
//
// O que sai
// ---------
// `assets/detetive/caminhada.png`, um atlas de células iguais com as figuras
// recortadas, alinhadas e com fundo transparente, mais o manifesto
// `src/dados/detetive.js`.
//
// Decisões que valem explicação
// -----------------------------
// 1. Só a faixa da caminhada é usada. A prancha tem também uma volta completa
//    (8 vistas paradas) e sete poses de ação, mas em OUTRA escala — as figuras
//    da volta têm 218 px de altura contra 136 da caminhada. Misturar faria o
//    detetive mudar de tamanho ao começar a andar, o que é pior que não ter
//    pose de parado: o parado sai do primeiro quadro de cada direção.
//
// 2. O fundo sai por preenchimento a partir das bordas, não por limite de cor.
//    O terno é quase preto e o vão entre as pernas é cinza de fundo; separar
//    por cor abriria buracos no terno. O preenchimento respeita a silhueta e
//    ainda limpa o vão entre as pernas, que é o que se quer.
//
// 3. O alinhamento usa o centro da cabeça, e não o centro da caixa. Numa
//    caminhada os braços e as pernas abrem e fecham, então a caixa balança de
//    quadro a quadro e a figura tremeria. A cabeça é a parte que menos se move.
//
// 4. A tira do meio tem SETE quadros, não oito. O rótulo na prancha diz
//    "8 FRAMES", mas o gerador desenhou sete. Medido, não suposto.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { codificar, decodificar } from './png.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const ENTRADA = join(RAIZ, 'assets', 'detetive', 'folha-original.png');
const SAIDA_ATLAS = join(RAIZ, 'assets', 'detetive', 'caminhada.png');
const SAIDA_PREVIA = join(RAIZ, 'assets', 'detetive', 'previa-recorte.png');
const SAIDA_MANIFESTO = join(RAIZ, 'src', 'dados', 'detetive.js');

/** Cor do fundo da prancha, medida nas bordas. */
const FUNDO = [44, 44, 44];

/** Até onde um pixel conta como fundo no preenchimento. */
const TOLERANCIA_FUNDO = 10;

/** Faixa vertical da caminhada na prancha, medida. */
const FAIXA_CAMINHADA = { y0: 351, y1: 486 };

/**
 * As três tiras da caminhada, na ordem em que aparecem.
 *
 * `giro` é quanto a figura está virada em relação a "de frente para a câmera",
 * em graus, no sentido horário na tela. Vem dos rótulos da própria prancha.
 */
const TIRAS = [
  { nome: 'frente', giro: 0 },
  { nome: 'quarto', giro: 45 },
  { nome: 'costasQuarto', giro: 135 },
];

/** Vão mínimo entre colunas para separar duas tiras (dentro da tira é ~10 px). */
const VAO_ENTRE_TIRAS = 25;

const idx = (img, x, y) => (y * img.largura + x) * 4;

function distanciaDoFundo(img, x, y) {
  const i = idx(img, x, y);
  return Math.max(
    Math.abs(img.rgba[i] - FUNDO[0]),
    Math.abs(img.rgba[i + 1] - FUNDO[1]),
    Math.abs(img.rgba[i + 2] - FUNDO[2]),
  );
}

/**
 * Marca o fundo partindo das bordas.
 *
 * Fila explícita em vez de recursão: a imagem tem 1,3 milhão de pixels e uma
 * recursão desse tamanho estoura a pilha.
 */
function acharFundo(img) {
  const { largura, altura } = img;
  const fora = new Uint8Array(largura * altura);
  const fila = [];

  const tentar = (x, y) => {
    if (x < 0 || y < 0 || x >= largura || y >= altura) return;
    const p = y * largura + x;
    if (fora[p]) return;
    if (distanciaDoFundo(img, x, y) > TOLERANCIA_FUNDO) return;
    fora[p] = 1;
    fila.push(p);
  };

  for (let x = 0; x < largura; x += 1) {
    tentar(x, 0);
    tentar(x, altura - 1);
  }
  for (let y = 0; y < altura; y += 1) {
    tentar(0, y);
    tentar(largura - 1, y);
  }

  while (fila.length) {
    const p = fila.pop();
    const x = p % largura;
    const y = (p - x) / largura;
    tentar(x + 1, y);
    tentar(x - 1, y);
    tentar(x, y + 1);
    tentar(x, y - 1);
  }

  return fora;
}

/**
 * Apaga ilhas de conteúdo menores que `minimo` pixels.
 *
 * A prancha veio de um gerador e tem ruído de compressão: pontinhos de cor no
 * meio do fundo que o preenchimento não atravessa e que virariam poeira
 * flutuando em volta do personagem.
 */
function limparPoeira(img, fora, minimo = 24) {
  const { largura, altura } = img;
  const visto = new Uint8Array(largura * altura);

  for (let p = 0; p < fora.length; p += 1) {
    if (fora[p] || visto[p]) continue;
    const grupo = [];
    const fila = [p];
    visto[p] = 1;
    while (fila.length) {
      const q = fila.pop();
      grupo.push(q);
      const x = q % largura;
      const y = (q - x) / largura;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
        const r = ny * largura + nx;
        if (fora[r] || visto[r]) continue;
        visto[r] = 1;
        fila.push(r);
      }
    }
    if (grupo.length < minimo) for (const q of grupo) fora[q] = 1;
  }
}

/** Colunas com conteúdo numa faixa, e os vãos entre elas. */
function colunasComConteudo(img, fora, y0, y1) {
  const { largura } = img;
  const cheio = new Array(largura).fill(false);
  for (let x = 0; x < largura; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      if (!fora[y * largura + x]) {
        cheio[x] = true;
        break;
      }
    }
  }

  const grupos = [];
  let inicio = -1;
  for (let x = 0; x <= largura; x += 1) {
    if (x < largura && cheio[x]) {
      if (inicio < 0) inicio = x;
    } else if (inicio >= 0) {
      grupos.push({ x0: inicio, x1: x - 1 });
      inicio = -1;
    }
  }
  return grupos;
}

/** Junta colunas vizinhas em tiras, cortando onde o vão é grande. */
function agruparEmTiras(colunas) {
  const tiras = [];
  let atual = [colunas[0]];
  for (let i = 1; i < colunas.length; i += 1) {
    const vao = colunas[i].x0 - colunas[i - 1].x1 - 1;
    if (vao >= VAO_ENTRE_TIRAS) {
      tiras.push(atual);
      atual = [];
    }
    atual.push(colunas[i]);
  }
  tiras.push(atual);
  return tiras;
}

/**
 * Mede um quadro: caixa do conteúdo, base dos pés e centro da cabeça.
 *
 * O centro da cabeça é a mediana das colunas opacas no quinto de cima da
 * figura. Mediana e não média: um braço erguido puxaria a média.
 */
function medirQuadro(img, fora, x0, x1, y0, y1) {
  const { largura } = img;
  let esq = x1;
  let dir = x0;
  let topo = y1;
  let base = y0;

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (fora[y * largura + x]) continue;
      if (x < esq) esq = x;
      if (x > dir) dir = x;
      if (y < topo) topo = y;
      if (y > base) base = y;
    }
  }
  if (dir < esq) return null;

  const alturaFigura = base - topo + 1;
  const limiteCabeca = topo + Math.max(4, Math.round(alturaFigura * 0.2));
  const colunas = [];
  for (let y = topo; y <= limiteCabeca; y += 1) {
    for (let x = esq; x <= dir; x += 1) {
      if (!fora[y * largura + x]) colunas.push(x);
    }
  }
  colunas.sort((a, b) => a - b);
  const centroCabeca = colunas.length
    ? colunas[Math.floor(colunas.length / 2)]
    : Math.round((esq + dir) / 2);

  return { esq, dir, topo, base, centroCabeca };
}

// ---------- montagem ----------

const folha = decodificar(await readFile(ENTRADA));
console.log(`prancha ${folha.largura}x${folha.altura}`);

const fora = acharFundo(folha);
const antes = fora.reduce((n, v) => n + v, 0);
limparPoeira(folha, fora);
const depois = fora.reduce((n, v) => n + v, 0);
console.log(
  `fundo: ${antes} px pelo preenchimento, ${depois - antes} px de poeira removida ` +
    `(${((depois / fora.length) * 100).toFixed(1)}% da prancha)`,
);

const colunas = colunasComConteudo(folha, fora, FAIXA_CAMINHADA.y0, FAIXA_CAMINHADA.y1);
const tiras = agruparEmTiras(colunas);
console.log(`\nfaixa da caminhada: ${colunas.length} quadros em ${tiras.length} tiras`);
if (tiras.length !== TIRAS.length) {
  throw new Error(`esperava ${TIRAS.length} tiras e achei ${tiras.length}`);
}

const quadros = [];
for (const [i, tira] of tiras.entries()) {
  const medidas = tira
    .map((c) => medirQuadro(folha, fora, c.x0, c.x1, FAIXA_CAMINHADA.y0, FAIXA_CAMINHADA.y1))
    .filter(Boolean);
  console.log(`  ${TIRAS[i].nome} (${TIRAS[i].giro}°): ${medidas.length} quadros`);
  quadros.push({ ...TIRAS[i], medidas });
}

// Célula do atlas: cabe o maior quadro, com folga de 1 px de cada lado.
const todas = quadros.flatMap((t) => t.medidas);
const maiorEsquerda = Math.max(...todas.map((m) => m.centroCabeca - m.esq));
const maiorDireita = Math.max(...todas.map((m) => m.dir - m.centroCabeca));
const maiorAltura = Math.max(...todas.map((m) => m.base - m.topo));

const CELULA_L = maiorEsquerda + maiorDireita + 3;
const CELULA_A = maiorAltura + 3;
const PIVO_X = maiorEsquerda + 1;
const PIVO_Y = CELULA_A - 2; // linha dos pés dentro da célula

const colunasAtlas = Math.max(...quadros.map((t) => t.medidas.length));
const atlas = {
  largura: CELULA_L * colunasAtlas,
  altura: CELULA_A * quadros.length,
  rgba: new Uint8Array(CELULA_L * colunasAtlas * CELULA_A * quadros.length * 4),
};

console.log(
  `\natlas ${atlas.largura}x${atlas.altura}, célula ${CELULA_L}x${CELULA_A}, ` +
    `pivô ${PIVO_X},${PIVO_Y}`,
);

/** Copia um quadro para a célula, alinhado pelo pivô, com borda suavizada. */
function colar(medida, celulaX, celulaY) {
  const baseX = celulaX * CELULA_L + PIVO_X - (medida.centroCabeca - medida.esq);
  const baseY = celulaY * CELULA_A + PIVO_Y - (medida.base - medida.topo);

  for (let y = medida.topo; y <= medida.base; y += 1) {
    for (let x = medida.esq; x <= medida.dir; x += 1) {
      const p = y * folha.largura + x;
      if (fora[p]) continue;

      const dx = baseX + (x - medida.esq);
      const dy = baseY + (y - medida.topo);
      if (dx < 0 || dy < 0 || dx >= atlas.largura || dy >= atlas.altura) continue;

      // Suaviza só a silhueta: pixel encostado no fundo entra com alfa parcial,
      // tirado da própria distância até a cor de fundo. Sem isso a borda fica
      // serrada; aplicando no interior, apareceriam buracos nos cinzas da peça.
      const naBorda =
        fora[p - 1] ||
        fora[p + 1] ||
        fora[p - folha.largura] ||
        fora[p + folha.largura];
      const distancia = distanciaDoFundo(folha, x, y);
      const alfa = naBorda ? Math.max(70, Math.min(255, Math.round((distancia - 3) * 21))) : 255;

      const origem = idx(folha, x, y);
      const destino = (dy * atlas.largura + dx) * 4;
      atlas.rgba[destino] = folha.rgba[origem];
      atlas.rgba[destino + 1] = folha.rgba[origem + 1];
      atlas.rgba[destino + 2] = folha.rgba[origem + 2];
      atlas.rgba[destino + 3] = alfa;
    }
  }
}

for (const [linha, tira] of quadros.entries()) {
  for (const [coluna, medida] of tira.medidas.entries()) colar(medida, coluna, linha);
}

await mkdir(join(RAIZ, 'assets', 'detetive'), { recursive: true });
await writeFile(SAIDA_ATLAS, codificar(atlas));
console.log(`\natlas gravado em assets/detetive/caminhada.png`);

// Prévia com fundo xadrez, só para conferir o recorte a olho.
const previa = {
  largura: atlas.largura,
  altura: atlas.altura,
  rgba: new Uint8Array(atlas.rgba.length),
};
for (let y = 0; y < previa.altura; y += 1) {
  for (let x = 0; x < previa.largura; x += 1) {
    const i = (y * previa.largura + x) * 4;
    const xadrez = ((x >> 3) + (y >> 3)) % 2 ? 120 : 160;
    const a = atlas.rgba[i + 3] / 255;
    previa.rgba[i] = Math.round(atlas.rgba[i] * a + xadrez * (1 - a));
    previa.rgba[i + 1] = Math.round(atlas.rgba[i + 1] * a + xadrez * (1 - a));
    previa.rgba[i + 2] = Math.round(atlas.rgba[i + 2] * a + xadrez * (1 - a));
    previa.rgba[i + 3] = 255;
  }
}
await writeFile(SAIDA_PREVIA, codificar(previa));
console.log('prévia em assets/detetive/previa-recorte.png');

const manifesto = `// Atlas do detetive — GERADO por \`npm run detetive\`.
//
// Não edite à mão: é reescrito a cada recorte. A origem é
// \`assets/detetive/folha-original.png\` e o recorte mora em
// \`tools/recortar-detetive.mjs\`, que explica as decisões.
//
// \`giro\` é quanto a figura está virada em relação a estar de frente para a
// câmera, em graus no sentido horário da tela. O renderizador escolhe a vista
// mais próxima do rumo do personagem e espelha quando precisa do outro lado —
// a prancha só tem metade das direções.

export const DETETIVE = {
  arquivo: 'detetive/caminhada.png',
  celula: { largura: ${CELULA_L}, altura: ${CELULA_A} },
  /** Onde ficam os pés dentro da célula, em fração da altura. */
  ancora: ${(PIVO_Y / CELULA_A).toFixed(4)},
  /**
   * Altura do personagem em pixels de mundo. Um tile tem 64 de largura.
   *
   * Escolhido comparando com o acervo, não por gosto: a 62 px o detetive ficava
   * da altura da parede de pedra e não passaria pelo arco da porta. A 52 ele
   * fica abaixo da parede, o arco vence a cabeça dele e a estante bate no
   * ombro — as três proporções que o olho confere sem pensar.
   */
  alturaAlvo: 52,
  vistas: [
${quadros
  .map(
    (t, i) =>
      `    { nome: '${t.nome}', giro: ${t.giro}, linha: ${i}, quadros: ${t.medidas.length} },`,
  )
  .join('\n')}
  ],
};
`;

await writeFile(SAIDA_MANIFESTO, manifesto, 'utf8');
console.log('manifesto em src/dados/detetive.js');
