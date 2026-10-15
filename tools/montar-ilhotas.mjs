// Cria a cena do arquipélago e liga a cidade a ela por viagem.
//
// Uso: node tools/montar-ilhotas.mjs
//
// O Sanatório e a Prisão ficam em ilhas no mar, longe da cidade. O jogador não
// vai a pé: pega uma viagem (uma passagem no cais da cidade) que o leva ao
// arquipélago — uma cena intermediária com duas ilhotas, uma para cada
// instituição, cada uma com sua porta. De lá, uma passagem de volta à cidade.
//
// Assim o fluxo é: cidade → (viagem) → arquipélago → sanatório/prisão, e de
// qualquer um deles de volta ao arquipélago e à cidade. Tudo em passagem de
// lista, nada de código no jogo.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho } from '../src/mundo/caminho.js';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA = join(RAIZ, 'src', 'dados');
const ID = 'arquipelago';

// ---------- a cena do arquipélago ----------
//
// Duas ilhotas de grama cercadas de mar (vazio), ligadas por um pontão de
// madeira no meio. O cais de chegada (vindo da cidade) fica no pontão; de cada
// ilhota sai a porta para a instituição.

const L = 40;
const A = 26;
const chao = Array.from({ length: A }, () => Array(L).fill(' '));
const objetos = Array.from({ length: A }, () => Array(L).fill('.'));
const dentro = (x, y) => x >= 0 && y >= 0 && x < L && y < A;

/** Mancha de grama (ilhota) centrada em (cx,cy). */
function ilhota(cx, cy, raio) {
  for (let y = cy - raio; y <= cy + raio; y += 1) {
    for (let x = cx - raio; x <= cx + raio; x += 1) {
      if (!dentro(x, y)) continue;
      const d = Math.hypot((x - cx) * 0.6, y - cy); // elipse achatada
      if (d <= raio) chao[y][x] = 'g';
    }
  }
}

const ilhaA = { cx: 9, cy: 13, raio: 7 };
const ilhaB = { cx: 31, cy: 13, raio: 7 };
ilhota(ilhaA.cx, ilhaA.cy, ilhaA.raio);
ilhota(ilhaB.cx, ilhaB.cy, ilhaB.raio);

// Pontão de madeira ligando as duas, passando pelo meio.
for (let x = ilhaA.cx; x <= ilhaB.cx; x += 1) {
  chao[13][x] = 'w';
  chao[12][x] = 'w';
}

// Chegada da cidade: no meio do pontão.
const chegada = { gx: Math.round((ilhaA.cx + ilhaB.cx) / 2), gy: 13 };
objetos[chegada.gy][chegada.gx] = 'X';

// Prédios simples nas ilhotas (parede + porta), um para cada instituição.
function predio(cx, cy, para, rotulo) {
  const x0 = cx - 3;
  const y0 = cy - 3;
  const x1 = cx + 3;
  const y1 = cy + 2;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!dentro(x, y)) continue;
      const contorno = x === x0 || x === x1 || y === y0 || y === y1;
      chao[y][x] = 't';
      objetos[y][x] = contorno ? '#' : '.';
    }
  }
  const portaX = cx;
  if (dentro(portaX, y1)) objetos[y1][portaX] = '.';
  const py = y1 + 1;
  if (dentro(portaX, py) && chao[py][portaX] === ' ') chao[py][portaX] = 'g';
  return { gx: portaX, gy: py, para, rotulo };
}

const portaSanatorio = predio(ilhaA.cx, ilhaA.cy - 1, 'sanatorio', 'Entrar: Sanatório Municipal');
const portaPrisao = predio(ilhaB.cx, ilhaB.cy - 1, 'prisao', 'Entrar: Prisão Municipal');

const passagens = [
  portaSanatorio,
  portaPrisao,
  { gx: chegada.gx, gy: chegada.gy + 1, para: 'cidade', rotulo: 'Voltar de barco à cidade' },
];
// A volta não pode ficar sob o X; põe num tile de pontão livre ao lado.
passagens[2] = { gx: chegada.gx + 1, gy: 12, para: 'cidade', rotulo: 'Voltar de barco à cidade' };

const dadosArq = {
  id: ID,
  nome: 'Arquipélago',
  endereco: 'Mar aberto',
  externo: true,
  ligacoes: {},
  decoracoes: [],
  passagens,
  chao: chao.map((l) => l.join('')),
  objetos: objetos.map((l) => l.join('')),
};

const problemasArq = Cena.conferir(dadosArq);
if (problemasArq.length) {
  console.error('arquipélago não monta:');
  for (const p of problemasArq.slice(0, 8)) console.error(`  - ${p}`);
  process.exit(1);
}
const cenaArq = new Cena(dadosArq);
for (const lig of cenaArq.ligacoes) {
  if (!buscarCaminho(cenaArq, cenaArq.inicio, lig).length) {
    console.error(`no arquipélago, ${lig.para} é inalcançável a pé`);
    process.exit(1);
  }
}

// ---------- grava o arquipélago ----------

const aspas = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
const matriz = (nome, linhas) =>
  `  ${nome}: [\n${linhas.map((l) => `    '${l}',`).join('\n')}\n  ],`;

const textoArq = `// ARQUIPÉLAGO — as duas ilhas no mar, alcançadas por viagem.
//
// GERADO por \`node tools/montar-ilhotas.mjs\`. Chega-se aqui pela passagem do
// cais da cidade; daqui saem as portas do Sanatório e da Prisão, e a volta de
// barco para a cidade.

export const CENA_ARQUIPELAGO = {
  id: ${aspas(ID)},
  nome: 'Arquipélago',
  endereco: 'Mar aberto',
  externo: true,

  ligacoes: {},

  decoracoes: [],

  passagens: [
${passagens.map((p) => `    { gx: ${p.gx}, gy: ${p.gy}, para: ${aspas(p.para)}, rotulo: ${aspas(p.rotulo)} },`).join('\n')}
  ],

${matriz('chao', dadosArq.chao)}

${matriz('objetos', dadosArq.objetos)}
};
`;
await writeFile(join(PASTA, 'cena-arquipelago.js'), textoArq, 'utf8');

// ---------- registra no cenas.js ----------

let registro = await readFile(join(PASTA, 'cenas.js'), 'utf8');
if (!registro.includes('CENA_ARQUIPELAGO')) {
  registro = registro.replace(
    /(import \{ CENA_[A-Z0-9_]+ \} from '\.\/cena-[a-z0-9-]+\.js';\n)(?![\s\S]*import \{ CENA_)/,
    `$1import { CENA_ARQUIPELAGO } from './cena-arquipelago.js';\n`,
  );
  registro = registro.replace(/(export const CENAS = \[)([^\]]*)(\])/, (_, a, meio, c) => `${a}${meio.trimEnd()}, CENA_ARQUIPELAGO${c}`);
  await writeFile(join(PASTA, 'cenas.js'), registro, 'utf8');
}

// ---------- liga a cidade ao arquipélago por viagem ----------
//
// Põe uma passagem "pegar o barco" num tile de calçada livre na zona portuária
// da cidade. A cidade já foi gerada; aqui só acrescenta esta passagem.

const cidadeTexto = await readFile(join(PASTA, 'cena-cidade.js'), 'utf8');
const { CENA_CIDADE } = await import(`${join(PASTA, 'cena-cidade.js')}?v=${Date.now()}`);
const cidade = new Cena(CENA_CIDADE);

// Já existe o barco?
if ((CENA_CIDADE.passagens ?? []).some((p) => p.para === ID)) {
  console.log('a cidade já tem a passagem para o arquipélago; nada a fazer.');
} else {
  // Acha calçada livre perto do cais do porto (topo da ilha), com asfalto por
  // perto e alcançável a pé a partir da praça.
  const porto = CENA_CIDADE.passagens.find((p) => p.para === 'cais-do-porto');
  const alvo = porto ? { gx: porto.gx, gy: porto.gy } : { gx: cidade.inicio.gx, gy: cidade.inicio.gy };
  // Qualquer tile andável e livre perto do porto serve de cais de viagem: é um
  // embarcadouro, não precisa de calçada específica. O que importa é ser
  // alcançável a pé e não cair em cima de outra passagem.
  const ocupadas = new Set(CENA_CIDADE.passagens.map((p) => `${p.gx},${p.gy}`));
  let vaga = null;
  for (let raio = 1; raio < 40 && !vaga; raio += 1) {
    for (let a = 0; a < Math.PI * 2 && !vaga; a += 0.15) {
      const gx = Math.round(alvo.gx + Math.cos(a) * raio);
      const gy = Math.round(alvo.gy + Math.sin(a) * raio);
      if (!cidade.dentro(gx, gy)) continue;
      if (!cidade.andavel(gx, gy)) continue;
      if (ocupadas.has(`${gx},${gy}`)) continue;
      if (!buscarCaminho(cidade, cidade.inicio, { gx, gy }).length) continue;
      vaga = { gx, gy };
    }
  }
  if (!vaga) {
    console.error('não achei calçada livre no porto para o cais de viagem.');
    process.exit(1);
  }
  const nova = `    { gx: ${vaga.gx}, gy: ${vaga.gy}, para: '${ID}', rotulo: 'Pegar o barco (Sanatório / Prisão)' },\n`;
  const atualizado = cidadeTexto.replace(/(passagens:\s*\[\n)/, `$1${nova}`);
  await writeFile(join(PASTA, 'cena-cidade.js'), atualizado, 'utf8');
  console.log(`cais de viagem posto em ${vaga.gx},${vaga.gy} (perto do porto).`);
}

console.log('\narquipélago criado e ligado:');
console.log('  cidade → (barco) → arquipélago → sanatório / prisão → volta');
console.log('gravado.');
