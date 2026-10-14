// Teste de fumaça do editor, pelo caminho real de inicialização.
//
// Por que existe
// --------------
// `editor/app.js` não tinha nenhuma cobertura de execução, e isso custou caro:
// `mostrarSelecionada` lia `nome` de um objeto que só tem `base`, e o estouro
// acontecia no fim do salvar — depois do arquivo gravado. O usuário via
// "Não deu para salvar: Cannot read properties of undefined (reading 'replace')"
// num save que havia funcionado. Nenhuma checagem de lógica pegaria isso: só
// executar o código pega.
//
// Como funciona
// -------------
// Monta o DOM falso a partir do `editor/index.html` de verdade, troca `fetch`
// por um servidor de mentira que lê as cenas do disco (e nunca grava), importa
// o app e aciona o que a mão faria: trocar camada, escolher peça, girar, subir
// nível, pintar, apagar, conta-gotas no botão direito, validar e salvar.
//
// Os módulos do editor usam caminhos de navegador (`/src/...`), que no Node
// apontariam para a raiz do disco. Então os arquivos são copiados para uma pasta
// temporária com os imports reescritos, e apagados no fim.

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { montarDom } from './dom-falso.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const TEMPORARIA = join(RAIZ, 'tools', '.fumaca-editor');

let falhas = 0;
let checagens = 0;

function relatar(descricao, erro) {
  if (!erro) {
    console.log(`  ok   ${descricao}`);
    return true;
  }
  falhas += 1;
  console.error(`  FALHA ${descricao} — ${erro?.message ?? erro}`);
  if (erro?.stack) console.error(erro.stack.split('\n').slice(1, 4).join('\n'));
  return false;
}

function conferir(descricao, acao) {
  checagens += 1;
  try {
    const resultado = typeof acao === 'function' ? acao() : acao;
    if (resultado === false) throw new Error('resultado falso');
    if (resultado instanceof Promise) throw new Error('use conferirAsync');
    return relatar(descricao);
  } catch (erro) {
    return relatar(descricao, erro);
  }
}

async function conferirAsync(descricao, acao) {
  checagens += 1;
  try {
    const resultado = await acao();
    if (resultado === false) throw new Error('resultado falso');
    return relatar(descricao);
  } catch (erro) {
    return relatar(descricao, erro);
  }
}

// ---------- cópia com imports de Node ----------

async function prepararModulos() {
  await rm(TEMPORARIA, { recursive: true, force: true });
  await mkdir(join(TEMPORARIA, 'nucleo'), { recursive: true });

  // `editor/app.js` usa `../src/...`, que a dois níveis de profundidade vira
  // `../../src/...`.
  const app = await readFile(join(RAIZ, 'editor', 'app.js'), 'utf8');
  await writeFile(join(TEMPORARIA, 'app.js'), app.replaceAll("from '../src/", "from '../../src/"));

  // `mundo-editavel.js` usa caminho absoluto de navegador.
  const modelo = await readFile(join(RAIZ, 'editor', 'nucleo', 'mundo-editavel.js'), 'utf8');
  await writeFile(
    join(TEMPORARIA, 'nucleo', 'mundo-editavel.js'),
    modelo.replaceAll("from '/src/", "from '../../../src/"),
  );

  await cp(
    join(RAIZ, 'editor', 'nucleo', 'categorias.js'),
    join(TEMPORARIA, 'nucleo', 'categorias.js'),
  );
}

// ---------- servidor de mentira ----------

const { CENAS } = await import('../src/dados/cenas.js');
const { Cena } = await import('../src/mundo/cena.js');
const { gradeParaMundo } = await import('../src/core/iso.js');

/** O que o app enviou, para os testes conferirem sem nada ir a disco. */
const enviados = [];

function instalarFetch() {
  globalThis.fetch = async (url, opcoes = {}) => {
    const rota = String(url);
    const metodo = opcoes.method ?? 'GET';
    const responder = (corpo, ok = true) => ({
      ok,
      status: ok ? 200 : 500,
      json: async () => corpo,
    });

    if (rota === '/api/cenas') {
      return responder(
        CENAS.map((d) => ({
          id: d.id,
          nome: d.nome,
          endereco: d.endereco,
          arquivo: `cena-${d.id}.js`,
          externo: Boolean(d.externo),
          largura: d.chao[0].length,
          altura: d.chao.length,
          pecas: (d.decoracoes ?? []).length,
        })),
      );
    }

    const uma = rota.match(/^\/api\/cena\/([a-z0-9-]+)$/);
    if (uma && metodo === 'GET') {
      const dados = CENAS.find((d) => d.id === uma[1]);
      if (!dados) return responder({ erro: 'não achei' }, false);
      return responder(JSON.parse(JSON.stringify(dados)));
    }
    if (uma && metodo === 'PUT') {
      // Nada é gravado: o teste não deve mexer nos arquivos do projeto.
      enviados.push({ id: uma[1], corpo: JSON.parse(opcoes.body) });
      return responder({ ok: true, arquivo: `src/dados/cena-${uma[1]}.js` });
    }
    if (rota === '/api/volta') return responder({ ok: true, criada: false });
    if (rota === '/api/versao') return responder({ versao: '1' });
    return responder({ erro: `rota não prevista: ${metodo} ${rota}` }, false);
  };
}

// ---------- execução ----------

console.log('Teste de fumaça do editor (DOM mínimo, caminho real)');

await prepararModulos();
instalarFetch();

const dom = montarDom(new URL('../editor/index.html', import.meta.url));
const { porId, dispararNaJanela, rodarQuadros } = dom;
const palco = porId.get('palco');

let app = null;
const importou = await conferirAsync('editor/app.js importa sem lançar', async () => {
  app = await import(pathToFileURL(join(TEMPORARIA, 'app.js')).href);
  return true;
});

if (!importou) {
  console.error('\nSem carregar o app não há o que medir. Interrompendo.');
  await rm(TEMPORARIA, { recursive: true, force: true });
  process.exit(1);
}

// O app exporta estes dois só para esta fumaça: é o que permite conferir o que
// foi desenhado e o que ficou escolhido, em vez de só "não lançou exceção".
const estadoDoEditor = app.estado;
const renderizador = app.renderizador;

conferir('o laço pediu o primeiro quadro', () => dom.aoQuadro !== null);
conferir('primeiro quadro desenha sem lançar', () => rodarQuadros(1) ?? true);
conferir('trinta quadros seguidos sem lançar', () => rodarQuadros(30) ?? true);

const camadas = porId.get('camadas');
const paleta = porId.get('paleta');

conferir('as camadas e a paleta foram montadas', () => {
  if (!camadas.children.length) throw new Error('nenhum botão de camada');
  if (!paleta.children.length) throw new Error('paleta vazia');
  return true;
});

/** Vai para uma camada pelo nome do botão, como a mão faria. */
function irParaCamada(rotulo) {
  const botao = camadas.children.find((b) => b.textContent === rotulo);
  if (!botao) throw new Error(`não achei a camada "${rotulo}"`);
  botao.disparar('click', {});
  rodarQuadros(1);
}

// Escolher peça é o que faz a caixa "Escolhida" ser montada, e é ali que morava
// o estouro. A primeira versão deste teste nunca clicava num item da paleta,
// então passava com o bug no lugar — por isso o DOM falso guarda filhos.
conferir('escolher uma peça do acervo monta a caixa Escolhida', () => {
  irParaCamada('Decoração');
  const itens = paleta.querySelectorAll('.peca');
  if (!itens.length) throw new Error('a paleta de decoração não listou peças');
  itens[0].disparar('click', {});
  rodarQuadros(2);

  const caixa = porId.get('selecionada');
  if (!caixa.children.length) throw new Error('a caixa Escolhida ficou vazia');
  const temNome = caixa.querySelectorAll('strong').some((n) => n.textContent.length > 0);
  if (!temNome) throw new Error('a caixa Escolhida não mostrou o nome da peça');
  return true;
});

conferir('a caixa Escolhida mostra o id completo da peça', () => {
  const codigo = porId.get('selecionada').querySelector('code');
  if (!codigo) throw new Error('não mostrou o id');
  return /_[NSEW]$/.test(codigo.textContent);
});

conferir('girar troca a orientação mostrada', () => {
  const antes = porId.get('selecionada').querySelector('code').textContent;
  dispararNaJanela('keydown', { key: 'r', target: {} });
  rodarQuadros(2);
  const depois = porId.get('selecionada').querySelector('code').textContent;
  if (antes === depois) throw new Error(`não girou: segue em ${depois}`);
  // Mesmo modelo, orientação diferente.
  return antes.slice(0, -1) === depois.slice(0, -1);
});

conferir('girar quatro vezes volta à orientação inicial', () => {
  const codigo = () => porId.get('selecionada').querySelector('code').textContent;
  const inicial = codigo();
  for (let i = 0; i < 4; i += 1) {
    dispararNaJanela('keydown', { key: 'r', target: {} });
    rodarQuadros(1);
  }
  return codigo() === inicial;
});

conferir('com peça escolhida, pintar e apagar decoração não quebram', () => {
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  palco.disparar('pointerdown', { button: 0, pointerId: 7, clientX: 640, clientY: 360 });
  palco.disparar('pointerup', { button: 0, pointerId: 7, clientX: 640, clientY: 360 });
  rodarQuadros(2);
  // Sobe de nível e apaga: a borracha deve achar a peça no nível de baixo.
  dispararNaJanela('keydown', { key: 'f', target: {} });
  dispararNaJanela('keydown', { key: '4', target: {} });
  palco.disparar('pointerdown', { button: 0, pointerId: 8, clientX: 640, clientY: 360 });
  palco.disparar('pointerup', { button: 0, pointerId: 8, clientX: 640, clientY: 360 });
  rodarQuadros(2);
  dispararNaJanela('keydown', { key: '1', target: {} });
  return true;
});

conferir('mover o ponteiro descreve o tile sem lançar', () => {
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  rodarQuadros(2);
  return typeof porId.get('posicao').textContent === 'string';
});

conferir('pintar com o botão esquerdo não quebra', () => {
  palco.disparar('pointerdown', { button: 0, pointerId: 1, clientX: 640, clientY: 360 });
  palco.disparar('pointermove', { clientX: 650, clientY: 365 });
  palco.disparar('pointerup', { button: 0, pointerId: 1, clientX: 650, clientY: 365 });
  rodarQuadros(3);
  return true;
});

// O conta-gotas é o botão direito. Antes era uma ferramenta de teclado, e a
// troca mexeu no mesmo trecho que cuida de mover a vista.
conferir('conta-gotas no botão direito não quebra', () => {
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  palco.disparar('pointerdown', { button: 2, pointerId: 2, clientX: 640, clientY: 360 });
  palco.disparar('pointerup', { button: 2, pointerId: 2, clientX: 640, clientY: 360 });
  rodarQuadros(3);
  return true;
});

conferir('botão do meio move a vista sem quebrar', () => {
  palco.disparar('pointerdown', { button: 1, pointerId: 3, clientX: 100, clientY: 100 });
  palco.disparar('pointermove', { clientX: 160, clientY: 140 });
  palco.disparar('pointerup', { button: 1, pointerId: 3, clientX: 160, clientY: 140 });
  rodarQuadros(3);
  return true;
});

conferir('a roda dá zoom sem quebrar', () => {
  palco.disparar('wheel', { deltaY: -120, clientX: 640, clientY: 360 });
  palco.disparar('wheel', { deltaY: 120, clientX: 640, clientY: 360 });
  rodarQuadros(3);
  return true;
});

// Tab troca de camada. Passar pelas quatro exercita a montagem de cada paleta,
// que é onde o estouro do `nome` indefinido morava.
conferir('passar pelas quatro camadas monta todas as paletas', () => {
  for (let i = 0; i < 5; i += 1) {
    dispararNaJanela('keydown', { key: 'Tab', target: {} });
    rodarQuadros(2);
  }
  return true;
});

conferir('as teclas de ferramenta respondem', () => {
  for (const tecla of ['1', '2', '3', '4', '5']) {
    dispararNaJanela('keydown', { key: tecla, target: {} });
    rodarQuadros(1);
  }
  return true;
});

conferir('girar e mudar de nível não quebram', () => {
  for (const tecla of ['r', 'R', 'f', 'v', 'F', 'V', 'z', 'y']) {
    dispararNaJanela('keydown', { key: tecla, shiftKey: tecla === tecla.toUpperCase(), target: {} });
    rodarQuadros(1);
  }
  return true;
});

conferir('a prévia desenha em todas as camadas', () => {
  for (let i = 0; i < 4; i += 1) {
    dispararNaJanela('keydown', { key: 'Tab', target: {} });
    palco.disparar('pointermove', { clientX: 600 + i * 10, clientY: 340 });
    rodarQuadros(3);
  }
  return true;
});

// ---------- modo de inspeção ----------
//
// Sem peça na mão, o que está sob o cursor é contornado e nomeado. É o modo que
// torna o conta-gotas usável em cima de um telhado, onde as variantes se parecem
// e a coluna tem peça em vários níveis.

conferir('X volta ao nível 0', () => {
  irParaCamada('Decoração');
  for (let i = 0; i < 3; i += 1) dispararNaJanela('keydown', { key: 'f', target: {} });
  rodarQuadros(1);
  const subiu = porId.get('nivel').textContent;
  dispararNaJanela('keydown', { key: 'x', target: {} });
  rodarQuadros(1);
  if (subiu === 'nível 0') throw new Error('F não subiu, o teste não diria nada');
  return porId.get('nivel').textContent === 'nível 0';
});

conferir('Esc solta a peça e entra em inspeção', () => {
  // Garante que há peça na mão antes.
  paleta.querySelectorAll('.peca')[0].disparar('click', {});
  rodarQuadros(1);
  if (!porId.get('selecionada').querySelector('code')) {
    throw new Error('não havia peça escolhida para soltar');
  }

  dispararNaJanela('keydown', { key: 'Escape', target: {} });
  rodarQuadros(2);

  const caixa = porId.get('selecionada');
  if (caixa.querySelector('code')) throw new Error('a peça continuou na mão');
  return caixa.querySelectorAll('strong').some((n) => /inspeção/i.test(n.textContent));
});

conferir('em inspeção o fantasma da peça sai de cena', () => {
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  rodarQuadros(2);
  // A prévia pode existir (o losango do tile), mas sem peça.
  return !renderizador.previa?.peca;
});

/**
 * Leva o cursor a um tile pelo caminho real: centraliza a câmera nele e move o
 * ponteiro para o meio da tela.
 *
 * Mexer em `tileSobMouse` por fora seria mais curto e testaria menos — o clique
 * calcula o tile a partir das coordenadas de tela, então um teste que pula essa
 * conta não cobre o clique.
 */
function apontarTile(gx, gy) {
  const ponto = gradeParaMundo(gx, gy);
  renderizador.camera.fixar(ponto.x, ponto.y);
  rodarQuadros(1);
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  rodarQuadros(2);
  const sob = estadoDoEditor.tileSobMouse;
  if (!sob || sob.gx !== gx || sob.gy !== gy) {
    throw new Error(`o cursor caiu em ${sob?.gx},${sob?.gy} em vez de ${gx},${gy}`);
  }
}

conferir('em inspeção, passar sobre uma peça a contorna e a nomeia', () => {
  const mundo = estadoDoEditor.mundo;
  const alguma = mundo.cena.decoracoes[0];
  if (!alguma) throw new Error('a cena aberta não tem decoração');

  apontarTile(alguma.gx, alguma.gy);

  const d = renderizador.destaque;
  if (!d) throw new Error('nada foi contornado');
  if (d.gx !== alguma.gx || d.gy !== alguma.gy) throw new Error('contornou o tile errado');
  if (!d.rotulo?.length) throw new Error('contornou sem nome');
  return true;
});

conferir('o contorno aponta a peça mais alta da coluna', () => {
  const mundo = estadoDoEditor.mundo;
  // Monta uma coluna de três peças num tile livre.
  const livre = (() => {
    for (let gy = 0; gy < mundo.altura; gy += 1) {
      for (let gx = 0; gx < mundo.largura; gx += 1) {
        if (mundo.cena.andavel(gx, gy) && !mundo.niveisEm(gx, gy).length) return { gx, gy };
      }
    }
    throw new Error('sem tile livre');
  })();

  mundo.decorar(livre.gx, livre.gy, 'dng_dirt_E', false, 0);
  mundo.decorar(livre.gx, livre.gy, 'dng_stoneWall_S', false, 2);
  mundo.decorar(livre.gx, livre.gy, 'frm_roof_E', false, 6);

  // Os níveis são percorridos pelas teclas de verdade, e não mexendo no estado:
  // é por elas que o contorno e a barra de baixo se atualizam.
  const tecla = (k) => {
    dispararNaJanela('keydown', { key: k, target: {} });
    rodarQuadros(2);
  };

  tecla('x');
  apontarTile(livre.gx, livre.gy);
  // No nível 0 há peça, então é ela que o contorno mostra.
  if (renderizador.destaque?.peca !== 'dng_dirt_E') {
    throw new Error(`no nível 0 apontou ${renderizador.destaque?.peca}`);
  }

  // Num nível sem peça, aponta a mais alta — a que está desenhada por cima.
  tecla('f');
  tecla('f');
  tecla('f');
  if (estadoDoEditor.nivel !== 3) throw new Error(`F levou ao nível ${estadoDoEditor.nivel}`);
  if (renderizador.destaque?.peca !== 'frm_roof_E') {
    throw new Error(`no nível 3 apontou ${renderizador.destaque?.peca}`);
  }

  // E no nível da parede, a parede.
  tecla('v');
  if (estadoDoEditor.nivel !== 2) throw new Error(`V levou ao nível ${estadoDoEditor.nivel}`);
  return renderizador.destaque?.peca === 'dng_stoneWall_S';
});

conferir('a barra de baixo marca entre «» a peça apontada', () => {
  const texto = porId.get('posicao').textContent;
  if (!texto.includes('«')) throw new Error(`a barra diz: ${texto}`);
  // A marcada tem de ser a mesma que está contornada no mapa.
  return texto.includes(`«${renderizador.destaque.peca}@${renderizador.destaque.nivel}`);
});

conferir('o conta-gotas pega exatamente a peça contornada', () => {
  const alvo = renderizador.destaque;
  if (!alvo) throw new Error('nada contornado para pegar');

  palco.disparar('pointerdown', { button: 2, pointerId: 21, clientX: 640, clientY: 360 });
  palco.disparar('pointerup', { button: 2, pointerId: 21, clientX: 640, clientY: 360 });
  rodarQuadros(2);

  const pego = estadoDoEditor.pincel.decoracao;
  if (pego !== alvo.peca) throw new Error(`contornava ${alvo.peca} e pegou ${pego}`);
  // E o nível acompanha, senão a peça voltaria para o mapa na altura errada.
  if (estadoDoEditor.nivel !== alvo.nivel) {
    throw new Error(`pegou do nível ${alvo.nivel} mas ficou no ${estadoDoEditor.nivel}`);
  }
  // Pegar peça encerra a inspeção: há peça na mão de novo.
  if (!renderizador.previa?.peca) throw new Error('o fantasma não voltou');
  return true;
});

conferir('validar relata sem quebrar', () => {
  porId.get('btn-validar').disparar('click', {});
  rodarQuadros(2);
  return typeof porId.get('aviso').textContent === 'string';
});

// O caso que chegou ao usuário: salvar ia até o fim e estourava na atualização
// da tela, depois de gravar, anunciando falha num save bem-sucedido.
await conferirAsync('salvar vai até o fim e anuncia sucesso', async () => {
  enviados.length = 0;
  porId.get('btn-salvar').disparar('click', {});
  // Deixa as promessas do manipulador correrem.
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
  rodarQuadros(3);

  const aviso = porId.get('aviso');
  if (!enviados.length) throw new Error('nada foi enviado ao servidor');
  if (/não deu para salvar/i.test(aviso.textContent)) {
    throw new Error(`anunciou falha: ${aviso.textContent}`);
  }
  if (!/salvo em/i.test(aviso.textContent)) {
    throw new Error(`não anunciou sucesso: ${aviso.textContent}`);
  }
  return true;
});

conferir('o que foi enviado tem as matrizes e as listas', () => {
  const { corpo } = enviados[enviados.length - 1];
  return (
    Array.isArray(corpo.chao) &&
    Array.isArray(corpo.objetos) &&
    Array.isArray(corpo.decoracoes) &&
    Array.isArray(corpo.passagens) &&
    corpo.chao.length === corpo.objetos.length
  );
});

conferir('o que foi enviado monta como cena de jogo', () => {
  const { id, corpo } = enviados[enviados.length - 1];
  const original = CENAS.find((d) => d.id === id);
  const cena = new Cena({ ...original, ...corpo });
  return cena.id === id && cena.largura > 0;
});

conferir('o nível das peças sobrevive à volta pelo servidor', () => {
  const { corpo } = enviados[enviados.length - 1];
  return corpo.decoracoes.every((d) => Number.isInteger(d.nivel));
});

conferir('trocar de local pelo seletor não quebra', () => {
  const seletor = porId.get('sel-cena');
  seletor.value = 'apto-302';
  seletor.disparar('change', { target: seletor });
  rodarQuadros(3);
  return true;
});

conferir('redimensionar a janela não quebra', () => {
  dispararNaJanela('resize', {});
  rodarQuadros(3);
  return true;
});

conferir('sair com o ponteiro limpa a prévia', () => {
  palco.disparar('pointerleave', {});
  rodarQuadros(2);
  return porId.get('posicao').textContent === '—';
});

await rm(TEMPORARIA, { recursive: true, force: true });

console.log();
if (falhas) {
  console.error(`Com falhas: ${checagens - falhas}/${checagens} checagens passaram.`);
  process.exit(1);
}
console.log(`Fumaça do editor limpa: ${checagens}/${checagens} checagens passaram.`);
