# Med Remedy Local Demo

## Start the API

Install Node.js 24 or later and run `npm ci` in the project directory. Then run the commands for your operating system from that same directory. On first run, they copy the included sample database to `data/medremedy-demo.sqlite`.

### Windows (PowerShell)

```powershell
$env:MEDREMEDY_DB_PATH = 'data/medremedy-demo.sqlite'
if (-not (Test-Path $env:MEDREMEDY_DB_PATH)) {
  New-Item -ItemType Directory -Path data -Force | Out-Null
  Copy-Item documentation/demo.sqlite $env:MEDREMEDY_DB_PATH
}

$env:MEDREMEDY_USERS = @'
[
  {"id":1,"role":"donor","token":"local-donor","name":"Example donor","email":"donor@example.com"},
  {"id":1,"role":"clinic","token":"local-clinic","name":"Example clinic","address":"1 Example Street","email":"clinic@example.com","is_verified":true},
  {"id":"admin-1","role":"admin","token":"local-admin"}
]
'@
npm start
```

### Linux (Bash)

```bash
export MEDREMEDY_DB_PATH='data/medremedy-demo.sqlite'
mkdir -p data
if [ ! -f "$MEDREMEDY_DB_PATH" ]; then
  cp documentation/demo.sqlite "$MEDREMEDY_DB_PATH"
fi

export MEDREMEDY_USERS='[
  {"id":1,"role":"donor","token":"local-donor","name":"Example donor","email":"donor@example.com"},
  {"id":1,"role":"clinic","token":"local-clinic","name":"Example clinic","address":"1 Example Street","email":"clinic@example.com","is_verified":true},
  {"id":"admin-1","role":"admin","token":"local-admin"}
]'
npm start
```

## Try the API in Postman

Leave the server running and use `http://localhost:3000` before each path below. In each request, open **Authorization**, select **Bearer Token**, and paste the token from the table. These tokens are for local testing.

| Method and path | Token | Body | Expected result |
| --- | --- | --- | --- |
| `GET /donations/available` | `local-clinic` | None | `200 OK` with the available donations. You can try this first because the sample database already contains one. |
| `POST /donations/register` | `local-donor` | JSON below | `201 Created` with the new donation. Copy its `id`. |
| `PUT /clinics/claim/:id` | `local-clinic` | None | `200 OK` with `status: "claimed"`. Replace `:id` with the ID you copied. |
| `DELETE /donations/:id` | `local-admin` | None | `204 No Content`. Use the same ID to remove the demo donation. |

For `POST /donations/register`, select **Body → raw → JSON** and paste this example.

```json
{
  "drug_name": "Example medication",
  "serial_number": "ABC123",
  "expiration_date": "2099-12-31",
  "quantity": 3
}
```

After claiming the donation, send the `GET` request again to see it disappear from the available list.

## Move the demo to another computer

Clone the repository and follow the setup above to start with the sample data. To keep changes from a previous session, stop the server and transfer `data/medremedy-demo.sqlite` to the same path in the new clone before starting it.
