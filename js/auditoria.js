const Auditoria = (function () {
  'use strict';
  const $ = function (seletor) { return document.querySelector(seletor); };
  const esc = function (valor) { return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };

  async function cabecalhos() {
    const token = await Autenticacao.tokenValido();
    if (!token) throw new Error('Conecte-se à internet para acessar a administração.');
    return { apikey: Autenticacao.CHAVE, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  }

  async function renderizar() {
    const corpo = $('#corpoAuditoria');
    corpo.innerHTML = '<tr><td colspan="4">Carregando acessos…</td></tr>';
    try {
      const resposta = await fetch(Autenticacao.URL + '/rest/v1/auditoria_acessos?select=email,perfil,acessado_em,recebido_em&perfil=neq.Editor&order=acessado_em.desc&limit=200', { headers: await cabecalhos() });
      if (!resposta.ok) throw new Error('Não foi possível carregar a auditoria.');
      const acessos = await resposta.json();
      corpo.innerHTML = acessos.length ? acessos.map(function (item) {
        return '<tr><td>' + esc(new Date(item.acessado_em).toLocaleString('pt-BR')) + '</td><td>' + esc(item.email) + '</td><td>' + esc(item.perfil) + '</td><td>' + esc(new Date(item.recebido_em).toLocaleString('pt-BR')) + '</td></tr>';
      }).join('') : '<tr><td colspan="4">Nenhum acesso registrado.</td></tr>';
    } catch (erro) { corpo.innerHTML = '<tr><td colspan="4">' + esc(erro.message) + '</td></tr>'; }
  }

  function iniciar(avisar) {
    $('#formNovoUsuario').addEventListener('submit', async function (evento) {
      evento.preventDefault();
      const botao = $('#btnCriarUsuario');
      botao.disabled = true;
      try {
        const resposta = await fetch(Autenticacao.URL + '/functions/v1/criar-usuario', {
          method: 'POST', headers: await cabecalhos(), body: JSON.stringify({
            email: $('#novoEmail').value.trim(), senha: $('#novaSenha').value, perfil: $('#novoPerfil').value
          })
        });
        const dados = await resposta.json().catch(function () { return {}; });
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível criar o usuário.');
        this.reset();
        avisar('Perfil criado com sucesso.', 'ok');
      } catch (erro) { avisar(erro.message, 'erro'); }
      finally { botao.disabled = false; }
    });
  }

  return { iniciar: iniciar, renderizar: renderizar };
})();
