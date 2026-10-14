# Caso Aberto

Protótipo de jogo de investigação em vista isométrica. Você é o detetive: circula pela rua, entra nos locais do caso, recolhe vestígios, cruza o que encontra, ouve os suspeitos e pega um deles mentindo.

A movimentação é inspirada nos ARPG isométricos clássicos — clique no chão e o personagem traça a rota e contorna os móveis sozinho. O resto do jogo é outra coisa: não há combate, dungeon nem loot. O que se explora é uma cena, e o que se acumula é prova.

> Protótipo em desenvolvimento. Um caso, quatro locais, mecânica fechada de ponta a ponta.

## Rodar

```bash
npm start
```

Abra `http://localhost:4300`. Não há dependências para instalar: o servidor usa só o Node (20.11 ou mais recente, por causa de `import.meta.dirname`) e o jogo roda em módulos ES nativos no navegador.

```bash
npm run editor
```

O editor de mundo, em `http://localhost:4400`. **Ele roda só na sua máquina, de propósito** — ver "O editor não vai ao ar" abaixo.

```bash
npm run check
```

São 316 checagens em cinco passos:

| Passo | O que cobre |
|---|---|
| `tools/verificar.mjs` | mapas, navegabilidade com A*, coerência do roteiro, gerador em 240 sementes, interrogatório, cruzamentos, custo de errar, deslocamento, progresso salvo e partidas completas |
| `tools/fumaca.mjs` | monta um DOM mínimo, importa o `main.js` como o navegador faria e roda quadros de verdade — pega erro de renderizador, que a lógica não enxerga |
| `tools/editor.mjs` | as regras de edição: empilhamento por nível, borracha, giro das orientações, mensagens de validação, alinhamento do acervo |
| `tools/fumaca-editor.mjs` | o editor pelo caminho real: escolher peça, girar, pintar, apagar, conta-gotas, validar e salvar |
| `tools/detetive.mjs` | o atlas do personagem e o mapa das oito direções |

## O editor não vai ao ar

O código do editor **está** no repositório, mas o site publicado só tem o jogo. Não é esquecimento: o editor grava arquivo em disco e depende de um processo Node (`editor-server.mjs`), e o GitHub Pages serve arquivo estático, sem runtime. Publicar a pasta faria o editor abrir, tentar o primeiro `fetch` e morrer com tela preta — pior do que não existir.

Quem clona o repositório tem o editor completo com `npm run editor`. Quem abre o link publicado joga.

O passo de publicação em `.github/workflows/pages.yml` monta a pasta do site a dedo, e `tools/conferir-site.mjs` confere o resultado **nas duas direções**: que está lá toda a arte que o jogo pede, e que não foi junto nada de ferramenta local. Essa conferência existe porque o jogo degrada em silêncio — sem textura ele cai na pintura procedural e segue jogável, então um `cp` esquecido subiria um site sem arte sem avisar ninguém. Foi o que aconteceu uma vez.

O servidor do editor escuta só em `127.0.0.1`. Ele escreve nos arquivos do projeto sem pedir autenticação, o que é aceitável para ferramenta de mesa e não seria para nada exposto na rede — não o coloque atrás de um túnel nem mude o endereço de escuta.

## Como se joga

| Ação | Como |
|---|---|
| Caminhar | Clique no chão, ou setas / WASD |
| Examinar | Clique no objeto destacado, ou `E` para o que estiver por perto |
| Entrar num local | Clique na porta iluminada da fachada |
| Caderno de evidências | `C` |
| Ficha de suspeitos | `F` |
| Viagem rápida entre locais | `L` |
| Acusar | `G`, ou a mesa de registro da delegacia |
| Nova investigação | `N` |

Os pontos dourados são vestígios. A marcação no chão, as pastas da perícia e a banca de jornal trazem os documentos do inquérito.

Quando um balão abre, a cena pausa até você fechá-lo. É deliberado: o texto de um vestígio é para ler, não para piscar na tela.

## A cidade como praça central

O detetive nasce na **Rua das Acácias** e circula por ela a pé. Nas fachadas ficam as portas iluminadas do Edifício Acácias, da Transportadora Vilar e da Delegacia do 4º Distrito. De dentro de qualquer local, a porta devolve para a rua.

Ao sair de um prédio você chega **na porta daquele prédio**, não no ponto de partida do mapa. Sem isso, voltar para a rua jogaria o jogador para o meio da quadra e ele perderia a referência de onde estava.

A delegacia é local de serviço: não há vestígio lá, e sim a papelada do inquérito e a mesa de registro, onde a acusação é formalizada. O `L` abre a viagem rápida — conveniência, não o caminho principal.

## Onde cada vestígio pode aparecer

Vestígio tem endereço. Cada um declara em `locais` os lugares onde faz sentido existir, e o gerador respeita isso:

```js
{ id: 'r2', nome: 'Marca de salto no ladrilho', locais: ['apto-302'], ... }
{ id: 'h2', nome: 'Luva de trabalho', locais: ['apto-302', 'cidade'], ... }
```

O motivo é simples: o texto nunca pode contradizer o cenário. "Caída atrás do sofá" não pode surgir numa sala de reuniões, e um recibo de disputa societária não fica no meio da calçada.

Sem `locais`, o vestígio vai para qualquer local **fechado**. A rua é marcada com `externo: true` e só recebe o que pedir por ela explicitamente — por isso a calçada tem luva de trabalho e cupom de pedágio, não papelada de escritório.

Em 400 investigações medidas, a distribuição ficou em 1504 vestígios no apartamento, 1007 no escritório e 689 na rua, com apenas 6 partidas sem nada na rua.

## Interrogatório, contradições e cruzamentos

É o centro do jogo. Em **Suspeitos**, cada um tem um botão de interrogar. Você escolhe o que perguntar e ouve a resposta.

**Confrontar.** Você escolhe qualquer vestígio do caderno e joga na mesa. Se ele desmentir aquela resposta, a versão cai, o suspeito reage e a mentira fica registrada. Exemplo: Tiago jura ter voltado à cidade só de madrugada; o comprovante de pedágio das 22h31 não deixa a versão de pé.

**Custo para errar.** Confrontar é aposta, não lista de acertos garantidos — a interface oferece todos os vestígios, inclusive os que não servem. Cada erro gasta uma tentativa, e depois de duas o suspeito **encerra a conversa** e não responde mais nesta investigação. Fechar um suspeito não trava o caso: acusar continua possível, só mais no escuro.

**Perguntas que se abrem.** Derrubar a versão de alguém sobre a noite do crime destrava uma pergunta nova, mais incisiva, que não existia antes. A conversa avança em vez de ser uma lista de três itens.

**Cruzamentos.** Dois vestígios juntos podem dizer o que nenhum diz sozinho. Com o relógio parado às 23h14 e o cupom das 22h31 no caderno, aparece a opção de cruzar, e sai uma dedução fechada sobre a janela de tempo. Cruzamentos entram como reforço do relato final; não são exigidos para o fechamento completo, porque parte deles depende de vestígios de contexto que o sorteio nem sempre planta.

As provas do culpado sempre entram na investigação, então a versão dele é sempre derrubável — desde que você ache o vestígio certo. Os inocentes recebem uma pista falsa cada, o que torna possível derrubar a versão de quem não fez nada. Faz parte: o peso tem que ser lido no conjunto.

O desfecho mede se você nomeou a pessoa certa, quantas provas dela tinha, quantas versões dela derrubou e quantas deduções sustentam o relato.

## O mistério é gerado, os mapas não

Os quatro locais são sempre os mesmos. O que muda a cada partida é a dedução: o culpado é sorteado; os três vestígios que o incriminam entram; três pistas falsas são distribuídas em rodízio entre os inocentes, para que nenhum acumule prova suficiente para parecer culpado; dois vestígios de contexto fecham o quadro; e tudo é plantado respeitando a afinidade de local, equilibrando a carga.

A semente aparece na barra superior e fica na URL (`#semente=corlun-48`), então uma partida específica pode ser repetida ou compartilhada.

## Progresso salvo

O jogo grava sozinho no navegador a cada avanço: vestígio recolhido, documento lido, versão derrubada, cruzamento feito, tentativa gasta, troca de local e desfecho. Ao reabrir, a investigação continua de onde parou.

Só a sua trilha é salva; o mistério não, porque a semente já o reconstrói idêntico. Progresso de outra semente é ignorado, e "Nova investigação" apaga o save. Abrir uma URL com `#semente=` tem prioridade sobre o save.

As tentativas gastas também são salvas — senão recarregar a página devolveria confrontos e o custo de errar viraria enfeite.

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
                     D  escrivaninha   W  mesa de registro (acusação)
                     K  balcão         *  ponto de vestígio
                     1 2 3  passagem   X  onde o detetive chega
```

Os números são passagens, com destino no campo `ligacoes` da cena:

```js
ligacoes: {
  1: { para: 'apto-302', rotulo: 'Edifício Acácias — entrada do 302' },
  3: { para: 'delegacia', rotulo: 'Delegacia do 4º Distrito' },
},
```

Cena sem nenhum `*` é local de serviço e o gerador a ignora ao plantar. Cena com `externo: true` só recebe vestígio que peça por ela.

Depois de editar, rode `npm run check`. Ele acusa linha de comprimento errado, caractere desconhecido, passagem sem destino, passagem sem volta, porta inalcançável a pé, ponto de vestígio dentro de parede, objeto de leitura sem documento e qualquer canto que o detetive não alcance.

## Editar o caso

`src/dados/caso-014.js` tem a vítima, os suspeitos com perguntas e contradições, o acervo com afinidade de local, os cruzamentos, os documentos por local e a composição de cada partida.

O que a verificação cobra de um caso novo:

- cada `contradizPor` precisa citar vestígio que aponte para aquele mesmo suspeito;
- toda pergunta com contradição precisa de `reacao`;
- cada suspeito precisa de ao menos duas perguntas derrubáveis, para funcionar como culpado;
- pergunta com `requerQuebra` precisa depender de uma pergunta que seja derrubável;
- cruzamento precisa de dois vestígios existentes e distintos;
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

Separação que vale manter: `jogo/` e `mundo/` não tocam no DOM nem no canvas. É por isso que a verificação simula partidas inteiras no Node, incluindo entrar e sair dos prédios, interrogar e cruzar vestígios, sem navegador.

Detalhes que podem interessar depois:

- A grade é ortogonal; só o desenho é isométrico (`src/core/iso.js`). Editar mapa continua sendo editar uma matriz.
- O A* usa oito direções e exige os dois lados livres antes de cortar diagonal. A suavização de rota aplica a mesma regra: sem isso ela desfaz o cuidado da busca e o detetive atravessa o vão entre dois objetos encostados.
- A profundidade de desenho é `gx + gy`: móveis, vestígios e o detetive entram numa fila ordenada antes de desenhar.
- O depósito do progresso é injetável, então a verificação usa um em memória no lugar do localStorage.

## Acessibilidade

Estado honesto: **o jogo é completável só com teclado**, e isso é coberto por teste automatizado — há uma checagem que fecha o caso inteiro sem nenhuma chamada originada de clique. Setas ou WASD movem, `E` examina o que está por perto, e os painéis são navegáveis por Tab.

O que ainda **não** está resolvido, e não vou chamar de conforme:

- O canvas é um `role="img"` com rótulo fixo. Quem usa leitor de tela não tem como saber o que existe na cena; falta um espelho em texto do estado e uma lista navegável de alvos próximos.
- Não há armadilha de foco nos modais, e o foco não volta ao elemento de origem quando eles fecham.
- As letras de atalho (`C`, `F`, `L`, `G`, `N`, `E`) podem colidir com a navegação rápida de leitores de tela.
- Texto do HUD e do rodapé fica sobre o canvas em degradê transparente, então o contraste depende do que está desenhado atrás.
- A 200% de zoom ou abaixo de 400 px, HUD e rodapé se sobrepõem, porque o layout usa `overflow: hidden`.

Conformidade com WCAG AA exige teste manual com leitor de tela real e medição de contraste em captura; nada disso foi feito ainda.

## Arte e direitos

Todo o código e toda a arte são originais. Não há nenhum asset de terceiros no repositório: cenário, móveis, árvores e o detetive são geometria desenhada em tempo real no canvas. Nenhum arquivo de imagem, fonte ou som externo é carregado.

Como funciona: o chão é um losango preenchido; paredes e móveis são esse losango extrudado, com duas faces laterais sombreadas e um topo; o detetive é um conjunto de primitivas (elipse de sombra, polígono de sobretudo, círculo de cabeça, elipse de chapéu) com a caminhada vinda de um seno. Cores, altura e escala de cada peça ficam numa tabela em `src/mundo/tiles.js`, então mudar a aparência do jogo é mudar valores ali.

O Diablo entra só como referência de movimentação e enquadramento — a ideia de clicar no chão e o personagem caminhar até lá, em vista isométrica. Nada de conteúdo, dados, arte ou código daquele jogo é usado aqui.

O caso, os nomes, os depoimentos e os documentos são ficção escrita para este protótipo.

## Publicação

O site é estático e vai para o GitHub Pages pelo workflow em `.github/workflows/pages.yml`, que roda `npm run check` antes de publicar. O build padrão do Pages, que passa tudo pelo Jekyll, não é usado: o projeto não precisa dele e aquele caminho já travou por minutos baixando imagem de container.

## Próximos passos possíveis

- Espelho em texto da cena e lista navegável de alvos, fechando a lacuna de leitor de tela.
- Foco preso nos modais, com retorno ao elemento de origem.
- Cruzamentos que dependem de depoimento, não só de dois vestígios.
- Mais casos, em arquivo externo, para escrever roteiro sem mexer em código.
- Som ambiente e passos, sintetizados em WebAudio, mantendo o repositório sem assets.

## Licença

MIT. Veja `LICENSE`.
