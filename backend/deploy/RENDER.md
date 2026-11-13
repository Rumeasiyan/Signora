# Signora backend on Render Free (preview only)

Prepared from Divaranan/Signora branch `fix/signora-full-integration`, commit
`6f6e31d20284c8886ff3f04630c4167ec3ab892f`. No existing Go application source,
dependencies, schema or nested starter files need to change for this preview.

## Important limitations

Render Free has ephemeral local storage, cannot attach persistent disks, spins
down after idle time, and blocks outbound SMTP ports 25, 465 and 587. Uploaded
and signed PDFs in this app are filesystem files, not PostgreSQL blobs. Neon
retains metadata but cannot recover an original PDF lost by the container.
Regeneration also needs that original. Use only disposable preview documents.

The Blueprint disables automatic deploys, but creating a service still triggers
its initial deployment. Do not import the Blueprint until deployment is approved.
No migration, Neon connection or Render API call is performed by these files.

## Exact Render service settings

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/Divaranan/Signora` |
| Branch | `fix/signora-full-integration` |
| Service | Web Service |
| Runtime | Docker |
| Plan | Free |
| Root Directory | Leave blank (repository root) |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Build Context | `./backend` |
| Build Command | Leave blank; Dockerfile handles builds |
| Docker/Start Command override | Leave blank; use Dockerfile CMD |
| Health Check Path | `/health` |
| Auto Deploy | Off |
| Region | Choose near the existing Neon region before creating the service |

`render.yaml` at the repo root contains these settings. Do not point Render at
the nested `phase1-signora/backend` starter. The current Go listener `":"+PORT`
binds on all interfaces and already supports Render's assigned PORT.

## Runtime environment

Use Render's secret environment settings; do not add a real .env file to Git or
pass secrets as Docker build arguments. `render.env.example` is a template only.

| Variable | Required setting |
| --- | --- |
| `DATABASE_URL` | Secret Neon application-role URI with verified TLS; see below |
| `JWT_SECRET` | New random secret, at least 32 bytes; Blueprint generates it |
| `FRONTEND_URL` | Exact HTTPS browser origin, with no trailing slash or path |
| `PORT` | Automatically supplied by Render, normally 10000; do not hardcode Go |
| `UPLOAD_DIR` | `/var/lib/signora/uploads` (ephemeral on Free) |
| `SIGNED_DIR` | `/var/lib/signora/signed` (ephemeral on Free) |
| `ALLOW_EPHEMERAL_PDF_STORAGE` | `true`, explicit acknowledgement for preview |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional; leave credentials unset for Free preview |

The image supplies NODE_ENV=production and the filesystem/PORT defaults. Its
non-root `node` user owns the two data directories; /tmp remains available for
Go/Node stamping payloads. It installs CA certificates for PostgreSQL and SMTP
TLS. The wrapper fails closed on missing/default JWT secrets, insecure Neon TLS,
invalid CORS origins and incompatible SMTP settings without logging their values.

For the separate frontend, set `NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com`
before its Next.js build. This is not a backend environment variable. FRONTEND_URL
also controls links in invitation emails; it must identify the frontend, not API.

## Neon connection settings (no live connection performed)

Use the Connect dialog's database, role and DNS hostname. Prefer the provided
pooled (`-pooler`) hostname for the application and URL-encode credentials.
Replace only template fields in this example, not with values in source control:

```text
postgresql://APP_ROLE:URL_ENCODED_PASSWORD@ep-YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=verify-full&sslrootcert=system&connect_timeout=10&pool_max_conns=4&pool_min_conns=0&pool_max_conn_idle_time=60s
```

Use sslmode=verify-full with system CA roots: certificate and DNS hostname are
verified, SNI is retained, and no unencrypted fallback is allowed. Do not use an
IP address, sslmode=disable/prefer, or skip certificate validation. The small
pgx pool avoids keeping idle connections alive unnecessarily. Do not add host
override parameters that replace the Neon hostname.

The pinned pgx 5.7.2 driver does not implement libpq's channel_binding option;
it forwards an unknown option to PostgreSQL as a server parameter. If a copied
Neon URI contains channel_binding=require, omit that option for this driver and
retain verify-full/system CA verification. This is verified by offline parsing,
not a live Neon handshake. Supporting channel binding requires a separately
reviewed driver upgrade, not adding an unrecognized option.

The existing backend attempts its initial DB connection within 10 seconds and
does not migrate schema on startup. A sleeping Neon compute may need a retry if
that deadline is exceeded. A configurable longer startup deadline and bounded
retry are recommended follow-up code changes if cold starts prove unreliable.

Before an approved deployment, separately review backend/schema.sql against the
target database. Apply it only after database-change approval, preferably first
on a disposable Neon branch, using a direct connection and a migration role.
The runtime application role should have only required privileges. No automated
schema command or migration secret is configured in the Dockerfile/Blueprint.

## PDF stamping runtime

This is a multi-stage Go + Node image, not a Go-only service. It builds a static
Linux Go executable, installs locked backend pdf-lib dependencies, and copies
scripts/stamp_pdf.js. WORKDIR=/app lets findStampScript locate scripts/stamp_pdf.js
and Node find /app/node_modules. No Ghostscript, headless browser, frontend build,
or OS PDF library is required by the present stamper. Node 24 is the runtime;
the browser PDF.js 6.5.438 fix remains in the separate frontend unchanged.

The current stamp call allows 90 seconds and runs finalization and sequential
email delivery in the HTTP request. Render Free's limited memory and shared CPU
need representative PDF/load testing. No Docker memory/load test is claimed.

## Email options

Leaving SMTP_USER/SMTP_PASS unset is an explicit manual-link preview: invitation
and reminder API responses include per-recipient email failures and shareable
links. Completion emails are also not delivered. Gmail 465/587 cannot work on
Render Free. Changing credentials does not bypass that network restriction.

For reliable notifications on Free, implement an HTTPS email transport in the
backend services and add its provider settings after separate approval. An API
key alone will not enable it: that transport is not implemented here. A provider
with an explicitly supported encrypted alternative SMTP port might work, but no
provider or such delivery has been tested. A paid Render plan can use supported
SMTP ports, subject to current Render policy and sender authentication.

## Required work before durable/production use

Either move to paid Render with persistent storage, or implement private object
storage for originals and signed artifacts. The latter requires coordinated
updates to document upload/view/download/delete handlers, public PDF serving,
stamping fetch/upload/temp staging, regeneration and email attachment handling.
No bucket variables currently exist; adding them alone will not change storage.

Also address dependency advisories from the integration review, durable
finalization/retry, signed-file retention, authentication hardening, trusted-proxy
audit IP handling and a DB/storage readiness check. /health is process health,
not an ongoing database/storage readiness test. These are follow-up changes,
not silently included in this deployment packaging.

## Validation and later build commands

```sh
node --test backend/deploy/validate-env.test.mjs
docker build -f backend/Dockerfile -t signora-api:render-preview backend
```

A later approved container smoke test must provide synthetic configuration and
a disposable database. Never use production credentials in a build command,
CLI log or Docker ARG. Go 1.27 and Node 24 image references are pinned to the
public multi-platform manifest digests verified during preparation. Review and
refresh those digests for future security updates before a later deployment.

Docker is unavailable in the preparation environment, so image build/run and
actual Render/Neon connectivity remain unverified. Offline environment guards,
pgx TLS parsing and Linux Go cross-compilation can be checked without a DB.

## Sources

- https://render.com/docs/free
- https://render.com/docs/web-services#port-binding
- https://render.com/docs/docker
- https://render.com/docs/blueprint-spec
- https://neon.com/docs/connect/connect-securely
- https://neon.com/docs/connect/connection-errors
