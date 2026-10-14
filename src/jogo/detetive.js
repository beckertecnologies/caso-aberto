// O detetive. Posição em coordenadas de grade fracionárias: o valor inteiro
// é o centro do tile, então (3, 4) fica exatamente no meio do tile 3,4.
//
// Movimento no estilo ARPG isométrico: o clique define um destino, a rota vem
// do A* e a caminhada só interpola entre os nós. Teclado existe como alternativa
// de acessibilidade e sobrepõe a rota atual.

export class Detetive {
  constructor(gx, gy) {
    this.gx = gx;
    this.gy = gy;
    this.rota = [];
    this.velocidade = 3.4; // tiles por segundo
    this.olhandoX = 0;
    this.olhandoY = 1;
    this.andando = false;
    this.fase = 0; // fase da animação de passo
    /** Ação disparada ao chegar no fim da rota. */
    this.aoChegar = null;
  }

  definirRota(rota, aoChegar = null) {
    this.rota = rota;
    this.aoChegar = aoChegar;
  }

  pararAgora() {
    this.rota = [];
    this.aoChegar = null;
  }

  /** Distância em tiles até um ponto da grade. */
  distanciaAte(gx, gy) {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }

  /**
   * @param {number} dt segundos
   * @param {import('../mundo/cena.js').Cena} cena
   * @param {{x:number,y:number}|null} direcaoTeclado
   */
  atualizar(dt, cena, direcaoTeclado) {
    this.andando = false;

    if (direcaoTeclado) {
      // Teclado assume o controle e descarta o destino clicado.
      this.rota = [];
      this.aoChegar = null;
      this.#deslocar(direcaoTeclado.x, direcaoTeclado.y, dt, cena);
    } else if (this.rota.length) {
      this.#seguirRota(dt, cena);
    }

    this.fase += dt * (this.andando ? 9 : 2.2);
  }

  #seguirRota(dt, cena) {
    let restante = this.velocidade * dt;

    while (restante > 0 && this.rota.length) {
      const no = this.rota[0];
      const dx = no.x - this.gx;
      const dy = no.y - this.gy;
      const distancia = Math.hypot(dx, dy);

      if (distancia < 0.02) {
        this.gx = no.x;
        this.gy = no.y;
        this.rota.shift();
        continue;
      }

      this.olhandoX = dx / distancia;
      this.olhandoY = dy / distancia;
      this.andando = true;

      const passo = Math.min(restante, distancia);
      this.gx += this.olhandoX * passo;
      this.gy += this.olhandoY * passo;
      restante -= passo;
    }

    if (!this.rota.length && this.aoChegar) {
      const acao = this.aoChegar;
      this.aoChegar = null;
      acao();
    }
  }

  /** Passo livre com deslize na parede, para o teclado não travar em quina. */
  #deslocar(dx, dy, dt, cena) {
    const passo = this.velocidade * dt;
    const alvoX = this.gx + dx * passo;
    const alvoY = this.gy + dy * passo;

    let moveu = false;
    if (cena.andavel(Math.round(alvoX), Math.round(this.gy))) {
      this.gx = alvoX;
      moveu = true;
    }
    if (cena.andavel(Math.round(this.gx), Math.round(alvoY))) {
      this.gy = alvoY;
      moveu = true;
    }

    if (moveu) {
      this.olhandoX = dx;
      this.olhandoY = dy;
      this.andando = true;
    }
  }
}
