# Origem e licença das imagens

Este arquivo registra de onde veio cada imagem em `assets/` e sob qual licença.
Manter isto em dia não é burocracia: sem o registro, daqui a alguns meses não há
como provar que o projeto pode ser publicado.

## Regra do projeto

Só entra arte que permita **redistribuição**, porque o repositório é público e
colocar um arquivo aqui já é redistribuí-lo.

| Licença | Serve? | Observação |
|---|---|---|
| CC0 / domínio público | sim | preferida, sem exigência de crédito |
| CC BY | sim | exige crédito nesta tabela |
| CC BY-NC | não | proíbe uso comercial |
| "free for personal use" | não | não permite redistribuir |
| Arte extraída de jogo comercial | não | continua sendo do titular original |

Nada de sprite extraído de jogo comercial, por mais fácil que seja de achar.
Hospedagem em site de terceiros não transfere propriedade.

## Imagens em uso

A arte procedural de `src/render/chao.js` e `src/render/renderizador.js` continua
no código e segue sendo a alternativa quando falta imagem — não é código morto: é
o que mantém o jogo inteiro de pé se um arquivo sumir ou se uma licença impedir a
redistribuição.

### chao/** e pecas/** — Kenney
- Pacotes: Isometric Miniature Library, Isometric Miniature Bases,
  Isometric Miniature Dungeon, Isometric Miniature Farm
- Autor: Kenney (kenney.nl)
- Licença: CC0 1.0 (domínio público)
- Uso: texturas de chão e as 205 peças de cenário do editor, cada uma nas quatro
  orientações (820 arquivos)

### detetive/folha-original.png e detetive/caminhada.png
- Origem: gerado por IA (Meshy) a pedido do autor do projeto
- Licença: **a confirmar** — ver a pendência abaixo
- Uso: o personagem jogável. `folha-original.png` é a prancha como saiu do
  gerador; `caminhada.png` é o atlas recortado por `npm run detetive`;
  `previa-recorte.png` serve só para conferir o recorte a olho.

> **Pendência de licença.** Arte gerada por IA deixa duas perguntas abertas que
> este arquivo não resolve sozinho:
>
> 1. **Os termos do serviço.** Plano gratuito e plano pago costumam dar direitos
>    diferentes sobre o que foi gerado, e há plano que libera só uso pessoal — o
>    que não bastaria aqui, porque o repositório é público e publicar o arquivo
>    já é redistribuí-lo. Vale conferir o plano usado antes de dar isto por
>    resolvido.
> 2. **Autoria.** Em várias jurisdições, imagem gerada sem intervenção humana
>    substancial não recebe proteção de direito autoral. Isso não impede usar,
>    mas impede reivindicar exclusividade.
>
> Nada disso trava o desenvolvimento, só uma publicação tranquila — então fica
> registrado em vez de esquecido. Se os termos não permitirem redistribuir, o
> caminho é trocar o personagem por arte CC0 ou voltar à figura geométrica.

Ao adicionar arquivos, registre aqui no formato:

```
### <pasta>/<arquivo>
- Pacote: <nome do pacote>
- Autor: <autor>
- Fonte: <URL>
- Licença: <licença>
- Uso: <onde aparece no jogo>
```

## Pacotes avaliados para este projeto

Todos do Kenney, todos **CC0**, uso comercial liberado, crédito não obrigatório:

- [Retro Textures Fantasy](https://kenney.nl/assets/retro-textures-fantasy) —
  115 texturas quadradas. Servem para o chão: o renderizador projeta a textura
  no losango por transformação de matriz, então encaixam sem emenda.
- [Isometric Miniature Library](https://kenney.nl/assets/isometric-miniature-library) —
  35 sprites isométricos, com mesas, cadeiras e estantes. Servem para as peças
  de cenário.
- A mesma família tem ainda Isometric Miniature **Dungeon**, **Farm**, **Bases**
  e **Prototype**. Preferir essa família ao misturar pacotes: mesmo autor e
  mesma direção de luz, que é o que mantém o cenário coerente.

Avaliados e **não** aplicáveis diretamente:

- [Retro Urban Kit](https://kenney.nl/assets/retro-urban-kit) e
  [Retro Fantasy Kit](https://kenney.nl/assets/retro-fantasy-kit) — são modelos
  3D, não sprites. Precisariam ser renderizados em quadros isométricos antes de
  entrar num canvas 2D. É a mesma técnica que gerou os pacotes "Isometric
  Miniature", mas é trabalho de Blender, não de código.

## Arte própria

O detetive, as formas geométricas de cenário e todas as texturas procedurais
são originais deste projeto, sob a mesma licença MIT do código.
