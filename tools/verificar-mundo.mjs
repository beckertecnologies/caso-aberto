// Verifica só a estrutura do mundo, sem depender de nenhum caso.
//
// O `npm run check` cobre o jogo inteiro, mas amarra tudo ao caso-014. Enquanto
// o roteiro novo não chega, este script confere o que importa agora: as 30
// cenas montam, a cidade liga a todas e de todas dá para voltar a pé.

import { CENAS } from '../src/dados/cenas.js';
import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho } from '../src/mundo/caminho.js';

let falhas = 0;
let n = 0;
const ok = (desc, cond, detalhe = '') => {
  n += 1;
  if (cond) console.log(`  ok   ${desc}`);
  else {
    falhas += 1;
    console.error(`  FALHA ${desc}${detalhe ? ` — ${detalhe}` : ''}`);
  }
};

console.log(`locais no registro: ${CENAS.length}`);

const cenas = new Map();
for (const dados of CENAS) {
  const problemas = Cena.conferir(dados);
  ok(`${dados.id}: monta`, problemas.length === 0, problemas[0]);
  if (!problemas.length) cenas.set(dados.id, new Cena(dados));
}

ok('ids únicos', new Set(CENAS.map((c) => c.id)).size === CENAS.length);

const cidade = cenas.get('cidade');
ok('a cidade existe e é o primeiro local', CENAS[0].id === 'cidade' && Boolean(cidade));

// Toda cena (menos a cidade) tem de ter partida andável e porta de volta.
for (const [id, cena] of cenas) {
  if (id === 'cidade') continue;
  ok(`${id}: partida andável`, cena.andavel(cena.inicio.gx, cena.inicio.gy));
  const volta = cena.ligacaoPara('cidade');
  ok(`${id}: volta para a cidade existe e é alcançável`,
    Boolean(volta) && cena.andavel(volta.gx, volta.gy) &&
      buscarCaminho(cena, cena.inicio, volta).length > 0);
}

if (cidade) {
  // Nenhuma passagem pode apontar para um local que não existe.
  const inexistentes = [];
  for (const [, cena] of cenas) {
    for (const l of cena.ligacoes) if (!cenas.has(l.para)) inexistentes.push(l.para);
  }
  ok('nenhuma passagem aponta para local inexistente', inexistentes.length === 0, [...new Set(inexistentes)].join(', '));

  // Toda porta é alcançável a pé dentro da própria cena (a pé, não entre cenas).
  const presas = [];
  for (const [id, cena] of cenas) {
    for (const l of cena.ligacoes) {
      const mesmo = l.gx === cena.inicio.gx && l.gy === cena.inicio.gy;
      if (!mesmo && !buscarCaminho(cena, cena.inicio, l).length) presas.push(`${id}→${l.para}`);
    }
  }
  ok('toda porta é alcançável a pé na sua cena', presas.length === 0, presas.join(' '));

  // Todo local é alcançável a partir da cidade — a pé OU por viagem (grafo de
  // passagens). Sanatório e Prisão entram por aqui, via arquipélago.
  const alcancados = new Set(['cidade']);
  const fila = ['cidade'];
  while (fila.length) {
    const atual = cenas.get(fila.shift());
    for (const l of atual.ligacoes) {
      if (!alcancados.has(l.para) && cenas.has(l.para)) {
        alcancados.add(l.para);
        fila.push(l.para);
      }
    }
  }
  const ilhados = [...cenas.keys()].filter((id) => !alcancados.has(id));
  ok('todo local é alcançável a partir da cidade (a pé ou por viagem)', ilhados.length === 0, `ilhados: ${ilhados.join(', ')}`);

  // E de todo local dá para voltar à cidade.
  const voltam = new Set(['cidade']);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const [id, cena] of cenas) {
      if (voltam.has(id)) continue;
      if (cena.ligacoes.some((l) => voltam.has(l.para))) {
        voltam.add(id);
        mudou = true;
      }
    }
  }
  const presos = [...cenas.keys()].filter((id) => !voltam.has(id));
  ok('de todo local dá para voltar à cidade', presos.length === 0, `presos: ${presos.join(', ')}`);
}

console.log();
if (falhas) {
  console.error(`Com falhas: ${n - falhas}/${n}.`);
  process.exit(1);
}
console.log(`Estrutura do mundo em ordem: ${n}/${n} checagens passaram.`);
