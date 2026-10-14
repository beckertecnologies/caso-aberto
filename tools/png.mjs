// Leitura e escrita de PNG sem dependência externa.
//
// O projeto não tem pacote nenhum instalado e não vai ter por causa de um
// recorte de sprite: zlib vem no Node, e o resto do PNG é desfiltragem de
// scanline. Cobre o que as ferramentas de arte exportam: paleta de 8 bits,
// cinza, RGB e RGBA, sem entrelaçamento.
//
// A escrita sai sempre como RGBA de 8 bits com filtro 0, que é o caso mais
// simples e o que basta para gravar recortes.

import { deflateSync, inflateSync } from 'node:zlib';

const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Percorre os pedaços de um PNG. */
function lerChunks(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('não é PNG');
  const chunks = [];
  let pos = 8;
  while (pos < buf.length) {
    const tamanho = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    chunks.push({ tipo, dados: buf.subarray(pos + 8, pos + 8 + tamanho) });
    pos += 12 + tamanho;
    if (tipo === 'IEND') break;
  }
  return chunks;
}

/** Desfaz o filtro de uma linha, conforme a especificação do PNG. */
function desfiltrar(filtro, atual, anterior, bpp) {
  const n = atual.length;
  for (let i = 0; i < n; i += 1) {
    const a = i >= bpp ? atual[i - bpp] : 0;
    const b = anterior[i];
    const c = i >= bpp ? anterior[i - bpp] : 0;
    switch (filtro) {
      case 1:
        atual[i] = (atual[i] + a) & 255;
        break;
      case 2:
        atual[i] = (atual[i] + b) & 255;
        break;
      case 3:
        atual[i] = (atual[i] + ((a + b) >> 1)) & 255;
        break;
      case 4: {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        atual[i] = (atual[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Decodifica um PNG para RGBA de 8 bits.
 * @param {Buffer} buf
 * @returns {{largura:number, altura:number, rgba:Uint8Array}}
 */
export function decodificar(buf) {
  const chunks = lerChunks(buf);
  const ihdr = chunks.find((c) => c.tipo === 'IHDR');
  if (!ihdr) throw new Error('sem IHDR');

  const largura = ihdr.dados.readUInt32BE(0);
  const altura = ihdr.dados.readUInt32BE(4);
  const profundidade = ihdr.dados[8];
  const tipoCor = ihdr.dados[9];
  const entrelacado = ihdr.dados[12];

  if (entrelacado !== 0) throw new Error('PNG entrelaçado não suportado');
  if (profundidade !== 8) throw new Error(`profundidade ${profundidade} não suportada`);
  const canais = CANAIS[tipoCor];
  if (!canais) throw new Error(`tipo de cor ${tipoCor} não suportado`);

  const paleta = chunks.find((c) => c.tipo === 'PLTE')?.dados ?? null;
  const trns = chunks.find((c) => c.tipo === 'tRNS')?.dados ?? null;
  const dados = inflateSync(
    Buffer.concat(chunks.filter((c) => c.tipo === 'IDAT').map((c) => c.dados)),
  );

  const bpp = canais;
  const porLinha = largura * bpp;
  const rgba = new Uint8Array(largura * altura * 4);
  let anterior = Buffer.alloc(porLinha);
  let pos = 0;

  for (let y = 0; y < altura; y += 1) {
    const filtro = dados[pos];
    pos += 1;
    const atual = Buffer.from(dados.subarray(pos, pos + porLinha));
    pos += porLinha;
    desfiltrar(filtro, atual, anterior, bpp);

    for (let x = 0; x < largura; x += 1) {
      const fonte = x * bpp;
      const destino = (y * largura + x) * 4;
      let r;
      let g;
      let b;
      let a = 255;

      if (tipoCor === 0) {
        r = atual[fonte];
        g = r;
        b = r;
      } else if (tipoCor === 4) {
        r = atual[fonte];
        g = r;
        b = r;
        a = atual[fonte + 1];
      } else if (tipoCor === 2) {
        r = atual[fonte];
        g = atual[fonte + 1];
        b = atual[fonte + 2];
      } else if (tipoCor === 6) {
        r = atual[fonte];
        g = atual[fonte + 1];
        b = atual[fonte + 2];
        a = atual[fonte + 3];
      } else {
        const indice = atual[fonte];
        r = paleta ? paleta[indice * 3] : indice;
        g = paleta ? paleta[indice * 3 + 1] : indice;
        b = paleta ? paleta[indice * 3 + 2] : indice;
        a = trns ? (trns[indice] ?? 255) : 255;
      }

      rgba[destino] = r;
      rgba[destino + 1] = g;
      rgba[destino + 2] = b;
      rgba[destino + 3] = a;
    }

    anterior = atual;
  }

  return { largura, altura, rgba };
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = TABELA_CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

/**
 * Codifica RGBA de 8 bits como PNG.
 * @param {{largura:number, altura:number, rgba:Uint8Array}} imagem
 * @returns {Buffer}
 */
export function codificar({ largura, altura, rgba }) {
  const bruto = Buffer.alloc(altura * (largura * 4 + 1));
  for (let y = 0; y < altura; y += 1) {
    const destino = y * (largura * 4 + 1);
    bruto[destino] = 0; // filtro 0: sem filtro
    Buffer.from(rgba.buffer, rgba.byteOffset + y * largura * 4, largura * 4).copy(
      bruto,
      destino + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(bruto, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Pixel em (x, y) como `[r, g, b, a]`. */
export function pixel(img, x, y) {
  const i = (y * img.largura + x) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], img.rgba[i + 3]];
}
