$body = @{
    email = "test"
    password = "test"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5001/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Success: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}