$source = 'C:\Users\Kaio Lima\Downloads\Social-Flow-main'
$dest   = 'C:\Users\Kaio Lima\Downloads\SocialFlow-para-amigo'
$zip    = 'C:\Users\Kaio Lima\Downloads\SocialFlow-para-amigo.zip'

# Remove destino antigo se existir
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
if (Test-Path $zip)  { Remove-Item $zip  -Force }

# Copia o projeto inteiro primeiro
Copy-Item $source $dest -Recurse

# Remove pastas e arquivos pessoais/desnecessários
$toRemove = @('node_modules', '.git', 'dist', 'scratch', '.gemini', '.agents', '.env', 'scratch_sql.json', 'sql_content.txt', '*.zip')
foreach ($item in $toRemove) {
    Get-ChildItem -Path $dest -Filter $item -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Compactar
Compress-Archive -Path $dest -DestinationPath $zip -Force

# Limpar pasta temporária
Remove-Item $dest -Recurse -Force

Write-Host "Pronto! Arquivo gerado em: $zip" -ForegroundColor Green
