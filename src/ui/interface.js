// Camada de interface: barra superior, caderno de evidências, ficha de suspeitos,
// leitura de documentos e acusação. Monta os nós pelo DOM (sem innerHTML com dados)
// para que qualquer texto de caso entre sempre escapado.

/** Duração da animação de saída do balão, para só então remover o nó. */
const SAIDA_MS = 200;

function criar(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
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
    this.el.local.textContent = `${jogo.cena.nome} — ${jogo.cena.endereco}`;
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
      this.aviso('Acusação liberada', 'Você já tem material para nomear um suspeito. Continue procurando ou feche o caso.');
    });

    jogo.escutar('pedirAcusacao', () => this.abrirAcusacao());
    jogo.escutar('veredito', (veredito) => this.mostrarVeredito(veredito));
  }

  // ---------- barra superior ----------

  atualizarHud() {
    if (!this.jogo) return;
    this.el.pistas.textContent = `${this.jogo.recolhidos.length}/${this.jogo.misterio.total}`;
    this.el.btnAcusar.disabled = false;
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

    const botao = criar('button', 'botao botao--mini', 'Fechar ');
    botao.type = 'button';
    botao.append(criar('kbd', null, 'Esc'));
    botao.addEventListener('click', () => this.#fecharAviso(caixa));

    const acoes = criar('div', 'aviso__acoes');
    acoes.append(botao);
    caixa.append(acoes);

    this.el.avisos.append(caixa);
    this.#atualizarCortina();
    // Com o movimento travado, o foco no botão deixa o teclado resolver o balão.
    botao.focus({ preventScroll: true });
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

    if (!this.jogo.recolhidos.length) {
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

    for (const [idSuspeito, lista] of porSuspeito) {
      corpo.append(this.#grupoDeFichas(suspeitos.get(idSuspeito)?.nome ?? 'Indefinido', lista, false));
    }
    if (neutros.length) {
      corpo.append(this.#grupoDeFichas('Contexto do caso', neutros, true));
    }
    if (this.jogo.documentosLidos.size) {
      const titulo = criar('h3', 'grupo__titulo');
      titulo.append(criar('span', null, 'Documentos lidos'));
      titulo.append(criar('span', 'grupo__contagem', String(this.jogo.documentosLidos.size)));
      const grupo = criar('div', 'grupo');
      grupo.append(titulo);
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

  #grupoDeFichas(nomeGrupo, lista, neutro) {
    const grupo = criar('div', 'grupo');
    const titulo = criar('h3', 'grupo__titulo');
    titulo.append(criar('span', null, neutro ? nomeGrupo : `Aponta para ${nomeGrupo}`));
    titulo.append(criar('span', 'grupo__contagem', `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`));
    grupo.append(titulo);

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
    corpo.append(criar('p', 'vazio', 'O caderno agrupa os vestígios por suspeito. A contagem abaixo acompanha esse agrupamento.'));

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
          contagem === 0 ? 'nenhum vestígio o liga à cena' : `${contagem} ${contagem === 1 ? 'vestígio' : 'vestígios'} apontam para ele`,
        ),
      );
      corpo.append(ficha);
    }
  }

  // ---------- painéis ----------

  alternarPainel(nome) {
    const painel = this.el[nome];
    const botao = nome === 'caderno' ? this.el.btnCaderno : this.el.btnSuspeitos;
    const abrindo = painel.hidden;
    painel.hidden = !abrindo;
    botao.setAttribute('aria-expanded', String(abrindo));
    if (abrindo) {
      if (nome === 'caderno') this.renderCaderno();
      else this.renderSuspeitos();
    }
  }

  fecharPainel(nome) {
    this.el[nome].hidden = true;
    const botao = nome === 'caderno' ? this.el.btnCaderno : this.el.btnSuspeitos;
    botao.setAttribute('aria-expanded', 'false');
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

    const fechar = criar('button', 'botao', 'Fechar');
    fechar.type = 'button';
    fechar.addEventListener('click', () => this.fecharModal());
    this.el.modalAcoes.append(fechar);

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
      const voltar = criar('button', 'botao', 'Voltar à cena');
      voltar.type = 'button';
      voltar.addEventListener('click', () => this.fecharModal());
      this.el.modalAcoes.append(voltar);
      return;
    }

    this.el.modalCorpo.append(
      criar('p', null, 'Nomeie quem você considera responsável. A decisão encerra a investigação.'),
    );

    this.suspeitoEscolhido = null;
    const confirmar = criar('button', 'botao botao--destaque', 'Confirmar acusação');
    confirmar.type = 'button';
    confirmar.disabled = true;

    for (const suspeito of this.jogo.caso.suspeitos) {
      const opcao = criar('button', 'suspeito');
      opcao.type = 'button';
      opcao.setAttribute('aria-pressed', 'false');
      opcao.append(criar('span', 'suspeito__nome', suspeito.nome));
      opcao.append(criar('span', 'suspeito__relacao', suspeito.relacao));
      const contagem = peso.get(suspeito.id) ?? 0;
      opcao.append(
        criar('span', 'suspeito__peso', `${contagem} ${contagem === 1 ? 'vestígio' : 'vestígios'} no caderno`),
      );
      opcao.addEventListener('click', () => {
        this.suspeitoEscolhido = suspeito.id;
        for (const outro of this.el.modalCorpo.querySelectorAll('.suspeito')) {
          outro.setAttribute('aria-pressed', String(outro === opcao));
        }
        confirmar.disabled = false;
      });
      this.el.modalCorpo.append(opcao);
    }

    confirmar.addEventListener('click', () => {
      if (this.suspeitoEscolhido) this.acoes.aoAcusar(this.suspeitoEscolhido);
    });

    const voltar = criar('button', 'botao', 'Voltar à cena');
    voltar.type = 'button';
    voltar.addEventListener('click', () => this.fecharModal());

    this.el.modalAcoes.append(voltar, confirmar);
  }

  mostrarVeredito(veredito) {
    if (!veredito) return;
    this.#abrirModal(veredito.acertou ? 'Caso encerrado' : 'Caso encerrado em erro');

    const titulo = criar(
      'p',
      `veredito ${veredito.acertou ? 'veredito--acerto' : 'veredito--erro'}`,
      veredito.acertou
        ? `${veredito.culpado.nome} era o responsável.`
        : `${veredito.acusado?.nome ?? 'O acusado'} não era o responsável. O caso era de ${veredito.culpado.nome}.`,
    );
    this.el.modalCorpo.append(titulo);

    const forca = {
      completa: 'Você reuniu todas as provas que ligavam essa pessoa à cena.',
      parcial: 'Você reuniu parte das provas que ligavam essa pessoa à cena.',
      fraca: 'Faltava quase toda a prova material contra essa pessoa.',
    }[veredito.forca];

    const resumo = criar('ul', 'resumo');
    const itens = [
      `Vestígios recolhidos: ${veredito.recolhidos} de ${veredito.total}.`,
      `Provas contra ${veredito.culpado.nome}: ${veredito.provasDoCulpado.length} de ${veredito.totalDoCulpado}.`,
      forca,
    ];
    if (veredito.provasDoCulpado.length) {
      itens.push(`Decisivas: ${veredito.provasDoCulpado.map((v) => v.nome).join(', ')}.`);
    }
    for (const texto of itens) resumo.append(criar('li', null, texto));
    this.el.modalCorpo.append(resumo);

    const nova = criar('button', 'botao botao--destaque', 'Nova investigação');
    nova.type = 'button';
    nova.addEventListener('click', () => this.acoes.aoNovaInvestigacao());

    const fechar = criar('button', 'botao', 'Rever a cena');
    fechar.type = 'button';
    fechar.addEventListener('click', () => this.fecharModal());

    this.el.modalAcoes.append(fechar, nova);
  }

  // ---------- ligação dos controles ----------

  #ligarBotoes() {
    this.el.btnCaderno.addEventListener('click', () => this.alternarPainel('caderno'));
    this.el.btnSuspeitos.addEventListener('click', () => this.alternarPainel('suspeitos'));
    this.el.btnAcusar.addEventListener('click', () => this.abrirAcusacao());
    this.el.btnNova.addEventListener('click', () => this.acoes.aoNovaInvestigacao());

    for (const botao of document.querySelectorAll('[data-fechar]')) {
      botao.addEventListener('click', () => {
        const alvo = botao.dataset.fechar;
        if (alvo === 'modal') this.fecharModal();
        else this.fecharPainel(alvo);
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
