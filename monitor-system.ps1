# Monitor-System.ps1
# Script para monitoreo periódico del estado del sistema CRM Hotelero

param (
    [string]$baseUrl = "http://localhost:5000",
    [string]$adminEmail = "admin@hotel.com",
    [string]$adminPassword = "admin123",
    [switch]$Silent = $false,
    [switch]$SaveReport = $false,
    [string]$ReportPath = "system-report.json"
)

$systemStatus = @{
    timestamp = Get-Date
    checks = @()
    alerts = @()
    status = "healthy"  # healthy, degraded, critical
    metrics = @{
        rooms = @{
            total = 0
            available = 0
            occupied = 0
            maintenance = 0
            cleaning = 0
        }
        reservations = @{
            active = 0
            upcoming = 0
        }
        performance = @{
            responseTime = 0
            dbQueries = 0
        }
    }
}

function Write-StatusMessage {
    param (
        [string]$Message,
        [string]$Type = "Info",
        [switch]$NoNewline
    )
    
    if ($Silent) { return }
    
    $color = switch($Type) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error" { "Red" }
        "Info" { "Cyan" }
        "Metric" { "White" }
        default { "Gray" }
    }
    
    if ($NoNewline) {
        Write-Host $Message -ForegroundColor $color -NoNewline
    } else {
        Write-Host $Message -ForegroundColor $color
    }
}

function Add-StatusCheck {
    param (
        [string]$Name,
        [string]$Status,  # passed, warning, failed
        [string]$Message,
        [int]$ResponseTime = 0
    )
    
    $systemStatus.checks += @{
        name = $Name
        status = $Status
        message = $Message
        responseTime = $ResponseTime
    }
    
    # Update overall status if needed
    if ($Status -eq "failed" -and $systemStatus.status -ne "critical") {
        $systemStatus.status = "critical"
    } elseif ($Status -eq "warning" -and $systemStatus.status -eq "healthy") {
        $systemStatus.status = "degraded"
    }
}

function Add-Alert {
    param (
        [string]$Type,  # critical, warning, info
        [string]$Message
    )
    
    $systemStatus.alerts += @{
        type = $Type
        message = $Message
        timestamp = Get-Date
    }
}

function Measure-RequestTime {
    param (
        [scriptblock]$ScriptBlock
    )
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $result = & $ScriptBlock
        $stopwatch.Stop()
        return @{
            success = $true
            result = $result
            elapsedMs = $stopwatch.ElapsedMilliseconds
        }
    }
    catch {
        $stopwatch.Stop()
        return @{
            success = $false
            error = $_
            elapsedMs = $stopwatch.ElapsedMilliseconds
        }
    }
}

function Invoke-MonitorRequest {
    param (
        $Uri,
        $Method = "GET",
        $Headers = @{},
        $Body = $null,
        $ContentType = "application/json"
    )
    
    $measureResult = Measure-RequestTime -ScriptBlock {
        if ($Body) {
            Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -Body $Body -ContentType $ContentType
        } else {
            Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers
        }
    }
    
    if ($measureResult.success) {
        return @{
            success = $true
            data = $measureResult.result
            responseTimeMs = $measureResult.elapsedMs
        }
    } else {
        return @{
            success = $false
            error = $measureResult.error
            responseTimeMs = $measureResult.elapsedMs
        }
    }
}

# Banner del script
Write-StatusMessage "====================================" "Info"
Write-StatusMessage "  MONITOR DE SISTEMA CRM HOTELERO  " "Info"
Write-StatusMessage "====================================" "Info"
Write-StatusMessage "Timestamp: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))" "Info"
Write-StatusMessage "Target URL: $baseUrl" "Info"
Write-StatusMessage "====================================" "Info"

# 1. Check if server is up
Write-StatusMessage "`n[1/7] Verificando disponibilidad del servidor..." "Info" -NoNewline

$serverCheck = Invoke-MonitorRequest -Uri "$baseUrl/"
if ($serverCheck.success) {
    Write-StatusMessage " ONLINE ($($serverCheck.responseTimeMs)ms)" "Success"
    Add-StatusCheck -Name "server_availability" -Status "passed" -Message "Servidor respondiendo correctamente" -ResponseTime $serverCheck.responseTimeMs
    $systemStatus.metrics.performance.responseTime = $serverCheck.responseTimeMs
} else {
    Write-StatusMessage " OFFLINE" "Error"
    Add-StatusCheck -Name "server_availability" -Status "failed" -Message "Servidor no responde" -ResponseTime $serverCheck.responseTimeMs
    Add-Alert -Type "critical" -Message "El servidor no está respondiendo"
    
    # Exit early if server is down
    $systemStatus.status = "critical"
    
    if ($SaveReport) {
        $systemStatus | ConvertTo-Json -Depth 5 | Out-File -FilePath $ReportPath
        Write-StatusMessage "Reporte guardado en: $ReportPath" "Info"
    }
    
    exit 1
}

# 2. Check system readiness
Write-StatusMessage "`n[2/7] Verificando estado básico del sistema..." "Info"
$readyCheckResult = Invoke-MonitorRequest -Uri "$baseUrl/api/system/ready-check"

if ($readyCheckResult.success) {
    $readinessScore = $readyCheckResult.data.readyScore
    $scoreColor = if ($readinessScore -ge 8) { "Success" } elseif ($readinessScore -ge 6) { "Warning" } else { "Error" }
    
    Write-StatusMessage "  Puntuación de preparación: $readinessScore/10" $scoreColor
    
    $readyStatus = if ($readinessScore -ge 8) { "passed" } elseif ($readinessScore -ge 6) { "warning" } else { "failed" }
    Add-StatusCheck -Name "system_readiness" -Status $readyStatus -Message "Puntuación de preparación: $readinessScore/10" -ResponseTime $readyCheckResult.responseTimeMs
    
    if ($readinessScore -lt 6) {
        Add-Alert -Type "critical" -Message "Sistema con baja puntuación de preparación: $readinessScore/10"
    } elseif ($readinessScore -lt 8) {
        Add-Alert -Type "warning" -Message "Sistema con puntuación de preparación media: $readinessScore/10"
    }
    
    # Log specific checks
    $checks = $readyCheckResult.data.checks
    
    if ($checks.database.roomsExist) {
        Write-StatusMessage "  Habitaciones en BD: SÍ" "Success"
    } else {
        Write-StatusMessage "  Habitaciones en BD: NO" "Error"
        Add-Alert -Type "critical" -Message "No hay habitaciones en la base de datos"
    }
    
    if ($checks.adminExists) {
        Write-StatusMessage "  Usuario admin: SÍ" "Success"
    } else {
        Write-StatusMessage "  Usuario admin: NO" "Error"
        Add-Alert -Type "critical" -Message "No existe el usuario administrador"
    }
    
    if ($checks.noIssues) {
        Write-StatusMessage "  Inconsistencias: NO" "Success"
    } else {
        Write-StatusMessage "  Inconsistencias: SÍ" "Error"
        Add-Alert -Type "warning" -Message "Hay inconsistencias en los datos del sistema"
    }
} else {
    Write-StatusMessage "  Error al verificar estado básico del sistema" "Error"
    Add-StatusCheck -Name "system_readiness" -Status "failed" -Message "Error al verificar estado del sistema" -ResponseTime $readyCheckResult.responseTimeMs
    Add-Alert -Type "critical" -Message "No se pudo verificar el estado básico del sistema"
}

# 3. Authenticate as admin
Write-StatusMessage "`n[3/7] Autenticando como administrador..." "Info" -NoNewline

$token = $null
$loginBody = @{
    email = $adminEmail
    password = $adminPassword
} | ConvertTo-Json

$loginResult = Invoke-MonitorRequest -Uri "$baseUrl/api/auth/login" -Method "POST" -Body $loginBody -ContentType "application/json"

if ($loginResult.success) {
    $token = $loginResult.data.token
    Write-StatusMessage " ÉXITO ($($loginResult.responseTimeMs)ms)" "Success"
    Add-StatusCheck -Name "admin_login" -Status "passed" -Message "Login de administrador exitoso" -ResponseTime $loginResult.responseTimeMs
} else {
    Write-StatusMessage " FALLO" "Error"
    Add-StatusCheck -Name "admin_login" -Status "failed" -Message "No se pudo autenticar como administrador" -ResponseTime $loginResult.responseTimeMs
    Add-Alert -Type "critical" -Message "Falló la autenticación como administrador"
    
    # Continue but with limited checks
    Write-StatusMessage "  Continuando con verificaciones limitadas..." "Warning"
}

# 4. Get detailed system data if token available
if ($token) {
    Write-StatusMessage "`n[4/7] Obteniendo datos detallados del sistema..." "Info"
    
    $sysDataResult = Invoke-MonitorRequest -Uri "$baseUrl/api/system/real-data" -Headers @{Authorization = "Bearer $token"}
    
    if ($sysDataResult.success) {
        $sysData = $sysDataResult.data.data
        
        # Store metrics
        $systemStatus.metrics.rooms.total = $sysData.rooms.total
        
        # Room distribution
        Write-StatusMessage "`n  HABITACIONES:" "Info"
        Write-StatusMessage "  Total: $($sysData.rooms.total)" "Metric"
        
        foreach ($status in $sysData.rooms.byStatus.PSObject.Properties) {
            $color = switch ($status.Name) {
                "disponible" { "Success" }
                "ocupada" { "Warning" }
                "limpieza" { "Info" }
                "mantenimiento" { "Error" }
                default { "Metric" }
            }
            
            Write-StatusMessage "  $($status.Name): $($status.Value)" $color
            $systemStatus.metrics.rooms.$($status.Name) = $status.Value
        }
        
        # Maintenance rooms
        if ($sysData.maintenance.count -gt 0) {
            Write-StatusMessage "`n  HABITACIONES EN MANTENIMIENTO:" "Info"
            foreach ($maintRoom in $sysData.maintenance.rooms) {
                Write-StatusMessage "  - Hab #$($maintRoom.number): $($maintRoom.reason)" "Warning"
            }
            
            if ($sysData.maintenance.count -gt 3) {
                Add-Alert -Type "warning" -Message "Alto número de habitaciones en mantenimiento: $($sysData.maintenance.count)"
            }
        } else {
            Write-StatusMessage "`n  No hay habitaciones en mantenimiento" "Success"
        }
        
        # Reservation data
        Write-StatusMessage "`n  RESERVAS:" "Info"
        Write-StatusMessage "  Total: $($sysData.reservations.total)" "Metric"
        
        foreach ($status in $sysData.reservations.byStatus.PSObject.Properties) {
            Write-StatusMessage "  $($status.Name): $($status.Value)" "Metric"
        }
        
        Add-StatusCheck -Name "system_data" -Status "passed" -Message "Datos del sistema obtenidos correctamente" -ResponseTime $sysDataResult.responseTimeMs
    } else {
        Write-StatusMessage "  Error al obtener datos detallados del sistema" "Error"
        Add-StatusCheck -Name "system_data" -Status "failed" -Message "No se pudieron obtener los datos detallados" -ResponseTime $sysDataResult.responseTimeMs
    }
    
    # 5. Check health metrics
    Write-StatusMessage "`n[5/7] Verificando métricas de salud..." "Info"
    
    $healthResult = Invoke-MonitorRequest -Uri "$baseUrl/api/monitoring/health" -Headers @{Authorization = "Bearer $token"}
    
    if ($healthResult.success) {
        $healthStatus = $healthResult.data.status
        $healthColor = if ($healthStatus -eq "healthy") { "Success" } else { "Error" }
        
        Write-StatusMessage "  Estado de salud: $healthStatus" $healthColor
        
        $healthCheckStatus = if ($healthStatus -eq "healthy") { "passed" } else { "failed" }
        Add-StatusCheck -Name "health_check" -Status $healthCheckStatus -Message "Estado de salud: $healthStatus" -ResponseTime $healthResult.responseTimeMs
        
        if ($healthStatus -ne "healthy") {
            Add-Alert -Type "critical" -Message "El sistema reporta estado no saludable: $healthStatus"
        }
        
        # Check components if available
        if ($healthResult.data.components) {
            Write-StatusMessage "`n  COMPONENTES:" "Info"
            
            foreach ($component in $healthResult.data.components.PSObject.Properties) {
                $componentColor = if ($component.Value.status -eq "up") { "Success" } else { "Error" }
                Write-StatusMessage "  $($component.Name): $($component.Value.status)" $componentColor
                
                if ($component.Value.status -ne "up") {
                    Add-Alert -Type "critical" -Message "Componente $($component.Name) reporta estado: $($component.Value.status)"
                }
            }
        }
    } else {
        Write-StatusMessage "  Error al verificar métricas de salud" "Error"
        Add-StatusCheck -Name "health_check" -Status "failed" -Message "No se pudieron verificar las métricas de salud" -ResponseTime $healthResult.responseTimeMs
    }
    
    # 6. Check system metrics
    Write-StatusMessage "`n[6/7] Obteniendo métricas de rendimiento..." "Info"
    
    $metricsResult = Invoke-MonitorRequest -Uri "$baseUrl/api/monitoring/system" -Headers @{Authorization = "Bearer $token"}
    
    if ($metricsResult.success) {
        $metrics = $metricsResult.data
        
        # Memory usage
        if ($metrics.memory) {
            $memoryUsedPercent = [math]::Round(($metrics.memory.used / $metrics.memory.total) * 100, 1)
            $memoryColor = if ($memoryUsedPercent -lt 70) { "Success" } elseif ($memoryUsedPercent -lt 85) { "Warning" } else { "Error" }
            
            Write-StatusMessage "  Memoria: $memoryUsedPercent% ($([math]::Round($metrics.memory.used / 1024 / 1024))MB / $([math]::Round($metrics.memory.total / 1024 / 1024))MB)" $memoryColor
            
            if ($memoryUsedPercent -ge 85) {
                Add-Alert -Type "critical" -Message "Alto uso de memoria: $memoryUsedPercent%"
            } elseif ($memoryUsedPercent -ge 70) {
                Add-Alert -Type "warning" -Message "Uso elevado de memoria: $memoryUsedPercent%"
            }
        }
        
        # CPU usage
        if ($metrics.cpu) {
            $cpuColor = if ($metrics.cpu.usage -lt 70) { "Success" } elseif ($metrics.cpu.usage -lt 85) { "Warning" } else { "Error" }
            Write-StatusMessage "  CPU: $($metrics.cpu.usage)%" $cpuColor
            
            if ($metrics.cpu.usage -ge 85) {
                Add-Alert -Type "critical" -Message "Alto uso de CPU: $($metrics.cpu.usage)%"
            } elseif ($metrics.cpu.usage -ge 70) {
                Add-Alert -Type "warning" -Message "Uso elevado de CPU: $($metrics.cpu.usage)%"
            }
        }
        
        # API metrics
        if ($metrics.api) {
            Write-StatusMessage "  Tiempo de respuesta API: $($metrics.api.responseTime)ms" "Metric"
            Write-StatusMessage "  Solicitudes por minuto: $($metrics.api.requestsPerMinute)" "Metric"
            
            $systemStatus.metrics.performance.dbQueries = $metrics.api.dbQueriesPerRequest
            
            if ($metrics.api.responseTime -gt 1000) {
                Add-Alert -Type "warning" -Message "Tiempo de respuesta API elevado: $($metrics.api.responseTime)ms"
            }
        }
        
        Add-StatusCheck -Name "performance_metrics" -Status "passed" -Message "Métricas de rendimiento obtenidas correctamente" -ResponseTime $metricsResult.responseTimeMs
    } else {
        Write-StatusMessage "  Error al obtener métricas de rendimiento" "Error"
        Add-StatusCheck -Name "performance_metrics" -Status "failed" -Message "No se pudieron obtener métricas de rendimiento" -ResponseTime $metricsResult.responseTimeMs
    }
    
    # 7. Check rate limiting metrics
    Write-StatusMessage "`n[7/7] Verificando métricas de rate limiting..." "Info"
    
    $rateLimitResult = Invoke-MonitorRequest -Uri "$baseUrl/api/monitoring/rate-limit" -Headers @{Authorization = "Bearer $token"}
    
    if ($rateLimitResult.success) {
        $rateLimit = $rateLimitResult.data
        
        Write-StatusMessage "  Total de solicitudes bloqueadas: $($rateLimit.totalBlocked)" "Metric"
        Write-StatusMessage "  Solicitudes bloqueadas (última hora): $($rateLimit.blockedLastHour)" "Metric"
        
        if ($rateLimit.blockedLastHour -gt 50) {
            Write-StatusMessage "  ⚠ Número elevado de solicitudes bloqueadas en la última hora" "Warning"
            Add-Alert -Type "warning" -Message "Alto número de solicitudes bloqueadas: $($rateLimit.blockedLastHour) en la última hora"
        }
        
        Add-StatusCheck -Name "rate_limiting" -Status "passed" -Message "Métricas de rate limiting obtenidas correctamente" -ResponseTime $rateLimitResult.responseTimeMs
    } else {
        Write-StatusMessage "  Error al obtener métricas de rate limiting" "Error"
        Add-StatusCheck -Name "rate_limiting" -Status "failed" -Message "No se pudieron obtener métricas de rate limiting" -ResponseTime $rateLimitResult.responseTimeMs
    }
}

# Final summary
Write-StatusMessage "`n====================================" "Info"
Write-StatusMessage "        RESUMEN DEL SISTEMA        " "Info"
Write-StatusMessage "====================================" "Info"

$statusColor = switch($systemStatus.status) {
    "healthy" { "Success" }
    "degraded" { "Warning" }
    "critical" { "Error" }
    default { "Info" }
}

Write-StatusMessage "Estado: $($systemStatus.status.ToUpper())" $statusColor

# Alerts summary
if ($systemStatus.alerts.Count -gt 0) {
    Write-StatusMessage "`nAlertas detectadas: $($systemStatus.alerts.Count)" "Warning"
    
    foreach ($alert in $systemStatus.alerts) {
        $alertColor = switch($alert.type) {
            "critical" { "Error" }
            "warning" { "Warning" }
            "info" { "Info" }
            default { "Metric" }
        }
        Write-StatusMessage "- $($alert.message)" $alertColor
    }
} else {
    Write-StatusMessage "`nNo se detectaron alertas" "Success"
}

# Save report if requested
if ($SaveReport) {
    $systemStatus | ConvertTo-Json -Depth 5 | Out-File -FilePath $ReportPath
    Write-StatusMessage "`nReporte guardado en: $ReportPath" "Info"
}

Write-StatusMessage "`nMonitoreo completado: $((Get-Date).ToString('HH:mm:ss'))" "Info"

# Return status code
if ($systemStatus.status -eq "critical") {
    exit 2
} elseif ($systemStatus.status -eq "degraded") {
    exit 1
} else {
    exit 0
}