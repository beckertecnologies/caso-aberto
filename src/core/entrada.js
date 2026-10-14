// Traduz mouse, toque e teclado em intenções do jogo.
// A camada de jogo nunca lê eventos do DOM direto: ela só consulta este objeto.

const TECLAS_DIRECAO = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

export class Entrada {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ponteiro = { x: 0, y: 0, dentro: false };
    this.cliques = [];
    this.teclasPressionadas = new Set();
    this.atalhos = new Map();
    this.bloqueada = false;

    this.#ligarPonteiro();
    this.#ligarTeclado();
  }

  /** Impede movimento enquanto um painel modal está aberto. */
  definirBloqueio(bloqueada) {
    this.bloqueada = bloqueada;
    if (bloqueada) this.teclasPressionadas.clear();
  }

  /** Registra uma tecla de atalho (código de KeyboardEvent.code). */
  aoAtalho(codigo, acao) {
    this.atalhos.set(codigo, acao);
  }

  /** Devolve e limpa os cliques acumulados no quadro. */
  consumirCliques() {
    const lista = this.cliques;
    this.cliques = [];
    return lista;
  }

  /** Direção do teclado, já normalizada. Nulo quando nada está pressionado. */
  direcaoTeclado() {
    if (this.bloqueada) return null;
    let x = 0;
    let y = 0;
    for (const codigo of this.teclasPressionadas) {
      const dir = TECLAS_DIRECAO[codigo];
      if (dir) {
        x += dir[0];
        y += dir[1];
      }
    }
    if (x === 0 && y === 0) return null;
    const tamanho = Math.hypot(x, y);
    return { x: x / tamanho, y: y / tamanho };
  }

  #posicaoRelativa(evento) {
    const area = this.canvas.getBoundingClientRect();
    return {
      x: evento.clientX - area.left,
      y: evento.clientY - area.top,
    };
  }

  #ligarPonteiro() {
    this.canvas.addEventListener('pointermove', (evento) => {
      const p = this.#posicaoRelativa(evento);
      this.ponteiro.x = p.x;
      this.ponteiro.y = p.y;
      this.ponteiro.dentro = true;
    });

    this.canvas.addEventListener('pointerleave', () => {
      this.ponteiro.dentro = false;
    });

    this.canvas.addEventListener('pointerdown', (evento) => {
      if (evento.button !== 0 && evento.pointerType === 'mouse') return;
      if (this.bloqueada) return;
      const p = this.#posicaoRelativa(evento);
      this.ponteiro.x = p.x;
      this.ponteiro.y = p.y;
      this.ponteiro.dentro = true;
      this.cliques.push(p);
    });

    // Evita o menu de contexto atrapalhar o clique de caminhada.
    this.canvas.addEventListener('contextmenu', (evento) => evento.preventDefault());
  }

  #ligarTeclado() {
    window.addEventListener('keydown', (evento) => {
      const atalho = this.atalhos.get(evento.code);
      if (atalho) {
        evento.preventDefault();
        atalho();
        return;
      }
      if (TECLAS_DIRECAO[evento.code]) {
        // Não sequestra o teclado quando o foco está num campo de texto.
        const alvo = evento.target;
        if (alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement) return;
        evento.preventDefault();
        this.teclasPressionadas.add(evento.code);
      }
    });

    window.addEventListener('keyup', (evento) => {
      this.teclasPressionadas.delete(evento.code);
    });

    window.addEventListener('blur', () => this.teclasPressionadas.clear());
  }
}
