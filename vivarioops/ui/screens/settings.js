import { t } from '../../trunk/i18n.js';
import { push } from '../../trunk/nav.js';
import { VERSION } from '../../trunk/version.js';
import * as store from '../../trunk/store.js';
import { row, section, button } from '../widgets.js';
import { exportAll, importAll, backupFilename } from '../../trunk/backup.js';

// Screen 11 — cog menu (20 §9). The full ordered menu is Tier 3; the slice needs
// the version readout and a route to the developer screen. The seven-tap reveal
// is deliberately NOT implemented yet: hiding the dev screen during the slice
// would only hide it from the one person using it.

export default {
  title: t('Settings'),
  mount(el) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet';

    const s1 = section(t('Version'));
    s1.append(
      row(t('Build'), `${VERSION.app}`),
      row(t('Built'), VERSION.build),
      row(t('Commit'), VERSION.commit),
      row(t('Schema'), `genome ${VERSION.genome} · bridge ${VERSION.bridge} · ecology ${VERSION.ecology}`),
    );

    const s2 = section(t('Storage'));
    const usageRow = row(t('Used'), t('measuring...'));
    s2.append(usageRow);
    store.usage().then(u => {
      usageRow.lastChild.textContent = u
        ? `${(u.used / 1024).toFixed(1)} kB ${t('of')} ${(u.quota / 1048576).toFixed(0)} MB`
        : t('unavailable');
    }).catch(() => { usageRow.lastChild.textContent = t('unavailable'); });

    // ── BACKUP ────────────────────────────────────────────────────────────────
    //
    // The Atlas is the only irreplaceable thing in this project: an authored
    // creature can be rebuilt from source, a measurement re-run, a compiled
    // record recompiled — but a genome forty generations deep exists nowhere
    // else. Until this screen it had no copy and no way to check.
    const s3 = section(t('Backup'));
    const backupStatus = row(t('Status'), t('never exported this session'));
    s3.append(backupStatus);

    s3.append(button(t('Export everything to a file'), async () => {
      backupStatus.lastChild.textContent = t('collecting...');
      try {
        const data = await exportAll();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = backupFilename();
        a.click();
        // Revoking immediately can cancel the download in some browsers; one
        // frame is enough for the click to have been taken up.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        const bad = data.counts.unreadable;
        backupStatus.lastChild.textContent =
          `${data.counts.records} ${t('records')}${bad ? ` · ${bad} ${t('unreadable')}` : ''}`;
      } catch (e) {
        backupStatus.lastChild.textContent = `${t('export failed')}: ${e.message}`;
      }
    }));

    // A hidden file input, because a styled button is the affordance and
    // `<input type=file>` cannot be styled to match one.
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'application/json,.json';
    picker.hidden = true;
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      picker.value = '';                       // so the same file can be re-picked
      if (!file) return;
      backupStatus.lastChild.textContent = t('reading...');
      try {
        const data = JSON.parse(await file.text());
        const r = await importAll(data);       // ADD-ONLY. See trunk/backup.js.
        backupStatus.lastChild.textContent =
          `+${r.added} ${t('added')} · ${r.skipped} ${t('already present')}`
          + (r.errors.length ? ` · ${r.errors.length} ${t('failed')}` : '');
      } catch (e) {
        backupStatus.lastChild.textContent = `${t('import failed')}: ${e.message}`;
      }
    });
    s3.append(picker, button(t('Import from a file'), () => picker.click()));

    const s4 = section(t('Developer'));
    s4.append(button(t('Open developer screen'), () => push('dev')));

    wrap.append(s1, s2, s3, s4);
    el.append(wrap);
  },
};
