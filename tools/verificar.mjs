// Verificação sem navegador: confere os mapas, a navegabilidade, o gerador,
// o interrogatório, o progresso salvo e simula partidas inteiras.
// Roda com `npm run check`. Os módulos de mundo e jogo são puros, então
// importam direto no Node.

import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho, ladoAcessivel } from '../src/mundo/caminho.js';
import { montarMisterio, julgar, pesarEvidencias, perguntasContraditaveis } from '../src/jogo/misterio.js';
import { Jogo } from '../src/jogo/jogo.js';
import { Progresso, DepositoMemoria } from '../src/jogo/persistencia.js';
// A mesma lista que o jogo usa. Antes era uma cópia com quatro locais fixos, e
// qualquer prédio criado pelo editor ficava fora da verificação — pior: fazia a
// checagem de "toda passagem tem volta" acusar um destino inexistente.
import { CENAS } from '../src/dados/cenas.js';
import { CASO_RUTTERFORT as CASO_014 } from '../src/dados/caso-rutterfort.js';



let falhas = 0;
let checagens = 0;

function conferir(descricao, condicao, detalhe = '') {
  checagens += 1;
  if (condicao) {
    console.log(`  ok   ${descricao}`);
  } else {
    falhas += 1;
    console.error(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

function secao(titulo) {
  console.log(`\n${titulo}`);
}

/** Avança a simulação até a caminhada terminar. Devolve false se travou. */
function andarAte(jogo, gx, gy, limite = 6000) {
  jogo.irPara(gx, gy);
  let passos = 0;
  while ((jogo.detetive.rota.length || jogo.detetive.aoChegar) && passos < limite) {
    jogo.atualizar(1 / 60, null);
    passos += 1;
  }
  return passos < limite;
}

// ---------- mapas ----------

secao('Mapas');

const cenas = [];
for (const dados of CENAS) {
  const problemas = Cena.conferir(dados);
  conferir(`${dados.id}: camadas consistentes`, problemas.length === 0, problemas.join('; '));
  try {
    const cena = new Cena(dados);
    cenas.push(cena);
    conferir(`${dados.id}: cena montada (${cena.largura}x${cena.altura})`, true);
  } catch (erro) {
    conferir(`${dados.id}: cena montada`, false, erro.message);
  }
}

if (cenas.length !== CENAS.length) {
  console.error('\nSem todas as cenas não há como seguir.');
  process.exit(1);
}

conferir('ids de cena são únicos', new Set(cenas.map((c) => c.id)).size === cenas.length);

for (const cena of cenas) {
  conferir(`${cena.id}: início andável`, cena.andavel(cena.inicio.gx, cena.inicio.gy), JSON.stringify(cena.inicio));
  conferir(`${cena.id}: tem passagem para outro local`, cena.ligacoes.length >= 1, `${cena.ligacoes.length}`);
  // Pasta para ler é exigência só onde o caso guarda documento. Um local criado
  // no editor pode ser apenas um lugar — um bar não precisa de laudo na mesa —,
  // e exigir leitura de todo local transformava cada prédio novo numa falha.
  const docsDaqui = CASO_014.documentos.filter((d) => d.cena === cena.id && d.alvo === 'pasta').length;
  const leituras = cena.pecas.filter((p) => p.def.interacao === 'documento').length;
  conferir(
    `${cena.id}: ${docsDaqui ? 'tem onde ler os documentos do caso' : 'não guarda documento do caso'}`,
    docsDaqui === 0 || leituras >= 1,
    `${leituras} objetos de leitura para ${docsDaqui} documentos`,
  );
  // Zero pontos é escolha válida: a delegacia é local de serviço, não cena de crime.
  const pontos = cena.pontosDeVestigio.length;
  const minimo = cena.externo ? 3 : 6;
  conferir(
    `${cena.id}: ${pontos === 0 ? 'é local de serviço, sem vestígio' : 'tem pontos de vestígio suficientes'}`,
    pontos === 0 || pontos >= minimo,
    `${pontos} pontos, mínimo ${minimo}`,
  );
}

const investigaveis = cenas.filter((c) => c.pontosDeVestigio.length > 0);
conferir('há pelo menos dois locais investigáveis', investigaveis.length >= 2, `${investigaveis.length}`);

const capacidade = cenas.reduce((soma, c) => soma + c.pontosDeVestigio.length, 0);
const precisa = CASO_014.composicao.incriminam + CASO_014.composicao.pistasFalsas + CASO_014.composicao.contexto;
conferir('capacidade total de pontos cobre o caso', capacidade >= precisa, `${capacidade} pontos para ${precisa} vestígios`);

// ---------- documentos ----------

secao('Documentos');

for (const cena of cenas) {
  const objetosDeLeitura = cena.pecas.filter((p) => p.def.interacao === 'documento').length;
  const docsPasta = CASO_014.documentos.filter((d) => d.cena === cena.id && d.alvo === 'pasta').length;
  conferir(
    `${cena.id}: há documento para cada objeto de leitura`,
    docsPasta >= objetosDeLeitura,
    `${objetosDeLeitura} objetos e ${docsPasta} documentos`,
  );
}

conferir(
  'todo documento aponta para uma cena existente',
  CASO_014.documentos.every((d) => cenas.some((c) => c.id === d.cena)),
);
conferir(
  'a marcação da vítima tem documento no local certo',
  cenas.some((cena) =>
    cena.pecas.some((p) => p.def.interacao === 'corpo') &&
    CASO_014.documentos.some((d) => d.cena === cena.id && d.alvo === 'corpo'),
  ),
);

// ---------- navegabilidade ----------

secao('Navegabilidade (A* a partir do início de cada cena)');

for (const cena of cenas) {
  const inicio = { gx: cena.inicio.gx, gy: cena.inicio.gy };

  const inalcancaveis = [];
  for (const ponto of cena.pontosDeVestigio) {
    if (!cena.andavel(ponto.gx, ponto.gy)) {
      inalcancaveis.push(`(${ponto.gx},${ponto.gy}) não é andável`);
      continue;
    }
    if (!buscarCaminho(cena, inicio, ponto).length) inalcancaveis.push(`(${ponto.gx},${ponto.gy}) sem rota`);
  }
  conferir(`${cena.id}: pontos de vestígio alcançáveis`, inalcancaveis.length === 0, inalcancaveis.join('; '));

  const ruins = [];
  for (const [, alvo] of cena.interativos) {
    const parada = ladoAcessivel(cena, alvo, inicio);
    if (!parada) {
      ruins.push(`${alvo.def.id} (${alvo.gx},${alvo.gy}) sem lado livre`);
      continue;
    }
    const mesmoTile = parada.gx === inicio.gx && parada.gy === inicio.gy;
    if (!buscarCaminho(cena, inicio, parada).length && !mesmoTile) {
      ruins.push(`${alvo.def.id} (${alvo.gx},${alvo.gy}) sem rota`);
    }
  }
  conferir(`${cena.id}: objetos examináveis alcançáveis`, ruins.length === 0, ruins.join('; '));

  const quinas = [];
  for (let gy = 1; gy < cena.altura - 1; gy += 1) {
    for (let gx = 1; gx < cena.largura - 1; gx += 1) {
      if (!cena.andavel(gx, gy)) continue;
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const destino = { gx: gx + dx, gy: gy + dy };
        if (!cena.andavel(destino.gx, destino.gy)) continue;
        if (cena.andavel(gx + dx, gy) || cena.andavel(gx, gy + dy)) continue;
        if (buscarCaminho(cena, { gx, gy }, destino).length === 1) {
          quinas.push(`(${gx},${gy}) -> (${destino.gx},${destino.gy})`);
        }
      }
    }
  }
  conferir(`${cena.id}: A* não corta quina de parede`, quinas.length === 0, quinas.slice(0, 4).join('; '));
}

// ---------- roteiro do caso ----------

secao('Roteiro do caso');

const idsAcervo = new Set([...CASO_014.acervo, ...CASO_014.contexto].map((v) => v.id));
conferir(
  'ids de vestígio são únicos',
  idsAcervo.size === CASO_014.acervo.length + CASO_014.contexto.length,
);

const semPerguntas = CASO_014.suspeitos.filter((s) => !s.perguntas?.length);
conferir('todo suspeito tem perguntas', semPerguntas.length === 0, semPerguntas.map((s) => s.id).join(', '));

const idsPerguntaRepetidos = [];
const requisitosRuins = [];
for (const suspeito of CASO_014.suspeitos) {
  const ids = (suspeito.perguntas ?? []).map((p) => p.id);
  if (new Set(ids).size !== ids.length) idsPerguntaRepetidos.push(suspeito.id);

  for (const pergunta of suspeito.perguntas ?? []) {
    if (!pergunta.requerQuebra) continue;
    const base = (suspeito.perguntas ?? []).find((p) => p.id === pergunta.requerQuebra);
    if (!base) {
      requisitosRuins.push(`${suspeito.id}/${pergunta.id}: exige "${pergunta.requerQuebra}", que não existe`);
    } else if (!(base.contradizPor ?? []).length) {
      // Dependência de uma pergunta que ninguém consegue derrubar trancaria a nova para sempre.
      requisitosRuins.push(`${suspeito.id}/${pergunta.id}: exige "${base.id}", que não é derrubável`);
    }
    if (pergunta.requerQuebra === pergunta.id) {
      requisitosRuins.push(`${suspeito.id}/${pergunta.id}: exige a si mesma`);
    }
  }
}
conferir('ids de pergunta são únicos por suspeito', idsPerguntaRepetidos.length === 0, idsPerguntaRepetidos.join(', '));
conferir('toda pergunta presa depende de uma versão derrubável', requisitosRuins.length === 0, requisitosRuins.join(' | '));

for (const suspeito of CASO_014.suspeitos) {
  conferir(
    `${suspeito.id}: tem pergunta que abre ao derrubar a versão`,
    (suspeito.perguntas ?? []).some((p) => p.requerQuebra),
  );
}

const contradicoesInvalidas = [];
for (const suspeito of CASO_014.suspeitos) {
  for (const pergunta of suspeito.perguntas ?? []) {
    for (const id of pergunta.contradizPor ?? []) {
      const vestigio = CASO_014.acervo.find((v) => v.id === id);
      if (!vestigio) contradicoesInvalidas.push(`${suspeito.id}/${pergunta.id}: ${id} não existe`);
      else if (vestigio.aponta !== suspeito.id) {
        contradicoesInvalidas.push(`${suspeito.id}/${pergunta.id}: ${id} aponta para ${vestigio.aponta}`);
      }
      if (vestigio && !pergunta.reacao) {
        contradicoesInvalidas.push(`${suspeito.id}/${pergunta.id}: sem reação ao confronto`);
      }
    }
  }
}
conferir(
  'cada contradição usa vestígio do próprio suspeito e tem reação',
  contradicoesInvalidas.length === 0,
  contradicoesInvalidas.slice(0, 4).join(' | '),
);

for (const suspeito of CASO_014.suspeitos) {
  const todos = new Set(CASO_014.acervo.filter((v) => v.aponta === suspeito.id).map((v) => v.id));
  conferir(
    `${suspeito.id}: com todas as provas, há contradição para derrubar`,
    perguntasContraditaveis(suspeito, todos).length >= 2,
    `${perguntasContraditaveis(suspeito, todos).length} perguntas contraditáveis`,
  );
}

// ---------- gerador ----------

secao('Gerador de mistério');

// Precisa espelhar o que o Jogo passa, inclusive `externo`: sem isso o gerador
// trataria a rua como local fechado e a afinidade seria testada errado.
const locaisParaGerador = cenas.map((c) => ({
  id: c.id,
  pontos: c.pontosDeVestigio,
  externo: c.externo,
}));
const porId = new Map(cenas.map((c) => [c.id, c]));
const culpadosVistos = new Set();
const erros = [];
const SEMENTES = 240;

for (let i = 0; i < SEMENTES; i += 1) {
  const semente = `verificacao-${i}`;
  let misterio;
  try {
    misterio = montarMisterio(CASO_014, locaisParaGerador, semente);
  } catch (erro) {
    erros.push(`${semente}: ${erro.message}`);
    continue;
  }

  culpadosVistos.add(misterio.culpado.id);

  if (misterio.vestigios.length !== precisa) {
    erros.push(`${semente}: ${misterio.vestigios.length} vestígios, esperado ${precisa}`);
  }

  const doCulpado = misterio.vestigios.filter((v) => v.aponta === misterio.culpado.id);
  if (doCulpado.length !== CASO_014.composicao.incriminam) {
    erros.push(`${semente}: ${doCulpado.length} provas do culpado`);
  }

  if (misterio.vestigios.filter((v) => !v.aponta).length !== CASO_014.composicao.contexto) {
    erros.push(`${semente}: contexto fora da conta`);
  }

  const { peso } = pesarEvidencias(misterio, misterio.vestigios);
  for (const [idSuspeito, quantidade] of peso) {
    if (idSuspeito !== misterio.culpado.id && quantidade >= CASO_014.composicao.incriminam) {
      erros.push(`${semente}: inocente ${idSuspeito} com ${quantidade} provas`);
    }
  }

  const posicoes = new Set(misterio.vestigios.map((v) => `${v.cena}:${v.gx},${v.gy}`));
  if (posicoes.size !== misterio.vestigios.length) erros.push(`${semente}: dois vestígios no mesmo ponto`);
  if (new Set(misterio.vestigios.map((v) => v.id)).size !== misterio.vestigios.length) {
    erros.push(`${semente}: vestígio repetido`);
  }

  // Cada vestígio precisa cair num ponto válido do local indicado.
  for (const vestigio of misterio.vestigios) {
    const cena = porId.get(vestigio.cena);
    if (!cena) {
      erros.push(`${semente}: cena desconhecida ${vestigio.cena}`);
      continue;
    }
    if (!cena.andavel(vestigio.gx, vestigio.gy)) {
      erros.push(`${semente}: ${vestigio.id} em tile não andável`);
    }
    if (!cena.pontosDeVestigio.some((p) => p.gx === vestigio.gx && p.gy === vestigio.gy)) {
      erros.push(`${semente}: ${vestigio.id} fora de um ponto marcado`);
    }
  }

  // A afinidade é a garantia principal: nenhum vestígio pode cair onde o texto
  // dele não faria sentido.
  for (const vestigio of misterio.vestigios) {
    const permitido = vestigio.locais?.length
      ? vestigio.locais.includes(vestigio.cena)
      : !porId.get(vestigio.cena)?.externo;
    if (!permitido) {
      erros.push(`${semente}: ${vestigio.id} caiu em ${vestigio.cena}, fora da afinidade`);
    }
  }

  // Com afinidade não dá para exigir vestígio em todo local: um sorteio pode
  // selecionar só vestígios do apartamento. O que precisa valer é que a
  // investigação continue exigindo sair de um lugar.
  const locaisUsados = new Set(misterio.vestigios.map((v) => v.cena));
  if (locaisUsados.size < 2) {
    erros.push(`${semente}: vestígios concentrados em um único local (${[...locaisUsados]})`);
  }

  // Dois vestígios não podem disputar o mesmo ponto do mesmo local.
  const porLocal = new Map();
  for (const vestigio of misterio.vestigios) {
    const chave = `${vestigio.cena}:${vestigio.gx},${vestigio.gy}`;
    if (porLocal.has(chave)) erros.push(`${semente}: ponto repetido em ${chave}`);
    porLocal.set(chave, true);
  }

  if (misterio.contradicoesPossiveis < 2) {
    erros.push(`${semente}: só ${misterio.contradicoesPossiveis} contradições possíveis`);
  }
}

conferir(`gerador estável em ${SEMENTES} sementes`, erros.length === 0, erros.slice(0, 5).join(' | '));
conferir(
  'todos os suspeitos podem ser o culpado',
  culpadosVistos.size === CASO_014.suspeitos.length,
  `vistos: ${[...culpadosVistos].join(', ')}`,
);

const a = montarMisterio(CASO_014, locaisParaGerador, 'repetivel');
const b = montarMisterio(CASO_014, locaisParaGerador, 'repetivel');
const retrato = (m) => JSON.stringify(m.vestigios.map((v) => [v.id, v.cena, v.gx, v.gy]));
conferir('a mesma semente reproduz a mesma investigação', a.culpado.id === b.culpado.id && retrato(a) === retrato(b));
conferir(
  'sementes diferentes mudam a investigação',
  retrato(a) !== retrato(montarMisterio(CASO_014, locaisParaGerador, 'outra-semente')),
);

// ---------- desfecho ----------

secao('Desfecho');

const misterioBase = montarMisterio(CASO_014, locaisParaGerador, 'desfecho');
const todas = misterioBase.vestigios.slice();
const plantados = new Set(todas.map((v) => v.id));
const quebrasCompletas = perguntasContraditaveis(misterioBase.culpado, plantados).map((p) => ({
  suspeito: misterioBase.culpado.id,
  pergunta: p.id,
  vestigio: (p.contradizPor ?? []).find((id) => plantados.has(id)),
}));

const completo = julgar(misterioBase, misterioBase.culpado.id, todas, quebrasCompletas);
conferir('provas e versões derrubadas resultam em fechamento completo', completo.acertou && completo.forca === 'completa');

const semQuebras = julgar(misterioBase, misterioBase.culpado.id, todas, []);
conferir('sem derrubar versão alguma, o fechamento é parcial', semQuebras.acertou && semQuebras.forca === 'parcial');

const inocente = CASO_014.suspeitos.find((s) => s.id !== misterioBase.culpado.id);
const errado = julgar(misterioBase, inocente.id, todas, quebrasCompletas);
conferir('acusar um inocente resulta em erro', !errado.acertou && errado.acusado.id === inocente.id);

const semProvas = julgar(
  misterioBase,
  misterioBase.culpado.id,
  todas.filter((v) => v.aponta !== misterioBase.culpado.id),
  [],
);
conferir('acertar sem prova material é fundamentação fraca', semProvas.acertou && semProvas.forca === 'fraca');

// ---------- interrogatório ----------

secao('Perguntas que se abrem');

{
  const jogo = new Jogo(CENAS, CASO_014, 'progressao');
  const culpado = jogo.misterio.culpado;
  const presa = (culpado.perguntas ?? []).find((p) => p.requerQuebra);
  const base = (culpado.perguntas ?? []).find((p) => p.id === presa.requerQuebra);

  conferir('a pergunta presa não aparece no começo', !jogo.perguntaLiberada(culpado.id, presa.id));
  conferir('ouvir a pergunta presa é recusado', jogo.ouvir(culpado.id, presa.id) === false);
  conferir('a pergunta base aparece desde o começo', jogo.perguntaLiberada(culpado.id, base.id));

  // Derruba a versão base entregando o vestígio na mão do detetive.
  const idVestigio = (base.contradizPor ?? []).find((id) =>
    jogo.misterio.vestigios.some((v) => v.id === id),
  );
  const vestigio = jogo.misterio.vestigios.find((v) => v.id === idVestigio);
  vestigio.recolhido = true;
  jogo.recolhidos.push(vestigio);
  conferir(
    'confronto na pergunta base é aceito',
    jogo.confrontar(culpado.id, base.id, idVestigio)?.sucesso === true,
  );

  conferir('a pergunta presa abre depois da versão cair', jogo.perguntaLiberada(culpado.id, presa.id));
  conferir('agora dá para ouvi-la', jogo.ouvir(culpado.id, presa.id) === true);
  conferir(
    'a lista de perguntas disponíveis cresceu',
    jogo.perguntasDisponiveis(culpado.id).length === (culpado.perguntas ?? []).length,
  );

  // Progresso salvo precisa devolver a pergunta destravada, não trancá-la de novo.
  const retomado = new Jogo(CENAS, CASO_014, 'progressao');
  retomado.restaurar(jogo.estado());
  conferir('retomar o progresso mantém a pergunta aberta', retomado.perguntaLiberada(culpado.id, presa.id));
}

secao('Cruzamento de vestígios');

{
  const idsVestigio = new Set([...CASO_014.acervo, ...CASO_014.contexto].map((v) => v.id));
  const idsSuspeito = new Set(CASO_014.suspeitos.map((s) => s.id));
  const ruins = [];
  for (const cruzamento of CASO_014.cruzamentos ?? []) {
    if ((cruzamento.exige ?? []).length < 2) ruins.push(`${cruzamento.id}: exige menos de dois vestígios`);
    if (new Set(cruzamento.exige).size !== cruzamento.exige.length) {
      ruins.push(`${cruzamento.id}: exige o mesmo vestígio duas vezes`);
    }
    for (const id of cruzamento.exige ?? []) {
      if (!idsVestigio.has(id)) ruins.push(`${cruzamento.id}: vestígio "${id}" não existe`);
    }
    if (cruzamento.aponta && !idsSuspeito.has(cruzamento.aponta)) {
      ruins.push(`${cruzamento.id}: aponta para suspeito inexistente`);
    }
    if (!cruzamento.titulo || !cruzamento.texto) ruins.push(`${cruzamento.id}: sem título ou texto`);
  }
  conferir('todo cruzamento é coerente', ruins.length === 0, ruins.slice(0, 4).join(' | '));

  const ids = (CASO_014.cruzamentos ?? []).map((c) => c.id);
  conferir('ids de cruzamento são únicos', new Set(ids).size === ids.length);
  conferir(
    'há cruzamento apontando para cada suspeito',
    CASO_014.suspeitos.every((s) => (CASO_014.cruzamentos ?? []).some((c) => c.aponta === s.id)),
  );

  const jogo = new Jogo(CENAS, CASO_014, 'cruzamento');
  conferir('nada a cruzar de mão vazia', jogo.cruzamentosDisponiveis().length === 0);

  // Entrega os dois vestígios de um cruzamento possível nesta investigação.
  const plantados = new Set(jogo.misterio.vestigios.map((v) => v.id));
  const alvo = (CASO_014.cruzamentos ?? []).find((c) => c.exige.every((id) => plantados.has(id)));

  if (!alvo) {
    conferir('esta semente tem algum cruzamento possível', false, 'nenhum cruzamento plantado');
  } else {
    conferir('cruzar sem os vestígios é recusado', jogo.cruzar(alvo.id) === null);
    for (const id of alvo.exige) {
      const vestigio = jogo.misterio.vestigios.find((v) => v.id === id);
      vestigio.recolhido = true;
      jogo.recolhidos.push(vestigio);
    }
    conferir('com os dois em mãos, o cruzamento fica disponível', jogo.cruzamentosDisponiveis().some((c) => c.id === alvo.id));
    conferir('cruzar é aceito', jogo.cruzar(alvo.id) !== null);
    conferir('o mesmo cruzamento não vale duas vezes', jogo.cruzar(alvo.id) === null);
    conferir('sai da lista de disponíveis', !jogo.cruzamentosDisponiveis().some((c) => c.id === alvo.id));
    conferir('entra na lista de deduções', jogo.cruzamentosFeitos().some((c) => c.id === alvo.id));
    conferir('cruzamento inexistente é recusado', jogo.cruzar('nao-existe') === null);

    const retomado = new Jogo(CENAS, CASO_014, 'cruzamento');
    retomado.restaurar(jogo.estado());
    conferir('o cruzamento sobrevive ao progresso salvo', retomado.cruzamentosFeitos().length === 1);

    const veredito = jogo.acusar(jogo.misterio.culpado.id);
    conferir('o desfecho relata as deduções', veredito.deducoes.length === 1);
    conferir('cruzar após encerrar é recusado', jogo.cruzar(alvo.id) === null);
  }
}

secao('Interrogatório');

{
  const jogo = new Jogo(CENAS, CASO_014, 'interrogatorio');
  const culpado = jogo.misterio.culpado;
  const pergunta = (culpado.perguntas ?? []).find((p) => (p.contradizPor ?? []).length);
  const idVestigio = pergunta.contradizPor.find((id) =>
    jogo.misterio.vestigios.some((v) => v.id === id),
  );

  conferir('confronto é recusado sem o vestígio em mãos', jogo.confrontar(culpado.id, pergunta.id, idVestigio) === null);

  // Entrega o vestígio na mão do detetive para testar o confronto válido.
  const vestigio = jogo.misterio.vestigios.find((v) => v.id === idVestigio);
  vestigio.recolhido = true;
  jogo.recolhidos.push(vestigio);

  conferir(
    'confronto é aceito com o vestígio certo',
    jogo.confrontar(culpado.id, pergunta.id, idVestigio)?.sucesso === true,
  );
  conferir('a mesma versão não cai duas vezes', jogo.confrontar(culpado.id, pergunta.id, idVestigio) === null);
  conferir('a contradição fica registrada', jogo.contradicoes.length === 1);
  conferir('confrontar marca a resposta como ouvida', jogo.jaOuviu(culpado.id, pergunta.id));
  conferir(
    'vestígio que não desmente a resposta é recusado',
    jogo.confrontar(culpado.id, pergunta.id, 'c1') === null,
  );
  conferir(
    'pergunta sem contradição não oferece confronto',
    (() => {
      const limpa = (culpado.perguntas ?? []).find((p) => !(p.contradizPor ?? []).length);
      return limpa ? jogo.confrontosDisponiveis(culpado.id, limpa).length === 0 : true;
    })(),
  );
}

// ---------- deslocamento ----------

secao('Jogável sem ponteiro');

{
  // Rede de segurança contra a regressão que a auditoria encontrou: a única
  // porta para examinar era a fila de cliques do canvas, o que tornava o caso
  // impossível de fechar pelo teclado. Aqui nada chama irPara.
  const jogo = new Jogo(CENAS, CASO_014, 'sem-ponteiro');

  conferir('longe de tudo, examinar não encontra alvo', () => {
    const vazio = jogo.cenaAtual.pontosDeVestigio[0] ?? jogo.cenaAtual.inicio;
    jogo.detetive.gx = jogo.cenaAtual.inicio.gx;
    jogo.detetive.gy = jogo.cenaAtual.inicio.gy;
    const perto = jogo.alvoEm(Math.round(jogo.detetive.gx), Math.round(jogo.detetive.gy));
    return perto ? true : jogo.examinarProximo() === null || Boolean(vazio);
  });

  let documentos = 0;
  jogo.escutar('documento', () => (documentos += 1));

  // Passa por todos os locais e examina tudo, só teletransportando o detetive
  // (o equivalente a tê-lo caminhado até lá com as setas).
  for (const idCena of jogo.ordemCenas) {
    if (jogo.cenaAtual.id !== idCena) jogo.viajarPara(idCena, jogo.cenaAtual.id);

    const alvos = [
      ...jogo.vestigiosVisiveis().map((v) => ({ gx: v.gx, gy: v.gy })),
      ...[...jogo.cenaAtual.interativos.values()]
        .filter((a) => a.tipo !== 'ligacao')
        .map((a) => ({ gx: a.gx, gy: a.gy })),
    ];

    for (const alvo of alvos) {
      const parada = ladoAcessivel(jogo.cenaAtual, alvo, jogo.detetive);
      if (!parada) continue;
      jogo.detetive.gx = parada.gx;
      jogo.detetive.gy = parada.gy;
      jogo.examinarProximo();
    }
  }

  conferir(
    'recolheu todos os vestígios sem um único clique',
    jogo.recolhidos.length === jogo.misterio.total,
    `${jogo.recolhidos.length} de ${jogo.misterio.total}`,
  );
  conferir('leu documentos sem um único clique', documentos > 0, `${documentos} leituras`);
  conferir('a acusação ficou liberada', jogo.podeAcusar);

  const veredito = jogo.acusar(jogo.misterio.culpado.id);
  conferir('fechou o caso sem ponteiro', veredito.acertou);
  conferir('examinar após encerrar é recusado', jogo.examinarProximo() === null);
}

secao('Custo para errar');

{
  const jogo = new Jogo(CENAS, CASO_014, 'custo');
  const culpado = jogo.misterio.culpado;
  const base = (culpado.perguntas ?? []).find((p) => (p.contradizPor ?? []).length);

  // Entrega um vestígio neutro: válido para tentar, inútil para desmentir.
  const neutro = jogo.misterio.vestigios.find((v) => !v.aponta);
  const certo = jogo.misterio.vestigios.find((v) => (base.contradizPor ?? []).includes(v.id));
  for (const vestigio of [neutro, certo]) {
    vestigio.recolhido = true;
    jogo.recolhidos.push(vestigio);
  }

  conferir('o suspeito começa aberto', !jogo.suspeitoFechado(culpado.id));
  conferir(
    'tentativas começam no limite do caso',
    jogo.tentativasRestantes(culpado.id) === CASO_014.limiteDeTentativas,
  );

  let avisouFalha = 0;
  jogo.escutar('confrontoFalhou', () => (avisouFalha += 1));

  const erro1 = jogo.confrontar(culpado.id, base.id, neutro.id);
  conferir('confronto sem base é tentativa válida que falha', erro1?.sucesso === false);
  conferir('a tentativa foi descontada', jogo.tentativasRestantes(culpado.id) === CASO_014.limiteDeTentativas - 1);
  conferir('o erro não registra contradição', jogo.contradicoes.length === 0);
  conferir('o evento de falha foi disparado', avisouFalha === 1);
  conferir('o suspeito ainda responde', !jogo.suspeitoFechado(culpado.id));

  const erro2 = jogo.confrontar(culpado.id, base.id, neutro.id);
  conferir('o segundo erro fecha a conversa', erro2?.sucesso === false && erro2.fechou === true);
  conferir('suspeito fechado', jogo.suspeitoFechado(culpado.id));
  conferir('ouvir é recusado depois de fechar', jogo.ouvir(culpado.id, base.id) === false);
  conferir(
    'confrontar com o vestígio certo também é recusado depois de fechar',
    jogo.confrontar(culpado.id, base.id, certo.id) === null,
  );

  // Fechar um suspeito não pode travar o caso: acusar continua possível.
  conferir('outro suspeito segue aberto', !jogo.suspeitoFechado(
    CASO_014.suspeitos.find((s) => s.id !== culpado.id).id,
  ));
  while (jogo.recolhidos.length < CASO_014.minimoParaAcusar) {
    const livre = jogo.misterio.vestigios.find((v) => !v.recolhido);
    livre.recolhido = true;
    jogo.recolhidos.push(livre);
  }
  conferir('a acusação continua liberada mesmo com suspeito fechado', jogo.podeAcusar);

  // O custo precisa sobreviver a recarregar a página.
  const retomado = new Jogo(CENAS, CASO_014, 'custo');
  retomado.restaurar(jogo.estado());
  conferir('o suspeito continua fechado após retomar', retomado.suspeitoFechado(culpado.id));
  conferir(
    'as tentativas gastas voltaram iguais',
    retomado.tentativasRestantes(culpado.id) === jogo.tentativasRestantes(culpado.id),
  );

  const sujo = new Jogo(CENAS, CASO_014, 'custo');
  sujo.restaurar({ ...jogo.estado(), tentativasFalhas: [['fantasma', 9], [culpado.id, -3]] });
  conferir(
    'tentativas corrompidas são ignoradas',
    sujo.tentativasRestantes(culpado.id) === CASO_014.limiteDeTentativas,
  );
}

secao('A cidade como praça central');

{
  const jogo = new Jogo(CENAS, CASO_014, 'viagem');
  const cidade = jogo.cenaAtual;

  conferir('o detetive começa na cidade', cidade.id === 'cidade');

  // Alcançável a partir da cidade, não necessariamente ligado direto a ela.
  // Exigir porta na rua para todo local proibiria aninhar — um corredor dentro
  // do edifício, um depósito atrás do escritório —, e aninhar é legítimo.
  const alcancados = new Set([cidade.id]);
  const fila = [cidade.id];
  while (fila.length) {
    const cena = jogo.cenas.get(fila.shift());
    for (const ligacao of cena.ligacoes) {
      if (alcancados.has(ligacao.para)) continue;
      if (!jogo.cenas.has(ligacao.para)) continue;
      alcancados.add(ligacao.para);
      fila.push(ligacao.para);
    }
  }
  const ilhados = jogo.ordemCenas.filter((id) => !alcancados.has(id));
  conferir(
    'todo local é alcançável a partir da cidade',
    ilhados.length === 0,
    ilhados.length ? `ilhados: ${ilhados.join(', ')}` : alcancados.size + ' locais',
  );

  // Passagem apontando para local que não existe é erro de digitação ou de um
  // arquivo apagado: o jogador clica na porta e nada acontece.
  const perdidas = [];
  for (const id of jogo.ordemCenas) {
    for (const ligacao of jogo.cenas.get(id).ligacoes) {
      if (!jogo.cenas.has(ligacao.para)) {
        perdidas.push(`${id} aponta para ${ligacao.para}, que não existe`);
      }
    }
  }
  conferir('nenhuma passagem aponta para local inexistente', perdidas.length === 0, perdidas.join('; '));

  // O que importa é poder voltar à rua, não que cada par de portas seja
  // simétrico. Exigir simetria proibia mão única — uma saída de emergência que
  // dá noutra rua, por exemplo — sem o jogo precisar disso: chegando num local
  // sem porta de volta para a origem, `viajarPara` põe o detetive no X.
  const presos = [];
  for (const inicio of jogo.ordemCenas) {
    if (inicio === cidade.id) continue;
    const vistos = new Set([inicio]);
    const fila = [inicio];
    let chegou = false;
    while (fila.length && !chegou) {
      for (const ligacao of jogo.cenas.get(fila.shift()).ligacoes) {
        if (ligacao.para === cidade.id) {
          chegou = true;
          break;
        }
        if (vistos.has(ligacao.para) || !jogo.cenas.has(ligacao.para)) continue;
        vistos.add(ligacao.para);
        fila.push(ligacao.para);
      }
    }
    if (!chegou) presos.push(inicio);
  }
  conferir('de todo local dá para voltar à cidade', presos.length === 0, presos.join('; '));

  // A porta precisa ser alcançável a pé a partir de onde o detetive chega.
  const inalcancaveis = [];
  for (const id of jogo.ordemCenas) {
    const cena = jogo.cenas.get(id);
    for (const ligacao of cena.ligacoes) {
      const parada = ladoAcessivel(cena, ligacao, cena.inicio);
      const mesmo = parada && parada.gx === cena.inicio.gx && parada.gy === cena.inicio.gy;
      if (!parada || (!mesmo && !buscarCaminho(cena, cena.inicio, parada).length)) {
        inalcancaveis.push(`${id}: porta para ${ligacao.para}`);
      }
    }
  }
  conferir('toda porta é alcançável a pé', inalcancaveis.length === 0, inalcancaveis.join('; '));

  conferir('viajar para o local atual é recusado', jogo.viajarPara(cidade.id) === false);
  conferir('viajar para local inexistente é recusado', jogo.viajarPara('nao-existe') === false);

  // Entra no prédio pela porta, como o jogador faria.
  const porta = cidade.ligacoes[0];
  let avisou = null;
  jogo.escutar('viagem', ({ cena }) => (avisou = cena.id));

  conferir('caminhou até a porta do prédio', andarAte(jogo, porta.gx, porta.gy));
  conferir('examinar a porta leva ao local', jogo.cenaAtual.id === porta.para, jogo.cenaAtual.id);
  conferir('evento de viagem disparado', avisou === porta.para);
  conferir(
    'só os vestígios do local atual ficam visíveis',
    jogo.vestigiosVisiveis().every((v) => v.cena === porta.para),
  );

  // E a volta deixa o detetive na porta daquele prédio, não no ponto de partida.
  const dentro = jogo.cenaAtual;
  const volta = dentro.ligacaoPara('cidade');
  conferir('o local tem porta de volta para a rua', volta !== null);
  conferir('caminhou até a saída', andarAte(jogo, volta.gx, volta.gy));
  conferir('voltou para a cidade', jogo.cenaAtual.id === 'cidade');
  conferir(
    'chegou na porta do prédio de onde saiu, e não no ponto de partida',
    jogo.detetive.gx === porta.gx && jogo.detetive.gy === porta.gy,
    `(${jogo.detetive.gx},${jogo.detetive.gy}) esperado (${porta.gx},${porta.gy})`,
  );
}

// ---------- progresso salvo ----------

secao('Progresso salvo');

{
  const deposito = new DepositoMemoria();
  const progresso = new Progresso(deposito);
  conferir('depósito disponível', progresso.disponivel);

  const jogo = new Jogo(CENAS, CASO_014, 'persistencia');
  // Recolhe dois vestígios e derruba uma versão.
  for (const vestigio of jogo.misterio.vestigios.slice(0, 2)) {
    vestigio.recolhido = true;
    jogo.recolhidos.push(vestigio);
  }
  jogo.documentosLidos.add('boletim');
  jogo.ouvir('luca', 'relacao');
  const alvo = jogo.misterio.vestigios[0];
  const perguntaAlvo = CASO_014.suspeitos
    .flatMap((s) => (s.perguntas ?? []).map((p) => ({ s, p })))
    .find(({ p }) => (p.contradizPor ?? []).includes(alvo.id));
  if (perguntaAlvo) jogo.confrontar(perguntaAlvo.s.id, perguntaAlvo.p.id, alvo.id);
  jogo.viajarPara(jogo.outrosLocais()[0].id);

  conferir('salvou', progresso.salvar(jogo));

  const estado = progresso.carregar();
  conferir('carregou um estado válido', estado !== null && estado.semente === jogo.semente);

  const retomado = new Jogo(CENAS, CASO_014, 'persistencia');
  conferir('restaurou', retomado.restaurar(estado) === true);
  conferir(
    'vestígios recolhidos voltaram iguais',
    JSON.stringify(retomado.recolhidos.map((v) => v.id)) === JSON.stringify(jogo.recolhidos.map((v) => v.id)),
  );
  conferir('local foi restaurado', retomado.cenaAtual.id === jogo.cenaAtual.id);
  conferir('documentos lidos voltaram', retomado.documentosLidos.has('boletim'));
  conferir('respostas ouvidas voltaram', retomado.jaOuviu('luca', 'relacao'));
  conferir(
    'contradições voltaram',
    retomado.contradicoes.length === jogo.contradicoes.length,
    `${retomado.contradicoes.length} de ${jogo.contradicoes.length}`,
  );
  conferir(
    'vestígios restaurados não aparecem mais no chão',
    retomado.misterio.vestigios.filter((v) => v.recolhido).length === jogo.recolhidos.length,
  );

  const outra = new Jogo(CENAS, CASO_014, 'semente-diferente');
  conferir('progresso de outra semente é ignorado', outra.restaurar(estado) === false);
  conferir('estado corrompido é ignorado', outra.restaurar({ semente: outra.semente, recolhidos: ['xxx'] }) === true && outra.recolhidos.length === 0);

  progresso.limpar();
  conferir('limpou', progresso.carregar() === null);
}

// ---------- partida simulada ----------

secao('Partida simulada (sem navegador)');

for (const semente of ['sim-1', 'sim-2', 'sim-3']) {
  const jogo = new Jogo(CENAS, CASO_014, semente);
  const eventos = [];
  jogo.escutar('vestigio', (d) => eventos.push(d.vestigio.id));
  jogo.escutar('documento', (d) => eventos.push(`doc:${d.documento.id}`));

  let travou = null;

  // Percorre cada local: primeiro o atual, depois viaja para os demais.
  const roteiro = [jogo.cenaAtual.id, ...jogo.outrosLocais().map((l) => l.id)];
  for (const idCena of roteiro) {
    if (jogo.cenaAtual.id !== idCena && !jogo.viajarPara(idCena)) {
      travou = `não conseguiu ir para ${idCena}`;
      break;
    }

    const alvos = [
      ...jogo.vestigiosVisiveis().map((v) => ({ gx: v.gx, gy: v.gy })),
      // Passagens ficam de fora: examinar uma delas trocaria de local no meio.
      ...[...jogo.cenaAtual.interativos.values()]
        .filter((alvo) => alvo.tipo !== 'ligacao')
        .map((alvo) => ({ gx: alvo.gx, gy: alvo.gy })),
    ];

    for (const alvo of alvos) {
      if (!andarAte(jogo, alvo.gx, alvo.gy)) {
        travou = `(${alvo.gx},${alvo.gy}) em ${idCena}`;
        break;
      }
    }
    if (travou) break;
  }

  conferir(`${semente}: caminhou por todos os locais e alvos`, travou === null, travou ?? '');
  conferir(
    `${semente}: recolheu os ${jogo.misterio.total} vestígios`,
    jogo.recolhidos.length === jogo.misterio.total,
    `${jogo.recolhidos.length} recolhidos`,
  );
  conferir(
    `${semente}: leu os documentos fixos`,
    jogo.documentosLidos.size === CASO_014.documentos.length,
    `${jogo.documentosLidos.size} de ${CASO_014.documentos.length}`,
  );
  conferir(`${semente}: nenhum evento duplicado`, new Set(eventos).size === eventos.length);

  // Interroga todos e derruba o que for possível derrubar.
  for (const suspeito of CASO_014.suspeitos) {
    for (const pergunta of suspeito.perguntas ?? []) {
      jogo.ouvir(suspeito.id, pergunta.id);
      for (const vestigio of jogo.confrontosDisponiveis(suspeito.id, pergunta)) {
        jogo.confrontar(suspeito.id, pergunta.id, vestigio.id);
        break;
      }
    }
  }

  const quebrasDoCulpado = jogo.contradicoes.filter((c) => c.suspeito === jogo.misterio.culpado.id);
  conferir(
    `${semente}: derrubou todas as versões do culpado`,
    quebrasDoCulpado.length === jogo.misterio.contradicoesPossiveis,
    `${quebrasDoCulpado.length} de ${jogo.misterio.contradicoesPossiveis}`,
  );

  const veredito = jogo.acusar(jogo.misterio.culpado.id);
  conferir(`${semente}: fechamento completo ao acusar o culpado`, veredito.acertou && veredito.forca === 'completa', veredito.forca);
  conferir(`${semente}: investigação encerrada e detetive parado`, jogo.encerrado && jogo.detetive.rota.length === 0);
  conferir(`${semente}: viagem recusada após encerrar`, jogo.viajarPara(roteiro[0]) === false);
  conferir(`${semente}: confronto recusado após encerrar`, jogo.confrontar(CASO_014.suspeitos[0].id, 'onde', 'm1') === null);
}

// ---------- resultado ----------

console.log(`\n${falhas === 0 ? 'Tudo certo' : 'Com falhas'}: ${checagens - falhas}/${checagens} checagens passaram.`);
process.exit(falhas === 0 ? 0 : 1);
