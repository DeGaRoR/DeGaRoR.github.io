import { t } from '../../trunk/i18n.js';
import { placeholder } from '../placeholder.js';
// 30 §9: an empty "not yet available" tab satisfies the navigation skeleton.
// Specimens and records are stored correctly from B1; the Atlas UI is step F.
export default {
  title: t('Atlas'),
  mount: (el) => placeholder(el, t('Atlas'), t('Not yet available.')),
};
