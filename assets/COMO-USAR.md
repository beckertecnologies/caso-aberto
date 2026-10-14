# Onde colocar as imagens

Solte os arquivos aqui e rode `npm run assets`. O indexador varre estas pastas e
escreve o manifesto em `src/dados/visual.js`.

## Chão

```
assets/chao/<material>/qualquer-nome.png
```

Materiais aceitos: `asfalto`, `calcada`, `grama`, `tabua`, `ladrilho`, `tapete`.

Pode colocar **vários arquivos no mesmo material**. O jogo sorteia qual usar em
cada tile pela posição dela, então o chão varia sem repetir carimbo e sem mudar
a cada quadro.

As texturas podem ser **quadradas** (as do Retro Textures servem): o
renderizador projeta a imagem nos eixos da grade, então encaixa sem emenda em
qualquer tamanho de arquivo.

## Peças de cenário

```
assets/pecas/<id>.png
```

Ids aceitos: `parede`, `porta`, `sofa`, `mesa`, `estante`, `armario`, `cama`,
`escrivaninha`, `bancada`, `pia`, `banco`, `vaso`, `arvore`, `luminaria`.

Peças com interação (`pasta`, `jornal`, `passagem`, `registro`, `contorno`)
continuam procedurais de propósito: o brilho delas é o que avisa o jogador que
ali se pode clicar, e isso é informação de jogo.

Se um móvel ficar flutuando ou afundado no chão, ajuste `ancora` daquela peça em
`src/dados/visual.js` — é a fração da altura do sprite que fica sobre o centro
da tile. Maior sobe, menor desce. `escala` multiplica o tamanho.

## Importante

Antes de adicionar qualquer arquivo, leia `ASSETS.md` na raiz e registre a
origem e a licença. Só entra arte que permita redistribuição.
