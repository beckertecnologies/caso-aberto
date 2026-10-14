// Confere que todo id procurado pelo app do editor existe no HTML.
//
// O editor busca elemento por id em dezenas de lugares. Um id trocado não
// quebra o carregamento: dá `null` e estoura só quando a pessoa clica. Esta
// checagem pega isso antes.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const js = readFileSync(join(RAIZ, 'editor', 'app.js'), 'utf8');
const html = readFileSync(join(RAIZ, 'editor', 'index.html'), 'utf8');

const pedidos = [...new Set([...js.matchAll(/el\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]))];
const existentes = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const faltando = pedidos.filter((id) => !existentes.has(id));

console.log(`ids procurados pelo app: ${pedidos.length}`);
if (faltando.length) {
  console.error(`FALTANDO no HTML: ${faltando.join(', ')}`);
  process.exit(1);
}
console.log('todos existem no HTML.');
