// Projeção isométrica 2:1. O mapa é uma grade comum; só o desenho é em diamante.
// Vantagem prática: editar o mapa continua sendo editar uma matriz de caracteres.

export const LARGURA_TILE = 64;
export const ALTURA_TILE = 32;

/**
 * Quanto uma peça sobe por nível, em pixels de mundo.
 *
 * Serve para empilhar: pôr o telhado em cima da parede, a placa acima da porta,
 * o lampião no alto do poste. Sem isso tudo assenta no chão e um telhado fica
 * colado no piso.
 *
 * O passo é um quarto da aresta do cubo da grade (que é de 64 px) de propósito.
 * Um passo grande seria mais rápido de usar e impossível de acertar: as peças do
 * acervo não têm todas a mesma altura, e uma parede do pacote de masmorra sobe
 * 52 px — não é múltiplo de nada redondo. Com passo de 16 dá para encostar o
 * telhado nela de verdade, e quem quiser andar de cubo em cubo usa Shift, que
 * pula quatro níveis.
 */
export const ALTURA_NIVEL = 16;

/** Níveis aceitos. O teto existe só para um número digitado errado não sumir com a peça. */
export const NIVEL_MAXIMO = 40;

/** Garante que um nível vindo de arquivo ou de interface é inteiro e cabe. */
export function nivelValido(valor) {
  const n = Math.floor(Number(valor) || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(NIVEL_MAXIMO, n));
}

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
