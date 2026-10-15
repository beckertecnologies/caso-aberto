// Ponto de entrada: liga canvas, entrada, jogo, progresso salvo e interface.

import { Camera } from './core/camera.js';
import { Entrada } from './core/entrada.js';
import { Loop } from './core/loop.js';
import { gradeParaMundo, mundoParaGrade } from './core/iso.js';
import { sementeAleatoria } from './core/rng.js';
import { Renderizador } from './render/renderizador.js';
import { Acervo } from './render/acervo.js';
import { VISUAL } from './dados/visual.js';
import { Interface } from './ui/interface.js';
import { Jogo } from './jogo/jogo.js';
import { Povo } from './jogo/povo.js';
import { Progresso } from './jogo/persistencia.js';
// A lista de locais mora em `dados/cenas.js` para o `npm run check` poder lê-la
// sem passar por este arquivo, que depende de canvas e janela.
import { CENAS } from './dados/cenas.js';
import { CASO_RUTTERFORT as CASO_014 } from './dados/caso-rutterfort.js';

const canvas = document.getElementById('palco');
const camera = new Camera();
const acervo = new Acervo(VISUAL);
const renderizador = new Renderizador(canvas, camera, acervo);
// Minimapa no canto, ligado no jogo (o editor deixa oculto por padrão).
renderizador.modoMinimapa = 'canto';
const entrada = new Entrada(canvas);
const progresso = new Progresso();

// Cada imagem que chega invalida o chão já pintado, para a textura entrar em
// cena sem precisar recarregar a página.
acervo.carregar(() => {
  renderizador.esquecerLosangos();
});

/** @type {Jogo} */
let jogo;
/** @type {Povo|null} A cidade viva do pré-crime; nulo depois do crime ou em jogo salvo. */
let povo = null;
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

  // Encerra qualquer multidão anterior.
  povo = null;
  renderizador.povo = null;
  renderizador.localDoCrime = null;

  if (retomado) {
    // Jogo salvo: o crime já aconteceu. Aponta direto para a cena do corpo.
    renderizador.localDoCrime = jogo.cenaDoCorpo;
    ui.aviso(
      'Investigação retomada',
      `Você estava em ${jogo.cenaAtual.nome}, com ${jogo.recolhidos.length} de ${jogo.misterio.total} vestígios recolhidos. ` +
        'Para começar um caso novo, use "Nova investigação".',
    );
  } else {
    // Partida nova: começa no pré-crime. A cidade vive por 30s, a vítima e os
    // suspeitos passeiam no meio do povo, e só então o assassinato acontece.
    jogo.iniciarPreCrime();
    povo = new Povo(jogo.cenaAtual, jogo.caso, jogo.semente);
    renderizador.povo = povo;

    povo.escutar('crime', ({ local }) => {
      jogo.dispararCrime();
      renderizador.localDoCrime = local;
      const cena = jogo.cenas.get(local);
      progresso.salvar(jogo);
      ui.aviso(
        'Um corpo foi encontrado',
        `${jogo.caso.vitima?.nome ?? 'A vítima'} foi encontrada morta em ${cena?.nome ?? local}. ` +
          'A investigação começa agora: vá até o local do crime, procure a marcação da vítima e as ' +
          'pastas da perícia, e confronte os depoimentos com o que achar. O mapa mostra onde o corpo está.',
      );
    });

    progresso.salvar(jogo);
    ui.aviso(
      jogo.caso.titulo,
      `${jogo.caso.resumo} A cidade está em movimento e ninguém sabe o que está por vir. ` +
        'Ande à vontade e observe: em instantes algo vai acontecer. Só então a investigação começa.',
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

  // A cidade continua viva o jogo todo: o povo anda antes e depois do crime,
  // vivendo a vida. Só a vítima fica caída. O relógio do pré-crime corre dentro
  // do próprio `atualizar`, então entrar num prédio não o congela.
  if (povo) povo.atualizar(dt);

  const foco = posicaoDaCamera();
  camera.seguir(foco.x, foco.y, dt);

  tileSobMouse = tileDoPonteiro();
  alvoDestacado = tileSobMouse ? jogo.alvoEm(tileSobMouse.gx, tileSobMouse.gy) : null;

  // Passa a posição de tela do ponteiro para o renderizador, que usa no mapa
  // grande para mostrar a legenda do lugar sob o mouse.
  renderizador.ponteiro = entrada.ponteiro.dentro
    ? { x: entrada.ponteiro.x, y: entrada.ponteiro.y }
    : null;

  // No pré-crime, a linha de dica vira a contagem regressiva para o crime.
  let rotulo;
  if (povo && povo.fase === 'pre-crime') {
    rotulo = `A cidade vive... algo vai acontecer em ${povo.segundosRestantes()}s`;
  } else {
    rotulo = alvoDestacado
      ? alvoDestacado.tipo === 'vestigio'
        ? 'Vestígio — clique para recolher'
        : `${alvoDestacado.rotulo} — clique para examinar`
      : '';
  }
  ui.definirAlvo(rotulo);
  canvas.style.cursor = alvoDestacado && !(povo && povo.fase === 'pre-crime') ? 'pointer' : 'crosshair';

  renderizador.desenhar(jogo, tileSobMouse, alvoDestacado, tempo);
}

// ---------- atalhos ----------

// Examinar sem mouse. Sem esta tecla, recolher e ler dependem do clique no
// canvas, e o caso não tem como ser fechado só pelo teclado.
entrada.aoAtalho('KeyE', () => jogo.examinarProximo());
entrada.aoAtalho('KeyC', () => ui.alternarPainel('caderno'));
entrada.aoAtalho('KeyF', () => ui.alternarPainel('suspeitos'));
entrada.aoAtalho('KeyL', () => ui.abrirDeslocamento());
entrada.aoAtalho('KeyG', () => ui.abrirAcusacao());
entrada.aoAtalho('KeyN', () => {
  progresso.limpar();
  iniciar(sementeAleatoria());
});
// Alterna o minimapa entre pequeno (canto) e grande (mapa inteiro). No jogo ele
// está sempre ativo: o M só muda o tamanho, nunca desliga.
entrada.aoAtalho('KeyM', () => {
  renderizador.modoMinimapa = renderizador.modoMinimapa === 'expandido' ? 'canto' : 'expandido';
});

// A construção do mundo mora numa aplicação própria: `npm run editor`.
// O jogo não carrega nada de edição, e o servidor dele é somente leitura.

window.addEventListener('resize', () => renderizador.redimensionar());

/**
 * Recarrega a página quando o editor grava o mundo.
 *
 * Os mapas são módulos ES, então recarregar é o jeito simples e seguro de pegar
 * a versão nova — sem reiniciar processo nenhum na mão.
 */
function vigiarMundo() {
  let conhecida = null;
  setInterval(async () => {
    try {
      const { versao } = await (await fetch('./api/versao')).json();
      if (conhecida === null) conhecida = versao;
      else if (versao !== conhecida) location.reload();
    } catch {
      // Sem servidor de desenvolvimento (site publicado): nada a vigiar.
    }
  }, 2000);
}
vigiarMundo();

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
