// Gera o manifesto de imagens a partir do que existe na pasta `assets/`.
//
// Uso: coloque os arquivos e rode `npm run assets`.
//
//   assets/chao/<material>/qualquer-nome.png   -> textura daquele material
//   assets/pecas/<id>.png                      -> sprite daquela peça
//
// Os nomes de material e de peça são os `id` declarados em src/mundo/tiles.js:
//   chão: asfalto, calcada, grama, tabua, ladrilho, tapete
//   peças: parede, porta, sofa, mesa, estante, armario, cama, escrivaninha,
//          bancada, pia, banco, vaso, arvore, luminaria, pasta, jornal, registro
//
// O manifesto é escrito em src/dados/visual.js e lido pelo jogo. Ajustes de
// âncora e escala por peça podem ser feitos à mão nesse arquivo: a indexação
// preserva o que já estiver lá.

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, extname, basename } from 'node:path';
import { medirPecas } from './medir-sprites.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA_ASSETS = join(RAIZ, 'assets');
const SAIDA = join(RAIZ, 'src', 'dados', 'visual.js');

const IMAGENS = new Set(['.png', '.webp', '.jpg', '.jpeg']);

async function listar(pasta) {
  try {
    return await readdir(pasta, { withFileTypes: true });
  } catch {
    return [];
  }
}

function ehImagem(nome) {
  return IMAGENS.has(extname(nome).toLowerCase());
}

async function indexarChao() {
  const chao = {};
  const materiais = await listar(join(PASTA_ASSETS, 'chao'));

  for (const material of materiais) {
    if (!material.isDirectory()) continue;
    const arquivos = await listar(join(PASTA_ASSETS, 'chao', material.name));
    const lista = arquivos
      .filter((a) => a.isFile() && ehImagem(a.name))
      .map((a) => `chao/${material.name}/${a.name}`)
      .sort();
    if (lista.length) chao[material.name] = lista;
  }
  return chao;
}

async function indexarPecas(anterior) {
  const pecas = {};
  const arquivos = (await listar(join(PASTA_ASSETS, 'pecas')))
    .filter((a) => a.isFile() && ehImagem(a.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (arquivos.length) {
    console.log(`Medindo ${arquivos.length} sprite(s)...`);
  }
  const medidas = await medirPecas();
  const referencia = medidas['@referencia']?.referencia;
  delete medidas['@referencia'];
  if (referencia) console.log(`  referência: ${referencia} px de origem = 1 tile`);

  for (const arquivo of arquivos) {
    const id = basename(arquivo.name, extname(arquivo.name));
    const antes = anterior?.pecas?.[id];

    // `fixo: true` protege ajuste manual de uma peça específica contra a medição.
    if (antes?.fixo) {
      pecas[id] = { ...antes, arquivo: `pecas/${arquivo.name}` };
      continue;
    }

    const medida = medidas[id];
    pecas[id] = {
      arquivo: `pecas/${arquivo.name}`,
      ancora: medida?.ancora ?? 0.82,
      escala: medida?.escala ?? 1,
    };
  }
  return pecas;
}

/** Lê o manifesto anterior para não perder ajustes manuais de âncora e escala. */
async function lerAnterior() {
  try {
    const { VISUAL } = await import(`${SAIDA}?t=${Date.now()}`);
    return VISUAL;
  } catch {
    return null;
  }
}

const anterior = await lerAnterior();
const chao = await indexarChao();
const pecas = await indexarPecas(anterior);

const cabecalho = `// Manifesto de imagens — GERADO por \`npm run assets\`.
//
// Não edite a lista de arquivos à mão: ela é reescrita a cada indexação.
// Já \`ancora\` e \`escala\` de cada peça são preservados entre execuções, então
// pode ajustar esses dois valores aqui mesmo.
//
// \`ancora\` é a fração da altura do sprite que fica sobre o centro da tile:
// 0.82 funciona para a maioria dos móveis; aumente se a peça flutuar, diminua
// se ela afundar no chão.

`;

await mkdir(join(RAIZ, 'src', 'dados'), { recursive: true });
await writeFile(
  SAIDA,
  `${cabecalho}export const VISUAL = ${JSON.stringify({ chao, pecas }, null, 2)};\n`,
  'utf8',
);

const totalChao = Object.values(chao).reduce((n, l) => n + l.length, 0);
console.log(`Manifesto escrito em src/dados/visual.js`);
console.log(`  chão: ${totalChao} textura(s) em ${Object.keys(chao).length} material(is)`);
for (const [material, lista] of Object.entries(chao)) {
  console.log(`    ${material}: ${lista.length}`);
}
console.log(`  peças: ${Object.keys(pecas).length} sprite(s)`);
if (!totalChao && !Object.keys(pecas).length) {
  console.log('\nNada encontrado. O jogo segue com a arte procedural.');
  console.log('Coloque arquivos em assets/chao/<material>/ e assets/pecas/ e rode de novo.');
}
