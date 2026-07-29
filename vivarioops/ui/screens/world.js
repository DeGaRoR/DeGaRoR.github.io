import { t } from '../../trunk/i18n.js';
import { placeholder } from '../placeholder.js';
export default {
  title: t('World'),
  mount: (el) => placeholder(el, t('World'), t('The Soup. Ecology arrives at D1.')),
};
