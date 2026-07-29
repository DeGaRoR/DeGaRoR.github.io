import { t } from '../../trunk/i18n.js';
import { push } from '../../trunk/nav.js';
import { VERSION } from '../../trunk/version.js';
import * as store from '../../trunk/store.js';
import { row, section, button } from '../widgets.js';

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

    const s3 = section(t('Developer'));
    s3.append(button(t('Open developer screen'), () => push('dev')));

    wrap.append(s1, s2, s3);
    el.append(wrap);
  },
};
