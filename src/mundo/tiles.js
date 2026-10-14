// Dicionário de terrenos e objetos. Cada caractere do mapa ASCII cai aqui.
// Toda a arte é geométrica, desenhada em tempo real — não há sprites externos.

/** Camada de chão. `andavel` decide se o detetive pode pisar. */
export const CHAO = {
  ' ': { id: 'vazio', andavel: false, invisivel: true },
  w: { id: 'tabua', andavel: true, topo: '#3a2e25', aresta: '#241c16', veio: '#46382c' },
  t: { id: 'ladrilho', andavel: true, topo: '#2d363c', aresta: '#1f262b', xadrez: '#36424a' },
  c: { id: 'tapete', andavel: true, topo: '#45202d', aresta: '#2e1420', veio: '#512734' },
  p: { id: 'calcada', andavel: true, topo: '#32353b', aresta: '#23262b', xadrez: '#3a3e45' },
  a: { id: 'asfalto', andavel: true, topo: '#22242a', aresta: '#191b20', xadrez: '#272a31' },
  g: { id: 'grama', andavel: true, topo: '#1e2c21', aresta: '#16201a', veio: '#253626' },
};

/**
 * Camada de objetos.
 * `solido` bloqueia passagem. `interacao` marca o que pode ser examinado.
 * `forma` escolhe como o renderizador desenha a peça.
 *
 * Os caracteres `1`..`3` são passagens entre locais. O destino de cada um vem
 * do campo `ligacoes` da própria cena, então o mesmo caractere serve em
 * qualquer mapa.
 */
export const OBJETOS = {
  '.': null,
  '#': { id: 'parede', solido: true, forma: 'parede', altura: 38 },
  d: { id: 'porta', solido: false, forma: 'porta', altura: 38, rotulo: 'Passagem' },

  S: { id: 'sofa', solido: true, forma: 'caixa', altura: 15, escala: 0.94, lado: '#3d1f29', topo: '#55303c', rotulo: 'Sofá' },
  T: { id: 'mesa', solido: true, forma: 'caixa', altura: 17, escala: 0.8, lado: '#33241b', topo: '#4a3626', rotulo: 'Mesa' },
  V: { id: 'estante', solido: true, forma: 'caixa', altura: 36, escala: 0.9, lado: '#2a2018', topo: '#3b2d22', rotulo: 'Estante' },
  A: { id: 'armario', solido: true, forma: 'caixa', altura: 40, escala: 0.92, lado: '#261d15', topo: '#36291e', rotulo: 'Armário' },
  B: { id: 'cama', solido: true, forma: 'caixa', altura: 13, escala: 0.98, lado: '#262d38', topo: '#3a4453', rotulo: 'Cama' },
  D: { id: 'escrivaninha', solido: true, forma: 'caixa', altura: 18, escala: 0.86, lado: '#2f2217', topo: '#44311d', rotulo: 'Escrivaninha' },
  K: { id: 'bancada', solido: true, forma: 'caixa', altura: 19, escala: 0.96, lado: '#242a30', topo: '#39434a', rotulo: 'Bancada' },
  U: { id: 'pia', solido: true, forma: 'caixa', altura: 16, escala: 0.82, lado: '#272e34', topo: '#444e56', rotulo: 'Pia' },
  H: { id: 'banco', solido: true, forma: 'caixa', altura: 10, escala: 0.74, lado: '#2d2419', topo: '#3f3324', rotulo: 'Banco' },

  P: { id: 'vaso', solido: true, forma: 'planta', rotulo: 'Vaso de planta' },
  Y: { id: 'arvore', solido: true, forma: 'arvore', rotulo: 'Árvore' },
  L: { id: 'luminaria', solido: true, forma: 'luminaria', luz: 3.4, rotulo: 'Luminária' },

  W: {
    id: 'registro',
    solido: false,
    forma: 'registro',
    interacao: 'acusacao',
    rotulo: 'Mesa de registro — formalizar a acusação',
  },

  O: { id: 'contorno', solido: false, forma: 'contorno', interacao: 'corpo', rotulo: 'Marcação da vítima' },
  F: { id: 'pasta', solido: false, forma: 'pasta', interacao: 'documento', rotulo: 'Pasta da perícia' },
  J: { id: 'jornal', solido: false, forma: 'jornal', interacao: 'documento', rotulo: 'Banca de jornal' },

  1: { id: 'passagem-1', solido: false, forma: 'passagem', interacao: 'ligacao' },
  2: { id: 'passagem-2', solido: false, forma: 'passagem', interacao: 'ligacao' },
  3: { id: 'passagem-3', solido: false, forma: 'passagem', interacao: 'ligacao' },

  '*': { id: 'ponto', solido: false, forma: null, marcador: 'vestigio' },
  X: { id: 'entrada', solido: false, forma: null, marcador: 'inicio' },
};

/** Os caracteres que representam passagem entre locais. */
export const CHARS_LIGACAO = Object.keys(OBJETOS).filter((ch) => OBJETOS[ch]?.interacao === 'ligacao');
