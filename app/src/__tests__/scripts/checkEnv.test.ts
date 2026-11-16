import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const SCRIPT = path.join(ROOT, 'scripts/check-env.sh');

// The names the check requires are the ones config.ts asks for, so the "good" file is built from the same source.
const REQUIRED = [
  ...readFileSync(path.join(ROOT, 'app/src/lib/config.ts'), 'utf8').matchAll(
    /required\('(EXPO_PUBLIC_[A-Z0-9_]+)'/g,
  ),
].map((match) => match[1]!);

const SECRET = 'sekret-value-do-not-print';
const goodLines = () => REQUIRED.map((name) => `${name}=${SECRET}`);

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'check-env-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function check(lines: string[], eol = '\n') {
  const file = path.join(dir, '.env');
  writeFileSync(file, lines.join(eol) + eol);
  const run = spawnSync('bash', [SCRIPT, file], { encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

// Names config.ts reads but does not insist on. Adding a name to config.ts means deciding here whether it is required
// (use required('…') in config.ts) or optional (list it below), so the check can never silently miss one.
const OPTIONAL = ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_APP_ID'];
const READ = [
  ...new Set(
    [
      ...readFileSync(path.join(ROOT, 'app/src/lib/config.ts'), 'utf8').matchAll(
        /process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g,
      ),
    ]
      .map((match) => match[1]!)
      // The explanatory comment in config.ts mentions EXPO_PUBLIC_X.
      .filter((name) => name !== 'EXPO_PUBLIC_X'),
  ),
];

describe('scripts/check-env.sh', () => {
  it('reads the required names from config.ts', () => {
    expect(REQUIRED).toEqual(expect.arrayContaining(['EXPO_PUBLIC_RELAY_URL']));
  });

  it('knows about every EXPO_PUBLIC name config.ts reads, as required or optional', () => {
    const known = new Set([...REQUIRED, ...OPTIONAL]);

    expect(READ.filter((name) => !known.has(name))).toEqual([]);
  });

  it('accepts spaces around "="', () => {
    const lines = goodLines().map((line) => line.replace('=', ' = '));

    expect(check(lines).status).toBe(0);
  });

  it('passes a well-formed file, ignoring comments, blank lines, "export" and Windows line endings', () => {
    const lines = [
      '# relay',
      '',
      `export ${goodLines()[0]}`,
      ...goodLines().slice(1),
      '   # indented comment',
    ];

    expect(check(lines).status).toBe(0);
    expect(check(lines, '\r\n').status).toBe(0);
  });

  it('catches a stray character before a name, and says which name it looks like', () => {
    const lines = goodLines().map((line, index) => (index === 0 ? `:${line}` : line));

    const { status, out } = check(lines);

    expect(status).toBe(1);
    expect(out).toContain(`':${REQUIRED[0]}' is not a valid variable name`);
    expect(out).toContain(`looks like a typo of ${REQUIRED[0]}`);
    expect(out).toContain(`${REQUIRED[0]} is missing`);
  });

  it('reports a required name that is missing or empty', () => {
    const lines = [`${REQUIRED[0]}=`, ...goodLines().slice(2)];

    const { status, out } = check(lines);

    expect(status).toBe(1);
    expect(out).toContain(`${REQUIRED[0]} is missing or has no value`);
    expect(out).toContain(`${REQUIRED[1]} is missing or has no value`);
  });

  it('flags a line that is not NAME=value without printing it', () => {
    const { status, out } = check([...goodLines(), 'topsecretwordwithnoequals']);

    expect(status).toBe(1);
    expect(out).toContain('not NAME=value');
    expect(out).not.toContain('topsecretwordwithnoequals');
  });

  it('never prints a value', () => {
    const lines = goodLines().map((line, index) => (index === 0 ? `:${line}` : line));

    expect(check(lines).out).not.toContain(SECRET);
    expect(check(goodLines()).out).not.toContain(SECRET);
  });

  it('exits 2 when there is no file to check', () => {
    const run = spawnSync('bash', [SCRIPT, path.join(dir, 'nope.env')], { encoding: 'utf8' });

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('No env file');
  });
});
