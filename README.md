# Med Remedy

Run `npm install`, configure users, then run `npm start`
(http://localhost:3000). Run the API tests with `npm test`.

## Configure users

Set `MEDREMEDY_USERS` to a JSON array before starting the API. For example, in PowerShell:

```powershell
$env:MEDREMEDY_USERS = '[{"id":"donor-1","role":"donor","token":"local-donor"},{"id":"clinic-1","role":"clinic","token":"local-clinic"},{"id":"admin-1","role":"admin","token":"local-admin"}]'
npm start
```

The example tokens are for local testing. Send the token of the appropriate user
in the `Authorization: Bearer <token>` request header. Use a unique ID and a
unique, randomly generated token for each user. Missing or invalid tokens return
`401 Unauthorized`. A user with the wrong role receives `403 Forbidden`.

## Register a donation

As a donor, send `POST /donations/register` with `Content-Type: application/json`:

```json
{
  "drug_name": "Example medication",
  "serial_number": "ABC123",
  "expiration_date": "2027-12-31"
}
```

Returns `201 Created` with the donation, its generated `id`, `sealed: true`,
and `status: "available"`. Missing or blank names/serial numbers, invalid dates,
and expired medications return `400 Bad Request`. By registering a donation, the
donor declares that the medication is sealed and non-controlled. The API uses
that declaration for `sealed: true` and validates the expiration date. Physical
condition and controlled status require verification outside this API.

## List available donations

As a clinic, `GET /donations/available` returns `200 OK` with a JSON array of available,
unexpired donations (or `[]`). Expiration dates use `YYYY-MM-DD`; medication
is considered valid through its expiration day, using the UTC date.

## Claim a donation

As a clinic, send `PUT /clinics/claim/{id}` without a request body. The API
reserves the donation for the clinic identified by the token and returns `200 OK`
with `status: "claimed"`. Repeating the request as the same clinic returns the
existing reservation. An unknown ID returns `404 Not Found`. A donation that has
expired or was claimed by another clinic returns `409 Conflict` for a new claim.

## Delete a donation

Send `DELETE /donations/{id}` to remove a listing, for example when the medication
has expired or the package is damaged. A donor can delete their own listing.
An administrator can delete any listing. A successful deletion returns
`204 No Content`. An unknown ID returns `404 Not Found`, and a donor deleting
someone else's listing receives `403 Forbidden`.

Donations and reservations are stored in memory and are cleared on restart.
