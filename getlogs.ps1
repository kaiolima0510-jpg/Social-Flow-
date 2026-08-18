$vpsIp = "13.140.137.241"
Write-Host "Fetching Docker logs from VPS..."
ssh root@$vpsIp "docker logs socialflow_app --tail 100"
