# Medidas FMT — Inspeção das distâncias das ombreiras

Aplicação web para o **inspetor de campo** registrar as medidas de ombreiras dos
dormentes de concreto do trecho da via permanente, direto do celular ou do
computador. Visual seguindo o [brand book da Rumo](https://brandbook.rumolog.com/).

🔗 **Site:** https://erwinklein94.github.io/Medidas-FMT/

---

## Como o inspetor usa

1. **Dados da inspeção** — preenche uma vez: data, pista, local, trecho, KM,
   lote, responsável, matrícula e turno.
2. **Moldes** — adiciona cada molde inspecionado (ex.: `01`, `02`, `A-14`).
3. **Cavidades** — ao clicar num molde, abrem as **6 cavidades** (6 dormentes).
4. **Medidas** — ao clicar numa cavidade, abre o formulário com os campos da
   planilha oficial. Tudo é salvo automaticamente no navegador.
5. **Exportar Excel** — gera o `.xlsx` com todas as cavidades preenchidas.

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

Hoje: **apenas no navegador do inspetor** (`localStorage`). Nada é enviado a
servidor nenhum. Para não perder o registro:

- **Exportar Excel** — entrega final da inspeção (`.xlsx`, 3 abas).
- **Salvar JSON** — backup do trabalho em andamento, que pode ser recarregado
  depois com **Importar JSON** (útil para continuar em outro aparelho).

⚠️ Limpar os dados de navegação do celular apaga a inspeção não exportada.

### Migração futura para o Supabase

Toda a persistência está isolada em [`js/armazenamento.js`](js/armazenamento.js).
Para migrar, basta reimplementar `carregar()` e `salvar()` chamando o client do
Supabase — o restante da aplicação não precisa mudar.

---

## Estrutura do projeto

```
index.html              Estrutura da página
css/rumo.css            Tokens da marca Rumo (cores, fonte, raio, sombra)
css/app.css             Estilos da aplicação
js/campos.js            ⭐ Campos coletados — único arquivo a editar p/ mudar o formulário
js/avaliacao.js         Regras de tolerância e cálculo de OK / NOK
js/armazenamento.js     Persistência (localStorage hoje, Supabase depois)
js/exportar.js          Geração do .xlsx com formatação
js/app.js               Telas, navegação e eventos
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
