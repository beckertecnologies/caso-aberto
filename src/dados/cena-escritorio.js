// SEGUNDA CENA — o escritório da transportadora da vítima.
//
// Mesmas regras do apartamento: as duas matrizes são texto puro, todas as linhas
// com o mesmo comprimento. O `npm run check` confere e aponta a linha com erro.
//
// CHÃO:            OBJETOS:
//   (espaço) vazio   .  nada          K  bancada
//   w  tábua         #  parede        P  vaso
//   t  ladrilho      d  passagem      L  luminária
//   c  tapete        T  mesa          F  pasta da perícia
//   p  calçada       V  estante       1  passagem para a rua (`ligacoes`)
//                    A  armário       *  ponto onde um vestígio pode surgir
//                    D  escrivaninha  X  onde o detetive chega

export const CENA_ESCRITORIO = {
  id: 'escritorio',
  nome: 'Transportadora Vilar',
  endereco: 'Avenida Sete de Abril, 1140 — sala comercial',

  // A passagem "1" na calçada devolve o detetive para a rua.
  ligacoes: {
    1: { para: 'cidade', rotulo: 'Voltar para a rua' },
  },

  chao: [
    '                          ',
    '                          ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwcccccccwwwwwwwwwwww  ',
    '  wwwcccccccwwwwwwwwwwww  ',
    '  wwwcccccccwwwwwwwwwwww  ',
    '  wwwcccccccwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwttttw  ',
    '  wwwwwwwwwwwwwwwwwttttw  ',
    '  wwwwwwwwwwwwwwwwwttttw  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '          pppppp          ',
    '          pppppp          ',
  ],

  objetos: [
    '..........................',
    '..........................',
    '..######################..',
    '..#L.....*...#........A#..',
    '..#.........V#..D......#..',
    '..#.*........#......*..#..',
    '..#....TT....d.........#..',
    '..#..........#....F....#..',
    '..#........*.#.*.......#..',
    '..#..........#.........#..',
    '..#####d##########d#####..',
    '..#.*.........VV.......#..',
    '..#..D...D..........*..#..',
    '..#.....*........*.....#..',
    '..#*...............KKK.#..',
    '..#....F..............*#..',
    '..#P........X...*......#..',
    '..##########d###########..',
    '............1.............',
    '..........................',
  ],
};
