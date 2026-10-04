// mock_rows.js - MOBILE-GARAGE (G1512) mock-up data: the WING part's real rows (tools/_cage_wing.js:136-175, the same keys,
// labels, ranges and steps) written in the proposed descriptor - the new fields (unit, group, tier, help, detents, fine)
// are what the revamp would add to the tuple; the values are the stock Cub's (builds/cub_2026-09-20_corrected.json).
'use strict';
window.MOCK_P = { wingOn: 1, wgPos: 0, wgSpan: 10.7, wgChord: 1.60, wgChordTip: 1.60, wgTip: 1, wgTipX: 0, wgDihedral: 1.0,
  wgIncidence: 1.5, wgWashout: 0, wgCamber: 4, wgThick: 12, wgFlapType: 1, wgCrankAt: 0, wgBrace: 1 };
window.MOCK_ROWS = [
  // TRUNK: fitted / type / position / size - SLIDER-TRUNK-2026-09-03's four headings open every part
  { key: 'wingOn', label: 'wing fitted', lo: 0, hi: 1, step: 1, group: 'fitted' },
  { key: 'wgPos', label: 'wing position', lo: 0, hi: 3, step: 1, names: ['high', 'mid', 'low', 'parasol'], group: 'type' },
  { key: 'wgBrace', label: 'bracing', lo: 0, hi: 2, step: 1, names: ['cantilever', 'struts', 'wires'], group: 'type' },
  { key: 'wgSpan', label: 'span', lo: 6.5, hi: 18, step: 0.1, unit: 'm', group: 'size', fine: 0.01,
    detents: [{ v: 10.7, label: 'Cub (stock)' }], help: 'Tip to tip. Longer: slower stall, more roll inertia; past 14 m the sailplane classes.' },
  { key: 'wgChord', label: 'root chord', lo: 0.80, hi: 2.10, step: 0.05, unit: 'm', group: 'size',
    help: 'Front to back at the fuselage.' },
  { key: 'wgChordTip', label: 'tip chord', lo: 0.55, hi: 2.10, step: 0.05, unit: 'm', group: 'size',
    help: 'Equal to the root: a plank wing (the Cub). Smaller: taper.' },
  { key: 'wgTip', label: 'tips', lo: 0, hi: 3, step: 1, names: ['square', 'rounded', 'Hoerner', 'raked'], group: 'size' },
  // MORE: the shape's second circle - behind "more rows" on a phone, open on a desktop
  { key: 'wgDihedral', label: 'dihedral', lo: 0, hi: 6, step: 0.5, unit: '°', group: 'shape', tier: 'more' },
  { key: 'wgTipX', label: 'tip aft', lo: -1.5, hi: 2.5, step: 0.05, unit: 'm', group: 'shape', tier: 'more' },
  { key: 'wgWashout', label: 'washout', lo: 0, hi: 4, step: 0.1, unit: '°', group: 'shape', tier: 'more' },
  { key: 'wgFlapType', label: 'flaps', lo: 0, hi: 3, step: 1, names: ['none', 'plain', 'slotted', 'fowler'], group: 'shape', tier: 'more' },
  // EXPERT: the aerofoil - hidden on a phone unless asked
  { key: 'wgIncidence', label: 'incidence', lo: -1, hi: 4, step: 0.1, unit: '°', group: 'aerofoil', tier: 'expert' },
  { key: 'wgCamber', label: 'camber', lo: 0, hi: 6, step: 1, unit: '%', group: 'aerofoil', tier: 'expert' },
  { key: 'wgThick', label: 'thickness', lo: 9, hi: 18, step: 1, unit: '%', group: 'aerofoil', tier: 'expert' },
];
// a side view of a high-wing taildragger, standing in for the editor's scene (the cloud has no GPU for a real still)
window.MOCK_PLANE = (w, h, sel) => {
  const s = Math.min(w / 420, h / 260), ox = w / 2 - 210 * s, oy = h / 2 - 120 * s;
  const T = (x, y) => (ox + x * s).toFixed(1) + ',' + (oy + y * s).toFixed(1);
  const wingC = sel === 'wing' ? '#e6dbc9' : '#8b8173', wingO = sel === 'wing' ? 1 : 0.9;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="fl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2b2620"/><stop offset="1" stop-color="#16130f"/></linearGradient></defs>
  <rect x="0" y="${(oy + 205 * s).toFixed(1)}" width="${w}" height="${h}" fill="url(#fl)"/>
  <ellipse cx="${(ox + 200 * s).toFixed(1)}" cy="${(oy + 212 * s).toFixed(1)}" rx="${170 * s}" ry="${9 * s}" fill="rgba(0,0,0,.45)"/>
  <polygon points="${T(60, 110)} ${T(110, 92)} ${T(300, 98)} ${T(395, 118)} ${T(392, 128)} ${T(300, 140)} ${T(110, 150)} ${T(58, 140)}" fill="#c9a43a" stroke="#000" stroke-opacity=".35"/>
  <polygon points="${T(120, 96)} ${T(150, 70)} ${T(215, 72)} ${T(240, 98)}" fill="#7fa3b8" fill-opacity=".55" stroke="#000" stroke-opacity=".35"/>
  <polygon points="${T(95, 66)} ${T(285, 66)} ${T(285, 74)} ${T(95, 76)}" fill="${wingC}" fill-opacity="${wingO}" stroke="${sel === 'wing' ? '#fff' : '#000'}" stroke-opacity=".6" stroke-width="${sel === 'wing' ? 2 : 1}"/>
  <line x1="${(ox + 160 * s).toFixed(1)}" y1="${(oy + 74 * s).toFixed(1)}" x2="${(ox + 130 * s).toFixed(1)}" y2="${(oy + 140 * s).toFixed(1)}" stroke="#5a544b" stroke-width="${2 * s}"/>
  <polygon points="${T(360, 116)} ${T(392, 70)} ${T(410, 70)} ${T(402, 118)}" fill="#c9a43a" stroke="#000" stroke-opacity=".35"/>
  <polygon points="${T(330, 122)} ${T(408, 118)} ${T(410, 126)} ${T(332, 128)}" fill="#b08f33"/>
  <rect x="${(ox + 40 * s).toFixed(1)}" y="${(oy + 104 * s).toFixed(1)}" width="${22 * s}" height="${42 * s}" rx="${4 * s}" fill="#3b3631"/>
  <line x1="${(ox + 36 * s).toFixed(1)}" y1="${(oy + 82 * s).toFixed(1)}" x2="${(ox + 36 * s).toFixed(1)}" y2="${(oy + 168 * s).toFixed(1)}" stroke="#ddd" stroke-opacity=".35" stroke-width="${3 * s}"/>
  <line x1="${(ox + 120 * s).toFixed(1)}" y1="${(oy + 148 * s).toFixed(1)}" x2="${(ox + 105 * s).toFixed(1)}" y2="${(oy + 190 * s).toFixed(1)}" stroke="#2a2622" stroke-width="${4 * s}"/>
  <circle cx="${(ox + 105 * s).toFixed(1)}" cy="${(oy + 192 * s).toFixed(1)}" r="${15 * s}" fill="#1a1715" stroke="#555" stroke-width="${3 * s}"/>
  <circle cx="${(ox + 392 * s).toFixed(1)}" cy="${(oy + 132 * s).toFixed(1)}" r="${5 * s}" fill="#1a1715"/>
  </svg>`;
};
