// Self-contained live-gate runner.
//
// Boots ONE production server, points both live gates at it, runs them, and
// tears the server down — so the live half of the ladder is a single command
// (`npm run gates:live`) instead of a remembered "start prod on 3000, start
// dev on 3002, then run two scripts" ritual. The prod build serves the same
// interactive app, so qa:brochure (BROCHURE_QA_URL) and the interactive sweep
// (SWEEP_URL) can both target it.
//
// Usage: npm run gates:live   (or `npm run gates:all` for the whole ladder)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';

const PORT = process.env.LIVE_GATE_PORT || '3000';
const ORIGIN = `http://127.0.0.1:${PORT}`;

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', ...opts });
// Kill ONLY the listener on the port. `lsof -ti:PORT` also matches client
// sockets (this runner and Chromium hold connections to it), so an unfiltered
// kill -9 would take down the test process itself — `-sTCP:LISTEN -a` scopes
// it to the server alone.
const freePort = () => {
  // NEVER kill a server that is not ours. This used to `kill -9` whatever held
  // the port, and on a machine running more than one project that is somebody
  // else's dev server — it took down a sibling project's Next process, which
  // then looked like this app failing. Only reclaim a listener whose working
  // directory is this repo; anything else is reported, not killed.
  try {
    const pids = spawnSync('bash', ['-lc', `lsof -ti:${PORT} -a -sTCP:LISTEN`], { encoding: 'utf8' })
      .stdout.split('\n').map((pid) => pid.trim()).filter(Boolean);
    for (const pid of pids) {
      const cwd = spawnSync('bash', ['-lc', `lsof -a -p ${pid} -d cwd -Fn | sed -n 's/^n//p'`], { encoding: 'utf8' })
        .stdout.trim();
      if (cwd && cwd.startsWith(process.cwd())) {
        spawnSync('bash', ['-lc', `kill -9 ${pid} 2>/dev/null`], { stdio: 'ignore' });
      } else {
        console.error(`[live-gates] port ${PORT} is held by pid ${pid} from ${cwd || 'an unknown directory'} —`);
        console.error('[live-gates] refusing to kill another project\'s server. Free the port or set LIVE_GATE_PORT.');
        process.exit(1);
      }
    }
  } catch {}
};

// A production server needs a build. Build if one isn't present so the runner
// works standalone; `gates:all` will already have built.
//
// A build that is merely PRESENT is not enough: running `gates:live` alone after
// editing a source file used to serve the previous build, so the live gates
// reported on code nobody had written. A gate that tests stale code is worse
// than no gate. Rebuild whenever a source file is newer than the build.
const buildIsStale = () => {
  if (!existsSync('.next/BUILD_ID')) return true;
  const builtAt = statSync('.next/BUILD_ID').mtimeMs;
  const newest = (dir) => {
    let latest = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      latest = Math.max(latest, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
    }
    return latest;
  };
  return ['app', 'components', 'lib'].some((dir) => existsSync(dir) && newest(dir) > builtAt);
};

if (buildIsStale()) {
  console.log('[live-gates] build missing or older than the sources — running `npm run build` first');
  const build = run('npm', ['run', 'build']);
  if (build.status !== 0) process.exit(build.status ?? 1);
}

freePort();
console.log(`[live-gates] starting production server on ${PORT}`);
const server = spawn('npx', ['next', 'start', '-p', PORT], { detached: true, stdio: 'ignore' });

let toreDown = false;
const shutdown = () => {
  if (toreDown) return;
  toreDown = true;
  // Kill the npx wrapper, then the actual listener (next) by port. Avoid a
  // negative-pid process-group kill — if detachment is unreliable it can take
  // down this runner's own group.
  try { server.kill('SIGTERM'); } catch {}
  freePort();
};
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });
process.on('SIGTERM', () => { shutdown(); process.exit(143); });

const waitReady = async (timeoutMs = 90000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(ORIGIN, (res) => { res.resume(); resolve(res.statusCode === 200); });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

if (!(await waitReady())) {
  console.error('[live-gates] server did not become ready in time');
  shutdown();
  process.exit(1);
}
console.log('[live-gates] server ready — running live gates against', ORIGIN);

const env = { ...process.env, BROCHURE_QA_URL: ORIGIN, SWEEP_URL: ORIGIN };
const qa = run('npm', ['run', 'qa:brochure'], { env });
const sweep = run('npm', ['run', 'verify'], { env });
// The drawing the customer sees. Three defects (stacked fixtures, undrawn
// rear/right facades, a loft drawn in its own frame) all shipped past a green
// offline ladder, because the batteries check the artifact and not the picture.
// The quick set covers a compiled multi-level plan, a compiled single-level one
// and a traced one; `npm run check:visual` sweeps the whole matrix.
const visual = run('npm', ['run', 'check:visual:quick'], { env: { ...env, SWEEP_BASE: ORIGIN } });
// The stored render is produced by a DETACHED child after the API responds, so
// it is invisible to every offline battery (throwaway gen-* are deleted before
// the ladder) and to the quick sweep (`--only` skips the generated lane
// entirely). It silently never landed at all until 2026-08-17. One generated
// plan, asserted end to end, then deleted.
const backfill = run('npm', ['run', 'check:backfill'], { env: { ...env, BACKFILL_URL: ORIGIN } });

shutdown();

const failed = (qa.status ?? 1) !== 0 || (sweep.status ?? 1) !== 0
  || (visual.status ?? 1) !== 0 || (backfill.status ?? 1) !== 0;
if (failed) {
  console.error(`[live-gates] FAILED — qa:brochure exit ${qa.status}, sweep exit ${sweep.status}, `
    + `visual exit ${visual.status}, backfill exit ${backfill.status}`);
  process.exit(1);
}
console.log('[live-gates] all live gates green');
