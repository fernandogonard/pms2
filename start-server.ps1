# Script para iniciar el servidor CRM Hotelero con configuración mejorada
# Asegura que todas las dependencias estén instaladas y el servidor se ejecute correctamente

Write-Host "INICIANDO CRM HOTELERO v2.0" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

$backendPath = ".\backend"

# Verificar que estamos en el directorio correcto
if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: No se encuentra el directorio backend" -ForegroundColor Red
    Write-Host "Asegúrate de ejecutar este script desde el directorio raíz del proyecto" -ForegroundColor Yellow
    exit 1
}

# Cambiar al directorio backend
Set-Location $backendPath

# Verificar Node.js
Write-Host "`nVerificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js versión: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}

# Verificar npm
try {
    $npmVersion = npm --version
    Write-Host "   ✓ npm versión: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ ERROR: npm no está disponible" -ForegroundColor Red
    exit 1
}

# Instalar dependencias si es necesario
Write-Host "`nVerificando dependencias..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ ERROR: Falló la instalación de dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✓ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "   ✓ Dependencias ya instaladas" -ForegroundColor Green
}

# Verificar variables de entorno
Write-Host "`nConfigurando variables de entorno..." -ForegroundColor Yellow
$env:NODE_ENV = "development"
$env:PORT = "5000"
$env:JWT_SECRET = "tu_jwt_secret_super_seguro_cambiar_en_produccion"

Write-Host "   ✓ NODE_ENV: $env:NODE_ENV" -ForegroundColor Green
Write-Host "   ✓ PORT: $env:PORT" -ForegroundColor Green
Write-Host "   ✓ JWT_SECRET: [CONFIGURADO]" -ForegroundColor Green

# Mostrar funcionalidades habilitadas
Write-Host "`nFUNCIONALIDAES HABILITADAS:" -ForegroundColor Cyan
Write-Host "   ✓ JWT Authentication en todos los endpoints" -ForegroundColor Green
Write-Host "   ✓ Rate Limiting por tipo de endpoint" -ForegroundColor Green
Write-Host "   ✓ Sistema de logging avanzado (Winston)" -ForegroundColor Green
Write-Host "   ✓ Monitoreo en tiempo real (/api/monitoring/*)" -ForegroundColor Green
Write-Host "   ✓ Health checks automáticos" -ForegroundColor Green
Write-Host "   ✓ Métricas de rendimiento" -ForegroundColor Green
Write-Host "   ✓ Middleware de seguridad (Helmet)" -ForegroundColor Green

# Información de acceso
Write-Host "`nINFORMACIÓN DE ACCESO:" -ForegroundColor Cyan
Write-Host "   Servidor: http://localhost:5000" -ForegroundColor White
Write-Host "   Admin: admin@hotel.com / admin123" -ForegroundColor White
Write-Host "   Recepcionista: recepcion@hotel.com / recepcion123" -ForegroundColor White
Write-Host "   Monitoreo: http://localhost:5000/api/monitoring/health" -ForegroundColor White

# Scripts de validación disponibles
Write-Host "`nSCRIPTS DE VALIDACIÓN DISPONIBLES:" -ForegroundColor Cyan
Write-Host "   ..\validate-final-system.ps1 - Validación completa del sistema" -ForegroundColor White
Write-Host "   ..\test-rate-limiting.ps1 - Test específico de rate limiting" -ForegroundColor White
Write-Host "   ..\validate-corrections.ps1 - Validación de correcciones de seguridad" -ForegroundColor White

Write-Host "`nINICIANDO SERVIDOR..." -ForegroundColor Yellow
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Gray
Write-Host "===========================================" -ForegroundColor Green

# Iniciar el servidor
npm start