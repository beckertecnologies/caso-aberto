// Interpreta o mapa ASCII e expõe consultas que o jogo precisa:
// onde dá para pisar, onde ficam os objetos, onde um vestígio pode surgir e
// quais passagens levam a outros locais.

import { CHAO, CHARS_LIGACAO, OBJETOS } from './tiles.js';

export class Cena {
  /**
   * @param {{id:string,nome:string,endereco:string,chao:string[],objetos:string[],ligacoes?:object}} dados
   */
  constructor(dados) {
    this.id = dados.id;
    this.nome = dados.nome;
    this.endereco = dados.endereco;

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
    /** Mapa "gx,gy" -> objeto examinável. */
    this.interativos = new Map();
    /** Passagens para outros locais. */
    this.ligacoes = [];
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
    return !objeto?.solido;
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
