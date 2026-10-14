// Laço de quadros com delta limitado, para a simulação não dar saltos
// quando a aba volta do segundo plano.

export class Loop {
  /**
   * @param {(dt: number, agora: number) => void} aoQuadro
   */
  constructor(aoQuadro) {
    this.aoQuadro = aoQuadro;
    this.rodando = false;
    this.ultimo = 0;
    this.id = 0;
    this.tempo = 0;
  }

  iniciar() {
    if (this.rodando) return;
    this.rodando = true;
    this.ultimo = performance.now();
    const passo = (agora) => {
      if (!this.rodando) return;
      const dt = Math.min((agora - this.ultimo) / 1000, 0.05);
      this.ultimo = agora;
      this.tempo += dt;
      this.aoQuadro(dt, this.tempo);
      this.id = requestAnimationFrame(passo);
    };
    this.id = requestAnimationFrame(passo);
  }

  parar() {
    this.rodando = false;
    cancelAnimationFrame(this.id);
  }
}
