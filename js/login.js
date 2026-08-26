(function () {
  'use strict';
  const form = document.getElementById('formLogin');
  const aviso = document.getElementById('loginAviso');
  const botao = document.getElementById('btnEntrar');

  if (Autenticacao.perfil()) location.replace('index.html');

  form.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    aviso.hidden = true;
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      await Autenticacao.entrar(document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
      location.replace('index.html');
    } catch (erro) {
      if (erro.codigo === 'email_not_confirmed' || /not confirmed/i.test(erro.message || '')) {
        aviso.textContent = 'Este e-mail ainda não foi confirmado no Supabase. Verifique a mensagem de confirmação recebida ou solicite a liberação ao Editor.';
      } else {
        aviso.textContent = erro.status === 400 ? 'E-mail ou senha incorretos.' : (erro.message || 'Não foi possível entrar.');
      }
      aviso.hidden = false;
    } finally {
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
})();
