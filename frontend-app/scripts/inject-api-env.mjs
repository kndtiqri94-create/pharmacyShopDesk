// Run in the CI workspace (or your own shell) BEFORE `ng build --configuration production`.
// It fills the build-time placeholders from environment variables so that the real API address
// and the stop-gap bearer token are never committed:
//   API_BASE_URL    e.g. https://shop.example.lk/api/v1   (must be https)
//   API_AUTH_TOKEN  the stop-gap token (F-3.5 replaces it with real sign-in)
// It edits src/environments/environment.prod.ts and src/index.html in place. Never commit the result.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const token = (process.env.API_AUTH_TOKEN ?? '').trim();

function fail(message) {
  console.error(`inject-api-env: ${message}`);
  process.exit(1);
}

if (!baseUrl.startsWith('https://')) fail('API_BASE_URL must be set and start with https://');
if (token.length === 0) fail('API_AUTH_TOKEN must be set');
if (/['"`\\\s]/.test(token + baseUrl))
  fail('values must not contain quotes, backslashes or spaces');

const origin = new URL(baseUrl).origin;

function replaceIn(file, replacements) {
  const target = path.join(root, file);
  let text = readFileSync(target, 'utf8');
  for (const [placeholder, value] of replacements) {
    if (!text.includes(placeholder)) fail(`${file} has no ${placeholder} placeholder`);
    text = text.split(placeholder).join(value);
  }
  writeFileSync(target, text);
}

replaceIn('src/environments/environment.prod.ts', [
  ['__API_BASE_URL__', baseUrl],
  ['__API_AUTH_TOKEN__', token],
]);
replaceIn('src/index.html', [['__API_ORIGIN__', origin]]);
console.log('inject-api-env: placeholders filled. Do not commit these files.');
