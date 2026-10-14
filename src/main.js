// Ponto de entrada: liga canvas, entrada, jogo, progresso salvo e interface.

import { Camera } from './core/camera.js';
import { Entrada } from './core/entrada.js';
import { Loop } from './core/loop.js';
import { gradeParaMundo, mundoParaGrade } from './core/iso.js';
import { sementeAleatoria } from './core/rng.js';
import { Renderizador } from './render/renderizador.js';
import { Interface } from './ui/interface.js';
import { Jogo } from './jogo/jogo.js';
import { Progresso } from './jogo/persistencia.js';
import { CENA_APTO_302 } from './dados/cena-apto302.js';
import { CENA_ESCRITORIO } from './dados/cena-escritorio.js';
import { CASO_014 } from './dados/caso-014.js';

/** Locais da investigação, na ordem em que aparecem. */
const CENAS = [CENA_APTO_302, CENA_ESCRITORIO];

const canvas = document.getElementById('palco');
const camera = new Camera();
const renderizador = new Renderizador(canvas, camera);
const entrada = new Entrada(canvas);
const progresso = new Progresso();

/** @type {Jogo} */
let jogo;
let tileSobMouse = null;
let alvoDestacado = null;
/** Detecta a borda de subida do bloqueio, para parar a caminhada uma única vez. */
let bloqueadoNoQuadroAnterior = false;

const ui = new Interface({
  aoAcusar: (idSuspeito) => jogo.acusar(idSuspeito),
  aoNovaInvestigacao: () => {
    progresso.limpar();
    iniciar(sementeAleatoria());
  },
});

/** Lê a semente da URL, para repetir uma investigação específica. */
function sementeDaUrl() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return hash.get('semente');
}

function gravarSementeNaUrl(semente) {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  hash.set('semente', semente);
  history.replaceState(null, '', `#${hash.toString()}`);
}

function posicaoDaCamera() {
  const ponto = gradeParaMundo(jogo.detetive.gx, jogo.detetive.gy);
  // Sobe um pouco o enquadramento: o detetive é desenhado acima do centro do tile.
  return { x: ponto.x, y: ponto.y - 24 };
}

function enquadrarAgora() {
  const foco = posicaoDaCamera();
  camera.fixar(foco.x, foco.y);
}

/**
 * Monta uma investigação. Quando `estadoSalvo` casa com a semente, retoma de
 * onde o jogador parou em vez de começar do zero.
 */
function iniciar(semente, estadoSalvo = null) {
  jogo = new Jogo(CENAS, CASO_014, semente);

  const retomado = estadoSalvo ? jogo.restaurar(estadoSalvo) : false;

  gravarSementeNaUrl(jogo.semente);
  ui.conectarJogo(jogo);

  // Grava o progresso a cada avanço real da investigação.
  for (const evento of ['vestigio', 'documento', 'contradicao', 'depoimento', 'viagem', 'veredito']) {
    jogo.escutar(evento, () => progresso.salvar(jogo));
  }
  jogo.escutar('viagem', () => enquadrarAgora());

  enquadrarAgora();
  tileSobMouse = null;
  alvoDestacado = null;
  bloqueadoNoQuadroAnterior = false;

  if (retomado) {
    ui.aviso(
      'Investigação retomada',
      `Você estava em ${jogo.cenaAtual.nome}, com ${jogo.recolhidos.length} de ${jogo.misterio.total} vestígios recolhidos. ` +
        'Para começar um caso novo, use "Nova investigação".',
    );
  } else {
    progresso.salvar(jogo);
    ui.aviso(
      jogo.caso.titulo,
      `${jogo.caso.resumo} Há ${jogo.misterio.total} vestígios espalhados entre os locais da investigação. ` +
        'Procure a marcação da vítima e as pastas da perícia, e confronte os depoimentos com o que achar.',
    );
  }
}

/** Converte a posição do ponteiro no tile correspondente da grade. */
function tileDoPonteiro() {
  if (!entrada.ponteiro.dentro) return null;
  const mundo = camera.telaParaMundo(entrada.ponteiro.x, entrada.ponteiro.y);
  const { gx, gy } = mundoParaGrade(mundo.x, mundo.y);
  const tile = { gx: Math.round(gx), gy: Math.round(gy) };
  return jogo.cenaAtual.dentro(tile.gx, tile.gy) ? tile : null;
}

function tratarCliques() {
  for (const clique of entrada.consumirCliques()) {
    const mundo = camera.telaParaMundo(clique.x, clique.y);
    const { gx, gy } = mundoParaGrade(mundo.x, mundo.y);
    jogo.irPara(Math.round(gx), Math.round(gy));
  }
}

function quadro(dt, tempo) {
  // Balão ou documento aberto congela a cena: sem isso o jogador encadearia
  // coletas sem ler nada, e a rota pendente continuaria após fechar.
  const bloqueado = ui.bloqueiaMovimento;
  entrada.definirBloqueio(bloqueado);

  if (bloqueado) {
    entrada.consumirCliques();
    if (!bloqueadoNoQuadroAnterior) jogo.detetive.pararAgora();
  } else {
    tratarCliques();
  }
  bloqueadoNoQuadroAnterior = bloqueado;

  jogo.atualizar(dt, entrada.direcaoTeclado());

  const foco = posicaoDaCamera();
  camera.seguir(foco.x, foco.y, dt);

  tileSobMouse = tileDoPonteiro();
  alvoDestacado = tileSobMouse ? jogo.alvoEm(tileSobMouse.gx, tileSobMouse.gy) : null;

  const rotulo = alvoDestacado
    ? alvoDestacado.tipo === 'vestigio'
      ? 'Vestígio — clique para recolher'
      : `${alvoDestacado.rotulo} — clique para examinar`
    : '';
  ui.definirAlvo(rotulo);
  canvas.style.cursor = alvoDestacado ? 'pointer' : 'crosshair';

  renderizador.desenhar(jogo, tileSobMouse, alvoDestacado, tempo);
}

// ---------- atalhos ----------

entrada.aoAtalho('KeyC', () => ui.alternarPainel('caderno'));
entrada.aoAtalho('KeyF', () => ui.alternarPainel('suspeitos'));
entrada.aoAtalho('KeyL', () => ui.abrirDeslocamento());
entrada.aoAtalho('KeyG', () => ui.abrirAcusacao());
entrada.aoAtalho('KeyN', () => {
  progresso.limpar();
  iniciar(sementeAleatoria());
});

window.addEventListener('resize', () => renderizador.redimensionar());

// Guarda a posição ao sair: os eventos de jogo não cobrem a caminhada em si.
window.addEventListener('pagehide', () => progresso.salvar(jogo));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') progresso.salvar(jogo);
});

// ---------- partida ----------

try {
  const salvo = progresso.carregar();
  const daUrl = sementeDaUrl();

  // A semente da URL manda. Só retomamos o salvo quando é a mesma investigação.
  if (daUrl) {
    iniciar(daUrl, salvo?.semente === daUrl ? salvo : null);
  } else if (salvo) {
    iniciar(salvo.semente, salvo);
  } else {
    iniciar(sementeAleatoria());
  }

  new Loop(quadro).iniciar();
} catch (erro) {
  console.error(erro);
  document.body.innerHTML =
    '<p style="padding:24px;font-family:sans-serif;color:#e8e3d7">' +
    'Não foi possível montar a cena. Veja o console para o detalhe e rode <code>npm run check</code>.' +
    '</p>';
}
