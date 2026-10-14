// Desenho da cena. Tudo é geometria desenhada em tempo real: losangos para o
// chão, blocos extrudados para os móveis e uma silhueta simples para o detetive.
// Nenhum arquivo de imagem é carregado.

import { ALTURA_TILE, LARGURA_TILE, gradeParaMundo, profundidade, trilhaDiamante } from '../core/iso.js';

const MEIA_LARGURA = LARGURA_TILE / 2;
const MEIA_ALTURA = ALTURA_TILE / 2;

export class Renderizador {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/camera.js').Camera} camera
   */
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
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

    // Centraliza o mundo na câmera
    const deslocamento = this.camera.mundoParaTela(0, 0);
    ctx.translate(deslocamento.x, deslocamento.y);

    this.#desenharChao(cena);
    if (tileSobMouse) this.#desenharDestaqueTile(cena, tileSobMouse, tempo);
    this.#desenharRota(detetive);
    this.#desenharPecasEEntidades(jogo, alvoDestacado, tempo);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.#desenharLuz(cena, detetive, deslocamento);
  }

  // ---------- chão ----------

  #desenharChao(cena) {
    const ctx = this.ctx;
    for (let gy = 0; gy < cena.altura; gy += 1) {
      for (let gx = 0; gx < cena.largura; gx += 1) {
        const terreno = cena.chao[gy][gx];
        if (!terreno || terreno.invisivel) continue;
        const { x, y } = gradeParaMundo(gx, gy);

        trilhaDiamante(ctx, x, y);
        ctx.fillStyle = terreno.topo;
        ctx.fill();

        // Variação sutil para o piso não ficar chapado.
        if (terreno.xadrez && (gx + gy) % 2 === 0) {
          ctx.fillStyle = terreno.xadrez;
          ctx.fill();
        }
        if (terreno.veio && gx % 2 === 0) {
          ctx.fillStyle = terreno.veio;
          ctx.globalAlpha = 0.35;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = terreno.aresta;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
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

    for (const peca of cena.pecas) {
      fila.push({ ordem: profundidade(peca.gx, peca.gy), desenhar: () => this.#desenharPeca(peca, alvoDestacado, tempo) });
    }

    for (const vestigio of jogo.vestigiosVisiveis()) {
      fila.push({
        ordem: profundidade(vestigio.gx, vestigio.gy) + 0.1,
        desenhar: () => this.#desenharVestigio(vestigio, alvoDestacado, tempo),
      });
    }

    fila.push({
      ordem: profundidade(detetive.gx, detetive.gy) + 0.2,
      desenhar: () => this.#desenharDetetive(detetive),
    });

    fila.sort((a, b) => a.ordem - b.ordem);
    for (const item of fila) item.desenhar();
  }

  #desenharPeca(peca, alvoDestacado, tempo) {
    const { gx, gy, def } = peca;
    const { x, y } = gradeParaMundo(gx, gy);
    const destacada = alvoDestacado && alvoDestacado.gx === gx && alvoDestacado.gy === gy;

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
        this.#arvore(x, y, gx + gy);
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
      default:
        break;
    }

    const proprias = ['contorno', 'pasta', 'jornal', 'passagem'];
    if (destacada && def.forma && !proprias.includes(def.forma)) {
      this.#aroDestaque(x, y, tempo);
    }
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

  /** Marcação de giz no chão. Forma abstrata, sem representar o corpo. */
  #contorno(x, y, destacada, tempo) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = destacada ? 'rgba(240, 220, 200, 0.95)' : 'rgba(226, 214, 198, 0.62)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 13, 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-16, -6, 8, 5, 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (destacada) this.#aroDestaque(x, y, tempo);
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

  /** Árvore de rua: tronco e copa em camadas, com leve variação por posição. */
  #arvore(x, y, semente) {
    const ctx = this.ctx;
    this.#sombra(x, y, 0.62);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#2a2017';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -26);
    ctx.stroke();

    const desvio = ((semente * 37) % 7) - 3;
    const copas = [
      { dx: 0, dy: -46, rx: 19, ry: 13, cor: '#1d2e22' },
      { dx: desvio, dy: -54, rx: 15, ry: 11, cor: '#253a2a' },
      { dx: -desvio, dy: -38, rx: 16, ry: 10, cor: '#203325' },
    ];
    for (const copa of copas) {
      ctx.fillStyle = copa.cor;
      ctx.beginPath();
      ctx.ellipse(copa.dx, copa.dy, copa.rx, copa.ry, 0, 0, Math.PI * 2);
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

  /** Figura original: silhueta de sobretudo e chapéu, montada com primitivas. */
  #desenharDetetive(detetive) {
    const ctx = this.ctx;
    const { x, y } = gradeParaMundo(detetive.gx, detetive.gy);
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
