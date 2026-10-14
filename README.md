# Caso Aberto

Protótipo de jogo de investigação em vista isométrica. Você é o detetive: começa na rua, entra nos locais do caso, recolhe vestígios, lê os documentos da perícia, ouve os suspeitos e pega um deles mentindo.

A movimentação é inspirada nos ARPG isométricos clássicos — clique no chão e o personagem traça a rota e contorna os móveis sozinho. O resto do jogo é outra coisa: não há combate, dungeon nem loot. O que se explora é uma cena, e o que se acumula é prova.

> Protótipo em desenvolvimento. Um caso, três locais, mecânica fechada de ponta a ponta.

## Rodar

```bash
npm start
```

Abra `http://localhost:4300`. Não há dependências para instalar: o servidor usa só o Node (20 ou mais recente) e o jogo roda em módulos ES nativos no navegador.

Para verificar o projeto sem abrir o navegador:

```bash
npm run check
```

São 127 checagens em dois passos. `tools/verificar.mjs` cobre mapas, navegabilidade com A*, coerência do roteiro, gerador em 240 sementes, interrogatório, deslocamento, progresso salvo e três partidas completas. `tools/fumaca.mjs` monta um DOM mínimo, importa o `main.js` como o navegador faria e roda quadros de verdade — é o que pega erro de renderizador, que a verificação de lógica não enxerga.

## Como se joga

| Ação | Como |
|---|---|
| Caminhar | Clique no chão (ou setas / WASD) |
| Examinar | Clique no objeto destacado — o detetive caminha até lá e examina |
| Entrar num local | Clique na porta iluminada da fachada |
| Caderno de evidências | `C` |
| Ficha de suspeitos | `F` |
| Viagem rápida entre locais | `L` |
| Acusar | `G` |
| Nova investigação | `N` |

Os pontos dourados são vestígios. A marcação no chão da sala e as pastas espalhadas pelos locais trazem os documentos do inquérito.

Quando um balão abre, a cena pausa até você fechá-lo. É deliberado: o texto de um vestígio é para ler, não para piscar na tela.

## A cidade como praça central

O detetive nasce na **Rua das Acácias** e circula por ela a pé. Na calçada ficam as fachadas do Edifício Acácias e da Transportadora Vilar, cada uma com uma porta iluminada que leva ao interior. De dentro, a porta na calçada devolve para a rua.

Ao sair de um prédio você chega **na porta daquele prédio**, não no ponto de partida do mapa. Sem isso, voltar para a rua jogaria o jogador para o meio da quadra e ele perderia a referência de onde estava.

A rua não tem vestígios, e isso é intencional: se o gerador plantasse pistas na calçada, o recibo da disputa societária apareceria no meio do asfalto. A investigação acontece dentro dos locais; a rua é circulação e ambientação. Para ela não ficar vazia, há uma banca de jornal com a reportagem sobre o caso.

O `L` abre a viagem rápida entre locais. É conveniência, não o caminho principal.

## Interrogatório e contradições

É o centro do jogo. Em **Suspeitos**, cada um tem um botão de interrogar. Você escolhe o que perguntar e ouve a resposta.

Se você tiver no caderno um vestígio que desmente aquela resposta, aparece a opção de **confrontar**. A versão cai, o suspeito reage e a mentira fica registrada no caderno.

Exemplo: Tiago jura ter voltado à cidade só de madrugada. Com o comprovante de pedágio das 22h31 em mãos, essa versão não se sustenta.

As provas do culpado sempre entram na investigação, então a versão dele é sempre derrubável — desde que você ache o vestígio certo. Os inocentes recebem uma pista falsa cada, o que torna possível derrubar a versão de quem não fez nada. Faz parte: o peso tem que ser lido no conjunto, não numa pista isolada.

O desfecho mede três coisas: se você nomeou a pessoa certa, quantas provas dela você tinha e quantas versões dela você derrubou.

## O mistério é gerado, os mapas não

Os três locais são sempre os mesmos. O que muda a cada partida é a dedução:

- o culpado é sorteado entre os quatro suspeitos;
- os três vestígios que o incriminam entram na investigação;
- três pistas falsas são distribuídas em rodízio entre os inocentes, para que nenhum deles acumule prova suficiente para parecer culpado;
- dois vestígios de contexto entram para fechar o quadro (horário, via de entrada, sedativo);
- tudo é espalhado entre os locais investigáveis, equilibrando a carga para que nenhum fique vazio.

Resultado: mesmo crime, caminhos de investigação diferentes. A semente aparece na barra superior e fica na URL (`#semente=corlun-48`), então uma partida específica pode ser repetida ou compartilhada.

## Progresso salvo

O jogo grava sozinho no navegador (localStorage) a cada avanço: vestígio recolhido, documento lido, versão derrubada, troca de local e desfecho. Ao reabrir, a investigação continua de onde parou.

Só a sua trilha é salva; o mistério não, porque a semente já o reconstrói idêntico. Um progresso de outra semente é ignorado. "Nova investigação" apaga o save e sorteia outro caso.

Abrir uma URL com `#semente=` tem prioridade sobre o save: dá para visitar um caso específico sem perder o seu.

## Editar os locais

Os mapas são texto. Abra qualquer arquivo em `src/dados/cena-*.js` e troque caracteres nas duas matrizes:

```
CHÃO                 OBJETOS
(espaço) vazio       .  nada           U  pia
w  tábua             #  parede         H  banco
t  ladrilho          d  passagem       P  vaso
c  tapete            S  sofá           Y  árvore
p  calçada           T  mesa           L  poste / luminária
a  asfalto           V  estante        O  marcação da vítima
g  grama             A  armário        F  pasta da perícia
                     B  cama           J  banca de jornal
                     D  escrivaninha   *  ponto de vestígio
                     K  bancada        X  onde o detetive chega
                     1 2 3  passagem para outro local
```

Os números são passagens. O destino de cada um vem do campo `ligacoes` da própria cena, então o mesmo caractere serve em qualquer mapa:

```js
ligacoes: {
  1: { para: 'apto-302', rotulo: 'Edifício Acácias — entrada do 302' },
  2: { para: 'escritorio', rotulo: 'Transportadora Vilar — portaria' },
},
```

Depois de editar, rode `npm run check`. Ele acusa linha com comprimento errado, caractere desconhecido, passagem sem destino declarado, passagem sem caminho de volta, porta inalcançável a pé, ponto de vestígio dentro de parede, objeto de leitura sem documento e qualquer canto que o detetive não consiga alcançar.

Para somar um local novo, copie um dos arquivos, mude o `id`, declare as `ligacoes` nos dois sentidos e inclua na lista `CENAS` em `src/main.js`.

## Editar o caso

`src/dados/caso-014.js` tem a vítima, os suspeitos com suas perguntas e contradições, o acervo de vestígios, os documentos por local e a composição — quantos de cada tipo entram por partida.

Para escrever outro caso, mantenha a estrutura. O que a verificação cobra:

- cada `contradizPor` precisa citar um vestígio que aponte para aquele mesmo suspeito;
- toda pergunta com contradição precisa de uma `reacao`;
- cada suspeito precisa de pelo menos duas perguntas derrubáveis, para que qualquer um deles funcione como culpado;
- cada objeto de leitura de um local precisa de um documento daquele local.

## Estrutura

```
src/
  core/      projeção isométrica, câmera, laço de quadros, entrada, aleatoriedade com semente
  mundo/     dicionário de tiles, leitura do mapa ASCII, busca de caminho A*
  jogo/      detetive, regras da investigação, gerador de mistério, progresso salvo
  render/    desenho da cena no canvas
  ui/        barra superior, caderno, suspeitos, interrogatório, deslocamento, acusação
  dados/     os locais e o caso
tools/       verificação de lógica e teste de fumaça
```

Separação que vale a pena manter: `jogo/` e `mundo/` não tocam no DOM nem no canvas. É por isso que a verificação consegue simular partidas inteiras no Node, incluindo entrar e sair dos prédios e interrogar suspeitos, sem navegador.

Detalhes de implementação que podem interessar depois:

- A grade é ortogonal; só o desenho é isométrico (`src/core/iso.js`). Editar mapa continua sendo editar uma matriz.
- O A* usa oito direções e exige os dois lados livres antes de cortar diagonal. A suavização de rota aplica a mesma regra: sem isso ela desfaz o cuidado da busca e o detetive atravessa o vão entre dois objetos encostados.
- A profundidade de desenho é `gx + gy`: móveis, vestígios e o detetive entram numa fila ordenada antes de desenhar.
- O depósito do progresso é injetável, então a verificação usa um em memória no lugar do localStorage.

## Publicação

O site é estático e vai para o GitHub Pages pelo workflow em `.github/workflows/pages.yml`, que roda `npm run check` antes de publicar. O build padrão do Pages, que passa tudo pelo Jekyll, não é usado: o projeto não precisa dele e aquele caminho já travou por minutos baixando imagem de container.

## Arte e direitos

Todo o código e toda a arte são originais. Não há nenhum asset de terceiros no repositório: o cenário, os móveis, as árvores e o detetive são geometria desenhada em tempo real no canvas. Nenhum arquivo de imagem, fonte ou som externo é carregado.

Como funciona, em resumo: o chão é um losango preenchido; paredes e móveis são esse losango extrudado, com duas faces laterais sombreadas e um topo; o detetive é um conjunto de primitivas (elipse de sombra, polígono de sobretudo, círculo de cabeça, elipse de chapéu) com a caminhada vinda de um seno. Cores, altura e escala de cada peça ficam numa tabela em `src/mundo/tiles.js`, então mudar a aparência do jogo é mudar valores ali.

O Diablo entra só como referência de movimentação e enquadramento — a ideia de clicar no chão e o personagem caminhar até lá, em vista isométrica. Nada de conteúdo, dados, arte ou código daquele jogo é usado aqui.

O caso, os nomes, os depoimentos e os documentos são ficção escrita para este protótipo.

## Próximos passos possíveis

- Afinidade de local por vestígio, para que cada pista só apareça onde faz sentido — e aí a rua poderia receber as que combinam com ela.
- Depoimentos que se abrem conforme o avanço: perguntas novas após derrubar uma versão.
- Cruzar dois vestígios entre si, e não só vestígio contra depoimento.
- Mais locais na cidade: delegacia, portaria, garagem.
- Mais casos, em arquivo externo, para escrever roteiro sem mexer em código.
- Tempo ou número limitado de confrontos, criando custo para errar.

## Licença

MIT. Veja `LICENSE`.
