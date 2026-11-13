import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateVercelEnvironment } from './vercel-validate-env.mjs';

const fixture = () => ({
  PORT: '8080', JWT_SECRET: 'synthetic-test-secret-abcdefghijklmnopqrstuvwxyz',
  FRONTEND_URL: 'https://signora.example.com',
  DATABASE_URL: 'postgresql://test:synthetic@ep-test-pooler.us-east-2.aws.neon.tech/test?sslmode=verify-full&sslrootcert=system&pool_max_conns=4&pool_min_conns=0',
  UPLOAD_DIR: '/tmp/signora/uploads', SIGNED_DIR: '/tmp/signora/signed',
  ALLOW_EPHEMERAL_PDF_STORAGE: 'true', ACKNOWLEDGE_VERCEL_UPLOAD_LIMIT: 'true',
});

test('accepts preview configuration while retaining platform warnings', () => {
  const result = validateVercelEnvironment(fixture());
  assert.deepEqual(result.errors, []);
  assert(result.warnings.some(w => w.includes('4.5 MB')));
  assert(result.warnings.some(w => w.includes('not') || w.includes('neither')));
});
test('requires explicit acknowledgement of both incompatible platform constraints', () => {
  for (const field of ['ALLOW_EPHEMERAL_PDF_STORAGE', 'ACKNOWLEDGE_VERCEL_UPLOAD_LIMIT']) {
    assert(validateVercelEnvironment({ ...fixture(), [field]: '' }).errors.length > 0);
  }
});
test('rejects insecure TLS, wrong CORS, weak secrets and non-scratch storage', () => {
  for (const patch of [
    { JWT_SECRET: 'development_only_change_me' }, { PORT: '80' }, { PORT: 'invalid' },
    { FRONTEND_URL: 'http://signora.example.com' }, { FRONTEND_URL: 'https://signora.example.com/' },
    { DATABASE_URL: fixture().DATABASE_URL.replace('verify-full', 'disable') },
    { DATABASE_URL: fixture().DATABASE_URL + '&host=localhost' },
    { DATABASE_URL: fixture().DATABASE_URL + '&channel_binding=require' },
    { UPLOAD_DIR: '/app/uploads' }, { SIGNED_DIR: '/tmp/../etc' }, { SIGNED_DIR: fixture().UPLOAD_DIR },
  ]) assert(validateVercelEnvironment({ ...fixture(), ...patch }).errors.length > 0);
});
test('allows provider SMTP on 465/587 unlike Render Free, rejects port 25 and partial credentials', () => {
  for (const port of ['465', '587']) assert.deepEqual(validateVercelEnvironment({ ...fixture(), SMTP_HOST: 'smtp.example.com', SMTP_PORT: port, SMTP_USER: 'synthetic', SMTP_PASS: 'synthetic' }).errors, []);
  assert(validateVercelEnvironment({ ...fixture(), SMTP_HOST: 'smtp.example.com', SMTP_PORT: '25', SMTP_USER: 'synthetic', SMTP_PASS: 'synthetic' }).errors.length > 0);
  assert(validateVercelEnvironment({ ...fixture(), SMTP_USER: 'synthetic' }).errors.length > 0);
});
test('does not log supplied secret values on CLI failure', () => {
  const secret = 'unique_synthetic_password_not_to_log';
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./vercel-validate-env.mjs', import.meta.url))], { env: { ...process.env, ...fixture(), DATABASE_URL: `invalid://${secret}` }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert(!`${result.stdout}${result.stderr}`.includes(secret));
});
