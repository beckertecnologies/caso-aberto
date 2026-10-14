// Busca de caminho A* em oito direções, com suavização.
// O resultado imita a caminhada de ARPG isométrico: clicou longe, o personagem
// contorna os móveis sozinho em vez de travar na quina.

const VIZINHOS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** Distância octil: custo mínimo realista para grade de 8 direções. */
function estimativa(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Caminho de (origem) até (destino), sem incluir a origem.
 * @returns {{x:number,y:number}[]} vazio quando não há rota
 */
export function buscarCaminho(cena, origem, destino) {
  const inicioX = Math.round(origem.gx);
  const inicioY = Math.round(origem.gy);
  const fimX = Math.round(destino.gx);
  const fimY = Math.round(destino.gy);

  if (!cena.andavel(fimX, fimY)) return [];
  if (inicioX === fimX && inicioY === fimY) return [];

  const chave = (x, y) => y * cena.largura + x;
  const custo = new Map();
  const anterior = new Map();
  const abertos = [{ x: inicioX, y: inicioY, g: 0, f: estimativa(inicioX, inicioY, fimX, fimY) }];
  const fechados = new Set();

  custo.set(chave(inicioX, inicioY), 0);

  let limite = cena.largura * cena.altura * 8; // trava de segurança

  while (abertos.length && limite > 0) {
    limite -= 1;

    // Lista pequena: varredura linear é mais rápida que montar um heap aqui.
    let melhor = 0;
    for (let i = 1; i < abertos.length; i += 1) {
      if (abertos[i].f < abertos[melhor].f) melhor = i;
    }
    const atual = abertos.splice(melhor, 1)[0];
    const kAtual = chave(atual.x, atual.y);

    if (atual.x === fimX && atual.y === fimY) {
      return suavizar(cena, origem, reconstruir(anterior, chave, atual));
    }

    if (fechados.has(kAtual)) continue;
    fechados.add(kAtual);

    for (const [dx, dy, peso] of VIZINHOS) {
      const nx = atual.x + dx;
      const ny = atual.y + dy;
      if (!cena.andavel(nx, ny)) continue;
      // Na diagonal, exige os dois lados livres: evita atravessar quina de parede.
      if (dx !== 0 && dy !== 0 && (!cena.andavel(atual.x + dx, atual.y) || !cena.andavel(atual.x, atual.y + dy))) {
        continue;
      }
      const kVizinho = chave(nx, ny);
      if (fechados.has(kVizinho)) continue;

      const novoCusto = atual.g + peso;
      if (custo.has(kVizinho) && novoCusto >= custo.get(kVizinho)) continue;

      custo.set(kVizinho, novoCusto);
      anterior.set(kVizinho, { x: atual.x, y: atual.y });
      abertos.push({ x: nx, y: ny, g: novoCusto, f: novoCusto + estimativa(nx, ny, fimX, fimY) });
    }
  }

  return [];
}

function reconstruir(anterior, chave, fim) {
  const caminho = [{ x: fim.x, y: fim.y }];
  let passo = anterior.get(chave(fim.x, fim.y));
  while (passo) {
    caminho.push({ x: passo.x, y: passo.y });
    passo = anterior.get(chave(passo.x, passo.y));
  }
  caminho.reverse();
  caminho.shift(); // a origem não entra
  return caminho;
}

/** Há linha livre entre dois pontos? Amostra o segmento em passos curtos. */
export function linhaLivre(cena, ax, ay, bx, by) {
  const distancia = Math.hypot(bx - ax, by - ay);
  const passos = Math.ceil(distancia / 0.25);
  for (let i = 1; i <= passos; i += 1) {
    const t = i / passos;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    if (!cena.andavel(x, y)) return false;
  }
  return true;
}

/** Remove nós intermediários que podem ser cortados em linha reta. */
function suavizar(cena, origem, caminho) {
  if (caminho.length < 2) return caminho;
  const saida = [];
  let px = origem.gx;
  let py = origem.gy;
  let i = 0;

  while (i < caminho.length) {
    let melhor = i;
    for (let j = caminho.length - 1; j > i; j -= 1) {
      if (linhaLivre(cena, px, py, caminho[j].x, caminho[j].y)) {
        melhor = j;
        break;
      }
    }
    saida.push(caminho[melhor]);
    px = caminho[melhor].x;
    py = caminho[melhor].y;
    i = melhor + 1;
  }

  return saida;
}

/**
 * Tile livre ao lado de um alvo sólido, o mais próximo possível de quem vai andar.
 * Usado para "chegar perto e examinar".
 */
export function ladoAcessivel(cena, alvo, origem) {
  if (cena.andavel(alvo.gx, alvo.gy)) return { gx: alvo.gx, gy: alvo.gy };
  const opcoes = [];
  for (const [dx, dy] of VIZINHOS) {
    const nx = alvo.gx + dx;
    const ny = alvo.gy + dy;
    if (cena.andavel(nx, ny)) opcoes.push({ gx: nx, gy: ny });
  }
  if (!opcoes.length) return null;
  opcoes.sort(
    (a, b) =>
      Math.hypot(a.gx - origem.gx, a.gy - origem.gy) - Math.hypot(b.gx - origem.gx, b.gy - origem.gy),
  );
  return opcoes[0];
}
