// Servidor estático de desenvolvimento. Sem dependências: usa só o Node.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const RAIZ = resolve(import.meta.dirname);
const PORTA = Number(process.env.PORT) || 4300;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Resolve a URL para um caminho dentro da raiz, bloqueando saída do diretório. */
function caminhoSeguro(url) {
  const semQuery = decodeURIComponent(url.split('?')[0].split('#')[0]);
  const relativo = normalize(semQuery).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const destino = join(RAIZ, relativo);
  if (destino !== RAIZ && !destino.startsWith(RAIZ + sep)) return null;
  return destino;
}

const servidor = createServer(async (req, res) => {
  try {
    let destino = caminhoSeguro(req.url || '/');
    if (!destino) {
      res.writeHead(403).end('Acesso negado');
      return;
    }

    let info = await stat(destino).catch(() => null);
    if (info?.isDirectory()) {
      destino = join(destino, 'index.html');
      info = await stat(destino).catch(() => null);
    }
    if (!info?.isFile()) {
      destino = join(RAIZ, 'index.html');
      info = await stat(destino).catch(() => null);
      if (!info?.isFile()) {
        res.writeHead(404).end('Não encontrado');
        return;
      }
    }

    const corpo = await readFile(destino);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(corpo);
  } catch (erro) {
    res.writeHead(500).end('Erro interno');
    console.error(erro);
  }
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Caso Aberto rodando em http://localhost:${PORTA}`);
});
