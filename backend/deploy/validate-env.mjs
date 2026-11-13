import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Validate locally without opening a database connection or printing secrets.
export function validateEnvironment(env) {
  const errors = [];
  const warnings = [];
  const port = Number(env.PORT);
  if (!/^\d+$/.test(env.PORT || '') || !Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer from 1 to 65535.');
  }
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET) < 32 ||
      /development|replace|change_me|GENERATE|YOUR_/i.test(env.JWT_SECRET)) {
    errors.push('JWT_SECRET must be a newly generated random secret of at least 32 bytes.');
  }
  try {
    const origin = new URL(env.FRONTEND_URL);
    if (origin.protocol !== 'https:' || origin.origin !== env.FRONTEND_URL ||
        origin.username || origin.password || /YOUR_/i.test(origin.hostname)) throw new Error();
  } catch {
    errors.push('FRONTEND_URL must be the exact HTTPS frontend origin, without a trailing slash, path or query.');
  }
  try {
    const db = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(db.protocol) ||
        !db.hostname.endsWith('.neon.tech') || !db.username || !db.password ||
        db.pathname.length < 2) throw new Error();
    if (db.searchParams.get('sslmode') !== 'verify-full' ||
        db.searchParams.get('sslrootcert') !== 'system') {
      errors.push('DATABASE_URL must use sslmode=verify-full and sslrootcert=system.');
    }
    // pgx 5.7.2 forwards unrecognized libpq options as server parameters.
    if (db.searchParams.has('channel_binding')) {
      errors.push('Remove channel_binding from DATABASE_URL for the pinned pgx 5.7.2 driver; retain verified TLS.');
    }
    const allowed = new Set(['sslmode', 'sslrootcert', 'connect_timeout', 'pool_max_conns',
      'pool_min_conns', 'pool_max_conn_idle_time', 'pool_max_conn_lifetime', 'application_name']);
    for (const name of db.searchParams.keys()) {
      if (name !== 'channel_binding' && !allowed.has(name)) {
        errors.push('DATABASE_URL contains an unsupported connection option.');
        break;
      }
      if (db.searchParams.getAll(name).length !== 1) {
        errors.push('DATABASE_URL must not contain duplicate connection options.');
        break;
      }
    }
    const max = db.searchParams.get('pool_max_conns') || '4';
    if (!/^[1-4]$/.test(max)) errors.push('Use pool_max_conns between 1 and 4 for this Free preview.');
    if (db.searchParams.has('pool_min_conns') && db.searchParams.get('pool_min_conns') !== '0') {
      errors.push('Use pool_min_conns=0 so idle connections can close.');
    }
  } catch {
    errors.push('DATABASE_URL must be a PostgreSQL URI with a Neon DNS hostname, role, password and database.');
  }
  for (const name of ['UPLOAD_DIR', 'SIGNED_DIR']) {
    if (!env[name] || !path.posix.isAbsolute(env[name])) errors.push(`${name} must be an absolute container path.`);
  }
  if (env.ALLOW_EPHEMERAL_PDF_STORAGE !== 'true') {
    errors.push('This Free preview requires ALLOW_EPHEMERAL_PDF_STORAGE=true to acknowledge that local PDFs are not durable.');
  } else {
    warnings.push('Render Free local PDFs are temporary and can be lost on sleep, restart or redeploy. Use disposable documents only.');
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
    errors.push('Set both SMTP_USER and SMTP_PASS, or leave both unset.');
  } else if (env.SMTP_USER && env.SMTP_PASS) {
    const smtpPort = Number(env.SMTP_PORT);
    if (!env.SMTP_HOST || !/^\d+$/.test(env.SMTP_PORT || '') || smtpPort < 1 || smtpPort > 65535) {
      errors.push('Configured SMTP requires SMTP_HOST and a valid SMTP_PORT.');
    } else if ([25, 465, 587].includes(smtpPort)) {
      errors.push('Render Free blocks SMTP ports 25, 465 and 587. Leave SMTP disabled or use an explicitly supported encrypted alternative.');
    }
  } else {
    warnings.push('SMTP is disabled. Share signing links manually; invitation, reminder and completion emails will not be delivered.');
  }
  return { errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { errors, warnings } = validateEnvironment(process.env);
  for (const warning of warnings) console.warn(`Deployment notice: ${warning}`);
  for (const error of errors) console.error(`Deployment configuration error: ${error}`);
  if (errors.length) process.exitCode = 1;
}
