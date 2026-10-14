// Camada de interface: barra superior, caderno de evidências, ficha de suspeitos,
// interrogatório, deslocamento entre locais, leitura de documentos e acusação.
// Monta os nós pelo DOM (sem innerHTML com dados) para que qualquer texto de caso
// entre sempre escapado.

/** Duração da animação de saída do balão, para só então remover o nó. */
const SAIDA_MS = 200;

function criar(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function botao(classe, texto, aoClicar) {
  const no = criar('button', classe, texto);
  no.type = 'button';
  if (aoClicar) no.addEventListener('click', aoClicar);
  return no;
}

export class Interface {
  /**
   * @param {{aoAcusar:(id:string)=>void, aoNovaInvestigacao:()=>void}} acoes
   */
  constructor(acoes) {
    this.acoes = acoes;
    this.jogo = null;
    this.suspeitoEscolhido = null;

    this.el = {
      titulo: document.getElementById('hud-titulo'),
      local: document.getElementById('hud-local'),
      pistas: document.getElementById('hud-pistas'),
      contradicoes: document.getElementById('hud-contradicoes'),
      semente: document.getElementById('hud-semente'),
      dicaAlvo: document.getElementById('dica-alvo'),
      avisos: document.getElementById('avisos'),

      caderno: document.getElementById('caderno'),
      cadernoCorpo: document.getElementById('caderno-corpo'),
      suspeitos: document.getElementById('suspeitos'),
      suspeitosCorpo: document.getElementById('suspeitos-corpo'),

      modal: document.getElementById('modal'),
      modalCaixa: document.getElementById('modal-caixa'),
      modalTitulo: document.getElementById('modal-titulo'),
      modalCorpo: document.getElementById('modal-corpo'),
      modalAcoes: document.getElementById('modal-acoes'),

      btnCaderno: document.getElementById('btn-caderno'),
      btnLocais: document.getElementById('btn-locais'),
      btnSuspeitos: document.getElementById('btn-suspeitos'),
      btnAcusar: document.getElementById('btn-acusar'),
      btnNova: document.getElementById('btn-nova'),
    };

    this.#ligarBotoes();
  }

  get modalAberto() {
    return !this.el.modal.hidden;
  }

  /** Há algum balão de aviso aguardando ser fechado? */
  get avisoAberto() {
    return this.el.avisos.querySelector('.aviso:not(.aviso--saindo)') !== null;
  }

  /** Enquanto verdadeiro, o detetive não anda e os cliques na cena são ignorados. */
  get bloqueiaMovimento() {
    return this.modalAberto || this.avisoAberto;
  }

  /** Liga a interface a uma investigação (troca a cada "nova investigação"). */
  conectarJogo(jogo) {
    this.jogo = jogo;
    this.suspeitoEscolhido = null;
    this.el.titulo.textContent = jogo.caso.titulo;
    this.el.semente.textContent = jogo.semente;
    this.fecharModal();
    this.limparAvisos(); // balões da investigação anterior não sobrevivem ao reinício
    this.atualizarHud();
    this.renderCaderno();
    this.renderSuspeitos();

    jogo.escutar('vestigio', ({ vestigio }) => {
      this.atualizarHud();
      this.renderCaderno();
      this.renderSuspeitos();
      this.aviso(`Vestígio recolhido: ${vestigio.nome}`, vestigio.texto);
    });

    jogo.escutar('documento', ({ documento, novo }) => {
      this.mostrarDocumento(documento, novo);
    });

    jogo.escutar('liberouAcusacao', () => {
      this.aviso(
        'Acusação liberada',
        'Você já tem material para nomear um suspeito. Continue procurando, ouça os depoimentos ou feche o caso.',
      );
    });

    // A reação ao confronto aparece dentro do interrogatório, não em balão.
    jogo.escutar('contradicao', () => {
      this.atualizarHud();
      this.renderCaderno();
      this.renderSuspeitos();
    });

    jogo.escutar('viagem', () => {
      this.atualizarHud();
      this.fecharModal();
    });

    jogo.escutar('pedirDeslocamento', ({ locais }) => this.abrirDeslocamento(locais));
    jogo.escutar('veredito', (veredito) => this.mostrarVeredito(veredito));
  }

  // ---------- barra superior ----------

  atualizarHud() {
    if (!this.jogo) return;
    this.el.pistas.textContent = `${this.jogo.recolhidos.length}/${this.jogo.misterio.total}`;
    this.el.contradicoes.textContent = String(this.jogo.contradicoes.length);
    this.el.local.textContent = `${this.jogo.cenaAtual.nome} — ${this.jogo.cenaAtual.endereco}`;
  }

  /** Texto do rodapé com o que está sob o cursor. */
  definirAlvo(rotulo) {
    this.el.dicaAlvo.textContent = rotulo ?? '';
  }

  // ---------- avisos ----------

  /**
   * Balão de aviso. Fica na tela até o jogador fechar, e a cena pausa enquanto
   * isso durar: o texto de um vestígio é conteúdo de jogo para ler, não uma
   * notificação passageira.
   */
  aviso(titulo, texto) {
    const caixa = criar('div', 'aviso');
    caixa.setAttribute('role', 'group');
    caixa.setAttribute('aria-label', titulo);

    const conteudo = criar('div', 'aviso__conteudo');
    conteudo.append(criar('p', 'aviso__titulo', titulo));
    if (texto) conteudo.append(criar('p', 'aviso__texto', texto));
    caixa.append(conteudo);

    const fechar = botao('botao botao--mini', 'Fechar ', () => this.#fecharAviso(caixa));
    fechar.append(criar('kbd', null, 'Esc'));

    const acoes = criar('div', 'aviso__acoes');
    acoes.append(fechar);
    caixa.append(acoes);

    this.el.avisos.append(caixa);
    this.#atualizarCortina();
    // Com o movimento travado, o foco no botão deixa o teclado resolver o balão.
    fechar.focus({ preventScroll: true });
    return caixa;
  }

  #fecharAviso(caixa) {
    if (!caixa.isConnected || caixa.classList.contains('aviso--saindo')) return;
    caixa.classList.add('aviso--saindo');
    this.#atualizarCortina();
    setTimeout(() => {
      caixa.remove();
      this.#atualizarCortina();
    }, SAIDA_MS);
  }

  /** Fecha o balão mais recente. Devolve false quando não havia nenhum. */
  fecharAvisoTopo() {
    const abertos = [...this.el.avisos.querySelectorAll('.aviso:not(.aviso--saindo)')];
    if (!abertos.length) return false;
    this.#fecharAviso(abertos[abertos.length - 1]);
    return true;
  }

  limparAvisos() {
    this.el.avisos.replaceChildren();
    this.#atualizarCortina();
  }

  #atualizarCortina() {
    this.el.avisos.classList.toggle('avisos--ativo', this.avisoAberto);
  }

  // ---------- caderno ----------

  renderCaderno() {
    const corpo = this.el.cadernoCorpo;
    corpo.replaceChildren();
    if (!this.jogo) return;

    if (!this.jogo.recolhidos.length && !this.jogo.contradicoes.length) {
      corpo.append(
        criar('p', 'vazio', 'Nada recolhido ainda. Os pontos brilhantes na cena são vestígios: chegue perto e clique.'),
      );
      return;
    }

    const suspeitos = new Map(this.jogo.caso.suspeitos.map((s) => [s.id, s]));
    const porSuspeito = new Map();
    const neutros = [];

    for (const vestigio of this.jogo.recolhidos) {
      if (vestigio.aponta) {
        if (!porSuspeito.has(vestigio.aponta)) porSuspeito.set(vestigio.aponta, []);
        porSuspeito.get(vestigio.aponta).push(vestigio);
      } else {
        neutros.push(vestigio);
      }
    }

    if (this.jogo.contradicoes.length) {
      corpo.append(this.#grupoContradicoes(suspeitos));
    }

    for (const [idSuspeito, lista] of porSuspeito) {
      corpo.append(this.#grupoDeFichas(suspeitos.get(idSuspeito)?.nome ?? 'Indefinido', lista, false));
    }
    if (neutros.length) {
      corpo.append(this.#grupoDeFichas('Contexto do caso', neutros, true));
    }
    if (this.jogo.documentosLidos.size) {
      const grupo = criar('div', 'grupo');
      grupo.append(this.#tituloGrupo('Documentos lidos', String(this.jogo.documentosLidos.size)));
      for (const id of this.jogo.documentosLidos) {
        const doc = this.jogo.caso.documentos.find((d) => d.id === id);
        if (!doc) continue;
        const ficha = criar('div', 'ficha');
        ficha.append(criar('p', 'ficha__nome', doc.titulo));
        ficha.append(criar('p', 'ficha__texto', doc.cabecalho));
        grupo.append(ficha);
      }
      corpo.append(grupo);
    }
  }

  #tituloGrupo(texto, contagem) {
    const titulo = criar('h3', 'grupo__titulo');
    titulo.append(criar('span', null, texto));
    titulo.append(criar('span', 'grupo__contagem', contagem));
    return titulo;
  }

  #grupoContradicoes(suspeitos) {
    const grupo = criar('div', 'grupo');
    grupo.append(this.#tituloGrupo('Versões derrubadas', String(this.jogo.contradicoes.length)));

    for (const registro of this.jogo.contradicoes) {
      const suspeito = suspeitos.get(registro.suspeito);
      const pergunta = suspeito?.perguntas?.find((p) => p.id === registro.pergunta);
      const vestigio = this.jogo.recolhidos.find((v) => v.id === registro.vestigio);

      const ficha = criar('div', 'ficha');
      const nome = criar('p', 'ficha__nome');
      nome.append(document.createTextNode(suspeito?.nome ?? 'Suspeito'));
      nome.append(criar('span', 'etiqueta', 'mentiu'));
      ficha.append(nome);
      ficha.append(criar('p', 'ficha__texto', pergunta?.texto ?? ''));
      ficha.append(criar('p', 'ficha__texto', `Derrubada por: ${vestigio?.nome ?? ''}`));
      grupo.append(ficha);
    }
    return grupo;
  }

  #grupoDeFichas(nomeGrupo, lista, neutro) {
    const grupo = criar('div', 'grupo');
    grupo.append(
      this.#tituloGrupo(
        neutro ? nomeGrupo : `Aponta para ${nomeGrupo}`,
        `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`,
      ),
    );

    for (const vestigio of lista) {
      const ficha = criar('div', 'ficha');
      const nome = criar('p', 'ficha__nome');
      nome.append(document.createTextNode(vestigio.nome));
      nome.append(criar('span', neutro ? 'etiqueta etiqueta--neutra' : 'etiqueta', vestigio.tipo));
      ficha.append(nome);
      ficha.append(criar('p', 'ficha__texto', vestigio.texto));
      grupo.append(ficha);
    }
    return grupo;
  }

  // ---------- suspeitos ----------

  renderSuspeitos() {
    const corpo = this.el.suspeitosCorpo;
    corpo.replaceChildren();
    if (!this.jogo) return;

    const { peso } = this.jogo.pesos();
    corpo.append(
      criar(
        'p',
        'vazio',
        'Ouça cada um e confronte as respostas com o que estiver no caderno. Uma versão derrubada vale mais que um vestígio solto.',
      ),
    );

    for (const suspeito of this.jogo.caso.suspeitos) {
      const ficha = criar('div', 'suspeito');
      ficha.append(criar('span', 'suspeito__nome', suspeito.nome));
      ficha.append(criar('span', 'suspeito__relacao', suspeito.relacao));
      ficha.append(criar('span', 'suspeito__alibi', suspeito.alibi));

      const contagem = peso.get(suspeito.id) ?? 0;
      ficha.append(
        criar(
          'span',
          'suspeito__peso',
          contagem === 0
            ? 'nenhum vestígio o liga à cena'
            : `${contagem} ${contagem === 1 ? 'vestígio aponta' : 'vestígios apontam'} para ele`,
        ),
      );

      const quebras = this.jogo.contradicoes.filter((c) => c.suspeito === suspeito.id).length;
      if (quebras) {
        ficha.append(
          criar(
            'span',
            'suspeito__quebra',
            `${quebras} ${quebras === 1 ? 'versão derrubada' : 'versões derrubadas'}`,
          ),
        );
      }

      const rodape = criar('div', 'suspeito__rodape');
      rodape.append(
        botao('botao botao--mini', 'Interrogar', () => this.abrirInterrogatorio(suspeito.id)),
      );
      ficha.append(rodape);

      corpo.append(ficha);
    }
  }

  // ---------- interrogatório ----------

  abrirInterrogatorio(idSuspeito) {
    if (!this.jogo) return;
    const suspeito = this.jogo.caso.suspeitos.find((s) => s.id === idSuspeito);
    if (!suspeito) return;

    this.#abrirModal(`Depoimento — ${suspeito.nome}`);
    this.#renderInterrogatorio(suspeito);
    this.el.modalAcoes.append(botao('botao', 'Encerrar a conversa', () => this.fecharModal()));
  }

  #renderInterrogatorio(suspeito) {
    const corpo = this.el.modalCorpo;
    corpo.replaceChildren();
    corpo.append(criar('p', 'modal__intro', `${suspeito.relacao}. ${suspeito.alibi}`));

    for (const pergunta of suspeito.perguntas ?? []) {
      corpo.append(this.#blocoPergunta(suspeito, pergunta));
    }

    if (!suspeito.perguntas?.length) {
      corpo.append(criar('p', 'vazio', 'Este suspeito ainda não tem depoimento registrado.'));
    }
  }

  #blocoPergunta(suspeito, pergunta) {
    const quebra = this.jogo.contradicaoDe(suspeito.id, pergunta.id);
    const bloco = criar('div', `pergunta${quebra ? ' pergunta--caiu' : ''}`);

    // Antes de perguntar, só o que se pode perguntar.
    if (!this.jogo.jaOuviu(suspeito.id, pergunta.id)) {
      bloco.append(
        botao('pergunta__fazer', pergunta.texto, () => {
          this.jogo.ouvir(suspeito.id, pergunta.id);
          this.#renderInterrogatorio(suspeito);
        }),
      );
      return bloco;
    }

    bloco.append(criar('p', 'pergunta__texto', pergunta.texto));
    bloco.append(criar('p', 'pergunta__resposta', `"${pergunta.resposta}"`));

    if (quebra) {
      const vestigio = this.jogo.recolhidos.find((v) => v.id === quebra.vestigio);
      const caiu = criar('div', 'pergunta__quebra');
      caiu.append(criar('p', 'pergunta__etiqueta', `Versão derrubada por ${vestigio?.nome ?? 'um vestígio'}`));
      if (pergunta.reacao) caiu.append(criar('p', 'pergunta__reacao', pergunta.reacao));
      bloco.append(caiu);
      return bloco;
    }

    const disponiveis = this.jogo.confrontosDisponiveis(suspeito.id, pergunta);
    if (!disponiveis.length) {
      bloco.append(
        criar(
          'p',
          'pergunta__nota',
          'Nada no caderno desmente esta resposta por enquanto.',
        ),
      );
      return bloco;
    }

    const confrontos = criar('div', 'pergunta__confrontos');
    for (const vestigio of disponiveis) {
      confrontos.append(
        botao('botao botao--mini', `Confrontar com ${vestigio.nome}`, () => {
          this.jogo.confrontar(suspeito.id, pergunta.id, vestigio.id);
          this.#renderInterrogatorio(suspeito);
        }),
      );
    }
    bloco.append(confrontos);
    return bloco;
  }

  // ---------- deslocamento ----------

  abrirDeslocamento(locais = null) {
    if (!this.jogo) return;
    if (this.jogo.encerrado) {
      this.mostrarVeredito(this.jogo.veredito);
      return;
    }

    const destinos = locais ?? this.jogo.outrosLocais();
    this.#abrirModal('Para onde ir');
    this.el.modalCorpo.append(
      criar('p', 'modal__intro', `Você está em ${this.jogo.cenaAtual.nome}.`),
    );

    if (!destinos.length) {
      this.el.modalCorpo.append(criar('p', 'vazio', 'Não há outro local nesta investigação.'));
    }

    for (const local of destinos) {
      const ficha = botao('suspeito', null, () => {
        this.jogo.viajarPara(local.id);
        this.fecharModal();
      });
      ficha.append(criar('span', 'suspeito__nome', local.nome));
      ficha.append(criar('span', 'suspeito__relacao', local.endereco));
      ficha.append(
        criar(
          'span',
          'local__pendentes',
          local.pendentes === 0
            ? 'nada mais a recolher ali'
            : `${local.pendentes} ${local.pendentes === 1 ? 'vestígio' : 'vestígios'} ainda no local`,
        ),
      );
      this.el.modalCorpo.append(ficha);
    }

    this.el.modalAcoes.append(
      botao('botao', 'Continuar aqui', () => this.fecharModal()),
      botao('botao botao--destaque', 'Encerrar investigação', () => this.abrirAcusacao()),
    );
  }

  // ---------- painéis ----------

  alternarPainel(nome) {
    const painel = this.el[nome];
    const alvo = nome === 'caderno' ? this.el.btnCaderno : this.el.btnSuspeitos;
    const abrindo = painel.hidden;
    painel.hidden = !abrindo;
    alvo.setAttribute('aria-expanded', String(abrindo));
    if (abrindo) {
      if (nome === 'caderno') this.renderCaderno();
      else this.renderSuspeitos();
    }
  }

  fecharPainel(nome) {
    this.el[nome].hidden = true;
    const alvo = nome === 'caderno' ? this.el.btnCaderno : this.el.btnSuspeitos;
    alvo.setAttribute('aria-expanded', 'false');
  }

  // ---------- modal ----------

  #abrirModal(titulo) {
    this.el.modalTitulo.textContent = titulo;
    this.el.modalCorpo.replaceChildren();
    this.el.modalAcoes.replaceChildren();
    this.el.modal.hidden = false;
    this.el.modalCaixa.setAttribute('tabindex', '-1');
    this.el.modalCaixa.focus({ preventScroll: true });
  }

  fecharModal() {
    this.el.modal.hidden = true;
  }

  mostrarDocumento(documento, novo = true) {
    this.#abrirModal(documento.titulo);
    const bloco = criar('div', 'documento');
    bloco.append(criar('p', 'documento__cabecalho', documento.cabecalho));
    bloco.append(document.createTextNode(documento.texto));
    this.el.modalCorpo.append(bloco);
    this.el.modalAcoes.append(botao('botao', 'Fechar', () => this.fecharModal()));
    if (novo) this.renderCaderno();
  }

  abrirAcusacao() {
    if (!this.jogo) return;
    if (this.jogo.encerrado) {
      this.mostrarVeredito(this.jogo.veredito);
      return;
    }

    this.#abrirModal('Fechar o caso');
    const { peso } = this.jogo.pesos();

    if (!this.jogo.podeAcusar) {
      this.el.modalCorpo.append(
        criar(
          'p',
          null,
          `Com ${this.jogo.recolhidos.length} de ${this.jogo.misterio.total} vestígios, ainda não há base para nomear ninguém. ` +
            `Recolha pelo menos ${this.jogo.caso.minimoParaAcusar} antes de fechar o caso.`,
        ),
      );
      this.el.modalAcoes.append(botao('botao', 'Voltar à cena', () => this.fecharModal()));
      return;
    }

    this.el.modalCorpo.append(
      criar('p', 'modal__intro', 'Nomeie quem você considera responsável. A decisão encerra a investigação.'),
    );

    this.suspeitoEscolhido = null;
    const confirmar = botao('botao botao--destaque', 'Confirmar acusação', () => {
      if (this.suspeitoEscolhido) this.acoes.aoAcusar(this.suspeitoEscolhido);
    });
    confirmar.disabled = true;

    for (const suspeito of this.jogo.caso.suspeitos) {
      const contagem = peso.get(suspeito.id) ?? 0;
      const quebras = this.jogo.contradicoes.filter((c) => c.suspeito === suspeito.id).length;

      const opcao = botao('suspeito', null, () => {
        this.suspeitoEscolhido = suspeito.id;
        for (const outro of this.el.modalCorpo.querySelectorAll('.suspeito')) {
          outro.setAttribute('aria-pressed', String(outro === opcao));
        }
        confirmar.disabled = false;
      });
      opcao.setAttribute('aria-pressed', 'false');
      opcao.append(criar('span', 'suspeito__nome', suspeito.nome));
      opcao.append(criar('span', 'suspeito__relacao', suspeito.relacao));
      opcao.append(
        criar('span', 'suspeito__peso', `${contagem} ${contagem === 1 ? 'vestígio' : 'vestígios'} no caderno`),
      );
      if (quebras) {
        opcao.append(
          criar(
            'span',
            'suspeito__quebra',
            `${quebras} ${quebras === 1 ? 'versão derrubada' : 'versões derrubadas'}`,
          ),
        );
      }
      this.el.modalCorpo.append(opcao);
    }

    this.el.modalAcoes.append(botao('botao', 'Voltar à cena', () => this.fecharModal()), confirmar);
  }

  mostrarVeredito(veredito) {
    if (!veredito) return;
    this.#abrirModal(veredito.acertou ? 'Caso encerrado' : 'Caso encerrado em erro');

    this.el.modalCorpo.append(
      criar(
        'p',
        `veredito ${veredito.acertou ? 'veredito--acerto' : 'veredito--erro'}`,
        veredito.acertou
          ? `${veredito.culpado.nome} era o responsável.`
          : `${veredito.acusado?.nome ?? 'O acusado'} não era o responsável. O caso era de ${veredito.culpado.nome}.`,
      ),
    );

    const forca = {
      completa: 'Você reuniu todas as provas e derrubou todas as versões que essa pessoa deu.',
      parcial: 'Você reuniu parte do que ligava essa pessoa à cena.',
      fraca: 'Faltava quase toda a sustentação contra essa pessoa.',
    }[veredito.forca];

    const resumo = criar('ul', 'resumo');
    const itens = [
      `Vestígios recolhidos: ${veredito.recolhidos} de ${veredito.total}.`,
      `Provas contra ${veredito.culpado.nome}: ${veredito.provasDoCulpado.length} de ${veredito.totalDoCulpado}.`,
      `Versões derrubadas: ${veredito.quebrasDoCulpado.length} de ${veredito.contradicoesPossiveis}.`,
      forca,
    ];
    if (veredito.provasDoCulpado.length) {
      itens.push(`Decisivas: ${veredito.provasDoCulpado.map((v) => v.nome).join(', ')}.`);
    }
    for (const texto of itens) resumo.append(criar('li', null, texto));
    this.el.modalCorpo.append(resumo);

    this.el.modalAcoes.append(
      botao('botao', 'Rever a cena', () => this.fecharModal()),
      botao('botao botao--destaque', 'Nova investigação', () => this.acoes.aoNovaInvestigacao()),
    );
  }

  // ---------- ligação dos controles ----------

  #ligarBotoes() {
    this.el.btnCaderno.addEventListener('click', () => this.alternarPainel('caderno'));
    this.el.btnSuspeitos.addEventListener('click', () => this.alternarPainel('suspeitos'));
    this.el.btnLocais.addEventListener('click', () => this.abrirDeslocamento());
    this.el.btnAcusar.addEventListener('click', () => this.abrirAcusacao());
    this.el.btnNova.addEventListener('click', () => this.acoes.aoNovaInvestigacao());

    for (const alvo of document.querySelectorAll('[data-fechar]')) {
      alvo.addEventListener('click', () => {
        const nome = alvo.dataset.fechar;
        if (nome === 'modal') this.fecharModal();
        else this.fecharPainel(nome);
      });
    }

    this.el.modal.addEventListener('click', (evento) => {
      if (evento.target === this.el.modal) this.fecharModal();
    });

    window.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape') return;
      // Ordem de prioridade: o que está mais na frente fecha primeiro.
      if (this.modalAberto) {
        this.fecharModal();
        return;
      }
      if (this.fecharAvisoTopo()) return;
      this.fecharPainel('caderno');
      this.fecharPainel('suspeitos');
    });
  }
}
