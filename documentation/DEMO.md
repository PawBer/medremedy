# Med Remedy Local Demo

## Start the API

Install Node.js 24 or later and run `npm ci` once in the project directory. Then start the demo from that directory on Windows, macOS, or Linux.

```bash
npm run demo
```

If PowerShell blocks `npm.ps1`, run `npm.cmd run demo`.

The demo starts at `http://127.0.0.1:3000` by default with the donor, clinic, and administrator test accounts ready to use. On first run it copies the sample database to `data/medremedy-demo.sqlite`. Later runs reuse that file and keep your donations and claims. Press `Ctrl+C` to stop the server.

## Try the API in Postman

Leave the server running. In Postman, select **Import** and choose [medremedy.postman_collection.json](medremedy.postman_collection.json) from the repository's `documentation` folder. The collection already contains the local demo tokens and the default base URL. If you changed the server port, update the collection variable `baseUrl`.

For the presentation, run the **1. Donation & Claim Workflow** folder in order. The first request registers a donation and saves its ID. The following requests show it on the list, claim it twice as the same clinic, verify that it disappears from the list, and delete it as its donor. The second folder demonstrates administrator deletion. The third checks expected error responses.

### Manual walkthrough

To send the requests individually, use `http://127.0.0.1:3000` before each path below. In each request, open **Authorization**, select **Bearer Token**, and paste the token from the table. These tokens are for local testing.

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

Repeat the `GET` request immediately after the claim and before the deletion. The ID you copied should disappear from the list while the original sample donation remains available on a fresh demo copy.

## Move the demo to another computer

Clone the repository and follow the setup above to start with the sample data. To keep changes from a previous session, stop the server and transfer `data/medremedy-demo.sqlite` to the same path in the new clone before starting it.
