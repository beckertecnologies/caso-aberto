// Refaz os locais da cidade a partir de uma lista fixa.
//
// Uso: node tools/montar-locais.mjs
//
// O que faz, numa passada só:
//  1. apaga os arquivos de cena antigos (menos a cidade);
//  2. cria uma cena vazia e visitável para cada local da LISTA;
//  3. reescreve src/dados/cenas.js com a cidade + os 29;
//  4. abre uma passagem na cidade para cada local, numa vaga de calçada, e põe
//     em cada local a porta de volta para a cidade.
//
// É idempotente de propósito: pode rodar de novo que o resultado é o mesmo.
// Nada do interior dos locais é desenhado aqui — isso é trabalho do editor. O
// que esta ferramenta garante é o esqueleto navegável: dá para sair da rua,
// entrar em cada lugar e voltar, e o `npm run check` aprova.
//
// Antes de gravar qualquer coisa, monta tudo em memória, confere que cada cena
// é válida e que a cidade continua ligando a todos a pé. Se algo não fecha, não
// escreve nada.

import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho } from '../src/mundo/caminho.js';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA = join(RAIZ, 'src', 'dados');

/**
 * Os locais, na ordem em que entram. `id` é minúsculo com hífen (vira nome de
 * arquivo e chave de passagem); `externo` marca lugar a céu aberto.
 */
const LISTA = [
  { id: 'prefeitura', nome: 'Prefeitura', endereco: 'Praça Central' },
  { id: 'escritorio', nome: 'Escritório', endereco: 'Centro' },
  { id: 'fabrica', nome: 'Fábrica', endereco: 'Distrito Industrial' },
  { id: 'cartorio', nome: 'Cartório de Registro', endereco: 'Centro' },
  { id: 'igreja', nome: 'Igreja', endereco: 'Praça da Sé', externo: true },
  { id: 'cemiterio', nome: 'Cemitério Municipal', endereco: 'Alto da Colina', externo: true },
  { id: 'teatro', nome: 'Teatro Municipal', endereco: 'Centro' },
  { id: 'tribunal', nome: 'Tribunal de Justiça', endereco: 'Centro Cívico' },
  { id: 'cais-do-porto', nome: 'Cais do Porto', endereco: 'Zona Portuária', externo: true },
  { id: 'universidade', nome: 'Universidade', endereco: 'Campus' },
  { id: 'restaurante', nome: 'Restaurante', endereco: 'Centro' },
  { id: 'hospital', nome: 'Hospital Central', endereco: 'Centro' },
  { id: 'hotel-de-luxo', nome: 'Hotel de Luxo', endereco: 'Beira-mar' },
  { id: 'banco', nome: 'Banco', endereco: 'Centro Financeiro' },
  { id: 'delegacia', nome: 'Delegacia de Polícia', endereco: '4º Distrito' },
  { id: 'laboratorio-forense', nome: 'Laboratório Forense', endereco: 'Anexo da Delegacia' },
  { id: 'casa-de-campo', nome: 'Casa de Campo', endereco: 'Interior', externo: true },
  { id: 'casa-de-praia', nome: 'Casa de Praia', endereco: 'Litoral', externo: true },
  { id: 'estacao-de-trens', nome: 'Estação Central de Trens', endereco: 'Centro' },
  { id: 'sanatorio', nome: 'Sanatório Municipal', endereco: 'Ilha do Norte', externo: true },
  { id: 'prisao', nome: 'Prisão Municipal', endereco: 'Ilha do Sul', externo: true },
  { id: 'clube-rooftop', nome: 'Clube Rooftop', endereco: 'Cobertura, Centro' },
  { id: 'clube-striptease', nome: 'Clube de Striptease', endereco: 'Zona Boêmia' },
  { id: 'pub-central', nome: 'Pub Central', endereco: 'Centro' },
  { id: 'pub-portuario', nome: 'Pub Portuário', endereco: 'Zona Portuária' },
  { id: 'campo-de-golfe', nome: 'Campo de Golfe', endereco: 'Clube de Campo', externo: true },
  { id: 'cafe', nome: 'Café', endereco: 'Centro' },
  { id: 'trattoria', nome: 'Trattoria', endereco: 'Bairro Italiano' },
  { id: 'bistro', nome: 'Bistrô', endereco: 'Centro' },
];

const ID_CIDADE = 'cidade';

const constante = (id) => `CENA_${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
const arquivoDe = (id) => `cena-${id}.js`;
const aspas = (s) => `'${String(s).replace(/'/g, "\\'")}'`;

// ---------- interior padrão de um local ----------

/**
 * Uma sala retangular pronta para visitar: paredes em volta, piso de tábua, o
 * ponto de partida no meio e a porta de volta para a cidade logo abaixo dele.
 *
 * Deixo deliberadamente simples. O recheio é feito no editor; aqui o objetivo é
 * só um esqueleto que já passa na validação e já dá para entrar e sair.
 */
function salaPadrao(local) {
  const L = 26;
  const A = 20;
  const chao = [];
  const objetos = [];
  for (let y = 0; y < A; y += 1) {
    const chaoLinha = [];
    const objLinha = [];
    for (let x = 0; x < L; x += 1) {
      const borda = x === 0 || x === L - 1 || y === 0 || y === A - 1;
      chaoLinha.push(local.externo ? 'p' : 't');
      objLinha.push(borda ? '#' : '.');
    }
    chao.push(chaoLinha);
    objetos.push(objLinha);
  }

  const meioX = Math.floor(L / 2);
  const meioY = Math.floor(A / 2);
  // Ponto de partida.
  objetos[meioY][meioX] = 'X';
  // Abre o vão da parede de baixo, para a porta de volta não ficar sob parede.
  objetos[A - 1][meioX] = '.';

  return {
    L,
    A,
    chao: chao.map((l) => l.join('')),
    objetos: objetos.map((l) => l.join('')),
    // A porta de volta fica num tile livre perto do X.
    volta: { gx: meioX, gy: A - 2 },
  };
}

/**
 * Reescreve o arquivo da cidade inteiro, a partir do objeto já validado.
 *
 * Preserva o cabeçalho de comentário e a legenda, que não vivem no objeto, mas
 * reconstrói todos os campos de dados, então nenhum pedaço antigo sobra solto.
 */
function textoDaCidade(c) {
  const matriz = (nome, linhas) =>
    `  ${nome}: [\n${linhas.map((l) => `    '${l.replace(/'/g, "\\'")}',`).join('\n')}\n  ],`;
  const decoracoes = (c.decoracoes ?? [])
    .map(
      (d) =>
        `    { peca: ${aspas(d.peca)}, gx: ${d.gx}, gy: ${d.gy}` +
        `${Number.isInteger(d.nivel) && d.nivel > 0 ? `, nivel: ${d.nivel}` : ''}` +
        `${d.solido ? ', solido: true' : ''} },`,
    )
    .join('\n');
  const passagens = (c.passagens ?? [])
    .map(
      (p) =>
        `    { gx: ${p.gx}, gy: ${p.gy}, para: ${aspas(p.para)}` +
        `${p.rotulo ? `, rotulo: ${aspas(p.rotulo)}` : ''} },`,
    )
    .join('\n');

  return `// A CIDADE — hub que liga todos os locais da investigação.
//
// As passagens e o registro de locais são mantidos por
// \`node tools/montar-locais.mjs\`. O chão foi traçado por \`pintar-ruas.mjs\`.
// Decoração e recheio são feitos no editor.

export const CENA_CIDADE = {
  id: ${aspas(c.id)},
  nome: ${aspas(c.nome)},
  endereco: ${aspas(c.endereco)},
${c.externo ? '  externo: true,\n' : ''}
  ligacoes: {},

  decoracoes: [
${decoracoes}
  ],

  passagens: [
${passagens}
  ],

${matriz('chao', c.chao)}

${matriz('objetos', c.objetos)}
};
`;
}

function textoDaCena(local) {
  const sala = salaPadrao(local);
  return `// ${local.nome} — criado por \`node tools/montar-locais.mjs\`.
//
// Esqueleto visitável: quatro paredes, piso, ponto de partida e a porta de
// volta para a cidade. O recheio é feito no editor.

export const ${constante(local.id)} = {
  id: ${aspas(local.id)},
  nome: ${aspas(local.nome)},
  endereco: ${aspas(local.endereco)},
${local.externo ? '  externo: true,\n' : ''}
  ligacoes: {},

  decoracoes: [],

  passagens: [
    { gx: ${sala.volta.gx}, gy: ${sala.volta.gy}, para: 'cidade', rotulo: 'Voltar para a cidade' },
  ],

  chao: [
${sala.chao.map((l) => `    '${l}',`).join('\n')}
  ],

  objetos: [
${sala.objetos.map((l) => `    '${l}',`).join('\n')}
  ],
};
`;
}

// ---------- vagas de passagem na cidade ----------

/**
 * Acha tiles de calçada livres onde cravar as passagens para os locais.
 *
 * Critério: calçada andável, longe o bastante do ponto de partida e das outras
 * passagens para não virar um amontoado, e alcançável a pé. Varre numa espiral
 * a partir do centro, para as portas ficarem perto de onde o detetive começa.
 */
function acharVagas(cidade, quantas) {
  const cena = new Cena(cidade);
  const ocupado = new Set();
  const marcar = (gx, gy) => ocupado.add(`${gx},${gy}`);
  marcar(cena.inicio.gx, cena.inicio.gy);
  for (const p of cidade.passagens ?? []) marcar(p.gx, p.gy);
  for (const d of cidade.decoracoes ?? []) marcar(d.gx, d.gy);
  for (const l of cena.ligacoes) marcar(l.gx, l.gy);
  for (const ponto of cena.pontosDeVestigio) marcar(ponto.gx, ponto.gy);

  const serveComoPorta = (gx, gy) => {
    if (ocupado.has(`${gx},${gy}`)) return false;
    const terreno = cena.chao[gy]?.[gx];
    if (terreno?.material !== 'calcada') return false;
    if (!cena.andavel(gx, gy)) return false;
    // Precisa ter asfalto por perto: porta no meio de uma calçada ilhada não
    // leva a lugar nenhum.
    let temRua = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (cena.chao[ny]?.[nx]?.material === 'asfalto') temRua = true;
    }
    return temRua;
  };

  const DISTANCIA_MINIMA = 3;
  const longe = (gx, gy) =>
    [...ocupado].every((chave) => {
      const [ox, oy] = chave.split(',').map(Number);
      return Math.abs(ox - gx) + Math.abs(oy - gy) >= DISTANCIA_MINIMA;
    });

  // Espiral a partir do centro.
  const cx = Math.floor(cena.largura / 2);
  const cy = Math.floor(cena.altura / 2);
  const vagas = [];
  for (let raio = 1; raio < Math.max(cena.largura, cena.altura) && vagas.length < quantas; raio += 1) {
    for (let dy = -raio; dy <= raio && vagas.length < quantas; dy += 1) {
      for (let dx = -raio; dx <= raio && vagas.length < quantas; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        const gx = cx + dx;
        const gy = cy + dy;
        if (!serveComoPorta(gx, gy) || !longe(gx, gy)) continue;
        if (!buscarCaminho(cena, cena.inicio, { gx, gy }).length) continue;
        vagas.push({ gx, gy });
        marcar(gx, gy);
      }
    }
  }
  return vagas;
}

// ---------- montagem ----------

const { CENA_CIDADE: cidade } = await import(`${join(PASTA, 'cena-cidade.js')}?v=${Date.now()}`);

const vagas = acharVagas(cidade, LISTA.length);
if (vagas.length < LISTA.length) {
  console.error(
    `só achei ${vagas.length} vagas de calçada para ${LISTA.length} locais. ` +
      'A cidade precisa de mais calçada com rua ao lado.',
  );
  process.exit(1);
}

// A cidade ganha uma passagem por local. As passagens antigas (ex.: para o bar,
// que vai sumir) são descartadas: estamos refazendo os locais do zero.
const novasPassagens = LISTA.map((local, i) => ({
  gx: vagas[i].gx,
  gy: vagas[i].gy,
  para: local.id,
  rotulo: `Ir para ${local.nome}`,
}));

// Os caracteres de passagem antigos (1,2,3) viram piso: as portas agora são
// todas da lista `passagens`, e deixá-los na matriz sem destino em `ligacoes`
// reprova a conferência. Troco por calçada, que é o chão em volta deles.
const objetosLimpos = cidade.objetos.map((linha) => linha.replace(/[123]/g, '.'));

const cidadeNova = {
  ...cidade,
  objetos: objetosLimpos,
  ligacoes: {},
  passagens: novasPassagens,
};

// Confere tudo em memória antes de tocar em disco.
const problemasCidade = Cena.conferir(cidadeNova);
if (problemasCidade.length) {
  console.error('a cidade nova não monta:');
  for (const p of problemasCidade.slice(0, 8)) console.error(`  - ${p}`);
  process.exit(1);
}

const cenasLocais = LISTA.map((local) => {
  const texto = textoDaCena(local);
  // Monta a cena a partir do texto para validar antes de gravar.
  const corpo = /export const CENA_[A-Z0-9_]+ = (\{[\s\S]*\});\n$/.exec(texto);
  return { local, texto };
});

// Valida cada local montando a Cena de verdade.
for (const { local } of cenasLocais) {
  const sala = salaPadrao(local);
  const dados = {
    id: local.id,
    nome: local.nome,
    endereco: local.endereco,
    externo: local.externo,
    ligacoes: {},
    decoracoes: [],
    passagens: [{ ...sala.volta, para: 'cidade', rotulo: 'Voltar para a cidade' }],
    chao: sala.chao,
    objetos: sala.objetos,
  };
  const problemas = Cena.conferir(dados);
  if (problemas.length) {
    console.error(`"${local.id}" não monta:`);
    for (const p of problemas.slice(0, 5)) console.error(`  - ${p}`);
    process.exit(1);
  }
  const cena = new Cena(dados);
  if (!cena.andavel(cena.inicio.gx, cena.inicio.gy)) {
    console.error(`"${local.id}": ponto de partida bloqueado`);
    process.exit(1);
  }
  const volta = cena.ligacaoPara('cidade');
  if (!volta || !cena.andavel(volta.gx, volta.gy)) {
    console.error(`"${local.id}": porta de volta inacessível`);
    process.exit(1);
  }
}

// Simula a navegação da cidade: toda porta precisa ser alcançável a pé.
const cenaCidade = new Cena(cidadeNova);
const inalcancaveis = cenaCidade.ligacoes.filter(
  (l) => !buscarCaminho(cenaCidade, cenaCidade.inicio, l).length,
);
if (inalcancaveis.length) {
  console.error(`${inalcancaveis.length} passagens ficariam inalcançáveis a pé. Abortando.`);
  process.exit(1);
}

// ---------- grava ----------

// 1. Apaga as cenas antigas (menos a cidade).
const existentes = (await readdir(PASTA)).filter((n) => /^cena-[a-z0-9-]+\.js$/.test(n));
const idsNovos = new Set([ID_CIDADE, ...LISTA.map((l) => l.id)]);
let apagadas = 0;
for (const arquivo of existentes) {
  const id = arquivo.replace(/^cena-|\.js$/g, '');
  if (id === ID_CIDADE) continue;
  await rm(join(PASTA, arquivo));
  apagadas += 1;
}

// 2. Escreve as cenas novas.
for (const { local, texto } of cenasLocais) {
  await writeFile(join(PASTA, arquivoDe(local.id)), texto, 'utf8');
}

// 3. Reescreve a cidade inteira a partir dos dados já validados.
//
// A primeira versão fazia três substituições por regex no texto antigo, e uma
// delas — `ligacoes:\s*\{[^}]*\}` — parava no primeiro `}` e deixava o resto do
// bloco solto, corrompendo o arquivo. Montar o texto do zero a partir do objeto
// não tem como comer demais nem de menos: o que está no objeto é o que sai.
await writeFile(join(PASTA, 'cena-cidade.js'), textoDaCidade(cidadeNova), 'utf8');

// 4. Reescreve o registro de cenas.
const importes = [
  `import { CENA_CIDADE } from './cena-cidade.js';`,
  ...LISTA.map((l) => `import { ${constante(l.id)} } from './${arquivoDe(l.id)}';`),
].join('\n');
const nomes = ['CENA_CIDADE', ...LISTA.map((l) => constante(l.id))].join(', ');
const registro = `// Os locais do mundo — única fonte da verdade.
//
// Lista mantida por \`node tools/montar-locais.mjs\`. O editor também acrescenta
// aqui ao criar um local novo. O primeiro da lista é onde o detetive começa.

${importes}

export const CENAS = [${nomes}];
`;
await writeFile(join(PASTA, 'cenas.js'), registro, 'utf8');

console.log(`apagadas ${apagadas} cena(s) antiga(s)`);
console.log(`criados ${LISTA.length} locais, cada um com porta de volta`);
console.log(`${novasPassagens.length} passagens novas na cidade`);
console.log('\nprimeiras portas:');
for (const p of novasPassagens.slice(0, 5)) console.log(`  ${p.gx},${p.gy} → ${p.para}`);
console.log('  ...');
console.log('\ngravado. rode `npm run check` para confirmar.');
