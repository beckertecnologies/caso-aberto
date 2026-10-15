// Casa de Praia — criado por `node tools/montar-locais.mjs`.
//
// Esqueleto visitável: quatro paredes, piso, ponto de partida e a porta de
// volta para a cidade. O recheio é feito no editor.

export const CENA_CASA_DE_PRAIA = {
  id: 'casa-de-praia',
  nome: 'Casa de Praia',
  endereco: 'Litoral',
  externo: true,

  ligacoes: {},

  decoracoes: [],

  passagens: [
    { gx: 13, gy: 18, para: 'cidade', rotulo: 'Voltar para a cidade' },
  ],

  chao: [
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
    'pppppppppppppppppppppppppp',
  ],

  objetos: [
    '##########################',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#............X...........#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#############.############',
  ],
};
