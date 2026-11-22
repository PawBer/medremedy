# Med Remedy — Prescription Drug Donation API

[![API: Med Remedy v1.0.0](https://img.shields.io/badge/API-v1.0.0-2563eb)](#api-reference-guide)
![ESL Capstone](https://img.shields.io/badge/ESL-Capstone-475569)

## Project Overview

Disposing of unused, sealed prescription medications creates avoidable waste. Donors need a way to offer surplus medication, and clinics need to know what they can still claim before it expires. The Med Remedy REST API lets donors register unused medication, shows clinics available and unexpired donations, and records a single clinic claim per donation.

## Tech Stack & Prerequisites

| Component | Requirement |
| --- | --- |
| Language and runtime | JavaScript with Node.js 24 or later and npm |
| Web framework and production dependency | `express` (`^5.3.0`) handles HTTP routing and JSON request parsing. |
| Database | SQLite through Node.js's built-in `node:sqlite` module. The API uses a local database file. |

## Installation & Setup

1. **Clone** the repository and enter the project directory.

   ```bash
   git clone https://github.com/PawBer/medremedy.git
   cd medremedy
   ```

2. **Install** the dependencies from `package-lock.json`.

   ```bash
   npm ci
   ```

3. **Configure** `MEDREMEDY_USERS` as a JSON array in the environment before starting the server. Give every account a `role` and a unique, randomly generated `token`.

   | `role` | Required account fields in addition to `role` and `token` |
   | --- | --- |
   | `donor` | `id`, `name`, `email` |
   | `clinic` | `id`, `name`, `email`, `address`, `is_verified` (boolean) |
   | `admin` | `id` (unique string) |

   Use positive 32-bit integer IDs for donors and clinics. Keep IDs and email addresses unique within each role. The API compares email addresses case-insensitively. The clinic role controls access to listing and claiming donations. The `is_verified` field stores profile information.

4. **Start** the local server.

   ```bash
   npm start
   ```

   The API listens on `http://localhost:3000` with the default configuration. Set `PORT` to change the port. The API creates the SQLite tables automatically at startup in `data/medremedy.sqlite`. Set `MEDREMEDY_DB_PATH` to use a different file. The API inserts or updates donor and clinic profiles by ID at startup and stores their donation history in SQLite. Removing an account from `MEDREMEDY_USERS` revokes access and preserves its stored profile and history. Bearer tokens and admin accounts stay in the environment configuration. See the [data model](documentation/schema.mermaid).

5. **Run** the automated API tests.

   ```bash
   npm test
   ```

Follow the [local demo guide](documentation/DEMO.md) to start with the included sample database, configure the demo accounts, and try the full donation workflow, or import the [Postman collection](documentation/medremedy.postman_collection.json). See the [endpoint checklist](documentation/endpoint-checklist.md) for a quick method and role matrix.

## API Reference Guide

Send `Authorization: Bearer <token>` with each request. Use `Content-Type: application/json` when sending a JSON body. Endpoints with response bodies return JSON; `204 No Content` has an empty body.

| HTTP method | URL path | Role | Required JSON payload keys | Success status | Purpose |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/donations/register` | Donor | `drug_name`, `serial_number`, `expiration_date` | `201 Created` | Registers a donation with its generated ID, authenticated `donor_id`, `sealed: true`, and `status: "available"`. |
| `GET` | `/donations/available` | Clinic | None | `200 OK` | Returns a JSON array of available, unexpired donations. |
| `PUT` | `/clinics/claim/:id` | Clinic | None | `200 OK` | Reserves a donation and returns it with `status: "claimed"` and a nested `claim` object. |
| `DELETE` | `/donations/:id` | Donor or admin | None | `204 No Content` | Removes the listing and any associated claim. Donors can remove their own donations, and administrators can remove any donation. |

- **Registration.** Use nonblank strings for the name and serial number and a valid `YYYY-MM-DD` expiration date. The API treats medication as valid through the expiration day in UTC. The optional `quantity` defaults to `1` and must be a positive 32-bit integer. By registering a donation, the donor declares that the medication is sealed and non-controlled. Physical condition and controlled status require verification outside the API.
- **Claims.** The `claim` object includes `id`, `donation_id`, `clinic_id`, `claimed_at` (an ISO 8601 UTC timestamp), and `status`. Repeating a claim as the same clinic returns the existing claim with its original ID and timestamp.

### Error Responses

The API returns a JSON object with an `error` string for application-level validation and authorization failures. For example, a registration request with a quantity of `0` returns `400 Bad Request` with this body.

```json
{
  "error": "quantity must be a positive 32-bit integer."
}
```

| Status | Condition |
| --- | --- |
| `400 Bad Request` | The registration fields are missing or invalid, or the medication has expired. |
| `401 Unauthorized` | The bearer token is missing or invalid. |
| `403 Forbidden` | The account has the wrong role or a donor tries to delete another donor's listing. |
| `404 Not Found` | The donation ID is invalid or does not exist. |
| `409 Conflict` | A clinic tries to claim an expired donation or one already claimed by another clinic. |

Express handles malformed JSON before the route runs and may return an HTML error body.
