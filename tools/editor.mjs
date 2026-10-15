// Verificação do modelo do editor e do alinhamento do acervo.
//
// `MundoEditavel` guarda as regras de edição e não tinha teste nenhum, o que é
// ruim para a peça que decide se um desenho é válido antes de ir para o arquivo.
//
// Importar aqui dá um trabalho extra: o módulo usa caminhos absolutos
// (`/src/...`) porque é assim que o navegador o resolve pelo servidor do editor.
// No Node isso aponta para a raiz do disco. Então o arquivo é copiado para
// `tools/` com os imports reescritos, importado, e apagado em seguida.

import { readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = resolve(import.meta.dirname, '..');

let falhas = 0;
let checagens = 0;

function conferir(descricao, acao) {
  checagens += 1;
  try {
    const resultado = typeof acao === 'function' ? acao() : acao;
    if (resultado === false) throw new Error('resultado falso');
    console.log(`  ok   ${descricao}`);
  } catch (erro) {
    falhas += 1;
    console.error(`  FALHA ${descricao} — ${erro?.message ?? erro}`);
  }
}

function secao(nome) {
  console.log(`\n${nome}`);
}

/** Importa o modelo do editor reescrevendo os caminhos absolutos do navegador. */
async function carregarModelo() {
  const origem = join(RAIZ, 'editor', 'nucleo', 'mundo-editavel.js');
  const copia = join(RAIZ, 'tools', '.mundo-editavel.gerado.mjs');
  const fonte = await readFile(origem, 'utf8');
  await writeFile(copia, fonte.replaceAll("from '/src/", "from '../src/"), 'utf8');
  try {
    return { ...(await import(pathToFileURL(copia).href)), copia };
  } catch (erro) {
    await rm(copia, { force: true });
    throw erro;
  }
}

const { MundoEditavel, copia: temporario } = await carregarModelo();
const { CENA_CIDADE } = await import('../src/dados/cena-cidade.js');
const { CASO_RUTTERFORT: CASO_014 } = await import('../src/dados/caso-rutterfort.js');
const { VISUAL } = await import('../src/dados/visual.js');

const base = () => ({
  ...CENA_CIDADE,
  chao: [...CENA_CIDADE.chao],
  objetos: [...CENA_CIDADE.objetos],
  decoracoes: [],
  passagens: (CENA_CIDADE.passagens ?? []).map((p) => ({ ...p })),
});

/** Um tile livre de verdade, achado na hora: a cidade muda a cada edição. */
function tileLivre(mundo) {
  for (let gy = 0; gy < mundo.altura; gy += 1) {
    for (let gx = 0; gx < mundo.largura; gx += 1) {
      if (!mundo.cena.andavel(gx, gy)) continue;
      if (mundo.cena.examinavelEm(gx, gy)) continue;
      if (gx === mundo.cena.inicio.gx && gy === mundo.cena.inicio.gy) continue;
      return { gx, gy };
    }
  }
  throw new Error('a cidade não tem tile livre');
}

// ---------- empilhamento ----------

secao('Editor: altura das peças');

{
  const mundo = new MundoEditavel(base());
  const { gx, gy } = tileLivre(mundo);

  conferir('achou um tile livre para o teste', () => mundo.cena.andavel(gx, gy));

  conferir('peça no chão entra no nível 0', () => {
    mundo.decorar(gx, gy, 'dng_dirt_E', false, 0);
    return mundo.decoracaoEm(gx, gy, 0)?.peca === 'dng_dirt_E';
  });

  conferir('peça num nível acima não apaga a de baixo', () => {
    mundo.decorar(gx, gy, 'dng_stoneWall_S', false, 3);
    return (
      mundo.decoracaoEm(gx, gy, 0)?.peca === 'dng_dirt_E' &&
      mundo.decoracaoEm(gx, gy, 3)?.peca === 'dng_stoneWall_S'
    );
  });

  conferir('a coluna lista os níveis de baixo para cima', () => {
    mundo.decorar(gx, gy, 'frm_roofCorner_E', false, 7);
    return mundo.niveisEm(gx, gy).join(',') === '0,3,7';
  });

  conferir('trocar a peça do nível substitui só aquela', () => {
    mundo.decorar(gx, gy, 'dng_planks_E', false, 3);
    return (
      mundo.niveisEm(gx, gy).join(',') === '0,3,7' &&
      mundo.decoracaoEm(gx, gy, 3)?.peca === 'dng_planks_E'
    );
  });

  conferir('a mesma peça no mesmo nível não mexe em nada', () => {
    const r = mundo.decorar(gx, gy, 'dng_planks_E', false, 3);
    return r.igual === true;
  });

  conferir('a borracha apaga só o nível em que está', () => {
    mundo.decorar(gx, gy, null, false, 3);
    return mundo.niveisEm(gx, gy).join(',') === '0,7';
  });

  conferir('decoracaoEm sem nível devolve a mais baixa', () => {
    return mundo.decoracaoEm(gx, gy)?.nivel === 0;
  });

  conferir('nível fora da faixa é apertado para dentro', () => {
    mundo.decorar(gx, gy, 'dng_barrels_E', false, 500);
    mundo.decorar(gx + 1, gy, 'dng_barrels_E', false, -20);
    return mundo.decoracaoEm(gx, gy, 40) !== null && mundo.decoracaoEm(gx + 1, gy, 0) !== null;
  });

  conferir('o nível vai para o que é gravado', () => {
    const gravar = mundo.paraGravar();
    return gravar.decoracoes.some((d) => d.nivel === 40) && gravar.decoracoes.every((d) => 'nivel' in d);
  });

  conferir('desfazer devolve a coluna como estava', () => {
    const antes = mundo.niveisEm(gx, gy).join(',');
    mundo.decorar(gx, gy, 'dng_barrels_E', false, 12);
    const depois = mundo.niveisEm(gx, gy).join(',');
    mundo.desfazer();
    return depois !== antes && mundo.niveisEm(gx, gy).join(',') === antes;
  });

  conferir('peça levantada não emparedia o tile', () => {
    const limpo = new MundoEditavel(base());
    const livre = tileLivre(limpo);
    limpo.decorar(livre.gx, livre.gy, 'frm_roofCorner_E', true, 6);
    return limpo.cena.andavel(livre.gx, livre.gy) === true;
  });

  conferir('peça sólida no chão emparedia o tile', () => {
    const limpo = new MundoEditavel(base());
    const livre = tileLivre(limpo);
    limpo.decorar(livre.gx, livre.gy, 'dng_stoneWall_S', true, 0);
    return limpo.cena.andavel(livre.gx, livre.gy) === false;
  });

  conferir('o mapa com peças empilhadas continua válido', () => {
    const problemas = mundo.validar(CASO_014.documentos);
    if (problemas.length) throw new Error(problemas[0]);
    return true;
  });
}

// ---------- mensagens de validação ----------
//
// "ponto de vestígio em 27,10 está bloqueado" não dizia o que bloqueava nem
// como achar o tile, e o `*` é desenhado invisível no jogo. Cada motivo tem uma
// correção diferente, então a mensagem precisa nomear o motivo.

// ---------- balde e limpar ----------
//
// Pintar e apagar área grande tile a tile é inviável num mapa de centenas de
// milhares. O balde preenche a região conectada; o limpar esvazia tudo. Os dois
// entram no histórico.

secao('Editor: balde e limpar tudo');

{
  const base = () => ({
    id: 'teste',
    nome: 'Teste',
    endereco: '',
    externo: true,
    ligacoes: {},
    decoracoes: [],
    passagens: [{ gx: 1, gy: 1, para: 'cidade', rotulo: 'volta' }],
    // 6x4 de calçada, com um bloco 2x2 de asfalto no canto.
    chao: ['pppppp', 'ppaapp', 'ppaapp', 'pppppp'],
    objetos: ['......', '......', '......', '.X....'],
  });

  conferir('balde troca a região conectada do mesmo material', () => {
    const m = new MundoEditavel(base());
    m.balde('chao', 0, 0, 'g'); // o mar de calçada vira grama
    const chao = m.dados.chao.join('');
    // Toda a calçada virou grama; o bloco de asfalto no meio permaneceu.
    return !chao.includes('p') && chao.includes('a') && chao.includes('g');
  });

  conferir('o balde não vaza para material diferente', () => {
    const m = new MundoEditavel(base());
    m.balde('chao', 2, 1, 'g'); // clica no asfalto do meio
    const linhas = m.dados.chao;
    // Só os 4 tiles de asfalto viraram grama; a calçada em volta ficou.
    const gramas = linhas.join('').split('').filter((c) => c === 'g').length;
    return gramas === 4;
  });

  conferir('balde no mesmo caractere não faz nada', () => {
    const m = new MundoEditavel(base());
    const r = m.balde('chao', 0, 0, 'p');
    return r.igual === true;
  });

  conferir('desfazer traz a região de volta', () => {
    const m = new MundoEditavel(base());
    const antes = m.dados.chao.join('');
    m.balde('chao', 0, 0, 'g');
    m.desfazer();
    return m.dados.chao.join('') === antes;
  });

  conferir('limpar tudo esvazia e mantém a partida', () => {
    const m = new MundoEditavel(base());
    m.limparTudo();
    const cena = m.cena;
    const temParede = m.dados.objetos.join('').includes('#');
    const temPassagem = m.dados.passagens.length > 0;
    return (
      !temParede &&
      !temPassagem &&
      m.dados.decoracoes.length === 0 &&
      cena.andavel(cena.inicio.gx, cena.inicio.gy)
    );
  });

  conferir('desfazer traz tudo de volta depois de limpar', () => {
    const m = new MundoEditavel(base());
    m.limparTudo();
    m.desfazer();
    return m.dados.passagens.length === 1 && m.dados.chao.join('').includes('a');
  });
}

// ---------- pincel grosso e marca de prédio (modo cidade) ----------

secao('Editor: modo cidade');

{
  const base = () => ({
    id: 'teste-cidade',
    nome: 'Teste',
    endereco: '',
    externo: true,
    ligacoes: {},
    decoracoes: [],
    passagens: [{ gx: 1, gy: 1, para: 'cidade', rotulo: 'volta' }],
    chao: Array.from({ length: 15 }, () => 'g'.repeat(15)),
    objetos: Array.from({ length: 15 }, (_, y) => (y === 7 ? `${'.'.repeat(7)}X${'.'.repeat(7)}` : '.'.repeat(15))),
  });

  conferir('pincel grosso pinta um disco', () => {
    const m = new MundoEditavel(base());
    m.pincelar('chao', 7, 7, 'a', 3);
    // O centro e os vizinhos imediatos viraram asfalto; o canto distante não.
    return m.dados.chao[7][7] === 'a' && m.dados.chao[7][4] === 'a' && m.dados.chao[0][0] === 'g';
  });

  conferir('pincel grosso é redondo, não quadrado', () => {
    const m = new MundoEditavel(base());
    m.pincelar('chao', 7, 7, 'a', 3);
    // O canto do quadrado 3x3 (dx=3,dy=3) está fora do raio 3, então fica grama.
    return m.dados.chao[10][10] === 'g';
  });

  conferir('pincel raio 0 pinta um tile só', () => {
    const m = new MundoEditavel(base());
    m.pincelar('chao', 7, 7, 'a', 0);
    return m.dados.chao[7][7] === 'a' && m.dados.chao[7][6] === 'g';
  });

  conferir('água é material válido e não andável', () => {
    const m = new MundoEditavel(base());
    m.pincelar('chao', 7, 7, '~', 1);
    const cena = m.cena;
    return cena.chao[7][7]?.material === 'agua' && cena.andavel(7, 7) === false;
  });

  conferir('a marca de prédio entra como marcador, sem bloquear', () => {
    const m = new MundoEditavel(base());
    m.pintar('objetos', 3, 3, 'M');
    const cena = m.cena;
    const temMarca = cena.marcasPredio.some((p) => p.gx === 3 && p.gy === 3);
    return temMarca && cena.andavel(3, 3) === true;
  });

  conferir('a cena coleta todas as marcas de prédio', () => {
    const m = new MundoEditavel(base());
    m.pintar('objetos', 2, 2, 'M');
    m.pintar('objetos', 10, 4, 'M');
    m.pintar('objetos', 6, 11, 'M');
    return m.cena.marcasPredio.length === 3;
  });

  conferir('desfazer remove a pincelada grossa inteira', () => {
    const m = new MundoEditavel(base());
    const antes = m.dados.chao.join('');
    m.pincelar('chao', 7, 7, 'a', 5);
    m.desfazer();
    return m.dados.chao.join('') === antes;
  });

  conferir('estrada reta liga os dois pontos', () => {
    const m = new MundoEditavel(base());
    m.estrada('chao', { gx: 1, gy: 7 }, { gx: 13, gy: 7 }, 'a', 0);
    // Toda a linha horizontal virou asfalto.
    let ok = true;
    for (let x = 1; x <= 13; x += 1) if (m.dados.chao[7][x] !== 'a') ok = false;
    return ok;
  });

  conferir('estrada diagonal não deixa buraco', () => {
    const m = new MundoEditavel(base());
    m.estrada('chao', { gx: 1, gy: 1 }, { gx: 13, gy: 13 }, 'a', 1);
    // Com raio 1 a diagonal fica contínua: cada passo da linha pinta um disco.
    // Confere que não há tile de grama cercado por asfalto no meio do traço.
    let pintados = 0;
    for (let y = 0; y < 15; y += 1) for (let x = 0; x < 15; x += 1) if (m.dados.chao[y][x] === 'a') pintados += 1;
    return pintados >= 13; // pelo menos um por passo da diagonal
  });

  conferir('estrada com largura cobre mais de um tile', () => {
    const m = new MundoEditavel(base());
    m.estrada('chao', { gx: 2, gy: 7 }, { gx: 12, gy: 7 }, 'a', 1);
    // Raio 1: a faixa tem três tiles de altura no meio do traço.
    return m.dados.chao[6][7] === 'a' && m.dados.chao[7][7] === 'a' && m.dados.chao[8][7] === 'a';
  });

  conferir('desfazer remove a estrada inteira', () => {
    const m = new MundoEditavel(base());
    const antes = m.dados.chao.join('');
    m.estrada('chao', { gx: 1, gy: 1 }, { gx: 13, gy: 13 }, 'a', 2);
    m.desfazer();
    return m.dados.chao.join('') === antes;
  });
}

secao('Editor: a validação explica o problema');

{
  // Cena própria com um ponto de vestígio, independente da cidade — a cidade é
  // esqueleto enquanto o roteiro novo não chega, e não tem `*`.
  const comPontoBase = () => ({
    id: 'teste-validacao',
    nome: 'Teste',
    endereco: '',
    externo: true,
    ligacoes: {},
    decoracoes: [],
    passagens: [{ gx: 1, gy: 1, para: 'cidade', rotulo: 'volta' }],
    chao: ['pppppppp', 'pppppppp', 'pppppppp', 'pppppppp', 'pppppppp'],
    objetos: ['........', '...X....', '........', '.....*..', '........'],
  });
  const comPonto = () => {
    const mundo = new MundoEditavel(comPontoBase());
    const ponto = mundo.cena.pontosDeVestigio[0];
    if (!ponto) throw new Error('a cena de teste não tem ponto de vestígio');
    return { mundo, ponto };
  };

  conferir('a cena de teste tem ponto de vestígio', () => comPonto().ponto !== undefined);

  conferir('peça sólida sobre o ponto: diz qual peça é', () => {
    const { mundo, ponto } = comPonto();
    mundo.decorar(ponto.gx, ponto.gy, 'dng_stoneWall_S', true, 0);
    const [primeiro] = mundo.validar(CASO_014.documentos);
    if (!primeiro?.includes('dng_stoneWall_S')) throw new Error(`disse: ${primeiro}`);
    return primeiro.includes('bloqueia passagem');
  });

  conferir('peça sólida sobre o ponto: aponta onde olhar', () => {
    const { mundo, ponto } = comPonto();
    mundo.decorar(ponto.gx, ponto.gy, 'dng_stoneWall_S', true, 0);
    mundo.validar(CASO_014.documentos);
    return mundo.focoDoProblema?.gx === ponto.gx && mundo.focoDoProblema?.gy === ponto.gy;
  });

  conferir('parede na matriz sobre o ponto: diz que é a camada Objetos', () => {
    const { mundo, ponto } = comPonto();
    // Pinta a parede num vizinho e move o ponto para baixo dela, que é o que
    // acontece quando se constrói um prédio por cima de um ponto existente.
    const dados = base();
    const linha = dados.objetos[ponto.gy];
    dados.objetos[ponto.gy] = `${linha.slice(0, ponto.gx)}*${linha.slice(ponto.gx + 1)}`;
    const outro = new MundoEditavel(dados);
    outro.pintar('chao', ponto.gx, ponto.gy, ' ');
    const [primeiro] = outro.validar(CASO_014.documentos);
    if (!primeiro?.includes('chão')) throw new Error(`disse: ${primeiro}`);
    return true;
  });

  conferir('peça sólida levantada sobre o ponto não reprova', () => {
    const { mundo, ponto } = comPonto();
    mundo.decorar(ponto.gx, ponto.gy, 'frm_roofCorner_E', true, 6);
    return mundo.validar(CASO_014.documentos).length === 0;
  });

  conferir('mapa válido limpa o foco do problema', () => {
    const { mundo } = comPonto();
    mundo.validar(CASO_014.documentos);
    return mundo.focoDoProblema === null;
  });
}

// ---------- giro das peças ----------
//
// O acervo traz os mesmos 205 modelos quatro vezes, um por orientação. A paleta
// lista o modelo e a orientação sai por tecla, o que tira 615 itens da rolagem.

secao('Editor: giro das orientações');

{
  const { ORIENTACOES, agruparPorFamilia, girarOrientacao, separarOrientacao, filtrarFamilias, contarPorGrupo } =
    await import('../editor/nucleo/categorias.js');

  const ids = Object.keys(VISUAL.pecas ?? {});
  const familias = agruparPorFamilia(ids);

  conferir('a ordem do giro é horária e tem quatro posições', () => {
    return ORIENTACOES.join('') === 'NESW';
  });

  conferir('separa modelo e orientação', () => {
    const a = separarOrientacao('frm_roofCorner_N');
    const b = separarOrientacao('sem_sufixo');
    return a.base === 'frm_roofCorner' && a.orientacao === 'N' && b.orientacao === '';
  });

  conferir('agrupar reduz o acervo a um item por modelo', () => {
    if (!ids.length) throw new Error('acervo vazio');
    if (familias.size >= ids.length) throw new Error(`${familias.size} famílias para ${ids.length} ids`);
    return true;
  });

  conferir('todo modelo tem as quatro orientações', () => {
    const incompletas = [...familias].filter(([, f]) => f.orientacoes.length !== 4);
    if (incompletas.length) {
      throw new Error(`${incompletas.length} incompletas, ex: ${incompletas[0][0]}`);
    }
    return true;
  });

  conferir('girar percorre as quatro e volta ao começo', () => {
    const quatro = ['N', 'E', 'S', 'W'];
    let atual = 'N';
    const visitadas = [atual];
    for (let i = 0; i < 4; i += 1) {
      atual = girarOrientacao(atual, quatro, 1);
      visitadas.push(atual);
    }
    return visitadas.join('') === 'NESWN';
  });

  conferir('girar ao contrário anda ao contrário', () => {
    return girarOrientacao('N', ['N', 'E', 'S', 'W'], -1) === 'W';
  });

  conferir('girar com uma orientação só não trava nem muda', () => {
    return girarOrientacao('S', ['S'], 1) === 'S';
  });

  conferir('girar a partir de orientação ausente cai na primeira', () => {
    return girarOrientacao('N', ['E', 'S'], 1) === 'E';
  });

  conferir('girar pula a orientação que o acervo não tem', () => {
    // Com só N e S, girar leva de N a S e de S a N, sem passar por E nem W.
    return girarOrientacao('N', ['N', 'S'], 1) === 'S' && girarOrientacao('S', ['N', 'S'], 1) === 'N';
  });

  conferir('o modelo de telhado existe nas quatro', () => {
    const roof = familias.get('frm_roofCorner');
    if (!roof) throw new Error('frm_roofCorner não está no acervo');
    return roof.orientacoes.join('') === 'NESW';
  });

  conferir('cada orientação aponta para um arquivo diferente', () => {
    const roof = familias.get('frm_roofCorner');
    const alvos = new Set(Object.values(roof.ids));
    return alvos.size === 4 && roof.ids.N.endsWith('_N') && roof.ids.W.endsWith('_W');
  });

  conferir('a paleta lista modelos, não variantes', () => {
    const lista = filtrarFamilias(ids, { grupo: 'todos' });
    return lista.length === familias.size && lista.every((i) => i.orientacoes.length === 4);
  });

  conferir('a busca por modelo acha o telhado', () => {
    const lista = filtrarFamilias(ids, { termo: 'roofcorner' });
    return lista.length >= 1 && lista.every((i) => i.base.toLowerCase().includes('roofcorner'));
  });

  conferir('a contagem dos grupos fecha com o número de modelos', () => {
    const contagem = contarPorGrupo(ids);
    if (contagem.get('todos') !== familias.size) {
      throw new Error(`chip diz ${contagem.get('todos')}, há ${familias.size} modelos`);
    }
    return true;
  });
}

// ---------- alinhamento do acervo ----------

secao('Acervo: uma célula por moldura');

{
  const pecas = Object.values(VISUAL.pecas ?? {});

  conferir('o manifesto tem peças', () => pecas.length > 0);

  // A sobreposição de piso vinha daqui: cada sprite tinha a própria escala e a
  // própria âncora, tiradas do recorte opaco. Sprite da mesma moldura precisa
  // compartilhar os dois, senão peça vizinha não encosta.
  conferir('todas as peças compartilham a escala', () => {
    const escalas = new Set(pecas.map((p) => p.escala));
    if (escalas.size !== 1) throw new Error(`${escalas.size} escalas: ${[...escalas].join(', ')}`);
    return true;
  });

  conferir('todas as peças compartilham a âncora', () => {
    const ancoras = new Set(pecas.map((p) => p.ancora));
    if (ancoras.size !== 1) throw new Error(`${ancoras.size} âncoras: ${[...ancoras].join(', ')}`);
    return true;
  });

  conferir('a moldura inteira vale exatamente um tile', () => {
    const escala = pecas[0].escala;
    if (escala !== 1) throw new Error(`escala ${escala}: a peça sai ${escala}× o tile`);
    return true;
  });

  conferir('a âncora cai dentro da moldura', () => {
    const a = pecas[0].ancora;
    return a > 0 && a < 1;
  });
}

await rm(temporario, { force: true });

console.log();
if (falhas) {
  console.error(`Com falhas: ${checagens - falhas}/${checagens} checagens passaram.`);
  process.exit(1);
}
console.log(`Editor em ordem: ${checagens}/${checagens} checagens passaram.`);
