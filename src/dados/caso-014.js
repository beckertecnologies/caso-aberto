// CASO 014 — roteiro de exemplo, todo ficcional e original.
//
// Estrutura pensada para o gerador: o acervo tem vestígios que incriminam cada
// suspeito. A cada investigação o jogo escolhe um culpado, planta os vestígios
// dele, mistura algumas pistas falsas e espalha tudo entre os dois locais.
// Resultado: mesma cena, mesmo crime, caminhos de dedução diferentes.
//
// Cada suspeito responde três perguntas. Uma resposta só cai quando o jogador
// tem em mãos o vestígio que a desmente — é aí que a investigação deixa de ser
// contagem de pistas e passa a ser pegar alguém mentindo.

export const CASO_014 = {
  id: 'caso-014',
  titulo: 'Caso 014 — Rua das Acácias',
  resumo:
    'Augusto Vilar, 54 anos, foi encontrado sem vida na sala do apartamento 302 às 7h40. ' +
    'A porta estava trancada por dentro. Quatro pessoas tinham motivo e acesso ao andar.',

  vitima: {
    nome: 'Augusto Vilar',
    idade: 54,
    ocupacao: 'dono de uma pequena transportadora',
  },

  suspeitos: [
    {
      id: 'marcela',
      nome: 'Marcela Vidotti',
      relacao: 'ex-sócia da transportadora',
      alibi: 'Diz que passou a noite fechando o balanço no escritório, sozinha.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite de ontem?',
          resposta:
            'No escritório, fechando o balanço. Sozinha, das oito até passar da meia-noite. ' +
            'Ninguém me viu porque não havia mais ninguém lá.',
          contradizPor: ['m3', 'm1'],
          reacao:
            'Ela para de encarar o senhor. "Liguei, sim. Uma vez. Ele não quis conversar por telefone, ' +
            'então eu disse que resolveríamos naquela noite. Dito e feito, eu fui até lá."',
        },
        {
          id: 'apartamento',
          texto: 'Você entrou no apartamento 302 ontem?',
          resposta: 'Não ponho os pés naquele apartamento desde que desfizemos a sociedade.',
          contradizPor: ['m2'],
          reacao:
            '"Essa caneta pode ser de qualquer um", ela começa, e desiste no meio. ' +
            '"Está certo. Eu estive lá. Mas quando saí ele estava de pé, discutindo comigo."',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com Augusto?',
          resposta:
            'Péssima, e eu não vou fingir o contrário. Ele me tirou da empresa que eu ajudei a montar. ' +
            'Isso não quer dizer que eu faria o que você está pensando.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'saida',
          requerQuebra: 'onde',
          texto: 'Você admitiu que foi até lá. Que horas saiu?',
          resposta:
            'Antes das onze. E não fui a última: tinha gente no corredor quando eu peguei o elevador. ' +
            'Não vi quem era. Vi o vulto, e a luz do 301 acesa.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'heitor',
      nome: 'Heitor Bastos',
      relacao: 'zelador do edifício',
      alibi: 'Afirma que estava na portaria e não subiu depois das 22h.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite de ontem?',
          resposta:
            'Na portaria até as dez, como todo dia. Depois fui para casa, aqui mesmo, nos fundos. ' +
            'Está tudo anotado na folha de ponto.',
          contradizPor: ['h3'],
          reacao:
            'Ele olha a folha por um tempo longo. "Eu corrigi o horário porque errei na hora de anotar." ' +
            'A voz não acompanha a explicação.',
        },
        {
          id: 'apartamento',
          texto: 'Você entrou no apartamento 302 ontem?',
          resposta:
            'Só entro com autorização, e ontem ninguém me chamou. Nem tenho chave daquele apartamento.',
          contradizPor: ['h1', 'h2'],
          reacao:
            '"A chave era para o caso de emergência", ele diz. "Augusto já tinha ficado trancado para fora uma vez." ' +
            'Ele não explica por que a cópia não foi registrada.',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com Augusto?',
          resposta:
            'De respeito. Ele reclamava de tudo, mas pagava em dia. Para mim, isso basta.',
          contradizPor: [],
          reacao: '',
        },
        {
          id: 'corredor',
          requerQuebra: 'onde',
          texto: 'Se o horário está corrigido, você subiu. Viu alguém no andar?',
          resposta:
            'Subi para trocar uma lâmpada no corredor, foi só isso. A porta do 302 estava entreaberta e ' +
            'dava para ouvir duas vozes. Não quis me meter. Quando desci, já estava tudo quieto.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'renata',
      nome: 'Renata Khoury',
      relacao: 'vizinha do 301',
      alibi: 'Conta que dormiu cedo e só acordou com a sirene.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite de ontem?',
          resposta:
            'Em casa, no 301. Dormi cedo, umas nove e meia. Só acordei quando a sirene chegou, de manhã.',
          contradizPor: ['r3'],
          reacao:
            '"Uma taça não prova nada." Ela acende um cigarro e não olha para o copo. ' +
            '"Tomamos uma bebida, sim. Fui embora antes das onze."',
        },
        {
          id: 'apartamento',
          texto: 'Você entrou no apartamento 302 ontem?',
          resposta: 'Nunca entrei ali. A gente se cumprimentava no corredor e era isso.',
          contradizPor: ['r2'],
          reacao:
            'Ela encara a marca no piso. "Eu entrei para reclamar do barulho. Dois minutos, no máximo. ' +
            'Ele estava vivo quando eu saí."',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com Augusto?',
          resposta: 'Cordial. Vizinhança normal, sem atrito.',
          contradizPor: ['r1'],
          reacao:
            '"Sem atrito" é a parte que ela não consegue repetir depois de ler o próprio bilhete. ' +
            '"Ele punha música alta até três da manhã. Qualquer um perderia a paciência."',
        },
        {
          id: 'quem',
          requerQuebra: 'onde',
          texto: 'Você esteve com ele naquela noite. Quem mais passou pelo andar?',
          resposta:
            'Bateram na porta dele enquanto eu ainda estava lá, e ele me pediu para ir embora. ' +
            'Não abri a minha porta depois. Ouvi a discussão, e ela durou pouco.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
    {
      id: 'tiago',
      nome: 'Tiago Serra',
      relacao: 'irmão da vítima',
      alibi: 'Garante que estava em outra cidade e voltou de madrugada.',
      perguntas: [
        {
          id: 'onde',
          texto: 'Onde você estava na noite de ontem?',
          resposta:
            'Fora da cidade, resolvendo umas coisas. Só entrei de volta de madrugada, umas três da manhã.',
          contradizPor: ['t3'],
          reacao:
            'Ele vira o cupom de pedágio na mão. "Então eu cheguei mais cedo do que lembrava. ' +
            'Isso não me põe dentro do apartamento dele."',
        },
        {
          id: 'apartamento',
          texto: 'Você entrou no apartamento 302 ontem?',
          resposta: 'Não. Faz umas duas semanas que não vou lá.',
          contradizPor: ['t2'],
          reacao:
            'Ele reconhece o chaveiro antes de o senhor terminar a frase. "Deve ter caído outro dia." ' +
            'Em seguida corrige: "Ontem. Caiu ontem."',
        },
        {
          id: 'relacao',
          texto: 'Como era sua relação com Augusto?',
          resposta:
            'Éramos irmãos. Brigávamos como irmãos. Dinheiro nunca foi assunto entre a gente.',
          contradizPor: ['t1'],
          reacao:
            'A apólice fica entre os dois na mesa. "Ele quis fazer. Disse que era para me deixar tranquilo." ' +
            'Ele não explica a assinatura tremida.',
        },
        {
          id: 'porque',
          requerQuebra: 'onde',
          texto: 'Você chegou antes da meia-noite. Por que não procurou seu irmão?',
          resposta:
            'Porque eu procurei. Toquei a campainha e ninguém abriu, e o carro dele estava na garagem. ' +
            'Imaginei que estivesse dormindo. Fui embora e não contei isso a ninguém.',
          contradizPor: [],
          reacao: '',
        },
      ],
    },
  ],

  // Vestígios que apontam para alguém. Três por suspeito.
  //
  // `locais` diz onde o vestígio pode aparecer, e existe para o texto nunca
  // contradizer o cenário: "caída atrás do sofá" não pode surgir numa sala de
  // reuniões. Sem `locais`, o vestígio vai para qualquer local fechado — a rua
  // e outros locais abertos só recebem o que pedir por eles explicitamente.
  acervo: [
    {
      id: 'm1',
      nome: 'Recibo rasgado',
      tipo: 'documento',
      aponta: 'marcela',
      texto:
        'Metade de um recibo de R$ 48.000, datado de ontem. A assinatura de Marcela Vidotti está ' +
        'completa; a da vítima, interrompida no meio.',
    },
    {
      id: 'm2',
      locais: ['apto-302'], // o texto fala do sofá da sala
      nome: 'Caneta da transportadora',
      tipo: 'objeto',
      aponta: 'marcela',
      texto:
        'Caneta com o brinde antigo da empresa, daquelas que só Marcela ainda carregava. ' +
        'Caída atrás do sofá, longe de onde alguém escreveria.',
    },
    {
      id: 'm3',
      nome: 'Recado na secretária',
      tipo: 'vestígio',
      aponta: 'marcela',
      texto:
        'Mensagem gravada às 21h52: a voz de Marcela exige resolver "isso" naquela mesma noite, ' +
        'sem advogado no meio.',
    },
    {
      id: 'h1',
      locais: ['apto-302', 'cidade'], // a portaria fica na rua
      nome: 'Cópia de chave sem registro',
      tipo: 'objeto',
      aponta: 'heitor',
      texto:
        'Chave nova do 302, sem o número de controle que o zelador é obrigado a gravar em toda cópia. ' +
        'Só Heitor tinha a máquina.',
    },
    {
      id: 'h2',
      locais: ['apto-302', 'cidade'], // o par fica no armário da portaria
      nome: 'Luva de trabalho',
      tipo: 'vestígio',
      aponta: 'heitor',
      texto:
        'Uma luva de raspa, par do que fica no armário da portaria, com mancha escura no punho. ' +
        'A outra não foi encontrada.',
    },
    {
      id: 'h3',
      locais: ['cidade', 'escritorio'], // folha de ponto fica onde se registra expediente
      nome: 'Folha de ponto emendada',
      tipo: 'documento',
      aponta: 'heitor',
      texto:
        'A saída das 22h foi reescrita por cima de outro horário. A caligrafia da correção é a de Heitor.',
    },
    {
      id: 'r1',
      locais: ['apto-302'], // papel de carta do 301, vizinho de porta
      nome: 'Bilhete amassado',
      tipo: 'documento',
      aponta: 'renata',
      texto:
        'Papel de carta do 301: "a próxima reclamação vai ser na delegacia, e não vai ser minha". ' +
        'Assinado apenas com um R.',
    },
    {
      id: 'r2',
      locais: ['apto-302'], // o texto fala do ladrilho molhado
      nome: 'Marca de salto no ladrilho',
      tipo: 'vestígio',
      aponta: 'renata',
      texto:
        'Meia pegada de salto fino no piso molhado, número compatível com o calçado apreendido no 301.',
    },
    {
      id: 'r3',
      locais: ['apto-302'], // segunda taça na pia da vítima
      nome: 'Taça com batom',
      tipo: 'objeto',
      aponta: 'renata',
      texto:
        'Segunda taça na pia, com marca de batom no mesmo tom que Renata usava na noite anterior. ' +
        'A vítima não recebia visitas, segundo o irmão.',
    },
    {
      id: 't1',
      nome: 'Apólice recente',
      tipo: 'documento',
      aponta: 'tiago',
      texto:
        'Seguro de vida contratado há cinco semanas, com Tiago Serra como único beneficiário. ' +
        'A assinatura da vítima está tremida.',
    },
    {
      id: 't2',
      locais: ['apto-302'], // caiu entre o tapete e o rodapé da sala
      nome: 'Chaveiro com iniciais',
      tipo: 'objeto',
      aponta: 'tiago',
      texto:
        'Chaveiro de metal gasto com as iniciais T.S., caído entre o tapete e o rodapé.',
    },
    {
      id: 't3',
      locais: ['apto-302', 'escritorio', 'cidade'], // um cupom cabe em qualquer bolso
      nome: 'Comprovante de pedágio',
      tipo: 'vestígio',
      aponta: 'tiago',
      texto:
        'Cupom de pedágio de ontem, 22h31, na praça de entrada da cidade. ' +
        'Tiago jurou só ter voltado de madrugada.',
    },
  ],

  // Vestígios de contexto: valem para qualquer culpado e ajudam a fechar o quadro.
  contexto: [
    {
      id: 'c1',
      locais: ['apto-302'], // relógio de parede da sala onde o corpo estava
      nome: 'Relógio de parede parado',
      tipo: 'vestígio',
      aponta: null,
      texto: 'O relógio parou às 23h14, com o vidro rachado. Firma o horário provável do crime.',
    },
    {
      id: 'c2',
      locais: ['apto-302'], // o trinco é da cozinha do apartamento
      nome: 'Janela destrancada',
      tipo: 'vestígio',
      aponta: null,
      texto:
        'O trinco da janela da cozinha está solto por dentro. Dá para alcançar a escada de serviço por ali.',
    },
    {
      id: 'c3',
      nome: 'Copo com resíduo',
      tipo: 'objeto',
      aponta: null,
      texto: 'Resto de um líquido turvo no fundo do copo. A perícia aponta sedativo em dose alta.',
    },
    {
      id: 'c4',
      nome: 'Agenda com página arrancada',
      tipo: 'documento',
      aponta: null,
      texto:
        'A folha de ontem foi arrancada. O sulco na folha seguinte mostra um compromisso marcado para 23h.',
    },
  ],

  // Cruzamentos: dedução que nasce de dois vestígios juntos e que nenhum dos
  // dois entrega sozinho. Só aparece quando os dois estão no caderno, e como o
  // sorteio não planta tudo em toda investigação, alguns cruzamentos nem existem
  // em determinada partida.
  cruzamentos: [
    {
      id: 'hora-da-chegada',
      exige: ['c1', 't3'],
      aponta: 'tiago',
      titulo: 'A hora da chegada fecha',
      texto:
        'O relógio parou às 23h14. O cupom de pedágio marca 22h31 na entrada da cidade. ' +
        'Quarenta e três minutos é tempo mais que suficiente para atravessar a cidade e subir até o 302 — ' +
        'e põe Tiago Serra na rua certa na hora errada.',
    },
    {
      id: 'entrada-de-servico',
      exige: ['c2', 'h2'],
      aponta: 'heitor',
      titulo: 'Entrou por onde ninguém olha',
      texto:
        'O trinco da janela da cozinha está solto por dentro, e dali se alcança a escada de serviço. ' +
        'A luva de raspa encontrada é par do que fica na portaria. ' +
        'Não houve arrombamento porque não foi preciso: a entrada é de quem conhece o prédio.',
    },
    {
      id: 'bebida-para-dois',
      exige: ['c3', 'r3'],
      aponta: 'renata',
      titulo: 'A bebida foi servida para dois',
      texto:
        'O copo tem resíduo de sedativo em dose alta. A segunda taça na pia tem marca de batom. ' +
        'A vítima não recebia visitas, segundo o irmão, mas alguém brindou com ela naquela noite — ' +
        'e esse alguém saiu sem lavar a própria taça.',
    },
    {
      id: 'compromisso-das-23',
      exige: ['c4', 'm3'],
      aponta: 'marcela',
      titulo: 'O compromisso apagado',
      texto:
        'A folha arrancada da agenda marcava algo às 23h, e o sulco na página seguinte prova o horário. ' +
        'O recado das 21h52 exigia resolver a pendência naquela mesma noite, sem advogado. ' +
        'O compromisso que a vítima apagou tinha sido marcado por Marcela Vidotti.',
    },
    {
      id: 'dinheiro-em-dois-sentidos',
      exige: ['m1', 't1'],
      aponta: null,
      titulo: 'Dinheiro em dois sentidos',
      texto:
        'Um recibo de R$ 48.000 com a assinatura da vítima interrompida no meio, e um seguro de vida ' +
        'contratado cinco semanas antes em nome do irmão. ' +
        'A vítima devia de um lado e valia mais morta do outro. Isso amplia o motivo, não o aponta.',
    },
  ],

  // Documentos fixos. `cena` diz onde ficam; `alvo` separa a marcação da vítima
  // ('corpo') dos objetos de leitura ('pasta': pastas da perícia e a banca de
  // jornal). Os objetos de leitura de um local recebem, em ordem, os documentos
  // daquele local.
  documentos: [
    {
      id: 'jornal',
      cena: 'cidade',
      alvo: 'pasta',
      titulo: 'Jornal da manhã',
      cabecalho: 'Gazeta do Quarto Distrito — página 7',
      texto:
        'EMPRESÁRIO É ENCONTRADO MORTO NA RUA DAS ACÁCIAS\n\n' +
        'O corpo de Augusto Vilar, 54 anos, foi encontrado na manhã de ontem no apartamento onde morava ' +
        'sozinho. A polícia não confirma a causa e trata o caso como morte a esclarecer.\n\n' +
        'Vizinhos relatam discussões frequentes no andar nas últimas semanas. A reportagem apurou que a ' +
        'transportadora da vítima passava por disputa societária, mas não obteve resposta da empresa.\n\n' +
        'O delegado responsável afirmou apenas que "todas as pessoas com acesso ao prédio serão ouvidas".',
    },
    {
      id: 'corpo',
      cena: 'apto-302',
      alvo: 'corpo',
      titulo: 'Marcação da vítima',
      cabecalho: 'Observação direta — posição do corpo',
      texto:
        'O contorno marca a posição em que Augusto Vilar foi encontrado: de lado, junto à quina da mesa ' +
        'de centro.\n\nNão há sinal de luta na sala. O tapete está alinhado e nada em volta foi derrubado. ' +
        'Quem esteve aqui ou era esperado, ou entrou sem fazer barulho.',
    },
    {
      id: 'boletim',
      cena: 'apto-302',
      alvo: 'pasta',
      titulo: 'Boletim de ocorrência',
      cabecalho: 'Delegacia do 4º Distrito — registro 014/2026',
      texto:
        'Chamado recebido às 7h40 pela síndica, após a faxineira não conseguir abrir a porta.\n\n' +
        'Porta trancada por dentro, sem sinal de arrombamento na fechadura principal. ' +
        'Nenhum objeto de valor foi levado: carteira, relógio e documentos estavam no lugar.\n\n' +
        'Quatro pessoas com acesso ao andar foram ouvidas no mesmo dia. Todas apresentaram versão própria ' +
        'sobre a noite anterior, e nenhuma delas pode ser confirmada por terceiros.',
    },
    {
      id: 'laudo',
      cena: 'apto-302',
      alvo: 'pasta',
      titulo: 'Laudo preliminar',
      cabecalho: 'Instituto de perícia — resumo não conclusivo',
      texto:
        'Horário provável do óbito entre 22h30 e 0h30.\n\n' +
        'Exame de sangue com presença de sedativo em concentração incompatível com uso terapêutico. ' +
        'A hipótese de ingestão involuntária, diluída em bebida, segue aberta.\n\n' +
        'Foram colhidas digitais em quatro superfícies. O cruzamento com os suspeitos ainda não saiu, ' +
        'o que mantém a investigação dependente do que for recolhido na cena.',
    },
    {
      id: 'contrato',
      cena: 'escritorio',
      alvo: 'pasta',
      titulo: 'Distrato da sociedade',
      cabecalho: 'Transportadora Vilar — documentação societária',
      texto:
        'O distrato que tirou Marcela Vidotti do quadro societário é de quatro meses atrás.\n\n' +
        'Consta uma cláusula de pagamento em três parcelas, das quais apenas a primeira foi quitada. ' +
        'A segunda venceu há seis semanas.\n\n' +
        'Há uma anotação a lápis na margem, com a letra da vítima: "não pago o resto".',
    },
    {
      id: 'extrato',
      cena: 'escritorio',
      alvo: 'pasta',
      titulo: 'Movimentação da empresa',
      cabecalho: 'Transportadora Vilar — extrato dos últimos noventa dias',
      texto:
        'A empresa operava no limite. Três retiradas altas saíram da conta nas últimas semanas, ' +
        'todas em dinheiro e sem contrapartida registrada.\n\n' +
        'A última, de R$ 48.000, tem a data de ontem.\n\n' +
        'O contador anotou ao lado que pediu explicação à vítima duas vezes e não obteve resposta.',
    },
    {
      id: 'ouvidos',
      cena: 'delegacia',
      alvo: 'pasta',
      titulo: 'Termos de declaração',
      cabecalho: 'Delegacia do 4º Distrito — pessoas ouvidas',
      texto:
        'Quatro pessoas foram ouvidas no mesmo dia, todas por livre comparecimento.\n\n' +
        'Nenhuma das quatro apresentou testemunha capaz de confirmar onde estava entre 22h e 0h30. ' +
        'As quatro tinham acesso ao andar: duas por morar no prédio, uma por trabalhar nele e uma por ' +
        'parentesco com a vítima.\n\n' +
        'Observação do escrivão: as versões são todas plausíveis e todas isoladas. ' +
        'O inquérito depende de prova material que as contradiga.',
    },
    {
      id: 'perícia-complementar',
      cena: 'delegacia',
      alvo: 'pasta',
      titulo: 'Pedido de perícia complementar',
      cabecalho: 'Delegacia do 4º Distrito — expediente interno',
      texto:
        'Solicitada análise comparativa das digitais colhidas no apartamento com as dos quatro ouvidos.\n\n' +
        'Prazo estimado de retorno: quarenta dias.\n\n' +
        'Despacho do delegado: "não temos quarenta dias. O que for recolhido na cena e confrontado com ' +
        'os depoimentos vale mais, agora, do que o laudo que vai chegar depois."',
    },
  ],

  // Quantos vestígios o gerador planta em cada investigação.
  composicao: {
    incriminam: 3, // do culpado
    pistasFalsas: 3, // de outros suspeitos
    contexto: 2,
  },

  // Mínimo de vestígios para liberar a acusação.
  minimoParaAcusar: 3,

  // Confrontos errados que um suspeito tolera antes de encerrar a conversa.
  // É o que dá peso à escolha: confrontar no escuro custa acesso ao depoimento.
  limiteDeTentativas: 2,
};
