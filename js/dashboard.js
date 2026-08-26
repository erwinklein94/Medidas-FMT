/* =====================================================================
   DASHBOARD — Medidas FMT
   ---------------------------------------------------------------------
   Estatísticas e gráficos das medidas registradas nas cavidades.

   Os gráficos são SVG desenhado à mão, sem biblioteca: o arquivo offline
   precisa funcionar sem internet, e assim as cores saem exatamente do
   brand book da Rumo.

   Decisão de escala: os gráficos que comparam medidas diferentes usam o
   DESVIO EM RELAÇÃO AO NOMINAL (mm), nunca o valor absoluto. As medidas
   vão de ~154 mm a ~1834 mm; plotar as duas no mesmo eixo exigiria dois
   eixos, que inventam correlação. Em desvio, todas compartilham a mesma
   escala e a mesma faixa de tolerância.
   ===================================================================== */

const Dashboard = (function () {
  'use strict';

  /* Paleta Rumo. Verde/vermelho são cores de ESTADO (conforme/não
     conforme) e não são reaproveitadas como "série 3". */
  const COR = {
    marca:       '#32A6E6',
    escura:      '#003865',
    ok:          '#1E9F7F',
    nok:         '#D84545',
    neutro:      '#CAD6DD',
    grade:       '#E5EBEE',
    tinta:       '#4D626F',
    tintaClara:  '#6F838E',
    faixa:       'rgba(30, 159, 127, 0.10)',
    superficie:  '#FFFFFF'
  };

  const FONTE = '"Cera Pro", Verdana, Geneva, Tahoma, sans-serif';

  /* ---------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------- */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmt(n, casas) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: casas === undefined ? 2 : casas,
      maximumFractionDigits: casas === undefined ? 2 : casas,
      useGrouping: false
    });
  }

  function comSinal(n, casas) {
    if (!Number.isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + fmt(n, casas);
  }

  /* Medidas numéricas com limites — as que entram nos gráficos. */
  function medidas() {
    return CONFIG_INSPECAO.todosCampos.filter(function (c) {
      return c.tipo === 'numero' && c.min !== undefined && c.max !== undefined;
    });
  }

  function rotulo(campo) {
    return campo.secaoCurto + ' · ' + campo.label;
  }

  /* ---------------------------------------------------------------
     Coleta e estatísticas
     --------------------------------------------------------------- */
  function coletar(estado) {
    const lista = medidas();
    const porMedida = {};
    const pontos = [];

    lista.forEach(function (c) { porMedida[c.id] = []; });

    estado.moldes.forEach(function (molde) {
      for (let n = 1; n <= CONFIG_INSPECAO.cavidadesPorMolde; n++) {
        const dados = molde.cavidades[String(n)];
        if (!dados) continue;
        lista.forEach(function (campo) {
          const v = Avaliacao.numero(dados[campo.id]);
          if (v === null) return;
          const status = Avaliacao.statusCampo(campo, dados[campo.id]);
          const ponto = {
            molde: molde.nome,
            cavidade: n,
            campo: campo,
            valor: v,
            desvio: v - campo.nominal,
            nok: Avaliacao.ehNok(status)
          };
          porMedida[campo.id].push(ponto);
          pontos.push(ponto);
        });
      }
    });

    return { lista: lista, porMedida: porMedida, pontos: pontos };
  }

  function estatisticas(pontos, campo) {
    const vals = pontos.map(function (p) { return p.valor; });
    const n = vals.length;
    if (!n) {
      return { n: 0, media: null, dp: null, min: null, max: null,
               cp: null, cpk: null, nok: 0, conformes: 0 };
    }

    const media = vals.reduce(function (a, b) { return a + b; }, 0) / n;
    /* desvio padrão amostral (n-1): estamos amostrando a produção */
    const dp = n > 1
      ? Math.sqrt(vals.reduce(function (a, v) {
          return a + Math.pow(v - media, 2);
        }, 0) / (n - 1))
      : 0;

    const nok = pontos.filter(function (p) { return p.nok; }).length;

    let cp = null, cpk = null;
    if (dp > 0) {
      cp = (campo.max - campo.min) / (6 * dp);
      cpk = Math.min((campo.max - media) / (3 * dp), (media - campo.min) / (3 * dp));
    }

    return {
      n: n, media: media, dp: dp,
      min: Math.min.apply(null, vals),
      max: Math.max.apply(null, vals),
      cp: cp, cpk: cpk,
      nok: nok, conformes: n - nok
    };
  }

  /* ---------------------------------------------------------------
     Blocos de SVG
     --------------------------------------------------------------- */
  function abreSvg(largura, altura, rotuloAcessivel) {
    return '<svg viewBox="0 0 ' + largura + ' ' + altura + '" role="img" ' +
      'aria-label="' + esc(rotuloAcessivel) + '" ' +
      'preserveAspectRatio="xMidYMid meet" ' +
      'style="width:100%;height:auto;display:block;font-family:' + FONTE + '">';
  }

  function texto(x, y, conteudo, opcoes) {
    const o = opcoes || {};
    return '<text x="' + x + '" y="' + y + '"' +
      ' fill="' + (o.cor || COR.tinta) + '"' +
      ' font-size="' + (o.tamanho || 11) + '"' +
      (o.peso ? ' font-weight="' + o.peso + '"' : '') +
      (o.ancora ? ' text-anchor="' + o.ancora + '"' : '') +
      (o.tabular ? ' style="font-variant-numeric:tabular-nums"' : '') +
      '>' + esc(conteudo) + '</text>';
  }

  function linha(x1, y1, x2, y2, cor, espessura) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + cor + '" stroke-width="' + (espessura || 1) +
      '" stroke-linecap="round"/>';
  }

  /* marca com dica de contexto (o tooltip é montado em ligarDicas) */
  function dica(texto) {
    return ' data-dica="' + esc(texto) + '" tabindex="0" focusable="true"';
  }

  /* ---------------------------------------------------------------
     Gráfico 1 — Média e desvio padrão por medida
     Horizontal, uma linha por medida, eixo em desvio do nominal.
     --------------------------------------------------------------- */
  function graficoMedias(dados) {
    const lista = dados.lista;
    /* margemEsq acomoda o rótulo mais longo ("Externas · Ombreira (A,B)");
       baseEixo separa os ticks da legenda do eixo. */
    const L = 760, margemEsq = 190, margemDir = 62, alturaLinha = 40;
    const topo = 16, baseEixo = 46;
    const A = topo + lista.length * alturaLinha + baseEixo;
    const x0 = margemEsq, x1 = L - margemDir;

    /* domínio: cobre tolerâncias e média ± desvio padrão */
    let dmin = 0, dmax = 0;
    lista.forEach(function (campo) {
      const e = estatisticas(dados.porMedida[campo.id], campo);
      dmin = Math.min(dmin, campo.min - campo.nominal);
      dmax = Math.max(dmax, campo.max - campo.nominal);
      if (e.n) {
        dmin = Math.min(dmin, e.media - e.dp - campo.nominal);
        dmax = Math.max(dmax, e.media + e.dp - campo.nominal);
      }
    });
    const folga = (dmax - dmin) * 0.12 || 0.5;
    dmin -= folga; dmax += folga;
    const px = function (d) { return x0 + (d - dmin) / (dmax - dmin) * (x1 - x0); };

    let s = abreSvg(L, A, 'Média e desvio padrão de cada medida, em desvio do nominal');

    /* grade vertical em valores redondos */
    const passo = (dmax - dmin) > 4 ? 1 : 0.5;
    for (let t = Math.ceil(dmin / passo) * passo; t <= dmax; t += passo) {
      const x = px(t);
      s += linha(x, topo, x, topo + lista.length * alturaLinha, COR.grade, 1);
      s += texto(x, A - 26, comSinal(t, passo < 1 ? 1 : 0),
        { ancora: 'middle', tamanho: 10, cor: COR.tintaClara, tabular: true });
    }
    s += texto((x0 + x1) / 2, A - 6, 'desvio em relação ao nominal (mm)',
      { ancora: 'middle', tamanho: 10, cor: COR.tintaClara });

    lista.forEach(function (campo, i) {
      const y = topo + i * alturaLinha + alturaLinha / 2;
      const e = estatisticas(dados.porMedida[campo.id], campo);

      /* faixa de tolerância da própria medida */
      const bx0 = px(campo.min - campo.nominal), bx1 = px(campo.max - campo.nominal);
      s += '<rect x="' + bx0 + '" y="' + (y - 13) + '" width="' + (bx1 - bx0) +
        '" height="26" fill="' + COR.faixa + '" rx="3"' +
        dica(rotulo(campo) + ' — tolerância ' +
             comSinal(campo.min - campo.nominal, 2) + ' a ' +
             comSinal(campo.max - campo.nominal, 2) + ' mm') + '/>';

      /* nominal */
      s += linha(px(0), y - 13, px(0), y + 13, COR.neutro, 1);

      s += texto(margemEsq - 12, y + 4, rotulo(campo),
        { ancora: 'end', tamanho: 11, peso: '700', cor: COR.escura });

      if (!e.n) {
        s += texto(px(0) + 10, y + 4, 'sem medidas',
          { tamanho: 10, cor: COR.tintaClara });
        return;
      }

      const dMedia = e.media - campo.nominal;
      const a = px(dMedia - e.dp), b = px(dMedia + e.dp);

      /* ±1 desvio padrão */
      if (e.dp > 0) {
        s += linha(a, y, b, y, COR.marca, 2);
        s += linha(a, y - 5, a, y + 5, COR.marca, 2);
        s += linha(b, y - 5, b, y + 5, COR.marca, 2);
      }

      /* média (anel na cor da superfície para não sumir sobre a faixa) */
      s += '<circle cx="' + px(dMedia) + '" cy="' + y + '" r="5" fill="' + COR.marca +
        '" stroke="' + COR.superficie + '" stroke-width="2"' +
        dica(rotulo(campo) + ' — média ' + fmt(e.media, 2) + ' mm (' +
             comSinal(dMedia, 2) + '), desvio padrão ' + fmt(e.dp, 3) +
             ' mm, n = ' + e.n) + '/>';

      /* rótulo direto só na média: o que a linha existe para contar */
      s += texto(x1 + 8, y + 4, comSinal(dMedia, 2),
        { tamanho: 10, peso: '700', cor: COR.tinta, tabular: true });
    });

    s += '</svg>';
    return s;
  }

  /* ---------------------------------------------------------------
     Gráfico 2 — Carta de controle de uma medida
     --------------------------------------------------------------- */
  function graficoControle(dados, campoId) {
    const campo = CONFIG_INSPECAO.mapaCampos[campoId];
    const pontos = dados.porMedida[campoId] || [];
    const L = 760, A = 300;
    const margem = { topo: 18, dir: 74, base: 46, esq: 64 };
    const x0 = margem.esq, x1 = L - margem.dir;
    const y0 = margem.topo, y1 = A - margem.base;

    if (!pontos.length) {
      return abreSvg(L, 120, 'Sem medidas') +
        texto(L / 2, 60, 'Nenhuma medida registrada para este item.',
          { ancora: 'middle', cor: COR.tintaClara }) + '</svg>';
    }

    const e = estatisticas(pontos, campo);
    let vmin = Math.min(campo.min, e.min), vmax = Math.max(campo.max, e.max);
    const folga = (vmax - vmin) * 0.15 || 0.5;
    vmin -= folga; vmax += folga;

    const py = function (v) { return y1 - (v - vmin) / (vmax - vmin) * (y1 - y0); };
    const px = pontos.length === 1
      ? function () { return (x0 + x1) / 2; }
      : function (i) { return x0 + i / (pontos.length - 1) * (x1 - x0); };

    let s = abreSvg(L, A, 'Carta de controle de ' + rotulo(campo));

    /* faixa de tolerância */
    s += '<rect x="' + x0 + '" y="' + py(campo.max) + '" width="' + (x1 - x0) +
      '" height="' + (py(campo.min) - py(campo.max)) + '" fill="' + COR.faixa + '"/>';

    /* grade horizontal */
    const passos = 4;
    for (let k = 0; k <= passos; k++) {
      const v = vmin + (vmax - vmin) * k / passos;
      s += linha(x0, py(v), x1, py(v), COR.grade, 1);
      s += texto(x0 - 8, py(v) + 4, fmt(v, 2),
        { ancora: 'end', tamanho: 10, cor: COR.tintaClara, tabular: true });
    }

    /* limites e média */
    s += linha(x0, py(campo.max), x1, py(campo.max), COR.nok, 1);
    s += texto(x1 + 6, py(campo.max) + 4, 'LSE ' + fmt(campo.max, 2),
      { tamanho: 9, peso: '700', cor: COR.tinta, tabular: true });
    s += linha(x0, py(campo.min), x1, py(campo.min), COR.nok, 1);
    s += texto(x1 + 6, py(campo.min) + 4, 'LIE ' + fmt(campo.min, 2),
      { tamanho: 9, peso: '700', cor: COR.tinta, tabular: true });
    s += linha(x0, py(e.media), x1, py(e.media), COR.escura, 1);
    s += texto(x1 + 6, py(e.media) + 4, 'média',
      { tamanho: 9, peso: '700', cor: COR.tinta });

    /* ligação entre os pontos */
    if (pontos.length > 1) {
      const d = pontos.map(function (p, i) {
        return (i ? 'L' : 'M') + px(i) + ' ' + py(p.valor);
      }).join(' ');
      s += '<path d="' + d + '" fill="none" stroke="' + COR.marca +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.45"/>';
    }

    /* pontos, coloridos pelo estado */
    pontos.forEach(function (p, i) {
      s += '<circle cx="' + px(i) + '" cy="' + py(p.valor) + '" r="4.5" fill="' +
        (p.nok ? COR.nok : COR.ok) + '" stroke="' + COR.superficie + '" stroke-width="2"' +
        dica('Molde ' + p.molde + ' · cavidade ' + p.cavidade + ' — ' +
             fmt(p.valor, 2) + ' mm (' + (p.nok ? 'NOK' : 'OK') + ')') + '/>';
    });

    /* eixo x: rotula o primeiro, o último e o meio, para não virar sopa */
    const marcar = pontos.length <= 6
      ? pontos.map(function (_, i) { return i; })
      : [0, Math.floor((pontos.length - 1) / 2), pontos.length - 1];
    marcar.forEach(function (i) {
      s += texto(px(i), y1 + 16, pontos[i].molde + '/' + pontos[i].cavidade,
        { ancora: 'middle', tamanho: 9, cor: COR.tintaClara });
    });
    s += texto((x0 + x1) / 2, A - 6, 'molde / cavidade, na ordem de medição',
      { ancora: 'middle', tamanho: 10, cor: COR.tintaClara });

    s += '</svg>';
    return s;
  }

  /* ---------------------------------------------------------------
     Gráfico 3 — Histograma dos desvios
     --------------------------------------------------------------- */
  function graficoHistograma(dados) {
    const pontos = dados.pontos;
    const L = 520, A = 260;
    const margem = { topo: 16, dir: 16, base: 46, esq: 40 };
    const x0 = margem.esq, x1 = L - margem.dir;
    const y0 = margem.topo, y1 = A - margem.base;

    if (!pontos.length) {
      return abreSvg(L, 110, 'Sem medidas') +
        texto(L / 2, 56, 'Nenhuma medida registrada.',
          { ancora: 'middle', cor: COR.tintaClara }) + '</svg>';
    }

    const desvios = pontos.map(function (p) { return p.desvio; });
    /* a faixa de tolerância é a mesma para todas as medidas em desvio */
    const campoRef = dados.lista[0];
    const tolMin = campoRef.min - campoRef.nominal;
    const tolMax = campoRef.max - campoRef.nominal;

    let dmin = Math.min(tolMin, Math.min.apply(null, desvios));
    let dmax = Math.max(tolMax, Math.max.apply(null, desvios));
    const folga = (dmax - dmin) * 0.08 || 0.2;
    dmin -= folga; dmax += folga;

    const nBins = 12;
    const larguraBin = (dmax - dmin) / nBins;
    const bins = new Array(nBins).fill(0);
    desvios.forEach(function (d) {
      let k = Math.floor((d - dmin) / larguraBin);
      if (k >= nBins) k = nBins - 1;
      if (k < 0) k = 0;
      bins[k]++;
    });
    const maxBin = Math.max.apply(null, bins) || 1;

    const px = function (d) { return x0 + (d - dmin) / (dmax - dmin) * (x1 - x0); };
    const py = function (c) { return y1 - c / maxBin * (y1 - y0); };

    let s = abreSvg(L, A, 'Distribuição dos desvios em relação ao nominal');

    s += '<rect x="' + px(tolMin) + '" y="' + y0 + '" width="' + (px(tolMax) - px(tolMin)) +
      '" height="' + (y1 - y0) + '" fill="' + COR.faixa + '"/>';

    for (let k = 0; k <= 4; k++) {
      const c = maxBin * k / 4;
      s += linha(x0, py(c), x1, py(c), COR.grade, 1);
      s += texto(x0 - 7, py(c) + 4, String(Math.round(c)),
        { ancora: 'end', tamanho: 10, cor: COR.tintaClara, tabular: true });
    }

    const passoBin = (x1 - x0) / nBins;
    bins.forEach(function (c, k) {
      if (!c) return;
      /* 2px de superfície separando as colunas vizinhas */
      const largura = Math.min(passoBin - 2, 24);
      const cx = x0 + (k + 0.5) * passoBin;
      const altura = y1 - py(c);
      s += '<rect x="' + (cx - largura / 2) + '" y="' + py(c) + '" width="' + largura +
        '" height="' + altura + '" fill="' + COR.marca + '" rx="3"' +
        dica(c + ' medida(s) entre ' + comSinal(dmin + k * larguraBin, 2) +
             ' e ' + comSinal(dmin + (k + 1) * larguraBin, 2) + ' mm') + '/>';
    });

    s += linha(px(0), y0, px(0), y1, COR.neutro, 1);

    [dmin, 0, dmax].forEach(function (d) {
      s += texto(px(d), y1 + 16, comSinal(d, 1),
        { ancora: 'middle', tamanho: 10, cor: COR.tintaClara, tabular: true });
    });
    s += texto((x0 + x1) / 2, A - 6, 'desvio do nominal (mm) · faixa clara = tolerância',
      { ancora: 'middle', tamanho: 10, cor: COR.tintaClara });

    s += '</svg>';
    return s;
  }

  /* ---------------------------------------------------------------
     Gráfico 4 — Situação das cavidades por molde (barras empilhadas)
     --------------------------------------------------------------- */
  function graficoMoldes(estado) {
    const L = 520;
    const alturaLinha = 32, topo = 30, base = 12, margemEsq = 76, margemDir = 16;
    const moldes = estado.moldes;
    const A = topo + Math.max(moldes.length, 1) * alturaLinha + base;
    const x0 = margemEsq, x1 = L - margemDir;
    const total = CONFIG_INSPECAO.cavidadesPorMolde;

    let s = abreSvg(L, A, 'Situação das cavidades de cada molde');

    /* legenda: três séries, então ela é obrigatória */
    const legenda = [
      { cor: COR.ok, nome: 'Conforme' },
      { cor: COR.nok, nome: 'Não conforme' },
      { cor: COR.neutro, nome: 'Não medida' }
    ];
    let lx = margemEsq;
    legenda.forEach(function (item) {
      s += '<rect x="' + lx + '" y="8" width="10" height="10" rx="2" fill="' + item.cor + '"/>';
      s += texto(lx + 15, 17, item.nome, { tamanho: 10, cor: COR.tinta });
      lx += 16 + item.nome.length * 5.6 + 14;
    });

    if (!moldes.length) {
      s += texto(L / 2, topo + 24, 'Nenhum molde cadastrado.',
        { ancora: 'middle', cor: COR.tintaClara });
      return s + '</svg>';
    }

    moldes.forEach(function (molde, i) {
      const st = Avaliacao.statusMolde(molde);
      let ok = 0, nok = 0;
      st.porCavidade.forEach(function (c) {
        if (c.nok) nok++;
        else if (c.completa) ok++;
      });
      const naoMedida = total - ok - nok;

      const y = topo + i * alturaLinha + 6;
      const alturaBarra = 16;
      const larguraTotal = x1 - x0;

      s += texto(margemEsq - 10, y + 12, 'Molde ' + molde.nome,
        { ancora: 'end', tamanho: 10, peso: '700', cor: COR.escura });

      let cursor = x0;
      [{ q: ok, cor: COR.ok, nome: 'conforme' },
       { q: nok, cor: COR.nok, nome: 'não conforme' },
       { q: naoMedida, cor: COR.neutro, nome: 'não medida' }].forEach(function (seg) {
        if (!seg.q) return;
        /* 2px de superfície separando os segmentos empilhados */
        const largura = seg.q / total * larguraTotal - 2;
        if (largura <= 0) { cursor += seg.q / total * larguraTotal; return; }
        s += '<rect x="' + cursor + '" y="' + y + '" width="' + largura +
          '" height="' + alturaBarra + '" rx="3" fill="' + seg.cor + '"' +
          dica('Molde ' + molde.nome + ' — ' + seg.q + ' cavidade(s) ' + seg.nome) + '/>';
        /* rótulo dentro do segmento apenas quando cabe com folga */
        if (largura >= 22) {
          s += texto(cursor + largura / 2, y + 12, String(seg.q), {
            ancora: 'middle', tamanho: 10, peso: '700',
            cor: seg.cor === COR.neutro ? COR.escura : '#FFFFFF'
          });
        }
        cursor += seg.q / total * larguraTotal;
      });
    });

    s += '</svg>';
    return s;
  }

  /* ---------------------------------------------------------------
     Tabela — a leitura sem cor de tudo que os gráficos mostram
     --------------------------------------------------------------- */
  function tabela(dados) {
    let h = '<thead><tr>' +
      ['Medida', 'Nominal', 'Faixa aceitável', 'n', 'Média', 'Desvio padrão',
       'Mín.', 'Máx.', 'Cp', 'Cpk', 'Conformes'].map(function (t) {
        return '<th>' + esc(t) + '</th>';
      }).join('') + '</tr></thead><tbody>';

    dados.lista.forEach(function (campo) {
      const e = estatisticas(dados.porMedida[campo.id], campo);
      const pct = e.n ? Math.round(e.conformes / e.n * 100) : null;
      const cpkClasse = e.cpk === null ? '' : (e.cpk < 1 ? ' class="ruim"' :
                        (e.cpk < 1.33 ? ' class="atencao"' : ' class="bom"'));

      h += '<tr>' +
        '<th scope="row">' + esc(rotulo(campo)) + '</th>' +
        '<td>' + fmt(campo.nominal, 2) + '</td>' +
        '<td>' + fmt(campo.min, 2) + ' a ' + fmt(campo.max, 2) + '</td>' +
        '<td>' + e.n + '</td>' +
        '<td>' + fmt(e.media, 2) + '</td>' +
        '<td>' + fmt(e.dp, 3) + '</td>' +
        '<td>' + fmt(e.min, 2) + '</td>' +
        '<td>' + fmt(e.max, 2) + '</td>' +
        '<td>' + fmt(e.cp, 2) + '</td>' +
        '<td' + cpkClasse + '>' + fmt(e.cpk, 2) + '</td>' +
        '<td>' + (pct === null ? '—' : e.conformes + '/' + e.n + ' (' + pct + '%)') + '</td>' +
        '</tr>';
    });

    return h + '</tbody>';
  }

  /* ---------------------------------------------------------------
     Indicadores do topo
     --------------------------------------------------------------- */
  function indicadores(estado, dados) {
    const totalMedidas = dados.pontos.length;
    const nok = dados.pontos.filter(function (p) { return p.nok; }).length;
    const pct = totalMedidas ? Math.round((totalMedidas - nok) / totalMedidas * 100) : 0;

    let cavidadesMedidas = 0;
    const cavidadesTotais = estado.moldes.length * CONFIG_INSPECAO.cavidadesPorMolde;
    estado.moldes.forEach(function (molde) {
      Avaliacao.statusMolde(molde).porCavidade.forEach(function (c) {
        if (c.situacao !== 'vazia') cavidadesMedidas++;
      });
    });

    let piorCpk = null, piorNome = '';
    dados.lista.forEach(function (campo) {
      const e = estatisticas(dados.porMedida[campo.id], campo);
      if (e.cpk === null) return;
      if (piorCpk === null || e.cpk < piorCpk) { piorCpk = e.cpk; piorNome = rotulo(campo); }
    });

    document.getElementById('kpiConformidade').textContent = pct + '%';
    document.getElementById('kpiConformidadeNota').textContent =
      totalMedidas ? (totalMedidas - nok) + ' de ' + totalMedidas + ' medidas dentro da tolerância'
                   : 'Sem medidas registradas';

    document.getElementById('kpiCavidades').textContent =
      cavidadesMedidas + ' / ' + cavidadesTotais;
    document.getElementById('kpiCavidadesNota').textContent =
      estado.moldes.length + ' molde(s) cadastrado(s)';

    const elNok = document.getElementById('kpiNok');
    elNok.textContent = String(nok);
    elNok.className = 'indicador__valor' + (nok ? ' is-nok' : ' is-ok');
    document.getElementById('kpiNokNota').textContent =
      nok ? 'Exigem tratativa' : 'Nenhuma medida fora da faixa';

    const elCpk = document.getElementById('kpiCpk');
    elCpk.textContent = piorCpk === null ? '—' : fmt(piorCpk, 2);
    elCpk.className = 'indicador__valor' +
      (piorCpk === null ? '' : (piorCpk < 1 ? ' is-nok' : (piorCpk < 1.33 ? '' : ' is-ok')));
    document.getElementById('kpiCpkNota').textContent = piorCpk === null
      ? 'Precisa de ao menos 2 medidas por item'
      : piorNome;
  }

  /* ---------------------------------------------------------------
     Dica flutuante (hover e teclado) — os valores nunca dependem dela:
     a tabela de estatísticas traz tudo.
     --------------------------------------------------------------- */
  let elDica = null;

  function ligarDicas(raiz) {
    if (!elDica) {
      elDica = document.createElement('div');
      elDica.className = 'dica';
      elDica.hidden = true;
      document.body.appendChild(elDica);
    }

    function mostrar(alvo) {
      const t = alvo.getAttribute('data-dica');
      if (!t) return;
      elDica.textContent = t;
      elDica.hidden = false;
      const r = alvo.getBoundingClientRect();
      const d = elDica.getBoundingClientRect();
      let x = r.left + r.width / 2 - d.width / 2;
      x = Math.max(8, Math.min(x, window.innerWidth - d.width - 8));
      let y = r.top - d.height - 10;
      if (y < 8) y = r.bottom + 10;
      elDica.style.left = x + 'px';
      elDica.style.top = y + 'px';
    }

    function esconder() { if (elDica) elDica.hidden = true; }

    raiz.addEventListener('mouseover', function (ev) {
      const alvo = ev.target.closest ? ev.target.closest('[data-dica]') : null;
      if (alvo) mostrar(alvo);
    });
    raiz.addEventListener('mouseout', esconder);
    raiz.addEventListener('focusin', function (ev) {
      const alvo = ev.target.closest ? ev.target.closest('[data-dica]') : null;
      if (alvo) mostrar(alvo);
    });
    raiz.addEventListener('focusout', esconder);
    window.addEventListener('scroll', esconder, { passive: true });
  }

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */
  let medidaSelecionada = null;
  let dicasLigadas = false;
  let estadoAtual = null;   /* o seletor precisa do estado mais recente, não do da 1ª carga */

  function renderizar(estado) {
    estadoAtual = estado;
    const dados = coletar(estado);
    const vazio = document.getElementById('vazioDashboard');
    const conteudo = document.getElementById('conteudoDashboard');

    const temDados = dados.pontos.length > 0;
    vazio.hidden = temDados;
    conteudo.hidden = !temDados;
    conteudo.style.display = temDados ? '' : 'none';
    if (!temDados) return;

    indicadores(estado, dados);

    /* seletor da carta de controle */
    const seletor = document.getElementById('seletorMedida');
    if (seletor.options.length !== dados.lista.length) {
      seletor.innerHTML = dados.lista.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(rotulo(c)) + '</option>';
      }).join('');
    }
    if (!medidaSelecionada || !CONFIG_INSPECAO.mapaCampos[medidaSelecionada]) {
      medidaSelecionada = dados.lista[0].id;
    }
    seletor.value = medidaSelecionada;

    document.getElementById('graficoMedias').innerHTML = graficoMedias(dados);
    document.getElementById('graficoControle').innerHTML =
      graficoControle(dados, medidaSelecionada);
    document.getElementById('graficoHistograma').innerHTML = graficoHistograma(dados);
    document.getElementById('graficoMoldes').innerHTML = graficoMoldes(estado);
    document.getElementById('tabelaEstatisticas').innerHTML = tabela(dados);

    if (!dicasLigadas) {
      ligarDicas(document.getElementById('paginaDashboard'));
      seletor.addEventListener('change', function () {
        medidaSelecionada = this.value;
        document.getElementById('graficoControle').innerHTML =
          graficoControle(coletar(estadoAtual), medidaSelecionada);
      });
      dicasLigadas = true;
    }
  }

  return { renderizar: renderizar, estatisticas: estatisticas, coletar: coletar };
})();
