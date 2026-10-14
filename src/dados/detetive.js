// Atlas do detetive — GERADO por `npm run detetive`.
//
// Não edite à mão: é reescrito a cada recorte. A origem é
// `assets/detetive/folha-original.png` e o recorte mora em
// `tools/recortar-detetive.mjs`, que explica as decisões.
//
// `giro` é quanto a figura está virada em relação a estar de frente para a
// câmera, em graus no sentido horário da tela. O renderizador escolhe a vista
// mais próxima do rumo do personagem e espelha quando precisa do outro lado —
// a prancha só tem metade das direções.

export const DETETIVE = {
  arquivo: 'detetive/caminhada.png',
  celula: { largura: 64, altura: 138 },
  /** Onde ficam os pés dentro da célula, em fração da altura. */
  ancora: 0.9855,
  /**
   * Altura do personagem em pixels de mundo. Um tile tem 64 de largura.
   *
   * Escolhido comparando com o acervo, não por gosto: a 62 px o detetive ficava
   * da altura da parede de pedra e não passaria pelo arco da porta. A 52 ele
   * fica abaixo da parede, o arco vence a cabeça dele e a estante bate no
   * ombro — as três proporções que o olho confere sem pensar.
   */
  alturaAlvo: 52,
  vistas: [
    { nome: 'frente', giro: 0, linha: 0, quadros: 8 },
    { nome: 'quarto', giro: 45, linha: 1, quadros: 7 },
    { nome: 'costasQuarto', giro: 135, linha: 2, quadros: 8 },
  ],
};
