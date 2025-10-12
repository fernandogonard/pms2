# quick-start.ps1
# Script simplificado para iniciar el sistema CRM Hotelero

Write-Host "Iniciando sistema CRM Hotelero..." -ForegroundColor Cyan

# Terminar procesos existentes
Write-Host "Deteniendo procesos Node.js existentes..." -ForegroundColor Yellow
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Verificar MongoDB
$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoService -and $mongoService.Status -eq "Running") {
    Write-Host "MongoDB: OK" -ForegroundColor Green
} else {
    Write-Host "ERROR: MongoDB no esta ejecutandose" -ForegroundColor Red
    exit 1
}

# Crear usuario admin si no existe
Write-Host "Inicializando usuario administrador..." -ForegroundColor Yellow
Push-Location backend
node scripts\createAdminUser.js
Pop-Location

# Crear archivo port.txt
"5000" | Out-File -FilePath backend\port.txt

# Iniciar backend
Write-Host "Iniciando backend..." -ForegroundColor Yellow
Push-Location backend
Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru
Pop-Location

# Esperar un poco
Start-Sleep -Seconds 5

# Verificar backend
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/system/status" -Method GET -TimeoutSec 10
    Write-Host "Backend: OK - Puerto 5000" -ForegroundColor Green
} catch {
    Write-Host "Backend: Iniciando... (puede tomar unos segundos)" -ForegroundColor Yellow
}

# Iniciar frontend
Write-Host "Iniciando frontend..." -ForegroundColor Yellow
Push-Location frontend
Start-Process -FilePath "npm" -ArgumentList "start" -PassThru
Pop-Location

Write-Host ""
Write-Host "SISTEMA INICIADO" -ForegroundColor Green
Write-Host "================" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credenciales por defecto:" -ForegroundColor Yellow
Write-Host "Email: admin@hotel.com" -ForegroundColor White
Write-Host "Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Presione Ctrl+C para detener el sistema" -ForegroundColor Yellow

# Mantener ejecutando
try {
    while ($true) {
        Start-Sleep -Seconds 30
    }
} catch {
    Write-Host "Deteniendo sistema..." -ForegroundColor Yellow
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
}