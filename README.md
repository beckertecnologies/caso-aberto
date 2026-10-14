# Caso Aberto

Protótipo de jogo de investigação em vista isométrica. Você é o detetive: percorre a cena do crime clicando pelo cenário, recolhe vestígios, lê os documentos da perícia e nomeia um culpado.

A movimentação é inspirada nos ARPG isométricos clássicos — clique no chão e o personagem traça a rota e contorna os móveis sozinho. O resto do jogo é outra coisa: não há combate, dungeon nem loot. O que se explora é uma cena, e o que se acumula é prova.

> Protótipo em estágio inicial. Um caso, uma cena, mecânica fechada de ponta a ponta.

## Rodar

```bash
npm start
```

Abra `http://localhost:4300`. Não há dependências para instalar: o servidor usa só o Node (20 ou mais recente) e o jogo roda em módulos ES nativos no navegador.

Para verificar o projeto sem abrir o navegador:

```bash
npm run check
```

Isso confere o mapa, a navegabilidade com A*, o gerador de mistério em 240 sementes e simula três partidas completas.

## Como se joga

| Ação | Como |
|---|---|
| Caminhar | Clique no chão (ou setas / WASD) |
| Examinar | Clique no objeto destacado — o detetive caminha até lá e examina |
| Caderno de evidências | `C` |
| Ficha de suspeitos | `F` |
| Acusar | `G` |
| Nova investigação | `N` |

Os pontos dourados são vestígios. A marcação no chão da sala e as pastas espalhadas pelo apartamento trazem os documentos do inquérito. A placa verde na calçada encerra a investigação.

## O mistério é gerado, o mapa não

O apartamento é sempre o mesmo. O que muda a cada partida é a dedução:

- o culpado é sorteado entre os quatro suspeitos;
- os três vestígios que o incriminam entram na cena;
- três pistas falsas são distribuídas em rodízio entre os inocentes, para que nenhum deles acumule prova suficiente para parecer culpado;
- dois vestígios de contexto entram para fechar o quadro (horário, via de entrada, sedativo);
- tudo é espalhado entre os quatorze pontos possíveis do mapa.

Resultado: a mesma cena e o mesmo crime rendem caminhos de investigação diferentes. A semente aparece na barra superior e fica na URL (`#semente=corlun-48`), então uma partida específica pode ser repetida ou compartilhada.

## Editar a cena

O mapa é texto. Abra `src/dados/cena-apto302.js` e troque caracteres nas duas matrizes:

```
CHÃO                 OBJETOS
(espaço) vazio       .  nada           K  bancada
w  tábua             #  parede         U  pia
t  ladrilho          d  passagem       P  vaso
c  tapete            S  sofá           L  luminária
p  calçada           T  mesa           O  marcação da vítima
                     V  estante        F  pasta da perícia
                     A  guarda-roupa   E  saída
                     B  cama           *  ponto de vestígio
                     D  escrivaninha   X  início do detetive
```

Depois de editar, rode `npm run check`. Ele acusa linha com comprimento errado, caractere desconhecido, ponto de vestígio dentro de parede e qualquer canto que o detetive não consiga alcançar.

Para criar outra cena, copie o arquivo, mude o `id` e aponte o import em `src/main.js`.

## Editar o caso

`src/dados/caso-014.js` tem a vítima, os quatro suspeitos, o acervo de vestígios (três por suspeito), os vestígios de contexto, os documentos fixos e a composição — quantos de cada tipo entram por partida. Para um caso novo, copie o arquivo e mantenha a estrutura: o gerador funciona para qualquer número de suspeitos, desde que o acervo tenha vestígios suficientes para cada um.

## Estrutura

```
src/
  core/      projeção isométrica, câmera, laço de quadros, entrada, aleatoriedade com semente
  mundo/     dicionário de tiles, leitura do mapa ASCII, busca de caminho A*
  jogo/      detetive, regras da investigação, gerador de mistério
  render/    desenho da cena no canvas
  ui/        barra superior, caderno, suspeitos, documentos, acusação
  dados/     a cena e o caso
tools/       verificação por linha de comando
```

Separação que vale a pena manter: `jogo/` e `mundo/` não tocam no DOM nem no canvas. É por isso que a verificação consegue simular partidas inteiras no Node, sem navegador.

Detalhes de implementação que podem interessar depois:

- A grade é ortogonal; só o desenho é isométrico (`src/core/iso.js`). Editar mapa continua sendo editar uma matriz.
- O A* usa oito direções, exige os dois lados livres antes de cortar diagonal e suaviza a rota com teste de linha livre. É o que dá a caminhada natural em volta dos móveis.
- A profundidade de desenho é `gx + gy`: móveis, vestígios e o detetive entram numa fila ordenada antes de desenhar.

## Arte e direitos

Todo o código e toda a arte são originais. Não há nenhum asset de terceiros no repositório: o cenário, os móveis e o detetive são geometria desenhada em tempo real no canvas. Nenhum arquivo de imagem, fonte ou som externo é carregado.

O Diablo entra só como referência de movimentação e enquadramento — a ideia de clicar no chão e o personagem caminhar até lá, em vista isométrica. Nada de conteúdo, dados ou código daquele jogo é usado aqui.

O caso, os nomes e os documentos são ficção escrita para este protótipo.

## Próximos passos possíveis

- Mais de uma cena, com transição entre locais (o `E` já existe como gancho).
- Depoimentos de suspeitos como interação, e não só ficha.
- Contradições: cruzar dois vestígios para derrubar um álibi.
- Salvar progresso no navegador.
- Casos em arquivo externo, para escrever roteiro sem mexer em código.

## Licença

MIT. Veja `LICENSE`.
