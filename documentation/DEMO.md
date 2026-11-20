# Med Remedy Local Demo

## Start the API

1. **Install** Node.js 24 or later and run `npm ci` in the project directory. See the [setup instructions](../README.md#installation--setup).
2. **Configure** the demo in PowerShell. The repository includes `documentation/demo.sqlite` with sample profiles, one available donation, and one claimed donation. Copy it on first run so the demo can save changes to its own file. Use the sample tokens for local testing only.

   ```powershell
   $env:MEDREMEDY_DB_PATH = 'data/medremedy-demo.sqlite'
   if (-not (Test-Path -LiteralPath $env:MEDREMEDY_DB_PATH)) {
     New-Item -ItemType Directory -Path 'data' -Force | Out-Null
     Copy-Item -LiteralPath 'documentation/demo.sqlite' -Destination $env:MEDREMEDY_DB_PATH
   }
   $env:MEDREMEDY_USERS = @'
   [
     {"id":1,"role":"donor","token":"local-donor","name":"Example donor","email":"donor@example.com"},
     {"id":1,"role":"clinic","token":"local-clinic","name":"Example clinic","address":"1 Example Street","email":"clinic@example.com","is_verified":true},
     {"id":"admin-1","role":"admin","token":"local-admin"}
   ]
   '@
   ```

3. **Start** the server in the same terminal and leave it running.

   ```powershell
   npm start
   ```

## Demonstrate the donation workflow

1. **Register** a donation from a second PowerShell terminal. The API returns `201 Created` and a donation with `status: "available"`.

   ```powershell
   $api = 'http://localhost:3000'
   $donor = @{ Authorization = 'Bearer local-donor' }
   $clinic = @{ Authorization = 'Bearer local-clinic' }
   $admin = @{ Authorization = 'Bearer local-admin' }
   $body = @{
     drug_name = 'Example medication'
     serial_number = 'ABC123'
     expiration_date = [DateTime]::UtcNow.AddMonths(6).ToString('yyyy-MM-dd')
     quantity = 3
   } | ConvertTo-Json
   $donation = Invoke-RestMethod -Method Post -Uri "$api/donations/register" `
     -Headers $donor -ContentType 'application/json' -Body $body
   $donation
   ```

2. **List** available donations as the clinic. The API returns `200 OK` and includes the new donation.

   ```powershell
   Invoke-RestMethod -Uri "$api/donations/available" -Headers $clinic
   ```

3. **Claim** the donation as the clinic. The API returns `200 OK`, `status: "claimed"`, and the nested claim. Repeat the listing request to verify that the claimed donation has disappeared from the available list.

   ```powershell
   Invoke-RestMethod -Method Put -Uri "$api/clinics/claim/$($donation.id)" -Headers $clinic |
     ConvertTo-Json -Depth 3
   ```

4. **Delete** the donation as the administrator. The API returns `204 No Content`.

   ```powershell
   (Invoke-WebRequest -UseBasicParsing -Method Delete `
     -Uri "$api/donations/$($donation.id)" -Headers $admin).StatusCode
   ```

## Move the demo to another computer

Clone the repository and follow the setup above to start with the included sample data. To carry over changes from a previous run, stop the API and copy `data/medremedy-demo.sqlite` to the same path on the destination computer before starting the demo there.
