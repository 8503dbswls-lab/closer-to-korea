$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ArticlePayloadPath = Join-Path $Root "C008_article_payload.json"
$AliasPayloadPath = Join-Path $Root "C008_search_aliases_payload.json"

# The patch folder must be placed in the repository root.
$ArticlesPath = Join-Path $Root "data\articles.json"
$ContentDataPath = Join-Path $Root "data\content-data.js"
$AliasesPath = Join-Path $Root "data\search-aliases.json"
$SitemapPath = Join-Path $Root "sitemap.xml"

$Required = @($ArticlesPath, $ContentDataPath, $AliasesPath, $SitemapPath, $ArticlePayloadPath, $AliasPayloadPath)
foreach ($Path in $Required) {
    if (-not (Test-Path $Path)) {
        Write-Host ""
        Write-Host "ERROR: Required file not found:" -ForegroundColor Red
        Write-Host $Path
        Write-Host ""
        Write-Host "Put ALL files from this patch ZIP in the ROOT folder of the closer-to-korea repository."
        Read-Host "Press Enter to close"
        exit 1
    }
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $Root ("backup_before_C008_" + $Stamp)
New-Item -ItemType Directory -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BackupDir "data") | Out-Null

Copy-Item $ArticlesPath (Join-Path $BackupDir "data\articles.json")
Copy-Item $ContentDataPath (Join-Path $BackupDir "data\content-data.js")
Copy-Item $AliasesPath (Join-Path $BackupDir "data\search-aliases.json")
Copy-Item $SitemapPath (Join-Path $BackupDir "sitemap.xml")

$Article = Get-Content $ArticlePayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$AliasList = @(Get-Content $AliasPayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$Slug = [string]$Article.slug

# ----------------------------------------------------------
# 1) data/articles.json
# ----------------------------------------------------------
$Articles = @(Get-Content $ArticlesPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$NewArticles = @()
$Replaced = $false

foreach ($Item in $Articles) {
    if ([string]$Item.slug -eq $Slug) {
        $NewArticles += $Article
        $Replaced = $true
    } else {
        $NewArticles += $Item
    }
}
if (-not $Replaced) {
    $NewArticles += $Article
}

$ArticlesJson = $NewArticles | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($ArticlesPath, $ArticlesJson + [Environment]::NewLine, $Utf8NoBom)

# ----------------------------------------------------------
# 2) data/content-data.js fallback
# ----------------------------------------------------------
$ContentText = [System.IO.File]::ReadAllText($ContentDataPath)
$Match = [regex]::Match(
    $ContentText,
    '^\s*window\.__CTK_DATA__\s*=\s*(\{[\s\S]*\})\s*;\s*$'
)

if (-not $Match.Success) {
    throw "Could not parse data/content-data.js. Backup was created; no need to panic."
}

$Fallback = $Match.Groups[1].Value | ConvertFrom-Json
$FallbackArticles = @($Fallback.articles)
$NewFallbackArticles = @()
$FallbackReplaced = $false

foreach ($Item in $FallbackArticles) {
    if ([string]$Item.slug -eq $Slug) {
        $NewFallbackArticles += $Article
        $FallbackReplaced = $true
    } else {
        $NewFallbackArticles += $Item
    }
}
if (-not $FallbackReplaced) {
    $NewFallbackArticles += $Article
}
$Fallback.articles = $NewFallbackArticles

$FallbackJson = $Fallback | ConvertTo-Json -Depth 100 -Compress
[System.IO.File]::WriteAllText(
    $ContentDataPath,
    "window.__CTK_DATA__ = " + $FallbackJson + ";" + [Environment]::NewLine,
    $Utf8NoBom
)

# ----------------------------------------------------------
# 3) data/search-aliases.json
# ----------------------------------------------------------
$SearchData = Get-Content $AliasesPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $SearchData.articles) {
    $SearchData | Add-Member -NotePropertyName "articles" -NotePropertyValue ([PSCustomObject]@{})
}

$ExistingProperty = $SearchData.articles.PSObject.Properties[$Slug]
if ($ExistingProperty) {
    $SearchData.articles.$Slug = $AliasList
} else {
    $SearchData.articles | Add-Member -NotePropertyName $Slug -NotePropertyValue $AliasList
}

$SearchJson = $SearchData | ConvertTo-Json -Depth 50
[System.IO.File]::WriteAllText($AliasesPath, $SearchJson + [Environment]::NewLine, $Utf8NoBom)

# ----------------------------------------------------------
# 4) sitemap.xml
# ----------------------------------------------------------
$ArticleUrl = "https://closertokorea.com/article.html?slug=storage-chairs-korean-bbq-restaurants"
$Sitemap = [System.IO.File]::ReadAllText($SitemapPath)

if ($Sitemap -notmatch [regex]::Escape($ArticleUrl)) {
    $Entry = "  <url><loc>$ArticleUrl</loc></url>" + [Environment]::NewLine
    $Sitemap = $Sitemap -replace '</urlset>', ($Entry + '</urlset>')
    [System.IO.File]::WriteAllText($SitemapPath, $Sitemap, $Utf8NoBom)
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " C-008 publish patch applied successfully" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Updated:"
Write-Host " - data/articles.json"
Write-Host " - data/content-data.js"
Write-Host " - data/search-aliases.json"
Write-Host " - sitemap.xml"
Write-Host ""
Write-Host "Backup:"
Write-Host " - $BackupDir"
Write-Host ""
Write-Host "Next:"
Write-Host " 1. Open GitHub Desktop"
Write-Host " 2. Confirm the four changed files"
Write-Host " 3. Commit: Publish Korean BBQ storage chair article"
Write-Host " 4. Push origin"
Write-Host ""
Write-Host "After deployment:"
Write-Host " https://closertokorea.com/article.html?slug=storage-chairs-korean-bbq-restaurants"
Write-Host ""
Write-Host "The temporary hero is an editorial illustration."
Write-Host "Replace it with your own restaurant photo after your weekend shoot."
Write-Host ""
Read-Host "Press Enter to close"
