// Hotel de Luxo — criado por `node tools/montar-locais.mjs`.
//
// Esqueleto visitável: quatro paredes, piso, ponto de partida e a porta de
// volta para a cidade. O recheio é feito no editor.

export const CENA_HOTEL_DE_LUXO = {
  id: 'hotel-de-luxo',
  nome: 'Hotel de Luxo',
  endereco: 'Beira-mar',

  ligacoes: {},

  decoracoes: [],

  passagens: [
    { gx: 13, gy: 18, para: 'cidade', rotulo: 'Voltar para a cidade' },
  ],

  chao: [
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
    'tttttttttttttttttttttttttt',
  ],

  objetos: [
    '##########################',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#...........*............#',
    '#...........*............#',
    '#.........*..*...........#',
    '#........................#',
    '#............X...........#',
    '#........................#',
    '#...........*............#',
    '#.........*..............#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#############.############',
  ],
};
