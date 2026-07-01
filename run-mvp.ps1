# Start both services for local MVP demo

Write-Host "Starting backend on http://localhost:8080 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend\app'; go run .\cmd\api\main.go"

Start-Sleep -Seconds 3

Write-Host "Starting frontend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "MVP ready:"
Write-Host "  App:    http://localhost:3000"
Write-Host "  API:    http://localhost:8080/health"
Write-Host "  Admin:  admin / admin123"
