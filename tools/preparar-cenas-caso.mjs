// Prepara as cenas de interior que o caso usa.
//
// Uso: node tools/preparar-cenas-caso.mjs
//
// O caso Rutterfort precisa que certas cenas tenham:
//  - pontos de vestígio (`*`) onde o gerador planta as pistas;
//  - objetos de leitura (`F` pasta, `J` jornal, `O` contorno da vítima).
//
// Os esqueletos criados por `montar-locais.mjs` são salas vazias: sem pontos e
// sem objetos, o `montarMisterio` não tem onde plantar e o jogo não monta.
//
// Esta ferramenta reescreve APENAS o bloco `objetos` de cada cena de interior
// que o caso referencia, pousando os `*` e os objetos de leitura no piso da
// sala, sempre longe do `X` e da coluna da porta, para o caminho continuar
// aberto. A cidade (mapa grande, desenhado à mão) é tratada à parte: recebe
// alguns `*` e o jornal perto do ponto de partida, sem mexer em mais nada.
//
// Idempotente: pode rodar de novo que o resultado é o mesmo. Não toca no `chao`,
// nas passagens nem nas decorações.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho } from '../src/mundo/caminho.js';
import { CASO_RUTTERFORT as CASO } from '../src/dados/caso-rutterfort.js';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA = join(RAIZ, 'src', 'dados');

// ---------- o que cada cena precisa ----------

// Pontos de vestígio por cena: todo local citado em `locais` de algum vestígio.
const pontosPorCena = new Map();
for (const vestigio of [...CASO.acervo, ...CASO.contexto]) {
  for (const local of vestigio.locais) {
    pontosPorCena.set(local, (pontosPorCena.get(local) ?? 0) + 1);
  }
}

// Objetos de leitura por cena, a partir dos documentos fixos.
const leiturasPorCena = new Map();
for (const doc of CASO.documentos) {
  const atual = leiturasPorCena.get(doc.cena) ?? { pasta: 0, corpo: 0, jornal: 0 };
  if (doc.alvo === 'corpo') atual.corpo += 1;
  else if (doc.cena === 'cidade') atual.jornal += 1; // a cidade lê o jornal numa banca
  else atual.pasta += 1;
  leiturasPorCena.set(doc.cena, atual);
}

const CHAR_LEITURA = { pasta: 'F', corpo: 'O', jornal: 'J' };

// Mínimo de pontos exigido pelo verificar: 3 externo, 6 interior.
function minimoPontos(cena) {
  return cena.externo ? 3 : 6;
}

// ---------- utilidades de grade ----------

/** Lê o arquivo da cena e devolve o texto e o objeto importado. */
async function carregar(id) {
  const arquivo = join(PASTA, `cena-${id}.js`);
  const texto = await readFile(arquivo, 'utf8');
  const modulo = await import(`../src/dados/cena-${id}.js?t=${Date.now()}`);
  const dados = modulo[`CENA_${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`];
  return { arquivo, texto, dados };
}

/** Troca o bloco `objetos: [ ... ],` por uma nova matriz de linhas. */
function substituirObjetos(texto, linhas) {
  const corpo = linhas.map((l) => `    '${l}',`).join('\n');
  const bloco = `objetos: [\n${corpo}\n  ],`;
  const regex = /objetos:\s*\[[\s\S]*?\n\s*\],/;
  if (!regex.test(texto)) throw new Error('bloco objetos não encontrado');
  return texto.replace(regex, bloco);
}

// ---------- interior padrão ----------

/**
 * Monta a matriz `objetos` de uma sala de interior (26x20), com borda de parede,
 * o `X` no meio, a porta embaixo, e os `*`/objetos de leitura distribuídos no
 * piso. Devolve as linhas prontas.
 */
function montarInterior(dados, { pontos, leituras }) {
  const altura = dados.chao.length;
  const largura = dados.chao[0].length;
  // Parte do próprio objetos atual para preservar X e a abertura da porta.
  const grade = dados.objetos.map((l) => [...l]);

  // Localiza X e limpa qualquer *, F, J, O antigo (idempotência).
  let inicio = null;
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const c = grade[y][x];
      if (c === 'X') inicio = { gx: x, gy: y };
      if (c === '*' || c === 'F' || c === 'J' || c === 'O') grade[y][x] = '.';
    }
  }
  if (!inicio) throw new Error(`${dados.id}: sem X`);

  // Vagas de piso: tudo que é '.' e não é o X nem a coluna logo acima da porta.
  const colunaPorta = [];
  for (let x = 0; x < largura; x += 1) {
    if (grade[altura - 1][x] === '.') colunaPorta.push(x);
  }
  const protegida = new Set(colunaPorta); // mantém o corredor até a porta livre

  const vagas = [];
  for (let y = 1; y < altura - 1; y += 1) {
    for (let x = 1; x < largura - 1; x += 1) {
      if (grade[y][x] !== '.') continue;
      if (x === inicio.gx && y === inicio.gy) continue;
      // Deixa pelo menos um anel livre em volta do X.
      if (Math.abs(x - inicio.gx) <= 1 && Math.abs(y - inicio.gy) <= 1) continue;
      if (protegida.has(x) && y >= altura - 3) continue;
      vagas.push({ gx: x, gy: y });
    }
  }

  // Espalha as vagas: ordena por distância ao X, pega intercalado, para os
  // pontos não ficarem todos amontoados num canto.
  vagas.sort((a, b) => {
    const da = Math.hypot(a.gx - inicio.gx, a.gy - inicio.gy);
    const db = Math.hypot(b.gx - inicio.gx, b.gy - inicio.gy);
    return da - db;
  });
  const espalhadas = [];
  const passo = Math.max(1, Math.floor(vagas.length / 40));
  for (let i = 0; i < vagas.length; i += passo) espalhadas.push(vagas[i]);
  for (const v of vagas) if (!espalhadas.includes(v)) espalhadas.push(v);

  let i = 0;
  const por = (ch, n) => {
    for (let k = 0; k < n; k += 1) {
      const vaga = espalhadas[i++];
      if (!vaga) throw new Error(`${dados.id}: piso insuficiente`);
      grade[vaga.gy][vaga.gx] = ch;
    }
  };

  // Objetos de leitura primeiro (poucos), depois os pontos de vestígio.
  por('F', leituras.pasta ?? 0);
  por('O', leituras.corpo ?? 0);
  por('J', leituras.jornal ?? 0);
  por('*', pontos);

  return grade.map((l) => l.join(''));
}

// ---------- cidade ----------

/**
 * Injeta `*` e o jornal perto do X da cidade, em tiles andáveis, sem tocar no
 * resto do mapa desenhado à mão.
 */
function prepararCidade(dados, { pontos, leituras }) {
  const cena = new Cena(dados);
  const grade = dados.objetos.map((l) => [...l]);

  // Limpa marcações antigas desta ferramenta (só * / J soltos; nunca M, X, etc).
  // Não removemos nada: a cidade não tinha * nem J antes. Mas por idempotência,
  // tiramos os que estiverem exatamente sobre tiles andáveis vazios de objeto.
  for (let y = 0; y < grade.length; y += 1) {
    for (let x = 0; x < grade[y].length; x += 1) {
      if (grade[y][x] === '*' || grade[y][x] === 'J') grade[y][x] = '.';
    }
  }

  const inicio = cena.inicio;
  // Varre em anéis crescentes a partir do X, coletando tiles andáveis livres.
  const vagas = [];
  const vistos = new Set();
  const alvo = pontos + (leituras.jornal ?? 0) + 20; // folga
  for (let raio = 2; raio < 60 && vagas.length < alvo; raio += 1) {
    for (let dy = -raio; dy <= raio; dy += 1) {
      for (let dx = -raio; dx <= raio; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        const gx = inicio.gx + dx;
        const gy = inicio.gy + dy;
        const chave = `${gx},${gy}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        if (!cena.andavel(gx, gy)) continue;
        if (grade[gy][gx] !== '.') continue; // só piso sem objeto
        if (!buscarCaminho(cena, inicio, { gx, gy }).length) continue;
        vagas.push({ gx, gy });
      }
    }
  }

  // Espalha: um a cada poucos tiles para não amontoar.
  const passo = Math.max(1, Math.floor(vagas.length / (pontos + 2)));
  const escolhidas = [];
  for (let k = 0; k < vagas.length && escolhidas.length < pontos + (leituras.jornal ?? 0); k += passo) {
    escolhidas.push(vagas[k]);
  }
  let i = 0;
  for (let k = 0; k < (leituras.jornal ?? 0); k += 1) {
    const v = escolhidas[i++];
    grade[v.gy][v.gx] = 'J';
  }
  for (let k = 0; k < pontos; k += 1) {
    const v = escolhidas[i++];
    grade[v.gy][v.gx] = '*';
  }

  return grade.map((l) => l.join(''));
}

// ---------- execução ----------

const cenasParaPreparar = new Set([
  ...pontosPorCena.keys(),
  ...leiturasPorCena.keys(),
]);

const relatorio = [];
for (const id of cenasParaPreparar) {
  const { arquivo, texto, dados } = await carregar(id);
  const alvoPontos = pontosPorCena.get(id) ?? 0;
  const leituras = leiturasPorCena.get(id) ?? { pasta: 0, corpo: 0, jornal: 0 };

  let novasLinhas;
  if (id === 'cidade') {
    // A cidade só precisa cobrir os vestígios que a citam. Garante o mínimo externo.
    const pontos = Math.max(alvoPontos, 3);
    novasLinhas = prepararCidade(dados, { pontos, leituras });
  } else {
    const minimo = minimoPontos({ externo: Boolean(dados.externo) });
    const pontos = Math.max(alvoPontos, minimo);
    novasLinhas = montarInterior(dados, { pontos, leituras });
  }

  const novoTexto = substituirObjetos(texto, novasLinhas);

  // Valida a cena montada antes de gravar.
  const dadosNovos = { ...dados, objetos: novasLinhas };
  const cena = new Cena(dadosNovos);
  if (cena.pontosDeVestigio.length < (id === 'cidade' ? Math.max(alvoPontos, 3) : minimoPontos({ externo: Boolean(dados.externo) }))) {
    throw new Error(`${id}: pontos insuficientes após montar (${cena.pontosDeVestigio.length})`);
  }

  await writeFile(arquivo, novoTexto, 'utf8');
  relatorio.push(
    `${id}: ${cena.pontosDeVestigio.length} pontos` +
      (leituras.pasta ? `, ${leituras.pasta} pasta` : '') +
      (leituras.corpo ? `, corpo` : '') +
      (leituras.jornal ? `, jornal` : ''),
  );
}

relatorio.sort();
console.log('Cenas preparadas:');
for (const linha of relatorio) console.log('  ' + linha);
console.log(`\n${relatorio.length} cenas gravadas.`);
