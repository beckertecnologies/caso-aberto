// Verificação sem navegador: confere os mapas, a navegabilidade, o gerador,
// o interrogatório, o progresso salvo e simula partidas inteiras.
// Roda com `npm run check`. Os módulos de mundo e jogo são puros, então
// importam direto no Node.

import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho, ladoAcessivel } from '../src/mundo/caminho.js';
import { montarMisterio, julgar, pesarEvidencias, perguntasContraditaveis } from '../src/jogo/misterio.js';
import { Jogo } from '../src/jogo/jogo.js';
import { Progresso, DepositoMemoria } from '../src/jogo/persistencia.js';
import { CENA_APTO_302 } from '../src/dados/cena-apto302.js';
import { CENA_ESCRITORIO } from '../src/dados/cena-escritorio.js';
import { CASO_014 } from '../src/dados/caso-014.js';

const CENAS = [CENA_APTO_302, CENA_ESCRITORIO];

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
  conferir(`${cena.id}: tem saída`, cena.pecas.some((p) => p.def.interacao === 'saida'));
  conferir(`${cena.id}: tem pastas da perícia`, cena.pecas.filter((p) => p.def.interacao === 'documento').length >= 2);
  conferir(`${cena.id}: tem pontos de vestígio`, cena.pontosDeVestigio.length >= 6, `${cena.pontosDeVestigio.length}`);
}

const capacidade = cenas.reduce((soma, c) => soma + c.pontosDeVestigio.length, 0);
const precisa = CASO_014.composicao.incriminam + CASO_014.composicao.pistasFalsas + CASO_014.composicao.contexto;
conferir('capacidade total de pontos cobre o caso', capacidade >= precisa, `${capacidade} pontos para ${precisa} vestígios`);

// ---------- documentos ----------

secao('Documentos');

for (const cena of cenas) {
  const pastas = cena.pecas.filter((p) => p.def.interacao === 'documento').length;
  const docsPasta = CASO_014.documentos.filter((d) => d.cena === cena.id && d.alvo === 'pasta').length;
  conferir(
    `${cena.id}: há documento para cada pasta`,
    docsPasta >= pastas,
    `${pastas} pastas e ${docsPasta} documentos`,
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

const locaisParaGerador = cenas.map((c) => ({ id: c.id, pontos: c.pontosDeVestigio }));
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

  // Os dois locais precisam receber vestígios, senão a viagem não teria função.
  for (const cena of cenas) {
    if (!misterio.vestigios.some((v) => v.cena === cena.id)) {
      erros.push(`${semente}: nenhum vestígio em ${cena.id}`);
    }
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

  conferir('confronto é aceito com o vestígio certo', jogo.confrontar(culpado.id, pergunta.id, idVestigio) !== null);
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

secao('Deslocamento entre locais');

{
  const jogo = new Jogo(CENAS, CASO_014, 'viagem');
  const primeira = jogo.cenaAtual.id;
  const destino = jogo.outrosLocais()[0];

  conferir('há outro local para visitar', Boolean(destino));
  conferir('viajar para o local atual é recusado', jogo.viajarPara(primeira) === false);
  conferir('viajar para local inexistente é recusado', jogo.viajarPara('nao-existe') === false);

  let avisou = null;
  jogo.escutar('viagem', ({ cena }) => (avisou = cena.id));
  conferir('viagem aceita', jogo.viajarPara(destino.id) === true);
  conferir('evento de viagem disparado', avisou === destino.id);
  conferir('cena atual trocou', jogo.cenaAtual.id === destino.id);
  conferir(
    'detetive reposicionado no início do novo local',
    jogo.detetive.gx === jogo.cenaAtual.inicio.gx && jogo.detetive.gy === jogo.cenaAtual.inicio.gy,
  );
  conferir(
    'só os vestígios do local atual ficam visíveis',
    jogo.vestigiosVisiveis().every((v) => v.cena === destino.id),
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
  jogo.ouvir('marcela', 'relacao');
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
  conferir('respostas ouvidas voltaram', retomado.jaOuviu('marcela', 'relacao'));
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
      ...[...jogo.cenaAtual.interativos.values()]
        .filter((alvo) => alvo.tipo !== 'saida')
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
