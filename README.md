# Medidas FMT — Inspeção das distâncias das ombreiras

Aplicação web para o **inspetor de campo** registrar as medidas de ombreiras dos
dormentes de concreto do trecho da via permanente, direto do celular ou do
computador. Visual seguindo o [brand book da Rumo](https://brandbook.rumolog.com/).

🔗 **Site:** https://erwinklein94.github.io/Medidas-FMT/

---

O site tem duas páginas: **Registros**, onde o inspetor anota, e **Dashboard**,
onde a inspeção vira estatística.

## Página de Registros

1. **Dados da inspeção** — preenche uma vez: data, local, inspetor responsável
   e observações.
2. **Moldes** — adiciona cada molde inspecionado (ex.: `01`, `02`, `A-14`).
3. **Cavidades** — ao clicar num molde, abrem as **6 cavidades** (6 dormentes).
4. **Medidas** — ao clicar numa cavidade, abre o formulário com os campos da
   planilha oficial. Tudo é salvo no navegador e sincronizado com o Supabase.
5. **Exportar Excel** — gera o `.xlsx` com todas as cavidades preenchidas.

## Página de Dashboard

Calculada ao vivo a partir das cavidades preenchidas:

- **Indicadores** — conformidade das medidas, cavidades medidas, medidas fora
  da tolerância e o menor Cpk do lote.
- **Média e desvio padrão por medida** — cada uma das 6 medidas com sua média
  (ponto), ±1 desvio padrão (barra) e a faixa de tolerância ao fundo.
- **Carta de controle** — cada cavidade na ordem em que foi medida, com LIE,
  LSE e a média; pontos verdes dentro da faixa, vermelhos fora.
- **Distribuição dos desvios** — histograma que mostra se o processo está
  centrado no nominal ou puxando para um lado.
- **Situação das cavidades por molde** — barras de conforme / não conforme /
  não medida.
- **Estatísticas por medida** — tabela com n, média, desvio padrão, mín., máx.,
  **Cp**, **Cpk** e o percentual de conformes.

> Os gráficos que comparam medidas diferentes usam o **desvio em relação ao
> nominal**, não o valor absoluto: as medidas vão de ~154 mm a ~1834 mm, e
> plotar as duas no mesmo eixo exigiria dois eixos — que inventam correlação.
> Em desvio, todas dividem a mesma escala e a mesma tolerância.

Cp e Cpk medem a capacidade do processo: abaixo de **1,00** a variação não cabe
na tolerância; **1,33** é a referência usual de processo capaz.

### Conferência automática OK / NOK

As medidas são comparadas com a tolerância de projeto (**+1,5 / −0,5 mm**).
Se o valor ficar **abaixo do mínimo ou acima do máximo**, o campo fica
**vermelho** e a conferência do bloco vira **NOK** — na tela e também no
arquivo Excel exportado.

| Bloco | Medida | Nominal | Faixa aceitável |
|---|---|---|---|
| Ombreiras externas | Mesa (W,X) | 1834,12 mm | 1833,62 a 1835,62 mm |
| Ombreiras externas | Ombreira (A,B) | 1834,67 mm | 1834,17 a 1836,17 mm |
| Lado A | Mesa (W,X) | 154,50 mm | 154,00 a 156,00 mm |
| Lado A | Ombreira (A,B) | 155,55 mm | 155,05 a 157,05 mm |
| Lado B | Mesa (W,X) | 154,50 mm | 154,00 a 156,00 mm |
| Lado B | Ombreira (A,B) | 155,55 mm | 155,05 a 157,05 mm |

> Para inspecionar o dormente, é necessário se posicionar de frente para a
> inscrição (CAVAN e RUMO).

---

## Versão offline (arquivo único)

`Medidas-FMT-offline.html` é o site inteiro num só arquivo — CSS, JavaScript,
logos e a biblioteca de Excel embutidos. **Funciona sem internet nenhuma**, o
que importa no trecho sem sinal, e serve de plano B quando o GitHub Pages está
indisponível.

Basta baixar e abrir com duplo clique, ou mandar por WhatsApp para o celular do
inspetor. Não precisa instalar nada.

Para regerar depois de mexer no código:

```bash
powershell -ExecutionPolicy Bypass -File ferramentas/gerar-offline.ps1
```

> O script monta tudo com operações literais de string, nunca com o operador
> `-replace` do PowerShell: ele interpreta `$&` e `$1` na substituição, e código
> JavaScript é cheio de cifrões — isso corrompe o arquivo em silêncio.

---

## Onde os dados ficam

Cada alteração é salva primeiro no navegador (`localStorage`). Em seguida, uma
fila envia snapshots da inspeção ao projeto Supabase. Se o celular estiver sem
internet, a fila permanece no navegador e volta a tentar automaticamente ao
reconectar, ao reabrir a página e periodicamente enquanto a página estiver aberta.

A entrega em **Exportar Excel** continua disponível (`.xlsx`, 3 abas:
Cabeçalho, Medidas e Resumo por molde).

⚠️ Não limpe os dados de navegação enquanto o indicador mostrar que ainda está
aguardando internet. Isso também apagaria a fila que ainda não chegou ao banco.

---

## Estrutura do projeto

```
index.html              Estrutura da página
css/rumo.css            Tokens da marca Rumo (cores, fonte, raio, sombra)
css/app.css             Estilos da aplicação
js/campos.js            ⭐ Campos coletados — único arquivo a editar p/ mudar o formulário
js/avaliacao.js         Regras de tolerância e cálculo de OK / NOK
js/armazenamento.js     Salvamento local imediato (localStorage)
js/dados-exemplo.js     Base temporária de 20 moldes para o dashboard
js/sincronizacao.js     Fila offline e envio automático ao Supabase
js/exportar.js          Geração do .xlsx com formatação
js/dashboard.js         Estatísticas e gráficos SVG do dashboard
js/app.js               Telas, navegação e eventos
ferramentas/            Gerador da versão offline em arquivo único
docs/                   Planilha original que originou o formulário
.github/workflows/      Publicação automática no GitHub Pages
```

### Como mudar os campos coletados

Todo o formulário — cabeçalho, seções, campos, unidades e tolerâncias — vem de
[`js/campos.js`](js/campos.js). Editar aquele arquivo atualiza automaticamente a
tela, a validação de tolerância e as colunas do Excel. Nenhum outro arquivo
precisa ser tocado.

---

## Desenvolvimento

O site é **estático puro**, sem build. Para rodar localmente basta abrir o
`index.html` no navegador, ou servir a pasta:

```bash
python -m http.server 8000
```

O deploy acontece sozinho a cada `push` na branch `main`, pelo workflow
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Dependências

- [`xlsx-js-style`](https://github.com/gitbrent/xlsx-js-style) via CDN — gera o
  Excel com formatação no próprio navegador.

### Tipografia

A fonte institucional **Cera Pro** é paga e não pode ser redistribuída, então o
projeto a declara na frente do stack e cai para **Verdana**, o fallback oficial
indicado pelo manual da marca.
