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
$frontendEnv = Get-EnvAssignments "$scriptDir\frontend.env"

$backendCommand = "$backendEnv; cd ..\backend; npm run dev"
$frontendCommand = "$frontendEnv; cd ..\frontend; npm start"

Write-Host "Iniciando backend demo..."
Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCommand

Write-Host "Iniciando frontend demo..."
Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCommand

Write-Host "Demo iniciado. Backend en http://localhost:5002 y frontend en http://localhost:3002"
