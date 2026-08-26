/* =====================================================================
   AVALIAÇÃO DE TOLERÂNCIA — Medidas FMT
   ---------------------------------------------------------------------
   Regra: se a medida ficar ABAIXO do mínimo ou ACIMA do máximo definido
   em campos.js, o campo é marcado em vermelho e a conferência do bloco
   vira NOK. Sem medida, a conferência fica NA.

   Usado pela tela (app.js) e pela exportação (exportar.js) — por isso
   vive em um arquivo próprio.
   ===================================================================== */

const Avaliacao = (function () {

  /* Converte o que o inspetor digitou em número. Aceita vírgula decimal. */
  function numero(valor) {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor).trim().replace(',', '.');
    if (texto === '') return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : null;
  }

  function temLimites(campo) {
    return campo.min !== undefined || campo.max !== undefined;
  }

  /* Formata um número com as casas decimais do campo, em padrão pt-BR. */
  function formatar(campo, valor) {
    const n = numero(valor);
    if (n === null) return '';
    const casas = campo && campo.casas !== undefined ? campo.casas : 2;
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
      useGrouping: false      /* medidas em mm não levam separador de milhar */
    });
  }

  /* Texto da faixa aceitável, ex.: "1833,62 a 1835,62 mm". */
  function faixa(campo) {
    if (!temLimites(campo)) return '';
    const un = campo.unidade ? ' ' + campo.unidade : '';
    if (campo.min !== undefined && campo.max !== undefined) {
      return formatar(campo, campo.min) + ' a ' + formatar(campo, campo.max) + un;
    }
    if (campo.min !== undefined) return 'mínimo ' + formatar(campo, campo.min) + un;
    return 'máximo ' + formatar(campo, campo.max) + un;
  }

  /* ---------------------------------------------------------------
     Status de um campo:
       'vazio'  -> sem valor
       'ok'     -> dentro da tolerância
       'abaixo' -> menor que o mínimo  (NOK)
       'acima'  -> maior que o máximo  (NOK)
       'neutro' -> campo sem limites definidos
     --------------------------------------------------------------- */
  function statusCampo(campo, valor) {
    if (campo.tipo !== 'numero' || !temLimites(campo)) {
      const vazio = valor === undefined || valor === null || String(valor).trim() === '';
      return vazio ? 'vazio' : 'neutro';
    }
    const n = numero(valor);
    if (n === null) return 'vazio';
    if (campo.min !== undefined && n < campo.min) return 'abaixo';
    if (campo.max !== undefined && n > campo.max) return 'acima';
    return 'ok';
  }

  function ehNok(status) { return status === 'abaixo' || status === 'acima'; }

  /* Mensagem exibida ao lado do campo. */
  function mensagemCampo(campo, status) {
    const un = campo.unidade ? ' ' + campo.unidade : '';
    if (status === 'abaixo') {
      return 'NOK — abaixo do mínimo de ' + formatar(campo, campo.min) + un;
    }
    if (status === 'acima') {
      return 'NOK — acima do máximo de ' + formatar(campo, campo.max) + un;
    }
    if (status === 'ok') return 'OK — dentro da tolerância';
    return '';
  }

  /* ---------------------------------------------------------------
     Conferência de um bloco (campo do tipo "conferencia").
     Retorna { valor: 'OK'|'NOK'|'NA', motivo: '...' }
     --------------------------------------------------------------- */
  function conferencia(campoConf, dados) {
    const refs = campoConf.refs || [];
    const foraDeTolerancia = [];
    let preenchidos = 0;

    refs.forEach(function (idRef) {
      const campo = CONFIG_INSPECAO.mapaCampos[idRef];
      if (!campo) return;
      const status = statusCampo(campo, dados[idRef]);
      if (status === 'vazio') return;
      preenchidos++;
      if (ehNok(status)) {
        foraDeTolerancia.push(
          campo.label + ' ' + (status === 'abaixo' ? 'abaixo' : 'acima') + ' da tolerância'
        );
      }
    });

    if (foraDeTolerancia.length) {
      return { valor: 'NOK', motivo: foraDeTolerancia.join(' · ') };
    }
    if (preenchidos === 0) {
      return { valor: 'NA', motivo: 'Aguardando as medidas deste bloco' };
    }
    if (preenchidos < refs.length) {
      return { valor: 'NA', motivo: 'Bloco incompleto — falta medir ' +
        (refs.length - preenchidos) + ' item(ns)' };
    }
    return { valor: 'OK', motivo: 'Todas as medidas dentro da tolerância' };
  }

  /* ---------------------------------------------------------------
     Situação geral de uma cavidade.
     --------------------------------------------------------------- */
  function statusCavidade(dados) {
    dados = dados || {};

    const obrigatorios = CONFIG_INSPECAO.todosCampos.filter(function (c) {
      return c.obrigatorio;
    });

    let preenchidosObrig = 0;
    obrigatorios.forEach(function (campo) {
      const v = dados[campo.id];
      if (v !== undefined && v !== null && String(v).trim() !== '') preenchidosObrig++;
    });

    /* Existe algum dado digitado? */
    const temAlgo = Object.keys(dados).some(function (k) {
      const v = dados[k];
      return v !== undefined && v !== null && String(v).trim() !== '' && v !== false;
    });

    /* Alguma medida fora da tolerância? */
    let nok = false;
    CONFIG_INSPECAO.todosCampos.forEach(function (campo) {
      if (ehNok(statusCampo(campo, dados[campo.id]))) nok = true;
    });

    let situacao;
    if (nok) situacao = 'nok';
    else if (!temAlgo) situacao = 'vazia';
    else if (preenchidosObrig >= obrigatorios.length) situacao = 'ok';
    else situacao = 'parcial';

    return {
      situacao: situacao,
      nok: nok,
      completa: preenchidosObrig >= obrigatorios.length,
      preenchidos: preenchidosObrig,
      totalObrigatorios: obrigatorios.length
    };
  }

  /* Situação consolidada de um molde. */
  function statusMolde(molde) {
    const total = CONFIG_INSPECAO.cavidadesPorMolde;
    let completas = 0;
    let nok = 0;
    const porCavidade = [];

    for (let i = 1; i <= total; i++) {
      const st = statusCavidade(molde.cavidades[String(i)]);
      porCavidade.push(st);
      if (st.completa) completas++;
      if (st.nok) nok++;
    }

    return { total: total, completas: completas, nok: nok, porCavidade: porCavidade };
  }

  return {
    numero: numero,
    formatar: formatar,
    faixa: faixa,
    temLimites: temLimites,
    statusCampo: statusCampo,
    ehNok: ehNok,
    mensagemCampo: mensagemCampo,
    conferencia: conferencia,
    statusCavidade: statusCavidade,
    statusMolde: statusMolde
  };
})();
