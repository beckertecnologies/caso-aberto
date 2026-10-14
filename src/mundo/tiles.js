// Dicionário de terrenos e objetos. Cada caractere do mapa ASCII cai aqui.
// Toda a arte é geométrica, desenhada em tempo real — não há sprites externos.

/** Camada de chão. `andavel` decide se o detetive pode pisar. */
export const CHAO = {
  ' ': { id: 'vazio', andavel: false, invisivel: true },
  w: { id: 'tabua', andavel: true, topo: '#3a2e25', aresta: '#241c16', veio: '#46382c' },
  t: { id: 'ladrilho', andavel: true, topo: '#2d363c', aresta: '#1f262b', xadrez: '#36424a' },
  c: { id: 'tapete', andavel: true, topo: '#45202d', aresta: '#2e1420', veio: '#512734' },
  p: { id: 'calcada', andavel: true, topo: '#32353b', aresta: '#23262b', xadrez: '#3a3e45' },
};

/**
 * Camada de objetos.
 * `solido` bloqueia passagem. `interacao` marca o que pode ser examinado.
 * `forma` escolhe como o renderizador desenha a peça.
 */
export const OBJETOS = {
  '.': null,
  '#': { id: 'parede', solido: true, forma: 'parede', altura: 38 },
  d: { id: 'porta', solido: false, forma: 'porta', altura: 38, rotulo: 'Passagem' },

  S: { id: 'sofa', solido: true, forma: 'caixa', altura: 15, escala: 0.94, lado: '#3d1f29', topo: '#55303c', rotulo: 'Sofá' },
  T: { id: 'mesa', solido: true, forma: 'caixa', altura: 17, escala: 0.8, lado: '#33241b', topo: '#4a3626', rotulo: 'Mesa de centro' },
  V: { id: 'estante', solido: true, forma: 'caixa', altura: 36, escala: 0.9, lado: '#2a2018', topo: '#3b2d22', rotulo: 'Estante' },
  A: { id: 'armario', solido: true, forma: 'caixa', altura: 40, escala: 0.92, lado: '#261d15', topo: '#36291e', rotulo: 'Guarda-roupa' },
  B: { id: 'cama', solido: true, forma: 'caixa', altura: 13, escala: 0.98, lado: '#262d38', topo: '#3a4453', rotulo: 'Cama' },
  D: { id: 'escrivaninha', solido: true, forma: 'caixa', altura: 18, escala: 0.86, lado: '#2f2217', topo: '#44311d', rotulo: 'Escrivaninha' },
  K: { id: 'bancada', solido: true, forma: 'caixa', altura: 19, escala: 0.96, lado: '#242a30', topo: '#39434a', rotulo: 'Bancada' },
  U: { id: 'pia', solido: true, forma: 'caixa', altura: 16, escala: 0.82, lado: '#272e34', topo: '#444e56', rotulo: 'Pia' },

  P: { id: 'vaso', solido: true, forma: 'planta', rotulo: 'Vaso de planta' },
  L: { id: 'luminaria', solido: true, forma: 'luminaria', luz: 3.4, rotulo: 'Luminária' },

  O: { id: 'contorno', solido: false, forma: 'contorno', interacao: 'corpo', rotulo: 'Marcação da vítima' },
  F: { id: 'pasta', solido: false, forma: 'pasta', interacao: 'documento', rotulo: 'Pasta da perícia' },
  E: { id: 'saida', solido: false, forma: 'saida', interacao: 'saida', rotulo: 'Encerrar investigação' },

  '*': { id: 'ponto', solido: false, forma: null, marcador: 'vestigio' },
  X: { id: 'entrada', solido: false, forma: null, marcador: 'inicio' },
};
