// Teste de fumaça do caminho do navegador.
//
// A verificação em `verificar.mjs` cobre mundo, mistério e regras, mas nada ali
// executa o renderizador nem a inicialização real. Foi essa a brecha que deixou
// passar um `jogo.cena` órfão no renderizador: a lógica passava, e o desenho
// quebrava no primeiro quadro.
//
// Aqui montamos um DOM mínimo, importamos o main.js como o navegador faria,
// rodamos vários quadros e acionamos os atalhos. Qualquer exceção reprova.

import { montarDom } from './dom-falso.mjs';

let falhas = 0;
let checagens = 0;

function relatar(descricao, erro) {
  if (!erro) {
    console.log(`  ok   ${descricao}`);
    return true;
  }
  falhas += 1;
  console.error(`  FALHA ${descricao} — ${erro?.message ?? erro}`);
  if (erro?.stack) console.error(erro.stack.split('\n').slice(1, 4).join('\n'));
  return false;
}

function conferir(descricao, acao) {
  checagens += 1;
  try {
    const resultado = typeof acao === 'function' ? acao() : acao;
    if (resultado === false) throw new Error('resultado falso');
    if (resultado instanceof Promise) {
      // Guarda contra o erro que já aconteceu aqui: uma função async devolve uma
      // Promise, que não é `false`, e a checagem passaria sem esperar nada.
      throw new Error('use conferirAsync para ações assíncronas');
    }
    return relatar(descricao);
  } catch (erro) {
    return relatar(descricao, erro);
  }
}

/** Versão que realmente aguarda a ação antes de julgar o resultado. */
async function conferirAsync(descricao, acao) {
  checagens += 1;
  try {
    const resultado = await acao();
    if (resultado === false) throw new Error('resultado falso');
    return relatar(descricao);
  } catch (erro) {
    return relatar(descricao, erro);
  }
}

// ---------- DOM mínimo ----------
//
// O andaime mora em `dom-falso.mjs`, compartilhado com a fumaça do editor.

const dom = montarDom(new URL('../index.html', import.meta.url));
const { porId, ids: IDS, dispararNaJanela, rodarQuadros } = dom;

// ---------- execução ----------

console.log('Teste de fumaça (DOM mínimo, caminho real de inicialização)');

const palco = porId.get('palco');

conferir('o index.html declara todos os ids que o código procura', IDS.size > 20);

// O import é aguardado de verdade. Quando o módulo termina de avaliar, o
// main.js já chamou requestAnimationFrame, então não há corrida de tempo aqui.
const importou = await conferirAsync('main.js importa sem lançar', () => import('../src/main.js'));

if (!importou) {
  console.error('\nSem carregar o main.js não há o que medir. Interrompendo.');
  process.exit(1);
}

conferir('o laço pediu o primeiro quadro', () => dom.aoQuadro !== null);

if (!dom.aoQuadro) {
  console.error('\nO laço nunca pediu um quadro, então os testes seguintes não diriam nada.');
  process.exit(1);
}
conferir('primeiro quadro desenha sem lançar', () => rodarQuadros(1) ?? true);
conferir('sessenta quadros seguidos sem lançar', () => rodarQuadros(60) ?? true);

conferir('mover o ponteiro sobre a cena não quebra', () => {
  palco.disparar('pointermove', { clientX: 640, clientY: 360 });
  rodarQuadros(3);
  return true;
});

conferir('clicar na cena não quebra e o detetive responde', () => {
  palco.disparar('pointerdown', { button: 0, pointerType: 'mouse', clientX: 700, clientY: 380 });
  rodarQuadros(30);
  return true;
});

conferir('ponteiro fora da cena não quebra', () => {
  palco.disparar('pointerleave', {});
  rodarQuadros(3);
  return true;
});

conferir('examinar pelo teclado não quebra', () => {
  dispararNaJanela('keydown', { code: 'KeyE', key: 'KeyE' });
  rodarQuadros(5);
  return true;
});

for (const [tecla, nome] of [
  ['KeyC', 'caderno'],
  ['KeyF', 'suspeitos'],
  ['KeyL', 'locais'],
  ['KeyG', 'acusação'],
]) {
  conferir(`atalho de ${nome} não quebra`, () => {
    dispararNaJanela('keydown', { code: tecla, key: tecla });
    rodarQuadros(5);
    dispararNaJanela('keydown', { code: 'Escape', key: 'Escape' });
    rodarQuadros(5);
    return true;
  });
}

conferir('caminhada pelo teclado não quebra', () => {
  dispararNaJanela('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', target: {} });
  rodarQuadros(20);
  dispararNaJanela('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' });
  rodarQuadros(5);
  return true;
});

conferir('nova investigação reinicia sem quebrar', () => {
  dispararNaJanela('keydown', { code: 'KeyN', key: 'KeyN' });
  rodarQuadros(30);
  return true;
});

conferir('redimensionar a janela não quebra', () => {
  dispararNaJanela('resize', {});
  rodarQuadros(5);
  return true;
});

conferir('o progresso foi gravado no depósito', () => dom.guardado.size > 0);


// ---------- decoração e mapa grande ----------
//
// A decoração é camada de mundo, não de editor: entra na cena, bloqueia
// passagem e é desenhada. O mapa grande é o caso que travava antes, quando o
// chão era pré-renderizado inteiro numa imagem só e passava do limite de área
// de canvas do navegador.

console.log('\nDecoração e mapa grande');

const { Jogo } = await import('../src/jogo/jogo.js');
const { Cena } = await import('../src/mundo/cena.js');
const { Camera } = await import('../src/core/camera.js');
const { Renderizador } = await import('../src/render/renderizador.js');
const { CENA_CIDADE } = await import('../src/dados/cena-cidade.js');
const { OBJETOS, CHAO } = await import('../src/mundo/tiles.js');
// A lista completa, a mesma que o jogo monta: local criado pelo editor entra
// aqui sozinho, e a fumaça passa a cobri-lo.
const { CENAS } = await import('../src/dados/cenas.js');
const { CASO_RUTTERFORT: CASO_014 } = await import('../src/dados/caso-rutterfort.js');
const { VISUAL } = await import('../src/dados/visual.js');
const { Acervo } = await import('../src/render/acervo.js');

/** Cresce um mapa acrescentando faixas, como o editor faz. */
function crescer(dados, colunas, linhas) {
  for (let i = 0; i < colunas; i += 1) {
    dados.chao = dados.chao.map((l) => `${l} `);
    dados.objetos = dados.objetos.map((l) => `${l}.`);
  }
  for (let i = 0; i < linhas; i += 1) {
    dados.chao.push(' '.repeat(dados.chao[0].length));
    dados.objetos.push('.'.repeat(dados.objetos[0].length));
  }
  return dados;
}

{
  const copia = (c) => ({ ...c, chao: [...c.chao], objetos: [...c.objetos] });
  const cenas = CENAS.map(copia);

  /**
   * Acha um tile da cidade que esteja realmente vazio.
   *
   * Aqui havia uma coordenada fixa, e isso era frágil pelo motivo mais banal:
   * a cidade é desenhada no editor, então basta alguém construir um prédio em
   * cima para os testes de decoração passarem a falhar sem nada ter quebrado.
   * Procurar na hora mantém o teste falando do que ele quer falar.
   */
  function acharLivre(dados) {
    const cena = new Cena(dados);
    for (let gy = 0; gy < cena.altura; gy += 1) {
      for (let gx = 0; gx < cena.largura; gx += 1) {
        if (!cena.andavel(gx, gy)) continue;
        if (cena.examinavelEm(gx, gy) || cena.decoracaoEm(gx, gy)) continue;
        if (gx === cena.inicio.gx && gy === cena.inicio.gy) continue;
        if (cena.pontosDeVestigio.some((p) => p.gx === gx && p.gy === gy)) continue;
        return { gx, gy };
      }
    }
    return null;
  }

  const LIVRE = acharLivre(copia(CENA_CIDADE)) ?? { gx: 0, gy: 0 };

  conferir(
    'achou um tile livre na cidade para os testes de decoração',
    () => acharLivre(copia(CENA_CIDADE)) !== null,
  );

  conferir('decoração entra na cena', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [{ peca: 'lib_bookcaseBooks_S', ...LIVRE, solido: true }];
    const cena = new Cena(dados);
    return cena.decoracaoEm(LIVRE.gx, LIVRE.gy)?.peca === 'lib_bookcaseBooks_S';
  });

  conferir('decoração sólida bloqueia a passagem', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [{ peca: 'dng_stoneWall_S', ...LIVRE, solido: true }];
    return new Cena(dados).andavel(LIVRE.gx, LIVRE.gy) === false;
  });

  conferir('decoração sem sólido deixa passar', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [{ peca: 'lib_libraryChair_S', ...LIVRE }];
    return new Cena(dados).andavel(LIVRE.gx, LIVRE.gy) === true;
  });

  conferir('coordenada quebrada é descartada', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [
      { peca: 'x', gx: 1.5, gy: 2 },
      { peca: '', gx: 3, gy: 3 },
      { peca: 'ok', gx: 4, gy: 4 },
    ];
    const cena = new Cena(dados);
    return cena.decoracoes.length === 1 && cena.decoracoes[0].peca === 'ok';
  });

  // ---------- altura por nível ----------
  //
  // Empilhar é o que permite montar uma casa: piso no chão, parede acima,
  // telhado em cima. Antes a chave era só o tile, então pôr o telhado apagava
  // a parede, e qualquer peça marcada como sólida emparedava o tile inteiro.

  conferir('nível ausente vale zero', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [{ peca: 'dng_stoneWall_S', ...LIVRE }];
    return new Cena(dados).decoracaoEm(LIVRE.gx, LIVRE.gy).nivel === 0;
  });

  conferir('nível fora da faixa é apertado para dentro', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [
      { peca: 'a', ...LIVRE, nivel: -7 },
      { peca: 'b', gx: LIVRE.gx + 1, gy: LIVRE.gy, nivel: 9999 },
    ];
    const cena = new Cena(dados);
    return (
      cena.decoracaoEm(LIVRE.gx, LIVRE.gy).nivel === 0 &&
      cena.decoracaoEm(LIVRE.gx + 1, LIVRE.gy).nivel === 40
    );
  });

  conferir('o mesmo tile guarda uma peça por nível', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [
      { peca: 'piso', ...LIVRE, nivel: 0 },
      { peca: 'parede', ...LIVRE, nivel: 3 },
      { peca: 'telhado', ...LIVRE, nivel: 7 },
    ];
    const cena = new Cena(dados);
    const coluna = cena.decoracoesEm(LIVRE.gx, LIVRE.gy);
    return (
      coluna.length === 3 &&
      coluna.map((d) => d.peca).join(',') === 'piso,parede,telhado' &&
      cena.decoracaoEm(LIVRE.gx, LIVRE.gy, 3).peca === 'parede'
    );
  });

  conferir('sólido no chão bloqueia', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [{ peca: 'dng_stoneWall_S', ...LIVRE, solido: true, nivel: 0 }];
    return new Cena(dados).andavel(LIVRE.gx, LIVRE.gy) === false;
  });

  conferir('sólido levantado deixa passar por baixo', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [{ peca: 'frm_roofCorner_E', ...LIVRE, solido: true, nivel: 6 }];
    return new Cena(dados).andavel(LIVRE.gx, LIVRE.gy) === true;
  });

  conferir('desenha coluna de peças empilhadas sem lançar', () => {
    const dados = copia(CENA_CIDADE);
    dados.decoracoes = [
      { peca: 'dng_dirt_E', ...LIVRE, nivel: 0 },
      { peca: 'dng_stoneWall_S', ...LIVRE, nivel: 2 },
      { peca: 'frm_roofCorner_E', ...LIVRE, nivel: 5 },
    ];
    const cenas2 = CENAS.map(copia);
    cenas2[0] = dados;
    const jogo2 = new Jogo(cenas2, CASO_014, 'niveis');
    const r = new Renderizador(palco, new Camera(), null);
    r.desenhar(jogo2, null, null, 1);
    // A prévia do editor passa pela mesma fila de desenho, nas três formas que
    // ela assume: peça do acervo, peça da matriz e material de chão.
    const variantes = [
      { peca: 'dng_stoneWall_S', gx: LIVRE.gx, gy: LIVRE.gy, nivel: 4 },
      { def: OBJETOS['#'], gx: LIVRE.gx, gy: LIVRE.gy, nivel: 0 },
      { def: OBJETOS['Y'], gx: LIVRE.gx, gy: LIVRE.gy, nivel: 3 },
      { terreno: CHAO['a'], gx: LIVRE.gx, gy: LIVRE.gy, nivel: 0 },
      { gx: 0, gy: 0, nivel: 0 },
    ];
    for (const [i, previa] of variantes.entries()) {
      r.previa = previa;
      r.desenhar(jogo2, null, null, 2 + i);
    }
    return true;
  });

  // ---------- passagens em lista ----------
  //
  // Os caracteres 1..3 limitavam cada local a três saídas e guardavam o destino
  // num campo separado. A lista não tem teto e carrega o destino junto.

  conferir('passagem em lista entra como ligação', () => {
    const dados = copia(CENA_CIDADE);
    dados.passagens = [{ gx: LIVRE.gx, gy: LIVRE.gy, para: 'delegacia', rotulo: 'Ir à delegacia' }];
    const cena = new Cena(dados);
    return cena.ligacaoPara('delegacia')?.gx === LIVRE.gx;
  });

  conferir('passagem em lista é examinável', () => {
    const dados = copia(CENA_CIDADE);
    dados.passagens = [{ gx: LIVRE.gx, gy: LIVRE.gy, para: 'delegacia' }];
    const alvo = new Cena(dados).examinavelEm(LIVRE.gx, LIVRE.gy);
    return alvo?.tipo === 'ligacao' && alvo.para === 'delegacia';
  });

  // Cena mínima com três portas por caractere (1,2,3), para os testes de
  // passagem não dependerem de quantas saídas a cidade desenhada à mão tem.
  const cenaComChars = () => ({
    id: 'teste-passagens',
    nome: 'Teste',
    endereco: '-',
    ligacoes: {
      1: { para: 'delegacia', rotulo: 'Porta 1' },
      2: { para: 'escritorio', rotulo: 'Porta 2' },
      3: { para: 'banco', rotulo: 'Porta 3' },
    },
    chao: [
      'ppppppppp',
      'ppppppppp',
      'ppppppppp',
      'ppppppppp',
      'ppppppppp',
    ],
    objetos: [
      '#########',
      '#..X....#',
      '#.......#',
      '#1..2..3#',
      '#########',
    ],
  });

  conferir('convive com as passagens em caractere', () => {
    const dados = cenaComChars();
    // Três portas por caractere; a da lista é a quarta.
    dados.passagens = [{ gx: 4, gy: 2, para: 'hotel-de-luxo' }];
    const cena = new Cena(dados);
    return cena.ligacoes.length === 4;
  });

  conferir('mais de três passagens é possível', () => {
    const dados = cenaComChars();
    // Três por caractere + cinco em lista = oito saídas, sem teto.
    dados.passagens = [
      { gx: 2, gy: 2, para: 'delegacia' },
      { gx: 3, gy: 2, para: 'cartorio' },
      { gx: 4, gy: 2, para: 'escritorio' },
      { gx: 5, gy: 2, para: 'tribunal' },
      { gx: 6, gy: 2, para: 'banco' },
    ];
    return new Cena(dados).ligacoes.length === 8;
  });

  conferir('passagem sem destino é recusada na conferência', () => {
    const dados = copia(CENA_CIDADE);
    dados.passagens = [{ gx: 10, gy: 19 }];
    return Cena.conferir(dados).some((p) => p.includes('sem destino'));
  });

  conferir('passagem fora do mapa é recusada na conferência', () => {
    const dados = copia(CENA_CIDADE);
    dados.passagens = [{ gx: 999, gy: 1, para: 'delegacia' }];
    return Cena.conferir(dados).some((p) => p.includes('fora do mapa'));
  });

  conferir('o acervo lista as peças sem baixar imagem no Node', () => {
    const acervo = new Acervo(VISUAL);
    return acervo.idsDePecas().length > 500 && acervo.carregadas === 0;
  });

  // Mapa grande: 134 x 80, acima de dez mil tiles.
  const grande = crescer(copia(CENA_CIDADE), 100, 56);
  grande.decoracoes = [{ peca: 'dng_stoneWall_S', gx: 120, gy: 70, solido: true }];
  cenas[0] = grande;

  const jogo = new Jogo(cenas, CASO_014, 'mapa-grande');
  const camera = new Camera();
  const renderizador = new Renderizador(palco, camera, null);

  conferir('o mapa grande monta', () => {
    const cena = jogo.cenas.get('cidade');
    return cena.largura > 130 && cena.altura > 75;
  });

  conferir('decoração no canto distante continua valendo', () => {
    const cena = jogo.cenas.get('cidade');
    return cena.decoracaoEm(120, 70)?.solido === true && cena.andavel(120, 70) === false;
  });

  conferir('desenha o mapa grande sem lançar', () => {
    renderizador.desenhar(jogo, null, null, 1);
    renderizador.desenhar(jogo, { gx: 4, gy: 4 }, null, 2);
    return true;
  });

  conferir('o consumo de memória não cresce com o mapa', () => {
    const cena = jogo.cenas.get('cidade');
    const tiles = cena.largura * cena.altura;
    if (tiles < 9000) throw new Error(`mapa pequeno demais para o teste: ${tiles} tiles`);
    // Um losango por material e variação, não um por tile.
    return renderizador.losangos.size < 60;
  });

  conferir('a grade de apoio também desenha sem lançar', () => {
    renderizador.mostrarGrade = true;
    renderizador.desenhar(jogo, { gx: 10, gy: 10 }, null, 3);
    renderizador.mostrarGrade = false;
    return true;
  });
}

console.log(
  `\n${falhas === 0 ? 'Fumaça limpa' : 'Com falhas'}: ${checagens - falhas}/${checagens} checagens passaram.`,
);
process.exit(falhas === 0 ? 0 : 1);
