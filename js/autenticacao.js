/* Autenticação Supabase com sessão persistente e acesso offline já autorizado. */
const Autenticacao = (function () {
  'use strict';

  const URL = 'https://smdoxlutxhcwjxrqeaeo.supabase.co';
  const CHAVE = 'sb_publishable_kN9vOcYtBZyKPHYnmFwseQ_4x0JHRER';
  const CHAVE_SESSAO = 'medidas-fmt:auth-sessao';
  const CHAVE_PERFIL = 'medidas-fmt:auth-perfil';
  const CHAVE_AUDITORIA = 'medidas-fmt:auditoria-fila';

  function ler(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || 'null'); }
    catch (e) { return null; }
  }

  function gravar(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
  }

  function sessao() { return ler(CHAVE_SESSAO); }
  function perfil() { return ler(CHAVE_PERFIL); }

  async function requisitar(caminho, opcoes) {
    const resposta = await fetch(URL + caminho, opcoes);
    let dados = null;
    try { dados = await resposta.json(); } catch (e) { /* resposta vazia */ }
    if (!resposta.ok) {
      const erro = new Error((dados && (dados.msg || dados.message || dados.error_description)) || 'Falha na autenticação.');
      erro.status = resposta.status;
      erro.codigo = dados && (dados.error_code || dados.code);
      throw erro;
    }
    return dados;
  }

  async function carregarPerfil(accessToken) {
    const dados = await requisitar('/rest/v1/perfis?select=user_id,email,perfil&user_id=eq.' +
      encodeURIComponent(sessao().user.id) + '&limit=1', {
      headers: { apikey: CHAVE, Authorization: 'Bearer ' + accessToken }
    });
    if (!dados || !dados[0]) throw new Error('Este usuário não possui perfil autorizado.');
    gravar(CHAVE_PERFIL, dados[0]);
    return dados[0];
  }

  async function entrar(email, senha) {
    const dados = await requisitar('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password: senha })
    });
    dados.expires_at = Math.floor(Date.now() / 1000) + Number(dados.expires_in || 3600);
    gravar(CHAVE_SESSAO, dados);
    try {
      const p = await carregarPerfil(dados.access_token);
      return p;
    } catch (e) {
      limparLocal();
      throw e;
    }
  }

  async function tokenValido() {
    let atual = sessao();
    if (!atual) return null;
    if (atual.expires_at && atual.expires_at > Math.floor(Date.now() / 1000) + 60) return atual.access_token;
    if (!navigator.onLine || !atual.refresh_token) return null;
    try {
      const renovada = await requisitar('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: atual.refresh_token })
      });
      renovada.expires_at = Math.floor(Date.now() / 1000) + Number(renovada.expires_in || 3600);
      gravar(CHAVE_SESSAO, renovada);
      return renovada.access_token;
    } catch (e) { return null; }
  }

  function limparLocal() {
    localStorage.removeItem(CHAVE_SESSAO);
    localStorage.removeItem(CHAVE_PERFIL);
  }

  async function sair() {
    const token = await tokenValido();
    if (token && navigator.onLine) {
      try { await fetch(URL + '/auth/v1/logout', { method: 'POST', headers: { apikey: CHAVE, Authorization: 'Bearer ' + token } }); }
      catch (e) { /* a sessão local será removida mesmo sem resposta */ }
    }
    limparLocal();
    location.replace('login.html');
  }

  async function exigirSessao() {
    const atual = sessao();
    const salvo = perfil();
    if (!atual || !salvo) { location.replace('login.html'); return null; }
    const token = await tokenValido();
    if (navigator.onLine && !token) { limparLocal(); location.replace('login.html'); return null; }
    if (token) {
      try { await carregarPerfil(token); } catch (e) { limparLocal(); location.replace('login.html'); return null; }
    }
    registrarAcesso();
    return perfil();
  }

  function id() {
    return 'acesso-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  function registrarAcesso() {
    let fila = ler(CHAVE_AUDITORIA) || [];
    fila.push({ p_evento_id: id(), p_acessado_em: new Date().toISOString() });
    gravar(CHAVE_AUDITORIA, fila);
    enviarAuditoria();
  }

  async function enviarAuditoria() {
    if (!navigator.onLine) return;
    let fila = ler(CHAVE_AUDITORIA) || [];
    const token = await tokenValido();
    if (!token) return;
    while (fila.length) {
      const resposta = await fetch(URL + '/rest/v1/rpc/registrar_acesso', {
        method: 'POST',
        headers: { apikey: CHAVE, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(fila[0])
      });
      if (!resposta.ok) return;
      fila.shift();
      gravar(CHAVE_AUDITORIA, fila);
    }
  }

  window.addEventListener('online', enviarAuditoria);

  return { URL: URL, CHAVE: CHAVE, entrar: entrar, sair: sair, perfil: perfil,
    tokenValido: tokenValido, exigirSessao: exigirSessao, enviarAuditoria: enviarAuditoria };
})();
