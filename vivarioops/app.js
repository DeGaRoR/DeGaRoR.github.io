// app.js — boot. Registers screens, mounts the stack, wires the tab bar.
// No game logic lives here.

import * as nav from './trunk/nav.js';
import { t } from './trunk/i18n.js';
import { VERSION } from './trunk/version.js';
// THE STORE BACKS ITSELF UP. Dev only — the endpoint exists on tools/serve.js and
// nowhere else, so a deployed build probes once and disables it. See
// trunk/autosave.js for why a manual export in Settings was not enough.
import { installAutosave } from './trunk/autosave.js';

// Tank and Forage are gone: one Vivarium, which breeds AND feeds. See
// ui/screens/vivarium.js for what the merge kept from each.
import vivarium from './ui/screens/vivarium.js';
import atlas from './ui/screens/atlas.js';
import specimen from './ui/screens/specimen.js';
import world from './ui/screens/world.js';
import settings from './ui/screens/settings.js';
import dev from './ui/screens/dev.js';

nav.register('vivarium', vivarium);
nav.register('atlas', atlas);
// A DESTINATION, NOT A TAB. It is pushed onto the Atlas's own stack, so browser
// back returns to the grid you came from, with its filters intact.
nav.register('specimen', specimen);
nav.register('world', world);
nav.register('settings', settings);
nav.register('dev', dev);

const TAB_LABEL = { vivarium: t('Vivarium'), atlas: t('Atlas'), world: t('World'), settings: t('Settings') };

const bar = document.getElementById('tabbar');
const buttons = {};
// `visibleTabs`, not `tabs` — World and Settings are still routes and still
// mount, they just no longer spend a quarter of the bar each on a placeholder.
// See trunk/nav.js `VISIBLE_TABS`.
for (const id of nav.visibleTabs()) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = TAB_LABEL[id];
  // A tab button is a tab switch, never a stack reset — each tab keeps its own
  // position, so returning to a tab returns you to where you were in it.
  b.addEventListener('click', () => nav.goTab(id));
  bar.append(b);
  buttons[id] = b;
}

// ── BACK, FOR ANY PUSHED SCREEN ─────────────────────────────────────────────
//
// The tab bar gets you between roots; nothing got you back OUT of a destination
// pushed onto one. Browser back and Android back both worked — `nav.pop()` is
// `history.back()` — but on a desktop browser, in a PWA, or on any phone without
// a system back gesture there was no way off the specimen page at all.
//
// IN THE TOP BAR AND NOT ON THE PAGE, so it is one control in one place for every
// destination that will ever be pushed, rather than each screen inventing its own
// corner to put an arrow in. It is driven by stack DEPTH, so it is correct
// without any screen having to declare anything.
const backBtn = document.createElement('button');
backBtn.type = 'button';
backBtn.className = 'topbar-back';
backBtn.textContent = '‹';
backBtn.setAttribute('aria-label', t('Back'));
backBtn.addEventListener('click', () => nav.pop());
backBtn.hidden = true;
document.getElementById('topbar').prepend(backBtn);

const titleEl = document.querySelector('#topbar .title');
const appEl = document.getElementById('app');
nav.onChange(({ tab, screen, modal }) => {
  backBtn.hidden = nav.stackDepth() === 0;
  for (const [id, b] of Object.entries(buttons)) {
    if (id === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  // The tank is full-bleed water; base.css hides the top bar and floats the tab
  // bar for that tab only. Other tabs keep the standard shell.
  appEl.dataset.tab = tab;
  document.title = `Vivarioops — ${TAB_LABEL[tab]}`;
  titleEl.textContent = modal || screen === tab ? TAB_LABEL[tab] : t('Vivarioops');
});

document.getElementById('build').textContent = VERSION.app;

installAutosave();

nav.start(document.getElementById('app'));

// The stack is mounted, so the boot watchdog in index.html can stand down. If
// this line is never reached — a module that would not resolve, a throw above,
// a stall — the fault panel says so instead of leaving a black screen (H1b).
window.__boot?.ok();
