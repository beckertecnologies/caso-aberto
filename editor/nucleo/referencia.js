// Imagem de referência — o "papel manteiga" do editor.
//
// Mostra uma imagem semitransparente POR BAIXO do mapa, para desenhar as ruas
// por cima dela. A imagem é posicionada, escalada e rotacionada livremente, e
// pode ser ligada/desligada sem perder o ajuste. A posição é guardada no
// navegador, então sobrevive a recarregar a página.
//
// Vive numa camada de DOM própria (um <canvas> atrás do canvas do mapa), não no
// render do jogo: é andaime de edição, não faz parte da cena, e nada dela vai
// para o arquivo salvo.

const CHAVE = 'caso-aberto:referencia';

export class Referencia {
  /**
   * @param {import('../../src/core/camera.js').Camera} camera a mesma do editor
   * @param {HTMLCanvasElement} canvas o canvas do palco, para medir a tela
   */
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.img = null;
    this.carregada = false;

    // Estado persistido: centro no mundo, escala (px de mundo por px da imagem),
    // rotação em radianos, opacidade e se está visível.
    this.estado = {
      cx: 0,
      cy: 0,
      escala: 1,
      rotacao: 0,
      opacidade: 0.5,
      visivel: true,
      ...this.#ler(),
    };
  }

  #ler() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) || '{}');
    } catch {
      return {};
    }
  }

  #gravar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.estado));
    } catch {
      // Sem localStorage (modo privado etc.): a referência só não persiste.
    }
  }

  /** Carrega a imagem; `aoCarregar` roda quando ela chega, para enquadrar. */
  carregar(src, aoCarregar = null) {
    // Sem `Image` (ambiente de teste sem DOM gráfico), a referência fica inerte:
    // nada carrega, nada desenha, e o editor segue funcionando sem ela.
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      this.img = img;
      this.carregada = true;
      // Primeira vez (sem posição salva): centraliza no mundo e cabe na tela.
      if (!this.#ler().cx && !this.#ler().cy) this.enquadrar();
      aoCarregar?.();
    };
    img.onerror = () => {
      this.carregada = false;
    };
    img.src = src;
  }

  get temImagem() {
    return this.carregada && this.img;
  }

  /** Centraliza a imagem na origem do mundo, numa escala que caiba na tela. */
  enquadrar() {
    if (!this.temImagem) return;
    this.estado.cx = 0;
    this.estado.cy = 0;
    const alvo = Math.min(this.canvas.clientWidth, this.canvas.clientHeight) * 0.6;
    this.estado.escala = alvo / Math.max(this.img.naturalWidth, this.img.naturalHeight) / this.camera.zoom;
    this.estado.rotacao = 0;
    this.#gravar();
  }

  alternar() {
    this.estado.visivel = !this.estado.visivel;
    this.#gravar();
    return this.estado.visivel;
  }

  definirOpacidade(v) {
    this.estado.opacidade = Math.max(0.05, Math.min(1, v));
    this.#gravar();
  }

  // ---------- geometria ----------
  //
  // A imagem mora no espaço do MUNDO: centro em (cx,cy), lados `escala` vezes o
  // tamanho em pixels da imagem, girada por `rotacao`. Assim ela acompanha o
  // pan e o zoom da câmera naturalmente — move e amplia junto com o mapa.

  /** Os quatro cantos da imagem em coordenadas de mundo. */
  cantos() {
    const w = (this.img.naturalWidth * this.estado.escala) / 2;
    const h = (this.img.naturalHeight * this.estado.escala) / 2;
    const cos = Math.cos(this.estado.rotacao);
    const sen = Math.sin(this.estado.rotacao);
    const girar = (dx, dy) => ({
      x: this.estado.cx + dx * cos - dy * sen,
      y: this.estado.cy + dx * sen + dy * cos,
    });
    return {
      no: girar(-w, -h),
      ne: girar(w, -h),
      se: girar(w, h),
      so: girar(-w, h),
    };
  }

  /** Qual alça está sob um ponto do mundo, se alguma. Raio em px de mundo. */
  alcaEm(mundoX, mundoY, raioMundo) {
    if (!this.temImagem) return null;
    const c = this.cantos();
    for (const [nome, p] of Object.entries(c)) {
      if (Math.hypot(p.x - mundoX, p.y - mundoY) <= raioMundo) return nome;
    }
    // Dentro do quadrilátero? então é mover.
    if (this.#dentro(mundoX, mundoY)) return 'mover';
    return null;
  }

  #dentro(x, y) {
    // Transforma o ponto para o espaço local da imagem (desgira) e testa a caixa.
    const dx = x - this.estado.cx;
    const dy = y - this.estado.cy;
    const cos = Math.cos(-this.estado.rotacao);
    const sen = Math.sin(-this.estado.rotacao);
    const lx = dx * cos - dy * sen;
    const ly = dx * sen + dy * cos;
    const w = (this.img.naturalWidth * this.estado.escala) / 2;
    const h = (this.img.naturalHeight * this.estado.escala) / 2;
    return Math.abs(lx) <= w && Math.abs(ly) <= h;
  }

  /** Move o centro por um deslocamento em mundo. */
  mover(dxMundo, dyMundo) {
    this.estado.cx += dxMundo;
    this.estado.cy += dyMundo;
    this.#gravar();
  }

  /**
   * Arrasta uma alça de canto para (mundoX, mundoY): reescala a partir do centro
   * e, segurando a diagonal, gira para o ponto. É o "puxar pela ponta" que o
   * usuário pediu — escala e rotação numa alça só.
   */
  arrastarAlca(nome, mundoX, mundoY) {
    const dx = mundoX - this.estado.cx;
    const dy = mundoY - this.estado.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    // Diagonal da imagem (do centro ao canto) em px da imagem.
    const meiaDiagonal = Math.hypot(this.img.naturalWidth, this.img.naturalHeight) / 2;
    this.estado.escala = dist / meiaDiagonal;

    // Rotação: o ângulo do ponteiro menos o ângulo que o canto tem em repouso.
    const anguloCantoRepouso = Math.atan2(this.img.naturalHeight, this.img.naturalWidth);
    const sinal = { ne: 1, se: 1, so: 1, no: 1 }[nome] ?? 1;
    void sinal;
    const anguloBase = {
      ne: -anguloCantoRepouso,
      se: anguloCantoRepouso,
      so: Math.PI - anguloCantoRepouso,
      no: Math.PI + anguloCantoRepouso,
    }[nome] ?? 0;
    this.estado.rotacao = Math.atan2(dy, dx) - anguloBase;
    this.#gravar();
  }

  // ---------- desenho ----------

  /**
   * Desenha a referência SOBRE o mapa já renderizado, no mesmo canvas.
   *
   * Por cima e não por baixo de propósito: o chão do mapa é opaco, então uma
   * camada por baixo não apareceria. Semitransparente em cima é o papel
   * manteiga — você vê o traçado da imagem e o que já desenhou ao mesmo tempo,
   * e desliga quando quer ver o mapa limpo.
   *
   * Recebe o contexto e as dimensões do renderizador do mapa, para usar o mesmo
   * dpr e a mesma transformação de mundo.
   */
  desenhar(ctx, dpr, largura, altura) {
    if (!this.temImagem || !this.estado.visivel) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(largura / 2, altura / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    ctx.save();
    ctx.translate(this.estado.cx, this.estado.cy);
    ctx.rotate(this.estado.rotacao);
    ctx.globalAlpha = this.estado.opacidade;
    const w = this.img.naturalWidth * this.estado.escala;
    const h = this.img.naturalHeight * this.estado.escala;
    ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Moldura e alças, para a imagem ser agarrável.
    ctx.globalAlpha = 1;
    const c = this.cantos();
    ctx.strokeStyle = 'rgba(126, 200, 240, 0.8)';
    ctx.lineWidth = 1.5 / this.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(c.no.x, c.no.y);
    ctx.lineTo(c.ne.x, c.ne.y);
    ctx.lineTo(c.se.x, c.se.y);
    ctx.lineTo(c.so.x, c.so.y);
    ctx.closePath();
    ctx.stroke();

    const r = 6 / this.camera.zoom;
    ctx.fillStyle = 'rgba(126, 200, 240, 0.9)';
    for (const p of Object.values(c)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
