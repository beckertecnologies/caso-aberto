// Distribui as 29 cenas nas marcas de prédio que você desenhou na cidade.
//
// Uso: node tools/distribuir-cenas.mjs
//
// O que faz
// ---------
// Lê as marcas `M` que você espalhou no editor, decide qual local vai em cada
// uma, constrói um prédio pequeno em volta de cada marca (parede + telhado +
// porta) e abre a passagem para a cena. Se faltarem marcas para os 29 locais,
// completa sozinho em tiles livres espaçados. Sanatório e prisão vão nas marcas
// mais à direita (a ilhota).
//
// Nada do seu traçado de ruas é tocado: a ferramenta só escreve prédios e
// passagens por cima dos tiles das marcas, e troca cada `M` por piso. Antes de
// gravar, confere que tudo monta e que cada porta é alcançável a pé. Se não,
// aborta sem escrever.
//
// É idempotente: pode rodar de novo. Começa relendo o backup do desenho à mão
// se o arquivo atual já tiver prédios, para não empilhar.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho } from '../src/mundo/caminho.js';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA = join(RAIZ, 'src', 'dados');

// Os 29 locais. `ilhota: true` prefere as marcas à direita.
const LOCAIS = [
  { id: 'prefeitura', nome: 'Prefeitura' },
  { id: 'tribunal', nome: 'Tribunal de Justiça' },
  { id: 'cartorio', nome: 'Cartório de Registro' },
  { id: 'banco', nome: 'Banco' },
  { id: 'teatro', nome: 'Teatro Municipal' },
  { id: 'hotel-de-luxo', nome: 'Hotel de Luxo' },
  { id: 'clube-rooftop', nome: 'Clube Rooftop' },
  { id: 'clube-striptease', nome: 'Clube de Striptease' },
  { id: 'pub-central', nome: 'Pub Central' },
  { id: 'cafe', nome: 'Café' },
  { id: 'trattoria', nome: 'Trattoria' },
  { id: 'bistro', nome: 'Bistrô' },
  { id: 'restaurante', nome: 'Restaurante' },
  { id: 'escritorio', nome: 'Escritório' },
  { id: 'hospital', nome: 'Hospital Central' },
  { id: 'laboratorio-forense', nome: 'Laboratório Forense' },
  { id: 'delegacia', nome: 'Delegacia de Polícia' },
  { id: 'igreja', nome: 'Igreja' },
  { id: 'cemiterio', nome: 'Cemitério Municipal' },
  { id: 'universidade', nome: 'Universidade' },
  { id: 'campo-de-golfe', nome: 'Campo de Golfe' },
  { id: 'casa-de-campo', nome: 'Casa de Campo' },
  { id: 'casa-de-praia', nome: 'Casa de Praia' },
  { id: 'cais-do-porto', nome: 'Cais do Porto' },
  { id: 'pub-portuario', nome: 'Pub Portuário' },
  { id: 'fabrica', nome: 'Fábrica' },
  { id: 'estacao-de-trens', nome: 'Estação Central de Trens' },
  { id: 'sanatorio', nome: 'Sanatório Municipal', ilhota: true },
  { id: 'prisao', nome: 'Prisão Municipal', ilhota: true },
];

// ---------- lê o desenho à mão ----------
//
// Se o arquivo atual já tem prédios (rodou antes), parte do backup mais recente
// do desenho à mão, para não empilhar prédio sobre prédio.
const { CENA_CIDADE: atualMod } = await import(`${join(PASTA, 'cena-cidade.js')}?v=${Date.now()}`);
let origem = atualMod;
if ((atualMod.decoracoes ?? []).length > 0) {
  // Procura o backup mais recente do desenho à mão.
  const { readdir } = await import('node:fs/promises');
  const backups = (await readdir(join(RAIZ, '.backup')))
    .filter((n) => n.startsWith('cena-cidade.DESENHADA-MAO-'))
    .sort()
    .reverse();
  if (backups.length) {
    const texto = await readFile(join(RAIZ, '.backup', backups[0]), 'utf8');
    const mod = await import(`data:text/javascript,${encodeURIComponent(texto)}`);
    origem = mod.CENA_CIDADE;
    console.log(`partindo do backup limpo: ${backups[0]}`);
  }
}

const chao = origem.chao.map((l) => l.split(''));
const objetos = origem.objetos.map((l) => l.split(''));
const L = chao[0].length;
const A = chao.length;
const dentro = (x, y) => x >= 0 && y >= 0 && x < L && y < A;

const cenaOrigem = new Cena(origem);
const andavel = (x, y) => cenaOrigem.andavel(x, y);

// ---------- coleta as marcas ----------

const marcas = [...cenaOrigem.marcasPredio];
console.log(`marcas desenhadas: ${marcas.length}`);

// Divide: as mais à direita (x alto) são da ilhota, para sanatório e prisão.
marcas.sort((a, b) => b.gx - a.gx);
const nIlhota = LOCAIS.filter((l) => l.ilhota).length;
const marcasIlhota = marcas.slice(0, nIlhota);
let marcasIlha = marcas.slice(nIlhota);

// ---------- completa marcas que faltam ----------

const ocupado = new Set(marcas.map((m) => `${m.gx},${m.gy}`));
const longe = (gx, gy, raio) => {
  for (const chave of ocupado) {
    const [ox, oy] = chave.split(',').map(Number);
    if (Math.abs(ox - gx) < raio && Math.abs(oy - gy) < raio) return false;
  }
  return true;
};

/** Acha `quantas` vagas espaçadas de área 5x5 andável, numa faixa de x. */
function acharVagas(quantas, xMin, xMax, raio = 14) {
  const vagas = [];
  for (let y = 20; y < A - 20 && vagas.length < quantas; y += 3) {
    for (let x = xMin; x < xMax && vagas.length < quantas; x += 3) {
      if (!andavel(x, y)) continue;
      let ok = true;
      for (let dy = -3; dy <= 4 && ok; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) if (!andavel(x + dx, y + dy)) { ok = false; break; }
      }
      if (ok && longe(x, y, raio)) {
        vagas.push({ gx: x, gy: y });
        ocupado.add(`${x},${y}`);
      }
    }
  }
  return vagas;
}

const locaisIlha = LOCAIS.filter((l) => !l.ilhota);
const faltamIlha = locaisIlha.length - marcasIlha.length;
if (faltamIlha > 0) {
  const extra = acharVagas(faltamIlha, 50, 480);
  if (extra.length < faltamIlha) {
    console.error(`faltam ${faltamIlha} marcas na ilha e só achei ${extra.length} vagas.`);
    process.exit(1);
  }
  marcasIlha = marcasIlha.concat(extra);
  console.log(`completei ${extra.length} marca(s) na ilha automaticamente`);
}

const faltamIlhota = nIlhota - marcasIlhota.length;
let marcasIlhotaFinal = marcasIlhota;
if (faltamIlhota > 0) {
  const extra = acharVagas(faltamIlhota, 490, L - 5, 10);
  if (extra.length < faltamIlhota) {
    console.error(`faltam ${faltamIlhota} marcas na ilhota e só achei ${extra.length} vagas.`);
    process.exit(1);
  }
  marcasIlhotaFinal = marcasIlhota.concat(extra);
  console.log(`completei ${extra.length} marca(s) na ilhota automaticamente`);
}

// ---------- atribui local a marca ----------
//
// Local da ilhota → marca da ilhota. Local da ilha → marca da ilha, na ordem
// em que foram desenhadas (de cima para baixo), que costuma seguir a intuição.
marcasIlha.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
const atribuicoes = [];
let i = 0;
let j = 0;
for (const local of LOCAIS) {
  const marca = local.ilhota ? marcasIlhotaFinal[j++] : marcasIlha[i++];
  atribuicoes.push({ local, marca });
}

// ---------- constrói prédios ----------

const decoracoes = [];
const passagens = [];

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

/** Prédio centrado na marca; devolve a porta (tile em frente ao vão). */
function construir(marca, local) {
  const l = 7;
  const a = 6;
  const x0 = marca.gx - Math.floor(l / 2);
  const y0 = marca.gy - Math.floor(a / 2);
  const x1 = x0 + l - 1;
  const y1 = y0 + a - 1;

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!dentro(x, y)) continue;
      const contorno = x === x0 || x === x1 || y === y0 || y === y1;
      chao[y][x] = 't';
      objetos[y][x] = contorno ? '#' : '.';
      const peca = contorno ? telhadoDaBorda(x, y, x0, x1, y0, y1) : 'frm_roof_S';
      decoracoes.push({ peca, gx: x, gy: y, nivel: 2, solido: true });
    }
  }
  // Vão da porta no meio de baixo; tira o telhado de cima dela.
  const portaX = marca.gx;
  if (dentro(portaX, y1)) objetos[y1][portaX] = '.';
  const idx = decoracoes.findIndex((d) => d.gx === portaX && d.gy === y1);
  if (idx >= 0) decoracoes.splice(idx, 1);

  // Porta: um tile abaixo da fachada; garante piso andável ali.
  const py = y1 + 1;
  if (dentro(portaX, py) && (chao[py][portaX] === ' ' || chao[py][portaX] === '~')) {
    chao[py][portaX] = 'p';
  }
  passagens.push({ gx: portaX, gy: py, para: local.id, rotulo: `Entrar: ${local.nome}` });
}

for (const { local, marca } of atribuicoes) construir(marca, local);

// Tira as marcas `M` que sobraram da matriz (viram piso).
for (let y = 0; y < A; y += 1) {
  for (let x = 0; x < L; x += 1) {
    if (objetos[y][x] === 'M') objetos[y][x] = '.';
  }
}

// ---------- confere ----------

const dados = {
  ...origem,
  decoracoes,
  passagens,
  chao: chao.map((l) => l.join('')),
  objetos: objetos.map((l) => l.join('')),
};

const problemas = Cena.conferir(dados);
if (problemas.length) {
  console.error('não monta:');
  for (const p of problemas.slice(0, 8)) console.error(`  - ${p}`);
  process.exit(1);
}
const cena = new Cena(dados);
const presas = cena.ligacoes.filter((lig) => !buscarCaminho(cena, cena.inicio, lig).length);
if (presas.length) {
  console.error(`${presas.length} portas inacessíveis a pé:`);
  for (const p of presas.slice(0, 12)) console.error(`  - ${p.para} em ${p.gx},${p.gy}`);
  process.exit(1);
}

// ---------- grava ----------

const aspas = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
const matriz = (nome, linhas) =>
  `  ${nome}: [\n${linhas.map((l) => `    '${l.replace(/'/g, "\\'")}',`).join('\n')}\n  ],`;

const texto = `// A CIDADE — ilha desenhada à mão no editor, prédios distribuídos nas marcas.
//
// O traçado (ruas, costa, mar) é obra do editor. Os prédios e as passagens
// foram postos por \`node tools/distribuir-cenas.mjs\` nas marcas de prédio.
//
// ${L}x${A}. ${passagens.length} locais.

export const CENA_CIDADE = {
  id: 'cidade',
  nome: ${aspas(origem.nome || 'Cidade')},
  endereco: ${aspas(origem.endereco || 'Ilha')},
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

console.log(`\n${passagens.length} prédios distribuídos:`);
for (const { local, marca } of atribuicoes) {
  console.log(`  ${local.id.padEnd(20)} em ${marca.gx},${marca.gy}`);
}
console.log('\ngravado. rode `node tools/verificar-mundo.mjs`.');
