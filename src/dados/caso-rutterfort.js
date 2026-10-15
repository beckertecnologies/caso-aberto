// CASO RUTTERFORT — a morte de Victor Rutterfort.
//
// Mesma estrutura do caso de exemplo: o gerador sorteia o culpado a cada
// partida, planta os vestígios dele, mistura pistas falsas de outros suspeitos
// e espalha tudo pelos locais. Mesma cidade, mesmo morto, caminhos diferentes.
//
// Seis suspeitos, todos da família ou do círculo de Victor, cada um com motivo
// de verdade — herança, dívida, humilhação, sociedade ameaçada. Cada um responde
// perguntas; uma resposta só cai quando o jogador tem em mãos o vestígio que a
// desmente.
//
// Os vestígios nascem nos locais que fazem sentido para a história: o escritório
// da Enlux, o banco, a casa de campo, os restaurantes da família, a zona boêmia
// onde Fernan some, a delegacia e o laboratório forense com os laudos.

export const CASO_RUTTERFORT = {
  id: 'caso-rutterfort',
  titulo: 'A morte de Victor Rutterfort',
  resumo:
    'Victor Rutterfort, 80 anos, magnata da construção em Omega City, foi encontrado morto. ' +
    'Às vésperas de um casamento que mexeria com a herança, não falta a ninguém da família um motivo. ' +
    'Seis pessoas do círculo mais próximo serão ouvidas.',

  vitima: {
    nome: 'Victor Rutterfort',
    idade: 80,
    ocupacao: 'empresário da construção civil, dono da Enlux e da Borix',
  },

  suspeitos: [
    {
      id: 'luca',
      nome: 'Luca Rutterfort',
      relacao: 'filho mais velho, diretor financeiro da Enlux',
      alibi: 'Diz que ficou até tarde no escritório, fechando o trimestre sozinho.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite em que seu pai morreu?',
          resposta:
            'No escritório da Enlux, fechando o balanço do trimestre. Sozinho, até depois da meia-noite. ' +
            'Trabalho é o que não me falta desde que meu pai passou a aparecer menos.',
          contradizPor: ['lu3', 'lu1'],
          reacao:
            'Ele afrouxa a gravata. "Está bem. Saí antes do que disse. Precisava falar com meu pai sobre ' +
            'uma conta que não fechava, e fui vê-lo. Mas ele estava vivo quando eu saí."',
        },
        {
          id: 'dinheiro',
          texto: 'Houve retiradas altas na empresa. Você sabe explicá-las?',
          resposta:
            'Movimento normal de caixa. Uma construtora desse porte move muito dinheiro, isso não quer ' +
            'dizer nada.',
          contradizPor: ['lu2'],
          reacao:
            'Ele encara o extrato. "Eu cobri um buraco meu com dinheiro da empresa. Ia repor. Meu pai ' +
            'descobriu na semana passada e disse que ia me tirar da diretoria."',
        },
        {
          id: 'relacao',
          texto: 'Como estava sua relação com Victor ultimamente?',
          resposta:
            'Eu era o braço direito dele. Fazia o que ele não tinha mais fôlego para fazer. Se havia atrito, ' +
            'era de trabalho.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'casamento',
          requerQuebra: 'onde',
          texto: 'Você foi vê-lo. O casamento com Lorena entrou na conversa?',
          resposta:
            'Entrou. Eu disse que aquele casamento ia partir a herança em pedaços e sacrificar a empresa que ' +
            'eu ajudei a segurar. Ele riu. Foi a última vez que ouvi meu pai rir.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'fernan',
      nome: 'Fernan Rutterfort',
      relacao: 'segundo filho, advogado da família',
      alibi: 'Garante que passou a noite num clube da zona boêmia, longe do pai.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava naquela noite?',
          resposta:
            'Na Boêmia, como quase toda noite. Comecei num bar, terminei num clube. Metade da cidade me viu, ' +
            'ainda que ninguém lembre direito.',
          contradizPor: ['fe3'],
          reacao:
            'Ele ri sem graça. "O táxi me levou para a casa de campo, não para o clube. Eu queria falar com ' +
            'meu pai antes que fosse tarde. Cheguei bêbado e... não sei direito o que disse."',
        },
        {
          id: 'dinheiro',
          texto: 'Você devia dinheiro a pessoas perigosas?',
          resposta:
            'Quem não deve? Eu resolvo as minhas contas. Meu pai nunca precisou cobrir nada por mim.',
          contradizPor: ['fe1', 'fe2'],
          reacao:
            'O bilhete de cobrança fica na mesa entre os dois. "Pedi a ele. Uma última vez. Ele disse que ' +
            'eu tinha virado um buraco sem fundo e que não daria mais um centavo."',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com seu pai?',
          resposta:
            'Ele me tolerava. Me dava um cargo de fachada e um salário para eu não dar escândalo. A gente ' +
            'se entendia dentro disso.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'noite',
          requerQuebra: 'onde',
          texto: 'Você chegou à casa de campo. O que aconteceu lá?',
          resposta:
            'Nós discutimos. Alto. Ele me mandou embora e eu fui. Juro que ele estava de pé, gritando, ' +
            'quando a porta bateu nas minhas costas. Não me lembro de mais nada até acordar no carro.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'ruben',
      nome: 'Ruben Rutterfort',
      relacao: 'terceiro filho, arquiteto',
      alibi: 'Afirma que estava num jantar da prefeitura e voltou direto para casa.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite do crime?',
          resposta:
            'Num jantar de trabalho, parceria da Enlux com a prefeitura. Saí tarde e fui para casa. ' +
            'Dormir, só isso.',
          contradizPor: ['ru3'],
          reacao:
            'Ele hesita. "O jantar acabou cedo. Eu passei na casa dele depois. Precisava olhá-lo na cara ' +
            'depois do que ele me fez na frente do advogado."',
        },
        {
          id: 'segredo',
          texto: 'O que seu pai descobriu sobre você?',
          resposta:
            'Isso é assunto meu, e não vejo o que tem a ver com a morte dele.',
          contradizPor: ['ru1'],
          reacao:
            'Ele lê o relatório do investigador e empurra a folha para longe. "Ele contratou um homem para ' +
            'me seguir. Me obrigou a admitir quem eu sou numa reunião, como se fosse um defeito contábil. ' +
            'Eu odiei meu pai naquele dia. Odiar não é matar."',
        },
        {
          id: 'relacao',
          texto: 'Como estava a relação de vocês?',
          resposta:
            'Profissional. A gente trabalhava bem junto nos projetos. Fora disso, pouco.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'visita',
          requerQuebra: 'onde',
          texto: 'Você passou lá depois do jantar. Para quê?',
          resposta:
            'Para dizer que eu ia sair da empresa e da cidade. Ele não me levou a sério. Disse que eu voltaria ' +
            'rastejando. Saí sem bater a porta — eu não queria dar a ele nem isso.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'margot',
      nome: 'Margot Rutterfort',
      relacao: 'filha, chef do restaurante Luppios',
      alibi: 'Diz que fechou o restaurante e foi para casa, sozinha.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava naquela noite?',
          resposta:
            'No Luppios até o último cliente sair, depois em casa. Cozinha é meu dia inteiro, não me sobra ' +
            'noite para mais nada.',
          contradizPor: ['ma3'],
          reacao:
            'Ela aperta o pano de prato nas mãos. "Fechei mais cedo. Encontrei uma pessoa. Não vou dizer quem, ' +
            'mas não foi meu pai, e não foi para brigar."',
        },
        {
          id: 'relacionamento',
          texto: 'Seu pai sabia do seu relacionamento com Lourent Piek?',
          resposta:
            'Não existe relacionamento nenhum. O Lourent toca o Cappios, eu toco o Luppios. Somos colegas.',
          contradizPor: ['ma1', 'ma2'],
          reacao:
            'Ela olha as fotos por um longo tempo. "Meu pai descobriu. Disse que eu ia pôr os dois ' +
            'restaurantes em escândalo e que ia me tirar do Luppios. O restaurante é a minha vida inteira."',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com Victor?',
          resposta:
            'Eu era a filha que deu certo aos olhos dele. Dava lucro, não dava trabalho. Ele gostava disso.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'ameaca',
          requerQuebra: 'relacionamento',
          texto: 'Ele ameaçou tirar o Luppios de você. O que você fez?',
          resposta:
            'Fui falar com ele. Pedi, implorei, chorei. Ele estava irredutível. Saí de lá arrasada, mas saí. ' +
            'Nunca levantaria a mão contra meu pai por causa de um restaurante.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'douglas',
      nome: 'Douglas Loyd',
      relacao: 'sócio da Enlux e da Borix',
      alibi: 'Conta que estava num jantar de negócios do outro lado da cidade.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite em que Victor morreu?',
          resposta:
            'Jantar de negócios no Hotel de Luxo, com investidores. Dezenas de pessoas podem confirmar. ' +
            'Eu sou a última pessoa sem álibi nesta cidade.',
          contradizPor: ['do3'],
          reacao:
            'Ele perde um pouco da compostura. "Saí do jantar no meio. Recebi uma ligação do Victor, furioso. ' +
            'Fui vê-lo. Negócio é negócio, mesmo tarde da noite."',
        },
        {
          id: 'sociedade',
          texto: 'O casamento de Victor afetava a sociedade de vocês?',
          resposta:
            'Casamento é vida pessoal dele. A sociedade é blindada por contrato. Uma coisa não toca a outra.',
          contradizPor: ['do1', 'do2'],
          reacao:
            'Ele encara o aditivo contratual. "Com Lorena no caminho, a parte dele passava a ela, não a mim. ' +
            'Vinte anos de sociedade iam para a mão de uma mulher que ele conhecia há seis meses. Sim, isso ' +
            'me tirava o chão. Mas eu ia brigar no tribunal, não assim."',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com Victor?',
          resposta:
            'Fomos sócios por vinte anos. A gente discutia como todo sócio, mas havia respeito e lealdade.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'balsa',
          requerQuebra: 'onde',
          texto: 'Você foi vê-lo. Como chegou e como voltou?',
          resposta:
            'A balsa é minha metade da Borix, eu uso quando quero. Fui e voltei pela água, fora do horário ' +
            'normal. Por isso ninguém me viu no caminho. Não é crime pegar a própria balsa.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'lorena',
      nome: 'Lorena Pitts',
      relacao: 'noiva de Victor',
      alibi: 'Diz que estava em casa, esperando Victor para o jantar que ele faltou.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava naquela noite?',
          resposta:
            'Em casa, esperando o Victor. A gente ia jantar. Ele não apareceu e não atendia. Pensei que fosse ' +
            'trabalho, como sempre. Dormi esperando.',
          contradizPor: ['lo3'],
          reacao:
            'Ela desvia o olhar. "Cansei de esperar e fui até ele. A casa estava com a luz acesa. Eu entrei. ' +
            'Mas quando cheguei... quando cheguei já era tarde. Eu me assustei e fui embora sem chamar ninguém. ' +
            'Sei como isso parece."',
        },
        {
          id: 'casamento',
          texto: 'Por que o casamento foi marcado tão depressa?',
          resposta:
            'Porque nos amamos. Sei que as pessoas falam que é dinheiro, mas elas falariam de qualquer forma.',
          contradizPor: ['lo1', 'lo2'],
          reacao:
            'O rascunho do testamento fica entre os dois. "Ele quis me incluir. Foi ideia dele, não minha. ' +
            'Eu nem sabia o tamanho da fortuna dele até ver isso. Juro que não casei por isso."',
        },
        {
          id: 'relacao',
          texto: 'Como era a relação de vocês de verdade?',
          resposta: 'Boa. Ele era gentil comigo, generoso. Me tratava como ninguém nunca tratou.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'cena',
          requerQuebra: 'onde',
          texto: 'Você esteve lá e viu o corpo. O que mais viu?',
          resposta:
            'Havia duas taças. Ele tinha recebido alguém antes de mim, estou certa disso. E a porta dos fundos ' +
            'estava aberta, batendo com o vento. Eu não toquei em nada. Só fugi.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
  ],

  // Vestígios que apontam para alguém, três por suspeito. `locais` prende cada
  // um a cenas onde o texto faça sentido.
  acervo: [
    // --- Luca: desvio na empresa, briga pela herança ---
    {
      id: 'lu1',
      locais: ['escritorio'],
      nome: 'Bilhete de demissão rasgado',
      tipo: 'documento',
      aponta: 'luca',
      texto:
        'Metade de um comunicado interno, com a letra de Victor: "...afastado da diretoria por quebra de ' +
        'confiança, a contar desta data". O nome no papel é o de Luca.',
    },
    {
      id: 'lu2',
      locais: ['escritorio', 'banco'],
      nome: 'Extrato com retiradas',
      tipo: 'documento',
      aponta: 'luca',
      texto:
        'Três saques altos da conta da Enlux em dinheiro, sem contrapartida. A autorização dos três tem a ' +
        'assinatura de Luca, e nenhuma passou pelo conselho.',
    },
    {
      id: 'lu3',
      locais: ['escritorio', 'cidade'],
      nome: 'Cartão de acesso fora de hora',
      tipo: 'vestígio',
      aponta: 'luca',
      texto:
        'O registro eletrônico mostra o crachá de Luca deixando a Enlux às 22h10 — e não "depois da ' +
        'meia-noite", como ele disse. O resto da noite, o crachá não marca mais nada.',
    },

    // --- Fernan: dívida, resgate recusado ---
    {
      id: 'fe1',
      locais: ['clube-striptease', 'pub-portuario'],
      nome: 'Nota de dívida',
      tipo: 'documento',
      aponta: 'fernan',
      texto:
        'Um papel dobrado várias vezes, com um valor alto e um prazo vencido. No rodapé, à mão: ' +
        '"última vez, Fernan". Sem assinatura de quem cobra.',
    },
    {
      id: 'fe2',
      locais: ['casa-de-campo'],
      nome: 'Pedido negado',
      tipo: 'vestígio',
      aponta: 'fernan',
      texto:
        'Mensagem de voz de ontem: a voz arrastada de Fernan pede dinheiro ao pai "uma última vez". ' +
        'A resposta de Victor, curta, é um não.',
    },
    {
      id: 'fe3',
      locais: ['casa-de-campo', 'cidade'],
      nome: 'Corrida de táxi',
      tipo: 'documento',
      aponta: 'fernan',
      texto:
        'Recibo de táxi da noite do crime: destino registrado é a casa de campo dos Rutterfort, não a ' +
        'Boêmia. Horário de chegada compatível com a hora da morte.',
    },

    // --- Ruben: humilhação, segredo exposto ---
    {
      id: 'ru1',
      locais: ['tribunal', 'cartorio'],
      nome: 'Relatório do investigador',
      tipo: 'documento',
      aponta: 'ruben',
      texto:
        'Dossiê de um detetive particular contratado por Victor, com fotos e datas. O alvo é Ruben. ' +
        'Na capa, a letra de Victor: "resolver em família, com o Dr. Donte".',
    },
    {
      id: 'ru2',
      locais: ['casa-de-campo'],
      nome: 'Lápis de arquiteto',
      tipo: 'objeto',
      aponta: 'ruben',
      texto:
        'Lapiseira técnica cara, do tipo que Ruben usa nos projetos, caída perto da porta. ' +
        'A grafite está quebrada, como se tivesse caído de um bolso numa saída apressada.',
    },
    {
      id: 'ru3',
      locais: ['prefeitura', 'casa-de-campo'],
      nome: 'Lista de presença do jantar',
      tipo: 'documento',
      aponta: 'ruben',
      texto:
        'A lista do jantar da prefeitura marca a saída de Ruben às 21h30 — cedo. Ele disse ter saído tarde. ' +
        'Entre 21h30 e a hora da morte, ninguém sabe onde ele esteve.',
    },

    // --- Margot: romance proibido, ameaça ao restaurante ---
    {
      id: 'ma1',
      locais: ['trattoria', 'bistro'],
      nome: 'Fotos de Margot e Lourent',
      tipo: 'documento',
      aponta: 'margot',
      texto:
        'Fotografias dos dois juntos, tiradas de longe, as mesmas do dossiê que Victor guardava. ' +
        'Lourent é casado; Margot sempre negou o caso.',
    },
    {
      id: 'ma2',
      locais: ['trattoria'],
      nome: 'Carta de rompimento',
      tipo: 'documento',
      aponta: 'margot',
      texto:
        'Rascunho na letra de Victor, endereçado a Margot: ele exige o fim do caso com Lourent e ameaça ' +
        'passar o Luppios para outra pessoa. A carta não chegou a ser enviada.',
    },
    {
      id: 'ma3',
      locais: ['casa-de-campo', 'trattoria'],
      nome: 'Faca de cozinha fora do lugar',
      tipo: 'objeto',
      aponta: 'margot',
      texto:
        'Uma faca de chef, de um jogo igual ao do Luppios, encontrada longe de qualquer cozinha. ' +
        'Limpa demais, como se tivesse sido lavada com pressa.',
    },

    // --- Douglas: sociedade ameaçada pelo casamento ---
    {
      id: 'do1',
      locais: ['escritorio', 'cartorio'],
      nome: 'Aditivo contratual',
      tipo: 'documento',
      aponta: 'douglas',
      texto:
        'Minuta de alteração da sociedade: com o casamento, a parte de Victor na Enlux e na Borix passaria ' +
        'a Lorena. A margem tem rabiscos nervosos de outra caligrafia que não a de Victor.',
    },
    {
      id: 'do2',
      locais: ['cais-do-porto', 'cidade'],
      nome: 'Registro da balsa',
      tipo: 'vestígio',
      aponta: 'douglas',
      texto:
        'O diário de bordo da balsa da Borix mostra uma travessia fora de horário na noite do crime, ' +
        'autorizada pelo sócio. O nome do operador foi deixado em branco.',
    },
    {
      id: 'do3',
      locais: ['hotel-de-luxo'],
      nome: 'Conta do jantar interrompido',
      tipo: 'documento',
      aponta: 'douglas',
      texto:
        'A conta do jantar de negócios no hotel foi fechada no meio, bem antes do fim. Douglas assinou a ' +
        'saída e não voltou. O horário bate com a janela da morte.',
    },

    // --- Lorena: casamento súbito, herança ---
    {
      id: 'lo1',
      locais: ['cartorio', 'banco'],
      nome: 'Rascunho de testamento',
      tipo: 'documento',
      aponta: 'lorena',
      texto:
        'Minuta não assinada em que Victor inclui Lorena como herdeira principal, acima dos filhos. ' +
        'A data é de poucos dias antes da morte.',
    },
    {
      id: 'lo2',
      locais: ['hotel-de-luxo', 'cartorio'],
      nome: 'Contrato pré-nupcial',
      tipo: 'documento',
      aponta: 'lorena',
      texto:
        'Um pré-nupcial em que Lorena abriria mão de tudo em caso de divórcio — mas não em caso de morte. ' +
        'A cláusula de viuvez está destacada a caneta.',
    },
    {
      id: 'lo3',
      locais: ['casa-de-campo'],
      nome: 'Lenço com perfume',
      tipo: 'objeto',
      aponta: 'lorena',
      texto:
        'Um lenço de seda com o perfume que Lorena usa, caído perto do corpo. Ela jurou que passou a noite ' +
        'inteira em casa, esperando.',
    },
  ],

  // Contexto: valem para qualquer culpado, firmam o quadro.
  contexto: [
    {
      id: 'cx1',
      locais: ['casa-de-campo'],
      nome: 'Relógio de pêndulo parado',
      tipo: 'vestígio',
      aponta: null,
      texto: 'O relógio de pêndulo da sala parou às 23h40, com o pêndulo preso. Firma a hora provável.',
    },
    {
      id: 'cx2',
      locais: ['casa-de-campo'],
      nome: 'Porta dos fundos aberta',
      tipo: 'vestígio',
      aponta: null,
      texto: 'A porta de serviço dos fundos estava destrancada por dentro, batendo com o vento da noite.',
    },
    {
      id: 'cx3',
      locais: ['laboratorio-forense', 'casa-de-campo'],
      nome: 'Taça com resíduo',
      tipo: 'objeto',
      aponta: null,
      texto: 'Uma das duas taças tem resíduo turvo no fundo. A perícia encontra sedativo em dose alta.',
    },
    {
      id: 'cx4',
      locais: ['casa-de-campo', 'escritorio'],
      nome: 'Agenda com folha arrancada',
      tipo: 'documento',
      aponta: null,
      texto:
        'A folha do dia foi arrancada da agenda de Victor. O sulco na página seguinte marca um encontro às 23h.',
    },
  ],

  // Cruzamentos: dedução que nasce de dois vestígios juntos.
  cruzamentos: [
    {
      id: 'cracha-e-hora',
      exige: ['cx1', 'lu3'],
      aponta: 'luca',
      titulo: 'O crachá e a hora não combinam',
      texto:
        'O relógio parou às 23h40. O crachá de Luca deixou a Enlux às 22h10, cedo demais para o álibi dele ' +
        'de "virar a noite no escritório" — e com tempo de sobra para chegar à casa de campo antes da hora.',
    },
    {
      id: 'taxi-e-sedativo',
      exige: ['fe3', 'cx3'],
      aponta: 'fernan',
      titulo: 'O táxi e a taça',
      texto:
        'O recibo põe Fernan na casa de campo, não na Boêmia. A taça com sedativo mostra que a morte não foi ' +
        'de rompante: alguém preparou a bebida. Bêbado ou não, Fernan esteve lá na hora certa.',
    },
    {
      id: 'balsa-e-fundos',
      exige: ['do2', 'cx2'],
      aponta: 'douglas',
      titulo: 'Entrou pela água e saiu pelos fundos',
      texto:
        'A balsa cruzou fora de horário, autorizada pelo sócio. A porta dos fundos ficou aberta por dentro. ' +
        'Quem chegou pela água e conhecia a casa não precisou forçar nenhuma entrada.',
    },
    {
      id: 'perfume-e-cena',
      exige: ['lo3', 'cx3'],
      aponta: 'lorena',
      titulo: 'Esteve mais perto do que admitiu',
      texto:
        'O lenço com o perfume de Lorena caiu perto do corpo, e a segunda taça com sedativo prova que a ' +
        'vítima brindou com alguém antes de morrer. Lorena jurou que não saiu de casa — o lenço diz o contrário.',
    },
    {
      id: 'segredo-e-lapis',
      exige: ['ru1', 'ru2'],
      aponta: 'ruben',
      titulo: 'A humilhação e a saída apressada',
      texto:
        'O dossiê mostra o que Victor fez a Ruben dias antes. A lapiseira quebrada perto da porta mostra uma ' +
        'saída às pressas. O motivo e a presença se encontram no mesmo cômodo.',
    },
    {
      id: 'carta-e-faca',
      exige: ['ma2', 'ma3'],
      aponta: 'margot',
      titulo: 'A ameaça e a lâmina',
      texto:
        'A carta não enviada ameaçava tirar o Luppios de Margot. A faca de chef, de um jogo igual ao do ' +
        'restaurante dela, apareceu longe de qualquer cozinha. A ameaça dava o motivo; a faca, o meio.',
    },
    {
      id: 'heranca-cruzada',
      exige: ['lo1', 'do1'],
      aponta: null,
      titulo: 'A herança move dois',
      texto:
        'O testamento punha Lorena acima dos filhos; o aditivo passava a sociedade a ela. A mesma assinatura ' +
        'que enriquecia a noiva tirava o chão do sócio. O dinheiro aponta para dois lados — amplia o motivo, ' +
        'não fecha o nome.',
    },
  ],

  // Documentos fixos. `cena` diz onde ficam; `alvo` separa o corpo das pastas.
  documentos: [
    {
      id: 'jornal',
      cena: 'cidade',
      alvo: 'pasta',
      titulo: 'Jornal da manhã',
      cabecalho: 'Omega City Herald — primeira página',
      texto:
        'MAGNATA DA CONSTRUÇÃO É ENCONTRADO MORTO\n\n' +
        'Victor Rutterfort, 80 anos, um dos homens mais ricos de Omega City, foi encontrado sem vida. ' +
        'A polícia trata o caso como morte a esclarecer e não confirma a causa.\n\n' +
        'A notícia chega a poucos dias do anúncio de seu casamento com a socialite Lorena Pitts, união que, ' +
        'segundo fontes, dividiu a família. Rutterfort deixa quatro filhos e um império que inclui a Enlux ' +
        'Construtora e a Borix, responsável pela balsa até a ilha de Rosário.\n\n' +
        'A reportagem apurou que todos os familiares próximos serão ouvidos.',
    },
    {
      id: 'corpo',
      cena: 'casa-de-campo',
      alvo: 'corpo',
      titulo: 'Marcação da vítima',
      cabecalho: 'Observação direta — posição do corpo',
      texto:
        'O contorno marca onde Victor Rutterfort foi encontrado, caído junto à poltrona da sala principal ' +
        'da casa de campo.\n\nNão há sinal de luta. O roupão vinho está em ordem, os anéis permanecem nos ' +
        'dedos. Quem esteve aqui era esperado, ou entrou sem precisar forçar nada.',
    },
    {
      id: 'boletim',
      cena: 'delegacia',
      alvo: 'pasta',
      titulo: 'Boletim de ocorrência',
      cabecalho: 'Delegacia de Omega City — registro R-001',
      texto:
        'Chamado recebido pela manhã, após um dos empregados encontrar o patrão sem vida.\n\n' +
        'Nenhum sinal de arrombamento na entrada principal. Nada de valor foi levado: anéis, relógios e ' +
        'a coleção de arte estavam intactos.\n\n' +
        'Seis pessoas do círculo próximo apresentaram versões sobre a noite. Nenhuma pôde ser confirmada ' +
        'por terceiros.',
    },
    {
      id: 'laudo',
      cena: 'laboratorio-forense',
      alvo: 'pasta',
      titulo: 'Laudo preliminar',
      cabecalho: 'Laboratório Forense de Omega City — resumo',
      texto:
        'Horário provável do óbito entre 23h e 0h30.\n\n' +
        'Exame de sangue com sedativo em concentração alta, incompatível com uso terapêutico. ' +
        'A hipótese de a substância ter sido diluída em bebida segue aberta.\n\n' +
        'Material colhido na cena aguarda confronto com os suspeitos. Até lá, o que for recolhido e ' +
        'confrontado com os depoimentos é o que sustenta o inquérito.',
    },
    {
      id: 'sociedade',
      cena: 'escritorio',
      alvo: 'pasta',
      titulo: 'Papéis da Enlux',
      cabecalho: 'Enlux Construtora — documentação societária',
      texto:
        'A Enlux ia bem nos números, mas o caixa mostrava retiradas altas e sem explicação nas últimas ' +
        'semanas.\n\nHá uma minuta de alteração da sociedade engatilhada, ligada ao casamento de Victor, ' +
        'que mudaria quem herda a parte dele.\n\nUma anotação a lápis, na letra da vítima, repete duas vezes: ' +
        '"isto para quando eu não estiver mais aqui".',
    },
    {
      id: 'cartorio-doc',
      cena: 'cartorio',
      alvo: 'pasta',
      titulo: 'Registros de Victor',
      cabecalho: 'Cartório de Registro — pasta Rutterfort',
      texto:
        'Dão entrada no cartório, na mesma semana: um rascunho de testamento incluindo Lorena acima dos ' +
        'filhos, e um pré-nupcial com cláusula de viuvez destacada.\n\n' +
        'Consta ainda um pedido de investigação particular arquivado pela própria vítima, cujo conteúdo ' +
        'não foi anexado.\n\nTudo protocolado, nada ainda assinado em definitivo.',
    },
    {
      id: 'ouvidos',
      cena: 'delegacia',
      alvo: 'pasta',
      titulo: 'Termos de declaração',
      cabecalho: 'Delegacia de Omega City — pessoas ouvidas',
      texto:
        'Seis pessoas foram ouvidas: quatro filhos, o sócio e a noiva.\n\n' +
        'Nenhuma apresentou testemunha capaz de confirmar onde esteve entre 23h e 0h30. ' +
        'Todas tinham motivo ligado à herança, à empresa ou a algo que Victor sabia a seu respeito.\n\n' +
        'Observação do escrivão: as versões são plausíveis e isoladas. O inquérito depende de prova ' +
        'material que contradiga uma delas.',
    },
  ],

  composicao: {
    incriminam: 3,
    pistasFalsas: 3,
    contexto: 2,
  },

  minimoParaAcusar: 3,
  limiteDeTentativas: 2,
};
