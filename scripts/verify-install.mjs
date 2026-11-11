#!/usr/bin/env node
// Drives an installed `iwc` like a new developer would, from an empty folder
// outside any source tree:
//
//   node scripts/verify-install.mjs [expected-version]
//
// iwc on PATH → --version/--help → create → npm install → check → test →
// dev server answers → build → production server answers → build --zip
// (uses the bundled Linux runtime) → doctor. The binary must not reference
// the machine that built it. Exits non-zero on the first failure.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const want = (process.argv[2] || '').replace(/^v/, '');
const win = process.platform === 'win32';
const steps = [];
const ok = (what, detail = '') => {
  steps.push(what);
  console.log(`✓ ${what}${detail ? `  ${detail}` : ''}`);
};
const fail = (what, detail) => {
  console.error(`✗ ${what}\n${detail}`);
  process.exit(1);
};
const sh = (cmd, argv, cwd) => {
  try {
    return execFileSync(cmd, argv, { cwd, encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
  } catch (e) {
    fail(`${cmd} ${argv.join(' ')}`, `${e.stdout || ''}${e.stderr || ''}`);
  }
};

// 1. iwc is on PATH (not run from a source checkout).
const which = sh(win ? 'where' : 'which', ['iwc']).trim().split(/\r?\n/)[0];
ok('iwc is on PATH', which);
const version = sh('iwc', ['--version']).trim();
if (!/^iwc \d+\.\d+\.\d+/.test(version) || (want && !version.startsWith(`iwc ${want} `))) fail('iwc --version', `got "${version}", want ${want || 'a release version'}`);
ok('iwc --version', version);
if (!sh('iwc', ['--help']).includes('iwc create')) fail('iwc --help', 'usage does not list iwc create');
ok('iwc --help');

// 2. The binary carries no path of the machine that built it.
let real = which;
try {
  real = fs.realpathSync(which);
} catch {}
if (!win || real.endsWith('.exe')) {
  const bin = fs.readFileSync(real).toString('latin1');
  // -trimpath release builds hold module paths only, never a home folder.
  const leak = bin.match(/(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[\w.-]+[\\/](?:Desktop|Documents|src|go[\\/]pkg)[\\/][\w./\\-]*/);
  if (leak) fail('binary is self-contained', `${real} contains the build path "${leak[0]}"`);
  ok('binary is self-contained', 'no build-machine paths');
}

// 3. A new project in an empty folder outside any repository.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'iwc-verify-'));
console.log(`  working in ${work}`);
sh('iwc', ['create', 'my-app', '--web'], work);
const app = path.join(work, 'my-app');
for (const f of ['app.iwc', 'package.json', 'ui/home.ui.iwc']) if (!fs.existsSync(path.join(app, f))) fail('iwc create', `missing ${f}`);
ok('iwc create my-app');
const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
sh('npm', ['install', '--no-audit', '--no-fund'], app);
ok('npm install', Object.keys(pkg.devDependencies || {}).join(', ') || 'no packages needed');
sh('iwc', ['check'], app);
ok('iwc check');
sh('iwc', ['test'], app);
ok('iwc test');

async function serve(argv, port, label) {
  const child = spawn('iwc', argv, { cwd: app, shell: win, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 120; i++) {
      try {
        const r = await fetch(base + '/');
        const html = await r.text();
        if (r.status !== 200 || !html.includes('Welcome to IWC')) fail(label, `GET / → ${r.status}\n${html.slice(0, 400)}`);
        const docs = await fetch(base + '/_iwc/docs/');
        if (docs.status !== 200) fail(label, `GET /_iwc/docs/ → ${docs.status}`);
        const css = html.match(/<script[^>]+src="([^"]+runtime[^"]*)"/);
        if (css) {
          const rt = await fetch(new URL(css[1], base));
          if (rt.status !== 200) fail(label, `runtime ${css[1]} → ${rt.status}`);
        }
        ok(label, `${base} serves the welcome page, runtime and /_iwc/docs`);
        return;
      } catch (e) {
        if (child.exitCode !== null) fail(label, `server exited ${child.exitCode}\n${log}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    fail(label, `no answer on ${base} after 60s\n${log}`);
  } finally {
    if (win) {
      try {
        execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
    } else child.kill('SIGTERM');
  }
}

await serve(['dev', '--port', '4317'], 4317, 'iwc dev');
sh('iwc', ['build'], app);
for (const f of ['manifest.json', 'release.json']) if (!fs.existsSync(path.join(app, 'dist', f))) fail('iwc build', `dist/${f} missing`);
ok('iwc build', 'dist/manifest.json');
await serve(['start', 'dist', '--port', '4318'], 4318, 'iwc start dist');
sh('iwc', ['build', '--zip'], app);
const zips = fs.readdirSync(path.join(app, 'dist')).concat(fs.readdirSync(app)).filter((f) => f.endsWith('.zip'));
if (!zips.length) fail('iwc build --zip', 'no zip written');
ok('iwc build --zip', `${zips[0]} (bundled Linux runtime)`);
const doctor = sh('iwc', ['doctor'], app);
const installed = doctor.match(/installed\s+(.+)/);
ok('iwc doctor', installed ? installed[1].trim() : '');

fs.rmSync(work, { recursive: true, force: true });
console.log(`\nAll ${steps.length} checks passed on ${process.platform}/${process.arch}.`);
