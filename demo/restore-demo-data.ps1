$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-EnvAssignments($path) {
    if (-Not (Test-Path $path)) {
        Write-Error "No se encontró el archivo $path"
        exit 1
    }

    $assignments = @()
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#')) {
            $pair = $line -split '=', 2
            if ($pair.Count -eq 2) {
                $name = $pair[0].Trim()
                $value = $pair[1].Trim().Replace("'", "''")
                $assignments += "Set-Item Env:$name '$value'"
            }
        }
    }
    return $assignments -join '; '
}

$backendEnv = Get-EnvAssignments "$scriptDir\backend.env"
$backupFile = Join-Path $scriptDir '..\backend\backups\backup_json_20251226-010000.json'

if (-Not (Test-Path $backupFile)) {
    Write-Error "No se encontró el backup de demo en $backupFile"
    exit 1
}

$command = "$backendEnv; cd ..\backend; node scripts/restoreBackup.js '$backupFile'"
Write-Host "Restaurando datos de demo desde $backupFile en la base de datos demo..."
Start-Process powershell -ArgumentList '-NoExit', '-Command', $command
