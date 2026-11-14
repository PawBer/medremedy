# Med Remedy

Start with `npm install` and `npm start`
(http://localhost:3000).

## Register a donation

`POST /donations/register` with `Content-Type: application/json`:

```json
{
  "drug_name": "Example medication",
  "serial_number": "ABC123",
  "expiration_date": "2027-12-31"
}
```

Returns `201 Created` with the donation, its generated `id`, `sealed: true`,
and `status: "available"`. Missing or blank names/serial numbers, invalid dates,
and expired medications return `400 Bad Request`.

## List available donations

`GET /donations/available` returns `200 OK` with a JSON array of available,
unexpired donations (or `[]`). Expiration dates use `YYYY-MM-DD`; medication
is considered valid through its expiration day, using the UTC date.
