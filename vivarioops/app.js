// app.js — boot. Registers screens, mounts the stack, wires the tab bar.
// No game logic lives here.

import * as nav from './trunk/nav.js';
import { t } from './trunk/i18n.js';
import { VERSION } from './trunk/version.js';

// Tank and Forage are gone: one Vivarium, which breeds AND feeds. See
// ui/screens/vivarium.js for what the merge kept from each.
import vivarium from './ui/screens/vivarium.js';
import atlas from './ui/screens/atlas.js';
import world from './ui/screens/world.js';
import settings from './ui/screens/settings.js';
import dev from './ui/screens/dev.js';

nav.register('vivarium', vivarium);
nav.register('atlas', atlas);
nav.register('world', world);
nav.register('settings', settings);
nav.register('dev', dev);

const TAB_LABEL = { vivarium: t('Vivarium'), atlas: t('Atlas'), world: t('World'), settings: t('Settings') };

const bar = document.getElementById('tabbar');
const buttons = {};
for (const id of nav.tabs()) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = TAB_LABEL[id];
  // A tab button is a tab switch, never a stack reset — each tab keeps its own
  // position, so returning to a tab returns you to where you were in it.
  b.addEventListener('click', () => nav.goTab(id));
  bar.append(b);
  buttons[id] = b;
}

const titleEl = document.querySelector('#topbar .title');
const appEl = document.getElementById('app');
nav.onChange(({ tab, screen, modal }) => {
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

nav.start(document.getElementById('app'));

// The stack is mounted, so the boot watchdog in index.html can stand down. If
// this line is never reached — a module that would not resolve, a throw above,
// a stall — the fault panel says so instead of leaving a black screen (H1b).
window.__boot?.ok();
