# Caso Aberto

Protótipo de jogo de investigação em vista isométrica. Você é o detetive: percorre os locais do caso clicando pelo cenário, recolhe vestígios, lê os documentos da perícia, ouve os suspeitos e pega um deles mentindo.

A movimentação é inspirada nos ARPG isométricos clássicos — clique no chão e o personagem traça a rota e contorna os móveis sozinho. O resto do jogo é outra coisa: não há combate, dungeon nem loot. O que se explora é uma cena, e o que se acumula é prova.

> Protótipo em desenvolvimento. Um caso, dois locais, mecânica fechada de ponta a ponta.

## Rodar

```bash
npm start
```

Abra `http://localhost:4300`. Não há dependências para instalar: o servidor usa só o Node (20 ou mais recente) e o jogo roda em módulos ES nativos no navegador.

Para verificar o projeto sem abrir o navegador:

```bash
npm run check
```

São 94 checagens: mapas, navegabilidade com A*, coerência do roteiro, gerador em 240 sementes, interrogatório, deslocamento, progresso salvo e três partidas simuladas do início à acusação.

## Como se joga

| Ação | Como |
|---|---|
| Caminhar | Clique no chão (ou setas / WASD) |
| Examinar | Clique no objeto destacado — o detetive caminha até lá e examina |
| Caderno de evidências | `C` |
| Ficha de suspeitos | `F` |
| Trocar de local | `L`, ou clique na placa verde da cena |
| Acusar | `G` |
| Nova investigação | `N` |

Os pontos dourados são vestígios. A marcação no chão da sala e as pastas espalhadas pelos locais trazem os documentos do inquérito.

Quando um balão abre, a cena pausa até você fechá-lo. É deliberado: o texto de um vestígio é para ler, não para piscar na tela.

## Interrogatório e contradições

É o centro do jogo. Em **Suspeitos**, cada um tem um botão de interrogar. Você escolhe o que perguntar e ouve a resposta.

Se você tiver no caderno um vestígio que desmente aquela resposta, aparece a opção de **confrontar**. A versão cai, o suspeito reage e a mentira fica registrada no caderno.

Exemplo: Tiago jura ter voltado à cidade só de madrugada. Com o comprovante de pedágio das 22h31 em mãos, essa versão não se sustenta.

As provas do culpado sempre entram na investigação, então a versão dele é sempre derrubável — desde que você ache o vestígio certo. Os inocentes recebem uma pista falsa cada, o que torna possível derrubar a versão de quem não fez nada. Faz parte: o peso tem que ser lido no conjunto, não numa pista isolada.

O desfecho mede três coisas: se você nomeou a pessoa certa, quantas provas dela você tinha e quantas versões dela você derrubou.

## O mistério é gerado, os mapas não

Os dois locais são sempre os mesmos. O que muda a cada partida é a dedução:

- o culpado é sorteado entre os quatro suspeitos;
- os três vestígios que o incriminam entram na investigação;
- três pistas falsas são distribuídas em rodízio entre os inocentes, para que nenhum deles acumule prova suficiente para parecer culpado;
- dois vestígios de contexto entram para fechar o quadro (horário, via de entrada, sedativo);
- tudo é espalhado entre os dois locais, equilibrando a carga para que nenhum fique vazio.

Resultado: mesmo crime, caminhos de investigação diferentes. A semente aparece na barra superior e fica na URL (`#semente=corlun-48`), então uma partida específica pode ser repetida ou compartilhada.

## Progresso salvo

O jogo grava sozinho no navegador (localStorage) a cada avanço: vestígio recolhido, documento lido, versão derrubada, troca de local e desfecho. Ao reabrir, a investigação continua de onde parou.

Só a sua trilha é salva; o mistério não, porque a semente já o reconstrói idêntico. Um progresso de outra semente é ignorado. "Nova investigação" apaga o save e sorteia outro caso.

Abrir uma URL com `#semente=` tem prioridade sobre o save: dá para visitar um caso específico sem perder o seu.

## Editar os locais

Os mapas são texto. Abra `src/dados/cena-apto302.js` ou `src/dados/cena-escritorio.js` e troque caracteres nas duas matrizes:

```
CHÃO                 OBJETOS
(espaço) vazio       .  nada           K  bancada
w  tábua             #  parede         U  pia
t  ladrilho          d  passagem       P  vaso
c  tapete            S  sofá           L  luminária
p  calçada           T  mesa           O  marcação da vítima
                     V  estante        F  pasta da perícia
                     A  guarda-roupa   E  saída (abre o deslocamento)
                     B  cama           *  ponto de vestígio
                     D  escrivaninha   X  início do detetive
```

Depois de editar, rode `npm run check`. Ele acusa linha com comprimento errado, caractere desconhecido, ponto de vestígio dentro de parede, pasta sem documento e qualquer canto que o detetive não consiga alcançar.

Para somar um terceiro local, copie um dos arquivos, mude o `id` e inclua na lista `CENAS` em `src/main.js`.

## Editar o caso

`src/dados/caso-014.js` tem a vítima, os suspeitos com suas perguntas e contradições, o acervo de vestígios, os documentos por local e a composição — quantos de cada tipo entram por partida.

Para escrever outro caso, mantenha a estrutura. O que a verificação cobra:

- cada `contradizPor` precisa citar um vestígio que aponte para aquele mesmo suspeito;
- toda pergunta com contradição precisa de uma `reacao`;
- cada suspeito precisa de pelo menos duas perguntas derrubáveis, para que qualquer um deles funcione como culpado;
- cada pasta de um local precisa de um documento daquele local.

## Estrutura

```
src/
  core/      projeção isométrica, câmera, laço de quadros, entrada, aleatoriedade com semente
  mundo/     dicionário de tiles, leitura do mapa ASCII, busca de caminho A*
  jogo/      detetive, regras da investigação, gerador de mistério, progresso salvo
  render/    desenho da cena no canvas
  ui/        barra superior, caderno, suspeitos, interrogatório, deslocamento, acusação
  dados/     os locais e o caso
tools/       verificação por linha de comando
```

Separação que vale a pena manter: `jogo/` e `mundo/` não tocam no DOM nem no canvas. É por isso que a verificação consegue simular partidas inteiras no Node, incluindo viagem entre locais e interrogatório, sem navegador.

Detalhes de implementação que podem interessar depois:

- A grade é ortogonal; só o desenho é isométrico (`src/core/iso.js`). Editar mapa continua sendo editar uma matriz.
- O A* usa oito direções, exige os dois lados livres antes de cortar diagonal e suaviza a rota com teste de linha livre. É o que dá a caminhada natural em volta dos móveis.
- A profundidade de desenho é `gx + gy`: móveis, vestígios e o detetive entram numa fila ordenada antes de desenhar.
- O depósito do progresso é injetável, então a verificação usa um em memória no lugar do localStorage.

## Publicação

O site é estático e vai para o GitHub Pages pelo workflow em `.github/workflows/pages.yml`, que roda `npm run check` antes de publicar. O build padrão do Pages, que passa tudo pelo Jekyll, não é usado: o projeto não precisa dele e aquele caminho já travou por minutos baixando imagem de container.

## Arte e direitos

Todo o código e toda a arte são originais. Não há nenhum asset de terceiros no repositório: o cenário, os móveis e o detetive são geometria desenhada em tempo real no canvas. Nenhum arquivo de imagem, fonte ou som externo é carregado.

O Diablo entra só como referência de movimentação e enquadramento — a ideia de clicar no chão e o personagem caminhar até lá, em vista isométrica. Nada de conteúdo, dados ou código daquele jogo é usado aqui.

O caso, os nomes, os depoimentos e os documentos são ficção escrita para este protótipo.

## Próximos passos possíveis

- Depoimentos que se abrem conforme o avanço: perguntas novas após derrubar uma versão.
- Cruzar dois vestígios entre si, e não só vestígio contra depoimento.
- Afinidade de local por vestígio, para que cada pista apareça onde faz sentido.
- Mais casos, em arquivo externo, para escrever roteiro sem mexer em código.
- Tempo ou número limitado de confrontos, criando custo para errar.

## Licença

MIT. Veja `LICENSE`.
