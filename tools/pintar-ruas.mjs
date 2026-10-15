// Desenha a malha de ruas da cidade a partir de uma imagem de referência.
//
// Uso:
//   node tools/pintar-ruas.mjs <imagem.png> [centro|inteiro] [tilesPorQuarteirao]
//
// Exemplo:
//   node tools/pintar-ruas.mjs ~/mapa.png centro 10
//
// O que ele NÃO faz
// -----------------
// Não inventa prédio, não move passagem para onde quiser, não apaga decoração.
// Tudo o que já existe na cena é levado junto, inteiro, para dentro de um
// quarteirão livre — matrizes, lista de passagens e lista de decorações com os
// níveis. Só o chão em volta é novo.
//
// Por que translada em vez de só pintar
// -------------------------------------
// A primeira ideia era pintar apenas a camada de chão e deixar o resto parado.
// Não serve: o traçado novo tem outro tamanho que o mapa atual, então as
// coordenadas de tudo mudam de lugar em relação às ruas. Se o conteúdo ficasse
// parado, as ruas passariam por dentro dos prédios. Então o conteúdo inteiro
// anda junto, pelo mesmo deslocamento, e vai para o maior quarteirão que o
// couber.
//
// A imagem é só traço escuro sobre fundo claro. Cada tile que pega traço vira
// asfalto; onde a rua sai com um tile de largura, ela engrossa (três tiles é o
// mínimo para andar sem raspar na parede); em volta do asfalto entra calçada.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { decodificar } from './png.mjs';
import { Cena } from '../src/mundo/cena.js';

const RAIZ = resolve(import.meta.dirname, '..');
const ARQUIVO_CENA = join(RAIZ, 'src', 'dados', 'cena-cidade.js');

/** Limite de tamanho que o editor aceita. */
const LIMITE = 300;

/** Velocidade do detetive, para relatar a travessia em segundos. */
const TILES_POR_SEGUNDO = 3.4;

/**
 * Recortes da imagem de referência, em pixels.
 *
 * `centro` é a parte do desenho que tem quarteirão de verdade. No desenho
 * inteiro, os bairros densos — píeres, malha diagonal — pedem mais resolução do
 * que cabe no limite de 300 tiles, e saem como borrão.
 */
const RECORTES = {
  inteiro: { x0: 11, x1: 1259, y0: 79, y1: 1001 },
  centro: { x0: 240, x1: 820, y0: 170, y1: 580 },
};

/** Passo do quarteirão no desenho, medido pelos picos de traço. */
const PASSO_DESENHO = 45;

const [, , caminhoImagem, nomeRecorte = 'centro', escalaTexto = '10'] = process.argv;
if (!caminhoImagem) {
  console.error('uso: node tools/pintar-ruas.mjs <imagem.png> [centro|inteiro] [tiles/quarteirão]');
  process.exit(2);
}
const recorte = RECORTES[nomeRecorte];
if (!recorte) {
  console.error(`recorte desconhecido: ${nomeRecorte}. Use "centro" ou "inteiro".`);
  process.exit(2);
}
const tilesPorQuarteirao = Number(escalaTexto);

// ---------- traçado ----------

const img = decodificar(await readFile(caminhoImagem));

const tinta = new Uint8Array(img.largura * img.altura);
for (let p = 0; p < tinta.length; p += 1) {
  const i = p * 4;
  const lum = img.rgba[i] * 0.299 + img.rgba[i + 1] * 0.587 + img.rgba[i + 2] * 0.114;
  tinta[p] = lum < 200 ? 1 : 0;
}

const pxPorTile = PASSO_DESENHO / tilesPorQuarteirao;
const largura = Math.ceil((recorte.x1 - recorte.x0 + 1) / pxPorTile);
const altura = Math.ceil((recorte.y1 - recorte.y0 + 1) / pxPorTile);

if (largura > LIMITE || altura > LIMITE) {
  console.error(
    `o traçado daria ${largura}x${altura} e o editor aceita até ${LIMITE}. ` +
      'Use um recorte menor ou menos tiles por quarteirão.',
  );
  process.exit(1);
}

const dentro = (x, y) => x >= 0 && y >= 0 && x < largura && y < altura;
const ORTOGONAIS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const VIZINHOS = [...ORTOGONAIS, [1, 1], [1, -1], [-1, 1], [-1, -1]];

const bruta = new Uint8Array(largura * altura);
for (let ty = 0; ty < altura; ty += 1) {
  for (let tx = 0; tx < largura; tx += 1) {
    const px0 = Math.floor(recorte.x0 + tx * pxPorTile);
    const px1 = Math.min(recorte.x1, Math.floor(recorte.x0 + (tx + 1) * pxPorTile));
    const py0 = Math.floor(recorte.y0 + ty * pxPorTile);
    const py1 = Math.min(recorte.y1, Math.floor(recorte.y0 + (ty + 1) * pxPorTile));
    let achou = 0;
    for (let y = py0; y <= py1 && !achou; y += 1) {
      for (let x = px0; x <= px1; x += 1) {
        if (tinta[y * img.largura + x]) {
          achou = 1;
          break;
        }
      }
    }
    bruta[ty * largura + tx] = achou;
  }
}

// Engrossa só a rua fina. Dilatar tudo — como eu fazia antes — funde as ruas
// dos bairros densos numa massa sólida e o asfalto chega a 44% do mapa.
const asfalto = new Uint8Array(bruta);
const ehRua = (x, y) => dentro(x, y) && bruta[y * largura + x] === 1;
for (let ty = 0; ty < altura; ty += 1) {
  for (let tx = 0; tx < largura; tx += 1) {
    if (!bruta[ty * largura + tx]) continue;
    if (!ehRua(tx - 1, ty) || !ehRua(tx + 1, ty)) {
      if (dentro(tx + 1, ty)) asfalto[ty * largura + tx + 1] = 1;
    }
    if (!ehRua(tx, ty - 1) || !ehRua(tx, ty + 1)) {
      if (dentro(tx, ty + 1)) asfalto[(ty + 1) * largura + tx] = 1;
    }
  }
}

const calcada = new Uint8Array(largura * altura);
for (let ty = 0; ty < altura; ty += 1) {
  for (let tx = 0; tx < largura; tx += 1) {
    if (asfalto[ty * largura + tx]) continue;
    for (const [dx, dy] of VIZINHOS) {
      if (dentro(tx + dx, ty + dy) && asfalto[(ty + dy) * largura + tx + dx]) {
        calcada[ty * largura + tx] = 1;
        break;
      }
    }
  }
}

// ---------- a cena que já existe ----------

const { CENA_CIDADE: atual } = await import(`${ARQUIVO_CENA}?v=${Date.now()}`);
const cenaAtual = new Cena(atual);

// Caixa de tudo o que importa: chão pintado, objetos, passagens e decoração.
let cx0 = Infinity;
let cx1 = -1;
let cy0 = Infinity;
let cy1 = -1;
const abracar = (gx, gy) => {
  cx0 = Math.min(cx0, gx);
  cx1 = Math.max(cx1, gx);
  cy0 = Math.min(cy0, gy);
  cy1 = Math.max(cy1, gy);
};
atual.chao.forEach((linha, gy) => [...linha].forEach((ch, gx) => ch !== ' ' && abracar(gx, gy)));
atual.objetos.forEach((linha, gy) => [...linha].forEach((ch, gx) => ch !== '.' && abracar(gx, gy)));
for (const p of atual.passagens ?? []) abracar(p.gx, p.gy);
for (const d of atual.decoracoes ?? []) abracar(d.gx, d.gy);

const larguraConteudo = cx1 - cx0 + 1;
const alturaConteudo = cy1 - cy0 + 1;

// Declarados aqui, acima de `montar`, porque o laço de posições já os usa.
const CHAO_ASFALTO = 'a';
const CHAO_CALCADA = 'p';
const CHAO_VAZIO = ' ';

// ---------- onde o conteúdo cabe ----------

/**
 * Escolhe onde assentar o bairro que já existe.
 *
 * A primeira versão exigia um quarteirão livre do tamanho da caixa do conteúdo,
 * e recusou o traçado: 48 tiles de largura é mais do que qualquer quarteirão
 * desta malha. A exigência estava errada, não o traçado. O conteúdo atual não é
 * um prédio para caber num lote — é um bairro com rua própria no meio. Ele
 * sobrepõe uma região e as ruas dele emendam nas vizinhas.
 *
 * O critério que importa não é "não encostar em asfalto", é **a cidade
 * continuar inteira a pé**: do ponto de partida, o detetive tem de alcançar
 * quase todo o resto. Então aqui cada posição candidata é montada de verdade e
 * medida por alcance, da mais central para fora.
 */
function medirAlcance(dadosCandidatos) {
  const cena = new Cena(dadosCandidatos);
  const total = [];
  for (let gy = 0; gy < cena.altura; gy += 1) {
    for (let gx = 0; gx < cena.largura; gx += 1) {
      if (cena.andavel(gx, gy)) total.push(gy * cena.largura + gx);
    }
  }
  if (!total.length) return { fracao: 0, alcancados: 0, total: 0, cena };

  const visto = new Set();
  const fila = [cena.inicio.gy * cena.largura + cena.inicio.gx];
  visto.add(fila[0]);
  while (fila.length) {
    const p = fila.pop();
    const x = p % cena.largura;
    const y = (p - x) / cena.largura;
    for (const [dx, dy] of ORTOGONAIS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!cena.andavel(nx, ny)) continue;
      const r = ny * cena.largura + nx;
      if (visto.has(r)) continue;
      visto.add(r);
      fila.push(r);
    }
  }
  return { fracao: visto.size / total.length, alcancados: visto.size, total: total.length, cena };
}

/** Monta as matrizes com o conteúdo antigo assentado num deslocamento. */
function montar(deslocX, deslocY) {
  const chao = [];
  const objetos = [];
  for (let gy = 0; gy < altura; gy += 1) {
    const linhaChao = [];
    const linhaObjetos = [];
    for (let gx = 0; gx < largura; gx += 1) {
      const i = gy * largura + gx;
      linhaChao.push(asfalto[i] ? CHAO_ASFALTO : calcada[i] ? CHAO_CALCADA : CHAO_VAZIO);
      linhaObjetos.push('.');
    }
    chao.push(linhaChao);
    objetos.push(linhaObjetos);
  }

  let trazidos = 0;
  for (let gy = cy0; gy <= cy1; gy += 1) {
    for (let gx = cx0; gx <= cx1; gx += 1) {
      const chChao = atual.chao[gy]?.[gx] ?? ' ';
      const chObjeto = atual.objetos[gy]?.[gx] ?? '.';
      if (chChao === ' ' && chObjeto === '.') continue;
      const nx = gx + deslocX;
      const ny = gy + deslocY;
      if (!dentro(nx, ny)) continue;
      if (chChao !== ' ') chao[ny][nx] = chChao;
      if (chObjeto !== '.') objetos[ny][nx] = chObjeto;
      trazidos += 1;
    }
  }

  return {
    trazidos,
    dados: {
      ...atual,
      chao: chao.map((l) => l.join('')),
      objetos: objetos.map((l) => l.join('')),
      passagens: (atual.passagens ?? []).map((p) => ({
        ...p,
        gx: p.gx + deslocX,
        gy: p.gy + deslocY,
      })),
      decoracoes: (atual.decoracoes ?? []).map((d) => ({
        ...d,
        gx: d.gx + deslocX,
        gy: d.gy + deslocY,
      })),
    },
  };
}

/** Candidatos de posição, do centro para fora. */
function posicoesCandidatas() {
  const alvoX = Math.round((largura - larguraConteudo) / 2);
  const alvoY = Math.round((altura - alturaConteudo) / 2);
  const lista = [];
  const passo = Math.max(2, Math.round(tilesPorQuarteirao / 2));
  for (let raio = 0; raio <= 10; raio += 1) {
    for (let dy = -raio; dy <= raio; dy += 1) {
      for (let dx = -raio; dx <= raio; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        const x = alvoX + dx * passo;
        const y = alvoY + dy * passo;
        if (x < 0 || y < 0 || x + larguraConteudo > largura || y + alturaConteudo > altura) continue;
        lista.push({ x, y });
      }
    }
  }
  return lista;
}

/** Abaixo disto a cidade fica partida e não vale gravar. */
const ALCANCE_MINIMO = 0.9;

let escolhida = null;
let melhorTentativa = null;
for (const posicao of posicoesCandidatas()) {
  const tentativa = montar(posicao.x - cx0, posicao.y - cy0);
  if (Cena.conferir(tentativa.dados).length) continue;
  const alcance = medirAlcance(tentativa.dados);
  if (!melhorTentativa || alcance.fracao > melhorTentativa.alcance.fracao) {
    melhorTentativa = { posicao, tentativa, alcance };
  }
  if (alcance.fracao >= ALCANCE_MINIMO) {
    escolhida = { posicao, tentativa, alcance };
    break;
  }
}

if (!escolhida) {
  if (melhorTentativa) {
    console.error(
      `nenhuma posição deixa a cidade inteira a pé. A melhor alcança ` +
        `${(melhorTentativa.alcance.fracao * 100).toFixed(1)}% dos tiles pisáveis ` +
        `(mínimo ${ALCANCE_MINIMO * 100}%).`,
    );
  } else {
    console.error('nenhuma posição montou como cena válida.');
  }
  process.exit(1);
}

const vaga = escolhida.posicao;
const deslocX = vaga.x - cx0;
const deslocY = vaga.y - cy0;
const tilesTrazidos = escolhida.tentativa.trazidos;

// ---------- monta as matrizes novas ----------

// ---------- confere antes de gravar ----------

const dados = escolhida.tentativa.dados;
const novasPassagens = dados.passagens;
const novasDecoracoes = dados.decoracoes;
const cenaNova = escolhida.alcance.cena;

// Tudo o que precisa continuar pisável depois da mudança.
const quebrados = [];
if (!cenaNova.andavel(cenaNova.inicio.gx, cenaNova.inicio.gy)) {
  quebrados.push(`ponto de partida em ${cenaNova.inicio.gx},${cenaNova.inicio.gy}`);
}
for (const ponto of cenaNova.pontosDeVestigio) {
  if (!cenaNova.andavel(ponto.gx, ponto.gy)) quebrados.push(`vestígio em ${ponto.gx},${ponto.gy}`);
}
for (const ligacao of cenaNova.ligacoes) {
  if (!cenaNova.andavel(ligacao.gx, ligacao.gy)) {
    quebrados.push(`passagem para ${ligacao.para} em ${ligacao.gx},${ligacao.gy}`);
  }
}
if (quebrados.length) {
  console.error('a mudança deixaria coisa importante inacessível:');
  for (const q of quebrados) console.error(`  - ${q}`);
  process.exit(1);
}

// Conservação: nada pode ter se perdido na translação.
const contar = (matriz, alvo) =>
  matriz.reduce((n, linha) => n + [...linha].filter((c) => c === alvo).length, 0);
const conservacao = [];
for (const ch of new Set(atual.objetos.join('').replace(/\./g, ''))) {
  const antes = contar(atual.objetos, ch);
  const depois = contar(dados.objetos, ch);
  if (antes !== depois) conservacao.push(`objeto "${ch}": ${antes} antes, ${depois} depois`);
}
if ((atual.decoracoes ?? []).length !== novasDecoracoes.length) {
  conservacao.push(`decorações: ${(atual.decoracoes ?? []).length} antes, ${novasDecoracoes.length} depois`);
}
if ((atual.passagens ?? []).length !== novasPassagens.length) {
  conservacao.push(`passagens: ${(atual.passagens ?? []).length} antes, ${novasPassagens.length} depois`);
}
if (conservacao.length) {
  console.error('a translação perdeu coisa pelo caminho:');
  for (const c of conservacao) console.error(`  - ${c}`);
  process.exit(1);
}

// ---------- grava ----------

const aspas = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
const ligacoes = Object.entries(atual.ligacoes ?? {})
  .map(([ch, l]) => `    ${ch}: { para: ${aspas(l.para)}, rotulo: ${aspas(l.rotulo)} },`)
  .join('\n');

const texto = `// A CIDADE — o espaço que liga os locais da investigação.
//
// O chão desta cena é GERADO por \`node tools/pintar-ruas.mjs\`, a partir de um
// desenho de ruas. Prédios, passagens e decoração foram trazidos do mapa
// anterior pelo mesmo deslocamento, sem perder nada — a ferramenta recusa
// gravar se a conta não fechar.
//
// Traçado: recorte "${nomeRecorte}", ${tilesPorQuarteirao} tiles por quarteirão.
// Mapa ${largura}x${altura}. O conteúdo antigo entrou em ${vaga.x},${vaga.y}.
//
// CHÃO:            OBJETOS:
//   (espaço) vazio   .  nada          Y  árvore
//   p  calçada       #  prédio        H  banco
//   a  asfalto       L  poste         J  banca de jornal
//   g  grama         X  onde o detetive começa
//   t  ladrilho      *  ponto de vestígio
//                    1,2,3  entradas (ver \`ligacoes\`)

export const CENA_CIDADE = {
  id: ${aspas(atual.id)},
  nome: ${aspas(atual.nome)},
  endereco: ${aspas(atual.endereco)},
${atual.externo ? '\n  // Local aberto: vestígio só aparece aqui se pedir este local.\n  externo: true,\n' : ''}
  ligacoes: {
${ligacoes}
  },

  decoracoes: [
${novasDecoracoes
  .map(
    (d) =>
      `    { peca: ${aspas(d.peca)}, gx: ${d.gx}, gy: ${d.gy}` +
      `${Number.isInteger(d.nivel) && d.nivel > 0 ? `, nivel: ${d.nivel}` : ''}` +
      `${d.solido ? ', solido: true' : ''} },`,
  )
  .join('\n')}
  ],

  passagens: [
${novasPassagens
  .map(
    (p) =>
      `    { gx: ${p.gx}, gy: ${p.gy}, para: ${aspas(p.para)}` +
      `${p.rotulo ? `, rotulo: ${aspas(p.rotulo)}` : ''} },`,
  )
  .join('\n')}
  ],

  chao: [
${dados.chao.map((l) => `    '${l}',`).join('\n')}
  ],

  objetos: [
${dados.objetos.map((l) => `    '${l}',`).join('\n')}
  ],
};
`;

await writeFile(ARQUIVO_CENA, texto, 'utf8');

// ---------- relatório ----------

const tiles = largura * altura;
const totalAsfalto = asfalto.reduce((a, b) => a + b, 0);
const totalCalcada = calcada.reduce((a, b) => a + b, 0);

console.log(`traçado: recorte "${nomeRecorte}", ${tilesPorQuarteirao} tiles por quarteirão`);
console.log(`mapa: ${largura} x ${altura} (${tiles} tiles)`);
console.log(`  asfalto ${totalAsfalto} (${((totalAsfalto / tiles) * 100).toFixed(0)}%)`);
console.log(`  calçada ${totalCalcada}`);
console.log(`  atravessar na horizontal: ${Math.round(largura / TILES_POR_SEGUNDO)} s`);
console.log(`\nconteúdo antigo: ${larguraConteudo} x ${alturaConteudo}, ${tilesTrazidos} tiles com algo`);
console.log(`  foi para ${vaga.x},${vaga.y} (deslocamento ${deslocX},${deslocY})`);
console.log(`  ponto de partida agora em ${cenaNova.inicio.gx},${cenaNova.inicio.gy}`);
console.log(`  ${cenaNova.pontosDeVestigio.length} pontos de vestígio, ${cenaNova.ligacoes.length} passagens`);
console.log(`  ${novasDecoracoes.length} decorações`);
console.log(`\ngravado em src/dados/cena-cidade.js`);
