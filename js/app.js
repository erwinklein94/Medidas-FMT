/* =====================================================================
   APLICAÇÃO — Medidas FMT
   Fluxo: Cabeçalho -> Moldes -> 6 Cavidades -> Modal de medidas
   ===================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Estado
     --------------------------------------------------------------- */
  let estado = Armazenamento.carregar();
  if (DadosExemplo.aplicar(estado)) Armazenamento.salvar(estado);
  let moldeAberto = null;      // id do molde no painel
  let cavidadeAberta = null;   // número da cavidade no modal
  let rascunho = {};           // dados da cavidade sendo editada
  let elementoFoco = null;     // devolve o foco ao fechar overlays

  const $ = function (sel) { return document.querySelector(sel); };

  /* Mostrar/esconder overlays.
     O estilo inline vence qualquer folha de estilo, inclusive uma versão
     antiga em cache no celular do inspetor — sem isso, uma regra de
     display mais específica que [hidden] deixa o modal aberto e travado. */
  function mostrar(el) { el.hidden = false; el.style.display = 'flex'; }
  function esconder(el) { el.hidden = true; el.style.display = 'none'; }

  /* ---------------------------------------------------------------
     Utilidades de tela
     --------------------------------------------------------------- */
  let timerAviso = null;
  function avisar(texto, tipo) {
    const el = $('#aviso');
    el.textContent = texto;
    el.className = 'aviso' + (tipo ? ' is-' + tipo : '');
    el.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { el.hidden = true; }, 3200);
  }

  let timerSalvo = null;
  function persistir() {
    const ok = Armazenamento.salvar(estado);
    const indicador = $('#indicadorSalvo');
    const texto = $('#salvoTexto');
    if (!ok) {
      indicador.classList.remove('is-gravando');
      texto.textContent = 'Sem salvamento local';
      return;
    }
    Sincronizacao.agendar(estado);
    indicador.classList.add('is-gravando');
    texto.textContent = 'Salvando…';
    clearTimeout(timerSalvo);
    timerSalvo = setTimeout(function () {
      indicador.classList.remove('is-gravando');
      texto.textContent = 'Salvo no navegador';
    }, 600);
  }

  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------------------------------------------------------
     Construção de um campo de formulário
     --------------------------------------------------------------- */
  function criarCampo(campo, valor, aoMudar) {
    const wrap = document.createElement('label');
    wrap.className = 'campo';
    if (campo.largura === 'total') wrap.classList.add('campo--total');
    wrap.dataset.campo = campo.id;

    /* Rótulo */
    const rotulo = document.createElement('span');
    rotulo.className = 'campo__rotulo';
    rotulo.innerHTML = esc(campo.label) +
      (campo.obrigatorio ? ' <span class="campo__obrigatorio" title="Obrigatório">*</span>' : '');

    if (campo.tipo === 'numero' && campo.nominal !== undefined) {
      const ref = document.createElement('span');
      ref.className = 'campo__ref';
      ref.textContent = 'nominal ' + Avaliacao.formatar(campo, campo.nominal) +
        (campo.tolerancia ? ' (' + campo.tolerancia + ')' : '');
      rotulo.appendChild(ref);
    }

    let controle;

    if (campo.tipo === 'conferencia') {
      /* Selo calculado automaticamente — não é editável. */
      wrap.className = 'campo' + (campo.largura === 'total' ? ' campo--total' : '');
      const caixa = document.createElement('div');
      caixa.className = 'conferencia';
      caixa.dataset.conferencia = campo.id;
      caixa.innerHTML =
        '<span class="conferencia__selo">NA</span>' +
        '<span class="conferencia__motivo"></span>';
      wrap.appendChild(rotulo);
      wrap.appendChild(caixa);
      return wrap;
    }

    if (campo.tipo === 'select') {
      controle = document.createElement('select');
      controle.className = 'campo__select';
      controle.innerHTML = '<option value="">Selecione…</option>' +
        (campo.opcoes || []).map(function (o) {
          return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
        }).join('');
      controle.value = valor || '';

    } else if (campo.tipo === 'textarea') {
      controle = document.createElement('textarea');
      controle.className = 'campo__textarea';
      controle.rows = 3;
      controle.value = valor || '';

    } else if (campo.tipo === 'checkbox') {
      wrap.className = 'campo campo--checkbox' +
        (campo.largura === 'total' ? ' campo--total' : '');
      controle = document.createElement('input');
      controle.type = 'checkbox';
      controle.checked = valor === true || valor === 'true';
      wrap.appendChild(controle);
      wrap.appendChild(rotulo);
      controle.addEventListener('change', function () {
        aoMudar(campo.id, controle.checked);
      });
      return wrap;

    } else {
      controle = document.createElement('input');
      controle.className = 'campo__input';
      controle.value = valor == null ? '' : valor;
      if (campo.tipo === 'data') controle.type = 'date';
      else if (campo.tipo === 'hora') controle.type = 'time';
      else if (campo.tipo === 'numero') {
        /* text + inputmode decimal: teclado numérico no celular e aceita vírgula */
        controle.type = 'text';
        controle.inputMode = 'decimal';
        controle.autocomplete = 'off';
        controle.placeholder = campo.nominal !== undefined
          ? Avaliacao.formatar(campo, campo.nominal) : '';
      } else {
        controle.type = 'text';
      }
    }

    wrap.appendChild(rotulo);

    /* Unidade sobreposta ao input numérico */
    if (campo.unidade && campo.tipo === 'numero') {
      const caixa = document.createElement('span');
      caixa.className = 'campo__caixa';
      caixa.appendChild(controle);
      const un = document.createElement('span');
      un.className = 'campo__unidade';
      un.textContent = campo.unidade;
      caixa.appendChild(un);
      wrap.appendChild(caixa);
    } else {
      wrap.appendChild(controle);
    }

    if (campo.ajuda) {
      const ajuda = document.createElement('span');
      ajuda.className = 'campo__ajuda';
      ajuda.textContent = campo.ajuda;
      wrap.appendChild(ajuda);
    }

    /* Uma única linha de apoio: mostra a faixa aceitável enquanto o campo
       está vazio e vira o aviso de OK/NOK quando é preenchido. Duas linhas
       separadas faziam o modal não caber na tela. */
    if (Avaliacao.temLimites(campo)) {
      const estado = document.createElement('span');
      estado.className = 'campo__estado';
      estado.textContent = 'Aceitável: ' + Avaliacao.faixa(campo);
      wrap.appendChild(estado);
    }

    const evento = (campo.tipo === 'select' || campo.tipo === 'data' || campo.tipo === 'hora')
      ? 'change' : 'input';
    controle.addEventListener(evento, function () {
      aoMudar(campo.id, controle.value);
    });

    return wrap;
  }

  /* Pinta um campo conforme a tolerância. */
  function pintarCampo(container, campo, valor) {
    const wrap = container.querySelector('[data-campo="' + campo.id + '"]');
    if (!wrap) return;
    const status = Avaliacao.statusCampo(campo, valor);
    wrap.classList.remove('is-ok', 'is-nok');
    if (status === 'ok') wrap.classList.add('is-ok');
    else if (Avaliacao.ehNok(status)) wrap.classList.add('is-nok');

    const estado = wrap.querySelector('.campo__estado');
    if (estado) {
      estado.textContent = Avaliacao.mensagemCampo(campo, status) ||
        ('Aceitável: ' + Avaliacao.faixa(campo));
    }
  }

  /* Atualiza os selos de conferência OK / NOK / NA. */
  function pintarConferencias(container, dados) {
    CONFIG_INSPECAO.todosCampos.forEach(function (campo) {
      if (campo.tipo !== 'conferencia') return;
      const caixa = container.querySelector('[data-conferencia="' + campo.id + '"]');
      if (!caixa) return;
      const res = Avaliacao.conferencia(campo, dados);
      caixa.classList.remove('is-ok', 'is-nok');
      if (res.valor === 'OK') caixa.classList.add('is-ok');
      else if (res.valor === 'NOK') caixa.classList.add('is-nok');
      caixa.querySelector('.conferencia__selo').textContent = res.valor;
      caixa.querySelector('.conferencia__motivo').textContent = res.motivo;
    });
  }

  /* ---------------------------------------------------------------
     Cabeçalho da inspeção
     --------------------------------------------------------------- */
  function montarCabecalho() {
    const form = $('#formCabecalho');
    form.innerHTML = '';
    CONFIG_INSPECAO.cabecalho.forEach(function (campo) {
      form.appendChild(criarCampo(campo, estado.cabecalho[campo.id], function (id, valor) {
        estado.cabecalho[id] = valor;
        persistir();
        atualizarResumoCabecalho();
      }));
    });
    atualizarResumoCabecalho();
  }

  function atualizarResumoCabecalho() {
    const c = estado.cabecalho;
    const partes = [];
    if (c.data) {
      const p = String(c.data).split('-');
      partes.push(p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : c.data);
    }
    if (c.local) partes.push(c.local);
    if (c.responsavel) partes.push(c.responsavel);

    const faltando = CONFIG_INSPECAO.cabecalho
      .filter(function (campo) {
        return campo.obrigatorio && !String(c[campo.id] || '').trim();
      });

    $('#resumoCabecalho').textContent = partes.length
      ? partes.join(' · ') + (faltando.length ? ' — faltam ' + faltando.length + ' campo(s)' : '')
      : 'Preencha antes de iniciar';
  }

  /* ---------------------------------------------------------------
     Moldes
     --------------------------------------------------------------- */
  function montarMoldes() {
    const grade = $('#gradeMoldes');
    grade.innerHTML = '';
    $('#vazioMoldes').hidden = estado.moldes.length > 0;

    estado.moldes.forEach(function (molde) {
      const st = Avaliacao.statusMolde(molde);

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'molde';
      if (st.nok) botao.classList.add('is-nok');
      else if (st.completas === st.total) botao.classList.add('is-completo');
      botao.dataset.molde = molde.id;
      botao.setAttribute('aria-label',
        'Molde ' + molde.nome + ' — ' + st.completas + ' de ' + st.total + ' cavidades preenchidas');

      const pontos = st.porCavidade.map(function (c) {
        let cls = 'molde__ponto';
        if (c.nok) cls += ' is-nok';
        else if (c.completa) cls += ' is-preenchido';
        return '<span class="' + cls + '"></span>';
      }).join('');

      let etiqueta;
      if (st.nok) etiqueta = '<span class="etiqueta etiqueta--nok">' + st.nok + ' NOK</span>';
      else if (st.completas === st.total) etiqueta = '<span class="etiqueta etiqueta--ok">Completo</span>';
      else if (st.completas > 0) etiqueta = '<span class="etiqueta etiqueta--parcial">Em andamento</span>';
      else etiqueta = '<span class="etiqueta etiqueta--neutra">Pendente</span>';

      botao.innerHTML =
        '<div>' +
          '<p class="molde__kicker">Molde</p>' +
          '<span class="molde__nome">' + esc(molde.nome) + '</span>' +
        '</div>' +
        '<div class="molde__pontos">' + pontos + '</div>' +
        '<div class="molde__rodape">' +
          '<span>' + st.completas + ' / ' + st.total + ' cavidades</span>' +
          etiqueta +
        '</div>';

      botao.addEventListener('click', function () { abrirMolde(molde.id); });
      grade.appendChild(botao);
    });

    atualizarProgresso();
  }

  function atualizarProgresso() {
    let total = 0, completas = 0, nok = 0;
    estado.moldes.forEach(function (molde) {
      const st = Avaliacao.statusMolde(molde);
      total += st.total;
      completas += st.completas;
      nok += st.nok;
    });

    const pct = total ? Math.round((completas / total) * 100) : 0;
    $('#progressoBarra').style.width = pct + '%';

    let texto;
    if (!estado.moldes.length) {
      texto = 'Nenhum molde cadastrado';
    } else {
      texto = estado.moldes.length + ' molde(s) · ' + completas + ' de ' + total +
        ' cavidades preenchidas (' + pct + '%)';
      if (nok) texto += ' · ' + nok + ' cavidade(s) NOK';
    }
    $('#progressoTexto').textContent = texto;

    $('#resumoMoldes').textContent = estado.moldes.length
      ? 'Cada molde possui ' + CONFIG_INSPECAO.cavidadesPorMolde + ' cavidades'
      : 'Cada molde possui ' + CONFIG_INSPECAO.cavidadesPorMolde + ' cavidades';
  }

  function adicionarMolde(nome) {
    nome = String(nome || '').trim();
    if (!nome) {
      /* sugere o próximo número livre */
      let n = estado.moldes.length + 1;
      while (estado.moldes.some(function (m) { return m.nome === String(n); })) n++;
      nome = String(n);
    }
    if (estado.moldes.some(function (m) {
      return m.nome.toLowerCase() === nome.toLowerCase();
    })) {
      avisar('Já existe um molde com a identificação "' + nome + '".', 'erro');
      return null;
    }
    const molde = {
      id: Armazenamento.criarId(),
      nome: nome,
      criadoEm: new Date().toISOString(),
      cavidades: {}
    };
    estado.moldes.push(molde);
    persistir();
    montarMoldes();
    avisar('Molde ' + nome + ' adicionado.', 'ok');
    return molde;
  }

  function acharMolde(id) {
    return estado.moldes.filter(function (m) { return m.id === id; })[0] || null;
  }

  /* ---------------------------------------------------------------
     Painel de cavidades
     --------------------------------------------------------------- */
  function abrirMolde(id) {
    const molde = acharMolde(id);
    if (!molde) return;
    moldeAberto = id;
    elementoFoco = document.activeElement;

    $('#painelTitulo').textContent = molde.nome;
    montarCavidades(molde);

    const painel = $('#painelCavidades');
    mostrar(painel);
    document.body.style.overflow = 'hidden';
    painel.querySelector('[data-fechar-painel]').focus();
  }

  function montarCavidades(molde) {
    const grade = $('#gradeCavidades');
    grade.innerHTML = '';
    const st = Avaliacao.statusMolde(molde);

    for (let i = 1; i <= CONFIG_INSPECAO.cavidadesPorMolde; i++) {
      const dados = molde.cavidades[String(i)] || {};
      const s = Avaliacao.statusCavidade(dados);

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'cavidade';
      if (s.nok) botao.classList.add('is-nok');
      else if (s.completa) botao.classList.add('is-ok');

      let etiqueta;
      if (s.nok) etiqueta = '<span class="etiqueta etiqueta--nok">NOK</span>';
      else if (s.completa) etiqueta = '<span class="etiqueta etiqueta--ok">OK</span>';
      else if (s.situacao === 'parcial') etiqueta = '<span class="etiqueta etiqueta--parcial">Parcial</span>';
      else etiqueta = '<span class="etiqueta etiqueta--neutra">Vazia</span>';

      botao.innerHTML =
        '<span class="cavidade__numero">' + i + '</span>' +
        '<span class="cavidade__rotulo">' + esc(CONFIG_INSPECAO.rotuloCavidade) + ' ' + i + '</span>' +
        etiqueta;

      botao.setAttribute('aria-label',
        CONFIG_INSPECAO.rotuloCavidade + ' ' + i + ' — ' +
        (s.nok ? 'não conforme' : s.completa ? 'preenchida' : 'pendente'));

      (function (numero) {
        botao.addEventListener('click', function () { abrirCavidade(numero); });
      })(i);

      grade.appendChild(botao);
    }

    $('#painelProgresso').textContent = st.completas + ' / ' + st.total;
  }

  function fecharPainel() {
    esconder($('#painelCavidades'));
    moldeAberto = null;
    document.body.style.overflow = '';
    if (elementoFoco) { elementoFoco.focus(); elementoFoco = null; }
  }

  /* ---------------------------------------------------------------
     Modal da cavidade
     --------------------------------------------------------------- */
  function abrirCavidade(numero) {
    const molde = acharMolde(moldeAberto);
    if (!molde) return;

    cavidadeAberta = numero;
    rascunho = Object.assign({}, molde.cavidades[String(numero)] || {});

    $('#modalKicker').textContent = 'Molde ' + molde.nome;
    $('#modalTitulo').textContent = CONFIG_INSPECAO.rotuloCavidade + ' ' + numero;

    const nota = $('#modalNota');
    nota.textContent = CONFIG_INSPECAO.notaInspecao || '';
    nota.hidden = !CONFIG_INSPECAO.notaInspecao;

    const form = $('#formCavidade');
    form.innerHTML = '';

    CONFIG_INSPECAO.secoes.forEach(function (secao) {
      const bloco = document.createElement('section');
      bloco.className = 'secao';

      const titulo = document.createElement('h3');
      titulo.className = 'secao__titulo';
      titulo.textContent = secao.titulo;
      bloco.appendChild(titulo);

      const campos = document.createElement('div');
      campos.className = 'secao__campos';

      secao.campos.forEach(function (campo) {
        campos.appendChild(criarCampo(campo, rascunho[campo.id], function (id, valor) {
          rascunho[id] = valor;
          pintarCampo(form, CONFIG_INSPECAO.mapaCampos[id], valor);
          pintarConferencias(form, rascunho);
        }));
      });

      bloco.appendChild(campos);
      form.appendChild(bloco);
    });

    /* Pintura inicial */
    CONFIG_INSPECAO.todosCampos.forEach(function (campo) {
      pintarCampo(form, campo, rascunho[campo.id]);
    });
    pintarConferencias(form, rascunho);

    const modal = $('#modalCavidade');
    mostrar(modal);
    modal.querySelector('.modal__corpo').scrollTop = 0;

    const primeiro = form.querySelector('input, select, textarea');
    if (primeiro) primeiro.focus();
  }

  function salvarCavidade() {
    const molde = acharMolde(moldeAberto);
    if (!molde || cavidadeAberta == null) return;

    /* Grava as conferências calculadas junto com os dados. */
    CONFIG_INSPECAO.todosCampos.forEach(function (campo) {
      if (campo.tipo === 'conferencia') {
        rascunho[campo.id] = Avaliacao.conferencia(campo, rascunho).valor;
      }
    });

    molde.cavidades[String(cavidadeAberta)] = rascunho;
    persistir();

    const st = Avaliacao.statusCavidade(rascunho);
    montarCavidades(molde);
    montarMoldes();
    fecharModal();

    if (st.nok) {
      avisar(CONFIG_INSPECAO.rotuloCavidade + ' ' + cavidadeAberta +
        ' salva — medida fora da tolerância (NOK).', 'erro');
    } else {
      avisar(CONFIG_INSPECAO.rotuloCavidade + ' ' + cavidadeAberta + ' salva.', 'ok');
    }
  }

  function fecharModal() {
    esconder($('#modalCavidade'));
    cavidadeAberta = null;
    rascunho = {};
  }

  /* ---------------------------------------------------------------
     Ações gerais
     --------------------------------------------------------------- */
  /* ---------------------------------------------------------------
     Navegação entre as páginas (Registros / Dashboard)
     --------------------------------------------------------------- */
  function irPara(pagina) {
    const ehDashboard = pagina === 'dashboard';

    const registros = $('#paginaRegistros');
    const dashboard = $('#paginaDashboard');
    registros.hidden = ehDashboard;
    registros.style.display = ehDashboard ? 'none' : '';
    dashboard.hidden = !ehDashboard;
    dashboard.style.display = ehDashboard ? '' : 'none';

    document.querySelectorAll('.aba').forEach(function (aba) {
      const ativa = aba.dataset.pagina === pagina;
      aba.classList.toggle('is-ativa', ativa);
      if (ativa) aba.setAttribute('aria-current', 'page');
      else aba.removeAttribute('aria-current');
    });

    /* O dashboard é sempre recalculado ao abrir: os dados mudam na
       outra página e ele precisa refletir o estado atual. */
    if (ehDashboard) Dashboard.renderizar(estado);

    if (window.location.hash !== '#' + pagina) {
      history.replaceState(null, '', '#' + pagina);
    }
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------
     Ligações de eventos
     --------------------------------------------------------------- */
  function ligarEventos() {
    /* Cabeçalho recolhível */
    $('#btnToggleCabecalho').addEventListener('click', function () {
      const aberto = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!aberto));
    });

    /* Adicionar molde */
    $('#formAdicionarMolde').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const input = $('#inputNovoMolde');
      const molde = adicionarMolde(input.value);
      if (molde) { input.value = ''; input.focus(); }
    });

    /* Painel */
    document.querySelectorAll('[data-fechar-painel]').forEach(function (el) {
      el.addEventListener('click', fecharPainel);
    });

    $('#btnExcluirMolde').addEventListener('click', function () {
      const molde = acharMolde(moldeAberto);
      if (!molde) return;
      const st = Avaliacao.statusMolde(molde);
      const aviso = st.completas > 0
        ? 'O molde ' + molde.nome + ' tem ' + st.completas +
          ' cavidade(s) preenchida(s). Excluir mesmo assim?'
        : 'Excluir o molde ' + molde.nome + '?';
      if (!window.confirm(aviso)) return;
      estado.moldes = estado.moldes.filter(function (m) { return m.id !== molde.id; });
      persistir();
      fecharPainel();
      montarMoldes();
      avisar('Molde ' + molde.nome + ' excluído.');
    });

    /* Modal */
    document.querySelectorAll('[data-fechar-modal]').forEach(function (el) {
      el.addEventListener('click', fecharModal);
    });

    $('#btnSalvarCavidade').addEventListener('click', salvarCavidade);

    $('#btnLimparCavidade').addEventListener('click', function () {
      if (!window.confirm('Apagar todos os dados desta cavidade?')) return;
      const molde = acharMolde(moldeAberto);
      if (molde && cavidadeAberta != null) {
        delete molde.cavidades[String(cavidadeAberta)];
        persistir();
        montarCavidades(molde);
        montarMoldes();
      }
      fecharModal();
      avisar('Cavidade limpa.');
    });

    /* ESC fecha o overlay do topo */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!$('#modalCavidade').hidden) fecharModal();
      else if (!$('#painelCavidades').hidden) fecharPainel();
    });

    /* Exportação e arquivos */
    $('#btnExportar').addEventListener('click', function () {
      const r = Exportador.exportarXlsx(estado);
      if (r.ok) avisar('Planilha "' + r.arquivo + '" gerada.', 'ok');
      else avisar(r.erro, 'erro');
    });

    document.querySelectorAll('.aba').forEach(function (aba) {
      aba.addEventListener('click', function () { irPara(this.dataset.pagina); });
    });

    $('#btnLimpar').addEventListener('click', function () {
      if (!window.confirm(
        'Isso apaga o cabeçalho e TODOS os moldes salvos neste navegador. Continuar?'
      )) return;
      Armazenamento.limpar();
      estado = Armazenamento.estadoInicial();
      montarCabecalho();
      montarMoldes();
      avisar('Inspeção limpa.');
    });
  }

  /* ---------------------------------------------------------------
     Início
     --------------------------------------------------------------- */
  function iniciar() {
    /* Overlays sempre começam fechados, aconteça o que acontecer com o CSS. */
    esconder($('#painelCavidades'));
    esconder($('#modalCavidade'));
    document.body.style.overflow = '';

    $('#tituloApp').textContent = CONFIG_INSPECAO.titulo;
    $('#subtituloApp').textContent = CONFIG_INSPECAO.subtitulo;
    document.title = CONFIG_INSPECAO.titulo + ' | Rumo';

    /* Preenche a data de hoje na primeira abertura. */
    if (!estado.cabecalho.data) {
      const hoje = new Date();
      estado.cabecalho.data = hoje.getFullYear() + '-' +
        String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
        String(hoje.getDate()).padStart(2, '0');
    }

    montarCabecalho();
    montarMoldes();
    ligarEventos();

    Sincronizacao.iniciar(function () { return estado; }, function (sync) {
      const indicador = $('#indicadorSalvo');
      const texto = $('#salvoTexto');
      if (!indicador || !texto) return;

      if (sync.tipo === 'enviando') {
        indicador.classList.add('is-gravando');
        texto.textContent = 'Sincronizando com o banco…';
      } else if (sync.tipo === 'sincronizado') {
        indicador.classList.remove('is-gravando');
        texto.textContent = 'Salvo e sincronizado';
      } else if (sync.tipo === 'erro-local') {
        indicador.classList.remove('is-gravando');
        texto.textContent = 'Falha no salvamento local';
      } else {
        indicador.classList.remove('is-gravando');
        texto.textContent = 'Salvo no navegador · aguardando internet';
      }
    });

    irPara(window.location.hash === '#dashboard' ? 'dashboard' : 'registros');

    if (!Armazenamento.disponivel()) {
      avisar('Este navegador bloqueou o armazenamento local — os dados não serão salvos.', 'erro');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
