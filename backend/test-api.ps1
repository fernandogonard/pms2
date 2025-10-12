#!/usr/bin/env pwsh
# Test API Script for CRM Hotelero

Write-Host "Testing CRM Hotelero APIs..." -ForegroundColor Green

# Test 1: Login
Write-Host "`n1. Testing Login..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "admin@hotel.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    Write-Host "Login successful!" -ForegroundColor Green
    Write-Host "Token: $($loginResponse.token.Substring(0,20))..." -ForegroundColor Cyan
    $token = $loginResponse.token
} catch {
    Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Get Room Types
Write-Host "`n2. Testing Room Types..." -ForegroundColor Yellow
try {
    $roomTypesResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/rooms/types" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Room types found: $($roomTypesResponse.roomTypes.Count)" -ForegroundColor Green
    foreach ($roomType in $roomTypesResponse.roomTypes) {
        Write-Host "  - $($roomType.name): $($roomType.price) ARS" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Room types failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test Billing Calculate
Write-Host "`n3. Testing Billing Calculate..." -ForegroundColor Yellow
try {
    $billingBody = @{
        roomType = "doble"
        checkIn = "2024-01-15"
        checkOut = "2024-01-17"
        guests = 2
    } | ConvertTo-Json

    $billingResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/billing/calculate" -Method POST -ContentType "application/json" -Headers @{Authorization = "Bearer $token"} -Body $billingBody
    Write-Host "Billing calculation successful!" -ForegroundColor Green
    Write-Host "Total: $($billingResponse.total) ARS" -ForegroundColor Cyan
    Write-Host "Nights: $($billingResponse.nights)" -ForegroundColor Cyan
} catch {
    Write-Host "Billing calculation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

# Test 4: Get Rooms
Write-Host "`n4. Testing Rooms List..." -ForegroundColor Yellow
try {
    $roomsResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/rooms" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Rooms found: $($roomsResponse.rooms.Count)" -ForegroundColor Green
} catch {
    Write-Host "Rooms list failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nAPI Testing completed!" -ForegroundColor Green