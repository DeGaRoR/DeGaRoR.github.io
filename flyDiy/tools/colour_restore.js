// node tools/colour_restore.js [--write] [--fields sections,glass] <plane.json ...>
//
// COLOUR-RESTORE (the user 15 Nov via A0: "auto replace with the color code that corresponded to the double color
// application"). ac0d2e1f2 (L40a) made a skin tint decode ONCE under managed colour (aeroskin.js aeroLinear); before it
// every tint went through aeroLinear decoded TWICE - darker and redder than the hex - and that is the look the user
// approved. For each such stored hex c this writes c' with decode(c') == decode(decode(c)), the nearest 8 bits a channel,
// so the skin draws as it did. The PC-6's teal was converted the same way by hand (e6e1a8d05: #1fb3c2 -> #03738a).
//
// Only the tints that reach aeroLinear move: finish.sections.<s>.tint (struts and gear legs included: they are sections),
// finish.glass.tint (--fields picks; 'paint' also moves paint.base / paint.trim, NOT used: on the planes they only feed the
// decal defaults - the letters follow the trim - so converting them darkens markings that never changed). The decals
// (finish.decals) do NOT: the decal atlas was decoded once before the fix and after it. A file whose colours were picked
// AFTER the fix must not be run through this (it would draw darker than picked): tools/colour_restore_files.json lists
// the files converted, chosen by when their colours last changed (tools/colour_restore_pick.js).
//
// --write patches the moved numbers where they stand in the text: every other byte of the file is kept (no re-serialising).
const fs = require('fs');

const s2l = x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
// one 8-bit channel: the value whose single decode is nearest the double decode of v
function ch(v) {
  const t = s2l(s2l(v / 255));
  let best = 0, be = Infinity;
  for (let c = 0; c <= 255; c++) { const e = Math.abs(s2l(c / 255) - t); if (e < be) { be = e; best = c; } }
  return best;
}
const conv = hex => ((ch((hex >> 16) & 255) << 16) | (ch((hex >> 8) & 255) << 8) | ch(hex & 255)) >>> 0;
const isHex = v => Number.isInteger(v) && v >= 0 && v <= 0xffffff;

// the spec's converted fields: [[where, old, new], ...] (the spec is changed in place)
function restore(spec, fields) {
  const moved = [], f = spec.finish || {};
  const one = (o, k, where) => {
    if (!o || !isHex(o[k])) return;
    const n = conv(o[k]);
    if (n !== o[k]) { moved.push([where, o[k], n]); o[k] = n; }
  };
  if (fields.includes('sections')) for (const s in (f.sections || {})) one(f.sections[s], 'tint', 'sections.' + s);
  if (fields.includes('glass')) one(f.glass, 'tint', 'glass');
  if (fields.includes('paint')) { one(spec.paint, 'base', 'paint.base'); one(spec.paint, 'trim', 'paint.trim'); }
  return moved;
}

// every number in the raw JSON text by its path: [[path array, start, end], ...]
function numberSpans(t) {
  const out = [], path = [];
  let i = 0;
  const ws = () => { while (i < t.length && (t[i] === ' ' || t[i] === '\n' || t[i] === '\r' || t[i] === '\t')) i++; };
  const str = () => {
    let j = i + 1;
    while (t[j] !== '"') j += t[j] === '\\' ? 2 : 1;
    const v = JSON.parse(t.slice(i, j + 1));
    i = j + 1;
    return v;
  };
  const val = () => {
    ws();
    const c = t[i];
    if (c === '{') {
      i++; ws();
      if (t[i] === '}') { i++; return; }
      for (;;) {
        ws(); const k = str(); ws(); i++;            // the key, the colon
        path.push(k); val(); path.pop(); ws();
        if (t[i] === ',') { i++; continue; }
        i++; return;                                  // the closing brace
      }
    }
    if (c === '[') {
      i++; ws();
      if (t[i] === ']') { i++; return; }
      let n = 0;
      for (;;) {
        path.push(n++); val(); path.pop(); ws();
        if (t[i] === ',') { i++; continue; }
        i++; return;
      }
    }
    if (c === '"') { str(); return; }
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(t.slice(i, i + 64));
    if (!m) throw new Error('not JSON at ' + i);
    if (m[1] !== 'true' && m[1] !== 'false' && m[1] !== 'null') out.push([path.slice(), i, i + m[1].length]);
    i += m[1].length;
  };
  val();
  return out;
}

// the moved numbers re-written where they stand; pre = the spec's path in the file (['spec'] or [])
function patchText(raw, pre, moved) {
  const pathOf = w => w === 'glass' ? ['finish', 'glass', 'tint']
    : w.startsWith('sections.') ? ['finish', 'sections', w.slice(9), 'tint'] : ['paint', w.slice(6)];
  const want = new Map(moved.map(([w, a, b]) => [JSON.stringify(pre.concat(pathOf(w))), [a, b]]));
  let out = raw, done = 0;
  for (const [p, s0, e0] of numberSpans(raw).reverse()) {
    const w = want.get(JSON.stringify(p));
    if (!w) continue;
    if (+raw.slice(s0, e0) !== w[0]) throw new Error('not the expected value at ' + p.join('.'));
    out = out.slice(0, s0) + String(w[1]) + out.slice(e0);
    done++;
  }
  if (done !== want.size) throw new Error('patched ' + done + ' of ' + want.size);
  return out;
}

module.exports = { conv, restore, patchText, numberSpans };

if (require.main === module) {
  const a = process.argv.slice(2), write = a.includes('--write');
  const fi = a.indexOf('--fields'), fields = fi >= 0 ? a[fi + 1].split(',') : ['sections', 'glass'];
  const files = a.filter((x, i) => !x.startsWith('--') && !(fi >= 0 && i === fi + 1));
  const hx = n => '#' + n.toString(16).padStart(6, '0');
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8'), j = JSON.parse(raw), spec = j.spec || j;
    if (!spec || typeof spec !== 'object' || !(spec.paint || spec.finish)) { console.log('SKIP (no paint / finish)', file); continue; }
    const m = restore(spec, fields);
    console.log(file, m.length + ' moved:', m.map(([w, a0, b]) => w + ' ' + hx(a0) + '->' + hx(b)).join(', '));
    if (write && m.length) {
      const out = patchText(raw, j.spec ? ['spec'] : [], m);
      if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(j)) throw new Error('the patched text is not the converted spec: ' + file);
      fs.writeFileSync(file, out);
    }
  }
}
