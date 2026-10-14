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

  // Locais sem ponto marcado são de passagem (a cidade, por exemplo): entram no
  // mundo, mas não recebem vestígio.
  const comPontos = cenas.filter((cena) => cena.pontos.length > 0);
  const locais = sortearLocais(rng, comPontos, selecionados.length);

  const vestigios = selecionados.map((def, i) => ({
    ...def,
    cena: locais[i].cena,
    gx: locais[i].gx,
    gy: locais[i].gy,
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
 * Sorteia `quantidade` pontos espalhados entre os locais, equilibrando a carga.
 * Sem isso um local poderia ficar vazio e a viagem perderia sentido.
 */
function sortearLocais(rng, cenas, quantidade) {
  if (!cenas.length) throw new Error('Nenhum local tem ponto de vestígio marcado.');

  const capacidade = cenas.reduce((soma, cena) => soma + cena.pontos.length, 0);
  if (capacidade < quantidade) {
    throw new Error(`Os locais oferecem ${capacidade} pontos, mas o caso precisa de ${quantidade}.`);
  }

  // Cota base igual para todos; o resto vai para locais sorteados.
  const cotas = new Map(cenas.map((cena) => [cena.id, Math.floor(quantidade / cenas.length)]));
  let sobra = quantidade - [...cotas.values()].reduce((a, b) => a + b, 0);
  for (const cena of rng.embaralhar(cenas)) {
    if (sobra <= 0) break;
    cotas.set(cena.id, cotas.get(cena.id) + 1);
    sobra -= 1;
  }

  // Um local pequeno pode não dar conta da cota; o excedente volta para os outros.
  const escolhidos = [];
  let pendente = 0;
  for (const cena of cenas) {
    const cota = Math.min(cotas.get(cena.id), cena.pontos.length);
    pendente += cotas.get(cena.id) - cota;
    for (const ponto of rng.amostrar(cena.pontos, cota)) {
      escolhidos.push({ cena: cena.id, gx: ponto.gx, gy: ponto.gy });
    }
  }

  if (pendente > 0) {
    const usados = new Set(escolhidos.map((p) => `${p.cena}:${p.gx},${p.gy}`));
    const livres = [];
    for (const cena of cenas) {
      for (const ponto of cena.pontos) {
        const chave = `${cena.id}:${ponto.gx},${ponto.gy}`;
        if (!usados.has(chave)) livres.push({ cena: cena.id, gx: ponto.gx, gy: ponto.gy });
      }
    }
    escolhidos.push(...rng.amostrar(livres, pendente));
  }

  return rng.embaralhar(escolhidos);
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
export function julgar(misterio, idAcusado, recolhidos, contradicoes = []) {
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

  return {
    acertou,
    acusado,
    culpado: misterio.culpado,
    provasDoCulpado,
    totalDoCulpado,
    quebrasDoCulpado,
    contradicoesPossiveis: possiveis,
    forca,
    recolhidos: recolhidos.length,
    total: misterio.total,
  };
}
