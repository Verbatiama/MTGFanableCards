/**
 * Provisions a fresh Ubuntu server (e.g. a DigitalOcean droplet) to run the
 * app with Docker (T-S10, D28, D29). Runs on your machine and sets the server
 * up over SSH as root; safe to run again.
 *
 *   npm run provision -- --host 203.0.113.7 --domain cards.example.com
 *   npm run provision -- --config provision.json [--dry-run]
 *
 * On the server it: updates packages and turns on automatic security updates;
 * adds a swap file; installs Docker; opens only SSH, HTTP and HTTPS in the
 * firewall; creates a deploy user in the docker group (with your SSH keys and,
 * optionally, the GitHub Actions deploy key); and writes the app folder with
 * docker-compose.yml, Caddyfile and .env. `--start` also starts the app.
 *
 * Settings come from the defaults, then the JSON file, then the arguments.
 * See scripts/provision.example.json and docs/self-hosting.md.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT_DIR } from '../src/paths.js';

export const DEFAULTS = {
  host: null,
  sshUser: 'root',
  sshKey: null,
  domain: null,
  deployUser: 'deploy',
  appDir: null, // /home/<deployUser>/fannable
  imageTag: 'main',
  deployKey: null,
  swapGb: 2,
  lowMemory: false,
  start: false,
  env: {},
};

export const USAGE = `Usage: npm run provision -- [--config file.json] [options]

Sets up a fresh Ubuntu server over SSH to run MTG Fannable Cards with Docker.

Options (each overrides the same setting in the JSON file):
  --config <file>      JSON file with any of the settings below (camelCase keys)
  --host <address>     Server IP or name (required)
  --ssh-user <name>    User to connect as (default: root)
  --ssh-key <file>     Private key to connect with (default: your SSH config)
  --domain <name>      Domain for HTTPS with Caddy; without it the app is on port 3000
  --deploy-user <name> User that runs the app and receives deploys (default: deploy)
  --app-dir <path>     App folder (default: /home/<deploy-user>/fannable)
  --image-tag <tag>    Image version: main, latest or vX.Y.Z (default: main)
  --deploy-key <file>  Public key for GitHub Actions to deploy with (optional)
  --swap-gb <n>        Swap file size, 0 for none (default: 2)
  --low-memory         Fit the app on a 1 GB server: sets LOW_MEMORY=true in .env
  --env KEY=VALUE      Extra app setting for .env, e.g. MAX_RUNNING_JOBS=1 (repeatable)
  --start              Pull the image and start the app at the end
  --dry-run            Print the script that would run on the server, and stop
  -h, --help           Show this help
`;

const OPTIONS = {
  config: { type: 'string' },
  host: { type: 'string' },
  'ssh-user': { type: 'string' },
  'ssh-key': { type: 'string' },
  domain: { type: 'string' },
  'deploy-user': { type: 'string' },
  'app-dir': { type: 'string' },
  'image-tag': { type: 'string' },
  'deploy-key': { type: 'string' },
  'swap-gb': { type: 'string' },
  'low-memory': { type: 'boolean' },
  env: { type: 'string', multiple: true },
  start: { type: 'boolean' },
  'dry-run': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

/** `~/x` → your home folder's x, as a shell would. */
const expandHome = (file) =>
  file?.startsWith('~/') ? path.join(os.homedir(), file.slice(2)) : file;

const camel = (flag) => flag.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/**
 * Merges the defaults, the JSON file's settings and the arguments, and checks
 * the result.
 * @param {string[]} argv
 * @param {(file: string) => string} [readFile]
 * @returns {{ config: typeof DEFAULTS, dryRun: boolean, help: boolean }}
 */
export function loadSettings(argv, readFile = (file) => readFileSync(file, 'utf8')) {
  const { values } = parseArgs({ args: argv, options: OPTIONS, strict: true });
  if (values.help) return { config: DEFAULTS, dryRun: false, help: true };

  const file = values.config ? JSON.parse(readFile(values.config)) : {};
  const unknown = Object.keys(file).filter((key) => !(key in DEFAULTS));
  if (unknown.length)
    throw new Error(`Unknown settings in ${values.config}: ${unknown.join(', ')}`);

  const args = {};
  for (const [flag, value] of Object.entries(values)) {
    if (['config', 'dry-run', 'help', 'env'].includes(flag)) continue;
    args[camel(flag)] = flag === 'swap-gb' ? Number(value) : value;
  }
  const env = { ...DEFAULTS.env, ...file.env };
  for (const pair of values.env ?? []) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(pair);
    if (!match) throw new Error(`--env takes KEY=VALUE: ${pair}`);
    env[match[1]] = match[2];
  }

  const config = { ...DEFAULTS, ...file, ...args, env };
  config.appDir ??= `/home/${config.deployUser}/fannable`;
  config.sshKey = expandHome(config.sshKey);
  config.deployKey = expandHome(config.deployKey);
  if (!config.host) throw new Error('No server: give --host or "host" in the JSON file');
  if (!/^[a-z_][a-z0-9_-]*$/.test(config.deployUser)) {
    throw new Error(`Not a valid user name: ${config.deployUser}`);
  }
  if (!/^\/[\w./-]+$/.test(config.appDir)) {
    throw new Error(`appDir must be an absolute path (letters, digits, . _ - /): ${config.appDir}`);
  }
  if (
    config.domain &&
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(config.domain)
  ) {
    throw new Error(`Not a domain name: ${config.domain}`);
  }
  if (!Number.isInteger(config.swapGb) || config.swapGb < 0) {
    throw new Error(`swapGb must be a whole number ≥ 0: ${config.swapGb}`);
  }
  if (typeof config.lowMemory !== 'boolean') {
    throw new Error(`lowMemory must be true or false: ${config.lowMemory}`);
  }
  for (const [key, value] of Object.entries(config.env)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\n\r]/.test(String(value))) {
      throw new Error(`Not a valid .env setting: ${key}`);
    }
  }
  return { config, dryRun: values['dry-run'], help: false };
}

/** The app's .env on the server. */
export function envFile(config) {
  const lines = [
    '# Written by scripts/provision-vps.js; see .env.example for every setting.',
    `FANNABLE_TAG=${config.imageTag}`,
  ];
  if (config.domain) {
    lines.push('COMPOSE_PROFILES=caddy', `DOMAIN=${config.domain}`, 'APP_PORT=127.0.0.1:3000');
  } else {
    lines.push('APP_PORT=3000');
  }
  if (config.lowMemory) lines.push('LOW_MEMORY=true');
  for (const [key, value] of Object.entries(config.env)) lines.push(`${key}=${value}`);
  return `${lines.join('\n')}\n`;
}

/** Single-quotes a value for bash. */
const sh = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const b64 = (text) => Buffer.from(text).toString('base64');

/**
 * The bash script run on the server as root.
 * @param {typeof DEFAULTS} config
 * @param {{ compose: string, caddyfile: string, deployKey: string | null }} files
 */
export function remoteScript(config, { compose, caddyfile, deployKey }) {
  const user = config.deployUser;
  const dir = config.appDir;
  const ports = config.domain ? ['80/tcp', '443/tcp', '443/udp'] : ['3000/tcp'];
  return `#!/bin/bash
# Provisioning for MTG Fannable Cards (scripts/provision-vps.js). Safe to rerun.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
step() { printf '\\n==> %s\\n' "$1"; }

. /etc/os-release
if [ "$ID" != ubuntu ]; then
  echo "This script needs Ubuntu (found $PRETTY_NAME)." >&2
  exit 1
fi

step 'Updating packages'
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl ufw unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

${
  config.swapGb > 0
    ? `step 'Swap file (${config.swapGb} GB)'
if ! swapon --show | grep -q /swapfile; then
  fallocate -l ${config.swapGb}G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi`
    : `step 'No swap file'`
}

step 'Installing Docker'
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

step 'Firewall: SSH, ${ports.join(', ')}'
ufw allow OpenSSH
${ports.map((p) => `ufw allow ${p}`).join('\n')}
ufw --force enable

step 'Deploy user ${user}'
id -u ${sh(user)} >/dev/null 2>&1 || adduser --disabled-password --gecos '' ${sh(user)}
usermod -aG docker ${sh(user)}
home=$(getent passwd ${sh(user)} | cut -d: -f6)
install -d -m 700 -o ${sh(user)} -g ${sh(user)} "$home/.ssh"
keys="$home/.ssh/authorized_keys"
touch "$keys"
# Your own keys, so you can log in as ${user} too.
if [ -f /root/.ssh/authorized_keys ]; then
  while IFS= read -r key; do
    [ -n "$key" ] && ! grep -qxF "$key" "$keys" && echo "$key" >> "$keys"
  done < /root/.ssh/authorized_keys
fi
${
  deployKey
    ? `# The GitHub Actions deploy key.
key=${sh(deployKey.trim())}
grep -qxF "$key" "$keys" || echo "$key" >> "$keys"`
    : '# No deploy key given (--deploy-key).'
}
chown ${sh(user)}: "$keys"
chmod 600 "$keys"

step 'App folder ${dir}'
install -d -o ${sh(user)} -g ${sh(user)} ${sh(dir)}
echo ${sh(b64(compose))} | base64 -d > ${sh(`${dir}/docker-compose.yml`)}
echo ${sh(b64(caddyfile))} | base64 -d > ${sh(`${dir}/Caddyfile`)}
echo ${sh(b64(envFile(config)))} | base64 -d > ${sh(`${dir}/.env`)}
# The container runs as user 1000 and writes CLI output here.
install -d -o 1000 -g 1000 ${sh(`${dir}/out`)}
chown ${sh(user)}: ${sh(`${dir}/docker-compose.yml`)} ${sh(`${dir}/Caddyfile`)} ${sh(`${dir}/.env`)}

${
  config.start
    ? `step 'Starting the app'
cd ${sh(dir)}
sudo -u ${sh(user)} docker compose pull
sudo -u ${sh(user)} docker compose up -d`
    : `step 'Not starting the app (use --start, or run docker compose up -d in ${dir})'`
}

step 'Done'
`;
}

/** Runs `ssh ... bash -s` with the script on stdin; resolves with the exit code. */
function runOverSsh(config, script) {
  const args = ['-o', 'StrictHostKeyChecking=accept-new'];
  if (config.sshKey) args.push('-i', config.sshKey);
  args.push(`${config.sshUser}@${config.host}`, 'bash -s');
  return new Promise((resolve, reject) => {
    const ssh = spawn('ssh', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    ssh.on('error', reject);
    ssh.on('close', resolve);
    ssh.stdin.end(script);
  });
}

export async function main(argv) {
  let settings;
  try {
    settings = loadSettings(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (settings.help) {
    console.log(USAGE);
    return 0;
  }
  const { config, dryRun } = settings;
  const files = {
    compose: readFileSync(path.join(ROOT_DIR, 'docker-compose.yml'), 'utf8'),
    caddyfile: readFileSync(path.join(ROOT_DIR, 'Caddyfile'), 'utf8'),
    deployKey: config.deployKey ? readFileSync(config.deployKey, 'utf8') : null,
  };
  const script = remoteScript(config, files);
  if (dryRun) {
    process.stdout.write(script);
    return 0;
  }

  const target = `${config.sshUser}@${config.host}`;
  console.log(`Provisioning ${target}${config.domain ? ` for https://${config.domain}` : ''}`);
  const code = await runOverSsh(config, script);
  if (code !== 0) {
    console.error(`\nProvisioning stopped with exit code ${code}; it is safe to run again.`);
    return 1;
  }
  console.log(`
Done. Next:
  - Log in as the app user: ssh ${config.deployUser}@${config.host}
  - ${config.domain ? `Point the DNS record for ${config.domain} at ${config.host}, then` : 'Then'} start the app${config.start ? ' (already started)' : `: cd ${config.appDir} && docker compose up -d`}
  - For deploys from GitHub Actions, see docs/self-hosting.md ("Continuous deployment"):
    DEPLOY_HOST=${config.host}, DEPLOY_USER=${config.deployUser}, DEPLOY_PATH=${config.appDir},
    DEPLOY_KNOWN_HOSTS from: ssh-keyscan ${config.host}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
