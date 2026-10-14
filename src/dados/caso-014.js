// CASO 014 — roteiro de exemplo, todo ficcional e original.
//
// Estrutura pensada para o gerador: o acervo tem vestígios que incriminam cada
// suspeito. A cada investigação o jogo escolhe um culpado, planta os vestígios
// dele, mistura algumas pistas falsas e espalha tudo em pontos diferentes.
// Resultado: mesma cena, mesmo crime, caminhos de dedução diferentes.

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
    },
    {
      id: 'heitor',
      nome: 'Heitor Bastos',
      relacao: 'zelador do edifício',
      alibi: 'Afirma que estava na portaria e não subiu depois das 22h.',
    },
    {
      id: 'renata',
      nome: 'Renata Khoury',
      relacao: 'vizinha do 301',
      alibi: 'Conta que dormiu cedo e só acordou com a sirene.',
    },
    {
      id: 'tiago',
      nome: 'Tiago Serra',
      relacao: 'irmão da vítima',
      alibi: 'Garante que estava em outra cidade e voltou de madrugada.',
    },
  ],

  // Vestígios que apontam para alguém. Três por suspeito.
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
      nome: 'Cópia de chave sem registro',
      tipo: 'objeto',
      aponta: 'heitor',
      texto:
        'Chave nova do 302, sem o número de controle que o zelador é obrigado a gravar em toda cópia. ' +
        'Só Heitor tinha a máquina.',
    },
    {
      id: 'h2',
      nome: 'Luva de trabalho',
      tipo: 'vestígio',
      aponta: 'heitor',
      texto:
        'Uma luva de raspa, par do que fica no armário da portaria, com mancha escura no punho. ' +
        'A outra não foi encontrada.',
    },
    {
      id: 'h3',
      nome: 'Folha de ponto emendada',
      tipo: 'documento',
      aponta: 'heitor',
      texto:
        'A saída das 22h foi reescrita por cima de outro horário. A caligrafia da correção é a de Heitor.',
    },
    {
      id: 'r1',
      nome: 'Bilhete amassado',
      tipo: 'documento',
      aponta: 'renata',
      texto:
        'Papel de carta do 301: "a próxima reclamação vai ser na delegacia, e não vai ser minha". ' +
        'Assinado apenas com um R.',
    },
    {
      id: 'r2',
      nome: 'Marca de salto no ladrilho',
      tipo: 'vestígio',
      aponta: 'renata',
      texto:
        'Meia pegada de salto fino no piso molhado, número compatível com o calçado apreendido no 301.',
    },
    {
      id: 'r3',
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
      nome: 'Chaveiro com iniciais',
      tipo: 'objeto',
      aponta: 'tiago',
      texto:
        'Chaveiro de metal gasto com as iniciais T.S., caído entre o tapete e o rodapé.',
    },
    {
      id: 't3',
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
      nome: 'Relógio de parede parado',
      tipo: 'vestígio',
      aponta: null,
      texto: 'O relógio parou às 23h14, com o vidro rachado. Firma o horário provável do crime.',
    },
    {
      id: 'c2',
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

  // Documentos fixos, sempre no mesmo lugar do mapa.
  documentos: [
    {
      id: 'corpo',
      titulo: 'Marcação da vítima',
      cabecalho: 'Observação direta — posição do corpo',
      texto:
        'O contorno marca a posição em que Augusto Vilar foi encontrado: de lado, junto à quina da mesa ' +
        'de centro.\n\nNão há sinal de luta na sala. O tapete está alinhado e nada em volta foi derrubado. ' +
        'Quem esteve aqui ou era esperado, ou entrou sem fazer barulho.',
    },
    {
      id: 'boletim',
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
      titulo: 'Laudo preliminar',
      cabecalho: 'Instituto de perícia — resumo não conclusivo',
      texto:
        'Horário provável do óbito entre 22h30 e 0h30.\n\n' +
        'Exame de sangue com presença de sedativo em concentração incompatível com uso terapêutico. ' +
        'A hipótese de ingestão involuntária, diluída em bebida, segue aberta.\n\n' +
        'Foram colhidas digitais em quatro superfícies. O cruzamento com os suspeitos ainda não saiu, ' +
        'o que mantém a investigação dependente do que for recolhido na cena.',
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
};
