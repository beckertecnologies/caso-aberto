// Projeção isométrica 2:1. O mapa é uma grade comum; só o desenho é em diamante.
// Vantagem prática: editar o mapa continua sendo editar uma matriz de caracteres.

export const LARGURA_TILE = 64;
export const ALTURA_TILE = 32;

const MEIA_LARGURA = LARGURA_TILE / 2;
const MEIA_ALTURA = ALTURA_TILE / 2;

/**
 * Converte coordenada de grade para o centro do tile no espaço do mundo.
 * O tile (0,0) fica na origem.
 */
export function gradeParaMundo(gx, gy) {
  return {
    x: (gx - gy) * MEIA_LARGURA,
    y: (gx + gy) * MEIA_ALTURA,
  };
}

/** Inverso de gradeParaMundo. Devolve coordenadas fracionárias de grade. */
export function mundoParaGrade(x, y) {
  const a = x / MEIA_LARGURA;
  const b = y / MEIA_ALTURA;
  return {
    gx: (b + a) / 2,
    gy: (b - a) / 2,
  };
}

/** Profundidade de desenho: quem tem soma maior fica na frente. */
export function profundidade(gx, gy) {
  return gx + gy;
}

/** Traça o losango de um tile centrado em (x, y) no contexto atual. */
export function trilhaDiamante(ctx, x, y, escala = 1) {
  const lx = MEIA_LARGURA * escala;
  const ly = MEIA_ALTURA * escala;
  ctx.beginPath();
  ctx.moveTo(x, y - ly);
  ctx.lineTo(x + lx, y);
  ctx.lineTo(x, y + ly);
  ctx.lineTo(x - lx, y);
  ctx.closePath();
}
