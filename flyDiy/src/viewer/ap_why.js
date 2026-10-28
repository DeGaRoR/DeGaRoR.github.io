// ============================================================
// AP_WHY - WHY THE AUTOPILOT CHANGED ITS PLAN, IN PLAIN WORDS (G3560-G3569 AP-HONEST, the user's playtest of 24 Oct:
// "aborts / go-arounds with no visible reason", "silent re-routes to another runway", "every go-around / divert reason
// must be visible"). PURE: no DOM, no state - app.js (apWhyTick) feeds it the pilot's NEW verdicts each frame and shows
// what it returns in the flight's top-left column (#apWhy), the moment it happens.
//
// THE SOURCE IS THE PILOT'S OWN REPORT (43_pilot.js say(): ap.report.verdicts, { t, code, note }) - the same list the end
// card prints, inline and under the physics worker alike (sim_host.js sends the report whole when its verdict count
// moves). Nothing is re-derived here and nothing is asked of the pilot: the words are the pilot's note, rewritten for a
// player (km/h, not m/s; "too high on the approach", not "high on the slope 412 m out"), the note itself kept as `raw`.
//
//   AP_WHY.batch(verdicts, ctx) -> null | { kind, head, line, raw, t, codes }
//     verdicts  the verdicts NEW since the last call (one step's or one frame's: a refused strip says three at once -
//               strip-too-short, go-around, divert - and is ONE event, the divert)
//     ctx       { to: the route's To now ({ id, name }), from: its From } - the names the head uses
//     kind      'divert' | 'go-around' | 'abort' | 'declined' | 'gave-up' | 'energy' | 'dest' | 'route' | 'committed'
//               (the strongest of the batch, RANK order); null when the batch holds nothing a player is told at once
//   AP_WHY.plan(ctx) -> { kind: 'plan', head, line } - the hand gives the aeroplane back: what the autopilot flies now
//               (the active plan, unchanged by the toggle; G3563), so taking over and handing back is never a surprise
//   AP_WHY.SHOW  the codes that make an event (everything else stays in the end card's "What went wrong")
// ============================================================
const AP_WHY = (() => {
  'use strict';
  // the codes said at once, and the event each makes; RANK: the strongest of a batch wins the head
  const SHOW = {
    'divert': 'divert', 'go-around': 'go-around',
    'rejected-takeoff': 'abort', 'balked': 'abort', 'taxi-lost': 'abort', 'lineup-timeout': 'abort', 'taxi-timeout': 'abort',
    'takeoff-declined': 'declined', 'strip-too-short': 'declined', 'wrong-surface': 'declined',
    'gave-up': 'gave-up', 'out-of-energy': 'energy', 'capsized': 'gave-up',
    'new-destination': 'dest', 'route-left': 'route', 'route-done': 'route',
    'committed-landing': 'committed', 'committed-unstable': 'committed',
  };
  const RANK = ['divert', 'gave-up', 'energy', 'abort', 'go-around', 'declined', 'committed', 'dest', 'route'];
  const kmh = v => Math.round(+v * 3.6);
  const name = a => (a && (a.name || a.id)) || 'the strip';
  // THE GO-AROUND'S REASONS (43_pilot.js goAround(why)), every one the pilot can give, in a player's words
  const GA = [
    [/^the strip is too short for ([\d.]+) m\/s/, m => 'the strip is too short for a landing at ' + kmh(m[1]) + ' km/h'],
    [/^high on the slope/, () => 'too high on the approach'],
    [/^off the centreline by (\d+) m/, m => 'not lined up with the runway (' + m[1] + ' m to the side)'],
    [/^terrain under the approach/, () => 'the ground under the approach is too close'],
    [/^past the aim at (\d+) m/, m => 'still ' + m[1] + ' m up over the touchdown point'],
    [/^final took (\d+) s/, m => 'the final approach took too long (' + m[1] + ' s)'],
    [/^fast on the short final: ([\d.]+) m\/s for ([\d.]+)/, m => 'too fast for the short strip (' + kmh(m[1]) + ' km/h, it wants ' + kmh(m[2]) + ')'],
    [/^unstabilised approach at (\d+) m: (.*)$/, m => 'the approach was not steady at ' + m[1] + ' m: ' + steady(m[2])],
    [/^under the strip (\d+) m out/, m => 'too low, ' + m[1] + ' m short of the strip'],
    [/^floating on the short field with (\d+) m left, (\d+) m to stop/, m => 'it floated too long: ' + m[1] + ' m of strip left, ' + m[2] + ' m needed to stop'],
    [/^floating with (\d+) m left/, m => 'it floated too long: only ' + m[1] + ' m of strip left'],
    // G3330's hop (43_pilot.js ROLLOUT, the DC-3's bounce): a hop past bounceGA (2 m), or still climbing at a metre
    [/^bounced ([\d.]+) m off the touch at ([\d.]+) m\/s/, m => 'it bounced ' + m[1] + ' m back up off the touchdown (' + kmh(m[2]) + ' km/h)'],
  ];
  // the stabilised-approach gate's why (43_pilot.js FINAL: slow / fast / high / low / sinking / off the centreline / flaps)
  function steady(w) {
    let m;
    if ((m = /^slow ([\d.]+) m\/s for ([\d.]+)/.exec(w))) return 'too slow (' + kmh(m[1]) + ' km/h, it wants ' + kmh(m[2]) + ')';
    if ((m = /^fast ([\d.]+) m\/s for ([\d.]+)/.exec(w))) return 'too fast (' + kmh(m[1]) + ' km/h, it wants ' + kmh(m[2]) + ')';
    if ((m = /^(high|low) (\d+) m on the slope/.exec(w))) return m[2] + ' m too ' + m[1] + ' on the glide path';
    if ((m = /^sinking ([\d.]+) m\/s/.exec(w))) return 'sinking too fast (' + m[1] + ' m/s)';
    if ((m = /^(\d+) m off the centreline/.exec(w))) return m[1] + ' m off the runway\'s line';
    if (/^not configured/.test(w)) return 'the flaps were not down yet';
    return w;
  }
  const gaWords = note => {
    const why = String(note || '').replace(/\s*\(attempt \d+\)\s*$/, '');
    for (const [re, f] of GA) { const m = re.exec(why); if (m) return f(m); }
    return why;
  };
  // THE REJECTED TAKE-OFF'S REASONS (43_pilot.js ROLL: reject = ...)
  function abortWords(code, note) {
    const n = String(note || '');
    let m;
    if (code === 'balked') return /keeping it on the ground/.test(n) ? 'it settled back onto the wheels three times - staying on the ground'
                                                                      : 'it settled back onto the wheels - trying the take-off again';
    if (code === 'taxi-lost') return 'it could not find a way to the runway';
    if (code === 'lineup-timeout') return 'it could not line up on the runway - stopping to plan again';
    if (code === 'taxi-timeout') return 'the taxi took too long - stopping where it is';
    if ((m = /^will not reach Vr: [\d.]+ m\/s\^2 needs (\d+) m more, (\d+) m left/.exec(n))) return 'it would not reach flying speed before the end: ' + m[1] + ' m more needed, ' + m[2] + ' m left';
    if ((m = /^out of runway: (\d+) m left/.exec(n))) return 'out of runway: ' + m[1] + ' m left and not yet at flying speed';
    if (/^nose-over/.test(n)) return 'the nose was going over on the wheels';
    if (/^not accelerating/.test(n)) return 'it was not picking up speed';
    if (/^stuck on the hump/.test(n)) return 'the floats could not climb onto the step (lighter, more power or bigger floats)';
    if (/^ran off the end/.test(n)) return 'it ran out of runway still on the wheels';
    return n;
  }
  // the in-flight refusal (43_pilot.js judgeHeld: "<to>: the elevator holds V m/s ..., the short-field stop from it needs
  // N m, M m are left past the aim and the float - not landing there") and the departure's (shortOfRun: "<to> has L m of
  // strip for a R m landing run ... - not going there")
  function shortWords(note) {
    const n = String(note || '');
    let m;
    if ((m = /^(.*?): the elevator holds ([\d.]+) m\/s.*?needs (\d+) m, (\d+) m are left/.exec(n)))
      return m[1] + ' is too short today: landing at ' + kmh(m[2]) + ' km/h needs ' + m[3] + ' m to stop, only ' + m[4] + ' m are left';
    if ((m = /^(.*?) has (\d+) m of strip for a (\d+) m landing run/.exec(n)))
      return m[1] + ' is too short for this aeroplane: ' + m[2] + ' m of strip for a ' + m[3] + ' m landing run';
    return n.replace(/ - (not going there|not landing there|keeping .*)$/, '');
  }
  function batch(vs, ctx) {
    if (!vs || !vs.length) return null;
    ctx = ctx || {};
    const hit = vs.filter(v => v && SHOW[v.code]);
    if (!hit.length) return null;
    const kinds = hit.map(v => SHOW[v.code]);
    let kind = null;
    for (const k of RANK) if (kinds.includes(k)) { kind = k; break; }
    const of = c => hit.filter(v => v.code === c);
    const last = c => { const L = of(c); return L.length ? L[L.length - 1] : null; };
    const main = hit.filter(v => SHOW[v.code] === kind).pop();
    const raw = hit.map(v => v.note).join(' | ');
    let head = '', line = '';
    if (kind === 'divert') {
      const d = last('divert'), n = String(d.note || '');
      let m = /diverting to (.+?) \(/.exec(n);
      head = 'Diverting to ' + (m ? m[1] : name(ctx.to));
      const sh = last('strip-too-short');
      if (sh) line = shortWords(sh.note);
      else if ((m = /^twice round (.+?) [—-]/.exec(n))) line = 'two go-arounds at ' + m[1] + ' - it will not try a third time';
      else if ((m = /: (.*)$/.exec(n))) line = m[1];
      const ga = last('go-around');
      if (ga && !sh) line = (line ? line + '; ' : '') + 'the last approach: ' + gaWords(ga.note);
    } else if (kind === 'go-around') {
      const ga = last('go-around'), n = /\(attempt (\d+)\)/.exec(ga.note || '');
      head = 'Going around' + (ctx.to ? ' at ' + name(ctx.to) : '') + (n && +n[1] > 1 ? ' (attempt ' + n[1] + ')' : '');
      line = gaWords(ga.note);
    } else if (kind === 'abort') {
      head = main.code === 'balked' && !/keeping it on the ground/.test(main.note || '') ? 'Take-off: trying again' : 'Take-off stopped';
      line = abortWords(main.code, main.note);
    } else if (kind === 'declined') {
      head = main.code === 'wrong-surface' ? 'Not that strip' : main.code === 'takeoff-declined' ? 'Not taking off' : 'Not going there';
      line = main.code === 'strip-too-short' ? shortWords(main.note) : String(main.note || '').replace(/^not taking off from /, '');
    } else if (kind === 'gave-up') {
      head = main.code === 'capsized' ? 'Capsized' : 'The autopilot gave up';
      line = main.code === 'capsized' ? 'it is on its back' : 'the flight took far longer than planned (' + (/still in ([A-Z]+)/.exec(main.note || '') || [0, 'flying'])[1].toLowerCase() + ')';
    } else if (kind === 'energy') {
      head = /charge/.test(main.note || '') ? 'Out of charge' : 'Out of fuel';
      line = /gliding/.test(main.note || '') ? 'the engine stopped - gliding to a landing' : 'the engine stopped';
    } else if (kind === 'committed') {
      head = 'Landing anyway';
      line = /no strip in reach/.test(main.note || '') ? 'no strip within reach has the room - landing short-field here'
           : 'no go-around left - committed to this landing';
    } else if (kind === 'dest') {
      const m = /destination is now (.+?)(?: - |$)/.exec(String(main.note || ''));   // the pilot's own word for it
      head = 'New destination: ' + (m ? m[1] : name(ctx.to));
      line = /re-planning/.test(main.note || '') ? 'the arrival is planned again from here' : 'it will fly there';
    } else if (kind === 'route') {
      head = main.code === 'route-done' ? 'Drawn route flown' : 'Off the drawn route';
      line = main.code === 'route-done' ? (String(main.note || '').replace(/^the drawn route flown( - )?/, '') || 'done') : 'planning the arrival from here';
    }
    return { kind, head, line, raw, t: main.t, codes: hit.map(v => v.code) };
  }
  // the hand gives the aeroplane back (app.js setManual(false)): the plan it resumes, said
  function plan(ctx) {
    ctx = ctx || {};
    const to = ctx.to, from = ctx.from;
    const circuit = !to || (from && to.id === from.id);
    return { kind: 'plan', head: 'Autopilot on', line: circuit ? 'flying a circuit back to ' + name(to || from) : 'flying to ' + name(to) + (ctx.diverted ? ' (the diversion)' : ', as planned') };
  }
  return { batch, plan, SHOW, RANK, gaWords, steady };
})();
if (typeof window !== 'undefined') window.AP_WHY = AP_WHY;
if (typeof module !== 'undefined' && module.exports) module.exports = { AP_WHY };
