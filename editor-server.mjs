// Servidor do editor de mundo. Separado do servidor do jogo de propósito:
// o do jogo é somente leitura, e só este sabe gravar.
//
// Sobe com `npm run editor`, em 127.0.0.1:4400. Serve a aplicação da pasta
// `editor/` e, além dela, `src/` e `assets/` do projeto — o editor reaproveita
// os módulos do jogo em vez de ter cópia própria da projeção e dos tiles.
//
// Ferramenta de desenvolvimento. Não deve ser exposta na rede.

import { createServer } from 'node:http';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const RAIZ = resolve(import.meta.dirname);
const PASTA_EDITOR = join(RAIZ, 'editor');
const PASTA_CENAS = join(RAIZ, 'src', 'dados');
const ARQUIVO_VERSAO = join(RAIZ, '.mundo-versao');
const PORTA = Number(process.env.PORT_EDITOR) || 4400;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const json = (res, codigo, corpo) => {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
};

// ---------- leitura das cenas ----------

async function arquivosDeCena() {
  const todos = await readdir(PASTA_CENAS);
  return todos.filter((n) => /^cena-[a-z0-9-]+\.js$/.test(n)).sort();
}

/** Carrega os dados de uma cena importando o módulo, com cache furado. */
async function lerCena(arquivo) {
  const caminho = join(PASTA_CENAS, arquivo);
  const modulo = await import(`file://${caminho}?v=${Date.now()}`);
  const dados = Object.values(modulo).find((v) => v && typeof v === 'object' && v.id && v.chao);
  if (!dados) throw new Error(`${arquivo} não exporta uma cena`);
  return { ...dados, arquivo };
}

/**
 * De id para nome de arquivo.
 *
 * Os dois não são a mesma coisa: a cena `apto-302` mora em `cena-apto302.js`.
 * Deduzir o arquivo a partir do id fazia a leitura dar 404 e, pior, faria a
 * gravação criar um arquivo novo em vez de atualizar o certo. Então o mapa vem
 * de ler as cenas e olhar o campo `id` de cada uma.
 */
async function mapaDeIds() {
  const mapa = new Map();
  for (const arquivo of await arquivosDeCena()) {
    try {
      const cena = await lerCena(arquivo);
      mapa.set(cena.id, arquivo);
    } catch {
      // Arquivo quebrado não impede os outros de aparecerem.
    }
  }
  return mapa;
}

async function arquivoDaCena(id) {
  return (await mapaDeIds()).get(id) ?? null;
}

async function listarCenas() {
  const lista = [];
  for (const arquivo of await arquivosDeCena()) {
    try {
      const cena = await lerCena(arquivo);
      lista.push({
        id: cena.id,
        nome: cena.nome,
        endereco: cena.endereco,
        arquivo,
        externo: Boolean(cena.externo),
        largura: cena.chao[0]?.length ?? 0,
        altura: cena.chao.length,
        pecas: (cena.decoracoes ?? []).length,
      });
    } catch (erro) {
      console.warn(`Ignorando ${arquivo}: ${erro.message}`);
    }
  }
  return lista;
}

// ---------- gravação ----------

const matrizOk = (m) =>
  Array.isArray(m) &&
  m.length > 0 &&
  m.every((l) => typeof l === 'string' && l.length === m[0].length);

/**
 * Reescreve apenas `chao`, `objetos` e `decoracoes` no arquivo da cena.
 * Comentário, legenda e ligações ficam intactos: o arquivo continua sendo algo
 * que dá para ler e editar à mão.
 */
async function gravarCena(id, corpo) {
  const { chao, objetos, decoracoes } = corpo;
  if (!/^[a-z0-9-]+$/.test(id)) throw Object.assign(new Error('Id inválido'), { codigo: 400 });
  if (!matrizOk(chao) || !matrizOk(objetos) || chao.length !== objetos.length) {
    throw Object.assign(new Error('Matrizes inválidas'), { codigo: 400 });
  }

  // Nunca derivar o nome do arquivo do id: tem cena cujo id e cujo arquivo
  // diferem, e derivar criaria um arquivo novo em vez de atualizar o certo.
  const nome = await arquivoDaCena(id);
  if (!nome) throw Object.assign(new Error(`Não achei a cena "${id}"`), { codigo: 404 });

  const arquivo = join(PASTA_CENAS, nome);
  if (!arquivo.startsWith(PASTA_CENAS + sep)) {
    throw Object.assign(new Error('Caminho inválido'), { codigo: 400 });
  }

  const texto = await readFile(arquivo, 'utf8');

  const linhas = (lista) => lista.map((l) => `    '${l.replace(/'/g, "\\'")}',`).join('\n');
  let novo = texto;

  for (const [nome, matriz] of [
    ['chao', chao],
    ['objetos', objetos],
  ]) {
    const padrao = new RegExp(`${nome}:\\s*\\[[^\\]]*\\]`);
    if (!padrao.test(novo)) {
      throw Object.assign(new Error(`Não encontrei o vetor "${nome}"`), { codigo: 409 });
    }
    novo = novo.replace(padrao, `${nome}: [\n${linhas(matriz)}\n  ]`);
  }

  if (Array.isArray(corpo.passagens)) {
    const validas = corpo.passagens.filter(
      (p) => p && typeof p.para === 'string' && Number.isInteger(p.gx) && Number.isInteger(p.gy),
    );
    const bloco = validas.length
      ? `passagens: [\n${validas
          .map(
            (p) =>
              `    { gx: ${p.gx}, gy: ${p.gy}, para: '${p.para.replace(/'/g, "\\'")}'` +
              `${p.rotulo ? `, rotulo: '${p.rotulo.replace(/'/g, "\\'")}'` : ''} },`,
          )
          .join('\n')}\n  ]`
      : 'passagens: []';

    const existente = /passagens:\s*\[[^\]]*\]/;
    if (existente.test(novo)) {
      novo = novo.replace(existente, bloco);
    } else {
      novo = novo.replace(
        /(\n+)([ \t]*)chao:\s*\[/,
        (_, brancos, recuo) => `${brancos}${recuo}${bloco},\n\n${recuo}chao: [`,
      );
    }
  }

  if (Array.isArray(decoracoes)) {
    const validas = decoracoes.filter(
      (d) => d && typeof d.peca === 'string' && Number.isInteger(d.gx) && Number.isInteger(d.gy),
    );
    const corpoDec = validas.length
      ? `decoracoes: [\n${validas
          .map(
            (d) =>
              `    { peca: '${d.peca.replace(/'/g, "\\'")}', gx: ${d.gx}, gy: ${d.gy}` +
              // Nível zero fica implícito: a esmagadora maioria das peças está
              // no chão, e escrever `nivel: 0` em todas só polui o arquivo.
              `${Number.isInteger(d.nivel) && d.nivel > 0 ? `, nivel: ${d.nivel}` : ''}` +
              `${d.solido ? ', solido: true' : ''} },`,
          )
          .join('\n')}\n  ]`
      : 'decoracoes: []';

    const existente = /decoracoes:\s*\[[^\]]*\]/;
    if (existente.test(novo)) {
      novo = novo.replace(existente, corpoDec);
    } else {
      novo = novo.replace(
        /(\n+)([ \t]*)chao:\s*\[/,
        (_, brancos, recuo) => `${brancos}${recuo}${corpoDec},\n\n${recuo}chao: [`,
      );
    }
  }

  await writeFile(arquivo, novo, 'utf8');
  await marcarVersao();
  return { ok: true, arquivo: `src/dados/${nome}` };
}

/** Cria um local novo e o registra na lista de cenas do jogo. */
async function criarCena(corpo) {
  const { id, nome, endereco, largura, altura, externo } = corpo ?? {};
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) {
    throw Object.assign(new Error('Id deve ter só minúsculas, números e hífen'), { codigo: 400 });
  }
  const l = Math.max(8, Math.min(1000, Number(largura) || 24));
  const a = Math.max(8, Math.min(1000, Number(altura) || 20));

  const arquivo = join(PASTA_CENAS, `cena-${id}.js`);
  if (await stat(arquivo).catch(() => null)) {
    throw Object.assign(new Error(`cena-${id}.js já existe`), { codigo: 409 });
  }
  // Id repetido quebraria o jogo mesmo com nome de arquivo diferente.
  if ((await mapaDeIds()).has(id)) {
    throw Object.assign(new Error(`já existe um local com o id "${id}"`), { codigo: 409 });
  }

  const constante = `CENA_${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
  // Começa com uma laje de calçada e o ponto de partida no meio, para o local
  // já ser visitável assim que for criado.
  const chao = Array.from({ length: a }, () => 'p'.repeat(l));
  const objetos = Array.from({ length: a }, (_, y) => {
    if (y !== Math.floor(a / 2)) return '.'.repeat(l);
    const meio = Math.floor(l / 2);
    return `${'.'.repeat(meio)}X${'.'.repeat(l - meio - 1)}`;
  });

  const texto = `// ${nome || id} — criado pelo editor de mundo.
//
// As duas matrizes abaixo são texto puro: dá para editar aqui ou pelo editor.
// Todas as linhas precisam ter o mesmo comprimento.

export const ${constante} = {
  id: '${id}',
  nome: '${(nome || id).replace(/'/g, "\\'")}',
  endereco: '${(endereco || '').replace(/'/g, "\\'")}',
${externo ? '  externo: true,\n' : ''}
  ligacoes: {},

  decoracoes: [],

  chao: [
${chao.map((l2) => `    '${l2}',`).join('\n')}
  ],

  objetos: [
${objetos.map((l2) => `    '${l2}',`).join('\n')}
  ],
};
`;

  await writeFile(arquivo, texto, 'utf8');
  await registrarNoJogo(id, constante);
  await marcarVersao();
  return { ok: true, arquivo: `src/dados/cena-${id}.js` };
}

/**
 * Inclui o local novo na lista `CENAS` de `src/dados/cenas.js`. Sem isso o
 * arquivo existiria mas o jogo não o conheceria, e o usuário teria de mexer em
 * código — que é justamente o que o editor existe para evitar.
 *
 * A lista mora em `dados/cenas.js`, e não no `main.js`, porque o `npm run check`
 * também a lê: assim o local criado aqui já entra nas verificações.
 */
async function registrarNoJogo(id, constante) {
  const caminho = join(PASTA_CENAS, 'cenas.js');
  let texto = await readFile(caminho, 'utf8');
  if (texto.includes(constante)) return;

  // Entra depois do último import de cena, para a lista seguir legível.
  const importes = /(import \{ CENA_[A-Z0-9_]+ \} from '\.\/cena-[a-z0-9-]+\.js';\n)(?![\s\S]*import \{ CENA_)/;
  if (!importes.test(texto)) {
    throw Object.assign(new Error('não achei onde declarar o local em dados/cenas.js'), {
      codigo: 409,
    });
  }
  texto = texto.replace(importes, `$1import { ${constante} } from './cena-${id}.js';\n`);

  const lista = /(export const CENAS = \[)([^\]]*)(\])/;
  if (!lista.test(texto)) {
    throw Object.assign(new Error('não achei a lista CENAS em dados/cenas.js'), { codigo: 409 });
  }
  texto = texto.replace(
    lista,
    (_, abre, meio, fecha) => `${abre}${meio.trimEnd()}, ${constante}${fecha}`,
  );

  await writeFile(caminho, texto, 'utf8');
}

/**
 * Põe uma saída no local `para`, mas só se ele não tiver nenhuma.
 *
 * O objetivo é um só: não deixar o jogador preso num prédio recém-criado. Fora
 * desse caso a função não escreve nada, e isso é proposital. A versão anterior
 * exigia reciprocidade — toda passagem de A para B ganhava uma de B para A — e
 * o resultado era o editor cravar uma porta no meio da rua ao salvar o interior
 * de um prédio, mexendo num arquivo que o usuário não abriu.
 *
 * Passagem de mão única funciona: ao chegar num local sem porta de volta para a
 * origem, o jogo põe o detetive no ponto de partida (ver `Jogo#viajarPara`).
 * A reciprocidade só melhora onde ele aparece, e isso é decisão de quem desenha
 * o mapa — não de um automatismo.
 */
async function criarVolta({ de, para }) {
  if (typeof de !== 'string' || typeof para !== 'string' || de === para) {
    throw Object.assign(new Error('Origem e destino inválidos'), { codigo: 400 });
  }

  const nome = await arquivoDaCena(para);
  if (!nome) throw Object.assign(new Error(`Não achei o local "${para}"`), { codigo: 404 });

  const destino = await lerCena(nome);

  // Qualquer saída serve: o que não pode é o local ser um beco sem fim.
  const saidas =
    (destino.passagens ?? []).filter((p) => p?.para).length +
    Object.values(destino.ligacoes ?? {}).filter((l) => l?.para).length;
  if (saidas > 0) {
    const paraOrigem =
      (destino.passagens ?? []).some((p) => p.para === de) ||
      Object.values(destino.ligacoes ?? {}).some((l) => l.para === de);
    return {
      ok: true,
      criada: false,
      motivo: paraOrigem ? 'já havia volta' : `"${para}" já tem saída; nada a fazer`,
    };
  }

  // Procura o X e um vizinho livre dele.
  let inicio = null;
  destino.objetos.forEach((linha, gy) => {
    const gx = linha.indexOf('X');
    if (gx >= 0 && !inicio) inicio = { gx, gy };
  });
  if (!inicio) throw Object.assign(new Error(`"${para}" não tem ponto de partida (X)`), { codigo: 409 });

  const ocupado = (gx, gy) =>
    destino.objetos[gy]?.[gx] !== '.' ||
    (destino.passagens ?? []).some((p) => p.gx === gx && p.gy === gy);

  const vizinhos = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  let posicao = null;
  for (const [dx, dy] of vizinhos) {
    const gx = inicio.gx + dx;
    const gy = inicio.gy + dy;
    if (gy < 0 || gy >= destino.objetos.length) continue;
    if (gx < 0 || gx >= destino.objetos[0].length) continue;
    if (destino.chao[gy][gx] === ' ') continue;
    if (!ocupado(gx, gy)) {
      posicao = { gx, gy };
      break;
    }
  }
  if (!posicao) {
    throw Object.assign(new Error(`sem espaço livre perto do X de "${para}"`), { codigo: 409 });
  }

  // O rótulo aparece no jogo, então vale o nome de verdade e não o id.
  const arquivoOrigem = await arquivoDaCena(de);
  const nomeOrigem = arquivoOrigem ? (await lerCena(arquivoOrigem)).nome || de : de;

  const passagens = [
    ...(destino.passagens ?? []),
    { ...posicao, para: de, rotulo: `Voltar para ${nomeOrigem}` },
  ];

  await gravarCena(para, {
    chao: destino.chao,
    objetos: destino.objetos,
    decoracoes: destino.decoracoes ?? [],
    passagens,
  });

  return { ok: true, criada: true, em: posicao, local: para };
}

async function marcarVersao() {
  await writeFile(ARQUIVO_VERSAO, String(Date.now()), 'utf8');
}

// ---------- arquivos estáticos ----------

function caminhoSeguro(base, relativo) {
  const limpo = normalize(decodeURIComponent(relativo))
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '');
  const destino = join(base, limpo);
  if (destino !== base && !destino.startsWith(base + sep)) return null;
  return destino;
}

async function servirArquivo(res, destino) {
  const info = await stat(destino).catch(() => null);
  if (!info?.isFile()) return false;
  res.writeHead(200, {
    'Content-Type': TIPOS[extname(destino).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  res.end(await readFile(destino));
  return true;
}

// ---------- corpo da requisição ----------

async function lerCorpo(req) {
  const partes = [];
  let tamanho = 0;
  for await (const pedaco of req) {
    tamanho += pedaco.length;
    if (tamanho > 4 * 1024 * 1024) throw Object.assign(new Error('Corpo grande'), { codigo: 413 });
    partes.push(pedaco);
  }
  if (!partes.length) return {};
  return JSON.parse(Buffer.concat(partes).toString('utf8'));
}

// ---------- rotas ----------

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORTA}`);
  const rota = url.pathname;

  try {
    if (rota === '/api/cenas' && req.method === 'GET') {
      json(res, 200, await listarCenas());
      return;
    }

    const umaCena = rota.match(/^\/api\/cena\/([a-z0-9-]+)$/);
    if (umaCena && req.method === 'GET') {
      const nome = await arquivoDaCena(umaCena[1]);
      if (!nome) {
        json(res, 404, { erro: `cena "${umaCena[1]}" não encontrada` });
        return;
      }
      json(res, 200, await lerCena(nome));
      return;
    }
    if (umaCena && req.method === 'PUT') {
      json(res, 200, await gravarCena(umaCena[1], await lerCorpo(req)));
      return;
    }
    if (rota === '/api/cena' && req.method === 'POST') {
      json(res, 201, await criarCena(await lerCorpo(req)));
      return;
    }
    if (rota === '/api/volta' && req.method === 'POST') {
      json(res, 200, await criarVolta(await lerCorpo(req)));
      return;
    }
    if (rota === '/api/versao' && req.method === 'GET') {
      const versao = await readFile(ARQUIVO_VERSAO, 'utf8').catch(() => '0');
      json(res, 200, { versao: versao.trim() });
      return;
    }

    // Estáticos: primeiro a aplicação do editor, depois src/ e assets/ do jogo.
    if (rota.startsWith('/src/') || rota.startsWith('/assets/')) {
      const destino = caminhoSeguro(RAIZ, rota);
      if (destino && (await servirArquivo(res, destino))) return;
    } else {
      const alvo = rota === '/' ? '/index.html' : rota;
      const destino = caminhoSeguro(PASTA_EDITOR, alvo);
      if (destino && (await servirArquivo(res, destino))) return;
    }

    res.writeHead(404).end('Não encontrado');
  } catch (erro) {
    const codigo = erro?.codigo ?? 500;
    if (codigo === 500) console.error(erro);
    json(res, codigo, { erro: erro?.message ?? 'erro interno' });
  }
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Editor de mundo em http://localhost:${PORTA}`);
  console.log('O jogo continua em http://localhost:4300 (npm start).');
});
