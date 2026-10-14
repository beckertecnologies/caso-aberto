// CENA DO CRIME — mapa de referência, editável à mão.
//
// Como mexer: as duas matrizes abaixo são só texto. Troque caracteres e recarregue
// a página. Todas as linhas precisam ter o mesmo comprimento (o `npm run check`
// confere isso e avisa se algo ficou fora do lugar).
//
// CHÃO:            OBJETOS:
//   (espaço) vazio   .  nada          K  bancada
//   w  tábua         #  parede        U  pia
//   t  ladrilho      d  passagem      P  vaso
//   c  tapete        S  sofá          L  luminária
//   p  calçada       T  mesa          O  marcação da vítima
//                    V  estante       F  pasta da perícia
//                    A  guarda-roupa  E  saída (encerra a investigação)
//                    B  cama          *  ponto onde um vestígio pode surgir
//                    D  escrivaninha  X  onde o detetive começa

export const CENA_APTO_302 = {
  id: 'apto-302',
  nome: 'Apartamento 302',
  endereco: 'Rua das Acácias, 302 — terceiro andar',

  chao: [
    '                          ',
    '                          ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwcccccwwwwwwwwwwwwww  ',
    '  wwwcccccwwwwwwwwwwwwww  ',
    '  wwwcccccwwwwwwwwwwwwww  ',
    '  wwwcccccwwwwwwwwwwwwww  ',
    '  wwwcccccwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '  wtttttttttwtttttwwwwww  ',
    '  wtttttttttwtttttwwwwww  ',
    '  wtttttttttwtttttwwwwww  ',
    '  wwwwwwwwwwwwwwwwwwwwww  ',
    '                  pppppp  ',
    '                  pppppp  ',
  ],

  objetos: [
    '..........................',
    '..........................',
    '..######################..',
    '..#L....*...#....*...A.#..',
    '..#.S.......#.......BB.#..',
    '..#.......V.#.*........#..',
    '..#..*......#..........#..',
    '..#....O....d..........#..',
    '..#.*.......#..........#..',
    '..#......T..#.D.F....*.#..',
    '..#..F....*.#..........#..',
    '..#.........#......*...#..',
    '..#####d#########d######..',
    '..#P............*......#..',
    '..#.......*............#..',
    '..#####d#######d####d###..',
    '..#KKKK.....#U....#..*.#..',
    '..#......*..#..*..#....#..',
    '..#.*.......#.....#.X..#..',
    '..##################d###..',
    '....................E.....',
    '..........................',
  ],
};
