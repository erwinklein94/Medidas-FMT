/* =====================================================================
   EXPORTAÇÃO PARA EXCEL (.xlsx) — Medidas FMT
   ---------------------------------------------------------------------
   Gera o arquivo no próprio navegador com a biblioteca xlsx-js-style.
   Três abas:
     1. Cabeçalho        — dados gerais da inspeção
     2. Medidas          — uma linha por cavidade, com todas as medidas
     3. Resumo por molde — contagem de cavidades OK / NOK / pendentes

   Medidas fora da tolerância e conferências NOK saem em VERMELHO.
   ===================================================================== */

const Exportador = (function () {

  /* ---- Paleta Rumo no formato do Excel (ARGB, sem "#") ---- */
  const AZUL        = '003865';
  const AZUL_CLARO  = '32A6E6';
  const CINZA_50    = 'F2F5F6';
  const CINZA_BORDA = 'D7E0E5';
  const VERDE       = '1E9F7F';
  const VERMELHO    = 'D84545';
  const FONTE       = 'Verdana';

  function borda() {
    const l = { style: 'thin', color: { rgb: CINZA_BORDA } };
    return { top: l, bottom: l, left: l, right: l };
  }

  function estiloTitulo() {
    return {
      font: { name: FONTE, sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: AZUL } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
  }

  function estiloSecao() {
    return {
      font: { name: FONTE, sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: AZUL_CLARO } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: borda()
    };
  }

  function estiloColuna() {
    return {
      font: { name: FONTE, sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: AZUL } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: borda()
    };
  }

  function estiloCelula(extra) {
    return Object.assign({
      font: { name: FONTE, sz: 10, color: { rgb: '1F2B33' } },
      alignment: { vertical: 'center', wrapText: false },
      border: borda()
    }, extra || {});
  }

  function estiloNok() {
    return {
      font: { name: FONTE, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: VERMELHO } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: borda()
    };
  }

  function estiloOk() {
    return {
      font: { name: FONTE, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: VERDE } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: borda()
    };
  }

  function estiloNa() {
    return {
      font: { name: FONTE, sz: 10, bold: true, color: { rgb: '4D626F' } },
      fill: { fgColor: { rgb: CINZA_50 } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: borda()
    };
  }

  function ref(l, c) {
    return XLSX.utils.encode_cell({ r: l, c: c });
  }

  /* Grava uma célula com valor e estilo. */
  function por(ws, l, c, valor, estilo, formatoNumero) {
    const celula = { v: valor === undefined || valor === null ? '' : valor };
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      celula.t = 'n';
      if (formatoNumero) celula.z = formatoNumero;
    } else {
      celula.t = 's';
      celula.v = String(celula.v);
    }
    if (estilo) celula.s = estilo;
    ws[ref(l, c)] = celula;
  }

  function fecharPlanilha(ws, linhas, colunas) {
    ws['!ref'] = XLSX.utils.encode_range(
      { s: { r: 0, c: 0 }, e: { r: Math.max(linhas - 1, 0), c: Math.max(colunas - 1, 0) } }
    );
    return ws;
  }

  /* ---------------------------------------------------------------
     Aba 1 — Cabeçalho
     --------------------------------------------------------------- */
  function abaCabecalho(estado) {
    const ws = {};
    let l = 0;

    por(ws, l, 0, CONFIG_INSPECAO.titulo.toUpperCase() + ' — ' + CONFIG_INSPECAO.subtitulo,
      estiloTitulo());
    por(ws, l, 1, '', estiloTitulo());
    ws['!merges'] = [{ s: { r: l, c: 0 }, e: { r: l, c: 1 } }];
    ws['!rows'] = [{ hpt: 26 }];
    l += 2;

    por(ws, l, 0, 'Campo', estiloColuna());
    por(ws, l, 1, 'Valor', estiloColuna());
    l++;

    CONFIG_INSPECAO.cabecalho.forEach(function (campo) {
      let valor = estado.cabecalho[campo.id];
      if (campo.tipo === 'checkbox') valor = valor ? 'Sim' : 'Não';
      por(ws, l, 0, campo.label, estiloCelula({
        font: { name: FONTE, sz: 10, bold: true, color: { rgb: '003865' } },
        fill: { fgColor: { rgb: CINZA_50 } },
        border: borda()
      }));
      por(ws, l, 1, valor === undefined || valor === null ? '' : valor, estiloCelula());
      l++;
    });

    l++;
    por(ws, l, 0, 'Exportado em', estiloCelula({
      font: { name: FONTE, sz: 9, italic: true, color: { rgb: '6F838E' } }, border: borda()
    }));
    por(ws, l, 1, new Date().toLocaleString('pt-BR'), estiloCelula({
      font: { name: FONTE, sz: 9, italic: true, color: { rgb: '6F838E' } }, border: borda()
    }));
    l++;

    if (CONFIG_INSPECAO.notaInspecao) {
      por(ws, l, 0, 'Observação', estiloCelula({
        font: { name: FONTE, sz: 9, bold: true, color: { rgb: '003865' } }, border: borda()
      }));
      por(ws, l, 1, CONFIG_INSPECAO.notaInspecao, estiloCelula());
      l++;
    }

    ws['!cols'] = [{ wch: 26 }, { wch: 62 }];
    return fecharPlanilha(ws, l, 2);
  }

  /* ---------------------------------------------------------------
     Aba 2 — Medidas (uma linha por cavidade)
     --------------------------------------------------------------- */
  function abaMedidas(estado) {
    const ws = {};
    const merges = [];
    const cols = [];

    /* Colunas fixas de identificação + colunas vindas de campos.js */
    const fixas = ['Pista', 'Molde', 'Cavidade'];
    const campos = CONFIG_INSPECAO.todosCampos;

    /* --- Linha 0: seções --- */
    fixas.forEach(function (nome, i) {
      por(ws, 0, i, i === 0 ? 'Identificação' : '', estiloSecao());
      cols.push({ wch: nome === 'Cavidade' ? 11 : 14 });
    });
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: fixas.length - 1 } });

    let c = fixas.length;
    let inicioSecao = c;
    let secaoAtual = campos.length ? campos[0].secaoId : null;

    campos.forEach(function (campo, i) {
      if (campo.secaoId !== secaoAtual) {
        merges.push({ s: { r: 0, c: inicioSecao }, e: { r: 0, c: c - 1 } });
        inicioSecao = c;
        secaoAtual = campo.secaoId;
      }
      por(ws, 0, c, c === inicioSecao ? campo.secao : '', estiloSecao());
      cols.push({ wch: campo.tipo === 'textarea' ? 34 : (campo.tipo === 'numero' ? 15 : 20) });
      c++;
      if (i === campos.length - 1) {
        merges.push({ s: { r: 0, c: inicioSecao }, e: { r: 0, c: c - 1 } });
      }
    });

    /* Coluna final de situação */
    const colSituacao = c;
    por(ws, 0, colSituacao, 'Resultado', estiloSecao());
    cols.push({ wch: 16 });
    c++;

    /* --- Linha 1: nomes das colunas (com a faixa aceitável) --- */
    fixas.forEach(function (nome, i) { por(ws, 1, i, nome, estiloColuna()); });

    c = fixas.length;
    campos.forEach(function (campo) {
      let titulo = campo.label;
      if (campo.unidade) titulo += ' (' + campo.unidade + ')';
      if (Avaliacao.temLimites(campo)) {
        titulo += '\nAceitável: ' + Avaliacao.faixa(campo);
      }
      por(ws, 1, c, titulo, estiloColuna());
      c++;
    });
    por(ws, 1, colSituacao, 'Situação da cavidade', estiloColuna());

    /* --- Dados --- */
    let l = 2;
    let totalLinhas = 0;

    estado.moldes.forEach(function (molde) {
      for (let n = 1; n <= CONFIG_INSPECAO.cavidadesPorMolde; n++) {
        const dados = molde.cavidades[String(n)] || {};
        const st = Avaliacao.statusCavidade(dados);

        por(ws, l, 0, estado.cabecalho.pista || '', estiloCelula());
        por(ws, l, 1, molde.nome, estiloCelula({
          font: { name: FONTE, sz: 10, bold: true, color: { rgb: '003865' } }, border: borda()
        }));
        por(ws, l, 2, n, estiloCelula({
          alignment: { vertical: 'center', horizontal: 'center' },
          font: { name: FONTE, sz: 10, bold: true, color: { rgb: '003865' } },
          border: borda()
        }), '0');

        let col = fixas.length;
        campos.forEach(function (campo) {
          const bruto = dados[campo.id];

          if (campo.tipo === 'conferencia') {
            const res = Avaliacao.conferencia(campo, dados);
            const estilo = res.valor === 'NOK' ? estiloNok()
                         : res.valor === 'OK' ? estiloOk() : estiloNa();
            por(ws, l, col, res.valor, estilo);

          } else if (campo.tipo === 'numero') {
            const num = Avaliacao.numero(bruto);
            const status = Avaliacao.statusCampo(campo, bruto);
            const casas = campo.casas === undefined ? 2 : campo.casas;
            const formato = '0.' + '0'.repeat(casas);
            const estilo = Avaliacao.ehNok(status) ? estiloNok() : estiloCelula({
              alignment: { vertical: 'center', horizontal: 'center' },
              border: borda(),
              font: { name: FONTE, sz: 10, color: { rgb: '1F2B33' } }
            });
            if (num === null) por(ws, l, col, '', estiloCelula());
            else por(ws, l, col, num, estilo, formato);

          } else if (campo.tipo === 'checkbox') {
            por(ws, l, col, bruto ? 'Sim' : 'Não', estiloCelula({
              alignment: { vertical: 'center', horizontal: 'center' }, border: borda()
            }));

          } else {
            por(ws, l, col, bruto == null ? '' : bruto, estiloCelula());
          }
          col++;
        });

        let rotulo, estiloSit;
        if (st.nok) { rotulo = 'NOK'; estiloSit = estiloNok(); }
        else if (st.completa) { rotulo = 'OK'; estiloSit = estiloOk(); }
        else if (st.situacao === 'parcial') { rotulo = 'Parcial'; estiloSit = estiloNa(); }
        else { rotulo = 'Não medida'; estiloSit = estiloNa(); }
        por(ws, l, colSituacao, rotulo, estiloSit);

        l++;
        totalLinhas++;
      }
    });

    ws['!cols'] = cols;
    ws['!merges'] = merges;
    ws['!rows'] = [{ hpt: 18 }, { hpt: 34 }];
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range(
        { s: { r: 1, c: 0 }, e: { r: Math.max(l - 1, 1), c: colSituacao } }
      )
    };
    ws['!freeze'] = {
      xSplit: '3', ySplit: '2', topLeftCell: 'D3',
      activePane: 'bottomRight', state: 'frozen'
    };

    return { ws: fecharPlanilha(ws, l, colSituacao + 1), linhas: totalLinhas };
  }

  /* ---------------------------------------------------------------
     Aba 3 — Resumo por molde
     --------------------------------------------------------------- */
  function abaResumo(estado) {
    const ws = {};
    const cabecalhos = ['Molde', 'Cavidades', 'Preenchidas', 'NOK', 'Pendentes', 'Situação'];
    cabecalhos.forEach(function (h, i) { por(ws, 0, i, h, estiloColuna()); });

    let l = 1;
    estado.moldes.forEach(function (molde) {
      const st = Avaliacao.statusMolde(molde);
      const pendentes = st.total - st.completas;

      por(ws, l, 0, molde.nome, estiloCelula({
        font: { name: FONTE, sz: 10, bold: true, color: { rgb: '003865' } }, border: borda()
      }));
      por(ws, l, 1, st.total, estiloCelula(), '0');
      por(ws, l, 2, st.completas, estiloCelula(), '0');
      por(ws, l, 3, st.nok, st.nok ? estiloNok() : estiloCelula(), '0');
      por(ws, l, 4, pendentes, estiloCelula(), '0');

      let rotulo, estilo;
      if (st.nok) { rotulo = 'Com NOK'; estilo = estiloNok(); }
      else if (st.completas === st.total) { rotulo = 'Completo'; estilo = estiloOk(); }
      else { rotulo = 'Em andamento'; estilo = estiloNa(); }
      por(ws, l, 5, rotulo, estilo);
      l++;
    });

    ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 13 }, { wch: 8 }, { wch: 12 }, { wch: 16 }];
    return fecharPlanilha(ws, l, cabecalhos.length);
  }

  /* ---------------------------------------------------------------
     Exportação
     --------------------------------------------------------------- */
  function nomeArquivo(estado) {
    const partes = ['Medidas-FMT'];
    if (estado.cabecalho.pista) partes.push('Pista-' + estado.cabecalho.pista);
    partes.push(estado.cabecalho.data || new Date().toISOString().slice(0, 10));
    return partes.join('_').replace(/[\\/:*?"<>|]/g, '-') + '.xlsx';
  }

  function exportarXlsx(estado) {
    if (typeof XLSX === 'undefined') {
      return { ok: false, erro: 'Biblioteca de Excel não carregou. Verifique a conexão.' };
    }
    if (!estado.moldes.length) {
      return { ok: false, erro: 'Adicione ao menos um molde antes de exportar.' };
    }

    const medidas = abaMedidas(estado);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, abaCabecalho(estado), 'Cabeçalho');
    XLSX.utils.book_append_sheet(wb, medidas.ws, 'Medidas');
    XLSX.utils.book_append_sheet(wb, abaResumo(estado), 'Resumo por molde');

    const arquivo = nomeArquivo(estado);
    try {
      XLSX.writeFile(wb, arquivo, { compression: true });
      return { ok: true, arquivo: arquivo, linhas: medidas.linhas };
    } catch (e) {
      console.error(e);
      return { ok: false, erro: 'Não foi possível gerar a planilha: ' + e.message };
    }
  }

  return { exportarXlsx: exportarXlsx, nomeArquivo: nomeArquivo };
})();
