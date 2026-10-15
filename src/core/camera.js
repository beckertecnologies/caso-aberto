// Câmera que persegue o detetive com suavização, como nos ARPG de vista
// isométrica. O zoom existe para o editor: no jogo fica sempre em 1.

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.larguraTela = 1;
    this.alturaTela = 1;
  }

  redimensionar(largura, altura) {
    this.larguraTela = largura;
    this.alturaTela = altura;
  }

  /** Posiciona a câmera imediatamente, sem suavização. */
  fixar(x, y) {
    this.x = x;
    this.y = y;
  }

  /** Aproxima a câmera do alvo. `dt` em segundos. */
  seguir(x, y, dt) {
    const fator = 1 - Math.exp(-8 * dt); // suavização independente do framerate
    this.x += (x - this.x) * fator;
    this.y += (y - this.y) * fator;
  }

  /** Move a câmera em pixels de tela, respeitando o zoom atual. */
  arrastar(dxTela, dyTela) {
    this.x -= dxTela / this.zoom;
    this.y -= dyTela / this.zoom;
  }

  /**
   * Aplica zoom mantendo fixo o ponto do mundo que está sob a tela em
   * (telaX, telaY). Sem essa âncora, aproximar jogaria a vista para longe de
   * onde o cursor está.
   */
  aplicarZoom(fator, telaX, telaY, minimo = 0.02, maximo = 4) {
    const antes = this.telaParaMundo(telaX, telaY);
    this.zoom = Math.max(minimo, Math.min(maximo, this.zoom * fator));
    const depois = this.telaParaMundo(telaX, telaY);
    this.x += antes.x - depois.x;
    this.y += antes.y - depois.y;
  }

  mundoParaTela(x, y) {
    return {
      x: (x - this.x) * this.zoom + this.larguraTela / 2,
      y: (y - this.y) * this.zoom + this.alturaTela / 2,
    };
  }

  telaParaMundo(x, y) {
    return {
      x: (x - this.larguraTela / 2) / this.zoom + this.x,
      y: (y - this.alturaTela / 2) / this.zoom + this.y,
    };
  }
}
