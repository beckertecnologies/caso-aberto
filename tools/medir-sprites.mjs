// Acha, no acervo de sprites, onde fica a célula da grade dentro da moldura.
//
// O problema que isto resolve
// ---------------------------
// Antes a conta era por sprite: a escala vinha da largura da imagem dividida
// por uma referência tirada de um pacote, e a âncora vinha do pixel opaco mais
// baixo. Duas coisas davam errado.
//
// Primeiro, a referência estava em 146 px por tile, medida nas bases de
// miniatura (`bas_base_*`), que são pedestais e não lajes de terreno. A laje de
// verdade — `dng_dirt`, `frm_dirt` — ocupa 256 px. Resultado: toda peça saía
// desenhada 1,75 vez maior que a célula, e piso colado em piso se sobrepunha.
//
// Segundo, ancorar pelo pixel mais baixo dá um deslocamento diferente para cada
// sprite: numa laje o pixel mais baixo é a quina da borda, numa parede é o pé
// da quina da frente. Peças vizinhas então não encostavam — cada uma assentava
// num lugar ligeiramente diferente.
//
// Como funciona agora
// -------------------
// Pacote isométrico é exportado em moldura de tamanho fixo com a célula sempre
// no mesmo lugar — é isso que faz o tileset encaixar. Então basta achar a
// célula uma vez por moldura e aplicar a todos os sprites dela.
//
// A medida vem da **primeira linha que ocupa a largura inteira da moldura**.
// Numa laje 1×1 essa linha é o eixo horizontal do losango, que passa exatamente
// pelo centro da célula. Não depende de borda, nem de altura, nem de conteúdo.
// No acervo atual 59 sprites concordam na linha 437 de uma moldura 256×512.
//
// Uso: `npm run assets` chama isto automaticamente. Para rodar só a medição:
//   node tools/medir-sprites.mjs
//
// Decodifica PNG sem dependência: zlib do Node mais desfiltragem de scanline.
// Cobre os formatos que o Kenney exporta (paleta de 8 bits e RGBA).

import { readdir, readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { join, resolve, extname, basename } from 'node:path';

const LARGURA_TILE = 64;
const MEIA_ALTURA_TILE = 16;

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA = join(RAIZ, 'assets', 'pecas');

/** Lê os pedaços de um PNG. */
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

const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Devolve a matriz de opacidade da imagem.
 * @returns {{largura:number, altura:number, alfa:Uint8Array}}
 */
function lerAlfa(buf) {
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

  const trns = chunks.find((c) => c.tipo === 'tRNS')?.dados ?? null;
  const dados = inflateSync(
    Buffer.concat(chunks.filter((c) => c.tipo === 'IDAT').map((c) => c.dados)),
  );

  const bpp = canais;
  const porLinha = largura * bpp;
  const alfa = new Uint8Array(largura * altura);
  const anterior = Buffer.alloc(porLinha);
  let atual = Buffer.alloc(porLinha);
  let pos = 0;

  for (let y = 0; y < altura; y += 1) {
    const filtro = dados[pos];
    pos += 1;
    dados.copy(atual, 0, pos, pos + porLinha);
    pos += porLinha;

    // Desfiltragem conforme a especificação do PNG.
    for (let i = 0; i < porLinha; i += 1) {
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
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          atual[i] = (atual[i] + pred) & 255;
          break;
        }
        default:
          break;
      }
    }

    for (let x = 0; x < largura; x += 1) {
      const base = x * bpp;
      let opacidade = 255;
      if (tipoCor === 3) opacidade = trns ? (trns[atual[base]] ?? 255) : 255;
      else if (tipoCor === 4) opacidade = atual[base + 1];
      else if (tipoCor === 6) opacidade = atual[base + 3];
      alfa[y * largura + x] = opacidade;
    }

    atual.copy(anterior);
    atual = Buffer.alloc(porLinha);
  }

  return { largura, altura, alfa };
}

export const lerAlfaDe = lerAlfa;
export const recorteDe = recorte;

/** Recorte dos pixels com alguma opacidade. */
function recorte({ largura, altura, alfa }) {
  let esq = largura;
  let dir = -1;
  let topo = altura;
  let base = -1;
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      if (alfa[y * largura + x] < 8) continue;
      if (x < esq) esq = x;
      if (x > dir) dir = x;
      if (y < topo) topo = y;
      if (y > base) base = y;
    }
  }
  if (dir < 0) return null;
  return { esq, dir, topo, base, largura, altura };
}

/**
 * Primeira linha cujo alfa cobre a largura inteira da moldura.
 *
 * Numa laje 1×1 é o eixo horizontal do losango — a linha que liga os vértices
 * esquerdo e direito —, e ela passa pelo centro da célula. Devolve -1 quando o
 * sprite não encosta nas duas bordas (parede, móvel, qualquer coisa estreita).
 */
function linhaCheia({ largura, altura, alfa }) {
  for (let y = 0; y < altura; y += 1) {
    let cheia = true;
    for (let x = 0; x < largura; x += 1) {
      if (alfa[y * largura + x] < 8) {
        cheia = false;
        break;
      }
    }
    if (cheia) return y;
  }
  return -1;
}

/** Valor que mais aparece numa lista de números. */
function moda(valores) {
  const contagem = new Map();
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  let melhor = null;
  let maior = 0;
  for (const [v, n] of contagem) {
    if (n > maior) {
      maior = n;
      melhor = v;
    }
  }
  return { valor: melhor, quantos: maior };
}

/**
 * Âncora de recurso, para moldura em que nenhuma laje encosta nas duas bordas.
 *
 * Põe o pixel opaco mais baixo meia altura de tile abaixo do centro. É pior que
 * a medida pela célula — cada sprite assenta um pouco diferente —, mas é melhor
 * que chutar, e só entra em acervo que não traga laje de piso.
 */
function ancoraPeloRecorte(r, celula) {
  return (r.base + 1 - celula / 4) / r.altura;
}

/** Mede todos os sprites da pasta de peças. */
export async function medirPecas() {
  let arquivos = [];
  try {
    arquivos = await readdir(PASTA, { withFileTypes: true });
  } catch {
    return {};
  }

  // Primeiro passe: recorte, moldura e eixo da célula de cada sprite.
  const brutos = {};
  for (const arquivo of arquivos) {
    if (!arquivo.isFile() || extname(arquivo.name).toLowerCase() !== '.png') continue;
    const id = basename(arquivo.name, '.png');
    try {
      const alfa = lerAlfa(await readFile(join(PASTA, arquivo.name)));
      const r = recorte(alfa);
      if (!r) continue;
      brutos[id] = { ...r, eixo: linhaCheia(alfa) };
    } catch (erro) {
      console.warn(`  aviso: não foi possível medir ${arquivo.name} — ${erro.message}`);
    }
  }

  // Segundo passe: uma célula por moldura, aplicada a todos os sprites dela.
  //
  // Agrupar por moldura e não por pacote é de propósito: o que define o encaixe
  // é a moldura de exportação. Dois pacotes com a mesma moldura compartilham a
  // célula e se misturam sem desalinhar, que é justamente o que se quer.
  const porMoldura = new Map();
  for (const [id, b] of Object.entries(brutos)) {
    const chave = `${b.largura}x${b.altura}`;
    if (!porMoldura.has(chave)) porMoldura.set(chave, []);
    porMoldura.get(chave).push(id);
  }

  const medidas = {};
  const molduras = [];

  for (const [chave, ids] of porMoldura) {
    const largura = brutos[ids[0]].largura;
    const altura = brutos[ids[0]].altura;
    const eixos = ids.map((id) => brutos[id].eixo).filter((y) => y >= 0);
    const { valor: centro, quantos } = moda(eixos);

    molduras.push({ moldura: chave, sprites: ids.length, centro, concordam: quantos });

    for (const id of ids) {
      const b = brutos[id];
      // A moldura inteira vale uma célula, então uma célula vale um tile.
      const ancora = centro !== null ? centro / altura : ancoraPeloRecorte(b, largura);
      medidas[id] = {
        ancora: Math.round(ancora * 10000) / 10000,
        escala: 1,
        recorte: `${b.dir - b.esq + 1}x${b.base - b.topo + 1}`,
      };
    }
  }

  medidas['@referencia'] = { molduras };
  return medidas;
}

// Execução direta mostra a tabela de medidas.
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const medidas = await medirPecas();
  const molduras = medidas['@referencia']?.molduras ?? [];
  delete medidas['@referencia'];
  for (const m of molduras) {
    console.log(
      `moldura ${m.moldura}: ${m.sprites} sprite(s), ` +
        `centro da célula na linha ${m.centro ?? '—'} (${m.concordam} concordam)`,
    );
  }
  console.log();
  const ids = Object.keys(medidas).sort();
  if (!ids.length) {
    console.log('Nenhum sprite em assets/pecas/.');
  } else {
    console.log('peça'.padEnd(16), 'recorte'.padEnd(12), 'âncora'.padEnd(8), 'escala');
    for (const id of ids) {
      const m = medidas[id];
      console.log(id.padEnd(16), m.recorte.padEnd(12), String(m.ancora).padEnd(8), m.escala);
    }
  }
}
