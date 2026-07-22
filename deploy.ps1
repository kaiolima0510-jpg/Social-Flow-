# Script de Deploy do Social Flow para a VPS Contabo
# Executar este script no PowerShell da sua máquina local.

$vpsIp = "13.140.137.241"
$zipFile = "socialflow_deploy.zip"
$destinationDir = "/root/socialflow"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Deploy Automatizado do Social Flow para VPS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Destino: root@$vpsIp" -ForegroundColor Yellow
Write-Host ""

# 1. Compactar o projeto (excluindo arquivos inúteis para economizar espaço e tempo)
Write-Host "[1/4] Compactando arquivos do projeto..." -ForegroundColor Green
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

# Criar lista de arquivos para compactar de forma compatível
$files = Get-ChildItem -Path . -Exclude "node_modules", ".git", "dist", "*.zip", "*.log", "scratch", ".gemini", ".agents"
$filePaths = $files | ForEach-Object { $_.FullName }
Compress-Archive -Path $filePaths -DestinationPath $zipFile -Force

# 2. Criar diretório de destino na VPS
Write-Host "[2/4] Preparando diretório de destino na VPS..." -ForegroundColor Green
Write-Host "Abaixo, digite a senha da sua VPS quando for solicitada." -ForegroundColor Magenta
ssh root@$vpsIp "mkdir -p $destinationDir"

# 3. Enviar o arquivo compactado e o script de instalação para a VPS
Write-Host "[3/4] Enviando arquivos para a VPS (isto pode levar alguns segundos)..." -ForegroundColor Green
Write-Host "Digite a senha da sua VPS novamente para o envio." -ForegroundColor Magenta
scp $zipFile setup.sh root@${vpsIp}:/root/

# 4. Descompactar e executar a instalação na VPS
Write-Host "[4/4] Iniciando a instalação no servidor..." -ForegroundColor Green
Write-Host "Digite a senha da VPS para iniciar a execução dos comandos." -ForegroundColor Magenta

$remoteCommands = @"
apt-get install -y unzip
unzip -o /root/$zipFile -d $destinationDir
rm /root/$zipFile
mv /root/setup.sh $destinationDir/setup.sh
chmod +x $destinationDir/setup.sh
cd $destinationDir
bash setup.sh
"@

ssh root@$vpsIp $remoteCommands

# Limpeza local
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Deploy Concluído!" -ForegroundColor Green
Write-Host "   Acesse: http://socialflow.livros.digital" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
