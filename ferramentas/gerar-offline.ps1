# =====================================================================
# Gera o Medidas-FMT-offline.html — arquivo único, autossuficiente.
#
# Junta index.html + CSS + JS + logos + a biblioteca de Excel num só
# arquivo, que funciona sem internet nenhuma. Pensado para o inspetor
# em trecho sem sinal, e como plano B quando o GitHub Pages está fora.
#
# Uso (na raiz do repositório):
#   powershell -ExecutionPolicy Bypass -File ferramentas\gerar-offline.ps1
#
# IMPORTANTE: aqui não se usa o operador -replace para inserir código.
# O PowerShell interpreta $& e $1 na string de substituição, e o código
# JavaScript é cheio de cifrões — isso corrompe o arquivo em silêncio.
# Por isso toda a montagem usa IndexOf/Substring e .Replace() literais.
# =====================================================================

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$saida = Join-Path $raiz 'Medidas-FMT-offline.html'
$libLocal = Join-Path $PSScriptRoot 'xlsx.bundle.js'
$libUrl = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'

function Ler($caminhoRelativo) {
  Get-Content (Join-Path $raiz $caminhoRelativo) -Raw -Encoding UTF8
}

function ComoDataUri($caminhoRelativo, $mime) {
  $bytes = [System.IO.File]::ReadAllBytes((Join-Path $raiz $caminhoRelativo))
  "data:$mime;base64," + [Convert]::ToBase64String($bytes)
}

# Troca o trecho entre duas âncoras (inclusive) por um texto literal.
function TrocarBloco([string]$texto, [string]$inicio, [string]$fim, [string]$novo) {
  $i = $texto.IndexOf($inicio)
  if ($i -lt 0) { throw "Âncora inicial não encontrada: $inicio" }
  $j = $texto.IndexOf($fim, $i)
  if ($j -lt 0) { throw "Âncora final não encontrada: $fim" }
  $j += $fim.Length
  return $texto.Substring(0, $i) + $novo + $texto.Substring($j)
}

# --- biblioteca de Excel (baixa uma vez e guarda ao lado do script) ---
if (-not (Test-Path $libLocal)) {
  Write-Host 'Baixando a biblioteca de Excel...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest $libUrl -OutFile $libLocal -UseBasicParsing -TimeoutSec 120
}
$lib = Get-Content $libLocal -Raw -Encoding UTF8

$html = Ler 'index.html'

# --- CSS ---
$css = (Ler 'css/rumo.css') + "`n" + (Ler 'css/app.css')
$html = TrocarBloco $html `
  '<link rel="stylesheet" href="css/rumo.css' `
  '<link rel="stylesheet" href="css/app.css?v=2">' `
  ("<style>`n" + $css + "`n  </style>")

# --- JS: biblioteca + aplicação, na mesma ordem do index.html ---
$arquivos = @('js/campos.js','js/avaliacao.js','js/armazenamento.js','js/exportar.js','js/app.js')
$js = ($arquivos | ForEach-Object { "/* ===== $_ ===== */`n" + (Ler $_) }) -join "`n"

$html = TrocarBloco $html `
  '<!-- xlsx-js-style' `
  '<script src="js/app.js?v=2"></script>' `
  ("<script>`n" + $lib + "`n</script>`n<script>`n" + $js + "`n</script>")

# --- imagens como data URI ---
$html = $html.Replace('assets/rumo/rumo-logo-branco.png', (ComoDataUri 'assets/rumo/rumo-logo-branco.png' 'image/png'))
$html = $html.Replace('assets/rumo/rumo-logo-azul.png',   (ComoDataUri 'assets/rumo/rumo-logo-azul.png' 'image/png'))

# --- marca que esta versão é a offline ---
$html = $html.Replace(
  'Rumo — Qualidade de Via Permanente · Os dados ficam salvos apenas neste navegador.',
  'Rumo — Qualidade de Via Permanente · Versão offline: funciona sem internet. Os dados ficam salvos apenas neste navegador.')

[System.IO.File]::WriteAllText($saida, $html, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("Gerado: {0} ({1:N0} KB)" -f $saida, ((Get-Item $saida).Length / 1KB))

# --- conferências ---
$c = Get-Content $saida -Raw -Encoding UTF8
$problemas = @()
if ($c -match '<link rel="stylesheet"')  { $problemas += 'sobrou <link> de CSS' }
if ($c -match '<script src=')            { $problemas += 'sobrou <script src>' }
if ($c -match 'assets/rumo/')            { $problemas += 'sobrou caminho de imagem' }
if ($c -notmatch 'CONFIG_INSPECAO')      { $problemas += 'campos.js nao foi embutido' }
if ($c -notmatch 'const Avaliacao')      { $problemas += 'avaliacao.js nao foi embutido' }
if ($c -notmatch 'const Armazenamento')  { $problemas += 'armazenamento.js nao foi embutido' }
if ($c -notmatch 'const Exportador')     { $problemas += 'exportar.js nao foi embutido' }
if ($c -notmatch 'function iniciar')     { $problemas += 'app.js nao foi embutido' }
if (([regex]::Matches($c, 'CONFIG_INSPECAO = \{')).Count -ne 1) { $problemas += 'codigo duplicado no arquivo' }

if ($problemas.Count) {
  Write-Host ('FALHOU: ' + ($problemas -join '; ')) -ForegroundColor Red
  exit 1
}
Write-Host 'OK: arquivo autossuficiente, sem referencias externas e sem duplicacao.' -ForegroundColor Green
