// Gera a cidade-hub como uma ilha orgânica, dividida em bairros.
//
// Uso: node tools/gerar-cidade.mjs
//
// Filosofia (o que diferencia esta versão da grade anterior)
// ----------------------------------------------------------
// A versão antiga era uma grade perfeita com tudo amontoado no centro — parecia
// planilha, não cidade. Aqui cada local foi lido pelo que ELE é e colocado numa
// zona que faz sentido geográfico:
//
//   orla/porto   — Cais do Porto, Pub Portuário, Fábrica, Estação de Trens
//   centro cívico — Prefeitura, Tribunal, Cartório, Banco (+ a praça da partida)
//   boêmio/comércio — Teatro, Hotel, Clube Rooftop, Striptease, Pub Central,
//                     Café, Trattoria, Bistrô, Restaurante, Escritório
//   saúde/justiça — Hospital, Laboratório Forense, Delegacia
//   alto da ilha — Igreja, Cemitério, Universidade
//   campo        — Campo de Golfe, Casa de Campo
//   litoral      — Casa de Praia
//
// Sanatório e Prisão NÃO ficam aqui: são alcançados por viagem, numa cena à
// parte (a ilha das instituições), montada por `montar-ilhotas.mjs`.
//
// A ilha tem contorno irregular (não um quadrado), o chão muda por zona, e os
// prédios ganham uma variação de posição com semente — reproduzível, mas sem o
// alinhamento de régua. As vias são avenidas largas ligando as zonas, mais um
// anel em volta da praça, não uma grade.
//
// Antes de gravar, monta tudo em memória e confere: cena válida, partida
// andável, e TODA porta alcançável a pé a partir da praça. Se não, aborta.

import { readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho } from '../src/mundo/caminho.js';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA = join(RAIZ, 'src', 'dados');

const MAPA = 600;

// Gerador com semente, para o mapa ser reproduzível mas não alinhado.
let semente = 20260114;
const rnd = () => {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
};
const entre = (a, b) => a + rnd() * (b - a);
const inteiro = (a, b) => Math.floor(entre(a, b + 1));

// ---------- zonas ----------
//
// Cada zona tem um centro (fração do mapa), um raio de espalhamento e um
// material de chão. Os prédios da zona caem perto do centro dela, com jitter.
const ZONAS = {
  porto: { cx: 0.5, cy: 0.14, raio: 0.17, chao: 'a', nome: 'Zona Portuária' },
  civico: { cx: 0.5, cy: 0.46, raio: 0.1, chao: 'p', nome: 'Centro Cívico' },
  boemio: { cx: 0.68, cy: 0.56, raio: 0.16, chao: 'a', nome: 'Centro Boêmio' },
  saude: { cx: 0.28, cy: 0.4, raio: 0.12, chao: 'p', nome: 'Distrito de Saúde' },
  alto: { cx: 0.3, cy: 0.72, raio: 0.14, chao: 'g', nome: 'Alto da Colina' },
  campo: { cx: 0.72, cy: 0.82, raio: 0.15, chao: 'g', nome: 'Interior' },
  litoral: { cx: 0.84, cy: 0.3, raio: 0.1, chao: 'g', nome: 'Litoral' },
};

// Cada local, com a zona a que pertence. Ordem só organiza a leitura.
const LOCAIS = [
  { id: 'cais-do-porto', nome: 'Cais do Porto', zona: 'porto' },
  { id: 'pub-portuario', nome: 'Pub Portuário', zona: 'porto' },
  { id: 'fabrica', nome: 'Fábrica', zona: 'porto' },
  { id: 'estacao-de-trens', nome: 'Estação Central de Trens', zona: 'porto' },

  { id: 'prefeitura', nome: 'Prefeitura', zona: 'civico' },
  { id: 'tribunal', nome: 'Tribunal de Justiça', zona: 'civico' },
  { id: 'cartorio', nome: 'Cartório de Registro', zona: 'civico' },
  { id: 'banco', nome: 'Banco', zona: 'civico' },

  { id: 'teatro', nome: 'Teatro Municipal', zona: 'boemio' },
  { id: 'hotel-de-luxo', nome: 'Hotel de Luxo', zona: 'boemio' },
  { id: 'clube-rooftop', nome: 'Clube Rooftop', zona: 'boemio' },
  { id: 'clube-striptease', nome: 'Clube de Striptease', zona: 'boemio' },
  { id: 'pub-central', nome: 'Pub Central', zona: 'boemio' },
  { id: 'cafe', nome: 'Café', zona: 'boemio' },
  { id: 'trattoria', nome: 'Trattoria', zona: 'boemio' },
  { id: 'bistro', nome: 'Bistrô', zona: 'boemio' },
  { id: 'restaurante', nome: 'Restaurante', zona: 'boemio' },
  { id: 'escritorio', nome: 'Escritório', zona: 'boemio' },

  { id: 'hospital', nome: 'Hospital Central', zona: 'saude' },
  { id: 'laboratorio-forense', nome: 'Laboratório Forense', zona: 'saude' },
  { id: 'delegacia', nome: 'Delegacia de Polícia', zona: 'saude' },

  { id: 'igreja', nome: 'Igreja', zona: 'alto' },
  { id: 'cemiterio', nome: 'Cemitério Municipal', zona: 'alto' },
  { id: 'universidade', nome: 'Universidade', zona: 'alto' },

  { id: 'campo-de-golfe', nome: 'Campo de Golfe', zona: 'campo' },
  { id: 'casa-de-campo', nome: 'Casa de Campo', zona: 'campo' },

  { id: 'casa-de-praia', nome: 'Casa de Praia', zona: 'litoral' },
];

// Sanatório e Prisão vão para a cena à parte, por viagem.
const POR_VIAGEM = ['sanatorio', 'prisao'];

// ---------- matrizes ----------

const chao = Array.from({ length: MAPA }, () => Array(MAPA).fill(' '));
const objetos = Array.from({ length: MAPA }, () => Array(MAPA).fill('.'));
const dentro = (x, y) => x >= 0 && y >= 0 && x < MAPA && y < MAPA;

// ---------- contorno da ilha ----------
//
// A ilha é uma mancha irregular, não um quadrado: um polígono de raios variados
// em volta do centro, suavizado. Quem estiver dentro do polígono é terra.
const CX = MAPA / 2;
const CY = MAPA / 2;
const RAIO_BASE = MAPA * 0.4;
const N_PONTOS = 24;
const raios = [];
for (let i = 0; i < N_PONTOS; i += 1) raios.push(RAIO_BASE * entre(0.78, 1.12));
// Suaviza, para a costa não ser serrilhada.
for (let passo = 0; passo < 3; passo += 1) {
  for (let i = 0; i < N_PONTOS; i += 1) {
    const a = raios[(i - 1 + N_PONTOS) % N_PONTOS];
    const b = raios[(i + 1) % N_PONTOS];
    raios[i] = (raios[i] * 2 + a + b) / 4;
  }
}
function raioNoAngulo(ang) {
  const t = ((ang / (Math.PI * 2)) % 1 + 1) % 1;
  const f = t * N_PONTOS;
  const i = Math.floor(f);
  const frac = f - i;
  return raios[i] * (1 - frac) + raios[(i + 1) % N_PONTOS] * frac;
}
function naIlha(x, y) {
  const dx = x - CX;
  const dy = y - CY;
  const ang = Math.atan2(dy, dx);
  return Math.hypot(dx, dy) <= raioNoAngulo(ang);
}

// Pinta a terra. O material base vem da zona mais próxima, para a ilha já
// nascer com cara de bairro (asfalto no porto, grama no campo etc.).
const centrosZona = Object.values(ZONAS).map((z) => ({
  x: z.cx * MAPA,
  y: z.cy * MAPA,
  chao: z.chao,
}));
for (let y = 0; y < MAPA; y += 1) {
  for (let x = 0; x < MAPA; x += 1) {
    if (!naIlha(x, y)) continue;
    let melhor = centrosZona[0];
    let menor = Infinity;
    for (const z of centrosZona) {
      const d = (z.x - x) ** 2 + (z.y - y) ** 2;
      if (d < menor) {
        menor = d;
        melhor = z;
      }
    }
    chao[y][x] = melhor.chao;
  }
}

// ---------- vias ----------
//
// Avenidas curvas ligando os centros de zona ao centro cívico, mais um anel em
// volta da praça. Nada de grade: cada via é uma polilinha com uma curva suave,
// engrossada para largura de rua.
const civ = { x: ZONAS.civico.cx * MAPA, y: ZONAS.civico.cy * MAPA };

function pintarDisco(cx, cy, raio, c) {
  const r = Math.ceil(raio);
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dy * dy > raio * raio) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (dentro(x, y) && chao[y][x] !== ' ') chao[y][x] = c;
    }
  }
}

/** Avenida de A a B com uma barriga lateral, para a via não ser reta. */
function avenida(ax, ay, bx, by, largura) {
  const mx = (ax + bx) / 2 + (by - ay) * entre(-0.18, 0.18);
  const my = (ay + by) / 2 + (ax - bx) * entre(-0.18, 0.18);
  const passos = Math.ceil(Math.hypot(bx - ax, by - ay));
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos;
    // Bézier quadrática por A, controle (mx,my), B.
    const x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * mx + t * t * bx;
    const y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * my + t * t * by;
    pintarDisco(x, y, largura / 2, 'a');
  }
}

// Anel em volta da praça cívica.
const RAIO_ANEL = ZONAS.civico.raio * MAPA * 1.1;
for (let a = 0; a < Math.PI * 2; a += 0.02) {
  pintarDisco(civ.x + Math.cos(a) * RAIO_ANEL, civ.y + Math.sin(a) * RAIO_ANEL, 2, 'a');
}

// Uma avenida do cívico para cada zona.
for (const z of Object.values(ZONAS)) {
  if (z === ZONAS.civico) continue;
  avenida(civ.x, civ.y, z.cx * MAPA, z.cy * MAPA, inteiro(4, 6));
}
// Algumas transversais entre zonas vizinhas, para não ser tudo radial.
avenida(ZONAS.porto.cx * MAPA, ZONAS.porto.cy * MAPA, ZONAS.litoral.cx * MAPA, ZONAS.litoral.cy * MAPA, 4);
avenida(ZONAS.boemio.cx * MAPA, ZONAS.boemio.cy * MAPA, ZONAS.campo.cx * MAPA, ZONAS.campo.cy * MAPA, 4);
avenida(ZONAS.saude.cx * MAPA, ZONAS.saude.cy * MAPA, ZONAS.alto.cx * MAPA, ZONAS.alto.cy * MAPA, 4);

// ---------- prédios ----------

const decoracoes = [];
const passagens = [];
const ocupados = [];

const TAMANHOS = [
  { l: 9, a: 7 },
  { l: 11, a: 9 },
  { l: 13, a: 10 },
  { l: 8, a: 8 },
  { l: 15, a: 11 },
];

/** Longe o bastante de todos os prédios já postos? */
function livre(x0, y0, l, a) {
  for (let y = y0 - 2; y < y0 + a + 2; y += 1) {
    for (let x = x0 - 2; x < x0 + l + 2; x += 1) {
      if (!dentro(x, y) || !naIlha(x, y)) return false;
    }
  }
  for (const o of ocupados) {
    if (x0 < o.x1 + 3 && x0 + l > o.x0 - 3 && y0 < o.y1 + 3 && y0 + a > o.y0 - 3) return false;
  }
  return true;
}

function telhadoDaBorda(x, y, x0, x1, y0, y1) {
  const esq = x === x0;
  const dir = x === x1;
  const topo = y === y0;
  const base = y === y1;
  if (topo && esq) return 'frm_roofCorner_W';
  if (topo && dir) return 'frm_roofCorner_N';
  if (base && esq) return 'frm_roofCorner_S';
  if (base && dir) return 'frm_roofCorner_E';
  if (topo) return 'frm_roof_N';
  if (base) return 'frm_roof_S';
  if (esq) return 'frm_roof_W';
  return 'frm_roof_E';
}

/** Tenta assentar um prédio na zona do local; devolve a porta ou null. */
function construir(local, indice) {
  const z = ZONAS[local.zona];
  const t = TAMANHOS[indice % TAMANHOS.length];
  const raio = z.raio * MAPA;

  for (let tentativa = 0; tentativa < 400; tentativa += 1) {
    const ang = rnd() * Math.PI * 2;
    const dist = Math.sqrt(rnd()) * raio;
    const cx = z.cx * MAPA + Math.cos(ang) * dist;
    const cy = z.cy * MAPA + Math.sin(ang) * dist;
    const x0 = Math.round(cx - t.l / 2);
    const y0 = Math.round(cy - t.a / 2);
    if (!livre(x0, y0, t.l, t.a)) continue;

    const x1 = x0 + t.l - 1;
    const y1 = y0 + t.a - 1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const contorno = x === x0 || x === x1 || y === y0 || y === y1;
        chao[y][x] = 't';
        objetos[y][x] = contorno ? '#' : '.';
        const peca = contorno ? telhadoDaBorda(x, y, x0, x1, y0, y1) : 'frm_roof_S';
        decoracoes.push({ peca, gx: x, gy: y, nivel: 2, solido: true });
      }
    }
    // Vão da porta no meio da fachada de baixo.
    const portaX = Math.round((x0 + x1) / 2);
    objetos[y1][portaX] = '.';
    const idx = decoracoes.findIndex((d) => d.gx === portaX && d.gy === y1);
    if (idx >= 0) decoracoes.splice(idx, 1);

    // A porta precisa de calçada embaixo e asfalto por perto; garante um pedaço
    // de calçada do prédio até a via mais próxima.
    const py = y1 + 1;
    for (let y = y1 + 1; y <= y1 + 4 && dentro(portaX, y); y += 1) {
      if (chao[y][portaX] === ' ' || chao[y][portaX] === 't') chao[y][portaX] = 'p';
    }
    chao[py] && (chao[py][portaX] = 'p');

    ocupados.push({ x0, y0, x1, y1 });
    passagens.push({ gx: portaX, gy: py, para: local.id, rotulo: `Entrar: ${local.nome}` });
    return true;
  }
  return false;
}

const falhou = [];
LOCAIS.forEach((local, i) => {
  if (!construir(local, i)) falhou.push(local.id);
});
if (falhou.length) {
  console.error(`não coube ${falhou.length} prédio(s): ${falhou.join(', ')}`);
  console.error('zonas apertadas demais; aumente o raio ou o mapa.');
  process.exit(1);
}

// ---------- praça e partida ----------
//
// A praça cívica é um largo de calçada no centro; a partida fica no meio dela.
pintarDisco(civ.x, civ.y, ZONAS.civico.raio * MAPA * 0.5, 'p');
const partida = { gx: Math.round(civ.x), gy: Math.round(civ.y) };
// Garante que o tile da partida está livre de prédio.
objetos[partida.gy][partida.gx] = 'X';

// ---------- confere ----------

const dados = {
  id: 'cidade',
  nome: 'Cidade',
  endereco: 'Ilha',
  externo: true,
  ligacoes: {},
  decoracoes,
  passagens,
  chao: chao.map((l) => l.join('')),
  objetos: objetos.map((l) => l.join('')),
};

const problemas = Cena.conferir(dados);
if (problemas.length) {
  console.error('a cidade não monta:');
  for (const p of problemas.slice(0, 10)) console.error(`  - ${p}`);
  process.exit(1);
}

const cena = new Cena(dados);
if (!cena.andavel(cena.inicio.gx, cena.inicio.gy)) {
  console.error(`partida bloqueada em ${cena.inicio.gx},${cena.inicio.gy}`);
  process.exit(1);
}

const presas = [];
for (const ligacao of cena.ligacoes) {
  if (!buscarCaminho(cena, cena.inicio, ligacao).length) {
    presas.push(`${ligacao.para} (${ligacao.gx},${ligacao.gy})`);
  }
}
if (presas.length) {
  console.error(`${presas.length} portas inacessíveis a pé:`);
  for (const p of presas.slice(0, 12)) console.error(`  - ${p}`);
  process.exit(1);
}

const arquivos = new Set(
  (await readdir(PASTA)).filter((n) => /^cena-[a-z0-9-]+\.js$/.test(n)).map((n) => n.replace(/^cena-|\.js$/g, '')),
);
const semCena = LOCAIS.filter((l) => !arquivos.has(l.id));
if (semCena.length) {
  console.error(`locais sem cena: ${semCena.map((l) => l.id).join(', ')}`);
  process.exit(1);
}

// ---------- grava ----------

const aspas = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
const matriz = (nome, linhas) =>
  `  ${nome}: [\n${linhas.map((l) => `    '${l.replace(/'/g, "\\'")}',`).join('\n')}\n  ],`;

const texto = `// A CIDADE — ilha dividida em bairros, hub da investigação.
//
// GERADA por \`node tools/gerar-cidade.mjs\`. Contorno irregular, zonas com
// material de chão próprio, avenidas curvas. Cada prédio tem porta na fachada
// que leva a uma cena. Sanatório e Prisão não estão aqui: são alcançados por
// viagem (ver a cena da ilha das instituições).
//
// Mapa ${MAPA}x${MAPA}. ${LOCAIS.length} prédios, ${passagens.length} portas.
// Refinada no editor.

export const CENA_CIDADE = {
  id: 'cidade',
  nome: 'Cidade',
  endereco: 'Ilha',
  externo: true,

  ligacoes: {},

  decoracoes: [
${decoracoes.map((d) => `    { peca: ${aspas(d.peca)}, gx: ${d.gx}, gy: ${d.gy}, nivel: ${d.nivel}, solido: true },`).join('\n')}
  ],

  passagens: [
${passagens.map((p) => `    { gx: ${p.gx}, gy: ${p.gy}, para: ${aspas(p.para)}, rotulo: ${aspas(p.rotulo)} },`).join('\n')}
  ],

${matriz('chao', dados.chao)}

${matriz('objetos', dados.objetos)}
};
`;

await writeFile(join(PASTA, 'cena-cidade.js'), texto, 'utf8');

const tiles = cena.largura * cena.altura;
let terra = 0;
for (const linha of chao) for (const c of linha) if (c !== ' ') terra += 1;
console.log(`cidade gerada: ${MAPA}x${MAPA}, ${terra} tiles de terra (${((terra / tiles) * 100).toFixed(0)}% ilha)`);
console.log(`  ${LOCAIS.length} prédios em ${Object.keys(ZONAS).length} bairros, ${passagens.length} portas`);
console.log(`  partida na praça cívica: ${cena.inicio.gx},${cena.inicio.gy}`);
console.log(`  Sanatório e Prisão ficam por viagem (fora da ilha)`);
console.log(`  todas as portas alcançáveis a pé: sim`);
console.log('\ngravado em src/dados/cena-cidade.js');
