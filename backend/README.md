# Go API

## Requirements
- Go 1.22+
- PostgreSQL 14+
- Node.js and npm (signed PDF stamping)

## Setup
1. Create database: `CREATE DATABASE signora_db;`
2. Run schema: `psql -U postgres -d signora_db -f schema.sql`
3. Copy `.env.example` to `.env` and edit values.
4. Set your actual `DATABASE_URL` and `JWT_SECRET` in `.env`. The server loads it automatically when started from this directory. Configure SMTP settings for email delivery; leave credentials out of version control.
5. `go mod download` and `npm ci`
6. `go run ./cmd/server`

API runs at http://localhost:8080. Uploads are stored locally in `uploads/`.
Signed PDFs are stored in `signed/` (or `SIGNED_DIR`). Run `go test ./...` and
`npm test` here. Rerun the complete schema on existing Phase 1 databases before
using signing: it adds signed PDF storage, signers, signature boxes, audit events,
and email tracking. Startup checks connectivity but does not migrate the database.
