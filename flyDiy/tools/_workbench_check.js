#!/usr/bin/env node
// GATE WORKBENCH (A0, 15 Nov 2026): the workbench stays true. The user: "a central, aptly named place to store and
// procedures available, maybe even as skills ... reinvention of the wheel [is] chopping too much of our productive time".
//   1. every tool path in flyDiy/tools/workbench/WORKBENCH.md exists (a row saying "coming" is skipped until it lands);
//   2. every .claude/skills/workbench-*/SKILL.md has frontmatter whose name is its folder and a description;
//   3. every flyDiy/... path a skill names exists.
// Node only, well under a second. Usage: node flyDiy/tools/_workbench_check.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const bad = [];
const PATH_RE = /flyDiy\/[A-Za-z0-9_./-]+\.(js|md|sh|json|py)\b/g;
const exists = p => fs.existsSync(path.join(ROOT, p));

const wb = path.join(ROOT, 'flyDiy/tools/workbench/WORKBENCH.md');
let rows = 0;
if (!fs.existsSync(wb)) bad.push('flyDiy/tools/workbench/WORKBENCH.md is missing');
else for (const line of fs.readFileSync(wb, 'utf8').split(/\r?\n/)) {
  if (!line.startsWith('|') || /^\|\s*(Job|---)/.test(line)) continue;
  rows++;
  if (/coming/i.test(line)) continue;
  for (const p of new Set(line.match(PATH_RE) || [])) if (!exists(p)) bad.push('WORKBENCH.md names ' + p + ', which does not exist');
}

const sk = path.join(ROOT, '.claude/skills');
let skills = 0;
if (fs.existsSync(sk)) for (const d of fs.readdirSync(sk).filter(d => d.startsWith('workbench-'))) {
  const f = path.join(sk, d, 'SKILL.md');
  if (!fs.existsSync(f)) { bad.push('.claude/skills/' + d + ' has no SKILL.md'); continue; }
  skills++;
  const t = fs.readFileSync(f, 'utf8');
  const fm = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) { bad.push(d + '/SKILL.md has no frontmatter'); continue; }
  const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1], desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1];
  if ((name || '').trim() !== d) bad.push(d + '/SKILL.md: name "' + name + '" is not its folder');
  if (!desc || desc.trim().length < 40) bad.push(d + '/SKILL.md: the description is missing or too short to trigger');
  for (const p of new Set(t.match(PATH_RE) || [])) if (!exists(p)) bad.push(d + '/SKILL.md names ' + p + ', which does not exist');
}
if (!skills) bad.push('no .claude/skills/workbench-* skill found');

console.log('  ' + rows + ' workbench row(s), ' + skills + ' skill(s)');
for (const b of bad) console.log('  FAIL ' + b);
console.log('GATE WORKBENCH: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
