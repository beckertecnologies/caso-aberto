// Progresso salvo no próprio navegador, em localStorage.
//
// Guardamos só o que o jogador fez: semente, local, posição, vestígios
// recolhidos, documentos lidos e mentiras derrubadas. O mistério em si não é
// salvo porque a semente já o reconstrói igual.
//
// O depósito é injetável para que a verificação rode no Node, onde não existe
// localStorage.

const CHAVE = 'caso-aberto:progresso:v1';

/** Devolve o localStorage quando disponível, ou nulo em ambiente sem ele. */
function depositoPadrao() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Alguns navegadores expõem o objeto mas lançam ao gravar (modo restrito).
    const teste = `${CHAVE}:teste`;
    localStorage.setItem(teste, '1');
    localStorage.removeItem(teste);
    return localStorage;
  } catch {
    return null;
  }
}

export class Progresso {
  /** @param {Storage|null} deposito */
  constructor(deposito = depositoPadrao()) {
    this.deposito = deposito;
  }

  get disponivel() {
    return this.deposito !== null;
  }

  /** @param {import('./jogo.js').Jogo} jogo */
  salvar(jogo) {
    if (!this.deposito) return false;
    try {
      this.deposito.setItem(CHAVE, JSON.stringify(jogo.estado()));
      return true;
    } catch {
      // Cota cheia ou gravação bloqueada: o jogo continua, só não persiste.
      return false;
    }
  }

  /** @returns {object|null} */
  carregar() {
    if (!this.deposito) return null;
    try {
      const cru = this.deposito.getItem(CHAVE);
      if (!cru) return null;
      const estado = JSON.parse(cru);
      if (!estado || typeof estado !== 'object') return null;
      if (estado.versao !== 1 || typeof estado.semente !== 'string') return null;
      return estado;
    } catch {
      return null;
    }
  }

  limpar() {
    if (!this.deposito) return;
    try {
      this.deposito.removeItem(CHAVE);
    } catch {
      // Nada a fazer: sem depósito gravável, não há o que limpar.
    }
  }
}

/** Depósito em memória, para testes. Mesma interface do localStorage. */
export class DepositoMemoria {
  constructor() {
    this.dados = new Map();
  }

  getItem(chave) {
    return this.dados.has(chave) ? this.dados.get(chave) : null;
  }

  setItem(chave, valor) {
    this.dados.set(chave, String(valor));
  }

  removeItem(chave) {
    this.dados.delete(chave);
  }
}
