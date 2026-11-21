# Endpoint Checklist & Path Matrix

## Checklist

| Done | Method | Path | Roles | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| [x] | `POST` | `/donations/register` | `donor` | `201` | `400`, `401`, `403` |
| [x] | `GET` | `/donations/available` | `clinic` | `200` | `401`, `403` |
| [x] | `PUT` | `/clinics/claim/:id` | `clinic` | `200` | `401`, `403`, `404`, `409` |
| [x] | `DELETE` | `/donations/:id` | `donor` (own), `admin` | `204` | `401`, `403`, `404` |

## Path Matrix

| Path | `GET` | `POST` | `PUT` | `DELETE` | `donor` | `clinic` | `admin` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/donations/register` | — | `201` | — | — | Yes | No (`403`) | No (`403`) |
| `/donations/available` | `200` | — | — | — | No (`403`) | Yes | No (`403`) |
| `/clinics/claim/:id` | — | — | `200` | — | No (`403`) | Yes | No (`403`) |
| `/donations/:id` | — | — | — | `204` | Own only | No (`403`) | Yes |
