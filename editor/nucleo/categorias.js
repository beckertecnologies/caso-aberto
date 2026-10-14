// Agrupa os sprites do acervo por tipo, para a paleta não ser uma lista de
// oitocentos nomes crus.
//
// Os ids seguem a convenção dos pacotes: prefixo de três letras do pacote de
// origem, nome em camelCase e sufixo de orientação (_N, _S, _E, _W).

/** Pacote de origem, pelo prefixo do id. */
const PACOTES = {
  bas: 'Pisos',
  dng: 'Masmorra',
  frm: 'Fazenda',
  lib: 'Biblioteca',
};

/**
 * Regras por palavra-chave, na ordem. A primeira que casar decide o grupo,
 * então o que é mais específico vem antes.
 */
const REGRAS = [
  { grupo: 'piso', chaves: ['base', 'floorcarpet', 'dirttiles', 'stonetile', 'tiles'] },
  {
    grupo: 'parede',
    chaves: ['wall', 'column', 'archway', 'fence', 'railing', 'gate', 'door', 'window'],
  },
  { grupo: 'estrutura', chaves: ['stairs', 'step', 'bridge', 'roof', 'chimney', 'planks', 'ladder', 'platform'] },
  {
    grupo: 'movel',
    chaves: [
      'table', 'chair', 'bookcase', 'bookstand', 'desk', 'bench', 'bed', 'cabinet',
      'displaycase', 'shelf', 'stool', 'chest', 'barrel', 'crate', 'box',
    ],
  },
  { grupo: 'vegetacao', chaves: ['tree', 'bush', 'plant', 'corn', 'hay', 'flower', 'grass', 'crop', 'log'] },
  { grupo: 'luz', chaves: ['candle', 'lamp', 'lantern', 'torch', 'fire', 'brazier'] },
];

export const GRUPOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'piso', rotulo: 'Pisos' },
  { id: 'parede', rotulo: 'Paredes' },
  { id: 'estrutura', rotulo: 'Estrutura' },
  { id: 'movel', rotulo: 'Móveis' },
  { id: 'vegetacao', rotulo: 'Vegetação' },
  { id: 'luz', rotulo: 'Luz' },
  { id: 'outro', rotulo: 'Outros' },
];

/**
 * Classifica um id de sprite.
 * @returns {{grupo:string, pacote:string, nome:string, orientacao:string}}
 */
export function classificar(id) {
  const prefixo = id.slice(0, 3);
  const pacote = PACOTES[prefixo] ?? 'Avulso';
  const semPrefixo = PACOTES[prefixo] ? id.slice(4) : id;

  const orientacaoAchada = semPrefixo.match(/_([NSEW])$/);
  const orientacao = orientacaoAchada ? orientacaoAchada[1] : '';
  const nome = orientacaoAchada ? semPrefixo.slice(0, -2) : semPrefixo;

  const busca = nome.toLowerCase();
  const regra = REGRAS.find((r) => r.chaves.some((chave) => busca.includes(chave)));

  return { grupo: regra?.grupo ?? 'outro', pacote, nome, orientacao };
}

/**
 * As quatro orientações, em sentido horário.
 *
 * O acervo traz os mesmos 205 modelos quatro vezes, um por orientação. Listar
 * as 820 variantes na paleta é desperdício de rolagem: é a mesma peça virada.
 * Com o giro, a paleta mostra o modelo e a orientação vira uma tecla.
 */
export const ORIENTACOES = ['N', 'E', 'S', 'W'];

/** Separa um id em modelo e orientação: `frm_roof_N` → `frm_roof` + `N`. */
export function separarOrientacao(id) {
  const achado = id.match(/^(.*)_([NSEW])$/);
  return achado ? { base: achado[1], orientacao: achado[2] } : { base: id, orientacao: '' };
}

/**
 * A orientação seguinte de uma peça, pulando as que o acervo não tem.
 *
 * `passo` positivo gira no sentido horário. Devolve a mesma quando o modelo só
 * existe numa orientação — girar o que não gira não deve travar nada.
 * @param {string[]} disponiveis
 */
export function girarOrientacao(atual, disponiveis, passo = 1) {
  const ordem = ORIENTACOES.filter((o) => disponiveis.includes(o));
  if (ordem.length < 2) return ordem[0] ?? atual;
  const i = ordem.indexOf(atual);
  if (i < 0) return ordem[0];
  return ordem[(i + passo + ordem.length * 2) % ordem.length];
}

/**
 * Agrupa ids por modelo, juntando as orientações de cada um.
 * @param {string[]} ids
 * @returns {Map<string, {orientacoes:string[], ids:Record<string,string>}>}
 */
export function agruparPorFamilia(ids) {
  const familias = new Map();
  for (const id of ids) {
    const { base, orientacao } = separarOrientacao(id);
    if (!familias.has(base)) familias.set(base, { orientacoes: [], ids: {} });
    const familia = familias.get(base);
    const chave = orientacao || '—';
    if (!familia.ids[chave]) {
      familia.orientacoes.push(chave);
      familia.ids[chave] = id;
    }
  }
  for (const familia of familias.values()) {
    familia.orientacoes.sort((a, b) => ORIENTACOES.indexOf(a) - ORIENTACOES.indexOf(b));
  }
  return familias;
}

/**
 * Filtra modelos para a paleta — um item por modelo, não por orientação.
 * @param {string[]} ids
 * @param {{grupo?:string, termo?:string}} filtro
 */
export function filtrarFamilias(ids, { grupo = 'todos', termo = '' } = {}) {
  const busca = termo.trim().toLowerCase();

  return [...agruparPorFamilia(ids)]
    .map(([base, familia]) => {
      // A classificação vale para o modelo: as quatro orientações da mesma peça
      // caem sempre no mesmo grupo.
      const amostra = familia.ids[familia.orientacoes[0]];
      return { base, ...classificar(amostra), ...familia };
    })
    .filter((item) => {
      if (grupo !== 'todos' && item.grupo !== grupo) return false;
      if (busca && !item.base.toLowerCase().includes(busca)) return false;
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Filtra e ordena ids para a paleta.
 * @param {string[]} ids
 * @param {{grupo?:string, termo?:string, orientacao?:string}} filtro
 */
export function filtrar(ids, { grupo = 'todos', termo = '', orientacao = '' } = {}) {
  const busca = termo.trim().toLowerCase();

  return ids
    .map((id) => ({ id, ...classificar(id) }))
    .filter((item) => {
      if (grupo !== 'todos' && item.grupo !== grupo) return false;
      if (orientacao && item.orientacao && item.orientacao !== orientacao) return false;
      if (busca && !item.id.toLowerCase().includes(busca)) return false;
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome) || a.orientacao.localeCompare(b.orientacao));
}

/**
 * Quantos modelos há em cada grupo, para mostrar no filtro.
 *
 * Conta modelo e não arquivo: com as quatro orientações juntas, o número no chip
 * batia quatro vezes o que a paleta mostrava.
 */
export function contarPorGrupo(ids) {
  const contagem = new Map(GRUPOS.map((g) => [g.id, 0]));
  for (const [, familia] of agruparPorFamilia(ids)) {
    const { grupo } = classificar(familia.ids[familia.orientacoes[0]]);
    contagem.set(grupo, (contagem.get(grupo) ?? 0) + 1);
    contagem.set('todos', contagem.get('todos') + 1);
  }
  return contagem;
}
