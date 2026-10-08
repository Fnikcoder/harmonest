# Harmonest Backend (Spring Boot)

Single Spring Boot service replacing the AWS Lambda + API Gateway stack.

## Responsibilities

| Area | Endpoint prefix | Auth |
|------|-----------------|------|
| Login / profile | `/api/v1/auth` | Public login; JWT for `/me` |
| Sync listings | `POST /api/v1/sync/listings` | JWT (admin) |
| Sync reservations | `POST /api/v1/sync/reservations` | JWT (admin) |
| Check-in | `/api/v1/checkin` | Public |
| Email verification | `/api/v1/email-verification` | Public |

Guesty integration uses **Guesty Open API** (OAuth2), not GuestyForHosts.

## Prerequisites

- Java 17+
- Docker (optional, recommended)

## Run with Docker

```bash
cd backend
docker compose up --build
```

- API: http://localhost:8080
- Swagger: http://localhost:8080/swagger-ui.html
- Dev admin: `admin@harmonest.de` / `changeme`

## Run locally (Gradle)

```bash
cd backend
./gradlew bootRun
```

Requires MongoDB at `mongodb://localhost:27017/harmonest`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | HS256 secret (min 32 chars) |
| `GUESTY_CLIENT_ID` | Guesty Open API client id |
| `GUESTY_CLIENT_SECRET` | Guesty Open API secret |
| `CORS_ALLOWED_ORIGINS` | Comma-separated Angular origins |

## Next steps (with you)

- Finalize Mongo document shapes and Guesty field mapping
- Wire real email provider (SES / SMTP)
- Point Angular `master-config.json` API base URLs to this service
- Implement full Guesty pagination in `GuestyApiClient`
