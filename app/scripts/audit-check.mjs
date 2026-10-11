// Fails on any high or critical production advisory that isn't listed below.
// Plain `npm audit --audit-level=high` can't skip advisories that have no patched release yet.
// Review this list whenever it changes: remove an entry as soon as a fix ships.
// Note: decode-uri-component (moderate, via expo-router) is left alone on purpose. Its fixed 0.5.x
// breaks query-string 7, which expo-router depends on.
import { spawnSync } from 'node:child_process';

const ALLOWED = {
  'GHSA-vfj7-8cjw-p6xm': 'braces: no patched release yet (<=3.0.3); build tooling via Metro/jest',
  'GHSA-86w9-cpqp-85rv': 'node-forge: no patched release yet (<=1.4.0); Expo code-signing tooling',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

// npm audit exits 1 when it finds vulnerabilities, so only other outcomes are real errors.
const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (result.error) fail(`Could not run npm audit: ${result.error.message}`);
if (result.status !== 0 && result.status !== 1) {
  fail(`npm audit exited with status ${result.status}:\n${result.stderr}`);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  fail(`npm audit did not return JSON:\n${result.stdout}\n${result.stderr}`);
}
// A failed audit (registry down, bad lockfile) is valid JSON with an `error` and no results.
// Treat that as a failure instead of "no vulnerabilities".
if (report.error || typeof report.vulnerabilities !== 'object' || report.vulnerabilities === null) {
  fail(`npm audit did not produce a report:\n${JSON.stringify(report.error ?? report, null, 2)}`);
}

const blocking = new Map();
const allowed = new Set();
for (const [pkg, vuln] of Object.entries(report.vulnerabilities)) {
  for (const via of vuln.via ?? []) {
    // Strings are dependents of another package; objects are the advisories themselves.
    if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue;
    const id = String(via.url ?? via.source ?? via.title)
      .split('/')
      .pop();
    if (id in ALLOWED) allowed.add(id);
    else blocking.set(id, `${pkg} (${via.severity}): ${via.title} ${via.url ?? ''}`);
  }
}

for (const id of allowed) console.log(`allowed ${id} - ${ALLOWED[id]}`);
for (const id of Object.keys(ALLOWED)) {
  if (!allowed.has(id)) console.log(`note: ${id} is no longer reported, remove it from ALLOWED`);
}
if (blocking.size > 0) {
  console.error('\nUnallowed high/critical advisories:');
  for (const line of blocking.values()) console.error(`  ${line}`);
  process.exit(1);
}
console.log('npm audit: no unallowed high or critical advisories.');
