// Interpreta o mapa ASCII e expõe consultas que o jogo precisa:
// onde dá para pisar, onde ficam os objetos, onde um vestígio pode surgir e
// quais passagens levam a outros locais.

import { nivelValido } from '../core/iso.js';
import { CHAO, CHARS_LIGACAO, OBJETOS } from './tiles.js';

export class Cena {
  /**
   * @param {{id:string,nome:string,endereco:string,chao:string[],objetos:string[],ligacoes?:object}} dados
   */
  constructor(dados) {
    this.id = dados.id;
    this.nome = dados.nome;
    this.endereco = dados.endereco;
    /** Local aberto: recebe vestígio só se o vestígio pedir este local. */
    this.externo = Boolean(dados.externo);

    const problemas = Cena.conferir(dados);
    if (problemas.length) {
      throw new Error(`Mapa "${dados.id}" inválido:\n- ${problemas.join('\n- ')}`);
    }

    this.altura = dados.chao.length;
    this.largura = dados.chao[0].length;

    /** @type {(object|null)[][]} terreno por [gy][gx] */
    this.chao = dados.chao.map((linha) => [...linha].map((ch) => CHAO[ch] ?? null));
    /** @type {(object|null)[][]} objeto por [gy][gx] */
    this.objetos = dados.objetos.map((linha) => [...linha].map((ch) => OBJETOS[ch] ?? null));

    /** Peças desenháveis, já com posição. */
    this.pecas = [];
    /** Tiles onde o gerador pode plantar um vestígio. */
    this.pontosDeVestigio = [];
    /** Marcas de "aqui vai um prédio", postas no modo cidade do editor. */
    this.marcasPredio = [];
    /** Mapa "gx,gy" -> objeto examinável. */
    this.interativos = new Map();
    /** Passagens para outros locais. */
    this.ligacoes = [];
    /**
     * Peças soltas, fora da matriz: `{ peca, gx, gy, solido }`.
     *
     * A matriz carrega o que tem significado de jogo (andável, examinável), e um
     * caractere por tipo limita a paleta ao dicionário. A decoração é lista, não
     * matriz, então aceita centenas de peças diferentes em qualquer posição.
     */
    this.decoracoes = [];
    /** @type {Set<string>} tiles bloqueados por decoração sólida */
    this.bloqueios = new Set();
    /**
     * Passagens declaradas em lista, com destino próprio.
     *
     * Os caracteres `1`..`3` continuam valendo para quem edita à mão, mas
     * limitam a três por local e amarram o destino a um campo separado. A lista
     * não tem limite e carrega o destino junto, então o editor consegue criar
     * ligação para um prédio novo sem ninguém mexer em código.
     */
    this.passagens = [];

    for (const bruta of dados.passagens ?? []) {
      const gx = Number(bruta?.gx);
      const gy = Number(bruta?.gy);
      if (!bruta?.para || !Number.isInteger(gx) || !Number.isInteger(gy)) continue;
      const passagem = {
        gx,
        gy,
        para: String(bruta.para),
        rotulo: bruta.rotulo ? String(bruta.rotulo) : `Ir para ${bruta.para}`,
        tipo: 'ligacao',
        def: OBJETOS['1'],
      };
      this.passagens.push(passagem);
      this.ligacoes.push(passagem);
      this.interativos.set(`${gx},${gy}`, passagem);
    }

    for (const bruta of dados.decoracoes ?? []) {
      if (!bruta?.peca) continue;
      const gx = Number(bruta.gx);
      const gy = Number(bruta.gy);
      if (!Number.isInteger(gx) || !Number.isInteger(gy)) continue;
      const decoracao = {
        peca: String(bruta.peca),
        gx,
        gy,
        solido: Boolean(bruta.solido),
        /** Altura em degraus de `ALTURA_NIVEL`. Zero é assentado no chão. */
        nivel: nivelValido(bruta.nivel),
      };
      this.decoracoes.push(decoracao);
      // Só o que está no chão barra a passagem. Peça levantada é cenário por
      // cima — telhado, placa, viga —, e o detetive passa por baixo. Fazer peça
      // alta bloquear emparedaria quem cobrisse a própria casa com telhado.
      if (decoracao.solido && decoracao.nivel === 0) this.bloqueios.add(`${gx},${gy}`);
    }
    /** Fontes de luz quente, para a ambientação. */
    this.luzes = [];
    this.inicio = { gx: 1, gy: 1 };

    for (let gy = 0; gy < this.altura; gy += 1) {
      const linha = dados.objetos[gy];
      for (let gx = 0; gx < this.largura; gx += 1) {
        const ch = linha[gx];
        const def = this.objetos[gy][gx];
        if (!def) continue;

        if (def.marcador === 'vestigio') this.pontosDeVestigio.push({ gx, gy });
        if (def.marcador === 'inicio') this.inicio = { gx, gy };
        if (def.marcador === 'predio') this.marcasPredio.push({ gx, gy });
        if (def.forma) this.pecas.push({ gx, gy, def });
        if (def.luz) this.luzes.push({ gx, gy, raio: def.luz });

        if (def.interacao === 'ligacao') {
          const ligacao = dados.ligacoes?.[ch];
          const destino = { gx, gy, def, tipo: 'ligacao', para: ligacao.para, rotulo: ligacao.rotulo };
          this.interativos.set(`${gx},${gy}`, destino);
          this.ligacoes.push(destino);
        } else if (def.interacao) {
          this.interativos.set(`${gx},${gy}`, { gx, gy, def, tipo: def.interacao });
        }
      }
    }
  }

  /** Confere o mapa antes de montar. Devolve a lista de problemas encontrados. */
  static conferir(dados) {
    const problemas = [];
    if (!dados.chao?.length || !dados.objetos?.length) {
      problemas.push('as camadas "chao" e "objetos" não podem estar vazias');
      return problemas;
    }
    if (dados.chao.length !== dados.objetos.length) {
      problemas.push(`camadas com alturas diferentes (chao ${dados.chao.length}, objetos ${dados.objetos.length})`);
    }

    const largura = dados.chao[0].length;
    dados.chao.forEach((linha, i) => {
      if (linha.length !== largura) {
        problemas.push(`chao linha ${i}: ${linha.length} caracteres, esperado ${largura}`);
      }
      for (const ch of linha) {
        if (!(ch in CHAO)) problemas.push(`chao linha ${i}: caractere desconhecido "${ch}"`);
      }
    });

    const usadas = new Set();
    dados.objetos.forEach((linha, i) => {
      if (linha.length !== largura) {
        problemas.push(`objetos linha ${i}: ${linha.length} caracteres, esperado ${largura}`);
      }
      for (const ch of linha) {
        if (!(ch in OBJETOS)) {
          problemas.push(`objetos linha ${i}: caractere desconhecido "${ch}"`);
          continue;
        }
        if (CHARS_LIGACAO.includes(ch)) {
          usadas.add(ch);
          const ligacao = dados.ligacoes?.[ch];
          if (!ligacao?.para) {
            problemas.push(`objetos linha ${i}: passagem "${ch}" sem destino em "ligacoes"`);
          }
        }
      }
    });

    // Passagens em lista: destino obrigatório e posição inteira dentro do mapa.
    const altura = dados.chao.length;
    (dados.passagens ?? []).forEach((p, i) => {
      if (!p?.para || typeof p.para !== 'string') {
        problemas.push(`passagens[${i}]: sem destino`);
      }
      if (!Number.isInteger(p?.gx) || !Number.isInteger(p?.gy)) {
        problemas.push(`passagens[${i}]: posição precisa ser inteira`);
      } else if (p.gx < 0 || p.gy < 0 || p.gx >= largura || p.gy >= altura) {
        problemas.push(`passagens[${i}]: fora do mapa`);
      }
    });

    // Destino declarado que não aparece no mapa só gera confusão depois.
    for (const ch of Object.keys(dados.ligacoes ?? {})) {
      if (!CHARS_LIGACAO.includes(ch)) {
        problemas.push(`ligacoes: "${ch}" não é um caractere de passagem`);
      } else if (!usadas.has(ch)) {
        problemas.push(`ligacoes: "${ch}" declarado mas ausente do mapa`);
      }
    }

    return [...new Set(problemas)];
  }

  dentro(gx, gy) {
    return gx >= 0 && gy >= 0 && gx < this.largura && gy < this.altura;
  }

  /** O detetive pode ocupar este tile? */
  andavel(gx, gy) {
    if (!this.dentro(gx, gy)) return false;
    const terreno = this.chao[gy][gx];
    if (!terreno?.andavel) return false;
    const objeto = this.objetos[gy][gx];
    if (objeto?.solido) return false;
    return !this.bloqueios.has(`${gx},${gy}`);
  }

  /**
   * Decoração neste tile. Com `nivel`, a daquele nível; sem, a mais baixa.
   *
   * Um tile aceita uma peça por nível: é o que permite piso no chão, parede
   * acima e telhado em cima de tudo na mesma coluna.
   */
  decoracaoEm(gx, gy, nivel = null) {
    if (nivel === null) {
      return (
        this.decoracoes
          .filter((d) => d.gx === gx && d.gy === gy)
          .sort((a, b) => a.nivel - b.nivel)[0] ?? null
      );
    }
    return this.decoracoes.find((d) => d.gx === gx && d.gy === gy && d.nivel === nivel) ?? null;
  }

  /** Todas as decorações de um tile, de baixo para cima. */
  decoracoesEm(gx, gy) {
    return this.decoracoes
      .filter((d) => d.gx === gx && d.gy === gy)
      .sort((a, b) => a.nivel - b.nivel);
  }

  examinavelEm(gx, gy) {
    return this.interativos.get(`${gx},${gy}`) ?? null;
  }

  /** A passagem que leva a um local específico, se existir nesta cena. */
  ligacaoPara(idCena) {
    return this.ligacoes.find((l) => l.para === idCena) ?? null;
  }

  pecaEm(gx, gy) {
    if (!this.dentro(gx, gy)) return null;
    return this.objetos[gy][gx];
  }

  /** Tile andável mais próximo de (gx, gy), útil quando o clique cai numa parede. */
  andavelMaisProximo(gx, gy, origem) {
    if (this.andavel(gx, gy)) return { gx, gy };
    const candidatos = [];
    for (let raio = 1; raio <= 3; raio += 1) {
      for (let dy = -raio; dy <= raio; dy += 1) {
        for (let dx = -raio; dx <= raio; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
          const nx = gx + dx;
          const ny = gy + dy;
          if (this.andavel(nx, ny)) candidatos.push({ gx: nx, gy: ny });
        }
      }
      if (candidatos.length) break;
    }
    if (!candidatos.length) return null;
    if (!origem) return candidatos[0];
    candidatos.sort(
      (a, b) =>
        Math.hypot(a.gx - origem.gx, a.gy - origem.gy) - Math.hypot(b.gx - origem.gx, b.gy - origem.gy),
    );
    return candidatos[0];
  }
}
