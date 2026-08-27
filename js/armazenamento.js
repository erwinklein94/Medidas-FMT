/* =====================================================================
   ARMAZENAMENTO — Medidas FMT
   ---------------------------------------------------------------------
   O localStorage e sempre gravado primeiro, inclusive sem internet.
   O modulo Sincronizacao envia snapshots ao Supabase em segundo plano
   sem bloquear este salvamento local.
   ===================================================================== */

const Armazenamento = (function () {
  const CHAVE = 'medidas-fmt:inspecao';
  const VERSAO = 2;

  /* Estado padrão de uma inspeção vazia. */
  function estadoInicial() {
    return {
      versao: VERSAO,
      atualizadoEm: null,
      cabecalhos: [],
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

    base.cabecalhos = Array.isArray(dados.cabecalhos) ? dados.cabecalhos
      .filter(function (c) { return c && typeof c === 'object'; })
      .map(function (c) {
        return { id: String(c.id || criarGrupoId()), dados: c.dados && typeof c.dados === 'object' ? c.dados : {} };
      }) : [];
    base.atualizadoEm = dados.atualizadoEm || null;
    base.modoExemplo = dados.modoExemplo === true;

    base.moldes = Array.isArray(dados.moldes) ? dados.moldes
      .filter(function (m) { return m && typeof m === 'object'; })
      .map(function (m) {
        return {
          id: String(m.id || criarId()),
          nome: String(m.nome == null ? '' : m.nome).trim() || 'Sem identificação',
          criadoEm: m.criadoEm || new Date().toISOString(),
          cavidades: (m.cavidades && typeof m.cavidades === 'object') ? m.cavidades : {},
          grupoId: m.grupoId ? String(m.grupoId) : '',
          exemplo: m.exemplo === true || String(m.id || '').indexOf('exemplo-molde-') === 0
        };
      }) : [];

    /* Migra automaticamente o formato antigo. Se havia mais de 50 moldes,
       cria blocos consecutivos e replica os dados gerais em cada um. */
    if (!base.cabecalhos.length) {
      const antigo = dados.cabecalho && typeof dados.cabecalho === 'object' ? dados.cabecalho : {};
      const quantidade = Math.max(1, Math.ceil(base.moldes.length / 50));
      for (let i = 0; i < quantidade; i++) {
        const grupo = { id: criarGrupoId(), dados: Object.assign({}, antigo) };
        base.cabecalhos.push(grupo);
        base.moldes.slice(i * 50, (i + 1) * 50).forEach(function (m) { m.grupoId = grupo.id; });
      }
    }
    const primeiro = base.cabecalhos[0].id;
    base.moldes.forEach(function (m) {
      if (!base.cabecalhos.some(function (c) { return c.id === m.grupoId; })) m.grupoId = primeiro;
    });

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

  function criarGrupoId() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    estadoInicial: estadoInicial,
    carregar: carregar,
    salvar: salvar,
    limpar: limpar,
    normalizar: normalizar,
    criarId: criarId,
    criarGrupoId: criarGrupoId,
    disponivel: disponivel
  };
})();
