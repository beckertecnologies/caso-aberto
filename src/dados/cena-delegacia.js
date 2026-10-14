// DELEGACIA DO 4º DISTRITO — onde o caso é formalizado.
//
// Local de serviço: não há vestígio para recolher aqui. O que existe é a
// papelada do inquérito e a mesa de registro, onde a acusação é assinada.
// Por isso a cena não tem nenhum ponto `*` — o gerador simplesmente a ignora
// ao plantar vestígios.
//
// CHÃO:            OBJETOS:
//   (espaço) vazio   .  nada          V  arquivo
//   t  ladrilho      #  parede        H  banco
//   p  calçada       d  passagem      P  vaso
//                    K  balcão        F  pasta do inquérito
//                    D  escrivaninha  W  mesa de registro (formaliza a acusação)
//                    L  luminária     1  passagem para a rua (ver `ligacoes`)
//                                     X  onde o detetive chega

export const CENA_DELEGACIA = {
  id: 'delegacia',
  nome: 'Delegacia do 4º Distrito',
  endereco: 'Praça das Acácias, sem número',

  ligacoes: {
    1: { para: 'cidade', rotulo: 'Voltar para a praça' },
  },

  chao: [
    '                          ',
    '                          ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '  tttttttttttttttttttttt  ',
    '          pppppp          ',
    '          pppppp          ',
  ],

  objetos: [
    '..........................',
    '..........................',
    '..######################..',
    '..#KKKK......L#.VVV....#..',
    '..#...........#........#..',
    '..#......D....#......V.#..',
    '..#...........d........#..',
    '..#........F..#....F...#..',
    '..#...........#........#..',
    '..#####d##########d#####..',
    '..#....................#..',
    '..#.........W..........#..',
    '..#....................#..',
    '..#...H...........H....#..',
    '..#P........X.........P#..',
    '..##########d###########..',
    '............1.............',
    '..........................',
  ],
};
