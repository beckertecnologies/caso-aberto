// Monta uma investigação a partir de uma semente.
//
// Os mapas são fixos; o que muda é o mistério: quem é o culpado, quais vestígios
// existem, em que local cada um aparece e, por consequência, quais mentiras o
// jogador consegue derrubar. É o equivalente, aqui, à dungeon gerada de um ARPG —
// só que o que se gera é a dedução, não a geometria.

import { criarRng } from '../core/rng.js';

/**
 * @param {object} caso definição em src/dados
 * @param {{id:string,pontos:{gx:number,gy:number}[]}[]} cenas locais disponíveis
 * @param {string|number} semente
 */
export function montarMisterio(caso, cenas, semente) {
  const rng = criarRng(semente);
  const { incriminam, pistasFalsas, contexto } = caso.composicao;

  const culpado = rng.sortear(caso.suspeitos);

  const doCulpado = caso.acervo.filter((v) => v.aponta === culpado.id);
  const dosOutros = caso.acervo.filter((v) => v.aponta && v.aponta !== culpado.id);

  const selecionados = rng.embaralhar([
    ...rng.amostrar(doCulpado, incriminam),
    ...distribuirFalsas(rng, dosOutros, pistasFalsas, culpado.id),
    ...rng.amostrar(caso.contexto, contexto),
  ]);

  // Locais sem ponto marcado são só de passagem: entram no mundo mas não
  // recebem vestígio.
  const comPontos = cenas.filter((cena) => cena.pontos.length > 0);
  const plantio = plantar(rng, selecionados, comPontos);

  const vestigios = selecionados.map((def) => ({
    ...def,
    ...plantio.get(def.id),
    recolhido: false,
  }));

  const plantados = new Set(vestigios.map((v) => v.id));

  return {
    semente: String(semente),
    caso,
    culpado,
    vestigios,
    total: vestigios.length,
    // Quantas respostas do culpado podem ser derrubadas nesta investigação.
    contradicoesPossiveis: perguntasContraditaveis(culpado, plantados).length,
  };
}

/**
 * Decide em que local e em que ponto cada vestígio aparece.
 *
 * Cada vestígio pode declarar `locais`: os lugares onde faz sentido existir.
 * Uma marca de salto no ladrilho molhado não cabe numa sala de reuniões, e um
 * recibo da sociedade não cabe no meio da calçada. Vestígio sem `locais` pode
 * aparecer em qualquer lugar.
 *
 * O algoritmo atende primeiro os vestígios mais restritos — se o que só cabe num
 * lugar ficasse para o fim, o ponto dele já poderia estar tomado. Entre os locais
 * possíveis, escolhe o que recebeu menos até agora, para a carga não concentrar
 * num único lugar.
 *
 * @returns {Map<string, {cena:string, gx:number, gy:number}>} por id de vestígio
 */
function plantar(rng, selecionados, cenas) {
  if (!cenas.length) throw new Error('Nenhum local tem ponto de vestígio marcado.');

  const capacidade = cenas.reduce((soma, cena) => soma + cena.pontos.length, 0);
  if (capacidade < selecionados.length) {
    throw new Error(
      `Os locais oferecem ${capacidade} pontos, mas o caso precisa de ${selecionados.length}.`,
    );
  }

  const pontosLivres = new Map(cenas.map((cena) => [cena.id, rng.embaralhar(cena.pontos)]));
  const usados = new Map(cenas.map((cena) => [cena.id, 0]));

  // Sem `locais` declarados, o vestígio fica nos locais fechados. Rua e outros
  // lugares abertos só recebem o que pedir explicitamente por eles.
  const comCandidatos = selecionados.map((def) => ({
    def,
    candidatos: cenas
      .filter((cena) => (def.locais?.length ? def.locais.includes(cena.id) : !cena.externo))
      .map((cena) => cena.id),
  }));

  const orfaos = comCandidatos.filter((item) => item.candidatos.length === 0);
  if (orfaos.length) {
    throw new Error(
      `Sem local possível para: ${orfaos.map((o) => o.def.id).join(', ')}. ` +
        'Revise o campo "locais" desses vestígios.',
    );
  }

  const plantio = new Map();
  const ordem = [...comCandidatos].sort((a, b) => a.candidatos.length - b.candidatos.length);

  for (const item of ordem) {
    const viaveis = item.candidatos.filter((id) => usados.get(id) < pontosLivres.get(id).length);
    if (!viaveis.length) {
      throw new Error(`Os locais de "${item.def.id}" ficaram sem ponto livre.`);
    }

    // Menos carregado primeiro; empate decidido pela semente, não pela ordem.
    const menorCarga = Math.min(...viaveis.map((id) => usados.get(id)));
    const escolhida = rng.sortear(viaveis.filter((id) => usados.get(id) === menorCarga));

    const indice = usados.get(escolhida);
    const ponto = pontosLivres.get(escolhida)[indice];
    usados.set(escolhida, indice + 1);
    plantio.set(item.def.id, { cena: escolhida, gx: ponto.gx, gy: ponto.gy });
  }

  return plantio;
}

/**
 * Espalha as pistas falsas entre os suspeitos inocentes em vez de empilhar
 * tudo em um só. Sem isso, um inocente acumularia provas e o jogo ficaria injusto.
 */
function distribuirFalsas(rng, candidatos, quantidade, idCulpado) {
  const porSuspeito = new Map();
  for (const vestigio of candidatos) {
    if (vestigio.aponta === idCulpado) continue;
    if (!porSuspeito.has(vestigio.aponta)) porSuspeito.set(vestigio.aponta, []);
    porSuspeito.get(vestigio.aponta).push(vestigio);
  }

  const filas = rng.embaralhar([...porSuspeito.values()]).map((lista) => rng.embaralhar(lista));
  const escolhidos = [];
  let volta = 0;

  // Rodízio: um de cada suspeito por volta, até atingir a quantidade pedida.
  while (escolhidos.length < quantidade && volta < 8) {
    let avancou = false;
    for (const fila of filas) {
      if (escolhidos.length >= quantidade) break;
      if (fila.length > volta) {
        escolhidos.push(fila[volta]);
        avancou = true;
      }
    }
    if (!avancou) break;
    volta += 1;
  }

  return escolhidos;
}

/** Perguntas de um suspeito que algum vestígio plantado é capaz de desmentir. */
export function perguntasContraditaveis(suspeito, idsPlantados) {
  return (suspeito.perguntas ?? []).filter((pergunta) =>
    (pergunta.contradizPor ?? []).some((id) => idsPlantados.has(id)),
  );
}

/**
 * Vestígios já recolhidos capazes de derrubar uma resposta específica.
 * @param {object} pergunta
 * @param {object[]} recolhidos
 */
export function vestigiosQueDerrubam(pergunta, recolhidos) {
  const alvos = new Set(pergunta.contradizPor ?? []);
  return recolhidos.filter((vestigio) => alvos.has(vestigio.id));
}

/**
 * Pesa as evidências já recolhidas por suspeito. Alimenta o painel de suspeitos
 * e serve de base para o desfecho.
 */
export function pesarEvidencias(misterio, recolhidos) {
  const peso = new Map(misterio.caso.suspeitos.map((s) => [s.id, 0]));
  let neutros = 0;
  for (const vestigio of recolhidos) {
    if (vestigio.aponta && peso.has(vestigio.aponta)) {
      peso.set(vestigio.aponta, peso.get(vestigio.aponta) + 1);
    } else {
      neutros += 1;
    }
  }
  return { peso, neutros };
}

/**
 * Julga a acusação. O acerto depende de nomear o culpado certo; a qualidade do
 * fechamento depende das provas em mãos e das mentiras derrubadas.
 * @param {object[]} contradicoes registros {suspeito, pergunta, vestigio}
 */
export function julgar(misterio, idAcusado, recolhidos, contradicoes = [], cruzamentos = []) {
  const acertou = idAcusado === misterio.culpado.id;
  const provasDoCulpado = recolhidos.filter((v) => v.aponta === misterio.culpado.id);
  const totalDoCulpado = misterio.vestigios.filter((v) => v.aponta === misterio.culpado.id).length;
  const acusado = misterio.caso.suspeitos.find((s) => s.id === idAcusado) ?? null;

  const quebrasDoCulpado = contradicoes.filter((c) => c.suspeito === misterio.culpado.id);
  const possiveis = misterio.contradicoesPossiveis;

  let forca = 'fraca';
  const todasAsProvas = totalDoCulpado > 0 && provasDoCulpado.length >= totalDoCulpado;
  const todasAsQuebras = possiveis > 0 ? quebrasDoCulpado.length >= possiveis : true;
  if (todasAsProvas && todasAsQuebras) forca = 'completa';
  else if (provasDoCulpado.length >= Math.ceil(totalDoCulpado / 2) || quebrasDoCulpado.length > 0) {
    forca = 'parcial';
  }

  // Cruzamentos entram como reforço do relato, não como requisito: parte deles
  // depende de vestígios de contexto que o sorteio nem sempre planta, então
  // exigi-los tornaria o fechamento completo inalcançável em metade dos casos.
  const deducoes = (misterio.caso.cruzamentos ?? []).filter((c) => cruzamentos.includes(c.id));
  const deducoesDoCulpado = deducoes.filter((c) => c.aponta === misterio.culpado.id);

  return {
    acertou,
    acusado,
    culpado: misterio.culpado,
    provasDoCulpado,
    totalDoCulpado,
    quebrasDoCulpado,
    contradicoesPossiveis: possiveis,
    deducoes,
    deducoesDoCulpado,
    forca,
    recolhidos: recolhidos.length,
    total: misterio.total,
  };
}
