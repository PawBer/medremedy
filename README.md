# Med Remedy

Use Node.js 24 or later. Run `npm ci`, configure users, then run `npm start`
(http://localhost:3000). Run the API tests with `npm test`.

## Configure users

Set `MEDREMEDY_USERS` to a JSON array before starting the API. For example, in PowerShell:

```powershell
$env:MEDREMEDY_USERS = @'
[
  {"id":1,"role":"donor","token":"local-donor","name":"Example donor","email":"donor@example.com"},
  {"id":1,"role":"clinic","token":"local-clinic","name":"Example clinic","address":"1 Example Street","email":"clinic@example.com","is_verified":true},
  {"id":"admin-1","role":"admin","token":"local-admin"}
]
'@
npm start
```

The example tokens are for local testing. Send the token of the appropriate user
in the `Authorization: Bearer <token>` request header. Each account needs a unique,
randomly generated token. Missing or invalid tokens return `401 Unauthorized`.
A user with the wrong role receives `403 Forbidden`.

Donors and clinics use positive 32-bit integer IDs. IDs and email addresses are
unique within each entity, with email uniqueness checked case-insensitively.
Both profiles require a nonblank name and email. Clinics also require an address
and a boolean `is_verified`. The verification flag is profile data. The clinic
role controls access to listing and claiming donations. Admin accounts use
unique string IDs. Replace legacy string IDs for donors and clinics and add the
required profile fields before restarting.

## Register a donation

As a donor, send `POST /donations/register` with `Content-Type: application/json`:

```json
{
  "drug_name": "Example medication",
  "serial_number": "ABC123",
  "expiration_date": "2027-12-31",
  "quantity": 3
}
```

Returns `201 Created` with the donation, including its generated `id`, the
authenticated user's `donor_id`, `quantity`, `sealed: true`, and
`status: "available"`. Quantity must be a positive 32-bit integer and defaults
to `1` when omitted. Invalid quantities, missing or blank names or serial
numbers, invalid dates, and expired medications return `400 Bad Request`.
By registering a donation, the donor declares that the medication is sealed
and non-controlled. The API uses
that declaration for `sealed: true` and validates the expiration date. Physical
condition and controlled status require verification outside this API.

## List available donations

As a clinic, `GET /donations/available` returns `200 OK` with a JSON array of available,
unexpired donations (or `[]`). Expiration dates use `YYYY-MM-DD`; medication
is considered valid through its expiration day, using the UTC date.

## Claim a donation

As a clinic, send `PUT /clinics/claim/{id}` without a request body. The API
reserves the donation for the clinic identified by the token and returns `200 OK`
with the donation fields, `status: "claimed"`, and a nested `claim` object
containing `id`, `donation_id`, `clinic_id`, `claimed_at` (an ISO 8601 timestamp
in UTC), and `status: "claimed"`. Each donation can have one claim. Repeating
the request as the same clinic returns the existing claim with the original ID
and timestamp. An unknown ID returns `404 Not Found`. A donation that has
expired or was claimed by another clinic returns `409 Conflict` for a new claim.

## Delete a donation

Send `DELETE /donations/{id}` to remove a listing, for example when the medication
has expired or the package is damaged. A donor can delete their own listing.
An administrator can delete any listing. Deleting a donation also removes its
claim, if one exists. A successful deletion returns
`204 No Content`. An unknown ID returns `404 Not Found`, and a donor deleting
someone else's listing receives `403 Forbidden`.

## SQLite storage and moving the demo

The API creates the four tables from the [data model](documentation/schema.mermaid)
in `data/medremedy.sqlite` on first startup. Set `MEDREMEDY_DB_PATH` to use a
different file. Donor and clinic profiles are created or updated by ID from
`MEDREMEDY_USERS` at startup. Keep those IDs tied to the same people and clinics.
Removing an account from the configuration revokes its access and preserves its
profile and history. Bearer tokens and admin accounts stay in the configuration.

1. Stop the API and copy the project and `data/medremedy.sqlite` to the destination
   computer. If you set a custom database path, copy that file and set the path again.
2. Install Node.js 24 or later and run `npm ci` in the project directory.
3. Set `MEDREMEDY_USERS` with the same donor and clinic IDs, then run `npm start`.

Use the README's sample profiles and tokens for a local demo. The local database
file is ignored by Git and must be transferred separately. No separate database
service is required.
