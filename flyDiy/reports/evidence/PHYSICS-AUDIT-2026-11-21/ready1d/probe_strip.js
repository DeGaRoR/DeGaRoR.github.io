// usage: node probe_strip.js <flyDiy dir> [profile] [to=tw_ski]
'use strict';
const fs = require('fs'), path = require('path');
const D = path.resolve(process.argv[2]), T = path.join(D, 'tools'), prof = process.argv[3] && process.argv[3] !== 'expert' ? process.argv[3] : undefined, to = process.argv[4] || 'tw_ski';
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
const SH = require(path.join(D, 'src', 'viewer', 'sim_host.js'));
let HOST = null; const mk0 = SH.makeSimHost; SH.makeSimHost = function () { const H = mk0.apply(this, arguments); HOST = H; return H; };
const TW = TR.tourWorld(C, IN, fs), W = TW.W;
const def = TR.defOf(C, PT, process.env.CARD ? path.resolve(process.env.CARD) : path.join(D, 'builds', 'cub_2026-09-20_corrected.json'));
const R = TR.flyTour(C, W, def, ['HOME', to], { game: { profile: prof, lineup: true }, roundOK: 'nv_strip', tMax: 1800, log: L => {
  const Rp = HOST && HOST.ap && HOST.ap.report;
  const o = {}; for (const k in L) { const v = L[k]; if (v == null || typeof v !== 'object') o[k] = typeof v === 'number' ? +v.toFixed(2) : v; }
  console.log(JSON.stringify(o)); console.log('faults', JSON.stringify(L.faults)); for (const k in L) if (L[k] && typeof L[k] === 'object' && k !== 'faults') console.log(k, JSON.stringify(L[k]).slice(0, 400));
  if (Rp) { console.log('appr', JSON.stringify(Rp.appr).slice(0, 500)); console.log('landing', JSON.stringify(Rp.landing)); console.log('phases', (Rp.phases || []).map(q => q.phase + '@' + Math.round(q.t)).join(' ')); console.log('verdicts', (Rp.verdicts || []).map(v => v.code + ': ' + v.note).join(' | ').slice(0, 1200)); }
} });
