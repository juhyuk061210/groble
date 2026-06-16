$ErrorActionPreference = "Stop"

$payload = @{
  status = "paid"
  buyer_name = "test-buyer"
  buyer_phone = "010-3005-9897"
  order_id = "test-001"
  product_name = "course"
} | ConvertTo-Json -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/webhook/groble" `
  -ContentType "application/json; charset=utf-8" `
  -Body $bytes
