// Gera uma planta da cena, vista de cima, para conferir um mapa sem abrir o
// navegador. Ortogonal de propósito: aqui o que importa é o traçado, e a
// projeção isométrica só atrapalharia a leitura.
//
// Uso: node tools/mapa-previa.mjs <id-da-cena> <saida.png> [escala]

import { writeFile } from 'node:fs/promises';
import { codificar } from './png.mjs';
import { CENAS } from '../src/dados/cenas.js';
import { Cena } from '../src/mundo/cena.js';

const [, , id = 'cidade', saida = 'planta.png', escalaTexto = '4'] = process.argv;
const escala = Number(escalaTexto);

const dados = CENAS.find((c) => c.id === id);
if (!dados) {
  console.error(`cena "${id}" não existe. Há: ${CENAS.map((c) => c.id).join(', ')}`);
  process.exit(2);
}
const cena = new Cena(dados);

const CORES = {
  vazio: [18, 20, 26],
  agua: [28, 58, 82],
  asfalto: [74, 78, 86],
  calcada: [132, 128, 118],
  grama: [58, 82, 56],
  ladrilho: [150, 140, 120],
  outro: [100, 96, 90],
  predio: [196, 176, 140],
  objeto: [120, 110, 96],
  decoracao: [176, 132, 70],
  passagem: [240, 200, 126],
  vestigio: [226, 96, 86],
  inicio: [120, 210, 255],
};

const corDoChao = (def) => {
  if (!def) return CORES.vazio;
  // O tile vazio não é nulo: ele tem material próprio (`concreto`), e por isso
  // caía no caso genérico e saía da mesma cor de uma calçada. Numa planta onde
  // o que se julga é o traçado, isso é o pior erro possível.
  if (def.material === 'concreto') return CORES.vazio;
  if (def.material === 'agua') return CORES.agua;
  if (def.material === 'asfalto') return CORES.asfalto;
  if (def.material === 'calcada') return CORES.calcada;
  if (def.material === 'grama') return CORES.grama;
  if (def.material === 'ladrilho') return CORES.ladrilho;
  return CORES.outro;
};

const img = {
  largura: cena.largura * escala,
  altura: cena.altura * escala,
  rgba: new Uint8Array(cena.largura * escala * cena.altura * escala * 4),
};

function pintar(gx, gy, cor) {
  for (let y = 0; y < escala; y += 1) {
    for (let x = 0; x < escala; x += 1) {
      const d = ((gy * escala + y) * img.largura + gx * escala + x) * 4;
      img.rgba[d] = cor[0];
      img.rgba[d + 1] = cor[1];
      img.rgba[d + 2] = cor[2];
      img.rgba[d + 3] = 255;
    }
  }
}

// Camadas, de baixo para cima.
for (let gy = 0; gy < cena.altura; gy += 1) {
  for (let gx = 0; gx < cena.largura; gx += 1) pintar(gx, gy, corDoChao(cena.chao[gy][gx]));
}
for (let gy = 0; gy < cena.altura; gy += 1) {
  for (let gx = 0; gx < cena.largura; gx += 1) {
    const def = cena.objetos[gy][gx];
    if (!def) continue;
    if (def.solido) pintar(gx, gy, CORES.predio);
    else if (def.marcador === 'vestigio') pintar(gx, gy, CORES.vestigio);
    else if (def.marcador === 'inicio') pintar(gx, gy, CORES.inicio);
    else if (def.interacao === 'ligacao') pintar(gx, gy, CORES.passagem);
    else pintar(gx, gy, CORES.objeto);
  }
}
for (const d of cena.decoracoes) pintar(d.gx, d.gy, CORES.decoracao);
for (const p of cena.passagens) pintar(p.gx, p.gy, CORES.passagem);
pintar(cena.inicio.gx, cena.inicio.gy, CORES.inicio);

await writeFile(saida, codificar(img));

console.log(`planta de "${cena.id}": ${cena.largura}x${cena.altura} → ${saida}`);
console.log('  azul = partida · amarelo = passagem · vermelho = ponto de vestígio');
console.log('  creme = prédio · laranja = decoração · cinza escuro = asfalto');
