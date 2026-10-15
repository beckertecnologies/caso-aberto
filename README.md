# Caso Aberto

Protótipo de jogo de investigação em vista isométrica. Você é o detetive: circula pela cidade, entra nos locais do caso, recolhe vestígios, cruza o que encontra, ouve os suspeitos e pega um deles mentindo.

A movimentação é inspirada nos ARPG isométricos clássicos — clique no chão e o personagem traça a rota e contorna os obstáculos sozinho. O resto do jogo é outra coisa: não há combate, dungeon nem loot. O que se explora é uma cidade, e o que se acumula é prova.

> Protótipo em desenvolvimento. Um caso, uma cidade com dezenas de locais, mecânica fechada de ponta a ponta.

## Rodar

```bash
npm start
```

Abra `http://localhost:4300`. Não há dependências para instalar: o servidor usa só o Node (20.11 ou mais recente, por causa de `import.meta.dirname`) e o jogo roda em módulos ES nativos no navegador.

```bash
npm run editor
```

O editor de mundo, em `http://localhost:4400`. **Ele roda só na sua máquina, de propósito** — ver "O editor não vai ao ar" abaixo. Tutorial em "Modo editor".

```bash
npm run check
```

A verificação completa, em cinco passos:

| Passo | O que cobre |
|---|---|
| `tools/verificar.mjs` | mapas, navegabilidade com A*, coerência do roteiro, gerador em 240 sementes, interrogatório, cruzamentos, custo de errar, deslocamento, progresso salvo e partidas completas |
| `tools/fumaca.mjs` | monta um DOM mínimo, importa o `main.js` como o navegador faria e roda quadros de verdade — pega erro de renderizador, que a lógica não enxerga |
| `tools/editor.mjs` | as regras de edição: empilhamento por nível, borracha, giro das orientações, mensagens de validação, alinhamento do acervo |
| `tools/fumaca-editor.mjs` | o editor pelo caminho real: escolher peça, girar, pintar, apagar, conta-gotas, validar e salvar |
| `tools/detetive.mjs` | o atlas do personagem e o mapa das oito direções |

## Começo de partida: a cidade viva e o crime

Toda partida nova abre numa **fase de pré-crime**. A cidade está em movimento: dezenas de transeuntes de aparência aleatória andam pelas ruas e entram e saem dos prédios, e no meio deles circulam a vítima e os suspeitos. Nessa fase ainda não há o que investigar — nenhum vestígio no chão, nenhum relatório para ler.

Passados **30 segundos**, acontece o assassinato. A vítima deixa de aparecer na rua (foi para a casa de campo, onde o corpo é encontrado), as pistas nascem, os relatórios abrem e a investigação começa. O minimapa aponta em vermelho o caminho para a cena do crime.

Durante o pré-crime você anda à vontade; só as ações de investigação é que ficam travadas até o corpo aparecer.

## Como se joga

| Ação | Como |
|---|---|
| Caminhar | Clique no chão, ou setas / WASD |
| Examinar | Clique no objeto destacado, ou `E` para o que estiver por perto |
| Entrar num local | Clique na porta iluminada da fachada |
| Minimapa | `M` alterna entre o mapinha do canto e o mapa inteiro |
| Caderno de evidências | `C` |
| Ficha de suspeitos | `F` |
| Viagem rápida entre locais | `L` |
| Acusar | `G`, ou a mesa de registro da delegacia |
| Nova investigação | `N` |

Os pontos dourados são vestígios. A marcação no chão (o corpo), as pastas da perícia e a banca de jornal trazem os documentos do inquérito.

Quando um balão abre, a cena pausa até você fechá-lo. É deliberado: o texto de um vestígio é para ler, não para piscar na tela.

## O minimapa

O minimapa fica sempre ativo, no canto inferior direito, mostrando o chão ao redor do detetive, as saídas (azul) e os vestígios já visíveis (âmbar). A tecla `M` **alterna o tamanho**: do mapinha de canto para o **mapa inteiro**, numa caixa grande centralizada, para situar onde você está no mundo como um todo — se está perto do porto, da praia, da ilha. No mapa inteiro, passar o mouse sobre uma saída mostra o nome do lugar, e a saída que leva à cena do crime pisca em vermelho.

Para o mapa inteiro não repintar centenas de milhares de tiles por quadro, o chão é desenhado uma vez numa imagem e reaproveitado; só os pontos que se mexem (detetive, saídas) são redesenhados ao vivo.

## A cidade como praça central

O detetive nasce na cidade e circula por ela a pé. Nas fachadas ficam as portas iluminadas que levam a cada local do caso — escritório, banco, cartório, delegacia, laboratório, restaurantes, a casa de campo, e assim por diante. De dentro de qualquer local, a porta devolve para a rua.

Ao sair de um prédio você chega **na porta daquele prédio**, não no ponto de partida do mapa. Sem isso, voltar para a rua jogaria o jogador para longe e ele perderia a referência de onde estava.

A delegacia é local de serviço: não há vestígio lá, e sim a papelada do inquérito e a mesa de registro, onde a acusação é formalizada. O `L` abre a viagem rápida — conveniência, não o caminho principal.

## Onde cada vestígio pode aparecer

Vestígio tem endereço. Cada um declara em `locais` os lugares onde faz sentido existir, e o gerador respeita isso:

```js
{ id: 'lu1', nome: 'Bilhete de demissão rasgado', locais: ['escritorio'], ... }
{ id: 'lu2', nome: 'Extrato com retiradas', locais: ['escritorio', 'banco'], ... }
```

O motivo é simples: o texto nunca pode contradizer o cenário. Um recibo de disputa societária não fica no meio da calçada, e uma faca de cozinha não aparece numa sala de audiências.

Sem `locais`, o vestígio vai para qualquer local **fechado**. A rua (`cidade`) é marcada com `externo: true` e só recebe o que pedir por ela explicitamente.

## Interrogatório, contradições e cruzamentos

É o centro do jogo. Em **Suspeitos**, cada um tem um botão de interrogar. Você escolhe o que perguntar e ouve a resposta.

**Confrontar.** Você escolhe qualquer vestígio do caderno e joga na mesa. Se ele desmentir aquela resposta, a versão cai, o suspeito reage e a mentira fica registrada. Exemplo: Luca jura ter virado a noite no escritório; o registro do crachá saindo às 22h10 não deixa a versão de pé.

**Custo para errar.** Confrontar é aposta, não lista de acertos garantidos — a interface oferece todos os vestígios, inclusive os que não servem. Cada erro gasta uma tentativa, e depois de duas o suspeito **encerra a conversa** e não responde mais nesta investigação. Fechar um suspeito não trava o caso: acusar continua possível, só mais no escuro.

**Perguntas que se abrem.** Derrubar a versão de alguém sobre a noite do crime destrava uma pergunta nova, mais incisiva, que não existia antes. A conversa avança em vez de ser uma lista de três itens.

**Cruzamentos.** Dois vestígios juntos podem dizer o que nenhum diz sozinho. Com o relógio parado às 23h40 e o crachá das 22h10 no caderno, aparece a opção de cruzar, e sai uma dedução fechada sobre a janela de tempo. Cruzamentos entram como reforço do relato final; não são exigidos para o fechamento completo, porque parte deles depende de vestígios de contexto que o sorteio nem sempre planta.

As provas do culpado sempre entram na investigação, então a versão dele é sempre derrubável — desde que você ache o vestígio certo. Os inocentes recebem uma pista falsa cada, o que torna possível derrubar a versão de quem não fez nada. Faz parte: o peso tem que ser lido no conjunto.

O desfecho mede se você nomeou a pessoa certa, quantas provas dela tinha, quantas versões dela derrubou e quantas deduções sustentam o relato.

## O mistério é gerado, os mapas não

A cidade e os locais são sempre os mesmos. O que muda a cada partida é a dedução: o culpado é sorteado; os vestígios que o incriminam entram; pistas falsas são distribuídas em rodízio entre os inocentes, para que nenhum acumule prova suficiente para parecer culpado; vestígios de contexto fecham o quadro; e tudo é plantado respeitando a afinidade de local, equilibrando a carga.

A vítima é fixa (Victor Rutterfort); quem matou, como e onde é que são sorteados por semente. A semente aparece na barra superior e fica na URL (`#semente=corlun-48`), então uma partida específica pode ser repetida ou compartilhada.

## Progresso salvo

O jogo grava sozinho no navegador a cada avanço: vestígio recolhido, documento lido, versão derrubada, cruzamento feito, tentativa gasta, troca de local e desfecho. Ao reabrir, a investigação continua de onde parou (já na fase de investigação, com o crime consumado).

Só a sua trilha é salva; o mistério não, porque a semente já o reconstrói idêntico. Progresso de outra semente é ignorado, e "Nova investigação" apaga o save. Abrir uma URL com `#semente=` tem prioridade sobre o save.

As tentativas gastas também são salvas — senão recarregar a página devolveria confrontos e o custo de errar viraria enfeite.

## Modo editor

O editor de mundo é onde os locais são desenhados. Ele vive numa aplicação à parte, só na sua máquina.

### Como abrir

```bash
npm run editor
```

Abra `http://localhost:4400`. O jogo continua em `http://localhost:4300` (`npm start`) — são dois processos independentes. Ao salvar no editor, o jogo recarrega sozinho para pegar a versão nova.

### A tela, por regiões

- **Barra superior** — à esquerda, o seletor de **Local** (troca a cena em edição) e **Novo local**; no meio, **Largura/Altura** com **Aplicar** para redimensionar o mapa, e os controles de **Referência** (ver adiante); à direita, o indicador de **nível** e **zoom**, **Enquadrar** (mostra o mapa inteiro), **Limpar tudo**, **Validar** e **Salvar**. O selo "não salvo" avisa quando há alteração pendente.
- **Trilha (lateral esquerda)** — **Camada** (Chão ou Objetos), **Ferramenta**, **Modo cidade**, **Mapa** (atalhos de tamanho) e **Histórico** (Desfazer `Z` / Refazer `Y`).
- **Acervo (lateral direita)** — busca e grupos de peças, a peça selecionada com a orientação atual, a **Altura** (nível) da próxima peça, e as opções "bloqueia passagem" e "dar saída a local sem porta".
- **Rodapé** — a posição sob o cursor, os avisos, e a tira de ajuda com os atalhos.

### Ferramentas (teclas 1–6)

| Tecla | Ferramenta | O que faz |
|---|---|---|
| `1` | Pincel | pinta um tile por clique (chão ou objeto da peça escolhida) |
| `2` | Retângulo | preenche uma área arrastando |
| `3` | Prédio | marca "aqui vai um prédio" (um alfinete anônimo no mapa) |
| `4` | Borracha | apaga o que estiver no tile |
| `5` | Balde | preenche a região contígua de mesmo material |
| `6` | Estrada | clique no início e no fim; traça a via entre os dois com prévia |

### Camadas, altura e orientação

Há duas camadas: **Chão** (o terreno) e **Objetos** (paredes, móveis, passagens, marcações). `Tab` troca entre elas.

As peças empilham por **nível** de altura: `F` sobe, `V` desce, `X` volta ao nível 0. Cada tile guarda uma peça por nível, então pôr um telhado sobre uma parede não apaga a parede. `R` gira a peça; `Esc` solta a peça da mão e liga o modo de inspeção.

Com o botão direito você usa o **conta-gotas** (pega a peça sob o cursor). Botão do meio, ou `Shift` arrastando, move a vista; a roda dá zoom.

### Modo cidade

Pensado para desenhar grande e rápido: botões de material num clique (calçada, asfalto, grama, água…), tamanhos de pincel grossos e a marca de prédio. A água (`~`) é um tile não-andável, para a borda da ilha ler como litoral. A distribuição das cenas nas marcas de prédio é feita depois, por ferramenta de linha de comando (`tools/distribuir-cenas.mjs`).

### Imagem de referência ("papel manteiga")

Para calcar um traçado desenhado à mão: **Referência** liga/desliga a imagem (mantendo a posição), **Ajustar** deixa arrastá-la, escalá-la e girá-la, **Opacidade** controla a transparência e **Centralizar** recentraliza. A imagem fica por cima do mapa, semitransparente.

### Salvar e validar

**Validar** confere o mapa sem gravar. **Salvar** grava o arquivo da cena em `src/dados/` e dispara o recarregamento do jogo. Trocar de local ou criar um novo com alterações pendentes abre um aviso antes de descartar — ninguém perde um prédio inteiro sem confirmar.

## O editor não vai ao ar

O código do editor **está** no repositório, mas o site publicado só tem o jogo. Não é esquecimento: o editor grava arquivo em disco e depende de um processo Node (`editor-server.mjs`), e o GitHub Pages serve arquivo estático, sem runtime. Publicar a pasta faria o editor abrir, tentar o primeiro `fetch` e morrer com tela preta — pior do que não existir.

Quem clona o repositório tem o editor completo com `npm run editor`. Quem abre o link publicado joga.

O passo de publicação em `.github/workflows/pages.yml` monta a pasta do site a dedo, e `tools/conferir-site.mjs` confere o resultado **nas duas direções**: que está lá toda a arte que o jogo pede, e que não foi junto nada de ferramenta local. Essa conferência existe porque o jogo degrada em silêncio — sem textura ele cai na pintura procedural e segue jogável, então um `cp` esquecido subiria um site sem arte sem avisar ninguém.

O servidor do editor escuta só em `127.0.0.1`. Ele escreve nos arquivos do projeto sem pedir autenticação, o que é aceitável para ferramenta de mesa e não seria para nada exposto na rede — não o coloque atrás de um túnel nem mude o endereço de escuta.

## Editar os locais pelo arquivo

Os mapas são texto. Dá para editar no editor visual ou abrir qualquer `src/dados/cena-*.js` e trocar caracteres nas duas matrizes:

```
CHÃO                 OBJETOS
(espaço) vazio       .  nada           U  pia
w  tábua             #  parede         H  banco
t  ladrilho          d  passagem       P  vaso
c  tapete            S  sofá           Y  árvore
p  calçada           T  mesa           L  poste / luminária
a  asfalto           V  estante        O  marcação da vítima (corpo)
g  grama             A  armário        F  pasta da perícia
~  água (não-andável) B  cama          J  banca de jornal
                     D  escrivaninha   W  mesa de registro (acusação)
                     K  balcão         *  ponto de vestígio
                     M  marca de prédio X  onde o detetive chega
                     1 2 3  passagem
```

Passagens em caractere (`1`–`3`) têm destino no campo `ligacoes` da cena; a cidade usa passagens em lista (campo `passagens`), com destino e rótulo embutidos, sem limite de quantidade.

Cena sem nenhum `*` é local de serviço e o gerador a ignora ao plantar. Cena com `externo: true` só recebe vestígio que peça por ela.

Depois de editar, rode `npm run check`. Ele acusa linha de comprimento errado, caractere desconhecido, passagem sem destino, passagem sem volta, porta inalcançável a pé, ponto de vestígio dentro de parede, objeto de leitura sem documento e qualquer canto que o detetive não alcance.

### Ferramentas de mundo

Fora do editor visual, há utilitários de linha de comando para o mundo:

- `tools/montar-locais.mjs` — cria os esqueletos de cena a partir de uma lista de locais;
- `tools/distribuir-cenas.mjs` — distribui as cenas nas marcas de prédio da cidade;
- `tools/preparar-cenas-caso.mjs` — põe pontos de vestígio e objetos de leitura nas cenas que o caso usa;
- `tools/verificar-mundo.mjs` — confere a estrutura do mundo (sem amarrar ao caso);
- `tools/mapa-previa.mjs` — gera uma prévia do mapa.

## Editar o caso

`src/dados/caso-rutterfort.js` tem a vítima, os suspeitos com perguntas e contradições, o acervo com afinidade de local, os cruzamentos, os documentos por local e a composição de cada partida.

O que a verificação cobra de um caso:

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
  jogo/      detetive, NPCs e cidade viva, regras da investigação, gerador de mistério, progresso salvo
  render/    desenho da cena no canvas (inclui o minimapa e os NPCs)
  ui/        barra superior, caderno, suspeitos, interrogatório, deslocamento, acusação
  dados/     os locais e o caso
editor/      o editor de mundo (aplicação à parte, só local)
tools/       verificação, teste de fumaça e utilitários de mundo
```

Separação que vale manter: `jogo/` e `mundo/` não tocam no DOM nem no canvas. É por isso que a verificação simula partidas inteiras no Node, incluindo entrar e sair dos prédios, interrogar e cruzar vestígios, sem navegador.

Detalhes que podem interessar depois:

- A grade é ortogonal; só o desenho é isométrico (`src/core/iso.js`). Editar mapa continua sendo editar uma matriz.
- O A* usa oito direções e exige os dois lados livres antes de cortar diagonal. Os NPCs usam o mesmo A* com um teto de expansões, para a multidão não varrer a cidade inteira atrás de um destino inalcançável e travar o quadro.
- A profundidade de desenho é `gx + gy`: móveis, vestígios, NPCs e o detetive entram numa fila ordenada antes de desenhar.
- O chão só desenha os tiles visíveis na janela, e de muito longe amostra blocos chapados — é o que mantém a cidade grande fluida.
- O depósito do progresso é injetável, então a verificação usa um em memória no lugar do localStorage.

## Acessibilidade

Estado honesto: **o jogo é completável só com teclado**, e isso é coberto por teste automatizado — há uma checagem que fecha o caso inteiro sem nenhuma chamada originada de clique. Setas ou WASD movem, `E` examina o que está por perto, e os painéis são navegáveis por Tab.

O que ainda **não** está resolvido, e não vou chamar de conforme:

- O canvas é um `role="img"` com rótulo fixo. Quem usa leitor de tela não tem como saber o que existe na cena; falta um espelho em texto do estado e uma lista navegável de alvos próximos.
- Não há armadilha de foco nos modais, e o foco não volta ao elemento de origem quando eles fecham.
- As letras de atalho (`C`, `F`, `L`, `G`, `N`, `E`, `M`) podem colidir com a navegação rápida de leitores de tela.
- Texto do HUD e do rodapé fica sobre o canvas em degradê transparente, então o contraste depende do que está desenhado atrás.
- A 200% de zoom ou abaixo de 400 px, HUD e rodapé se sobrepõem, porque o layout usa `overflow: hidden`.

Conformidade com WCAG AA exige teste manual com leitor de tela real e medição de contraste em captura; nada disso foi feito ainda.

## Arte e direitos

Todo o código é original. Cenário, móveis, árvores, os NPCs e o detetive de reserva são geometria desenhada em tempo real no canvas — losango de chão, blocos extrudados para o volume, primitivas para as figuras, com a caminhada vinda de um seno. Cores, altura e escala de cada peça ficam numa tabela em `src/mundo/tiles.js`, então mudar a aparência do jogo é mudar valores ali.

O Diablo entra só como referência de movimentação e enquadramento — a ideia de clicar no chão e o personagem caminhar até lá, em vista isométrica. Nada de conteúdo, dados, arte ou código daquele jogo é usado aqui.

O caso, os nomes, os depoimentos e os documentos são ficção escrita para este protótipo.

> Nota: há assets (sprite do detetive e alguns pacotes) cuja licença ainda está sendo resolvida em `ASSETS.md`. Enquanto isso, o jogo publicado se mantém na arte procedural, e esses arquivos não entram no build do site.

## Publicação

O site é estático e vai para o GitHub Pages pelo workflow em `.github/workflows/pages.yml`, que roda `npm run check` antes de publicar. O build padrão do Pages, que passa tudo pelo Jekyll, não é usado: o projeto não precisa dele.

## Próximos passos possíveis

- Espelho em texto da cena e lista navegável de alvos, fechando a lacuna de leitor de tela.
- Foco preso nos modais, com retorno ao elemento de origem.
- Cruzamentos que dependem de depoimento, não só de dois vestígios.
- Mais casos, em arquivo externo, para escrever roteiro sem mexer em código.
- Som ambiente e passos, sintetizados em WebAudio, mantendo o repositório sem assets.

## Licença

MIT. Veja `LICENSE`.
