/* =====================================================================
   CONFIGURAÇÃO DA INSPEÇÃO — Medidas FMT
   ---------------------------------------------------------------------
   Fonte: planilha "Inspeção das medidas dormente - FMT.xlsx"
          (INSPEÇÃO DAS DISTÂNCIAS DAS OMBREIRAS - FMT)

   ESTE É O ÚNICO ARQUIVO QUE PRECISA SER EDITADO PARA MUDAR OS DADOS
   COLETADOS. Todo o resto do site (cards, modal, validação de tolerância
   e exportação para Excel) é gerado automaticamente a partir daqui.

   Tipos de campo aceitos:
     "numero"      -> aceita decimais; valida contra min/max
     "texto"       -> texto curto
     "textarea"    -> texto longo
     "select"      -> lista fixa (propriedade "opcoes")
     "data"        -> seletor de data
     "hora"        -> seletor de hora
     "checkbox"    -> sim/não
     "conferencia" -> OK / NOK / NA calculado a partir dos campos em
                      "refs" (o inspetor pode sobrescrever manualmente)

   Propriedades opcionais de um campo:
     unidade      -> sufixo exibido no input (ex.: "mm")
     nominal      -> valor de projeto (mostrado como referência)
     min / max    -> limites de aceitação; fora disso o campo fica NOK
     tolerancia   -> texto da tolerância, exibido e exportado
     obrigatorio  -> true marca a cavidade como incompleta se vazio
     ajuda        -> texto de apoio exibido abaixo do campo
     casas        -> casas decimais usadas na exibição/exportação
   ===================================================================== */

const CONFIG_INSPECAO = {
  /* Identificação do formulário */
  titulo: 'Inspeção das distâncias das ombreiras',
  subtitulo: 'FMT — Dormentes de concreto',

  /* Quantidade de cavidades (dormentes) por molde */
  cavidadesPorMolde: 6,
  rotuloCavidade: 'Cavidade',

  /* Nota fixa exibida no topo do modal de cada cavidade */
  notaInspecao:
    'Para inspecionar o dormente, será necessário se posicionar de frente ' +
    'para a inscrição (CAVAN e RUMO).',

  /* ---------------------------------------------------------------
     CABEÇALHO — preenchido uma vez, vale para toda a inspeção.
     Molde e Cavidade não entram aqui: vêm da navegação do site.
     --------------------------------------------------------------- */
  cabecalho: [
    { id: 'data',        label: 'Data da inspeção',     tipo: 'data',  obrigatorio: true },
    { id: 'hora',        label: 'Hora de início',       tipo: 'hora' },
    { id: 'pista',       label: 'Pista',                tipo: 'texto', obrigatorio: true,
      ajuda: 'Pista de produção onde os moldes foram inspecionados' },
    { id: 'local',       label: 'Local / Fábrica',      tipo: 'texto', obrigatorio: true },
    { id: 'trecho',      label: 'Trecho da via',        tipo: 'texto',
      ajuda: 'Trecho da via permanente de destino' },
    { id: 'kmInicial',   label: 'KM inicial',           tipo: 'texto' },
    { id: 'kmFinal',     label: 'KM final',             tipo: 'texto' },
    { id: 'lote',        label: 'Lote / OP',            tipo: 'texto' },
    { id: 'responsavel', label: 'Inspetor responsável', tipo: 'texto', obrigatorio: true },
    { id: 'matricula',   label: 'Matrícula',            tipo: 'texto' },
    { id: 'turno',       label: 'Turno',                tipo: 'select',
      opcoes: ['1º turno', '2º turno', '3º turno'] },
    { id: 'observacoes', label: 'Observações gerais',   tipo: 'textarea', largura: 'total' }
  ],

  /* ---------------------------------------------------------------
     SEÇÕES — campos preenchidos por CAVIDADE (um dormente cada).
     Tolerância de projeto: +1,5 / -0,5 mm sobre o valor nominal.
     --------------------------------------------------------------- */
  secoes: [
    {
      id: 'externas',
      titulo: 'Distância interna entre ombreiras externas',
      campos: [
        { id: 'ext_mesa', label: 'Mesa (W,X)', tipo: 'numero', unidade: 'mm',
          nominal: 1834.12, min: 1833.62, max: 1835.62,
          tolerancia: '+1,5 / -0,5', casas: 2, obrigatorio: true },
        { id: 'ext_ombreira', label: 'Ombreira (A,B)', tipo: 'numero', unidade: 'mm',
          nominal: 1834.67, min: 1834.17, max: 1836.17,
          tolerancia: '+1,5 / -0,5', casas: 2, obrigatorio: true },
        { id: 'ext_conf', label: 'Conferência', tipo: 'conferencia',
          refs: ['ext_mesa', 'ext_ombreira'] }
      ]
    },
    {
      id: 'ladoA',
      titulo: 'Distância interna entre ombreiras — Lado A',
      campos: [
        { id: 'a_mesa', label: 'Mesa (W,X)', tipo: 'numero', unidade: 'mm',
          nominal: 154.50, min: 154.00, max: 156.00,
          tolerancia: '+1,5 / -0,5', casas: 2, obrigatorio: true },
        { id: 'a_ombreira', label: 'Ombreira (A,B)', tipo: 'numero', unidade: 'mm',
          nominal: 155.55, min: 155.05, max: 157.05,
          tolerancia: '+1,5 / -0,5', casas: 2, obrigatorio: true },
        { id: 'a_conf', label: 'Conferência — Lado A', tipo: 'conferencia',
          refs: ['a_mesa', 'a_ombreira'] }
      ]
    },
    {
      id: 'ladoB',
      titulo: 'Distância interna entre ombreiras — Lado B',
      campos: [
        { id: 'b_mesa', label: 'Mesa (W,X)', tipo: 'numero', unidade: 'mm',
          nominal: 154.50, min: 154.00, max: 156.00,
          tolerancia: '+1,5 / -0,5', casas: 2, obrigatorio: true },
        { id: 'b_ombreira', label: 'Ombreira (A,B)', tipo: 'numero', unidade: 'mm',
          nominal: 155.55, min: 155.05, max: 157.05,
          tolerancia: '+1,5 / -0,5', casas: 2, obrigatorio: true },
        { id: 'b_conf', label: 'Conferência — Lado B', tipo: 'conferencia',
          refs: ['b_mesa', 'b_ombreira'] }
      ]
    },
    {
      id: 'conclusao',
      titulo: 'Conclusão',
      campos: [
        { id: 'situacao', label: 'Situação da cavidade', tipo: 'select',
          opcoes: ['Conforme', 'Conforme com ressalva', 'Não conforme'] },
        { id: 'acao', label: 'Ação recomendada', tipo: 'select',
          opcoes: ['Liberar', 'Ajustar molde', 'Reinspecionar', 'Bloquear'] },
        { id: 'obsCavidade', label: 'Observações da cavidade', tipo: 'textarea',
          largura: 'total' }
      ]
    }
  ]
};

/* Lista achatada de todos os campos de cavidade — usada pelo app e pela exportação. */
CONFIG_INSPECAO.todosCampos = CONFIG_INSPECAO.secoes.reduce(function (acc, secao) {
  secao.campos.forEach(function (campo) {
    acc.push(Object.assign({ secao: secao.titulo, secaoId: secao.id }, campo));
  });
  return acc;
}, []);

/* Índice id -> campo, para lookup rápido. */
CONFIG_INSPECAO.mapaCampos = CONFIG_INSPECAO.todosCampos.reduce(function (acc, campo) {
  acc[campo.id] = campo;
  return acc;
}, {});
