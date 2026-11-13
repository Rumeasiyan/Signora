# Signora Vercel Hobby preparation

Prepared from fork commit 5377b3b68c5a6d8c5c5c16378057d515942a5f4c, which
includes repair 6f6e31d and the reviewed Render files. All existing application
and Render files remain unchanged. This directory is an isolated source export,
not a linked Vercel project. No cloud configuration or database was changed.

## Recommendation

Use a separate backend project with the Container preset. The existing Go server
needs Node and pdf-lib for finalization; packaging both in one image preserves
that runtime contract. Current Vercel supports Go HTTP servers directly too,
but a native Go build does not itself define/install this Node subprocess
dependency. It is therefore not the minimum reliable packaging for Signora.

Services is useful for a future combined frontend/backend deployment, not for
this request to leave the existing frontend alone. It retains function limits
and does not provide persistent files or bypass payload restrictions.

Sources: https://vercel.com/docs/functions/runtimes/go and
https://vercel.com/docs/services

## Exact candidate settings

| Setting | Value |
| --- | --- |
| Project | NEW backend-only project, e.g. signora-api-preview |
| Git repository | Divaranan/Signora |
| Root directory | backend |
| Framework preset | Container (beta) |
| Dockerfile | Dockerfile.vercel, relative to backend |
| Docker build context | backend |
| Build/install/start command overrides | Leave unset; Dockerfile owns them |
| Project PORT environment variable | 8080 (must match container) |
| Automatic Git deployment | Disabled by backend/vercel.json |
| Region | Choose one close to Neon before deployment approval |
| Existing frontend project | Leave every setting unchanged |

Dockerfile.vercel takes precedence over Go detection. It has a matching
Dockerfile-specific ignore file; the existing Render Dockerfile/.dockerignore
are not edited. The Go process binds :PORT, runs as non-root, and can find
/app/scripts/stamp_pdf.js and /app/node_modules. System CA certificates are
installed, and transient payload/PDF files use /tmp. Docker's filename-specific
ignore file takes precedence over the root ignore file for that Dockerfile.

Sources: https://vercel.com/docs/functions/runtimes/container and
https://docs.docker.com/build/concepts/context/#dockerignore-files

Do not import, link, deploy, or run vercel build/dev now. Container builds can
upload images to Vercel Container Registry. Actual container validation needs
Docker, which is unavailable here. backend/vercel.json does not affect an
existing frontend project rooted at frontend; no root vercel.json is added.

## Hobby eligibility and relevant limits

The user confirmed personal/non-commercial demo/coursework. That use fits the
published Hobby restriction; commercial/business use requires a paid plan.
Current Go, Container and Services docs list beta availability on all plans.
Actual account entitlement/usage and project feature availability were not
queried because no Vercel account/project was accessed.

| Limit / allowance | Published value |
| --- | --- |
| Function request payload | 4.5 MB, including multipart overhead |
| Buffered response payload | 4.5 MB; documented streaming exception |
| Hobby memory / CPU | 2 GB / 1 vCPU |
| General Fluid Function maximum duration on Hobby | 300 seconds |
| Monthly Active CPU / provisioned memory | 4 CPU-hours / 360 GB-hours |
| Monthly invocations / transfer | 1 million / 100 GB Fast Data Transfer |
| Hobby VCR repositories per project / images per repository | 10 / 50 |
| VCR compressed layer / total compressed image | 2 GB / 15 GB |

The container documentation inherits Function limits. The detailed duration table
names Node/Bun/Python rather than giving a separate container table, so verify
the effective container setting in the new project before approval to deploy;
do not rely on outdated 10/60-second summaries. The 90-second stamper timeout
plus sequential SMTP work still needs end-to-end time/load measurement.

Container Registry publishes storage pricing of $0.10/GB. Hobby availability
does not establish that every container-storage resource is free; confirm the
account's allowance/billing behavior before creating a service or image.

Sources:
- https://vercel.com/legal/terms (Hobby use)
- https://vercel.com/docs/plans/hobby (included usage)
- https://vercel.com/docs/functions/limitations (payload/compute)
- https://vercel.com/docs/container-registry/limits-and-pricing

## Full-functionality blockers (configuration alone cannot solve these)

The Go upload handler accepts 20 MB PDFs. Vercel's inbound request limit prevents
that API contract from working unchanged; changing timeout or using Services
does not increase it. The candidate is limited to small disposable PDFs below
the total multipart request cap. The acknowledgement flag is not a bypass.

Original and signed files are local disk files. Separate requests can reach
different instances; warm-instance reuse is not guaranteed. /tmp is scratch,
not shared or durable storage. Upload followed by view/sign/download can fail
even before a redeploy, so this candidate is not a reliable full signing service.
Neon metadata/signature records cannot recover a missing original PDF.

Before a full deployment, implement private durable object storage and signed
direct browser uploads, then stream or issue authorized signed URLs for reads.
Coordinate changes in backend/internal/handlers/documents.go and signing.go,
services/stamper.go and finalize.go, status/regeneration, frontend/app/upload/page.tsx,
and all viewing/download paths. Preserve owner checks, token expiry, audit events
and original/signed hashes. Those application changes are not made here.

Source: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions

## Environment variables

Use Vercel runtime secret settings; never Docker ARG, source files or CLI logs.
See vercel.env.example for placeholders, not real credentials.

| Name | Value |
| --- | --- |
| PORT | 8080 in project settings and container |
| DATABASE_URL | Neon pooled URI with verify-full/system CA and bounded pgx pool |
| JWT_SECRET | Newly generated random secret, at least 32 bytes |
| FRONTEND_URL | Existing frontend's exact HTTPS origin, no trailing slash |
| UPLOAD_DIR / SIGNED_DIR | /tmp/signora/uploads and /tmp/signora/signed |
| ALLOW_EPHEMERAL_PDF_STORAGE | true, preview acknowledgement only |
| ACKNOWLEDGE_VERCEL_UPLOAD_LIMIT | true, preview acknowledgement only |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS | Optional existing SMTP provider settings |

Keep sslmode=verify-full&sslrootcert=system and URL-encode DB credentials. The
pinned pgx 5.7.2 forwards channel_binding as an unknown PostgreSQL parameter;
omit that option, retain verified TLS. Its startup connection deadline remains
10 seconds, so Neon cold starts need later measurement/retry design. Schema
application is a separate approval step: no migration runs at container startup.

Vercel blocks SMTP port 25; its guidance allows other outgoing SMTP connections.
The Vercel-specific validator therefore accepts 465/587 rather than inheriting
Render Free's restrictions. Delivery and sender verification are not tested.
Email must complete before the request returns; existing code does that, but
completion retry reliability remains follow-up work.

Sources: https://vercel.com/kb/guide/serverless-functions-and-smtp and
https://neon.com/docs/connect/connection-errors

The existing frontend NEXT_PUBLIC_API_URL is build-time configuration. Do not
change it now. Switching that frontend to the new API origin requires separate
approval and a frontend rebuild once the backend's blockers are resolved.

## Local checks and approval boundary

```sh
node --test backend/deploy/vercel-validate-env.test.mjs
docker build -f backend/Dockerfile.vercel -t signora-api:vercel-preview backend
```

The second command is only a future local build instruction, not executed here.
Do not treat schema checks or cross-compilation as a verified cloud deployment.
No fake api/index.go shim, native runtime switch, maxDuration setting, or Services
rewrite can by itself preserve Node stamping, 20 MB uploads and durable storage.
Original Render files and the repaired workflow remain intact for their existing
hosting approach. Await approval before any publication or Vercel project change.
