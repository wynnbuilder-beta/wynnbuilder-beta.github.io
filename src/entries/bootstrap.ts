/** Shared globals used by every app page. Styles load via <link> in each HTML entry. */
import '@/icons';
import { wireSidebarEvents } from '@/lib/sidebar/events';
import '@/redirect_fork';
import '@/utils';
import '@/build_utils';
import '@/loader';
import '@/load_item';
import '@/load_ing';
import '@/powders';
import '@/skillpoints';
import '@/damage_calc';

wireSidebarEvents();
