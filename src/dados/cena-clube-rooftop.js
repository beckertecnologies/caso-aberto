// Clube Rooftop — criado por `node tools/montar-locais.mjs`.
//
// Esqueleto visitável: quatro paredes, piso, ponto de partida e a porta de
// volta para a cidade. O recheio é feito no editor.

export const CENA_CLUBE_ROOFTOP = {
  id: 'clube-rooftop',
  nome: 'Clube Rooftop',
  endereco: 'Cobertura, Centro',

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
