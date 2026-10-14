// Câmera que persegue o detetive com suavização, como nos ARPG de vista isométrica.

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
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

  mundoParaTela(x, y) {
    return {
      x: x - this.x + this.larguraTela / 2,
      y: y - this.y + this.alturaTela / 2,
    };
  }

  telaParaMundo(x, y) {
    return {
      x: x + this.x - this.larguraTela / 2,
      y: y + this.y - this.alturaTela / 2,
    };
  }
}
