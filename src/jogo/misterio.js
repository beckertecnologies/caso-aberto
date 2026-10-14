// Monta uma investigação a partir de uma semente.
//
// O mapa é fixo; o que muda é o mistério: quem é o culpado, quais vestígios
// existem na cena e em que canto cada um aparece. É o equivalente, aqui, à
// dungeon gerada de um ARPG — só que o que se gera é a dedução, não a geometria.

import { criarRng } from '../core/rng.js';

/**
 * @param {object} caso definição em src/dados
 * @param {{gx:number,gy:number}[]} pontos pontos de vestígio da cena
 * @param {string|number} semente
 */
export function montarMisterio(caso, pontos, semente) {
  const rng = criarRng(semente);
  const { incriminam, pistasFalsas, contexto } = caso.composicao;

  const culpado = rng.sortear(caso.suspeitos);

  const doCulpado = caso.acervo.filter((v) => v.aponta === culpado.id);
  const dosOutros = caso.acervo.filter((v) => v.aponta && v.aponta !== culpado.id);

  const escolhidosIncriminam = rng.amostrar(doCulpado, incriminam);
  const escolhidosFalsos = distribuirFalsas(rng, dosOutros, pistasFalsas, culpado.id);
  const escolhidosContexto = rng.amostrar(caso.contexto, contexto);

  const selecionados = rng.embaralhar([
    ...escolhidosIncriminam,
    ...escolhidosFalsos,
    ...escolhidosContexto,
  ]);

  const locais = rng.embaralhar(pontos);
  if (locais.length < selecionados.length) {
    throw new Error(
      `A cena tem ${locais.length} pontos de vestígio, mas o caso precisa de ${selecionados.length}.`,
    );
  }

  const vestigios = selecionados.map((def, i) => ({
    ...def,
    gx: locais[i].gx,
    gy: locais[i].gy,
    recolhido: false,
  }));

  return {
    semente: String(semente),
    caso,
    culpado,
    vestigios,
    total: vestigios.length,
  };
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
 * Julga a acusação. O acerto depende de nomear o culpado certo;
 * a qualidade do fechamento depende de quantas provas dele estavam em mãos.
 */
export function julgar(misterio, idAcusado, recolhidos) {
  const acertou = idAcusado === misterio.culpado.id;
  const provasDoCulpado = recolhidos.filter((v) => v.aponta === misterio.culpado.id);
  const totalDoCulpado = misterio.vestigios.filter((v) => v.aponta === misterio.culpado.id).length;
  const acusado = misterio.caso.suspeitos.find((s) => s.id === idAcusado) ?? null;

  let forca = 'fraca';
  if (provasDoCulpado.length >= totalDoCulpado && totalDoCulpado > 0) forca = 'completa';
  else if (provasDoCulpado.length >= Math.ceil(totalDoCulpado / 2)) forca = 'parcial';

  return {
    acertou,
    acusado,
    culpado: misterio.culpado,
    provasDoCulpado,
    totalDoCulpado,
    forca,
    recolhidos: recolhidos.length,
    total: misterio.total,
  };
}
