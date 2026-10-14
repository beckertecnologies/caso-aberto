// A CIDADE — o espaço que liga os locais da investigação.
//
// É daqui que o detetive parte e para onde ele volta. Os prédios são blocos
// maciços: o interior de cada um é uma cena própria, alcançada pela passagem
// marcada na fachada.
//
// Esta cena não tem pontos de vestígio. A investigação acontece dentro dos
// locais; a rua serve para circular, e a banca de jornal dá o que ler no caminho.
//
// CHÃO:            OBJETOS:
//   (espaço) vazio   .  nada          Y  árvore
//   p  calçada       #  prédio        H  banco
//   a  asfalto       L  poste         J  banca de jornal
//   g  grama         X  onde o detetive começa
//                    1  entrada do edifício (ver `ligacoes`)
//                    2  entrada da transportadora

export const CENA_CIDADE = {
  id: 'cidade',
  nome: 'Rua das Acácias',
  endereco: 'quadra entre a Sete de Abril e a praça',

  // Cada caractere de passagem aponta para outro local.
  ligacoes: {
    1: { para: 'apto-302', rotulo: 'Edifício Acácias — entrada do 302' },
    2: { para: 'escritorio', rotulo: 'Transportadora Vilar — portaria' },
  },

  chao: [
    '                                  ',
    '                                  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ',
    '  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ',
    '  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pppppppppppppppppppppppppppppp  ',
    '  pgggggggggggggggggggggggggggap  ',
    '  pgggggggggggggggggggggggggggap  ',
    '  pgggggggggggggggggggggggggggap  ',
    '  pgggggggggggggggggggggggggggap  ',
    '  pgggggggggggggggggggggggggggap  ',
    '  pgggggggggggggggggggggggggggap  ',
    '  pppppppppppppppppppppppppppppp  ',
    '                                  ',
  ],

  objetos: [
    '..................................',
    '..................................',
    '....###########.....###########...',
    '....###########.....###########...',
    '....###########.....###########...',
    '....###########.....###########...',
    '....###########.....###########...',
    '....###########.....###########...',
    '....#####1#####.....#####2#####...',
    '...L..........................L...',
    '.................X................',
    '..................................',
    '..................................',
    '..................................',
    '.............J....................',
    '..................................',
    '.....Y......Y......Y.......Y......',
    '........H.................H.......',
    '..................................',
    '......Y..........L.........Y......',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
  ],
};
