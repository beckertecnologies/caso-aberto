// Dicionário de terrenos e objetos. Cada caractere do mapa ASCII cai aqui.
// Toda a arte é geométrica, desenhada em tempo real — não há sprites externos.

/**
 * Camada de chão. `andavel` decide se o detetive pode pisar.
 *
 * `material` escolhe a textura em `src/render/chao.js`. As cores são a paleta
 * daquele material: `base` é o tom principal, `claro` e `escuro` dão a variação,
 * e `junta` é o rejunte ou a emenda, quando o material tem uma.
 * Mudar a aparência do jogo é mudar valores aqui.
 */
export const CHAO = {
  // Fora do piso jogável. Não é buraco preto: é laje de concreto, o que faz a
  // área ainda não construída parecer parte do mundo em vez de falha de desenho.
  ' ': {
    id: 'vazio',
    andavel: false,
    material: 'concreto',
    base: '#2b2e34',
    claro: '#34383f',
    escuro: '#212429',
    junta: '#1b1e22',
  },
  w: {
    id: 'tabua',
    andavel: true,
    material: 'tabua',
    base: '#3d3027',
    claro: '#4e3e30',
    escuro: '#2a2018',
    veio: '#53412f',
    junta: '#20190f',
  },
  t: {
    id: 'ladrilho',
    andavel: true,
    material: 'ladrilho',
    base: '#2d363d',
    claro: '#374249',
    escuro: '#222a30',
    junta: '#1a2126',
  },
  c: {
    id: 'tapete',
    andavel: true,
    material: 'tapete',
    base: '#46212e',
    claro: '#552b39',
    escuro: '#331621',
    junta: '#2a1119',
  },
  p: {
    id: 'calcada',
    andavel: true,
    material: 'calcada',
    base: '#3a3e45',
    claro: '#464b53',
    escuro: '#272b31',
    junta: '#23272c',
  },
  a: {
    id: 'asfalto',
    andavel: true,
    material: 'asfalto',
    base: '#23262c',
    claro: '#32363d',
    escuro: '#1a1c21',
    trinca: '#15171a',
    junta: '#181a1e',
  },
  g: {
    id: 'grama',
    andavel: true,
    material: 'grama',
    base: '#20301f',
    claro: '#2d4429',
    escuro: '#162013',
    junta: '#141d12',
  },

  // Mar. Não é andável: cerca a ilha e o detetive não pisa nele. Diferente do
  // vazio (concreto escuro), este tem cor de água, para a borda da ilha ler como
  // litoral e não como "fim do desenho".
  '~': {
    id: 'agua',
    andavel: false,
    material: 'agua',
    base: '#1c3a52',
    claro: '#2f5f80',
    escuro: '#142a3d',
    espuma: '#9fc4d8',
    junta: '#102235',
  },

  // Variantes pintadas: mesmo material, mas `semTextura` manda ignorar o
  // acervo de imagens e usar sempre a pintura procedural. Servem para misturar
  // os dois acabamentos no mesmo mapa — expandir a praça com grama desenhada
  // ao lado da grama texturizada, por exemplo.
  A: {
    id: 'asfalto-pintado',
    andavel: true,
    material: 'asfalto',
    semTextura: true,
    base: '#23262c',
    claro: '#32363d',
    escuro: '#1a1c21',
    trinca: '#15171a',
    junta: '#181a1e',
  },
  P: {
    id: 'calcada-pintada',
    andavel: true,
    material: 'calcada',
    semTextura: true,
    base: '#3a3e45',
    claro: '#464b53',
    escuro: '#272b31',
    junta: '#23272c',
  },
  G: {
    id: 'grama-pintada',
    andavel: true,
    material: 'grama',
    semTextura: true,
    base: '#20301f',
    claro: '#2d4429',
    escuro: '#162013',
    junta: '#141d12',
  },
  W: {
    id: 'tabua-pintada',
    andavel: true,
    material: 'tabua',
    semTextura: true,
    base: '#3d3027',
    claro: '#4e3e30',
    escuro: '#2a2018',
    veio: '#53412f',
    junta: '#20190f',
  },
  T: {
    id: 'ladrilho-pintado',
    andavel: true,
    material: 'ladrilho',
    semTextura: true,
    base: '#2d363d',
    claro: '#374249',
    escuro: '#222a30',
    junta: '#1a2126',
  },
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

  // Marca de "aqui vai um prédio", posta no modo cidade. Não é prédio: é um
  // alfinete no mapa. Uma ferramenta posterior lê essas marcas e distribui as
  // cenas nelas. Não é sólido para o detetive poder pisar enquanto é só marca.
  M: { id: 'marca-predio', solido: false, forma: null, marcador: 'predio' },
};

/** Os caracteres que representam passagem entre locais. */
export const CHARS_LIGACAO = Object.keys(OBJETOS).filter((ch) => OBJETOS[ch]?.interacao === 'ligacao');
