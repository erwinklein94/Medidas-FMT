/* =====================================================================
   SINCRONIZACAO SUPABASE — fila offline-first
   ---------------------------------------------------------------------
   O navegador continua sendo a fonte imediata de salvamento. Cada
   alteracao consolidada vira um snapshot imutavel na fila local. Quando
   houver internet, a fila e enviada ao Supabase em ordem e removida
   somente depois de uma resposta confirmada pelo servidor.
   ===================================================================== */

const Sincronizacao = (function () {
  'use strict';

  const URL = 'https://smdoxlutxhcwjxrqeaeo.supabase.co';
  /* Chave publicavel: pode ficar no frontend. Nunca usar secret/service_role aqui. */
  const CHAVE_PUBLICA = 'sb_publishable_kN9vOcYtBZyKPHYnmFwseQ_4x0JHRER';
  const CHAVE_FILA = 'medidas-fmt:sincronizacao-fila';
  const CHAVE_DISPOSITIVO = 'medidas-fmt:dispositivo-id';
  const ATRASO_CONSOLIDACAO = 1000;
  const INTERVALO_TENTATIVA = 60000;

  let fila = lerFila();
  let dispositivoId = lerOuCriarDispositivoId();
  let timerConsolidacao = null;
  let timerRetentativa = null;
  let enviando = false;
  let ultimoEstado = null;
  let aoMudarEstado = function () {};

  function id(prefixo) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefixo + window.crypto.randomUUID();
    }
    return prefixo + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function lerOuCriarDispositivoId() {
    try {
      let valor = window.localStorage.getItem(CHAVE_DISPOSITIVO);
      if (!valor) {
        valor = id('disp-');
        window.localStorage.setItem(CHAVE_DISPOSITIVO, valor);
      }
      return valor;
    } catch (e) {
      return id('disp-temporario-');
    }
  }

  function lerFila() {
    try {
      const dados = JSON.parse(window.localStorage.getItem(CHAVE_FILA) || '[]');
      return Array.isArray(dados) ? dados.filter(function (item) {
        return item && item.id && item.dados;
      }) : [];
    } catch (e) {
      return [];
    }
  }

  function gravarFila() {
    try {
      window.localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
      return true;
    } catch (e) {
      console.error('Nao foi possivel salvar a fila de sincronizacao:', e);
      return false;
    }
  }

  function temConteudo(estado) {
    return !!(estado && (
      (estado.cabecalho && Object.keys(estado.cabecalho).some(function (chave) {
        return estado.cabecalho[chave] !== '' && estado.cabecalho[chave] != null;
      })) || (Array.isArray(estado.moldes) && estado.moldes.length)
    ));
  }

  function notificar(tipo, detalhe) {
    aoMudarEstado({
      tipo: tipo,
      detalhe: detalhe || '',
      pendentes: fila.length,
      online: navigator.onLine
    });
  }

  function colocarNaFila(estado) {
    if (!estado) return false;
    let copia;
    try { copia = JSON.parse(JSON.stringify(estado)); }
    catch (e) { return false; }

    /* A base demonstrativa existe apenas para visualizar o Dashboard e nao
       deve poluir o banco. Se houver coletas reais junto dela, envia somente
       os moldes reais. */
    copia.moldes = (copia.moldes || []).filter(function (molde) {
      return String(molde.id || '').indexOf('exemplo-molde-') !== 0;
    });
    if (copia.modoExemplo && !copia.moldes.length) {
      notificar('sincronizado');
      return false;
    }
    delete copia.modoExemplo;

    fila.push({
      id: id('sync-'),
      dispositivo_id: dispositivoId,
      dados: copia,
      atualizado_no_dispositivo: copia.atualizadoEm || new Date().toISOString()
    });

    if (!gravarFila()) {
      fila.pop();
      notificar('erro-local', 'A fila de sincronizacao nao pode ser salva.');
      return false;
    }
    notificar('pendente');
    enviarFila();
    return true;
  }

  function agendar(estado) {
    ultimoEstado = estado;
    clearTimeout(timerConsolidacao);
    timerConsolidacao = setTimeout(function () {
      timerConsolidacao = null;
      colocarNaFila(ultimoEstado);
    }, ATRASO_CONSOLIDACAO);
  }

  async function enviar(item) {
    const token = await Autenticacao.tokenValido();
    if (!token) throw new Error('Sessão aguardando conexão para ser renovada.');
    const resposta = await fetch(URL + '/rest/v1/inspecoes_fmt', {
      method: 'POST',
      headers: {
        'apikey': CHAVE_PUBLICA,
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(item)
    });

    /* 409 tambem significa que esta operacao idempotente ja chegou antes. */
    if (!resposta.ok && resposta.status !== 409) {
      let mensagem = 'HTTP ' + resposta.status;
      try {
        const erro = await resposta.json();
        if (erro && erro.message) mensagem += ': ' + erro.message;
      } catch (e) { /* resposta sem JSON */ }
      throw new Error(mensagem);
    }
  }

  async function enviarFila() {
    if (enviando || !fila.length) {
      if (!fila.length) notificar('sincronizado');
      return;
    }
    if (!navigator.onLine) {
      notificar('offline');
      return;
    }

    enviando = true;
    notificar('enviando');
    try {
      while (fila.length && navigator.onLine) {
        const item = fila[0];
        await enviar(item);
        if (fila[0] && fila[0].id === item.id) fila.shift();
        else fila = fila.filter(function (x) { return x.id !== item.id; });
        gravarFila();
      }
      notificar(fila.length ? 'pendente' : 'sincronizado');
    } catch (e) {
      console.warn('Sincronizacao adiada:', e.message || e);
      notificar('pendente', e.message || 'Falha temporaria de conexao.');
    } finally {
      enviando = false;
    }
  }

  function iniciar(estadoAtual, callback) {
    aoMudarEstado = typeof callback === 'function' ? callback : function () {};
    ultimoEstado = typeof estadoAtual === 'function' ? estadoAtual() : estadoAtual;

    window.addEventListener('online', enviarFila);
    window.addEventListener('offline', function () { notificar('offline'); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) enviarFila();
    });
    window.addEventListener('pagehide', function () {
      if (timerConsolidacao) {
        clearTimeout(timerConsolidacao);
        timerConsolidacao = null;
        colocarNaFila(ultimoEstado);
      }
    });

    timerRetentativa = setInterval(enviarFila, INTERVALO_TENTATIVA);

    if (fila.length) enviarFila();
    else if (temConteudo(ultimoEstado)) agendar(ultimoEstado);
    else notificar('sincronizado');
  }

  return {
    iniciar: iniciar,
    agendar: agendar,
    enviarAgora: enviarFila
  };
})();
