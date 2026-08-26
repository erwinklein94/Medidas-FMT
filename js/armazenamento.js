/* =====================================================================
   ARMAZENAMENTO — Medidas FMT
   ---------------------------------------------------------------------
   Hoje: localStorage (os dados ficam apenas no navegador do inspetor).
   Depois: para migrar ao Supabase basta reimplementar os métodos de
   Armazenamento (carregar/salvar) chamando o client do Supabase — o
   restante da aplicação não muda, pois só conversa com esta interface.
   ===================================================================== */

const Armazenamento = (function () {
  const CHAVE = 'medidas-fmt:inspecao';
  const VERSAO = 1;

  /* Estado padrão de uma inspeção vazia. */
  function estadoInicial() {
    return {
      versao: VERSAO,
      atualizadoEm: null,
      cabecalho: {},
      /* moldes: [{ id, nome, criadoEm, cavidades: { "1": {campoId: valor}, ... } }] */
      moldes: []
    };
  }

  function disponivel() {
    try {
      const t = '__teste__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  function carregar() {
    if (!disponivel()) return estadoInicial();
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (!bruto) return estadoInicial();
      const dados = JSON.parse(bruto);
      return normalizar(dados);
    } catch (e) {
      console.warn('Não foi possível ler os dados salvos:', e);
      return estadoInicial();
    }
  }

  /* Garante que um estado vindo do storage/import tem o formato esperado. */
  function normalizar(dados) {
    const base = estadoInicial();
    if (!dados || typeof dados !== 'object') return base;

    base.cabecalho = (dados.cabecalho && typeof dados.cabecalho === 'object')
      ? dados.cabecalho : {};
    base.atualizadoEm = dados.atualizadoEm || null;

    base.moldes = Array.isArray(dados.moldes) ? dados.moldes
      .filter(function (m) { return m && typeof m === 'object'; })
      .map(function (m) {
        return {
          id: String(m.id || criarId()),
          nome: String(m.nome == null ? '' : m.nome).trim() || 'Sem identificação',
          criadoEm: m.criadoEm || new Date().toISOString(),
          cavidades: (m.cavidades && typeof m.cavidades === 'object') ? m.cavidades : {}
        };
      }) : [];

    return base;
  }

  function salvar(estado) {
    estado.versao = VERSAO;
    estado.atualizadoEm = new Date().toISOString();
    if (!disponivel()) return false;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      console.error('Falha ao salvar no navegador:', e);
      return false;
    }
  }

  function limpar() {
    if (!disponivel()) return;
    window.localStorage.removeItem(CHAVE);
  }

  function criarId() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    estadoInicial: estadoInicial,
    carregar: carregar,
    salvar: salvar,
    limpar: limpar,
    normalizar: normalizar,
    criarId: criarId,
    disponivel: disponivel
  };
})();
