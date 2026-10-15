// Desenho da cena. Tudo é geometria desenhada em tempo real: losangos para o
// chão, blocos extrudados para os móveis e uma silhueta simples para o detetive.
// Nenhum arquivo de imagem é carregado.

import {
  ALTURA_NIVEL,
  ALTURA_TILE,
  LARGURA_TILE,
  gradeParaMundo,
  profundidade,
  trilhaDiamante,
} from '../core/iso.js';
import { mundoParaGrade } from '../core/iso.js';
import { ARESTAS, pintarChao, ruido } from './chao.js';
// Dados gerados, estáticos, sem alternativa em tempo de execução — importados
// direto, como `tiles.js`. O acervo de cenário, que o editor filtra e o jogo
// pode não ter, continua entrando por injeção.
import { DETETIVE } from '../dados/detetive.js';

/** Quantas versões de cada material procedural são pré-pintadas. */
const VARIACOES_PROCEDURAIS = 6;

const MEIA_LARGURA = LARGURA_TILE / 2;
const MEIA_ALTURA = ALTURA_TILE / 2;

export class Renderizador {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/camera.js').Camera} camera
   */
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/camera.js').Camera} camera
   * @param {import('./acervo.js').Acervo|null} acervo imagens opcionais
   */
  constructor(canvas, camera, acervo = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
    this.acervo = acervo;
    /**
     * Losangos de chão já pintados, um por material e variação.
     * São poucas imagens pequenas, então o consumo não cresce com o mapa.
     * @type {Map<string, HTMLCanvasElement>}
     */
    this.losangos = new Map();
    /** Grade de apoio, ligada pelo editor. */
    this.mostrarGrade = false;
    /**
     * Mostra os marcadores que o jogo deixa invisíveis: ponto de vestígio (`*`)
     * e ponto de partida (`X`).
     *
     * No jogo eles não podem aparecer — o ponto de vestígio é onde uma pista
     * *pode* surgir, e desenhar isso entregaria o mapa. No editor o silêncio é
     * o contrário de útil: dá para construir uma parede em cima de um ponto sem
     * ver, e só descobrir na hora de salvar, com um erro que cita uma
     * coordenada que você não tem como achar na tela.
     */
    this.mostrarMarcadores = false;
    /** No editor a penumbra atrapalha: dá para desligar sem tocar no jogo. */
    this.mostrarLuz = true;
    /** O editor desenha o mundo sem o personagem nem a rota dele. */
    this.mostrarDetetive = true;
    /**
     * Modo do minimapa, em ciclo pela tecla M:
     *  - 'canto'     mapinha no canto, ~20% do mapa ao redor do detetive;
     *  - 'expandido' o mapa inteiro, numa caixa grande centralizada;
     *  - 'oculto'    nada.
     *
     * Fica oculto por padrão (o editor não quer o enfeite) e o jogo começa em
     * 'canto' por `main.js`. Em qualquer modo mostra o chão amostrado, as saídas,
     * os vestígios já visíveis e onde o detetive está — para dar noção tanto do
     * que há por perto quanto de onde se está no mapa como um todo.
     */
    this.modoMinimapa = 'oculto';
    /** Fração do maior lado do mapa que o minimapa de canto enquadra (0.2 = ~20%). */
    this.fracaoMinimapa = 0.2;
    /**
     * A multidão da cidade, ligada pelo jogo em `main.js`. Quando presente e a
     * cena atual é a cidade dela, os NPCs entram na fila de desenho. O editor
     * nunca liga, então fica nulo lá.
     * @type {import('../jogo/povo.js').Povo|null}
     */
    this.povo = null;
    /**
     * Id da cena do crime. Quando definido, o minimapa destaca em vermelho a
     * passagem que leva até lá — a seta de "o corpo está aqui". Ligado pelo jogo
     * quando o crime dispara; nulo antes disso e no editor.
     * @type {string|null}
     */
    this.localDoCrime = null;
    /**
     * Posição de tela do ponteiro, ligada pelo jogo. O mapa grande usa para
     * mostrar a legenda do lugar sob o mouse. Nulo quando o mouse está fora.
     * @type {{x:number,y:number}|null}
     */
    this.ponteiro = null;
    /**
     * Chão do mapa grande já pintado numa imagem, para não repintar os ~380 mil
     * tiles da cidade a cada quadro — era isso que travava com o mapa aberto. A
     * imagem é refeita só quando a cena ou o tamanho da caixa muda.
     * @type {{chave:string, lona:HTMLCanvasElement}|null}
     */
    this.mapaCacheChao = null;
    /**
     * Fantasma da peça que está prestes a ser colocada, ligado pelo editor.
     *
     * Sem isto, pôr uma parede era tentativa e erro: você clicava, via onde a
     * peça caiu, apagava e clicava de novo. Entra na mesma fila de desenho das
     * peças de verdade, então a profundidade e a altura saem exatas.
     * Traz só o que a camada em edição sabe mostrar: `peca` para o acervo,
     * `def` para a matriz de objetos, `terreno` para o material de chão.
     * @type {{gx:number, gy:number, nivel?:number, peca?:string|null,
     *         def?:object|null, terreno?:object|null}|null}
     */
    this.previa = null;
    /**
     * Tile a marcar em vermelho, ligado pelo editor quando algo dá errado.
     *
     * Mensagem de erro com coordenada não resolve: num mapa de quarenta e nove
     * colunas, "27,10" não se acha a olho. Aqui o lugar do problema fica
     * cercado e pulsando até ser corrigido.
     * @type {{gx:number, gy:number}|null}
     */
    this.erro = null;
    /**
     * Peça a contornar, ligada pelo editor no modo de inspeção.
     *
     * Um tile pode ter peça em vários níveis — parede embaixo, telhado no meio,
     * assoalho em cima. Sem contorno não há como saber qual delas o conta-gotas
     * vai pegar, e pegar a errada é o caminho mais curto para desistir de usar
     * o conta-gotas.
     * @type {{gx:number, gy:number, nivel:number, peca:string, rotulo?:string}|null}
     */
    this.destaque = null;
    this.dpr = 1;
    this.largura = 1;
    this.altura = 1;
    this.redimensionar();
  }

  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const largura = this.canvas.clientWidth || window.innerWidth;
    const altura = this.canvas.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.largura = largura;
    this.altura = altura;
    this.canvas.width = Math.round(largura * dpr);
    this.canvas.height = Math.round(altura * dpr);
    this.camera.redimensionar(largura, altura);
  }

  /**
   * @param {import('../jogo/jogo.js').Jogo} jogo
   * @param {{gx:number,gy:number}|null} tileSobMouse
   * @param {object|null} alvoDestacado
   * @param {number} tempo
   */
  desenhar(jogo, tileSobMouse, alvoDestacado, tempo) {
    const ctx = this.ctx;
    const cena = jogo.cenaAtual;
    const detetive = jogo.detetive;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.largura, this.altura);

    // Fundo
    const fundo = ctx.createLinearGradient(0, 0, 0, this.altura);
    fundo.addColorStop(0, '#080b11');
    fundo.addColorStop(1, '#05070b');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, this.largura, this.altura);

    // Centraliza o mundo na câmera e aplica o zoom. O jogo usa zoom 1; o editor
    // afasta e aproxima para construir.
    const zoom = this.camera.zoom;
    ctx.translate(this.largura / 2, this.altura / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.#desenharChao(cena);
    if (this.mostrarGrade) this.#desenharGrade(cena);
    if (tileSobMouse) this.#desenharDestaqueTile(cena, tileSobMouse, tempo);
    if (this.mostrarDetetive) this.#desenharRota(detetive);
    this.#desenharPecasEEntidades(jogo, alvoDestacado, tempo);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.mostrarLuz) {
      this.#desenharLuz(cena, detetive, this.camera.mundoParaTela(0, 0));
    }

    // Minimapa por cima de tudo, em coordenadas de tela (ignora câmera e zoom).
    if (this.mostrarDetetive && this.modoMinimapa !== 'oculto') {
      if (this.modoMinimapa === 'expandido') this.#desenharMapaExpandido(jogo, tempo);
      else this.#desenharMinimapa(jogo);
    }
  }

  /**
   * Minimapa no canto superior direito.
   *
   * Enquadra uma janela quadrada de `fracaoMinimapa` do maior lado do mapa,
   * centrada no detetive, e pinta cada tile dela como um quadradinho da cor do
   * material. Por cima, marca as saídas (azul), os vestígios já visíveis
   * (âmbar) e o detetive (ponto claro no centro). Tudo em espaço de tela, então
   * não sofre com o zoom nem com a projeção isométrica — é um mapa de planta
   * baixa, de leitura rápida, não uma segunda vista isométrica.
   */
  #desenharMinimapa(jogo) {
    const cena = jogo.cenaAtual;
    const detetive = jogo.detetive;

    // Caixa quadrada no canto inferior direito.
    const lado = Math.round(Math.max(140, Math.min(220, this.largura * 0.18)));
    const margem = 16;
    const caixa = { x: this.largura - lado - margem, y: this.altura - lado - margem, largura: lado, altura: lado };

    // Janela do mundo (em tiles) que o minimapa cobre, centrada no detetive.
    const alcance = Math.max(6, Math.round((Math.max(cena.largura, cena.altura) * this.fracaoMinimapa) / 2));
    const janela = {
      gxMin: Math.round(detetive.gx) - alcance,
      gyMin: Math.round(detetive.gy) - alcance,
      tilesX: alcance * 2 + 1,
      tilesY: alcance * 2 + 1,
    };

    this.#pintarMapa(jogo, caixa, janela, {
      rotulo: cena.nome ?? '',
      rotuloAcima: true, // no rodapé da tela, o nome vai acima da caixa
    });
  }

  /**
   * Mapa inteiro, numa caixa grande centralizada — para situar onde se está no
   * mundo como um todo (em cima, embaixo, perto do porto...). Mesmo desenho do
   * minimapa, só que a janela é o mapa todo e a caixa respeita a proporção dele.
   */
  #desenharMapaExpandido(jogo, tempo) {
    const ctx = this.ctx;
    const cena = jogo.cenaAtual;

    // Véu escuro por trás, para destacar o mapa e segurar o olho nele.
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 10, 0.45)';
    ctx.fillRect(0, 0, this.largura, this.altura);
    ctx.restore();

    // A caixa ocupa um bom pedaço da tela, mantendo a proporção do mapa.
    const dispX = this.largura * 0.7;
    const dispY = this.altura * 0.7;
    const escala = Math.min(dispX / cena.largura, dispY / cena.altura);
    const largura = Math.round(cena.largura * escala);
    const altura = Math.round(cena.altura * escala);
    const caixa = {
      x: Math.round((this.largura - largura) / 2),
      y: Math.round((this.altura - altura) / 2),
      largura,
      altura,
    };
    const janela = { gxMin: 0, gyMin: 0, tilesX: cena.largura, tilesY: cena.altura };

    this.#pintarMapa(jogo, caixa, janela, {
      rotulo: cena.nome ?? '',
      rotuloAcima: true,
      pulsarDetetive: tempo,
      legenda: 'M: reduzir',
      hover: true,
      chaoPronto: this.#chaoDoMapaGrande(cena, largura, altura),
    });
  }

  /**
   * Chão do mapa grande, pintado uma vez numa imagem e reaproveitado nos quadros
   * seguintes. Pintar os ~380 mil tiles da cidade a cada quadro era o que
   * travava com o mapa aberto; aqui o custo acontece só uma vez por abertura (ou
   * quando a caixa muda de tamanho, numa troca de resolução de janela).
   */
  #chaoDoMapaGrande(cena, largura, altura) {
    const chave = `${cena.id}:${largura}x${altura}:${this.dpr}`;
    if (this.mapaCacheChao?.chave === chave) return this.mapaCacheChao.lona;

    const lona = document.createElement('canvas');
    lona.width = Math.max(1, Math.round(largura * this.dpr));
    lona.height = Math.max(1, Math.round(altura * this.dpr));
    const ctx = lona.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const escalaX = largura / cena.largura;
    const escalaY = altura / cena.altura;
    const larguraCelula = Math.ceil(escalaX) + 0.5;
    const alturaCelula = Math.ceil(escalaY) + 0.5;

    for (let gy = 0; gy < cena.altura; gy += 1) {
      const linha = cena.chao[gy];
      for (let gx = 0; gx < cena.largura; gx += 1) {
        const terreno = linha[gx];
        if (!terreno) continue;
        ctx.fillStyle = terreno.base ?? (terreno.andavel ? '#3a3e45' : '#142a3d');
        ctx.fillRect(gx * escalaX, gy * escalaY, larguraCelula, alturaCelula);
      }
    }

    this.mapaCacheChao = { chave, lona };
    return lona;
  }

  /**
   * Desenho compartilhado do mapa (canto e expandido).
   *
   * `caixa` é o retângulo de tela; `janela` é o pedaço do mundo em tiles que
   * entra nele. Pinta o chão amostrado tile a tile, depois as saídas (azul), os
   * vestígios visíveis (âmbar) e o detetive (ponto claro). Em espaço de tela,
   * então ignora câmera, zoom e a projeção isométrica — é planta baixa.
   */
  #pintarMapa(jogo, caixa, janela, opcoes = {}) {
    const ctx = this.ctx;
    const cena = jogo.cenaAtual;
    const detetive = jogo.detetive;
    const { x, y, largura, altura } = caixa;
    const { gxMin, gyMin, tilesX, tilesY } = janela;
    const escalaX = largura / tilesX;
    const escalaY = altura / tilesY;
    const raioPonto = Math.max(2, Math.min(escalaX, escalaY) * 0.5);

    ctx.save();

    // Moldura e fundo.
    ctx.fillStyle = 'rgba(8, 11, 17, 0.85)';
    ctx.strokeStyle = 'rgba(216, 162, 74, 0.55)';
    ctx.lineWidth = 2;
    this.#caixaArredondada(ctx, x - 4, y - 4, largura + 8, altura + 8, 8);
    ctx.fill();
    ctx.stroke();

    // Recorta na caixa, para nada vazar.
    ctx.save();
    this.#caixaArredondada(ctx, x, y, largura, altura, 5);
    ctx.clip();

    // Chão. No mapa grande vem pronto numa imagem (um só drawImage); no mapinha
    // de canto, que amostra poucos tiles, é pintado tile a tile na hora.
    if (opcoes.chaoPronto) {
      ctx.drawImage(opcoes.chaoPronto, x, y, largura, altura);
    } else {
      const larguraCelula = Math.ceil(escalaX) + 0.5;
      const alturaCelula = Math.ceil(escalaY) + 0.5;
      for (let i = 0; i < tilesX; i += 1) {
        for (let j = 0; j < tilesY; j += 1) {
          const gx = gxMin + i;
          const gy = gyMin + j;
          if (!cena.dentro(gx, gy)) continue;
          const terreno = cena.chao[gy][gx];
          if (!terreno) continue;
          ctx.fillStyle = terreno.base ?? (terreno.andavel ? '#3a3e45' : '#142a3d');
          ctx.fillRect(x + i * escalaX, y + j * escalaY, larguraCelula, alturaCelula);
        }
      }
    }

    // Converte um tile da janela para o centro da célula na tela.
    const paraTela = (gx, gy) => ({
      px: x + (gx - gxMin + 0.5) * escalaX,
      py: y + (gy - gyMin + 0.5) * escalaY,
    });
    const dentroJanela = (gx, gy) =>
      gx >= gxMin && gx < gxMin + tilesX && gy >= gyMin && gy < gyMin + tilesY;

    // Saídas do local (passagens): pontos azuis. A que leva à cena do crime
    // (quando houver) fica vermelha e pulsando — a seta de "o corpo está aqui".
    const pulsoCrime = 0.6 + Math.sin(performance.now() / 300) * 0.4;
    // No mapa grande, acha a saída sob o mouse para mostrar a legenda do lugar.
    const hover = opcoes.hover ? this.ponteiro : null;
    let legendaHover = null;
    const raioAlvo = Math.max(6, raioPonto * 2);
    for (const passagem of cena.ligacoes) {
      if (!cena.dentro(passagem.gx, passagem.gy) || !dentroJanela(passagem.gx, passagem.gy)) continue;
      const { px, py } = paraTela(passagem.gx, passagem.gy);
      const ehCrime = this.localDoCrime && passagem.para === this.localDoCrime;
      if (ehCrime) {
        ctx.fillStyle = `rgba(228, 72, 62, ${0.55 + pulsoCrime * 0.4})`;
        ctx.beginPath();
        ctx.arc(px, py, raioPonto * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 150, 140, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(126, 200, 240, 0.95)';
        ctx.beginPath();
        ctx.arc(px, py, raioPonto * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // Hit-test do mouse: o mais próximo dentro do raio vira a legenda.
      if (hover && Math.hypot(hover.x - px, hover.y - py) <= raioAlvo) {
        const alvo = jogo.cenas.get(passagem.para);
        legendaHover = {
          px,
          py,
          texto: passagem.rotulo || alvo?.nome || passagem.para,
          nome: alvo?.nome ?? passagem.para,
          crime: ehCrime,
        };
      }
    }

    // Vestígios já no chão (os que o jogo mostra): pontos âmbar.
    for (const vestigio of jogo.vestigiosVisiveis()) {
      if (!dentroJanela(vestigio.gx, vestigio.gy)) continue;
      const { px, py } = paraTela(vestigio.gx, vestigio.gy);
      ctx.fillStyle = 'rgba(240, 200, 126, 0.95)';
      ctx.beginPath();
      ctx.arc(px, py, raioPonto * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Detetive: ponto claro com halo. No mapa expandido, pulsa para achar logo.
    const eu = paraTela(Math.round(detetive.gx), Math.round(detetive.gy));
    if (opcoes.pulsarDetetive != null) {
      const pulso = 6 + Math.sin(opcoes.pulsarDetetive * 4) * 3;
      const halo = ctx.createRadialGradient(eu.px, eu.py, 1, eu.px, eu.py, raioPonto + pulso);
      halo.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(eu.px, eu.py, raioPonto + pulso, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath();
    ctx.arc(eu.px, eu.py, Math.max(2.5, raioPonto), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // tira o clip

    // Rótulo do local.
    if (opcoes.rotulo) {
      ctx.fillStyle = 'rgba(232, 227, 215, 0.85)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(opcoes.rotulo, x, opcoes.rotuloAcima ? y - 8 : y + altura + 13);
    }

    // Legenda de ajuda (só no mapa expandido).
    if (opcoes.legenda) {
      ctx.fillStyle = 'rgba(232, 227, 215, 0.6)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(opcoes.legenda, x + largura, y - 8);
    }

    // Legenda do lugar sob o mouse (fora do recorte, para não ser cortada).
    if (legendaHover) {
      const texto = legendaHover.crime ? `${legendaHover.nome} — cena do crime` : legendaHover.nome;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const larguraCaixa = ctx.measureText(texto).width + 14;
      const alturaCaixa = 20;
      // Posiciona acima do ponto, sem sair da tela.
      let cx = legendaHover.px + 10;
      let cy = legendaHover.py - 12;
      if (cx + larguraCaixa > this.largura) cx = this.largura - larguraCaixa - 4;
      if (cy - alturaCaixa < 0) cy = legendaHover.py + alturaCaixa + 6;
      ctx.fillStyle = 'rgba(8, 12, 18, 0.92)';
      this.#caixaArredondada(ctx, cx, cy - alturaCaixa, larguraCaixa, alturaCaixa, 4);
      ctx.fill();
      ctx.strokeStyle = legendaHover.crime ? 'rgba(255, 120, 108, 0.9)' : 'rgba(216, 162, 74, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = legendaHover.crime ? '#ff9d92' : '#e8e3d7';
      ctx.fillText(texto, cx + 7, cy - 6);
      // Realça o ponto sob o mouse.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(legendaHover.px, legendaHover.py, raioAlvo, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Caminho de retângulo com cantos arredondados, para a moldura do minimapa. */
  #caixaArredondada(ctx, x, y, largura, altura, raio) {
    const r = Math.min(raio, largura / 2, altura / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + largura, y, x + largura, y + altura, r);
    ctx.arcTo(x + largura, y + altura, x, y + altura, r);
    ctx.arcTo(x, y + altura, x, y, r);
    ctx.arcTo(x, y, x + largura, y, r);
    ctx.closePath();
  }

  // ---------- chão ----------

  /**
   * Desenha só as tiles que caem na tela, copiando um losango já pronto para
   * cada material.
   *
   * A versão anterior pré-renderizava o mapa inteiro numa imagem só. Isso era
   * rápido em mapa pequeno e impossível em mapa grande: um mapa de 84×24 em tela
   * retina dava 23,9 milhões de pixels, acima do limite de área de canvas de
   * vários navegadores, e aí o canvas vira inutilizável em silêncio — o chão
   * parava de atualizar e o editor parecia travado.
   *
   * Agora o custo não depende do tamanho do mapa, só do tamanho da janela.
   */
  #desenharChao(cena) {
    const ctx = this.ctx;
    const faixa = this.#faixaVisivel(cena);

    // Muito afastado, cada tile vira um ponto de menos de um pixel, e desenhar
    // um `drawImage` por tile torra o quadro à toa — era isto que travava a
    // ilha vista de longe. Acima de certo afastamento, o chão é pintado como
    // blocos chapados de cor média, amostrando um tile a cada `passo`. De perto
    // (o jeito de sempre), nada muda: `passo` é 1 e cada losango é desenhado.
    // O passo faz cada amostra cobrir ~16px na tela: afastou, menos amostras.
    // Antes o alvo era 6px, o que ainda deixava dezenas de milhares de blocos
    // numa ilha vista de longe. 16px mantém a amostragem na casa dos milhares,
    // onde o quadro é fluido, sem buraco visível no chão.
    const tileNaTela = LARGURA_TILE * this.camera.zoom;
    const passo = tileNaTela >= 10 ? 1 : Math.max(1, Math.ceil(16 / Math.max(0.001, tileNaTela)));

    if (passo === 1) {
      for (let gy = faixa.y0; gy <= faixa.y1; gy += 1) {
        for (let gx = faixa.x0; gx <= faixa.x1; gx += 1) {
          const terreno = cena.chao[gy][gx];
          if (!terreno) continue;
          const losango = this.#losangoDe(terreno, gx, gy);
          if (!losango) continue;
          const { x, y } = gradeParaMundo(gx, gy);
          ctx.drawImage(
            losango,
            x - MEIA_LARGURA - 1,
            y - MEIA_ALTURA - 1,
            LARGURA_TILE + 2,
            ALTURA_TILE + 2,
          );
        }
      }
      this.#desenharFronteiras(ctx, cena, faixa);
      return;
    }

    this.#desenharChaoDistante(cena, faixa, passo);
  }

  /**
   * Chão visto de longe: um retângulo chapado por amostra, sem losango nem
   * costura.
   *
   * O custo cai de "um drawImage por tile" para "um fillRect por amostra", e
   * `passo` cresce com o afastamento, então o número de amostras fica mais ou
   * menos constante por quadro, não importa o tamanho do mapa. É o que mantém a
   * ilha inteira fluida.
   */
  #desenharChaoDistante(cena, faixa, passo) {
    const ctx = this.ctx;
    // Quadrado e não losango: a essa distância a diferença não se vê, e um
    // `fillRect` por amostra é muito mais barato que montar e preencher um path
    // de quatro lados. O lado cobre a amostra inteira com uma folga pequena,
    // para os blocos encostarem sem deixar listra de fundo entre eles.
    const lado = LARGURA_TILE * passo * 0.72;
    const meio = lado / 2;

    for (let gy = faixa.y0; gy <= faixa.y1; gy += passo) {
      for (let gx = faixa.x0; gx <= faixa.x1; gx += passo) {
        const terreno = cena.chao[gy][gx];
        if (!terreno) continue;
        const { x, y } = gradeParaMundo(gx, gy);
        ctx.fillStyle = terreno.base ?? terreno.claro ?? '#3a3e45';
        ctx.fillRect(x - meio, y - meio, lado, lado);
      }
    }
  }

  /** Intervalo de tiles que pode aparecer na janela, com folga nas bordas. */
  #faixaVisivel(cena) {
    const cantos = [
      this.camera.telaParaMundo(0, 0),
      this.camera.telaParaMundo(this.largura, 0),
      this.camera.telaParaMundo(0, this.altura),
      this.camera.telaParaMundo(this.largura, this.altura),
    ].map((p) => mundoParaGrade(p.x, p.y));

    const gxs = cantos.map((c) => c.gx);
    const gys = cantos.map((c) => c.gy);
    const folga = 2;

    return {
      x0: Math.max(0, Math.floor(Math.min(...gxs)) - folga),
      x1: Math.min(cena.largura - 1, Math.ceil(Math.max(...gxs)) + folga),
      y0: Math.max(0, Math.floor(Math.min(...gys)) - folga),
      y1: Math.min(cena.altura - 1, Math.ceil(Math.max(...gys)) + folga),
    };
  }

  /**
   * Losango pronto para um material, criado na primeira vez que aparece.
   *
   * São poucas imagens: uma por material e variação, não uma por tile. A
   * variação vem do ruído da posição, então o chão continua sem repetir carimbo.
   */
  #losangoDe(terreno, gx, gy) {
    let textura = null;
    let variante = null;

    if (!terreno.semTextura && this.acervo) {
      const indice = this.acervo.indiceDeChao(terreno.material, gx, gy);
      if (indice >= 0) {
        textura = this.acervo.texturaPorIndice(terreno.material, indice);
        if (textura) variante = `t${indice}`;
      }
    }
    if (!textura) {
      variante = `p${Math.floor(ruido(gx, gy, 909) * VARIACOES_PROCEDURAIS)}`;
    }

    const chave = `${terreno.id}:${variante}:${this.dpr}`;
    let losango = this.losangos.get(chave);
    if (!losango) {
      losango = this.#criarLosango(terreno, textura, variante);
      this.losangos.set(chave, losango);
    }
    return losango;
  }

  /** Pinta um único losango numa imagem pequena, com 1 px de folga em volta. */
  #criarLosango(terreno, textura, variante) {
    const escala = this.dpr;
    const largura = LARGURA_TILE + 2;
    const altura = ALTURA_TILE + 2;

    const lona = document.createElement('canvas');
    lona.width = Math.ceil(largura * escala);
    lona.height = Math.ceil(altura * escala);

    const ctx = lona.getContext('2d');
    ctx.setTransform(escala, 0, 0, escala, 0, 0);

    const x = largura / 2;
    const y = altura / 2;

    if (textura) {
      ctx.save();
      trilhaDiamante(ctx, x, y);
      ctx.clip();
      this.#pintarTextura(ctx, textura, x, y);
      ctx.restore();
      return lona;
    }

    // Cada variação procedural usa uma posição fictícia como semente, para as
    // tiles do mesmo material não saírem idênticas.
    const semente = Number(String(variante).slice(1)) || 0;
    pintarChao(ctx, terreno, x, y, semente * 13 + 1, semente * 7 + 3);
    return lona;
  }

  /** Descarta os losangos prontos. Usado quando uma textura nova chega. */
  esquecerLosangos() {
    this.losangos.clear();
  }

  /**
   * Projeta uma textura quadrada no losango da tile.
   *
   * A matriz manda o canto (0,0) da imagem para o vértice norte, o eixo x para
   * o vértice leste e o eixo y para o oeste. Com isso a textura acompanha os
   * eixos da grade e encaixa com as vizinhas sem emenda, qualquer que seja o
   * tamanho do arquivo.
   */
  #pintarTextura(ctx, img, x, y) {
    const larguraFonte = img.naturalWidth || img.width;
    const alturaFonte = img.naturalHeight || img.height;
    if (!larguraFonte || !alturaFonte) return false;

    ctx.save();
    ctx.transform(
      MEIA_LARGURA / larguraFonte,
      MEIA_ALTURA / larguraFonte,
      -MEIA_LARGURA / alturaFonte,
      MEIA_ALTURA / alturaFonte,
      x,
      y - MEIA_ALTURA,
    );
    // Meio pixel de sobra em cada lado evita fio de costura entre tiles.
    ctx.drawImage(img, -0.5, -0.5, larguraFonte + 1, alturaFonte + 1);
    ctx.restore();
    return true;
  }

  /**
   * Marca só as arestas onde o material muda — rua encontrando calçada, tapete
   * encontrando tábua. É o que dá recorte limpo sem transformar o piso em grade.
   */
  #desenharFronteiras(ctx, cena, faixa) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(8, 10, 14, 0.55)';
    ctx.beginPath();

    for (let gy = faixa.y0; gy <= faixa.y1; gy += 1) {
      for (let gx = faixa.x0; gx <= faixa.x1; gx += 1) {
        const terreno = cena.chao[gy][gx];
        if (!terreno) continue;
        const { x, y } = gradeParaMundo(gx, gy);

        for (const aresta of ARESTAS) {
          const vx = gx + aresta.vizinho[0];
          const vy = gy + aresta.vizinho[1];
          const outro = cena.dentro(vx, vy) ? cena.chao[vy][vx] : null;
          if (outro && outro.material === terreno.material) continue;
          ctx.moveTo(x + aresta.de[0], y + aresta.de[1]);
          ctx.lineTo(x + aresta.para[0], y + aresta.para[1]);
        }
      }
    }

    ctx.stroke();
  }

  /** Grade por cima do chão, para o editor ter referência de onde cada tile cai. */
  #desenharGrade(cena) {
    const ctx = this.ctx;
    const faixa = this.#faixaVisivel(cena);
    ctx.save();
    ctx.strokeStyle = 'rgba(216, 162, 74, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gy = faixa.y0; gy <= faixa.y1; gy += 1) {
      for (let gx = faixa.x0; gx <= faixa.x1; gx += 1) {
        const { x, y } = gradeParaMundo(gx, gy);
        ctx.moveTo(x, y - ALTURA_TILE / 2);
        ctx.lineTo(x + LARGURA_TILE / 2, y);
        ctx.moveTo(x, y - ALTURA_TILE / 2);
        ctx.lineTo(x - LARGURA_TILE / 2, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  #desenharDestaqueTile(cena, tile, tempo) {
    if (!cena.andavel(tile.gx, tile.gy)) return;
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(tile.gx, tile.gy);
    const pulso = 0.22 + Math.sin(tempo * 3) * 0.06;
    trilhaDiamante(ctx, x, y, 0.92);
    ctx.fillStyle = `rgba(216, 162, 74, ${pulso})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 200, 126, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  #desenharRota(detetive) {
    if (!detetive.rota.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(216, 162, 74, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    const inicio = gradeParaMundo(detetive.gx, detetive.gy);
    ctx.moveTo(inicio.x, inicio.y);
    for (const no of detetive.rota) {
      const p = gradeParaMundo(no.x, no.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Marca o destino final
    const fim = detetive.rota[detetive.rota.length - 1];
    const pf = gradeParaMundo(fim.x, fim.y);
    ctx.setLineDash([]);
    trilhaDiamante(ctx, pf.x, pf.y, 0.5);
    ctx.strokeStyle = 'rgba(240, 200, 126, 0.65)';
    ctx.stroke();
    ctx.restore();
  }

  // ---------- peças, vestígios e detetive ----------

  #desenharPecasEEntidades(jogo, alvoDestacado, tempo) {
    const cena = jogo.cenaAtual;
    const detetive = jogo.detetive;
    const fila = [];

    // Só o que cai na janela entra na fila. Numa cidade com milhares de peças,
    // montar e ordenar a fila inteira a cada quadro pesava tanto quanto desenhar
    // — e a imensa maioria estava fora da tela. A folga é generosa porque peça
    // alta (um telhado no nível 2) assenta vários tiles acima do próprio tile.
    const faixa = this.#faixaVisivel(cena);
    const vis = (gx, gy) =>
      gx >= faixa.x0 - 2 && gx <= faixa.x1 + 2 && gy >= faixa.y0 - 6 && gy <= faixa.y1 + 2;

    for (const peca of cena.pecas) {
      if (!vis(peca.gx, peca.gy)) continue;
      fila.push({ ordem: profundidade(peca.gx, peca.gy), desenhar: () => this.#desenharPeca(peca, alvoDestacado, tempo) });
    }

    // Passagens em lista não estão na matriz, então não entram por `cena.pecas`.
    for (const passagem of cena.passagens) {
      if (!vis(passagem.gx, passagem.gy)) continue;
      fila.push({
        ordem: profundidade(passagem.gx, passagem.gy) + 0.04,
        desenhar: () => {
          const { x, y } = gradeParaMundo(passagem.gx, passagem.gy);
          const destacada =
            alvoDestacado && alvoDestacado.gx === passagem.gx && alvoDestacado.gy === passagem.gy;
          this.#passagem(x, y, destacada, tempo);
        },
      });
    }

    for (const decoracao of cena.decoracoes) {
      if (!vis(decoracao.gx, decoracao.gy)) continue;
      fila.push({
        // O nível entra na ordem para a peça de cima cobrir a de baixo na mesma
        // coluna. O peso é pequeno de propósito: a profundidade da grade manda,
        // senão um telhado passaria na frente do que está mais perto da câmera.
        ordem: profundidade(decoracao.gx, decoracao.gy) + 0.05 + decoracao.nivel * 0.0005,
        desenhar: () => this.#desenharDecoracao(decoracao, alvoDestacado, tempo),
      });
    }

    if (this.mostrarMarcadores) {
      for (const ponto of cena.pontosDeVestigio) {
        const livre = cena.andavel(ponto.gx, ponto.gy);
        fila.push({
          ordem: profundidade(ponto.gx, ponto.gy) + 0.055,
          desenhar: () => this.#desenharMarcador(ponto, 'vestigio', livre),
        });
      }
      fila.push({
        ordem: profundidade(cena.inicio.gx, cena.inicio.gy) + 0.055,
        desenhar: () =>
          this.#desenharMarcador(cena.inicio, 'inicio', cena.andavel(cena.inicio.gx, cena.inicio.gy)),
      });
      for (const marca of cena.marcasPredio) {
        if (!vis(marca.gx, marca.gy)) continue;
        fila.push({
          ordem: profundidade(marca.gx, marca.gy) + 0.055,
          desenhar: () => this.#desenharMarcador(marca, 'predio', true),
        });
      }
    }

    if (this.previa) {
      const previa = this.previa;
      fila.push({
        ordem: profundidade(previa.gx, previa.gy) + 0.06 + (previa.nivel ?? 0) * 0.0005,
        desenhar: () => this.#desenharPrevia(previa),
      });
    }

    if (this.destaque) {
      const destaque = this.destaque;
      fila.push({
        ordem: profundidade(destaque.gx, destaque.gy) + 0.25 + destaque.nivel * 0.0005,
        desenhar: () => this.#desenharDestaquePeca(destaque, tempo),
      });
    }

    if (this.erro) {
      const erro = this.erro;
      // Por cima de tudo: é o único jeito de achar o tile num mapa grande.
      fila.push({
        ordem: profundidade(erro.gx, erro.gy) + 0.3,
        desenhar: () => this.#desenharErro(erro, tempo),
      });
    }

    for (const vestigio of jogo.vestigiosVisiveis()) {
      fila.push({
        ordem: profundidade(vestigio.gx, vestigio.gy) + 0.1,
        desenhar: () => this.#desenharVestigio(vestigio, alvoDestacado, tempo),
      });
    }

    // Multidão: entra na mesma fila por profundidade, para o povo passar atrás
    // e na frente dos prédios certo. Só a cena que tem povo (a cidade) desenha.
    if (this.povo && this.povo.cidade === cena) {
      for (const npc of this.povo.npcs) {
        if (npc.dentro) continue; // dentro de um prédio: invisível até sair
        if (!vis(npc.gx, npc.gy)) continue;
        // Corpo caído fica no chão (ordem baixa); quem anda, na profundidade normal.
        const ordem = profundidade(npc.gx, npc.gy) + (npc.morto ? 0.02 : 0.18);
        fila.push({ ordem, desenhar: () => this.#desenharNpc(npc, tempo) });
      }
    }

    if (this.mostrarDetetive) {
      fila.push({
        ordem: profundidade(detetive.gx, detetive.gy) + 0.2,
        desenhar: () => this.#desenharDetetive(detetive),
      });
    }

    fila.sort((a, b) => a.ordem - b.ordem);
    for (const item of fila) item.desenhar();
  }

  #desenharPeca(peca, alvoDestacado, tempo) {
    const { gx, gy, def } = peca;
    const { x, y } = gradeParaMundo(gx, gy);
    const destacada = alvoDestacado && alvoDestacado.gx === gx && alvoDestacado.gy === gy;

    // Sprite substitui a forma geométrica, mas só em peça sem interação: o
    // brilho de uma pasta ou de uma passagem é o que avisa que ali se clica, e
    // isso é informação de jogo, não enfeite.
    const sprite = def.interacao ? null : this.acervo?.spriteDePeca(def.id);
    if (sprite) {
      this.#pecaComSprite(x, y, sprite);
      if (def.luz) this.#brilhoQuente(x, y, tempo);
      if (destacada) this.#aroDestaque(x, y, tempo);
      return;
    }

    switch (def.forma) {
      case 'parede':
        this.#bloco(x, y, def.altura, '#474c57', '#333843', '#23272f', 1);
        break;
      case 'porta':
        this.#porta(x, y, def.altura);
        break;
      case 'caixa':
        this.#sombra(x, y, def.escala ?? 0.9);
        this.#bloco(x, y, def.altura, def.topo, def.lado, this.#escurecer(def.lado), def.escala ?? 0.9);
        break;
      case 'planta':
        this.#planta(x, y);
        break;
      case 'arvore':
        this.#arvore(x, y, gx, gy);
        break;
      case 'luminaria':
        this.#luminaria(x, y, tempo);
        break;
      case 'contorno':
        this.#contorno(x, y, destacada, tempo);
        break;
      case 'pasta':
        this.#pasta(x, y, destacada, tempo);
        break;
      case 'jornal':
        this.#jornal(x, y, destacada, tempo);
        break;
      case 'passagem':
        this.#passagem(x, y, destacada, tempo);
        break;
      case 'registro':
        this.#registro(x, y, destacada, tempo);
        break;
      default:
        break;
    }

    const proprias = ['contorno', 'pasta', 'jornal', 'passagem'];
    if (destacada && def.forma && !proprias.includes(def.forma)) {
      this.#aroDestaque(x, y, tempo);
    }
  }

  /**
   * Peça solta da camada de decoração. Pede a imagem ao acervo, que a carrega
   * no primeiro pedido — por isso ela aparece no quadro seguinte à chegada.
   */
  #desenharDecoracao(decoracao, alvoDestacado, tempo) {
    const { x, y } = gradeParaMundo(decoracao.gx, decoracao.gy);
    const sprite = this.acervo?.spriteDePeca(decoracao.peca);
    const subida = decoracao.nivel * ALTURA_NIVEL;

    if (!sprite) {
      // Enquanto a imagem não chega, marca o lugar para a cena não "piscar".
      const ctx = this.ctx;
      trilhaDiamante(ctx, x, y - subida, 0.8);
      ctx.strokeStyle = 'rgba(216, 162, 74, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    this.#pecaComSprite(x, y, sprite, subida);
    if (alvoDestacado && alvoDestacado.gx === decoracao.gx && alvoDestacado.gy === decoracao.gy) {
      this.#aroDestaque(x, y, tempo);
    }
  }

  /**
   * Contorna a peça apontada e escreve o nome dela ao lado.
   *
   * O halo sai do próprio recorte do sprite, via `drop-shadow`, para o contorno
   * acompanhar a silhueta e não uma caixa em volta — numa peça isométrica a
   * caixa cobriria os vizinhos e não diria qual é qual. Onde o filtro não
   * existir, sobram o losango da base e o rótulo, que já identificam a peça.
   */
  #desenharDestaquePeca(destaque, tempo) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(destaque.gx, destaque.gy);
    const subida = (destaque.nivel ?? 0) * ALTURA_NIVEL;
    const pulso = 0.6 + Math.sin(tempo * 5) * 0.25;
    const sprite = this.acervo?.spriteDePeca(destaque.peca);

    ctx.save();

    // Losango no chão, na coluna da peça.
    trilhaDiamante(ctx, x, y, 0.9);
    ctx.strokeStyle = `rgba(126, 220, 255, ${0.5 + pulso * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    let topo = y - subida;

    if (sprite) {
      const larguraFonte = sprite.img.naturalWidth || sprite.img.width;
      const alturaFonte = sprite.img.naturalHeight || sprite.img.height;
      if (larguraFonte && alturaFonte) {
        const largura = LARGURA_TILE * sprite.escala;
        const altura = (alturaFonte / larguraFonte) * largura;
        const px = x - largura / 2;
        const py = y - subida - altura * sprite.ancora;

        if ('filter' in ctx) {
          const cor = `rgba(126, 220, 255, ${0.85 * pulso + 0.15})`;
          ctx.filter = `drop-shadow(0 0 2px ${cor}) drop-shadow(0 0 5px ${cor})`;
          ctx.drawImage(sprite.img, px, py, largura, altura);
          ctx.filter = 'none';
        }
        // Redesenha a peça limpa por cima: o halo fica só na borda.
        ctx.drawImage(sprite.img, px, py, largura, altura);
        topo = py;
      }
    }

    if (destaque.rotulo) {
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const largura = ctx.measureText(destaque.rotulo).width + 10;
      const alturaCaixa = 17;
      const cy = topo - 8;
      ctx.fillStyle = 'rgba(8, 14, 20, 0.85)';
      ctx.fillRect(x - largura / 2, cy - alturaCaixa, largura, alturaCaixa);
      ctx.strokeStyle = 'rgba(126, 220, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - largura / 2, cy - alturaCaixa, largura, alturaCaixa);
      ctx.fillStyle = '#b9e8ff';
      ctx.fillText(destaque.rotulo, x, cy - 5);
    }

    ctx.restore();
  }

  /** Cerca vermelha pulsando no tile que reprovou, com uma haste para achá-lo. */
  #desenharErro(erro, tempo) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(erro.gx, erro.gy);
    const pulso = 0.55 + Math.sin(tempo * 4) * 0.3;

    ctx.save();
    trilhaDiamante(ctx, x, y, 1);
    ctx.fillStyle = `rgba(228, 72, 62, ${0.18 + pulso * 0.14})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 120, 108, ${0.65 + pulso * 0.35})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Haste vertical: num mapa afastado, o losango sozinho se perde.
    ctx.strokeStyle = `rgba(255, 120, 108, ${0.4 + pulso * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 90);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(255, 140, 128, ${0.75 + pulso * 0.25})`;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${erro.gx},${erro.gy}`, x, y - 96);
    ctx.restore();
  }

  /**
   * Marcador de edição: ponto de vestígio ou ponto de partida.
   *
   * Vermelho quando o tile está bloqueado, porque é exatamente esse o caso que
   * reprova o mapa na validação — e ver o problema vale mais que ler a
   * coordenada dele numa mensagem.
   */
  #desenharMarcador(ponto, tipo, livre) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(ponto.gx, ponto.gy);
    const corPorTipo = {
      inicio: 'rgba(126, 200, 240, 0.95)',
      vestigio: 'rgba(216, 162, 74, 0.95)',
      predio: 'rgba(150, 230, 150, 0.95)',
    };
    const letra = { inicio: 'X', vestigio: '*', predio: 'P' }[tipo] ?? '?';
    const cor = livre ? corPorTipo[tipo] ?? 'rgba(216,162,74,0.95)' : 'rgba(228, 96, 86, 0.95)';

    ctx.save();
    trilhaDiamante(ctx, x, y, 0.62);
    ctx.fillStyle = livre ? 'rgba(10, 12, 16, 0.45)' : 'rgba(80, 20, 18, 0.55)';
    ctx.fill();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(livre ? [] : [4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = cor;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letra, x, y + (tipo === 'inicio' ? 0 : 2));
    ctx.restore();
  }

  /**
   * Fantasma da peça sob o cursor, com a haste que liga ao chão.
   *
   * A haste e o losango na base existem porque, com a peça levantada, só a
   * imagem no ar não diz em que tile ela vai cair.
   */
  #desenharPrevia(previa) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(previa.gx, previa.gy);
    const subida = (previa.nivel ?? 0) * ALTURA_NIVEL;
    const sprite = previa.peca ? this.acervo?.spriteDePeca(previa.peca) : null;

    ctx.save();

    // Base: onde a peça vai assentar, sempre visível.
    trilhaDiamante(ctx, x, y, 0.92);
    ctx.fillStyle = 'rgba(216, 162, 74, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 200, 126, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Material de chão: mostra o losango já pintado, para dar para comparar com
    // o vizinho antes de pintar.
    if (previa.terreno) {
      const losango = this.#losangoDe(previa.terreno, previa.gx, previa.gy);
      if (losango) {
        ctx.globalAlpha = 0.72;
        ctx.drawImage(
          losango,
          x - MEIA_LARGURA - 1,
          y - MEIA_ALTURA - 1,
          LARGURA_TILE + 2,
          ALTURA_TILE + 2,
        );
        ctx.globalAlpha = 1;
      }
    }

    // Peça da matriz: mostra o volume, não só o tile. Pôr uma parede sem ver a
    // altura dela era adivinhação — colocava, olhava, apagava e tentava de novo.
    if (previa.def) {
      ctx.globalAlpha = 0.5;
      ctx.translate(0, -subida);
      this.#desenharPeca({ gx: previa.gx, gy: previa.gy, def: previa.def }, null, 0);
      ctx.translate(0, subida);
      ctx.globalAlpha = 1;
    }

    if (subida > 0) {
      ctx.strokeStyle = 'rgba(240, 200, 126, 0.5)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - subida);
      ctx.stroke();
      ctx.setLineDash([]);
      trilhaDiamante(ctx, x, y - subida, 0.92);
      ctx.strokeStyle = 'rgba(240, 200, 126, 0.65)';
      ctx.stroke();
    }

    if (sprite) {
      ctx.globalAlpha = 0.55;
      const larguraFonte = sprite.img.naturalWidth || sprite.img.width;
      const alturaFonte = sprite.img.naturalHeight || sprite.img.height;
      if (larguraFonte && alturaFonte) {
        const largura = LARGURA_TILE * sprite.escala;
        const altura = (alturaFonte / larguraFonte) * largura;
        ctx.drawImage(
          sprite.img,
          x - largura / 2,
          y - subida - altura * sprite.ancora,
          largura,
          altura,
        );
      }
    }

    ctx.restore();
  }

  /**
   * Desenha uma peça a partir de sprite.
   *
   * `escala` converte a moldura do sprite em tiles e `ancora` diz que fração da
   * altura fica acima do centro da tile. Os dois vêm da medição do acervo e são
   * iguais para todo sprite da mesma moldura — é isso que faz peça encostar em
   * peça sem emenda nem sobreposição. Ver `tools/medir-sprites.mjs`.
   *
   * `subida` levanta a peça sem mover a sombra: a sombra fica no chão, que é o
   * que dá a leitura de "isto está no ar".
   */
  #pecaComSprite(x, y, sprite, subida = 0) {
    const ctx = this.ctx;
    const larguraFonte = sprite.img.naturalWidth || sprite.img.width;
    const alturaFonte = sprite.img.naturalHeight || sprite.img.height;
    if (!larguraFonte || !alturaFonte) return;

    const largura = LARGURA_TILE * sprite.escala;
    const altura = (alturaFonte / larguraFonte) * largura;

    this.#sombra(x, y, 0.8);
    ctx.drawImage(
      sprite.img,
      x - largura / 2,
      y - subida - altura * sprite.ancora,
      largura,
      altura,
    );
  }

  /** Halo quente de fonte de luz, usado por cima de sprite de luminária. */
  #brilhoQuente(x, y, tempo) {
    const ctx = this.ctx;
    const tremor = 0.9 + Math.sin(tempo * 2.3) * 0.08;
    const brilho = ctx.createRadialGradient(x, y - 44, 2, x, y - 44, 48);
    brilho.addColorStop(0, `rgba(240, 200, 126, ${0.42 * tremor})`);
    brilho.addColorStop(1, 'rgba(240, 200, 126, 0)');
    ctx.fillStyle = brilho;
    ctx.beginPath();
    ctx.arc(x, y - 44, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Bloco extrudado: duas faces laterais e um topo em losango. */
  #bloco(x, y, altura, corTopo, corEsquerda, corDireita, escala) {
    const ctx = this.ctx;
    const lx = MEIA_LARGURA * escala;
    const ly = MEIA_ALTURA * escala;

    ctx.beginPath();
    ctx.moveTo(x - lx, y);
    ctx.lineTo(x, y + ly);
    ctx.lineTo(x, y + ly - altura);
    ctx.lineTo(x - lx, y - altura);
    ctx.closePath();
    ctx.fillStyle = corEsquerda;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + lx, y);
    ctx.lineTo(x, y + ly);
    ctx.lineTo(x, y + ly - altura);
    ctx.lineTo(x + lx, y - altura);
    ctx.closePath();
    ctx.fillStyle = corDireita;
    ctx.fill();

    trilhaDiamante(ctx, x, y - altura, escala);
    ctx.fillStyle = corTopo;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  #porta(x, y, altura) {
    const ctx = this.ctx;
    // Batentes laterais, deixando o vão livre.
    this.#bloco(x, y, altura, '#474c57', '#333843', '#23272f', 0.26);
    ctx.save();
    ctx.globalAlpha = 0.5;
    trilhaDiamante(ctx, x, y, 0.9);
    ctx.fillStyle = '#1a1f28';
    ctx.fill();
    ctx.restore();
  }

  #sombra(x, y, escala) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.35;
    trilhaDiamante(ctx, x, y + 2, escala);
    ctx.fillStyle = '#05070a';
    ctx.fill();
    ctx.restore();
  }

  #planta(x, y) {
    const ctx = this.ctx;
    this.#sombra(x, y, 0.55);
    this.#bloco(x, y, 12, '#3a2b20', '#2b2017', '#201810', 0.5);
    ctx.save();
    ctx.translate(x, y - 12);
    ctx.fillStyle = '#2d4a33';
    for (let i = 0; i < 5; i += 1) {
      const angulo = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angulo) * 7, Math.sin(angulo) * 3 - 9, 9, 5, angulo, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3a6142';
    ctx.beginPath();
    ctx.ellipse(0, -14, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  #luminaria(x, y, tempo) {
    const ctx = this.ctx;
    this.#sombra(x, y, 0.4);
    ctx.save();
    ctx.translate(x, y);
    // Haste
    ctx.strokeStyle = '#2d3138';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -46);
    ctx.stroke();
    // Cúpula
    const tremor = 0.9 + Math.sin(tempo * 2.3) * 0.08;
    ctx.beginPath();
    ctx.moveTo(-15, -46);
    ctx.lineTo(15, -46);
    ctx.lineTo(9, -62);
    ctx.lineTo(-9, -62);
    ctx.closePath();
    ctx.fillStyle = '#4a3a24';
    ctx.fill();
    // Brilho
    const brilho = ctx.createRadialGradient(0, -44, 2, 0, -44, 46);
    brilho.addColorStop(0, `rgba(240, 200, 126, ${0.5 * tremor})`);
    brilho.addColorStop(1, 'rgba(240, 200, 126, 0)');
    ctx.fillStyle = brilho;
    ctx.beginPath();
    ctx.arc(0, -44, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * A cena do crime: a vítima caída, uma poça de sangue e o giz da perícia por
   * cima. A poça e o corpo dão a leitura imediata de "há um corpo aqui"; o giz,
   * de que a perícia já passou.
   */
  #contorno(x, y, destacada, tempo) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Poça de sangue.
    ctx.fillStyle = 'rgba(90, 10, 12, 0.65)';
    ctx.beginPath();
    ctx.ellipse(4, 5, 28, 15, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(140, 18, 20, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-12, 1, 11, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Corpo deitado (a vítima). Roupão vinho, como diz o laudo do caso.
    this.#figuraDeitada(0, 0, {
      roupa: '#5a2130',
      calca: '#3a2028',
      pele: '#cdac8c',
      cabelo: '#b8b2a6',
    });

    // Marcação de giz por cima.
    ctx.strokeStyle = destacada ? 'rgba(240, 220, 200, 0.95)' : 'rgba(226, 214, 198, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 14, 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-18, -5, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (destacada) this.#aroDestaque(x, y, tempo);
  }

  /**
   * Bonequinho deitado (morto), centrado na origem do contexto atual. Usado
   * tanto pelo contorno da cena do crime quanto pelo corpo de um NPC.
   */
  #figuraDeitada(cx, cy, paleta) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);

    // Tronco deitado.
    ctx.fillStyle = paleta.roupa ?? '#5a2130';
    ctx.beginPath();
    ctx.ellipse(0, -2, 15, 7, 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Pernas.
    ctx.fillStyle = paleta.calca ?? '#3a2028';
    ctx.beginPath();
    ctx.ellipse(13, 1, 9, 4.5, 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Braço largado.
    ctx.strokeStyle = paleta.roupa ?? '#5a2130';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(6, -12);
    ctx.stroke();
    // Cabeça.
    ctx.fillStyle = paleta.pele ?? '#cdac8c';
    ctx.beginPath();
    ctx.arc(-16, -5, 5.2, 0, Math.PI * 2);
    ctx.fill();
    // Cabelo.
    ctx.fillStyle = paleta.cabelo ?? '#b8b2a6';
    ctx.beginPath();
    ctx.arc(-17, -6.5, 5.2, Math.PI * 0.55, Math.PI * 1.85);
    ctx.fill();

    ctx.restore();
  }

  #pasta(x, y, destacada, tempo) {
    const ctx = this.ctx;
    this.#sombra(x, y, 0.42);
    ctx.save();
    ctx.translate(x, y - 3);
    ctx.fillStyle = destacada ? '#c9a86a' : '#9d8552';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(0, -7);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(40, 32, 18, 0.65)';
    ctx.fillRect(-5, -3, 10, 2);
    ctx.restore();
    if (destacada) this.#aroDestaque(x, y, tempo);
  }

  /**
   * Árvore de rua. Três silhuetas diferentes, escolhidas pela posição, para a
   * fileira da praça não parecer o mesmo carimbo repetido. A copa é feita de
   * elipses sobrepostas com tons distintos, o que dá volume sem textura.
   */
  #arvore(x, y, gx, gy) {
    const ctx = this.ctx;
    const tipo = Math.floor(ruido(gx, gy, 21) * 3);
    const inclinacao = (ruido(gx, gy, 22) - 0.5) * 4;
    const alturaTronco = 24 + ruido(gx, gy, 23) * 10;

    this.#sombra(x, y, 0.66);

    ctx.save();
    ctx.translate(x, y);

    // Tronco levemente torto, com a base mais grossa.
    ctx.strokeStyle = '#2b2118';
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(inclinacao * 0.5, -alturaTronco * 0.6, inclinacao, -alturaTronco);
    ctx.stroke();
    ctx.strokeStyle = '#3a2d20';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1, -2);
    ctx.quadraticCurveTo(inclinacao * 0.5 - 1, -alturaTronco * 0.6, inclinacao - 1, -alturaTronco);
    ctx.stroke();

    const copaY = -alturaTronco - 8;
    const camadas =
      tipo === 0
        ? [
            // Copa larga e baixa
            { dx: 0, dy: copaY + 4, rx: 21, ry: 13, cor: '#1b2a1f' },
            { dx: -6, dy: copaY - 4, rx: 15, ry: 11, cor: '#233726' },
            { dx: 7, dy: copaY - 2, rx: 13, ry: 10, cor: '#1f3123' },
            { dx: 0, dy: copaY - 11, rx: 11, ry: 8, cor: '#2a4030' },
          ]
        : tipo === 1
          ? [
              // Copa alta e estreita
              { dx: 0, dy: copaY + 2, rx: 13, ry: 11, cor: '#1b2a1f' },
              { dx: 2, dy: copaY - 9, rx: 11, ry: 10, cor: '#233726' },
              { dx: -2, dy: copaY - 18, rx: 9, ry: 8, cor: '#2a4030' },
            ]
          : [
              // Copa rala, deixando o tronco aparecer
              { dx: -8, dy: copaY, rx: 11, ry: 8, cor: '#1e3022' },
              { dx: 8, dy: copaY - 3, rx: 10, ry: 7, cor: '#263b2a' },
              { dx: 0, dy: copaY - 10, rx: 12, ry: 8, cor: '#223424' },
            ];

    for (const camada of camadas) {
      ctx.fillStyle = camada.cor;
      ctx.beginPath();
      ctx.ellipse(camada.dx + inclinacao, camada.dy, camada.rx, camada.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Banca de jornal: caixa baixa com a folha aberta em cima. */
  #jornal(x, y, destacada, tempo) {
    const ctx = this.ctx;
    this.#sombra(x, y, 0.62);
    this.#bloco(x, y, 20, '#2f3540', '#242932', '#1c2028', 0.68);
    ctx.save();
    ctx.translate(x, y - 20);
    ctx.fillStyle = destacada ? '#efe6d2' : '#cdc4b2';
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 54, 42, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();
    if (destacada) this.#aroDestaque(x, y, tempo);
  }

  /** Mesa de registro: escrivaninha baixa com papel e tinteiro em cima. */
  #registro(x, y, destacada, tempo) {
    const ctx = this.ctx;
    this.#sombra(x, y, 0.9);
    this.#bloco(x, y, 18, '#3c2d1c', '#2b2014', '#1f170e', 0.9);

    ctx.save();
    ctx.translate(x, y - 18);
    // Folha de termo sobre a mesa
    ctx.fillStyle = destacada ? '#f3ead4' : '#d6ccb4';
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(0, -5);
    ctx.lineTo(11, 0);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 60, 44, 0.65)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i += 2) {
      ctx.beginPath();
      ctx.moveTo(-5, i);
      ctx.lineTo(5, i);
      ctx.stroke();
    }
    // Tinteiro
    ctx.fillStyle = '#1b1f26';
    ctx.beginPath();
    ctx.ellipse(9, -3, 3.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (destacada) this.#aroDestaque(x, y, tempo);
  }

  /** Passagem entre locais: vão iluminado na fachada, com seta de entrada. */
  #passagem(x, y, destacada, tempo) {
    const ctx = this.ctx;
    const pulso = 0.4 + Math.sin(tempo * 2.2) * 0.12;

    // Luz derramando do vão no chão
    const brilho = ctx.createRadialGradient(x, y, 2, x, y, 44);
    brilho.addColorStop(0, `rgba(240, 200, 126, ${0.36 * pulso + 0.14})`);
    brilho.addColorStop(1, 'rgba(240, 200, 126, 0)');
    ctx.fillStyle = brilho;
    ctx.beginPath();
    ctx.ellipse(x, y, 44, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    trilhaDiamante(ctx, x, y, 0.9);
    ctx.fillStyle = `rgba(240, 200, 126, ${0.2 + pulso * 0.14})`;
    ctx.fill();
    ctx.strokeStyle = destacada ? 'rgba(255, 228, 170, 0.95)' : 'rgba(216, 162, 74, 0.75)';
    ctx.lineWidth = destacada ? 2.2 : 1.5;
    ctx.stroke();

    // Vão escuro recuado, dando a leitura de porta aberta
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#15110c';
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(0, -10);
    ctx.lineTo(13, -4);
    ctx.lineTo(13, -34);
    ctx.lineTo(0, -40);
    ctx.lineTo(-13, -34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(216, 162, 74, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Seta indicando que ali se entra
    ctx.strokeStyle = destacada ? '#ffe4aa' : 'rgba(240, 200, 126, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.lineTo(0, -24);
    ctx.lineTo(5, -18);
    ctx.stroke();
    ctx.restore();
  }

  #desenharVestigio(vestigio, alvoDestacado, tempo) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(vestigio.gx, vestigio.gy);
    const destacado = alvoDestacado && alvoDestacado.gx === vestigio.gx && alvoDestacado.gy === vestigio.gy;
    const flutuar = Math.sin(tempo * 2.2 + vestigio.gx) * 2.5;

    // Halo no chão
    const halo = ctx.createRadialGradient(x, y, 1, x, y, 30);
    halo.addColorStop(0, 'rgba(216, 162, 74, 0.34)');
    halo.addColorStop(1, 'rgba(216, 162, 74, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y - 12 + flutuar);
    ctx.rotate(Math.PI / 4);
    const lado = destacado ? 9 : 7;
    ctx.fillStyle = destacado ? '#f6dca6' : '#d8a24a';
    ctx.fillRect(-lado / 2, -lado / 2, lado, lado);
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-lado / 2, -lado / 2, lado, lado);
    ctx.restore();

    if (destacado) this.#aroDestaque(x, y, tempo);
  }

  #aroDestaque(x, y, tempo) {
    const ctx = this.ctx;
    const escala = 0.95 + Math.sin(tempo * 4) * 0.05;
    trilhaDiamante(ctx, x, y, escala);
    ctx.strokeStyle = 'rgba(240, 200, 126, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * As vistas disponíveis, cada uma com o rumo que representa na tela.
   *
   * A prancha só traz três vistas: de frente, três-quartos e três-quartos de
   * costas. Espelhando na horizontal saem outras duas, porque espelhar reflete
   * o rumo em torno da vertical — `θ` vira `180 − θ`. Dá cinco rumos para oito
   * direções de grade, então as três que faltam (lados puros e costas retas)
   * usam a vista mais próxima. É uma folga de 45°, que a essa escala não se lê.
   *
   * Ângulos em graus de tela: 0 à direita, 90 para baixo, crescendo no sentido
   * horário. 90 é "de frente para a câmera".
   */
  #vistasDoDetetive() {
    if (this.vistasCache) return this.vistasCache;
    const vistas = [];
    for (const vista of DETETIVE.vistas) {
      vistas.push({ ...vista, rumo: 90 + vista.giro, espelhar: false });
      const espelhado = 90 - vista.giro;
      // Vista de frente espelhada é ela mesma: não vale duplicar.
      if (((espelhado - (90 + vista.giro)) % 360 + 360) % 360 !== 0) {
        vistas.push({ ...vista, rumo: espelhado, espelhar: true });
      }
    }
    this.vistasCache = vistas;
    return vistas;
  }

  /** Diferença angular absoluta entre dois ângulos em graus, de 0 a 180. */
  #distanciaAngular(a, b) {
    const d = Math.abs(((a - b) % 360 + 360) % 360);
    return d > 180 ? 360 - d : d;
  }

  /**
   * Desenha o detetive com o sprite recortado da prancha.
   *
   * Devolve `false` quando a imagem ainda não chegou, e aí o chamador cai na
   * figura geométrica. Essa queda não é só defensiva: é o que permitiu adotar a
   * arte sem nenhum momento de jogo quebrado, e é o que mantém o jogo inteiro
   * funcionando se o arquivo faltar.
   */
  #desenharDetetiveSprite(detetive, x, y) {
    const img = this.acervo?.garantirArquivo(DETETIVE.arquivo);
    if (!img) return false;

    const { largura: celulaL, altura: celulaA } = DETETIVE.celula;

    // Rumo na tela: a grade é ortogonal, o desenho é isométrico, então a direção
    // precisa passar pela projeção antes de virar ângulo de tela.
    const dx = detetive.olhandoX ?? 0;
    const dy = detetive.olhandoY ?? 1;
    const telaX = dx - dy;
    const telaY = (dx + dy) * (ALTURA_TILE / LARGURA_TILE);
    const rumo =
      telaX === 0 && telaY === 0 ? 90 : (Math.atan2(telaY, telaX) * 180) / Math.PI;

    let melhor = null;
    let menor = Infinity;
    for (const vista of this.#vistasDoDetetive()) {
      const d = this.#distanciaAngular(rumo, vista.rumo);
      if (d < menor) {
        menor = d;
        melhor = vista;
      }
    }

    // Parado mostra sempre o primeiro quadro; andando percorre o ciclo.
    const quadro = detetive.andando
      ? Math.floor(detetive.fase * 1.2) % melhor.quadros
      : 0;

    const escala = DETETIVE.alturaAlvo / celulaA;
    const larguraDestino = celulaL * escala;
    const alturaDestino = celulaA * escala;

    const ctx = this.ctx;
    this.#sombra(x, y, 0.5);

    ctx.save();
    ctx.translate(x, y - alturaDestino * DETETIVE.ancora);
    if (melhor.espelhar) ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      quadro * celulaL,
      melhor.linha * celulaA,
      celulaL,
      celulaA,
      -larguraDestino / 2,
      0,
      larguraDestino,
      alturaDestino,
    );
    ctx.restore();
    return true;
  }

  /** Figura original: silhueta de sobretudo e chapéu, montada com primitivas. */
  #desenharDetetive(detetive) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(detetive.gx, detetive.gy);
    if (this.#desenharDetetiveSprite(detetive, x, y)) return;
    const passo = detetive.andando ? Math.sin(detetive.fase) : 0;
    const balanco = detetive.andando ? Math.abs(Math.sin(detetive.fase)) * 2 : 0;
    const paraEsquerda = detetive.olhandoX < 0;

    // Sombra
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#04060a';
    ctx.beginPath();
    ctx.ellipse(x, y, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - balanco);
    if (paraEsquerda) ctx.scale(-1, 1);

    // Pernas
    ctx.strokeStyle = '#1b2029';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -14);
    ctx.lineTo(-3 + passo * 4, -2);
    ctx.moveTo(1, -14);
    ctx.lineTo(3 - passo * 4, -2);
    ctx.stroke();

    // Sobretudo
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.lineTo(-6, -40);
    ctx.lineTo(6, -40);
    ctx.lineTo(8, -16);
    ctx.quadraticCurveTo(0, -12, -8, -16);
    ctx.closePath();
    ctx.fillStyle = '#2e3744';
    ctx.fill();
    ctx.strokeStyle = '#1a1f28';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Lapela e cinto
    ctx.strokeStyle = '#3c4858';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(0, -20);
    ctx.stroke();
    ctx.fillStyle = '#20262f';
    ctx.fillRect(-7, -26, 14, 3);

    // Braço
    ctx.strokeStyle = '#2a323d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5, -37);
    ctx.lineTo(8 + passo * 2, -24);
    ctx.stroke();

    // Cabeça
    ctx.fillStyle = '#b89a7e';
    ctx.beginPath();
    ctx.arc(0, -45, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Chapéu
    ctx.fillStyle = '#242b35';
    ctx.beginPath();
    ctx.ellipse(0, -48, 10, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5.5, -48);
    ctx.lineTo(-4.5, -55);
    ctx.lineTo(4.5, -55);
    ctx.lineTo(5.5, -48);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Transeunte procedural, com paleta sorteada. Mesma linguagem visual do
   * detetive, mas mais baixo e sem o sobretudo marcante — para o detetive
   * continuar sendo o único de chapéu-coco e casaco longo. Quando `npc.morto`,
   * desenha o corpo caído com uma poça de sangue no lugar da figura em pé.
   */
  #desenharNpc(npc, tempo) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(npc.gx, npc.gy);

    if (npc.morto) {
      this.#desenharCorpoCaido(x, y, npc, tempo);
      return;
    }

    const p = npc.paleta;
    const esc = p.altura ?? 1;
    const passo = npc.andando ? Math.sin(npc.fase) : 0;
    const balanco = npc.andando ? Math.abs(Math.sin(npc.fase)) * 1.6 : 0;
    const paraEsquerda = npc.olhandoX < 0;

    // Sombra
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#04060a';
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - balanco);
    ctx.scale(esc, esc);
    if (paraEsquerda) ctx.scale(-1, 1);

    // Pernas (calça)
    ctx.strokeStyle = p.calca;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -12);
    ctx.lineTo(-3 + passo * 4, -1);
    ctx.moveTo(1, -12);
    ctx.lineTo(3 - passo * 4, -1);
    ctx.stroke();

    // Tronco (roupa)
    ctx.fillStyle = p.roupa;
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(-5, -32);
    ctx.lineTo(5, -32);
    ctx.lineTo(6, -13);
    ctx.quadraticCurveTo(0, -10, -6, -13);
    ctx.closePath();
    ctx.fill();

    // Braço
    ctx.strokeStyle = p.roupa;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(4, -30);
    ctx.lineTo(6 + passo * 2, -18);
    ctx.stroke();

    // Cabeça (pele)
    ctx.fillStyle = p.pele;
    ctx.beginPath();
    ctx.arc(0, -36, 5, 0, Math.PI * 2);
    ctx.fill();

    // Cabelo
    ctx.fillStyle = p.cabelo;
    ctx.beginPath();
    ctx.arc(0, -37.5, 5, Math.PI, Math.PI * 2);
    ctx.fill();

    // Chapéu, se tiver
    if (p.chapeu) {
      ctx.fillStyle = p.chapeu;
      ctx.beginPath();
      ctx.ellipse(0, -40, 8, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -42, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Rótulo flutuante só para personagens (suspeitos / vítima), discreto.
    if (npc.papel === 'personagem' && npc.nome) {
      this.#etiquetaNpc(x, y - 48 * esc, npc.nome);
    }
  }

  /** Nome pequeno acima de um personagem, para o jogador reconhecer quem é. */
  #etiquetaNpc(x, y, texto) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const largura = ctx.measureText(texto).width + 8;
    ctx.fillStyle = 'rgba(8, 12, 18, 0.7)';
    ctx.fillRect(x - largura / 2, y - 11, largura, 13);
    ctx.fillStyle = 'rgba(226, 214, 198, 0.9)';
    ctx.fillText(texto, x, y - 1);
    ctx.restore();
  }

  /** Corpo caído de um NPC com poça de sangue — reusa a figura deitada. */
  #desenharCorpoCaido(x, y, npc, tempo) {
    const ctx = this.ctx;
    const brilho = 0.5 + Math.sin(tempo * 2) * 0.06;

    ctx.save();
    ctx.translate(x, y);
    // Poça de sangue.
    ctx.fillStyle = 'rgba(96, 10, 12, 0.72)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 22, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(150, 20, 22, ${brilho})`;
    ctx.beginPath();
    ctx.ellipse(-3, 1, 11, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.#figuraDeitada(x, y, npc.paleta ?? {});
  }

  // ---------- luz e clima ----------

  #desenharLuz(cena, detetive, deslocamento) {
    const ctx = this.ctx;
    const foco = gradeParaMundo(detetive.gx, detetive.gy);
    const centro = { x: foco.x + deslocamento.x, y: foco.y + deslocamento.y - 20 };

    // Escurece o que está longe do detetive, preservando o entorno imediato.
    const escuro = ctx.createRadialGradient(centro.x, centro.y, 60, centro.x, centro.y, 460);
    escuro.addColorStop(0, 'rgba(5, 7, 12, 0)');
    escuro.addColorStop(0.55, 'rgba(5, 7, 12, 0.28)');
    escuro.addColorStop(1, 'rgba(4, 6, 10, 0.72)');
    ctx.fillStyle = escuro;
    ctx.fillRect(0, 0, this.largura, this.altura);

    // Vinheta nas bordas da tela
    const vinheta = ctx.createRadialGradient(
      this.largura / 2,
      this.altura / 2,
      Math.min(this.largura, this.altura) * 0.35,
      this.largura / 2,
      this.altura / 2,
      Math.max(this.largura, this.altura) * 0.78,
    );
    vinheta.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vinheta.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vinheta;
    ctx.fillRect(0, 0, this.largura, this.altura);
  }

  #escurecer(cor) {
    // Aceita apenas #rrggbb; devolve uma versão mais escura para a face oposta.
    if (!/^#[0-9a-f]{6}$/i.test(cor)) return cor;
    const n = parseInt(cor.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) - 22);
    const g = Math.max(0, ((n >> 8) & 255) - 22);
    const b = Math.max(0, (n & 255) - 22);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
