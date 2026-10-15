// Editor de mundo — aplicação.
//
// Reaproveita o renderizador do jogo para o que você vê aqui ser exatamente o
// que vai aparecer lá. A diferença são três chaves: a penumbra sai, o detetive
// sai e a grade entra.

import { Camera } from '../src/core/camera.js';
import {
  mundoParaGrade,
  gradeParaMundo,
  nivelValido,
  LARGURA_TILE,
  ALTURA_TILE,
  ALTURA_NIVEL,
  NIVEL_MAXIMO,
} from '../src/core/iso.js';
import { Renderizador } from '../src/render/renderizador.js';
import { Acervo } from '../src/render/acervo.js';
import { pintarChao } from '../src/render/chao.js';
import { trilhaDiamante } from '../src/core/iso.js';
import { CHAO, OBJETOS } from '../src/mundo/tiles.js';
import { VISUAL } from '../src/dados/visual.js';
import { CASO_014 } from '../src/dados/caso-014.js';
// A pasta própria do editor se chama `nucleo`, e não `src`, porque o servidor
// atende `/src/...` a partir da raiz do projeto — os módulos do jogo. Com os
// dois chamados `src`, o import do editor caía no lugar errado e quebrava tudo.
import { MundoEditavel } from './nucleo/mundo-editavel.js';
import { Referencia } from './nucleo/referencia.js';
import {
  GRUPOS,
  ORIENTACOES,
  agruparPorFamilia,
  contarPorGrupo,
  filtrarFamilias,
  girarOrientacao,
  separarOrientacao,
} from './nucleo/categorias.js';

/**
 * Quantos modelos a paleta mostra de uma vez.
 *
 * O teto antigo era de 120 porque a paleta listava as 820 variantes, uma por
 * orientação. Agora lista 205 modelos — as quatro orientações de cada um saem
 * pela tecla de giro —, então tudo cabe e o teto só segue existindo para o dia
 * em que entrar um pacote grande.
 *
 * A imagem de cada miniatura só é pedida quando a miniatura entra na tela, então
 * abrir a paleta não baixa o acervo inteiro.
 */
const TETO_TODOS = 400;
const TETO_GRUPO = 400;

/** Orientação em que a paleta desenha as miniaturas, para a lista não dançar. */
const ORIENTACAO_VITRINE = 'S';

/** Quantos níveis o Shift pula de uma vez: quatro passos fecham um cubo da grade. */
const SALTO_NIVEL = 4;

/**
 * As ferramentas do clique esquerdo.
 *
 * O conta-gotas saiu daqui: ele virou o clique direito. Era a única ferramenta
 * que não modifica nada, então gastar um slot e exigir trocar de modo para
 * depois voltar era atrito puro.
 */
const FERRAMENTAS = [
  { id: 'pincel', rotulo: 'Pincel', tecla: '1' },
  { id: 'retangulo', rotulo: 'Retângulo', tecla: '2' },
  { id: 'predio', rotulo: 'Prédio', tecla: '3' },
  { id: 'borracha', rotulo: 'Borracha', tecla: '4' },
  { id: 'balde', rotulo: 'Balde', tecla: '5' },
  { id: 'estrada', rotulo: 'Estrada', tecla: '6' },
];

const CAMADAS = [
  { id: 'chao', rotulo: 'Chão' },
  { id: 'objetos', rotulo: 'Objetos' },
  { id: 'decoracao', rotulo: 'Decoração' },
  { id: 'passagem', rotulo: 'Passagens' },
];

const el = (id) => document.getElementById(id);

function criar(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

// ---------- estado ----------

const canvas = el('palco');
const camera = new Camera();
const acervo = new Acervo(VISUAL, '/assets/');
/**
 * Exportado para `tools/fumaca-editor.mjs` poder conferir o que foi desenhado.
 * A página não importa nada daqui — o módulo é a raiz.
 */
export const renderizador = new Renderizador(canvas, camera, acervo);
renderizador.mostrarLuz = false;
renderizador.mostrarDetetive = false;
renderizador.mostrarGrade = true;
// O `*` e o `X` não têm forma: o jogo os desenha invisíveis de propósito. No
// editor eles precisam aparecer, senão dá para construir em cima sem perceber.
renderizador.mostrarMarcadores = true;

// Papel manteiga: imagem de referência por cima do mapa, para calcar as ruas.
const referencia = new Referencia(camera, canvas);

/** Também exportado para a fumaça do editor. Ver `renderizador` acima. */
export const estado = {
  /** @type {MundoEditavel|null} */
  mundo: null,
  cenas: [],
  camada: 'chao',
  ferramenta: 'pincel',
  pincel: { chao: 'p', objetos: '#', decoracao: null, passagem: null },
  criarVolta: true,
  grupo: 'todos',
  termo: '',
  solido: true,
  /** Diâmetro do pincel em tiles. 1 = um tile; mais que isso pinta em bloco. */
  tamanhoPincel: 1,
  /** Ponto inicial da estrada, enquanto o segundo clique não veio. */
  inicioEstrada: null,
  /** Modo de ajuste da referência: quando ligado, o mouse mexe na imagem. */
  ajustandoReferencia: false,
  /** Alça da referência sendo arrastada, ou null. */
  alcaReferencia: null,
  /** Altura em que a próxima peça é colocada. F sobe, V desce. */
  nivel: 0,
  /** Modelo escolhido, sem a orientação: `frm_roofCorner`. */
  familia: null,
  /** Orientação atual do modelo. R gira. */
  orientacao: ORIENTACAO_VITRINE,
  arrastando: false,
  movendoVista: false,
  ancoraArrasto: null,
  inicioArea: null,
  tileSobMouse: null,
};

/** O renderizador espera algo com a forma de um Jogo. */
const jogoFalso = {
  get cenaAtual() {
    return estado.mundo.cena;
  },
  detetive: { gx: 0, gy: 0, rota: [], andando: false, fase: 0, olhandoX: 0, olhandoY: 1 },
  vestigiosVisiveis: () => [],
};

acervo.carregar(() => renderizador.esquecerLosangos());

// ---------- avisos ----------

let apagarAviso = 0;

function avisar(texto, tipo = 'neutro') {
  const campo = el('aviso');
  campo.textContent = texto;
  campo.className = `rodape__aviso rodape__aviso--${tipo}`;
  clearTimeout(apagarAviso);
  if (tipo !== 'ruim') {
    apagarAviso = setTimeout(() => {
      campo.textContent = '';
    }, 6000);
  }
}

// ---------- carregar cenas ----------

async function carregarListaDeCenas(selecionar = null) {
  estado.cenas = await (await fetch('/api/cenas')).json();
  const sel = el('sel-cena');
  sel.replaceChildren();
  for (const cena of estado.cenas) {
    const opcao = criar('option', null, `${cena.nome} (${cena.largura}×${cena.altura})`);
    opcao.value = cena.id;
    sel.append(opcao);
  }
  const alvo = selecionar ?? estado.cenas[0]?.id;
  if (alvo) {
    sel.value = alvo;
    await abrirCena(alvo);
  }
}

async function abrirCena(id) {
  const dados = await (await fetch(`/api/cena/${id}`)).json();
  estado.mundo = new MundoEditavel(dados);
  el('in-largura').value = estado.mundo.largura;
  el('in-altura').value = estado.mundo.altura;
  renderizador.esquecerLosangos();
  enquadrar();
  desenharPaleta();
  mostrarSujo();
  avisar(`${dados.nome} aberto.`, 'bom');
}

// ---------- trabalho não salvo ----------

/**
 * Mostra o selo de "não salvo".
 *
 * Roda a cada quadro porque a sujeira nasce no `MundoEditavel`, lá no fundo, e
 * não vale espalhar chamada de interface por cada operação de pintura.
 */
function mostrarSujo() {
  el('nao-salvo').hidden = !estado.mundo?.sujo;
}

/**
 * Pergunta o que fazer com o desenho que ainda não foi para o arquivo.
 *
 * Devolve `true` quando pode seguir com a troca de local. Antes disso existir,
 * trocar o local no seletor jogava fora tudo o que estava em tela sem avisar.
 * @param {string} acao o que vai acontecer se seguir
 * @returns {Promise<boolean>}
 */
function confirmarDescarte(acao) {
  if (!estado.mundo?.sujo) return Promise.resolve(true);

  const caixa = el('dialogo-sujo');
  el('sujo-texto').textContent =
    `O mapa de "${estado.mundo.dados.nome}" tem mudanças que ainda não estão no arquivo. ` +
    `${acao} vai recarregar o mapa do disco e perder o que está em tela.`;
  caixa.hidden = false;
  el('sujo-salvar').focus();

  return new Promise((resolver) => {
    const encerrar = (valor) => {
      caixa.hidden = true;
      el('sujo-salvar').onclick = null;
      el('sujo-descartar').onclick = null;
      el('sujo-cancelar').onclick = null;
      resolver(valor);
    };

    el('sujo-salvar').onclick = async () => {
      // Só libera a troca se o arquivo realmente foi gravado: salvar passa pela
      // validação, e um mapa inválido não grava.
      const gravou = await salvar();
      if (gravou) encerrar(true);
      else encerrar(false);
    };
    el('sujo-descartar').onclick = () => encerrar(true);
    el('sujo-cancelar').onclick = () => encerrar(false);
  });
}

// ---------- câmera ----------

function enquadrar() {
  const mundo = estado.mundo;
  if (!mundo) return;
  const centro = gradeParaMundo((mundo.largura - 1) / 2, (mundo.altura - 1) / 2);
  camera.fixar(centro.x, centro.y);
  camera.zoom = Math.min(2, zoomParaCaber(mundo));
  mostrarZoom();
}

/**
 * Zoom em que o mapa inteiro cabe na tela, com uma folga nas bordas.
 *
 * É o piso do afastamento: antes o mínimo era 0.25 fixo, o que numa ilha de mil
 * tiles mostrava só um pedacinho e não deixava recuar o bastante para ver tudo.
 * Agora o limite vem do tamanho do mapa, então sempre dá para enquadrar a ilha
 * inteira — e nunca afastar além disso, que só mostraria vazio.
 */
function zoomParaCaber(mundo) {
  const larguraMundo = (mundo.largura + mundo.altura) * (LARGURA_TILE / 2);
  const alturaMundo = (mundo.largura + mundo.altura) * (ALTURA_TILE / 2);
  const folga = 1.1;
  return Math.min(
    canvas.clientWidth / (larguraMundo * folga),
    canvas.clientHeight / (alturaMundo * folga),
  );
}

function mostrarZoom() {
  el('zoom').textContent = `${Math.round(camera.zoom * 100)}%`;
}

// ---------- níveis ----------

function mostrarNivel() {
  const altura = estado.nivel * ALTURA_NIVEL;
  el('nivel').textContent = `nível ${estado.nivel}`;
  el('nivel').title = `${altura} px acima do chão`;
  const campo = el('nivel-valor');
  if (campo) campo.textContent = `${estado.nivel} (${altura} px)`;
  // A barra de baixo marca qual peça da coluna está apontada, e isso depende do
  // nível. Sem este reflexo o texto ficava velho até o mouse se mover.
  atualizarBarra();
}

/** Reescreve a descrição do tile sob o cursor, se houver um. */
function atualizarBarra() {
  if (!estado.tileSobMouse) return;
  el('posicao').textContent = descreverTile(estado.tileSobMouse);
}

// ---------- giro das peças ----------

/**
 * Os modelos do acervo, agrupados. Guardado porque a lista de ids não muda
 * depois que o manifesto carrega, e reagrupar 820 ids a cada tecla de giro é
 * trabalho jogado fora.
 */
let familiasEmCache = null;
function familias() {
  if (!familiasEmCache) familiasEmCache = agruparPorFamilia(acervo.idsDePecas());
  return familiasEmCache;
}

/** As orientações que o acervo tem para um modelo. */
function orientacoesDe(familia) {
  if (!familia) return [];
  return familias().get(familia)?.orientacoes ?? [];
}

/**
 * Escolhe um modelo e uma orientação, e deixa o pincel no sprite certo.
 *
 * O pincel guarda o id completo porque é ele que vai para o arquivo. Modelo e
 * orientação ficam separados no estado só para a tecla de giro ter o que girar.
 */
function escolherPeca(familia, orientacao = estado.orientacao) {
  const disponiveis = orientacoesDe(familia);
  if (!disponiveis.length) return;
  const alvo = disponiveis.includes(orientacao) ? orientacao : disponiveis[0];
  estado.familia = familia;
  estado.orientacao = alvo;
  estado.pincel.decoracao = familias().get(familia).ids[alvo];
  mostrarSelecionada();
}

/** Gira a peça escolhida. Passo positivo é no sentido horário. */
function girarPeca(passo) {
  if (estado.camada !== 'decoracao') {
    avisar('O giro vale para a camada Decoração.', 'ruim');
    return;
  }
  if (!estado.familia) {
    avisar('Escolha uma peça no acervo primeiro.', 'ruim');
    return;
  }
  const disponiveis = orientacoesDe(estado.familia);
  if (disponiveis.length < 2) {
    avisar('Esta peça só existe numa orientação.', 'ruim');
    return;
  }
  escolherPeca(estado.familia, girarOrientacao(estado.orientacao, disponiveis, passo));
}

const NOME_ORIENTACAO = { N: 'norte', E: 'leste', S: 'sul', W: 'oeste' };

/** Mostra o modelo e a orientação atuais, com miniatura que acompanha o giro. */
function mostrarSelecionada() {
  const caixa = el('selecionada');
  if (!caixa) return;
  caixa.replaceChildren();

  const id = estado.pincel.decoracao;
  if (!id) {
    const vazio = criar('div', 'selecionada__vazio');
    vazio.append(criar('strong', null, 'Modo inspeção'));
    vazio.append(
      criar(
        'span',
        null,
        'Nenhuma peça na mão. O que estiver sob o cursor fica contornado e nomeado; ' +
          'clique direito pega. F, V e X percorrem os níveis da coluna.',
      ),
    );
    caixa.append(vazio);
    return;
  }

  // `separarOrientacao` devolve `base`, não `nome`. Ler `nome` daqui dava
  // "Cannot read properties of undefined (reading 'replace')" — e, pior, o
  // estouro acontecia no fim do salvar, depois do arquivo já estar gravado, o
  // que fazia um save bem-sucedido se anunciar como falha.
  const { base } = separarOrientacao(id);
  caixa.append(miniaturaDePeca(id, { imediata: true }));

  const texto = criar('div', 'selecionada__texto');
  texto.append(criar('strong', null, base.replace(/^[a-z]{3}_/, '')));
  const disponiveis = orientacoesDe(estado.familia);
  texto.append(
    criar(
      'span',
      null,
      disponiveis.length > 1
        ? `virada para ${NOME_ORIENTACAO[estado.orientacao] ?? estado.orientacao} — R gira`
        : 'orientação única',
    ),
  );
  // O id completo, que é o que vai para o arquivo da cena.
  texto.append(criar('code', 'selecionada__id', id));
  caixa.append(texto);
}

function mudarNivel(passo) {
  const novo = nivelValido(estado.nivel + passo);
  if (novo === estado.nivel) {
    avisar(estado.nivel === 0 ? 'Já está no chão.' : `O teto é o nível ${NIVEL_MAXIMO}.`, 'ruim');
    return;
  }
  estado.nivel = novo;
  mostrarNivel();
}

/**
 * Volta ao chão de uma vez.
 *
 * Subir quatro níveis para pôr um telhado e ter de descer quatro para voltar ao
 * piso era a parte chata de construir — e esquecer de descer foi o que fez um
 * mapa inteiro parecer travado.
 */
function voltarAoChao() {
  if (estado.nivel === 0) {
    avisar('Já está no nível 0.', 'neutro');
    return;
  }
  estado.nivel = 0;
  mostrarNivel();
  avisar('De volta ao nível 0.', 'bom');
}

/**
 * Solta a peça escolhida e entra no modo de inspeção.
 *
 * Sem peça na mão o fantasma sai da frente e o que está sob o cursor passa a
 * ser contornado e nomeado. É o modo para achar a peça certa antes de pegá-la
 * com o conta-gotas, que é difícil num telhado onde todas as variantes se
 * parecem.
 */
function soltarPeca() {
  if (!estado.pincel.decoracao && !estado.familia) return false;
  estado.pincel.decoracao = null;
  estado.familia = null;
  renderizador.previa = null;
  mostrarSelecionada();
  desenharPaleta();
  avisar('Peça solta. Passe o mouse para inspecionar; clique direito pega.', 'bom');
  return true;
}

/**
 * A peça que o cursor está apontando numa coluna.
 *
 * Prefere a do nível atual; não havendo, pega a mais alta — que é a que está
 * desenhada por cima e, portanto, a que você está vendo. Com F, V e X dá para
 * percorrer a coluna e ver o contorno acompanhar.
 */
function alvoDaColuna(tile) {
  const mundo = estado.mundo;
  if (!mundo || !mundo.dentro(tile.gx, tile.gy)) return null;
  const coluna = mundo.cena.decoracoesEm(tile.gx, tile.gy);
  if (!coluna.length) return null;
  return (
    coluna.find((d) => d.nivel === estado.nivel) ?? coluna[coluna.length - 1]
  );
}

/** Nome curto de uma peça, para o rótulo sobre o mapa. */
function rotuloDePeca(peca, nivel) {
  const { base, orientacao } = separarOrientacao(peca);
  const curto = base.replace(/^[a-z]{3}_/, '');
  return `${curto}${orientacao ? ` ${orientacao}` : ''} · nível ${nivel}`;
}

// ---------- pintura ----------

function tileDoEvento(evento) {
  const area = canvas.getBoundingClientRect();
  const mundo = camera.telaParaMundo(evento.clientX - area.left, evento.clientY - area.top);
  const { gx, gy } = mundoParaGrade(mundo.x, mundo.y);
  return { gx: Math.round(gx), gy: Math.round(gy) };
}

function vazioDaCamada() {
  return estado.camada === 'chao' ? ' ' : '.';
}

/**
 * O que existe no tile, camada por camada, para a barra de baixo.
 *
 * Esta linha é a resposta para a pergunta que mais custou tempo até aqui: "o
 * que está neste tile, e em qual camada?". Sem ela, um piso posto na camada
 * Decoração parecia chão intocável, porque o pincel de Chão pintava embaixo da
 * peça e a borracha de Chão não a alcançava.
 */
function descreverTile(tile) {
  const mundo = estado.mundo;
  if (!mundo || !mundo.dentro(tile.gx, tile.gy)) return 'fora do mapa';

  const partes = [`${tile.gx}, ${tile.gy}`];

  const terreno = CHAO[mundo.charEm('chao', tile.gx, tile.gy)];
  partes.push(`chão: ${terreno?.id ?? 'vazio'}`);

  const objeto = OBJETOS[mundo.charEm('objetos', tile.gx, tile.gy)];
  if (objeto) partes.push(`objeto: ${objeto.id}`);

  const coluna = mundo.cena.decoracoesEm(tile.gx, tile.gy);
  if (coluna.length) {
    // A peça apontada vem entre «» — é a que o conta-gotas pega e a que está
    // contornada no mapa, então a barra e a tela contam a mesma história.
    const alvo = alvoDaColuna(tile);
    partes.push(
      `decoração: ${coluna
        .map((d) => {
          const texto = `${d.peca}@${d.nivel}${d.solido ? ' (sólido)' : ''}`;
          return d === alvo ? `«${texto}»` : texto;
        })
        .join(' + ')}`,
    );
  }

  const passagem = mundo.passagemEm(tile.gx, tile.gy);
  if (passagem) partes.push(`passagem → ${passagem.para}`);

  if (!mundo.cena.andavel(tile.gx, tile.gy)) partes.push('não se pisa');

  return partes.join(' · ');
}

/**
 * Conta-gotas: adota o que está no tile como pincel. Roda no clique direito.
 *
 * Depois de adotar, a paleta rola até o item e ele pisca com borda acesa. Sem
 * isso o conta-gotas trocava o pincel em silêncio: dava para pegar uma peça e
 * não ter ideia de qual era, nem onde ela estava na lista de 205.
 */
function contaGotasNoTile(tile) {
  const mundo = estado.mundo;
  if (!mundo || !mundo.dentro(tile.gx, tile.gy)) return;

  if (estado.camada === 'passagem') {
    const atual = mundo.passagemEm(tile.gx, tile.gy);
    if (!atual) {
      avisar('Não há passagem neste tile.', 'ruim');
      return;
    }
    estado.pincel.passagem = atual.para;
    desenharPaleta();
    revelarNaPaleta(atual.para);
    avisar(`Passagem para ${atual.para} adotada.`, 'bom');
    return;
  }

  if (estado.camada === 'decoracao') {
    // Exatamente a peça que o contorno está mostrando: o que você vê é o que
    // você pega. Pegar uma e receber outra era o que tornava o conta-gotas
    // inútil em cima de um telhado.
    const atual = alvoDaColuna(tile);
    if (!atual) {
      avisar(`Não há peça de decoração em ${tile.gx},${tile.gy}.`, 'ruim');
      return;
    }
    // Traz também a orientação, para o giro continuar de onde a peça está.
    const { base, orientacao } = separarOrientacao(atual.peca);
    estado.solido = Boolean(atual.solido);
    estado.nivel = nivelValido(atual.nivel);
    el('chk-solido').checked = estado.solido;
    escolherPeca(base, orientacao || estado.orientacao);
    mostrarNivel();
    desenharPaleta();
    revelarNaPaleta(base);
    avisar(`${atual.peca} adotada, do nível ${atual.nivel}.`, 'bom');
    return;
  }

  const caractere = mundo.charEm(estado.camada, tile.gx, tile.gy);
  estado.pincel[estado.camada] = caractere;
  desenharPaleta();
  revelarNaPaleta(caractere);
  const rotulo =
    estado.camada === 'chao' ? CHAO[caractere]?.id : (OBJETOS[caractere]?.id ?? 'nada');
  avisar(`${rotulo ?? 'vazio'} adotado.`, 'bom');
}

/**
 * Rola a paleta até o item escolhido e acende a borda dele.
 *
 * O item pode estar fora de vista por três motivos: rolagem, filtro de grupo ou
 * busca. Os dois últimos são limpos antes, senão a rolagem iria para um item que
 * não está na lista.
 */
function revelarNaPaleta(chave) {
  const paleta = el('paleta');
  let alvo = paleta.querySelector('.peca--ativa');

  if (!alvo && estado.camada === 'decoracao') {
    // Fora do filtro: solta o filtro e monta de novo, senão não há o que rolar.
    if (estado.grupo !== 'todos' || estado.termo) {
      estado.grupo = 'todos';
      estado.termo = '';
      el('busca').value = '';
      desenharPaleta();
      alvo = paleta.querySelector('.peca--ativa');
    }
  }
  if (!alvo) return;

  alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  alvo.classList.remove('peca--achada');
  // Reinicia a animação: sem o reflow, pegar a mesma peça duas vezes não pisca.
  void alvo.offsetWidth;
  alvo.classList.add('peca--achada');
  alvo.addEventListener('animationend', () => alvo.classList.remove('peca--achada'), {
    once: true,
  });
}

function aplicarNoTile(tile) {
  const mundo = estado.mundo;
  if (!mundo || !mundo.dentro(tile.gx, tile.gy)) return;

  if (estado.camada === 'passagem') {
    if (estado.ferramenta === 'borracha') {
      relatar(mundo.ligar(tile.gx, tile.gy, null));
      return;
    }
    if (!estado.pincel.passagem) {
      avisar('Escolha para onde a passagem leva, na lista à direita.', 'ruim');
      return;
    }
    const alvo = estado.cenas.find((c) => c.id === estado.pincel.passagem);
    const resultado = mundo.ligar(
      tile.gx,
      tile.gy,
      estado.pincel.passagem,
      alvo ? `Ir para ${alvo.nome}` : '',
    );
    relatar(resultado);
    if (resultado?.ok) desenharPaleta();
    return;
  }

  if (estado.camada === 'decoracao') {
    if (estado.ferramenta === 'borracha') {
      const r = mundo.apagarDecoracao(tile.gx, tile.gy, estado.nivel);
      if (!r.ok) avisar(r.erro, 'ruim');
      else if (r.deOutroNivel) {
        // Diz que apagou de outro nível, senão a peça desaparece e a pessoa
        // fica sem saber de onde.
        avisar(`${r.peca} apagada do nível ${r.nivelApagado} (você está no ${estado.nivel}).`, 'bom');
      }
      return;
    }
    if (!estado.pincel.decoracao) {
      avisar('Escolha uma peça no acervo primeiro.', 'ruim');
      return;
    }
    // Avisa quando a peça entra pairando acima de outra: é legítimo (telhado
    // sobre parede) e é também o engano mais fácil de cometer.
    const embaixo = estado.nivel > 0 ? mundo.niveisEm(tile.gx, tile.gy) : [];
    const resultado = mundo.decorar(
      tile.gx,
      tile.gy,
      estado.pincel.decoracao,
      estado.solido,
      estado.nivel,
    );
    relatar(resultado);
    if (resultado.ok && !resultado.igual && embaixo.some((n) => n < estado.nivel)) {
      avisar(`Colocada no nível ${estado.nivel}, por cima do que já havia. V desce.`, 'neutro');
    }
    return;
  }

  // Borracha nas camadas de matriz: se o tile tem peça de decoração, ela não
  // sai por aqui. Dizer isso evita a conclusão de que o tile está travado.
  if (estado.ferramenta === 'borracha' && mundo.niveisEm(tile.gx, tile.gy).length) {
    const quantas = mundo.niveisEm(tile.gx, tile.gy).length;
    avisar(
      `Limpei a camada ${estado.camada === 'chao' ? 'Chão' : 'Objetos'}, mas ` +
        `${quantas === 1 ? 'há 1 peça' : `há ${quantas} peças`} na camada Decoração neste tile ` +
        '— troque de camada para apagá-la.',
      'neutro',
    );
  }

  const caractere =
    estado.ferramenta === 'borracha' ? vazioDaCamada() : estado.pincel[estado.camada];

  // Balde: preenche a região conectada de uma vez. Vale para chão e objetos; na
  // decoração e na passagem não faz sentido (são listas, não matriz).
  if (estado.ferramenta === 'balde') {
    const r = mundo.balde(estado.camada, tile.gx, tile.gy, caractere);
    if (r.ok === false) avisar(r.erro, 'ruim');
    return;
  }

  // Pincel grosso: raio em tiles vem de `tamanhoPincel` (diâmetro). Pintar um
  // disco é o que torna possível desenhar grama e estrada em áreas grandes sem
  // clicar tile a tile.
  const raio = Math.floor((estado.tamanhoPincel - 1) / 2);
  relatar(mundo.pincelar(estado.camada, tile.gx, tile.gy, caractere, raio));
}

function relatar(resultado) {
  if (resultado && resultado.ok === false) avisar(resultado.erro, 'ruim');
}

function concluirArea(fim) {
  const mundo = estado.mundo;
  const inicio = estado.inicioArea;
  estado.inicioArea = null;
  if (!mundo || !inicio) return;

  if (estado.ferramenta === 'predio') {
    relatar(mundo.predio(inicio, fim));
    return;
  }

  if (estado.camada === 'decoracao') {
    avisar('Retângulo não vale para decoração: use o pincel.', 'ruim');
    return;
  }
  const caractere =
    estado.ferramenta === 'borracha' ? vazioDaCamada() : estado.pincel[estado.camada];
  relatar(mundo.retangulo(estado.camada, inicio, fim, caractere));
}

// ---------- ponteiro ----------

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/** Posição do ponteiro em coordenadas de mundo. */
function mundoDoEvento(evento) {
  const area = canvas.getBoundingClientRect();
  return camera.telaParaMundo(evento.clientX - area.left, evento.clientY - area.top);
}

canvas.addEventListener('pointerdown', (evento) => {
  canvas.setPointerCapture(evento.pointerId);

  // Ajuste da referência tem prioridade: com o modo ligado, o clique agarra uma
  // alça (canto) ou o corpo da imagem, em vez de pintar o mapa.
  if (estado.ajustandoReferencia && referencia.temImagem && evento.button === 0) {
    const m = mundoDoEvento(evento);
    const raio = 8 / camera.zoom;
    estado.alcaReferencia = referencia.alcaEm(m.x, m.y, raio);
    if (estado.alcaReferencia) {
      estado.ancoraMundo = m;
      return;
    }
  }

  // Botão direito é conta-gotas. A vista se move com o botão do meio ou com
  // Shift arrastando — o direito rendia mais como "pegar isto aqui", que é a
  // ação que se repete o tempo todo ao montar um cenário.
  if (evento.button === 2) {
    contaGotasNoTile(tileDoEvento(evento));
    return;
  }

  if (evento.button === 1 || evento.shiftKey) {
    estado.movendoVista = true;
    estado.ancoraArrasto = { x: evento.clientX, y: evento.clientY };
    canvas.classList.add('movendo');
    return;
  }

  const tile = tileDoEvento(evento);
  // Balde na camada de passagem/decoração não existe: cai no pincel.
  if (
    estado.ferramenta === 'balde' &&
    (estado.camada === 'passagem' || estado.camada === 'decoracao')
  ) {
    avisar('O balde vale para Chão e Objetos. Aqui use o pincel.', 'ruim');
    return;
  }
  if (estado.ferramenta === 'retangulo' || estado.ferramenta === 'predio') {
    estado.inicioArea = tile;
    return;
  }

  // Estrada é clica-move-clica, não arrasta. O primeiro clique fixa o começo; o
  // segundo traça o trecho e já vira começo do próximo, para encadear curvas.
  if (estado.ferramenta === 'estrada') {
    if (estado.camada !== 'chao' && estado.camada !== 'objetos') {
      avisar('A estrada vale para Chão e Objetos.', 'ruim');
      return;
    }
    if (!estado.inicioEstrada) {
      estado.inicioEstrada = tile;
      avisar('Começo marcado. Clique no fim do trecho (Esc cancela).', 'bom');
    } else {
      const caractere = estado.pincel[estado.camada];
      const raio = Math.floor((estado.tamanhoPincel - 1) / 2);
      relatar(estado.mundo.estrada(estado.camada, estado.inicioEstrada, tile, caractere, raio));
      estado.inicioEstrada = tile; // encadeia: o fim vira o novo começo
    }
    return;
  }

  estado.arrastando = true;
  aplicarNoTile(tile);
});

canvas.addEventListener('pointermove', (evento) => {
  // Arrastando a referência: alça de canto reescala/gira, corpo move.
  if (estado.alcaReferencia) {
    const m = mundoDoEvento(evento);
    if (estado.alcaReferencia === 'mover') {
      referencia.mover(m.x - estado.ancoraMundo.x, m.y - estado.ancoraMundo.y);
      estado.ancoraMundo = m;
    } else {
      referencia.arrastarAlca(estado.alcaReferencia, m.x, m.y);
    }
    return;
  }

  if (estado.movendoVista && estado.ancoraArrasto) {
    camera.arrastar(evento.clientX - estado.ancoraArrasto.x, evento.clientY - estado.ancoraArrasto.y);
    estado.ancoraArrasto = { x: evento.clientX, y: evento.clientY };
    return;
  }

  const tile = tileDoEvento(evento);
  estado.tileSobMouse = tile;
  el('posicao').textContent = descreverTile(tile);

  if (estado.arrastando) aplicarNoTile(tile);
});

// Sem isto o fantasma fica parado no último tile depois que o cursor sai da
// tela, e dá a impressão de que ainda há algo selecionado ali.
canvas.addEventListener('pointerleave', () => {
  estado.tileSobMouse = null;
  el('posicao').textContent = '—';
});

canvas.addEventListener('pointerup', (evento) => {
  if (estado.alcaReferencia) {
    estado.alcaReferencia = null;
    return;
  }
  if (estado.inicioArea) concluirArea(tileDoEvento(evento));
  estado.arrastando = false;
  estado.movendoVista = false;
  estado.ancoraArrasto = null;
  canvas.classList.remove('movendo');
});

canvas.addEventListener(
  'wheel',
  (evento) => {
    evento.preventDefault();
    const area = canvas.getBoundingClientRect();
    // O piso do afastamento é o mapa inteiro caber; o teto, aproximar bastante
    // para mexer tile a tile. Afastar além do mapa só mostraria vazio.
    const minimo = estado.mundo ? zoomParaCaber(estado.mundo) * 0.9 : 0.02;
    camera.aplicarZoom(
      evento.deltaY < 0 ? 1.12 : 1 / 1.12,
      evento.clientX - area.left,
      evento.clientY - area.top,
      minimo,
      4,
    );
    mostrarZoom();
  },
  { passive: false },
);

// ---------- trilha: camadas, ferramentas, tamanho ----------

function montarTrilha() {
  const camadas = el('camadas');
  camadas.replaceChildren();
  for (const camada of CAMADAS) {
    const b = criar('button', `botao botao--largo${estado.camada === camada.id ? ' botao--ativo' : ''}`, camada.rotulo);
    b.type = 'button';
    b.addEventListener('click', () => {
      estado.camada = camada.id;
      montarTrilha();
      desenharPaleta();
    });
    camadas.append(b);
  }

  const ferramentas = el('ferramentas');
  ferramentas.replaceChildren();
  for (const ferramenta of FERRAMENTAS) {
    const b = criar(
      'button',
      `botao botao--largo${estado.ferramenta === ferramenta.id ? ' botao--ativo' : ''}`,
      ferramenta.rotulo,
    );
    b.type = 'button';
    b.append(criar('kbd', null, ferramenta.tecla));
    b.addEventListener('click', () => {
      estado.ferramenta = ferramenta.id;
      montarTrilha();
    });
    ferramentas.append(b);
  }

  const tamanho = el('tamanho');
  tamanho.replaceChildren();
  for (const [lado, seta] of [
    ['cima', '↑'],
    ['baixo', '↓'],
    ['esquerda', '←'],
    ['direita', '→'],
  ]) {
    const linha = criar('div', 'trilha__lista--grade');
    const mais = criar('button', 'botao', `${seta} +5`);
    mais.type = 'button';
    mais.title = `Acrescenta 5 faixas à ${lado}`;
    mais.addEventListener('click', () => {
      relatar(estado.mundo?.expandir(lado, 5));
      sincronizarTamanho();
    });
    const menos = criar('button', 'botao', `${seta} −5`);
    menos.type = 'button';
    menos.title = `Corta 5 faixas da ${lado}`;
    menos.addEventListener('click', () => {
      relatar(estado.mundo?.encolher(lado, 5));
      sincronizarTamanho();
    });
    linha.append(mais, menos);
    tamanho.append(linha);
  }

  montarModoCidade();
}

/** Materiais de um clique: cada botão escolhe camada Chão, pincel e material. */
const MATERIAIS_CIDADE = [
  { rotulo: 'Grama', char: 'g' },
  { rotulo: 'Estrada', char: 'a' },
  { rotulo: 'Calçada', char: 'p' },
  { rotulo: 'Mar', char: '~' },
];

const TAMANHOS_PINCEL = [1, 3, 7, 15, 25];

/**
 * Botões do modo cidade: materiais diretos, a marca de prédio e o tamanho do
 * pincel. Tudo pensado para desenhar grande sem caçar na paleta.
 */
function montarModoCidade() {
  const caixa = el('modo-cidade');
  caixa.replaceChildren();

  for (const m of MATERIAIS_CIDADE) {
    const ativo = estado.camada === 'chao' && estado.pincel.chao === m.char && estado.ferramenta === 'pincel';
    const b = criar('button', `botao${ativo ? ' botao--ativo' : ''}`, m.rotulo);
    b.type = 'button';
    b.addEventListener('click', () => {
      estado.camada = 'chao';
      estado.ferramenta = 'pincel';
      estado.pincel.chao = m.char;
      montarTrilha();
      desenharPaleta();
    });
    caixa.append(b);
  }

  // Marca de prédio: entra na camada Objetos pintando o caractere `M`.
  const marcaAtiva = estado.camada === 'objetos' && estado.pincel.objetos === 'M';
  const marca = criar('button', `botao botao--largo${marcaAtiva ? ' botao--ativo' : ''}`, 'Marcar prédio');
  marca.type = 'button';
  marca.title = 'Põe um alfinete "aqui vai um prédio". A distribuição das cenas é feita depois.';
  marca.addEventListener('click', () => {
    estado.camada = 'objetos';
    estado.ferramenta = 'pincel';
    estado.pincel.objetos = 'M';
    estado.tamanhoPincel = 1; // marca é sempre um tile
    montarTrilha();
    desenharPaleta();
  });
  caixa.append(marca);

  // Tamanho do pincel.
  const tam = el('pincel-tamanho');
  tam.replaceChildren();
  tam.append(criar('span', 'trilha__rotulo', 'Pincel'));
  for (const t of TAMANHOS_PINCEL) {
    const b = criar('button', `botao${estado.tamanhoPincel === t ? ' botao--ativo' : ''}`, String(t));
    b.type = 'button';
    b.title = `Pincel de ${t} tile${t > 1 ? 's' : ''} de diâmetro`;
    b.addEventListener('click', () => {
      estado.tamanhoPincel = t;
      montarModoCidade();
    });
    tam.append(b);
  }
}

function sincronizarTamanho() {
  const mundo = estado.mundo;
  if (!mundo) return;
  el('in-largura').value = mundo.largura;
  el('in-altura').value = mundo.altura;
}

// ---------- acervo ----------

function miniaturaDeChao(def) {
  const lona = criar('canvas');
  lona.width = LARGURA_TILE;
  lona.height = LARGURA_TILE;
  const ctx = lona.getContext('2d');
  const x = LARGURA_TILE / 2;
  const y = LARGURA_TILE / 2;

  const textura = def.semTextura ? null : acervo.texturaDeChao(def.material, 0, 0);
  if (textura) {
    ctx.save();
    trilhaDiamante(ctx, x, y);
    ctx.clip();
    ctx.transform(
      LARGURA_TILE / 2 / textura.naturalWidth,
      ALTURA_TILE / 2 / textura.naturalWidth,
      -LARGURA_TILE / 2 / textura.naturalHeight,
      ALTURA_TILE / 2 / textura.naturalHeight,
      x,
      y - ALTURA_TILE / 2,
    );
    ctx.drawImage(textura, 0, 0);
    ctx.restore();
  } else {
    pintarChao(ctx, def, x, y, 1, 3);
  }
  return lona;
}

function miniaturaDeObjeto(chave, def) {
  const lona = criar('canvas');
  lona.width = LARGURA_TILE;
  lona.height = LARGURA_TILE;
  const ctx = lona.getContext('2d');

  if (!def) {
    ctx.strokeStyle = 'rgba(154,160,171,0.4)';
    ctx.setLineDash([3, 3]);
    trilhaDiamante(ctx, LARGURA_TILE / 2, LARGURA_TILE / 2);
    ctx.stroke();
    return lona;
  }

  ctx.fillStyle = def.solido ? '#3b4454' : '#262d3a';
  ctx.fillRect(6, 6, LARGURA_TILE - 12, LARGURA_TILE - 12);
  ctx.fillStyle = '#f0c87e';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(chave, LARGURA_TILE / 2, LARGURA_TILE / 2);
  return lona;
}

/**
 * Só pede a imagem quando a miniatura entra na tela.
 *
 * O acervo tem 14 MB. Pedir tudo ao montar a paleta era o que obrigava a ter um
 * teto baixo de itens; com isto, a paleta pode listar tudo e a rede só trabalha
 * no que você está olhando.
 */
const vigiaMiniaturas =
  typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver(
        (entradas, vigia) => {
          for (const entrada of entradas) {
            if (!entrada.isIntersecting) continue;
            vigia.unobserve(entrada.target);
            entrada.target.carregar?.();
          }
        },
        { root: null, rootMargin: '200px' },
      );

function miniaturaDePeca(id, { imediata = false } = {}) {
  const lona = criar('canvas');
  lona.width = LARGURA_TILE * 2;
  lona.height = LARGURA_TILE * 2;
  const ctx = lona.getContext('2d');
  const lado = LARGURA_TILE * 2;

  const pintar = (img) => {
    const escala = Math.min(lado / img.naturalWidth, lado / img.naturalHeight);
    const l = img.naturalWidth * escala;
    const a = img.naturalHeight * escala;
    ctx.clearRect(0, 0, lado, lado);
    ctx.drawImage(img, (lado - l) / 2, lado - a, l, a);
  };

  // Moldura tracejada enquanto não chega, para a paleta não piscar de vazio.
  ctx.strokeStyle = 'rgba(154,160,171,0.25)';
  ctx.strokeRect(12, 12, lado - 24, lado - 24);

  lona.carregar = () => {
    const pronta = acervo.garantir(id, pintar);
    if (pronta) pintar(pronta);
  };

  if (imediata || !vigiaMiniaturas) lona.carregar();
  else vigiaMiniaturas.observe(lona);

  return lona;
}

function desenharGrupos() {
  const caixa = el('grupos');
  caixa.replaceChildren();
  if (estado.camada !== 'decoracao') return;

  const contagem = contarPorGrupo(acervo.idsDePecas());
  for (const grupo of GRUPOS) {
    const quantos = contagem.get(grupo.id) ?? 0;
    if (!quantos) continue;
    const chip = criar('button', `chip${estado.grupo === grupo.id ? ' chip--ativo' : ''}`, `${grupo.rotulo} ${quantos}`);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      estado.grupo = grupo.id;
      desenharPaleta();
    });
    caixa.append(chip);
  }
}

function desenharPaleta() {
  const paleta = el('paleta');
  paleta.replaceChildren();
  el('acervo-titulo').textContent = {
    chao: 'Materiais de chão',
    objetos: 'Peças da matriz',
    decoracao: 'Acervo de peças',
    passagem: 'Para onde a passagem leva',
  }[estado.camada];
  el('busca').hidden = estado.camada !== 'decoracao';
  el('selecionada').hidden = estado.camada !== 'decoracao';
  el('niveis').hidden = estado.camada !== 'decoracao';
  el('chk-solido').closest('.opcao').hidden = estado.camada !== 'decoracao';
  el('chk-volta').closest('.opcao').hidden = estado.camada !== 'passagem';
  if (estado.camada === 'decoracao') mostrarSelecionada();
  desenharGrupos();

  if (estado.camada === 'passagem') {
    const mundo = estado.mundo;
    const outros = estado.cenas.filter((c) => c.id !== mundo?.dados.id);

    paleta.append(
      criar(
        'p',
        'acervo__vazio',
        'Escolha o destino e clique no mapa. Cada passagem guarda o próprio destino, então não há limite de quantidade.',
      ),
    );

    for (const cena of outros) {
      const selecionado = estado.pincel.passagem === cena.id;
      const b = criar('button', `peca${selecionado ? ' peca--ativa' : ''}`);
      b.type = 'button';
      b.style.gridColumn = '1 / -1';
      b.title = `${cena.id} · ${cena.largura}×${cena.altura}`;
      b.append(criar('span', 'peca__nome', cena.nome));
      const jaLiga = mundo?.destinos().includes(cena.id);
      b.append(criar('span', 'peca__nome', jaLiga ? 'já há passagem para cá' : 'sem passagem ainda'));
      b.addEventListener('click', () => {
        estado.pincel.passagem = cena.id;
        estado.ferramenta = 'pincel';
        montarTrilha();
        desenharPaleta();
      });
      paleta.append(b);
    }

    if (!outros.length) {
      paleta.append(criar('p', 'acervo__vazio', 'Só existe este local. Crie outro em "Novo local".'));
    }

    const existentes = mundo?.dados.passagens ?? [];
    paleta.append(
      criar(
        'p',
        'acervo__vazio',
        existentes.length
          ? `Neste local: ${existentes.map((p) => `${p.gx},${p.gy} → ${p.para}`).join(' · ')}`
          : 'Nenhuma passagem neste local ainda.',
      ),
    );
    return;
  }

  if (estado.camada === 'decoracao') {
    // Um item por modelo. As quatro orientações do mesmo modelo não merecem
    // quatro lugares na lista: é a mesma peça virada, e virar é a tecla R.
    const achados = filtrarFamilias(acervo.idsDePecas(), {
      grupo: estado.grupo,
      termo: estado.termo,
    });

    if (!achados.length) {
      paleta.append(criar('p', 'acervo__vazio', 'Nada encontrado com esse filtro.'));
      return;
    }

    const teto = estado.grupo === 'todos' ? TETO_TODOS : TETO_GRUPO;

    for (const item of achados.slice(0, teto)) {
      const b = criar('button', `peca${estado.familia === item.base ? ' peca--ativa' : ''}`);
      b.type = 'button';
      const quantas = item.orientacoes.length;
      b.title =
        `${item.base} · ${item.pacote}` +
        (quantas > 1 ? ` · ${quantas} orientações (R gira)` : ' · orientação única');
      // A miniatura fica sempre na mesma orientação para a lista não dançar a
      // cada giro; a orientação escolhida aparece no quadro "Escolhida" e no
      // fantasma em cima do mapa.
      const vitrine = item.ids[ORIENTACAO_VITRINE] ?? item.ids[item.orientacoes[0]];
      b.append(miniaturaDePeca(vitrine));
      b.append(criar('span', 'peca__nome', item.nome));
      if (quantas > 1) b.append(criar('span', 'peca__giro', `${quantas}×`));
      b.addEventListener('click', () => {
        escolherPeca(item.base);
        estado.ferramenta = 'pincel';
        montarTrilha();
        desenharPaleta();
      });
      paleta.append(b);
    }

    if (achados.length > teto) {
      paleta.append(
        criar('p', 'acervo__vazio', `Mostrando ${teto} de ${achados.length}. Refine a busca ou escolha um grupo.`),
      );
    }
    return;
  }

  const itens = estado.camada === 'chao' ? Object.entries(CHAO) : Object.entries(OBJETOS);
  for (const [chave, def] of itens) {
    const selecionado = estado.pincel[estado.camada] === chave;
    const b = criar('button', `peca${selecionado ? ' peca--ativa' : ''}`);
    b.type = 'button';
    const rotulo = def ? (def.rotulo ?? def.id ?? chave) : 'nada';
    b.title = `${rotulo} · caractere "${chave === ' ' ? 'espaço' : chave}"`;
    b.append(estado.camada === 'chao' ? miniaturaDeChao(def) : miniaturaDeObjeto(chave, def));
    b.append(criar('span', 'peca__nome', rotulo));
    b.addEventListener('click', () => {
      estado.pincel[estado.camada] = chave;
      desenharPaleta();
    });
    paleta.append(b);
  }
}

// ---------- ações ----------

el('sel-cena').addEventListener('change', async (e) => {
  const alvo = e.target.value;
  const anterior = estado.mundo?.dados.id;
  if (!(await confirmarDescarte('Trocar de local'))) {
    // Desistiu: o seletor volta a mostrar onde a pessoa realmente está.
    if (anterior) e.target.value = anterior;
    return;
  }
  await abrirCena(alvo);
  // "Salvar e continuar" remonta a lista e reseleciona o local antigo. Sem esta
  // linha o seletor mostraria um local e o mapa, outro.
  e.target.value = alvo;
});
el('btn-enquadrar').addEventListener('click', enquadrar);

// ---------- papel manteiga (referência) ----------

referencia.carregar('/referencia/mapa-ruas.png', () => {
  atualizarBotoesReferencia();
});

function atualizarBotoesReferencia() {
  const mostrar = el('ref-mostrar');
  mostrar.classList.toggle('botao--ativo', referencia.estado.visivel && referencia.temImagem);
  mostrar.textContent = referencia.estado.visivel ? 'Referência ✓' : 'Referência';
  el('ref-ajustar').classList.toggle('botao--ativo', estado.ajustandoReferencia);
  el('ref-opacidade').value = String(Math.round(referencia.estado.opacidade * 100));
}

el('ref-mostrar').addEventListener('click', () => {
  if (!referencia.temImagem) {
    avisar('A imagem de referência não carregou.', 'ruim');
    return;
  }
  const visivel = referencia.alternar();
  // Esconder a referência também sai do modo de ajuste, senão o mouse ficaria
  // mexendo numa imagem invisível.
  if (!visivel) estado.ajustandoReferencia = false;
  atualizarBotoesReferencia();
  avisar(visivel ? 'Referência ligada.' : 'Referência desligada (posição guardada).', 'bom');
});

el('ref-ajustar').addEventListener('click', () => {
  if (!referencia.temImagem) return;
  estado.ajustandoReferencia = !estado.ajustandoReferencia;
  // Ligar o ajuste força a referência visível, senão não há o que agarrar.
  if (estado.ajustandoReferencia && !referencia.estado.visivel) referencia.alternar();
  atualizarBotoesReferencia();
  avisar(
    estado.ajustandoReferencia
      ? 'Ajuste: arraste para mover, puxe um canto para escalar e girar.'
      : 'Ajuste desligado. Agora o mouse volta a desenhar.',
    'bom',
  );
});

el('ref-opacidade').addEventListener('input', (e) => {
  referencia.definirOpacidade(Number(e.target.value) / 100);
});

el('ref-enquadrar').addEventListener('click', () => {
  if (!referencia.temImagem) return;
  referencia.enquadrar();
  if (!referencia.estado.visivel) referencia.alternar();
  atualizarBotoesReferencia();
});

el('btn-limpar').addEventListener('click', () => {
  const mundo = estado.mundo;
  if (!mundo) return;
  // Pede confirmação: esvaziar o mapa inteiro é grande, mesmo dando para
  // desfazer. Um clique sem querer no botão não deve varrer tudo em silêncio.
  const confirmar = typeof window.confirm === 'function' ? window.confirm : () => true;
  if (!confirmar(`Esvaziar "${mundo.dados.nome}" inteiro? Dá para desfazer com Z.`)) return;
  mundo.limparTudo();
  renderizador.esquecerLosangos();
  sincronizarTamanho();
  desenharPaleta();
  avisar('Mapa esvaziado. Z desfaz.', 'bom');
});
el('busca').addEventListener('input', (e) => {
  estado.termo = e.target.value;
  desenharPaleta();
});
el('chk-solido').addEventListener('change', (e) => {
  estado.solido = e.target.checked;
});
el('btn-nivel-mais').addEventListener('click', () => mudarNivel(1));
el('btn-nivel-menos').addEventListener('click', () => mudarNivel(-1));
el('chk-volta').addEventListener('change', (e) => {
  estado.criarVolta = e.target.checked;
});
el('btn-desfazer').addEventListener('click', () => estado.mundo?.desfazer() && sincronizarTamanho());
el('btn-refazer').addEventListener('click', () => estado.mundo?.refazer() && sincronizarTamanho());

el('btn-tamanho').addEventListener('click', () => {
  const mundo = estado.mundo;
  if (!mundo) return;
  mundo.redimensionar(Number(el('in-largura').value), Number(el('in-altura').value));
  sincronizarTamanho();
  avisar(`Mapa agora é ${mundo.largura}×${mundo.altura}.`, 'bom');
});

/**
 * Relata a validação e leva a vista até o primeiro problema.
 *
 * Ler "ponto de vestígio em 27,10 está bloqueado" não resolvia nada: a
 * coordenada não se acha a olho num mapa de quarenta e nove colunas, e o `*`
 * é desenhado invisível no jogo. Agora a câmera vai até lá e o marcador
 * aparece em vermelho.
 */
function relatarValidacao(problemas) {
  if (!problemas.length) {
    renderizador.erro = null;
    avisar('Mapa válido: tudo alcançável e sem caractere solto.', 'bom');
    return true;
  }
  const foco = estado.mundo?.focoDoProblema;
  if (foco) {
    const ponto = gradeParaMundo(foco.gx, foco.gy);
    camera.fixar(ponto.x, ponto.y);
    camera.zoom = Math.max(camera.zoom, 0.9);
    mostrarZoom();
    // Fica cercado em vermelho até o mapa passar na validação de novo.
    renderizador.erro = { gx: foco.gx, gy: foco.gy };
  }
  const resto = problemas.length > 1 ? ` (e mais ${problemas.length - 1})` : '';
  avisar(`${problemas[0]}${resto}`, 'ruim');
  return false;
}

el('btn-validar').addEventListener('click', () => {
  relatarValidacao(estado.mundo?.validar(CASO_014.documentos) ?? []);
});

/**
 * Grava a cena aberta. Devolve `true` só quando o arquivo foi realmente escrito
 * — quem chama precisa saber disso para decidir se pode trocar de local.
 * @returns {Promise<boolean>}
 */
async function salvar() {
  const mundo = estado.mundo;
  if (!mundo) return false;
  if (!relatarValidacao(mundo.validar(CASO_014.documentos))) return false;
  try {
    const resposta = await fetch(`/api/cena/${mundo.dados.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mundo.paraGravar()),
    });
    const corpo = await resposta.json();
    if (!resposta.ok) throw new Error(corpo.erro ?? 'falha ao gravar');
    mundo.sujo = false;

    // Porta de volta: sem ela o jogador entra no prédio novo e fica preso lá.
    const voltas = [];
    if (estado.criarVolta) {
      for (const destino of mundo.destinos()) {
        try {
          const r = await fetch('/api/volta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ de: mundo.dados.id, para: destino }),
          });
          const dados = await r.json();
          if (r.ok && dados.criada) voltas.push(destino);
        } catch {
          // Volta é conveniência: falhar nela não invalida o que já foi salvo.
        }
      }
    }

    const extra = voltas.length ? ` Porta de volta criada em: ${voltas.join(', ')}.` : '';

    // O arquivo já está gravado. Recarregar a lista é conveniência, e um erro
    // aqui não pode anunciar como falha um save que deu certo — foi exatamente
    // isso que aconteceu com um estouro na montagem da paleta.
    try {
      await carregarListaDeCenas(mundo.dados.id);
    } catch (erro) {
      console.error(erro);
      avisar(
        `Salvo em ${corpo.arquivo}, mas a tela não recarregou: ${erro.message}. Atualize a página.`,
        'ruim',
      );
      return true;
    }

    avisar(`Salvo em ${corpo.arquivo}.${extra} O jogo aberto recarrega sozinho.`, 'bom');
    return true;
  } catch (erro) {
    console.error(erro);
    avisar(`Não deu para salvar: ${erro.message}`, 'ruim');
    return false;
  }
}

el('btn-salvar').addEventListener('click', salvar);

// Novo local. Criar um local novo abre ele em seguida, então vale a mesma
// pergunta da troca pelo seletor.
el('btn-novo').addEventListener('click', async () => {
  if (!(await confirmarDescarte('Criar um local novo'))) return;
  el('dialogo').hidden = false;
  el('novo-id').focus();
});
el('novo-cancelar').addEventListener('click', () => {
  el('dialogo').hidden = true;
});
el('form-novo').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const corpo = {
    id: el('novo-id').value.trim(),
    nome: el('novo-nome').value.trim(),
    endereco: el('novo-endereco').value.trim(),
    largura: Number(el('novo-largura').value),
    altura: Number(el('novo-altura').value),
    externo: el('novo-externo').checked,
  };
  try {
    const resposta = await fetch('/api/cena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro ?? 'falha ao criar');
    el('dialogo').hidden = true;
    await carregarListaDeCenas(corpo.id);
    avisar(`Local criado em ${dados.arquivo} e já na lista do jogo.`, 'bom');
  } catch (erro) {
    avisar(`Não deu para criar: ${erro.message}`, 'ruim');
  }
});

// ---------- teclado ----------

window.addEventListener('keydown', (evento) => {
  const alvo = evento.target;
  if (alvo instanceof HTMLInputElement || alvo instanceof HTMLSelectElement) return;

  const ferramenta = FERRAMENTAS.find((f) => f.tecla === evento.key);
  if (ferramenta) {
    estado.ferramenta = ferramenta.id;
    if (ferramenta.id !== 'estrada') estado.inicioEstrada = null;
    montarTrilha();
    return;
  }

  if (evento.key === 'Tab') {
    evento.preventDefault();
    const i = CAMADAS.findIndex((c) => c.id === estado.camada);
    estado.camada = CAMADAS[(i + 1) % CAMADAS.length].id;
    montarTrilha();
    desenharPaleta();
    return;
  }

  // Gira a peça. Shift gira ao contrário, para não ter de dar três voltas.
  if (evento.key === 'r' || evento.key === 'R') {
    girarPeca(evento.shiftKey ? -1 : 1);
    return;
  }

  // Volta ao chão de uma vez.
  if (evento.key === 'x' || evento.key === 'X') {
    voltarAoChao();
    return;
  }

  // Altura da próxima peça. Com Shift o passo é de um cubo inteiro da grade.
  if (evento.key === 'f' || evento.key === 'F') {
    mudarNivel(evento.shiftKey ? SALTO_NIVEL : 1);
    return;
  }
  if (evento.key === 'v' || evento.key === 'V') {
    mudarNivel(evento.shiftKey ? -SALTO_NIVEL : -1);
    return;
  }

  if (evento.key === 'z' || evento.key === 'Z') {
    estado.mundo?.desfazer();
    sincronizarTamanho();
  }
  if (evento.key === 'y' || evento.key === 'Y') {
    estado.mundo?.refazer();
    sincronizarTamanho();
  }
  if (evento.key === 'Escape') {
    // Prioridade: caixa aberta primeiro, peça na mão depois. No aviso de não
    // salvo, Esc é "ficar aqui": fechar sem responder deixaria a promessa
    // pendurada e a troca de local travada.
    if (!el('dialogo-sujo').hidden) {
      el('sujo-cancelar').click();
      return;
    }
    if (!el('dialogo').hidden) {
      el('dialogo').hidden = true;
      return;
    }
    // Estrada a meio caminho: Esc encerra o encadeamento sem traçar o trecho.
    if (estado.inicioEstrada) {
      estado.inicioEstrada = null;
      avisar('Estrada encerrada.', 'bom');
      return;
    }
    if (estado.camada === 'decoracao' && soltarPeca()) return;
    // Nada para soltar: cancela uma área em marcação, se houver.
    estado.inicioArea = null;
  }
});

window.addEventListener('beforeunload', (evento) => {
  if (estado.mundo?.sujo) evento.preventDefault();
});

// ---------- laço ----------

function redimensionar() {
  renderizador.redimensionar();
}
window.addEventListener('resize', redimensionar);

/**
 * O que o fantasma deve mostrar neste quadro.
 *
 * Devolve nulo quando não há o que prever — fora do mapa, ou com a área de
 * retângulo em marcação, que já tem a própria prévia.
 */
function previaDoQuadro() {
  const mundo = estado.mundo;
  const tile = estado.tileSobMouse;
  if (!mundo || !tile || !mundo.dentro(tile.gx, tile.gy)) return null;
  if (estado.inicioArea) return null;

  // Cada camada sabe mostrar uma coisa diferente. A borracha não mostra peça
  // nenhuma: ali o fantasma é só o losango do tile que vai ser limpo.
  const apagando = estado.ferramenta === 'borracha';
  const previa = { gx: tile.gx, gy: tile.gy, nivel: 0 };

  if (estado.camada === 'decoracao') {
    previa.nivel = estado.nivel;
    if (!apagando) previa.peca = estado.pincel.decoracao || null;
  } else if (estado.camada === 'objetos' && !apagando) {
    // O volume da peça, não só o tile: é o que faltava para saber onde a parede
    // ia ficar sem precisar colocar, olhar e apagar.
    previa.def = OBJETOS[estado.pincel.objetos] ?? null;
  } else if (estado.camada === 'chao' && !apagando) {
    previa.terreno = CHAO[estado.pincel.chao] ?? null;
  }

  return previa;
}

/**
 * A peça a contornar neste quadro.
 *
 * Só no modo de inspeção — sem peça na mão. Com peça escolhida, o fantasma já
 * ocupa o lugar e dois contornos sobrepostos atrapalhariam em vez de ajudar.
 */
function destaqueDoQuadro() {
  if (estado.camada !== 'decoracao') return null;
  if (estado.pincel.decoracao) return null;
  const tile = estado.tileSobMouse;
  if (!tile || estado.inicioArea) return null;

  const alvo = alvoDaColuna(tile);
  if (!alvo) return null;
  return {
    gx: alvo.gx,
    gy: alvo.gy,
    nivel: alvo.nivel,
    peca: alvo.peca,
    rotulo: rotuloDePeca(alvo.peca, alvo.nivel),
  };
}

function quadro(agora) {
  if (estado.mundo) {
    mostrarSujo();
    renderizador.previa = previaDoQuadro();
    renderizador.destaque = destaqueDoQuadro();
    // O destaque de tile do jogo fica de fora: aqui a prévia já é o indicador
    // de onde o cursor está, e ela aparece também sobre parede e vazio, onde o
    // destaque do jogo não desenha nada.
    renderizador.desenhar(jogoFalso, null, null, agora / 1000);

    // Papel manteiga por cima do mapa, se ligado.
    referencia.desenhar(canvas.getContext('2d'), renderizador.dpr, renderizador.largura, renderizador.altura);

    // Prévia da área sendo marcada com retângulo ou prédio.
    if (estado.inicioArea && estado.tileSobMouse) {
      desenharPreviaArea(estado.inicioArea, estado.tileSobMouse);
    }

    // Prévia da estrada: a linha do começo marcado até o cursor.
    if (estado.ferramenta === 'estrada' && estado.inicioEstrada && estado.tileSobMouse) {
      desenharPreviaEstrada(estado.inicioEstrada, estado.tileSobMouse);
    }
  }
  requestAnimationFrame(quadro);
}

/** Linha fantasma da estrada, do começo marcado ao cursor, na largura do pincel. */
function desenharPreviaEstrada(a, b) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(renderizador.dpr, 0, 0, renderizador.dpr, 0, 0);
  ctx.translate(renderizador.largura / 2, renderizador.altura / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  const pa = gradeParaMundo(a.gx, a.gy);
  const pb = gradeParaMundo(b.gx, b.gy);
  const raio = Math.floor((estado.tamanhoPincel - 1) / 2);

  // Faixa larga ligando os dois pontos, na espessura aproximada da estrada.
  ctx.strokeStyle = 'rgba(216, 162, 74, 0.5)';
  ctx.lineWidth = Math.max(2, (raio * 2 + 1) * (LARGURA_TILE / 2) * 0.5);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();

  // Pontas: diamante no começo e no fim, para ler onde a rua vai nascer/terminar.
  ctx.fillStyle = 'rgba(240, 200, 126, 0.8)';
  for (const p of [pa, pb]) {
    trilhaDiamante(ctx, p.x, p.y, 0.9);
    ctx.fill();
  }
  ctx.restore();
}

function desenharPreviaArea(a, b) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(renderizador.dpr, 0, 0, renderizador.dpr, 0, 0);
  ctx.translate(renderizador.largura / 2, renderizador.altura / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  const x0 = Math.min(a.gx, b.gx);
  const x1 = Math.max(a.gx, b.gx);
  const y0 = Math.min(a.gy, b.gy);
  const y1 = Math.max(a.gy, b.gy);

  ctx.fillStyle = 'rgba(216, 162, 74, 0.22)';
  for (let gy = y0; gy <= y1; gy += 1) {
    for (let gx = x0; gx <= x1; gx += 1) {
      const { x, y } = gradeParaMundo(gx, gy);
      trilhaDiamante(ctx, x, y, 0.94);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- partida ----------

montarTrilha();
mostrarNivel();
redimensionar();
await carregarListaDeCenas();
requestAnimationFrame(quadro);
