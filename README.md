# Signora

One application lives in `backend/` and `frontend/`. PR #15's nested
`phase1-signora/` starter is integrated here; do not run a second copy.

Elaveny's registration, login, JWT sessions, PDF upload and dashboard connect to
Divaranan's box placement and token-based signing workflow and Kisho's SMTP
notifications, signed PDF finalization, completion certificate and audit timeline.

## Setup

Use Go 1.22+, Node.js 22.13+ (or 24+) with npm, and PostgreSQL. From `backend/`, run
`go mod download` and `npm ci` (the PDF stamper uses Node and pdf-lib).
From `frontend/`, run `npm ci`. Keep the root frontend's current dependencies;
PR #15's older Next.js manifest must not replace the signing dependencies.

Configure `backend/.env` with your actual DATABASE_URL and JWT_SECRET and set
FRONTEND_URL, PORT, UPLOAD_DIR and SIGNED_DIR as needed. The server loads this
file when started from `backend/`; existing process environment values win.
Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS for email delivery. Without
SMTP credentials, sending returns per-recipient failures and manual signing
links remain available. Do not commit credentials or uploaded/signed PDFs.

Use your existing PostgreSQL credentials to run the complete `backend/schema.sql`
on the intended database, for example with `psql -d YOUR_DATABASE -f backend/schema.sql`.
The schema can be rerun and upgrades Elaveny's original documents table with
signed_file_name, creates signers/boxes/audit tables, and adds email tracking.
Starting the Go server does not apply schema migrations automatically.

Set NEXT_PUBLIC_API_URL in `frontend/.env.local` (see its example). It must point
to the Go API, normally http://localhost:8080. FRONTEND_URL must match the browser
origin, normally http://localhost:3000. Rebuild after changing NEXT_PUBLIC_API_URL.

## Run and verify

From `backend/`:

```sh
go test ./...
npm test
go run ./cmd/server
```

From `frontend/`:

```sh
npm run build
npm start
```

Open http://localhost:3000. The home page redirects to login. Register or log in,
upload a PDF (20 MB maximum), place signature boxes, add and assign signers,
send signing requests, and track progress and audit events. Dashboard cards link
to preparation for drafts and status for sent/completed documents. Uploads go
directly to preparation. Signed PDFs become available after finalization succeeds.

## API contract

All routes use the existing Go server at the API base URL:

| Route | Access | Purpose |
| --- | --- | --- |
| GET /health | Public | Server health |
| POST /api/auth/register, /api/auth/login | Public | JWT session |
| GET /api/auth/me | JWT | Current user |
| POST /api/documents/upload | JWT | Multipart title and file |
| GET /api/documents | JWT | Owner's documents |
| GET /api/documents/{id}/view, /download | JWT | Original PDF |
| DELETE /api/documents/{id} | JWT | Delete own document |
| GET, POST /api/documents/{id}/signers | JWT | List/add signers |
| DELETE /api/documents/{id}/signers/{signerId} | JWT | Remove signer |
| GET, POST /api/documents/{id}/boxes | JWT | Signature placement |
| POST /api/documents/{id}/send | JWT | Email links/reminders |
| GET /api/documents/{id}/status, /audit | JWT | Progress and audit trail |
| GET /api/documents/{id}/signed-download | JWT | Final signed PDF |
| POST /api/documents/{id}/regenerate | JWT | Retry finalization |
| GET /api/signing/{token}, /api/signing/{token}/pdf | Signing token | Review document |
| POST /api/signing/{token}/submit | Signing token | Submit signature |

Protected routes require `Authorization: Bearer <token>`; the shared frontend
API client supplies it. Owner checks remain in the backend. Existing signing
validation, token expiry/replay checks, and transactional signature storage remain.
