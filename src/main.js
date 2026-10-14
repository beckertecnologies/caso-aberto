// Ponto de entrada: liga canvas, entrada, jogo e interface.

import { Camera } from './core/camera.js';
import { Entrada } from './core/entrada.js';
import { Loop } from './core/loop.js';
import { mundoParaGrade } from './core/iso.js';
import { sementeAleatoria } from './core/rng.js';
import { Renderizador } from './render/renderizador.js';
import { Interface } from './ui/interface.js';
import { Jogo } from './jogo/jogo.js';
import { CENA_APTO_302 } from './dados/cena-apto302.js';
import { CASO_014 } from './dados/caso-014.js';

const canvas = document.getElementById('palco');
const camera = new Camera();
const renderizador = new Renderizador(canvas, camera);
const entrada = new Entrada(canvas);

/** @type {Jogo} */
let jogo;
let tileSobMouse = null;
let alvoDestacado = null;

const ui = new Interface({
  aoAcusar: (idSuspeito) => jogo.acusar(idSuspeito),
  aoNovaInvestigacao: () => iniciar(sementeAleatoria()),
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

function iniciar(semente) {
  jogo = new Jogo(CENA_APTO_302, CASO_014, semente);
  gravarSementeNaUrl(jogo.semente);
  ui.conectarJogo(jogo);

  // Enquadra o detetive de imediato, sem deslizar da origem até ele.
  const foco = posicaoDaCamera();
  camera.fixar(foco.x, foco.y);

  tileSobMouse = null;
  alvoDestacado = null;
  ui.aviso(
    jogo.caso.titulo,
    `${jogo.caso.resumo} Há ${jogo.misterio.total} vestígios nesta cena. Procure a marcação da vítima e as pastas da perícia.`,
  );
}

function posicaoDaCamera() {
  const { gx, gy } = jogo.detetive;
  const meiaLargura = 32;
  const meiaAltura = 16;
  return { x: (gx - gy) * meiaLargura, y: (gx + gy) * meiaAltura - 24 };
}

/** Converte a posição do ponteiro no tile correspondente da grade. */
function tileDoPonteiro() {
  if (!entrada.ponteiro.dentro) return null;
  const mundo = camera.telaParaMundo(entrada.ponteiro.x, entrada.ponteiro.y);
  const { gx, gy } = mundoParaGrade(mundo.x, mundo.y);
  const tile = { gx: Math.round(gx), gy: Math.round(gy) };
  return jogo.cena.dentro(tile.gx, tile.gy) ? tile : null;
}

function tratarCliques() {
  for (const clique of entrada.consumirCliques()) {
    const mundo = camera.telaParaMundo(clique.x, clique.y);
    const { gx, gy } = mundoParaGrade(mundo.x, mundo.y);
    jogo.irPara(Math.round(gx), Math.round(gy));
  }
}

function quadro(dt, tempo) {
  entrada.definirBloqueio(ui.modalAberto);

  if (!ui.modalAberto) tratarCliques();
  else entrada.consumirCliques();

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
entrada.aoAtalho('KeyG', () => ui.abrirAcusacao());
entrada.aoAtalho('KeyN', () => iniciar(sementeAleatoria()));

window.addEventListener('resize', () => renderizador.redimensionar());

// ---------- partida ----------

try {
  iniciar(sementeDaUrl() ?? sementeAleatoria());
  new Loop(quadro).iniciar();
} catch (erro) {
  console.error(erro);
  document.body.innerHTML =
    '<p style="padding:24px;font-family:sans-serif;color:#e8e3d7">' +
    'Não foi possível montar a cena. Veja o console para o detalhe e rode <code>npm run check</code>.' +
    '</p>';
}
