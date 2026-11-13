import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Offline checks only. No credential values are included in diagnostics.
export function validateVercelEnvironment(env) {
  const errors = [];
  const warnings = [];
  const port = Number(env.PORT);
  if (!/^\d+$/.test(env.PORT || '') || port < 1024 || port > 65535) {
    errors.push('Set PORT to an unprivileged TCP port (8080 recommended) in both the backend project and container.');
  }
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET) < 32 || /development|replace|GENERATE|YOUR_|change_me/i.test(env.JWT_SECRET)) {
    errors.push('JWT_SECRET must be a newly generated random secret of at least 32 bytes.');
  }
  try {
    const origin = new URL(env.FRONTEND_URL);
    if (origin.protocol !== 'https:' || origin.origin !== env.FRONTEND_URL || origin.username || origin.password) throw new Error();
  } catch {
    errors.push('FRONTEND_URL must be the exact HTTPS frontend origin, without trailing slash, path or query.');
  }
  try {
    const db = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(db.protocol) || !db.hostname.endsWith('.neon.tech') || !db.username || !db.password || db.pathname.length < 2) throw new Error();
    if (db.searchParams.get('sslmode') !== 'verify-full' || db.searchParams.get('sslrootcert') !== 'system') {
      errors.push('DATABASE_URL requires sslmode=verify-full and sslrootcert=system.');
    }
    const allowed = new Set(['sslmode', 'sslrootcert', 'connect_timeout', 'pool_max_conns', 'pool_min_conns', 'pool_max_conn_idle_time', 'pool_max_conn_lifetime', 'application_name']);
    for (const name of db.searchParams.keys()) {
      if (!allowed.has(name) || db.searchParams.getAll(name).length !== 1) {
        errors.push('DATABASE_URL contains an unsupported or duplicate option; omit channel_binding for pinned pgx 5.7.2.');
        break;
      }
    }
    if (!/^[1-4]$/.test(db.searchParams.get('pool_max_conns') || '4') ||
        (db.searchParams.has('pool_min_conns') && db.searchParams.get('pool_min_conns') !== '0')) {
      errors.push('Use pool_max_conns=1..4 and pool_min_conns=0 per container instance.');
    }
  } catch {
    errors.push('DATABASE_URL must be a complete PostgreSQL URI with a Neon DNS hostname.');
  }
  for (const name of ['UPLOAD_DIR', 'SIGNED_DIR']) {
    if (!env[name] || !path.posix.isAbsolute(env[name]) || !path.posix.resolve(env[name]).startsWith('/tmp/')) {
      errors.push(`${name} must be an absolute path beneath /tmp for this preview.`);
    }
  }
  if (env.UPLOAD_DIR && env.SIGNED_DIR && path.posix.resolve(env.UPLOAD_DIR) === path.posix.resolve(env.SIGNED_DIR)) {
    errors.push('UPLOAD_DIR and SIGNED_DIR must be distinct.');
  }
  if (env.ALLOW_EPHEMERAL_PDF_STORAGE !== 'true') {
    errors.push('ALLOW_EPHEMERAL_PDF_STORAGE=true is required to acknowledge disposable, instance-local PDFs.');
  }
  if (env.ACKNOWLEDGE_VERCEL_UPLOAD_LIMIT !== 'true') {
    errors.push('ACKNOWLEDGE_VERCEL_UPLOAD_LIMIT=true is required: platform request limits prevent the full 20 MB workflow.');
  }
  warnings.push('Preview only: local PDFs are neither durable nor shared between instances. Neon metadata does not back up PDF files.');
  warnings.push('Vercel request payloads are limited to 4.5 MB including multipart overhead. Acknowledgement does not bypass this limit.');
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
    errors.push('Set both SMTP_USER and SMTP_PASS, or neither.');
  } else if (env.SMTP_USER) {
    const smtpPort = Number(env.SMTP_PORT);
    if (!env.SMTP_HOST || !/^\d+$/.test(env.SMTP_PORT || '') || smtpPort < 1 || smtpPort > 65535 || smtpPort === 25) {
      errors.push('Configured SMTP requires a provider host and valid port other than blocked port 25.');
    }
  } else {
    warnings.push('SMTP is unset: manual signing links remain available but notification emails will not be sent.');
  }
  return { errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { errors, warnings } = validateVercelEnvironment(process.env);
  warnings.forEach(message => console.warn(`Deployment notice: ${message}`));
  errors.forEach(message => console.error(`Deployment configuration error: ${message}`));
  if (errors.length) process.exitCode = 1;
}
