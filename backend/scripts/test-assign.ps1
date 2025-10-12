<#
test-assign.ps1
Script de prueba para login y asignación de habitación.
Uso:
  # Ejecutar y pasar parámetros
  .\test-assign.ps1 -Email "admin@mi.com" -Password "password" -ReservationId "68d92f..." -RoomId "68d2c3..."

Si no pasas ReservationId o RoomId, el script listará reservas y habitaciones y te pedirá los IDs.
#>
param(
  [Parameter(Mandatory=$false)] [string] $Email,
  [Parameter(Mandatory=$false)] [string] $Password,
  [Parameter(Mandatory=$false)] [string] $ReservationId,
  [Parameter(Mandatory=$false)] [string] $RoomId,
  [Parameter(Mandatory=$false)] [string] $ApiBase = "http://localhost:5000"
)

function FailExit($msg) {
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

Write-Host "Usando API base: $ApiBase"

# 1) Login
if (-not $Email) { $Email = Read-Host "Email" }
# Password handling: accept either a plain string passed as parameter, or read a SecureString interactively.
if (-not $Password) {
  $secure = Read-Host -AsSecureString "Password"
  try {
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  } catch {
    FailExit "Error convirtiendo SecureString a texto: $($_.Exception.Message)"
  }
} else {
  # If caller passed a SecureString object as the parameter, convert it; if it's already a string, keep it.
  if ($Password -is [System.Security.SecureString]) {
    try {
      $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
    } catch {
      FailExit "Error convirtiendo SecureString a texto: $($_.Exception.Message)"
    }
  }
}

try {
  $login = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/auth/login" -ContentType "application/json" -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
} catch {
  FailExit "Login failed: $($_.Exception.Message)"
}

if (-not $login.token) { FailExit "No token in login response" }
$token = $login.token
Write-Host "Login OK. Token length:" $token.Length

# 2) Mostrar reservas si no se pasó ReservationId
if (-not $ReservationId) {
  Write-Host "Obteniendo lista de reservas..."
  try {
    $reservas = Invoke-RestMethod -Method Get -Uri "$ApiBase/api/reservations" -Headers @{ Authorization = "Bearer $token" }
  } catch {
    FailExit "No se pudieron listar reservas: $($_.Exception.Message)"
  }
  $reservas | Select-Object -Property _id, name, checkIn, checkOut, status | Format-Table -AutoSize
  $ReservationId = Read-Host "Pega la reservaId a usar"
}

# 3) Mostrar habitaciones si no se pasó RoomId
if (-not $RoomId) {
  Write-Host "Obteniendo lista de habitaciones..."
  try {
    $rooms = Invoke-RestMethod -Method Get -Uri "$ApiBase/api/rooms" -Headers @{ Authorization = "Bearer $token" }
  } catch {
    FailExit "No se pudieron listar habitaciones: $($_.Exception.Message)"
  }
  $rooms | Select-Object -Property _id, number, status, type | Format-Table -AutoSize
  $RoomId = Read-Host "Pega la roomId a asignar"
}

 # 4) Ejecutar asignación
 $body = @{ room = @($RoomId) } | ConvertTo-Json
Write-Host "Asignando room $RoomId to reservation $ReservationId ..."
try {
  $res = Invoke-RestMethod -Method Put -Uri "$ApiBase/api/reservations/$ReservationId/assign-room" -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body
  Write-Host "Asignación OK. Respuesta:"
  $res | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host "Fallo en asignación: $($_.Exception.Message)" -ForegroundColor Yellow
  if ($_.Exception.Response) {
    $status = ($_.Exception.Response).StatusCode.Value__
    Write-Host "Status code: $status"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd()
    Write-Host "Response body:`n$text"
  }
}

Write-Host "Script finalizado."