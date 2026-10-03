import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { envFile, loadSettings, remoteScript } from '../../scripts/provision-vps.js';

const FILES = { compose: 'services: {}\n', caddyfile: '{$DOMAIN} {}\n', deployKey: null };
const json = (settings) => () => JSON.stringify(settings);
const load = (argv, file = {}) => loadSettings(argv, json(file)).config;

test('settings: defaults, then the JSON file, then the arguments', () => {
  const file = {
    host: 'from-file',
    domain: 'file.example.com',
    swapGb: 4,
    env: { A: '1', B: '2' },
  };
  const config = load(
    ['--config', 'p.json', '--domain', 'args.example.com', '--env', 'B=3', '--start'],
    file,
  );
  assert.equal(config.host, 'from-file');
  assert.equal(config.domain, 'args.example.com');
  assert.equal(config.swapGb, 4);
  assert.equal(config.start, true);
  assert.deepEqual(config.env, { A: '1', B: '3' });
  assert.equal(config.sshUser, 'root');
  assert.equal(config.appDir, '/home/deploy/fannable');
  assert.equal(load(['--host', 'h', '--deploy-user', 'app']).appDir, '/home/app/fannable');
});

test('key paths starting with ~ are in your home folder', () => {
  const config = load(['--host', 'h', '--ssh-key', '~/.ssh/id_ed25519']);
  assert.equal(config.sshKey, path.join(os.homedir(), '.ssh/id_ed25519'));
});

test('bad settings are refused before connecting', () => {
  const fails = (argv, file, pattern) => assert.throws(() => load(argv, file), pattern);
  fails([], {}, /No server/);
  fails(['--config', 'p.json'], { host: 'h', hots: 'typo' }, /Unknown settings.*hots/);
  fails(['--host', 'h', '--deploy-user', 'Bad User'], {}, /user name/);
  fails(['--host', 'h', '--app-dir', '~/fannable'], {}, /absolute path/);
  fails(['--host', 'h', '--domain', 'not a domain'], {}, /Not a domain/);
  fails(['--host', 'h', '--swap-gb', 'lots'], {}, /swapGb/);
  fails(['--host', 'h', '--env', 'lower=1'], {}, /KEY=VALUE/);
  fails(['--config', 'p.json'], { host: 'h', lowMemory: 'yes' }, /lowMemory/);
  fails(['--host', 'h', '--bogus'], {}, /Unknown option/);
});

test('.env: HTTPS through Caddy with a domain, port 3000 without', () => {
  const https = envFile(load(['--host', 'h', '--domain', 'cards.example.com', '--env', 'X=1']));
  assert.match(https, /^FANNABLE_TAG=main$/m);
  assert.match(https, /^COMPOSE_PROFILES=caddy$/m);
  assert.match(https, /^DOMAIN=cards\.example\.com$/m);
  assert.match(https, /^APP_PORT=127\.0\.0\.1:3000$/m);
  assert.match(https, /^X=1$/m);
  const plain = envFile(load(['--host', 'h', '--image-tag', 'latest']));
  assert.doesNotMatch(plain, /caddy|DOMAIN/);
  assert.match(plain, /^APP_PORT=3000$/m);
  assert.match(plain, /^FANNABLE_TAG=latest$/m);
  assert.doesNotMatch(plain, /LOW_MEMORY/);
});

test('.env: --low-memory turns on LOW_MEMORY for a 1 GB server (T-S13)', () => {
  assert.match(envFile(load(['--host', 'h', '--low-memory'])), /^LOW_MEMORY=true$/m);
  const fromFile = load(['--config', 'p.json'], { host: 'h', lowMemory: true });
  assert.match(envFile(fromFile), /^LOW_MEMORY=true$/m);
});

test('the server script is valid bash and opens only the ports it needs', () => {
  const syntax = (script) => execFileSync('bash', ['-n'], { input: script });
  const https = remoteScript(load(['--host', 'h', '--domain', 'cards.example.com']), {
    ...FILES,
    deployKey: "ssh-ed25519 AAAA it's-a-key\n",
  });
  syntax(https);
  assert.match(https, /ufw allow 443\/tcp/);
  assert.doesNotMatch(https, /ufw allow 3000/);
  assert.match(https, /key='ssh-ed25519 AAAA it'\\''s-a-key'/);

  const plain = remoteScript(load(['--host', 'h', '--swap-gb', '0', '--start']), FILES);
  syntax(plain);
  assert.match(plain, /ufw allow 3000\/tcp/);
  assert.doesNotMatch(plain, /fallocate/);
  assert.match(plain, /docker compose up -d/);
});
