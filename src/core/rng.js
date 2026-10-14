// Aleatoriedade determinística: a mesma semente sempre monta o mesmo mistério.
// Isso deixa a investigação reproduzível (bom para depurar e para compartilhar um caso).

/** Mistura uma string em um inteiro de 32 bits (xmur3). */
function misturar(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i += 1) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Gerador mulberry32: rápido, pequeno e estável entre execuções. */
function mulberry32(estado) {
  let a = estado >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cria um gerador com utilitários de sorteio.
 * @param {string|number} semente
 */
export function criarRng(semente) {
  const proximo = mulberry32(misturar(String(semente))());
  return {
    /** Decimal em [0, 1). */
    decimal: proximo,
    /** Inteiro em [0, limite). */
    inteiro: (limite) => Math.floor(proximo() * limite),
    /** Um item qualquer da lista. */
    sortear: (lista) => lista[Math.floor(proximo() * lista.length)],
    /** Cópia embaralhada (Fisher-Yates). */
    embaralhar: (lista) => {
      const copia = lista.slice();
      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(proximo() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    },
    /** Até `quantidade` itens distintos. */
    amostrar: (lista, quantidade) => {
      const copia = lista.slice();
      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(proximo() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia.slice(0, Math.max(0, Math.min(quantidade, copia.length)));
    },
  };
}

const SILABAS = ['bra', 'cor', 'dim', 'fen', 'gal', 'hor', 'lun', 'mer', 'nov', 'pra', 'sal', 'tor', 'vel', 'zan'];

/** Semente curta e pronunciável, no formato "corlun-48". */
export function sementeAleatoria() {
  const n = () => Math.floor(Math.random() * SILABAS.length);
  const numero = String(10 + Math.floor(Math.random() * 90));
  return `${SILABAS[n()]}${SILABAS[n()]}-${numero}`;
}
