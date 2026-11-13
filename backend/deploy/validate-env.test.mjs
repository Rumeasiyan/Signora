import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateEnvironment } from './validate-env.mjs';

const fixture = () => ({
  PORT: '10000',
  JWT_SECRET: 'synthetic-test-secret-abcdefghijklmnopqrstuvwxyz',
  FRONTEND_URL: 'https://signora.example.com',
  DATABASE_URL: 'postgresql://test_role:synthetic_test_password@ep-test-pooler.us-east-2.aws.neon.tech/test_db?sslmode=verify-full&sslrootcert=system&pool_max_conns=4&pool_min_conns=0',
  UPLOAD_DIR: '/var/lib/signora/uploads',
  SIGNED_DIR: '/var/lib/signora/signed',
  ALLOW_EPHEMERAL_PDF_STORAGE: 'true',
});

test('accepts verified-TLS Neon preview configuration and Render-assigned ports', () => {
  assert.deepEqual(validateEnvironment(fixture()).errors, []);
  assert.deepEqual(validateEnvironment({ ...fixture(), PORT: '12345' }).errors, []);
  assert.equal(validateEnvironment(fixture()).warnings.length, 2);
});
test('rejects missing/default secrets, insecure database URLs and wrong CORS origins', () => {
  for (const override of [
    { JWT_SECRET: '' }, { JWT_SECRET: 'development_only_change_me' },
    { DATABASE_URL: fixture().DATABASE_URL.replace('verify-full', 'disable') },
    { DATABASE_URL: 'postgresql://test:synthetic@localhost/db?sslmode=disable' },
    { FRONTEND_URL: 'https://signora.example.com/' }, { FRONTEND_URL: 'http://signora.example.com' },
    { PORT: 'invalid' }, { PORT: '0' }, { UPLOAD_DIR: './uploads' },
    { ALLOW_EPHEMERAL_PDF_STORAGE: 'false' },
  ]) assert(validateEnvironment({ ...fixture(), ...override }).errors.length > 0);
});
test('rejects driver-incompatible and overridden PostgreSQL options', () => {
  for (const option of ['channel_binding=require', 'host=localhost', 'pool_max_conns=50']) {
    assert(validateEnvironment({ ...fixture(), DATABASE_URL: fixture().DATABASE_URL + '&' + option }).errors.length > 0);
  }
});
test('rejects SMTP configuration that cannot work on Render Free', () => {
  for (const port of ['25', '465', '587']) {
    assert(validateEnvironment({ ...fixture(), SMTP_HOST: 'smtp.example.com', SMTP_PORT: port,
      SMTP_USER: 'synthetic', SMTP_PASS: 'synthetic' }).errors.length > 0);
  }
  assert(validateEnvironment({ ...fixture(), SMTP_USER: 'synthetic' }).errors.length > 0);
});
test('CLI validation fails without printing supplied secret values', () => {
  const secret = 'unique_synthetic_password_that_must_not_be_logged';
  const env = { ...process.env, ...fixture(), DATABASE_URL: `invalid://${secret}`, JWT_SECRET: '' };
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-env.mjs', import.meta.url))], { env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert(!`${result.stdout}${result.stderr}`.includes(secret));
});
