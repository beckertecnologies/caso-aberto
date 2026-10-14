// Verificação sem navegador: confere o mapa, a navegabilidade e o gerador.
// Roda com `npm run check`. Os módulos de mundo e mistério são puros, então
// importam direto no Node.

import { Cena } from '../src/mundo/cena.js';
import { buscarCaminho, ladoAcessivel } from '../src/mundo/caminho.js';
import { montarMisterio, julgar, pesarEvidencias } from '../src/jogo/misterio.js';
import { Jogo } from '../src/jogo/jogo.js';
import { CENA_APTO_302 } from '../src/dados/cena-apto302.js';
import { CASO_014 } from '../src/dados/caso-014.js';

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

// ---------- mapa ----------

secao('Mapa');

const problemas = Cena.conferir(CENA_APTO_302);
conferir('camadas do mapa consistentes', problemas.length === 0, problemas.join('; '));

let cena;
try {
  cena = new Cena(CENA_APTO_302);
  conferir('cena montada', true);
} catch (erro) {
  conferir('cena montada', false, erro.message);
  process.exit(1);
}

conferir('mapa com dimensões esperadas', cena.largura === 26 && cena.altura === 22, `${cena.largura}x${cena.altura}`);
conferir('ponto de início definido e andável', cena.andavel(cena.inicio.gx, cena.inicio.gy), JSON.stringify(cena.inicio));
conferir(
  'pontos de vestígio suficientes para o caso',
  cena.pontosDeVestigio.length >= CASO_014.composicao.incriminam + CASO_014.composicao.pistasFalsas + CASO_014.composicao.contexto,
  `${cena.pontosDeVestigio.length} pontos`,
);
conferir('existem pastas da perícia no mapa', cena.pecas.filter((p) => p.def.interacao === 'documento').length >= 2);
conferir('existe a marcação da vítima', cena.pecas.some((p) => p.def.interacao === 'corpo'));
conferir('existe a saída', cena.pecas.some((p) => p.def.interacao === 'saida'));

// ---------- navegabilidade ----------

secao('Navegabilidade (A* a partir do início)');

const inicio = { gx: cena.inicio.gx, gy: cena.inicio.gy };

const inalcancaveis = [];
for (const ponto of cena.pontosDeVestigio) {
  if (!cena.andavel(ponto.gx, ponto.gy)) {
    inalcancaveis.push(`(${ponto.gx},${ponto.gy}) não é andável`);
    continue;
  }
  const rota = buscarCaminho(cena, inicio, ponto);
  if (!rota.length) inalcancaveis.push(`(${ponto.gx},${ponto.gy}) sem rota`);
}
conferir('todos os pontos de vestígio são alcançáveis', inalcancaveis.length === 0, inalcancaveis.join('; '));

const examinaveisRuins = [];
for (const [, alvo] of cena.interativos) {
  const parada = ladoAcessivel(cena, alvo, inicio);
  if (!parada) {
    examinaveisRuins.push(`${alvo.def.id} (${alvo.gx},${alvo.gy}) sem lado livre`);
    continue;
  }
  const mesmoTile = parada.gx === inicio.gx && parada.gy === inicio.gy;
  const rota = buscarCaminho(cena, inicio, parada);
  if (!rota.length && !mesmoTile) {
    examinaveisRuins.push(`${alvo.def.id} (${alvo.gx},${alvo.gy}) sem rota`);
  }
}
conferir('todos os objetos examináveis são alcançáveis', examinaveisRuins.length === 0, examinaveisRuins.join('; '));

// Confere que a diagonal não atravessa quina de parede.
const atravessaQuina = [];
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
      const lado1 = cena.andavel(gx + dx, gy);
      const lado2 = cena.andavel(gx, gy + dy);
      if (lado1 || lado2) continue;
      const rota = buscarCaminho(cena, { gx, gy }, destino);
      if (rota.length === 1) {
        atravessaQuina.push(`(${gx},${gy}) -> (${destino.gx},${destino.gy})`);
      }
    }
  }
}
conferir('A* não corta quina de parede', atravessaQuina.length === 0, atravessaQuina.slice(0, 5).join('; '));

// ---------- gerador de mistério ----------

secao('Gerador de mistério');

const composicao = CASO_014.composicao;
const esperado = composicao.incriminam + composicao.pistasFalsas + composicao.contexto;
const culpadosVistos = new Set();
const errosGerador = [];
const SEMENTES = 240;

for (let i = 0; i < SEMENTES; i += 1) {
  const semente = `verificacao-${i}`;
  let misterio;
  try {
    misterio = montarMisterio(CASO_014, cena.pontosDeVestigio, semente);
  } catch (erro) {
    errosGerador.push(`${semente}: ${erro.message}`);
    continue;
  }

  culpadosVistos.add(misterio.culpado.id);

  if (misterio.vestigios.length !== esperado) {
    errosGerador.push(`${semente}: ${misterio.vestigios.length} vestígios, esperado ${esperado}`);
  }

  const doCulpado = misterio.vestigios.filter((v) => v.aponta === misterio.culpado.id);
  if (doCulpado.length !== composicao.incriminam) {
    errosGerador.push(`${semente}: ${doCulpado.length} provas do culpado, esperado ${composicao.incriminam}`);
  }

  const neutros = misterio.vestigios.filter((v) => !v.aponta);
  if (neutros.length !== composicao.contexto) {
    errosGerador.push(`${semente}: ${neutros.length} vestígios de contexto, esperado ${composicao.contexto}`);
  }

  // Nenhum inocente pode ter tantas provas quanto o culpado: a dedução ficaria ambígua.
  const { peso } = pesarEvidencias(misterio, misterio.vestigios);
  for (const [idSuspeito, quantidade] of peso) {
    if (idSuspeito !== misterio.culpado.id && quantidade >= composicao.incriminam) {
      errosGerador.push(`${semente}: inocente ${idSuspeito} com ${quantidade} provas`);
    }
  }

  // Posições distintas e válidas.
  const posicoes = new Set(misterio.vestigios.map((v) => `${v.gx},${v.gy}`));
  if (posicoes.size !== misterio.vestigios.length) {
    errosGerador.push(`${semente}: dois vestígios no mesmo tile`);
  }
  for (const vestigio of misterio.vestigios) {
    if (!cena.andavel(vestigio.gx, vestigio.gy)) {
      errosGerador.push(`${semente}: vestígio em tile não andável (${vestigio.gx},${vestigio.gy})`);
    }
  }

  // Ids únicos.
  const ids = new Set(misterio.vestigios.map((v) => v.id));
  if (ids.size !== misterio.vestigios.length) {
    errosGerador.push(`${semente}: vestígio repetido`);
  }
}

conferir(`gerador estável em ${SEMENTES} sementes`, errosGerador.length === 0, errosGerador.slice(0, 5).join(' | '));
conferir(
  'todos os suspeitos podem ser o culpado',
  culpadosVistos.size === CASO_014.suspeitos.length,
  `vistos: ${[...culpadosVistos].join(', ')}`,
);

// Mesma semente, mesmo mistério.
const a = montarMisterio(CASO_014, cena.pontosDeVestigio, 'repetivel');
const b = montarMisterio(CASO_014, cena.pontosDeVestigio, 'repetivel');
conferir(
  'a mesma semente reproduz a mesma investigação',
  a.culpado.id === b.culpado.id &&
    JSON.stringify(a.vestigios.map((v) => [v.id, v.gx, v.gy])) ===
      JSON.stringify(b.vestigios.map((v) => [v.id, v.gx, v.gy])),
);

const c = montarMisterio(CASO_014, cena.pontosDeVestigio, 'outra-semente');
conferir(
  'sementes diferentes mudam a investigação',
  JSON.stringify(a.vestigios.map((v) => [v.id, v.gx, v.gy])) !==
    JSON.stringify(c.vestigios.map((v) => [v.id, v.gx, v.gy])),
);

// ---------- desfecho ----------

secao('Desfecho');

const misterio = montarMisterio(CASO_014, cena.pontosDeVestigio, 'desfecho');
const todas = misterio.vestigios.slice();

const acerto = julgar(misterio, misterio.culpado.id, todas);
conferir('acusar o culpado com tudo em mãos resulta em acerto completo', acerto.acertou && acerto.forca === 'completa');

const inocente = CASO_014.suspeitos.find((s) => s.id !== misterio.culpado.id);
const erro = julgar(misterio, inocente.id, todas);
conferir('acusar um inocente resulta em erro', !erro.acertou && erro.acusado.id === inocente.id);

const semProvas = julgar(misterio, misterio.culpado.id, todas.filter((v) => v.aponta !== misterio.culpado.id));
conferir('acertar sem prova material é marcado como fundamentação fraca', semProvas.acertou && semProvas.forca === 'fraca');

// ---------- partida simulada ----------

secao('Partida simulada (sem navegador)');

for (const semente of ['sim-1', 'sim-2', 'sim-3']) {
  const jogo = new Jogo(CENA_APTO_302, CASO_014, semente);
  const eventos = [];
  jogo.escutar('vestigio', (d) => eventos.push(d.vestigio.id));
  jogo.escutar('documento', (d) => eventos.push(`doc:${d.documento.id}`));

  const alvos = [
    ...jogo.misterio.vestigios.map((v) => ({ gx: v.gx, gy: v.gy })),
    ...[...jogo.cena.interativos.values()]
      .filter((alvo) => alvo.tipo !== 'saida')
      .map((alvo) => ({ gx: alvo.gx, gy: alvo.gy })),
  ];

  let travou = null;
  for (const alvo of alvos) {
    jogo.irPara(alvo.gx, alvo.gy);
    let passos = 0;
    // Avança a simulação a 60 quadros por segundo até a caminhada terminar.
    while ((jogo.detetive.rota.length || jogo.detetive.aoChegar) && passos < 4000) {
      jogo.atualizar(1 / 60, null);
      passos += 1;
    }
    if (passos >= 4000) travou = `(${alvo.gx},${alvo.gy})`;
  }

  conferir(`${semente}: caminhou até todos os alvos`, travou === null, travou ? `travou em ${travou}` : '');
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

  const veredito = jogo.acusar(jogo.misterio.culpado.id);
  conferir(`${semente}: desfecho completo ao acusar o culpado`, veredito.acertou && veredito.forca === 'completa');
  conferir(
    `${semente}: investigação encerrada e detetive parado`,
    jogo.encerrado && jogo.detetive.rota.length === 0,
  );
  conferir(`${semente}: recolher de novo não altera o caderno`, (() => {
    const antes = jogo.recolhidos.length;
    jogo.irPara(jogo.misterio.vestigios[0].gx, jogo.misterio.vestigios[0].gy);
    jogo.atualizar(1 / 60, null);
    return jogo.recolhidos.length === antes;
  })());
}

// ---------- resultado ----------

console.log(`\n${falhas === 0 ? 'Tudo certo' : 'Com falhas'}: ${checagens - falhas}/${checagens} checagens passaram.`);
process.exit(falhas === 0 ? 0 : 1);
