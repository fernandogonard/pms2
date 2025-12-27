# Script para iniciar el servidor CRM Hotelero con configuraciÃ³n mejorada
# Asegura que todas las dependencias estÃ©n instaladas y el servidor se ejecute correctamente

Write-Host "INICIANDO CRM HOTELERO v2.0" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

$backendPath = ".\backend"

# Verificar que estamos en el directorio correcto
if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: No se encuentra el directorio backend" -ForegroundColor Red
    Write-Host "AsegÃºrate de ejecutar este script desde el directorio raÃ­z del proyecto" -ForegroundColor Yellow
    exit 1
}

# Cambiar al directorio backend
Set-Location $backendPath

# Verificar Node.js
Write-Host "`nVerificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   âœ“ Node.js versiÃ³n: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   âœ— ERROR: Node.js no estÃ¡ instalado" -ForegroundColor Red
    exit 1
}

# Verificar npm
try {
    $npmVersion = npm --version
    Write-Host "   âœ“ npm versiÃ³n: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   âœ— ERROR: npm no estÃ¡ disponible" -ForegroundColor Red
    exit 1
}

# Instalar dependencias si es necesario
Write-Host "`nVerificando dependencias..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   âœ— ERROR: FallÃ³ la instalaciÃ³n de dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "   âœ“ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "   âœ“ Dependencias ya instaladas" -ForegroundColor Green
}

# Verificar variables de entorno
Write-Host "`nConfigurando variables de entorno..." -ForegroundColor Yellow
$env:NODE_ENV = "development"
$env:PORT = "5000"
$env:JWT_SECRET = "tu_jwt_secret_super_seguro_cambiar_en_produccion"

Write-Host "   âœ“ NODE_ENV: $env:NODE_ENV" -ForegroundColor Green
Write-Host "   âœ“ PORT: $env:PORT" -ForegroundColor Green
Write-Host "   âœ“ JWT_SECRET: [CONFIGURADO]" -ForegroundColor Green

# Mostrar funcionalidades habilitadas
Write-Host "`nFUNCIONALIDADES HABILITADAS:" -ForegroundColor Cyan
Write-Host "   âœ“ JWT Authentication en todos los endpoints" -ForegroundColor Green
Write-Host "   âœ“ Rate Limiting por tipo de endpoint" -ForegroundColor Green
Write-Host "   âœ“ Sistema de logging avanzado (Winston)" -ForegroundColor Green
Write-Host "   âœ“ Monitoreo en tiempo real (en /api/monitoring)" -ForegroundColor Green
Write-Host "   âœ“ Health checks automÃ¡ticos" -ForegroundColor Green
Write-Host "   âœ“ MÃ©tricas de rendimiento" -ForegroundColor Green
Write-Host "   âœ“ Middleware de seguridad (Helmet)" -ForegroundColor Green

# InformaciÃ³n de acceso
Write-Host "`nINFORMACIÃ“N DE ACCESO:" -ForegroundColor Cyan
Write-Host "   Servidor: http://localhost:5000" -ForegroundColor White
Write-Host "   Admin: admin@hotel.com / admin123" -ForegroundColor White
Write-Host "   Recepcionista: recepcion@hotel.com / recepcion123" -ForegroundColor White
Write-Host "   Monitoreo: http://localhost:5000/api/monitoring/health" -ForegroundColor White

# Scripts de validaciÃ³n disponibles
Write-Host "`nSCRIPTS DE VALIDACIÃ“N DISPONIBLES:" -ForegroundColor Cyan
Write-Host "   ..\validate-final-system.ps1 - ValidaciÃ³n completa del sistema" -ForegroundColor White
Write-Host "   ..\test-rate-limiting.ps1 - Test especÃ­fico de rate limiting" -ForegroundColor White
Write-Host "   ..\validate-corrections.ps1 - ValidaciÃ³n de correcciones de seguridad" -ForegroundColor White

Write-Host "`nINICIANDO SERVIDOR..." -ForegroundColor Yellow
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Gray
Write-Host "===========================================" -ForegroundColor Green

# Iniciar el servidor
npm start
