import { t } from '../../trunk/i18n.js';
import { VERSION } from '../../trunk/version.js';
import * as store from '../../trunk/store.js';
import { makeRng } from '../../trunk/rng.js';
import { row, section, button } from '../widgets.js';
import { runContractGate } from '../../gate/contracts.js';
import { runRuntimeGate } from '../../gate/runtime.js';
import { runL1Gate } from '../../gate/l1.js';
import { BROWSER_SUITES, ALL_SUITES, MANIFEST, verdict } from '../../gate/manifest.js';

// Screen 12 — developer (20 §9). A1 scope: run gate, seed override, version readout.
// Bench, FPS and viability rate arrive with the things they measure.

const SEED_KEY = 'profile:devseed';
const PROBE_KEY = 'profile:reloadprobe';

export default {
  title: t('Developer'),
  mount(el) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet';

    // ── gate ────────────────────────────────────────────────────────────────
    const gateSec = section(t('Gate'));
    const out = document.createElement('pre');
    out.className = 'gate-out';
    out.textContent = t('Not run.');

    gateSec.append(button(t('Run gate'), async () => {
      out.textContent = t('running...');
      const suites = [runContractGate(), await runRuntimeGate(), runL1Gate()];

      // The static N-checks read the filesystem and can only run in Node, so the
      // panel shows the result the build recorded, stamped with the build it came
      // from. A stale stamp is called out rather than quietly displayed.
      let staticSuite = null;
      try {
        const r = await fetch('./gate-report.json', { cache: 'no-store' });
        if (r.ok) staticSuite = await r.json();
      } catch { /* not built yet */ }

      const lines = [];
      let pass = 0, fail = 0, pend = 0;
      for (const s of suites) {
        lines.push(`── gate/${s.name} ──`);
        for (const a of s.results) {
          lines.push(`  [${a.status.toUpperCase().slice(0, 4)}] ${a.id}  ${a.title}`);
          for (const f of a.failures) lines.push(`         >>> ${f}`);
        }
        for (const d of s.diagnostics || []) lines.push(`         diag: ${d}`);
        pass += s.passed; fail += s.failed; pend += s.pending;
      }
      if (staticSuite) {
        const stale = staticSuite.appV !== VERSION.app || staticSuite.commit !== VERSION.commit;
        lines.push(`── gate/${staticSuite.name} (from build ${staticSuite.appV}${stale ? ' — STALE' : ''}) ──`);
        for (const a of staticSuite.results) {
          lines.push(`  [${a.status.toUpperCase().slice(0, 4)}] ${a.id}  ${a.title}`);
          for (const f of a.failures) lines.push(`         >>> ${f}`);
        }
        pass += staticSuite.passed; fail += staticSuite.failed; pend += staticSuite.pending;
        if (stale) fail += 1, lines.push('         >>> static report is from a different build; run tools/build.js');
      } else {
        lines.push('── gate/trunk-static: NOT AVAILABLE (run tools/build.js) ──');
        fail += 1;
      }

      // THE PANEL IS NOT THE GATE, AND MUST NOT SAY IT IS (H4).
      //
      // It ran three suites of eight. It used to print "GATE GREEN" for that,
      // which is worse than printing nothing: a green badge that excludes motion,
      // breeding, probes and duels manufactures confidence instead of reporting
      // it. The verdict line is computed in gate/manifest.js so this screen
      // cannot invent a friendlier one, and the assertions it did NOT reach are
      // listed by name — a count would let "3 suites" read as a detail rather
      // than as the whole point.
      const ranSuites = staticSuite ? [...BROWSER_SUITES, 'trunk-static'] : [...BROWSER_SUITES];
      const v = verdict({ failed: fail, suitesRun: ranSuites });
      const unreached = ALL_SUITES.filter(x => !ranSuites.includes(x));

      lines.push('', `${pass} passed, ${fail} failed, ${pend} pending`);
      if (unreached.length) {
        lines.push(`not run here: ${unreached.map(x => `${x} (${MANIFEST[x].length})`).join(', ')}`);
      }
      lines.push(v.line);
      out.textContent = lines.join('\n');
      // 'partial' is its own state, so the panel cannot be styled green on a
      // subset. N16 keeps the colour itself in a token.
      out.dataset.state = fail > 0 ? 'fail' : (v.state === 'GREEN' ? 'pass' : 'partial');
    }));
    gateSec.append(out);

    // ── seed override ───────────────────────────────────────────────────────
    const seedSec = section(t('Seed override'));
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'field';
    input.placeholder = t('blank = derive from content');
    const sample = row(t('First draws'), '—');
    store.get(SEED_KEY).then(v => { if (v) { input.value = v; showSample(v); } }).catch(() => {});

    function showSample(v) {
      const r = makeRng(v || 'unseeded');
      sample.lastChild.textContent = [r.u32(), r.u32(), r.u32()].join(' · ');
    }
    input.addEventListener('input', () => showSample(input.value));
    seedSec.append(input, sample, button(t('Save seed'), async () => {
      await store.set(SEED_KEY, input.value);
      sample.lastChild.textContent += `  ${t('(saved)')}`;
    }));

    // ── persistence probe — the A1 checkpoint, self-serve ────────────────────
    const probeSec = section(t('Persistence'));
    const probeRow = row(t('Value across reload'), t('reading...'));
    probeSec.append(probeRow, button(t('Write a new value'), async () => {
      const v = `${Date.now()}`;
      await store.set(PROBE_KEY, v);
      probeRow.lastChild.textContent = `${v} ${t('(written — now reload)')}`;
    }));
    store.get(PROBE_KEY).then(v => {
      probeRow.lastChild.textContent = v ? `${v} ${t('(survived reload)')}` : t('none written yet');
    }).catch(e => { probeRow.lastChild.textContent = `${t('error')}: ${e.message}`; });

    const verSec = section(t('Build'));
    verSec.append(row('APP_V', VERSION.app), row(t('Commit'), VERSION.commit));

    wrap.append(gateSec, seedSec, probeSec, verSec);
    el.append(wrap);
  },
};
