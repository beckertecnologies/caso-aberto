// Os locais do mundo — única fonte da verdade.
//
// Esta lista existe separada do `main.js` por um motivo prático: o `main.js`
// mexe em canvas e janela, então as ferramentas de linha de comando não podem
// importá-lo. Com a lista aqui, o jogo e o `npm run check` leem o mesmo lugar,
// e um local criado pelo editor já entra nas checagens em vez de passar batido.
//
// O editor acrescenta o import e o nome na lista automaticamente ao criar um
// local novo. Dá para mexer à mão também: é só seguir o padrão.

import { CENA_CIDADE } from './cena-cidade.js';
import { CENA_APTO_302 } from './cena-apto302.js';
import { CENA_ESCRITORIO } from './cena-escritorio.js';
import { CENA_DELEGACIA } from './cena-delegacia.js';
import { CENA_BAR } from './cena-bar.js';

/**
 * O primeiro da lista é onde o detetive começa: a cidade funciona como praça
 * central, e os demais são alcançados pelas portas da rua.
 */
export const CENAS = [CENA_CIDADE, CENA_APTO_302, CENA_ESCRITORIO, CENA_DELEGACIA, CENA_BAR];
