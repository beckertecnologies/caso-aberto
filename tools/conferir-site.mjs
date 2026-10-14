// Confere que a pasta publicada tem tudo o que o jogo pede.
//
// Uso: `node tools/conferir-site.mjs <pasta>`
//
// Por que isto existe
// -------------------
// O jogo foi feito para degradar em silêncio: sem textura, cai na pintura
// procedural; sem o atlas do personagem, cai na figura geométrica. Isso é bom
// em produção — nada quebra — e é ruim numa publicação, porque um `cp` esquecido
// no workflow sobe um site sem arte nenhuma e ninguém é avisado.
//
// Foi exatamente o que aconteceu: o passo de publicação copiava `index.html`,
// `styles.css` e `src/`, e não copiava `assets/`. O jogo publicado rodava
// inteiro, só sem textura e sem o detetive.
//
// Aqui a falta de arquivo é erro, e a publicação para.

import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const pasta = resolve(process.argv[2] ?? 'site');

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

const faltando = [];
const conferidos = [];

async function exigir(relativo, motivo) {
  conferidos.push(relativo);
  if (!(await existe(join(pasta, relativo)))) faltando.push(`${relativo} — ${motivo}`);
}

// ---------- a página e o código ----------

await exigir('index.html', 'a página do jogo');
await exigir('styles.css', 'o estilo da página');
await exigir('src/main.js', 'o ponto de entrada');
await exigir('.nojekyll', 'sem isto o Pages passa tudo pelo Jekyll');

// ---------- as cenas declaradas ----------

const { CENAS } = await import('../src/dados/cenas.js');

// A lista vem dos imports de `cenas.js`, e não do id de cada cena: o nome do
// arquivo NÃO deriva do id — a cena `apto-302` mora em `cena-apto302.js`. Foi
// esse mesmo atalho que já fez o editor gravar no arquivo errado.
const fonteCenas = await readFile(new URL('../src/dados/cenas.js', import.meta.url), 'utf8');
for (const achado of fonteCenas.matchAll(/from '\.\/([a-z0-9-]+\.js)'/g)) {
  await exigir(`src/dados/${achado[1]}`, 'módulo de cena importado por cenas.js');
}

// ---------- a arte ----------

const { VISUAL } = await import('../src/dados/visual.js');
for (const lista of Object.values(VISUAL.chao ?? {})) {
  for (const arquivo of lista) await exigir(`assets/${arquivo}`, 'textura de chão');
}

// Só as peças que alguma cena usa de fato. Publicar as 820 é desperdício, mas
// publicar menos do que as cenas pedem é buraco na tela.
const usadas = new Set();
for (const cena of CENAS) {
  for (const decoracao of cena.decoracoes ?? []) {
    if (decoracao?.peca) usadas.add(decoracao.peca);
  }
}
for (const id of usadas) {
  const def = VISUAL.pecas?.[id];
  if (!def) {
    faltando.push(`${id} — usada por uma cena e ausente do manifesto`);
    continue;
  }
  await exigir(`assets/${def.arquivo}`, `peça usada no mapa (${id})`);
}

const { DETETIVE } = await import('../src/dados/detetive.js');
await exigir(`assets/${DETETIVE.arquivo}`, 'atlas do personagem');

// ---------- o que NÃO deve subir ----------
//
// O editor grava arquivo e precisa de um processo Node. No Pages ele abriria e
// morreria no primeiro `fetch`. Melhor não existir do que existir quebrado.

const proibidos = [
  ['editor/index.html', 'o editor é ferramenta local, não pode ir ao ar'],
  ['editor/app.js', 'o editor é ferramenta local, não pode ir ao ar'],
  ['editor-server.mjs', 'servidor de escrita não pode ir ao ar'],
  ['server.mjs', 'servidor de desenvolvimento, desnecessário no Pages'],
  ['tools/verificar.mjs', 'ferramenta de teste, não é do jogo'],
  ['assets/detetive/folha-original.png', 'prancha de origem, 1,5 MB sem uso no navegador'],
];

const indevidos = [];
for (const [relativo, motivo] of proibidos) {
  if (await existe(join(pasta, relativo))) indevidos.push(`${relativo} — ${motivo}`);
}

// ---------- veredito ----------

console.log(`pasta conferida: ${pasta}`);
console.log(`arquivos exigidos: ${conferidos.length}`);
console.log(`peças de cenário usadas pelos mapas: ${usadas.size}`);

if (faltando.length) {
  console.error(`\nFALTAM ${faltando.length} arquivo(s):`);
  for (const item of faltando) console.error(`  - ${item}`);
}
if (indevidos.length) {
  console.error(`\nNÃO DEVERIAM ESTAR AQUI (${indevidos.length}):`);
  for (const item of indevidos) console.error(`  - ${item}`);
}

if (faltando.length || indevidos.length) process.exit(1);
console.log('\nO site tem toda a arte que o jogo pede, e nada de ferramenta local.');
