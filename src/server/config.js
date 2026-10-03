import { isLowMemory } from '../low-memory.js';

/**
 * Server settings from environment variables (D26, D29, D30; Requirements
 * 3.6.1, 3.6.4, 3.6.5). Limits set to 0 are turned off.
 */

/**
 * By default forwarded headers are trusted only from loopback and private
 * addresses (a reverse proxy such as Caddy on the same host or Docker network),
 * so clients can't spoof their IP to get round the rate limits.
 */
const PRIVATE_NETWORKS = '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7';

function number(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a number ≥ 0: ${raw}`);
  return value;
}

/** `TRUST_PROXY`: true, false, or a comma-separated list of addresses and CIDR ranges. */
function trustProxy(raw) {
  if (raw === undefined || raw === '') return PRIVATE_NETWORKS;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return raw;
}

/** @param {Record<string, string | undefined>} [env] */
export function loadConfig(env = process.env) {
  const lowMemory = isLowMemory(env);
  return {
    lowMemory,
    port: number(env, 'PORT', 3000),
    host: env.HOST ?? '0.0.0.0',
    maxBodyBytes: number(env, 'MAX_BODY_KB', 64) * 1024 || Number.MAX_SAFE_INTEGER,
    maxCardsPerJob: number(env, 'MAX_CARDS_PER_JOB', 250),
    maxRunningJobs: Math.max(1, number(env, 'MAX_RUNNING_JOBS', lowMemory ? 1 : 2)),
    jobTtlMs: number(env, 'JOB_TTL_MINUTES', 60) * 60_000,
    rateLimitJobsPerHour: number(env, 'RATE_LIMIT_JOBS_PER_HOUR', 10),
    rateLimitPreviewPerMinute: number(env, 'RATE_LIMIT_PREVIEW_PER_MINUTE', 120),
    trustProxy: trustProxy(env.TRUST_PROXY),
  };
}
