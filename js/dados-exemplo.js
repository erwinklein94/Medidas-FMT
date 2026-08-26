/* =====================================================================
   DADOS TEMPORARIOS PARA VISUALIZACAO DO DASHBOARD
   ---------------------------------------------------------------------
   Cria 20 moldes completos somente quando o navegador ainda nao possui
   moldes. Todos os registros recebem identificadores "exemplo-*" e o
   estado fica marcado com modoExemplo para permitir remocao posterior.
   ===================================================================== */

const DadosExemplo = (function () {
  'use strict';

  function arredondar(valor) { return Number(valor.toFixed(2)); }

  function variacao(indice, amplitude) {
    /* Sequencia deterministica, evitando que os graficos mudem a cada carga. */
    return (((indice * 37) % 17) - 8) / 8 * amplitude;
  }

  function criarCavidade(indice) {
    let extMesa = 1834.12 + variacao(indice, 0.42);
    let extOmbreira = 1834.67 + variacao(indice + 3, 0.42);
    let aMesa = 154.50 + variacao(indice + 6, 0.42);
    let aOmbreira = 155.55 + variacao(indice + 9, 0.42);
    let bMesa = 154.50 + variacao(indice + 12, 0.42);
    let bOmbreira = 155.55 + variacao(indice + 15, 0.42);

    /* Alguns pontos fora da tolerancia deixam os graficos e KPIs informativos. */
    if (indice % 19 === 0) extMesa = 1835.88;
    if (indice % 23 === 0) aOmbreira = 154.82;
    if (indice % 31 === 0) bMesa = 156.24;

    const dados = {
      ext_mesa: arredondar(extMesa),
      ext_ombreira: arredondar(extOmbreira),
      a_mesa: arredondar(aMesa),
      a_ombreira: arredondar(aOmbreira),
      b_mesa: arredondar(bMesa),
      b_ombreira: arredondar(bOmbreira)
    };

    dados.ext_conf = Avaliacao.conferencia(CONFIG_INSPECAO.mapaCampos.ext_conf, dados).valor;
    dados.a_conf = Avaliacao.conferencia(CONFIG_INSPECAO.mapaCampos.a_conf, dados).valor;
    dados.b_conf = Avaliacao.conferencia(CONFIG_INSPECAO.mapaCampos.b_conf, dados).valor;

    const nok = dados.ext_conf === 'NOK' || dados.a_conf === 'NOK' || dados.b_conf === 'NOK';
    dados.situacao = nok ? 'Não conforme' : 'Conforme';
    dados.acao = nok ? 'Reinspecionar' : 'Liberar';
    dados.obsCavidade = nok
      ? 'Exemplo temporário com medida fora da tolerância.'
      : 'Exemplo temporário para visualização do dashboard.';
    return dados;
  }

  function aplicar(estado) {
    if (!estado) return false;
    estado.cabecalhos = estado.cabecalhos || [];
    let cabecalhosCriados = false;
    while (estado.cabecalhos.length < 2) {
      estado.cabecalhos.push({ id: Armazenamento.criarGrupoId(), dados: {} });
      cabecalhosCriados = true;
    }
    const moldesAtuais = Array.isArray(estado.moldes) ? estado.moldes : [];
    const exemplosAtuais = moldesAtuais.filter(function (molde) {
      return String(molde.id || '').indexOf('exemplo-molde-') === 0;
    });
    if (exemplosAtuais.length === 20) return cabecalhosCriados;

    /* Preserva qualquer coleta real que ja exista e recompõe apenas a base exemplo. */
    const moldesReais = moldesAtuais.filter(function (molde) {
      return String(molde.id || '').indexOf('exemplo-molde-') !== 0;
    });

    const agora = new Date();
    const data = agora.getFullYear() + '-' +
      String(agora.getMonth() + 1).padStart(2, '0') + '-' +
      String(agora.getDate()).padStart(2, '0');

    estado.modoExemplo = true;
    let grupo = estado.cabecalhos[0];
    if (!grupo) {
      grupo = { id: Armazenamento.criarGrupoId(), dados: {} };
      estado.cabecalhos.push(grupo);
    }
    if (!moldesReais.length) grupo.dados = Object.assign({
      data: data, local: 'Base demonstrativa', pista: 'Pista exemplo', lote: 'Lote exemplo', responsavel: 'Dados de exemplo'
    }, grupo.dados);

    estado.moldes = moldesReais;
    for (let molde = 1; molde <= 20; molde++) {
      const cavidades = {};
      for (let cavidade = 1; cavidade <= CONFIG_INSPECAO.cavidadesPorMolde; cavidade++) {
        const indice = (molde - 1) * CONFIG_INSPECAO.cavidadesPorMolde + cavidade;
        cavidades[String(cavidade)] = criarCavidade(indice);
      }
      estado.moldes.push({
        id: 'exemplo-molde-' + String(molde).padStart(2, '0'),
        nome: 'EX-' + String(molde).padStart(2, '0'),
        criadoEm: new Date(agora.getTime() - (20 - molde) * 3600000).toISOString(),
        cavidades: cavidades,
        grupoId: grupo.id
      });
    }
    return true;
  }

  return { aplicar: aplicar };
})();
