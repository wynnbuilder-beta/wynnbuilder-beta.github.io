import { displayExpandedSet } from './display';
import {
  item_loader,
  load_major_id_data,
  sets,
  WYNN_VERSION_LATEST,
  wynn_version_names,
} from './load_item';
import { make_elem } from './utils';

interface SetDisplayData {
  hidden?: boolean;
  bonuses: unknown[];
}

function init_sets(): void {
  const set_parent = document.getElementById('search-results')!;
  for (const [key, value] of sets) {
    const setData = value as unknown as SetDisplayData;
    if (setData.hidden === true) {
      continue;
    }

    const box = make_elem('div', ['ing-stats', 'col-lg-3', 'p-2', 'col-sm-6'], { id: 'set' + key });

    const bckgrdbox = make_elem(
      'div',
      ['rounded', 'g-0', 'dark-7', 'border', 'border-dark', 'dark-shadow', 'p-3', 'col-auto'],
      { id: 'set' + key + 'b' },
    );
    box.append(bckgrdbox);
    set_parent.appendChild(box);

    displayExpandedSet(
      key,
      setData as Parameters<typeof displayExpandedSet>[1],
      bckgrdbox.id,
      setData.bonuses.length - 1,
    );
  }
}

void (async function () {
  await Promise.all([item_loader.load_init(), load_major_id_data(wynn_version_names[WYNN_VERSION_LATEST])]);
  init_sets();
})();
