// Pintura do chão, material por material.
//
// O desenho antigo preenchia o losango e contornava todo tile com a mesma cor,
// o que fazia o piso ler como grade e não como terreno. Aqui cada material tem
// textura própria: asfalto é granulado, calçada é lajota, grama é tufo, madeira
// é tábua contínua. O contorno só aparece onde faz parte do material (rejunte de
// ladrilho, emenda de tábua) ou na fronteira entre dois materiais.
//
// Tudo é desenhado com primitivas e ruído determinístico: nenhuma imagem é
// carregada, e a mesma tile sempre sai igual.

import { ALTURA_TILE, LARGURA_TILE, trilhaDiamante } from '../core/iso.js';

const MEIA_L = LARGURA_TILE / 2;
const MEIA_A = ALTURA_TILE / 2;

/**
 * Ruído determinístico por tile. `sal` separa usos diferentes na mesma tile,
 * para o granulado não repetir o mesmo padrão da variação de tom.
 * @returns {number} decimal em [0, 1)
 */
export function ruido(gx, gy, sal = 0) {
  let h = (Math.imul(gx | 0, 374761393) + Math.imul(gy | 0, 668265263) + Math.imul(sal | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Clareia ou escurece um `#rrggbb` em `delta` por canal. */
function tonalizar(cor, delta) {
  if (!/^#[0-9a-f]{6}$/i.test(cor)) return cor;
  const n = parseInt(cor.slice(1), 16);
  const canal = (v) => Math.max(0, Math.min(255, v + delta));
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Preenche a tile inteira. Depende do recorte feito por `pintarChao`. */
function preencher(ctx, x, y, cor, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = cor;
  ctx.fillRect(x - MEIA_L, y - MEIA_A, LARGURA_TILE, ALTURA_TILE);
  ctx.globalAlpha = 1;
}

/** Os quatro sub-losangos que recobrem exatamente um losango de tile. */
const SUBLOSANGOS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// ---------- materiais ----------

/** Asfalto: base escura, granulado fino e trinca ocasional. */
function asfalto(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.base);

  // Manchas largas, para a rua não ficar de uma cor só.
  const tom = ruido(gx, gy, 1);
  preencher(ctx, x, y, tom > 0.5 ? t.claro : t.escuro, 0.08 + tom * 0.07);

  for (let i = 0; i < 22; i += 1) {
    const a = ruido(gx, gy, 10 + i);
    const b = ruido(gx, gy, 60 + i);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = a > 0.5 ? t.claro : t.escuro;
    ctx.fillRect(x + (a - 0.5) * LARGURA_TILE, y + (b - 0.5) * ALTURA_TILE, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  if (ruido(gx, gy, 7) > 0.86) {
    const inicio = ruido(gx, gy, 8);
    ctx.strokeStyle = t.trinca;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - MEIA_L * 0.6, y + (inicio - 0.5) * ALTURA_TILE * 0.6);
    ctx.lineTo(x, y + (ruido(gx, gy, 9) - 0.5) * ALTURA_TILE * 0.5);
    ctx.lineTo(x + MEIA_L * 0.6, y + (ruido(gx, gy, 11) - 0.5) * ALTURA_TILE * 0.6);
    ctx.stroke();
  }
}

/** Calçada: quatro lajotas por tile, com o rejunte aparecendo por baixo. */
function calcada(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.junta);

  SUBLOSANGOS.forEach(([dx, dy], i) => {
    const r = ruido(gx, gy, 100 + i);
    ctx.fillStyle = tonalizar(t.base, Math.round((r - 0.5) * 14));
    trilhaDiamante(ctx, x + (dx * MEIA_L) / 2, y + (dy * MEIA_A) / 2, 0.46);
    ctx.fill();
  });

  // Mancha de umidade de vez em quando.
  if (ruido(gx, gy, 3) > 0.9) preencher(ctx, x, y, t.escuro, 0.18);
}

/** Grama: base irregular com tufos curtos. */
function grama(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.base);

  const tom = ruido(gx, gy, 2);
  preencher(ctx, x, y, tom > 0.5 ? t.claro : t.escuro, 0.12 + tom * 0.1);

  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i += 1) {
    const a = ruido(gx, gy, 200 + i);
    const b = ruido(gx, gy, 260 + i);
    const px = x + (a - 0.5) * LARGURA_TILE * 0.9;
    const py = y + (b - 0.5) * ALTURA_TILE * 0.9;
    ctx.strokeStyle = a > 0.55 ? t.claro : t.escuro;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (b - 0.5) * 3, py - 2.5 - a * 2.5);
    ctx.stroke();
  }
}

/**
 * Tábua corrida: o tom vem só de `gy`, então a prancha mantém a cor ao longo
 * de `gx` e lê como uma peça contínua em vez de quadrado isolado.
 */
function tabua(ctx, x, y, gx, gy, t) {
  const tomDaPrancha = ruido(0, gy, 5);
  preencher(ctx, x, y, tonalizar(t.base, Math.round((tomDaPrancha - 0.5) * 16)));

  // Veio na direção da prancha.
  ctx.strokeStyle = t.veio;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 3; i += 1) {
    const desvio = (ruido(gx, gy, 300 + i) - 0.5) * ALTURA_TILE * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - MEIA_L, y + desvio - MEIA_A / 2);
    ctx.lineTo(x + MEIA_L, y + desvio + MEIA_A / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Emendas nas duas arestas que separam uma prancha da seguinte. Como tiles
  // vizinhas compartilham essas arestas, as linhas saem contínuas.
  ctx.strokeStyle = t.junta;
  ctx.beginPath();
  ctx.moveTo(x, y - MEIA_A);
  ctx.lineTo(x + MEIA_L, y);
  ctx.moveTo(x, y + MEIA_A);
  ctx.lineTo(x - MEIA_L, y);
  ctx.stroke();
}

/** Ladrilho: quatro peças com rejunte, em xadrez. */
function ladrilho(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.junta);

  SUBLOSANGOS.forEach(([dx, dy], i) => {
    const claro = (gx + gy + i) % 2 === 0;
    const r = ruido(gx, gy, 400 + i);
    ctx.fillStyle = tonalizar(claro ? t.claro : t.base, Math.round((r - 0.5) * 8));
    trilhaDiamante(ctx, x + (dx * MEIA_L) / 2, y + (dy * MEIA_A) / 2, 0.44);
    ctx.fill();
  });

  // Brilho fraco, como piso encerado.
  if (ruido(gx, gy, 6) > 0.72) preencher(ctx, x, y, '#ffffff', 0.025);
}

/** Tapete: fibra sem junta, só mosqueado. */
function tapete(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.base);

  for (let i = 0; i < 16; i += 1) {
    const a = ruido(gx, gy, 500 + i);
    const b = ruido(gx, gy, 560 + i);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = a > 0.5 ? t.claro : t.escuro;
    ctx.fillRect(x + (a - 0.5) * LARGURA_TILE * 0.95, y + (b - 0.5) * ALTURA_TILE * 0.95, 3, 2);
  }
  ctx.globalAlpha = 1;
}

/** Concreto: laje lisa e fria, para a área fora do piso jogável. */
function concreto(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.base);

  const tom = ruido(gx, gy, 31);
  preencher(ctx, x, y, tom > 0.5 ? t.claro : t.escuro, 0.07 + tom * 0.05);

  // Granulado bem discreto, só para não ficar chapado.
  for (let i = 0; i < 8; i += 1) {
    const a = ruido(gx, gy, 600 + i);
    const b = ruido(gx, gy, 640 + i);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = a > 0.5 ? t.claro : t.escuro;
    ctx.fillRect(x + (a - 0.5) * LARGURA_TILE * 0.9, y + (b - 0.5) * ALTURA_TILE * 0.9, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function liso(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.base);
}

/**
 * Água: azul em camadas, com faixas claras onde a onda pega luz. Sem animação
 * — o chão é pré-pintado uma vez por tile —, mas a variação por posição faz o
 * mar não ficar um bloco chapado.
 */
function agua(ctx, x, y, gx, gy, t) {
  preencher(ctx, x, y, t.base);
  // Duas camadas de tom, escolhidas pela posição, dão profundidade.
  const fundo = ruido(gx, gy, 71);
  preencher(ctx, x, y, fundo > 0.5 ? t.escuro : t.base, 0.4);

  // Riscos horizontais claros = reflexo na crista da onda.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = t.claro;
  for (let i = 0; i < 3; i += 1) {
    const r = ruido(gx, gy, 120 + i);
    if (r < 0.45) continue;
    const ly = y + (ruido(gx, gy, 160 + i) - 0.5) * ALTURA_TILE * 0.7;
    const lx = x + (ruido(gx, gy, 200 + i) - 0.5) * LARGURA_TILE * 0.4;
    ctx.fillRect(lx - 5, ly, 10, 1);
  }
  // Um brilho de espuma pontual, bem esparso.
  if (ruido(gx, gy, 260) > 0.82) {
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = t.espuma ?? t.claro;
    ctx.fillRect(x + (ruido(gx, gy, 280) - 0.5) * 12, y + (ruido(gx, gy, 300) - 0.5) * 8, 2, 2);
  }
  ctx.globalAlpha = 1;
}

const PINTORES = { asfalto, calcada, grama, tabua, ladrilho, tapete, concreto, agua, liso };

/** Pinta uma tile de chão, recortada no próprio losango. */
export function pintarChao(ctx, terreno, x, y, gx, gy) {
  ctx.save();
  trilhaDiamante(ctx, x, y);
  ctx.clip();
  (PINTORES[terreno.material] ?? liso)(ctx, x, y, gx, gy, terreno);
  ctx.restore();
}

/**
 * As quatro arestas do losango, cada uma com o vizinho que fica do outro lado.
 * Serve para marcar fronteira entre materiais sem contornar tile por tile.
 */
export const ARESTAS = [
  { vizinho: [0, -1], de: [0, -MEIA_A], para: [MEIA_L, 0] },
  { vizinho: [1, 0], de: [MEIA_L, 0], para: [0, MEIA_A] },
  { vizinho: [0, 1], de: [0, MEIA_A], para: [-MEIA_L, 0] },
  { vizinho: [-1, 0], de: [-MEIA_L, 0], para: [0, -MEIA_A] },
];
