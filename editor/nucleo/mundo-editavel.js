// Modelo do mundo em edição.
//
// Guarda as matrizes de texto e a lista de decoração, aplica as operações do
// editor e reconstrói a Cena do jogo para validar. Não toca no DOM: é aqui que
// mora a regra, e é isto que os testes exercitam.
//
// O desfazer guarda retrato do estado inteiro em vez de operação por operação.
// Um retrato de um mapa de 134×80 dá uns 11 KB, então cinquenta deles custam
// meio megabyte — barato o bastante para cobrir também preenchimento de área e
// mudança de tamanho, que mexem em tudo de uma vez.

import { Cena } from '/src/mundo/cena.js';
import { buscarCaminho } from '/src/mundo/caminho.js';
import { nivelValido } from '/src/core/iso.js';

const LIMITE_RETRATOS = 50;

const VAZIO = { chao: ' ', objetos: '.' };

export class MundoEditavel {
  /** @param {object} dados cena como vem do arquivo */
  constructor(dados) {
    this.dados = {
      ...dados,
      chao: [...dados.chao],
      objetos: [...dados.objetos],
      decoracoes: (dados.decoracoes ?? []).map((d) => ({ ...d, nivel: nivelValido(d.nivel) })),
      passagens: (dados.passagens ?? []).map((p) => ({ ...p })),
    };
    this.passado = [];
    this.futuro = [];
    this.sujo = false;
    this.cena = new Cena(this.dados);
  }

  get largura() {
    return this.dados.chao[0].length;
  }

  get altura() {
    return this.dados.chao.length;
  }

  dentro(gx, gy) {
    return gx >= 0 && gy >= 0 && gx < this.largura && gy < this.altura;
  }

  // ---------- histórico ----------

  #retrato() {
    return {
      chao: [...this.dados.chao],
      objetos: [...this.dados.objetos],
      decoracoes: this.dados.decoracoes.map((d) => ({ ...d })),
      passagens: this.dados.passagens.map((p) => ({ ...p })),
    };
  }

  #restaurar(retrato) {
    this.dados.chao = [...retrato.chao];
    this.dados.objetos = [...retrato.objetos];
    this.dados.decoracoes = retrato.decoracoes.map((d) => ({ ...d }));
    this.dados.passagens = retrato.passagens.map((p) => ({ ...p }));
    this.cena = new Cena(this.dados);
  }

  #guardar() {
    this.passado.push(this.#retrato());
    if (this.passado.length > LIMITE_RETRATOS) this.passado.shift();
    this.futuro.length = 0;
  }

  /**
   * Aplica uma mudança. Se o resultado não montar como Cena válida, desfaz e
   * devolve a mensagem — o editor nunca fica com mundo impossível em mãos.
   */
  #aplicar(mudanca) {
    const antes = this.#retrato();
    this.#guardar();
    try {
      mudanca();
      this.cena = new Cena(this.dados);
      this.sujo = true;
      return { ok: true };
    } catch (erro) {
      this.passado.pop();
      this.#restaurar(antes);
      return { ok: false, erro: erro.message.split('\n').slice(-1)[0] };
    }
  }

  desfazer() {
    const retrato = this.passado.pop();
    if (!retrato) return false;
    this.futuro.push(this.#retrato());
    this.#restaurar(retrato);
    this.sujo = true;
    return true;
  }

  refazer() {
    const retrato = this.futuro.pop();
    if (!retrato) return false;
    this.passado.push(this.#retrato());
    this.#restaurar(retrato);
    this.sujo = true;
    return true;
  }

  // ---------- pintura ----------

  charEm(camada, gx, gy) {
    if (!this.dentro(gx, gy)) return null;
    return this.dados[camada][gy][gx];
  }

  /** Troca um caractere. `camada` é 'chao' ou 'objetos'. */
  pintar(camada, gx, gy, caractere) {
    if (!this.dentro(gx, gy)) return { ok: false, erro: 'fora do mapa' };
    if (this.dados[camada][gy][gx] === caractere) return { ok: true, igual: true };
    return this.#aplicar(() => {
      const linha = this.dados[camada][gy];
      this.dados[camada][gy] = linha.slice(0, gx) + caractere + linha.slice(gx + 1);
    });
  }

  /** Pinta um retângulo inteiro de uma vez, inclusive as bordas. */
  retangulo(camada, a, b, caractere) {
    const x0 = Math.max(0, Math.min(a.gx, b.gx));
    const x1 = Math.min(this.largura - 1, Math.max(a.gx, b.gx));
    const y0 = Math.max(0, Math.min(a.gy, b.gy));
    const y1 = Math.min(this.altura - 1, Math.max(a.gy, b.gy));

    return this.#aplicar(() => {
      for (let gy = y0; gy <= y1; gy += 1) {
        const linha = this.dados[camada][gy].split('');
        for (let gx = x0; gx <= x1; gx += 1) linha[gx] = caractere;
        this.dados[camada][gy] = linha.join('');
      }
    });
  }

  /**
   * Contorno de um retângulo: parede em volta e piso dentro. É o atalho que
   * transforma "criar um prédio" em dois cliques.
   */
  predio(a, b, { parede = '#', piso = 't' } = {}) {
    const x0 = Math.max(0, Math.min(a.gx, b.gx));
    const x1 = Math.min(this.largura - 1, Math.max(a.gx, b.gx));
    const y0 = Math.max(0, Math.min(a.gy, b.gy));
    const y1 = Math.min(this.altura - 1, Math.max(a.gy, b.gy));
    if (x1 - x0 < 2 || y1 - y0 < 2) {
      return { ok: false, erro: 'o prédio precisa de ao menos 3 por 3' };
    }

    return this.#aplicar(() => {
      for (let gy = y0; gy <= y1; gy += 1) {
        const chao = this.dados.chao[gy].split('');
        const objetos = this.dados.objetos[gy].split('');
        for (let gx = x0; gx <= x1; gx += 1) {
          chao[gx] = piso;
          const naBorda = gx === x0 || gx === x1 || gy === y0 || gy === y1;
          objetos[gx] = naBorda ? parede : '.';
        }
        this.dados.chao[gy] = chao.join('');
        this.dados.objetos[gy] = objetos.join('');
      }
    });
  }

  // ---------- decoração ----------

  /** Decoração de um tile. Com `nivel`, a daquele nível; sem, a mais baixa. */
  decoracaoEm(gx, gy, nivel = null) {
    const aqui = this.dados.decoracoes
      .filter((d) => d.gx === gx && d.gy === gy)
      .sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));
    if (nivel === null) return aqui[0] ?? null;
    return aqui.find((d) => (d.nivel ?? 0) === nivel) ?? null;
  }

  /** Quais níveis deste tile já têm peça, de baixo para cima. */
  niveisEm(gx, gy) {
    return this.dados.decoracoes
      .filter((d) => d.gx === gx && d.gy === gy)
      .map((d) => d.nivel ?? 0)
      .sort((a, b) => a - b);
  }

  /**
   * Apaga uma peça do tile, preferindo a do nível pedido.
   *
   * Quando aquele nível está vazio, apaga a mais alta da coluna em vez de não
   * fazer nada. A borracha amarrada ao nível era uma armadilha silenciosa: quem
   * subisse ao nível 4 para montar um assoalho e voltasse a mexer no piso
   * clicava em cima da peça, nada acontecia e nada era dito — o tile parecia
   * travado.
   */
  apagarDecoracao(gx, gy, nivel = 0) {
    if (!this.dentro(gx, gy)) return { ok: false, erro: 'fora do mapa' };

    const n = nivelValido(nivel);
    const niveis = this.niveisEm(gx, gy);
    if (!niveis.length) {
      return { ok: false, erro: `não há peça de decoração em ${gx},${gy}` };
    }

    const alvo = this.decoracaoEm(gx, gy, n) ?? this.decoracaoEm(gx, gy, niveis[niveis.length - 1]);
    const resultado = this.#aplicar(() => {
      this.dados.decoracoes = this.dados.decoracoes.filter((d) => d !== alvo);
    });
    if (!resultado.ok) return resultado;

    return {
      ok: true,
      peca: alvo.peca,
      nivelApagado: alvo.nivel,
      deOutroNivel: alvo.nivel !== n,
      sobraram: this.niveisEm(gx, gy).length,
    };
  }

  /**
   * Uma decoração por tile **e por nível**. `peca` nula remove a daquele nível.
   *
   * A chave inclui o nível justamente para dar para montar uma casa: piso no
   * nível 0, parede acima, telhado em cima, tudo na mesma coluna. Quando a
   * chave era só o tile, pôr o telhado apagava a parede.
   */
  decorar(gx, gy, peca, solido = false, nivel = 0) {
    if (!this.dentro(gx, gy)) return { ok: false, erro: 'fora do mapa' };
    const n = nivelValido(nivel);
    const atual = this.decoracaoEm(gx, gy, n);
    if (!peca && !atual) return { ok: true, igual: true };
    if (peca && atual && atual.peca === peca && Boolean(atual.solido) === solido) {
      return { ok: true, igual: true };
    }

    return this.#aplicar(() => {
      this.dados.decoracoes = this.dados.decoracoes.filter(
        (d) => d.gx !== gx || d.gy !== gy || (d.nivel ?? 0) !== n,
      );
      if (peca) this.dados.decoracoes.push({ peca, gx, gy, solido, nivel: n });
    });
  }

  // ---------- passagens ----------

  passagemEm(gx, gy) {
    return this.dados.passagens.find((p) => p.gx === gx && p.gy === gy) ?? null;
  }

  /**
   * Põe (ou remove, com `para` nulo) uma passagem. Uma por tile.
   *
   * Diferente dos caracteres `1`..`3`, aqui não há teto: cada passagem carrega
   * o próprio destino, então dá para ligar quantos prédios você criar.
   */
  ligar(gx, gy, para, rotulo = '') {
    if (!this.dentro(gx, gy)) return { ok: false, erro: 'fora do mapa' };
    const atual = this.passagemEm(gx, gy);
    if (!para && !atual) return { ok: true, igual: true };
    if (para && para === this.dados.id) {
      return { ok: false, erro: 'uma passagem não pode levar ao próprio local' };
    }

    return this.#aplicar(() => {
      this.dados.passagens = this.dados.passagens.filter((p) => p.gx !== gx || p.gy !== gy);
      if (para) this.dados.passagens.push({ gx, gy, para, rotulo: rotulo || `Ir para ${para}` });
    });
  }

  /** Para onde este local leva, sem repetir destino. */
  destinos() {
    return [...new Set(this.cena.ligacoes.map((l) => l.para))];
  }

  // ---------- tamanho ----------

  /** Acrescenta `quantas` faixas de um lado. */
  expandir(lado, quantas = 1) {
    const n = Math.max(1, Math.min(200, Math.floor(quantas)));
    return this.#aplicar(() => {
      for (let i = 0; i < n; i += 1) {
        if (lado === 'cima' || lado === 'baixo') {
          const chao = VAZIO.chao.repeat(this.largura);
          const objetos = VAZIO.objetos.repeat(this.largura);
          if (lado === 'cima') {
            this.dados.chao.unshift(chao);
            this.dados.objetos.unshift(objetos);
          } else {
            this.dados.chao.push(chao);
            this.dados.objetos.push(objetos);
          }
        } else {
          const naEsquerda = lado === 'esquerda';
          this.dados.chao = this.dados.chao.map((l) =>
            naEsquerda ? VAZIO.chao + l : l + VAZIO.chao,
          );
          this.dados.objetos = this.dados.objetos.map((l) =>
            naEsquerda ? VAZIO.objetos + l : l + VAZIO.objetos,
          );
        }
      }

      // Crescer para cima ou pela esquerda empurra a origem; a decoração tem de
      // acompanhar, senão sai toda do lugar.
      if (lado === 'cima') {
        for (const d of this.dados.decoracoes) d.gy += n;
        for (const p of this.dados.passagens) p.gy += n;
      }
      if (lado === 'esquerda') {
        for (const d of this.dados.decoracoes) d.gx += n;
        for (const p of this.dados.passagens) p.gx += n;
      }
    });
  }

  /** Corta `quantas` faixas de um lado, junto com a decoração que sair. */
  encolher(lado, quantas = 1) {
    const n = Math.max(1, Math.floor(quantas));
    if (lado === 'cima' || lado === 'baixo') {
      if (this.altura - n < 4) return { ok: false, erro: 'o mapa ficaria menor que 4 linhas' };
    } else if (this.largura - n < 4) {
      return { ok: false, erro: 'o mapa ficaria menor que 4 colunas' };
    }

    return this.#aplicar(() => {
      if (lado === 'cima') {
        this.dados.chao.splice(0, n);
        this.dados.objetos.splice(0, n);
        for (const d of this.dados.decoracoes) d.gy -= n;
        for (const p of this.dados.passagens) p.gy -= n;
      } else if (lado === 'baixo') {
        this.dados.chao.splice(-n);
        this.dados.objetos.splice(-n);
      } else if (lado === 'esquerda') {
        this.dados.chao = this.dados.chao.map((l) => l.slice(n));
        this.dados.objetos = this.dados.objetos.map((l) => l.slice(n));
        for (const d of this.dados.decoracoes) d.gx -= n;
        for (const p of this.dados.passagens) p.gx -= n;
      } else {
        this.dados.chao = this.dados.chao.map((l) => l.slice(0, -n));
        this.dados.objetos = this.dados.objetos.map((l) => l.slice(0, -n));
      }

      const dentro = (p) => p.gx >= 0 && p.gy >= 0 && p.gx < this.largura && p.gy < this.altura;
      this.dados.decoracoes = this.dados.decoracoes.filter(dentro);
      this.dados.passagens = this.dados.passagens.filter(dentro);
    });
  }

  /** Leva o mapa a um tamanho exato, crescendo ou cortando à direita e abaixo. */
  redimensionar(largura, altura) {
    const l = Math.max(8, Math.min(300, Math.floor(largura)));
    const a = Math.max(8, Math.min(300, Math.floor(altura)));
    const resultado = { ok: true };

    if (l > this.largura) this.expandir('direita', l - this.largura);
    else if (l < this.largura) this.encolher('direita', this.largura - l);
    if (a > this.altura) this.expandir('baixo', a - this.altura);
    else if (a < this.altura) this.encolher('baixo', this.altura - a);

    return resultado;
  }

  // ---------- validação ----------

  /**
   * Por que não se pode pisar num tile, em português.
   *
   * A mensagem antiga era só "está bloqueado", e com isso não havia o que
   * fazer: o bloqueio pode vir de três lugares bem diferentes, e cada um pede
   * uma correção diferente.
   */
  #motivoDoBloqueio(cena, gx, gy) {
    if (!cena.dentro(gx, gy)) return 'está fora do mapa';
    const terreno = cena.chao[gy][gx];
    if (!terreno) return 'não tem chão nenhum embaixo';
    if (!terreno.andavel) return `o chão ali é ${terreno.id}, onde não se pisa`;
    const objeto = cena.objetos[gy][gx];
    if (objeto?.solido) return `tem ${objeto.id} em cima, na camada Objetos`;
    const presa = cena.decoracoesEm(gx, gy).find((d) => d.solido && d.nivel === 0);
    if (presa) return `tem a peça ${presa.peca} marcada como "bloqueia passagem"`;
    return 'está bloqueado';
  }

  /** Os mesmos problemas que o `npm run check` reclamaria. */
  validar(documentos = []) {
    /**
     * Onde olhar para resolver o primeiro problema.
     *
     * O editor usa isto para levar a câmera até lá. Sem isso a mensagem cita
     * uma coordenada e a pessoa tem de caçá-la no mapa à mão — pior ainda
     * quando o que está errado é um marcador que o jogo desenha invisível.
     */
    this.focoDoProblema = null;
    const anotar = (gx, gy) => {
      if (!this.focoDoProblema) this.focoDoProblema = { gx, gy };
    };

    const problemas = Cena.conferir(this.dados);
    if (problemas.length) return problemas;

    const cena = new Cena(this.dados);
    const aviso = [];

    if (!cena.andavel(cena.inicio.gx, cena.inicio.gy)) {
      anotar(cena.inicio.gx, cena.inicio.gy);
      aviso.push(
        `o ponto de partida (X) em ${cena.inicio.gx},${cena.inicio.gy} ` +
          this.#motivoDoBloqueio(cena, cena.inicio.gx, cena.inicio.gy),
      );
    }
    if (!cena.ligacoes.length) {
      aviso.push('sem passagem: não há como sair nem entrar neste local');
    }

    // Duas passagens no mesmo tile: a segunda nunca seria alcançada.
    const ocupados = new Set();
    for (const passagem of cena.passagens) {
      const chave = `${passagem.gx},${passagem.gy}`;
      if (ocupados.has(chave)) {
        anotar(passagem.gx, passagem.gy);
        aviso.push(`duas passagens em ${chave}`);
      }
      ocupados.add(chave);
      if (this.cena.objetos[passagem.gy]?.[passagem.gx]?.solido) {
        anotar(passagem.gx, passagem.gy);
        aviso.push(`a passagem em ${chave} está sob uma parede`);
      }
    }

    for (const ponto of cena.pontosDeVestigio) {
      if (!cena.andavel(ponto.gx, ponto.gy)) {
        anotar(ponto.gx, ponto.gy);
        aviso.push(
          `o ponto de vestígio (*) em ${ponto.gx},${ponto.gy} ` +
            `${this.#motivoDoBloqueio(cena, ponto.gx, ponto.gy)} — ` +
            'tire o que está em cima ou apague o * ali, na camada Objetos',
        );
      } else if (!buscarCaminho(cena, cena.inicio, ponto).length) {
        anotar(ponto.gx, ponto.gy);
        aviso.push(
          `o ponto de vestígio (*) em ${ponto.gx},${ponto.gy} existe mas não há ` +
            'caminho a pé até ele desde o ponto de partida',
        );
      }
    }

    for (const ligacao of cena.ligacoes) {
      const mesmo = ligacao.gx === cena.inicio.gx && ligacao.gy === cena.inicio.gy;
      if (!mesmo && !buscarCaminho(cena, cena.inicio, ligacao).length) {
        anotar(ligacao.gx, ligacao.gy);
        aviso.push(`a passagem em ${ligacao.gx},${ligacao.gy} é inalcançável a pé`);
      }
    }

    const leitura = cena.pecas.filter((p) => p.def.interacao === 'documento').length;
    const disponiveis = documentos.filter((d) => d.cena === cena.id && d.alvo === 'pasta').length;
    if (leitura > disponiveis) {
      aviso.push(`${leitura} objetos de leitura mas ${disponiveis} documentos deste local`);
    }

    return aviso;
  }

  /** Só o que o servidor precisa gravar. */
  paraGravar() {
    return {
      chao: [...this.dados.chao],
      objetos: [...this.dados.objetos],
      decoracoes: this.dados.decoracoes.map((d) => ({ ...d })),
      passagens: this.dados.passagens.map((p) => ({ ...p })),
    };
  }
}
