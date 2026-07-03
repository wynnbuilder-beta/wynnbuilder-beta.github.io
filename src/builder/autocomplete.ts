import autoComplete from '@tarekraafat/autocomplete.js';

function autocomplete_msg(equipment_type: string) {
  return (list: HTMLElement, _data: { results: unknown[] }) => {
    const position = document.getElementById(equipment_type + '-dropdown')!.getBoundingClientRect();
    list.style.top = position.bottom + window.scrollY + 'px';
    list.style.left = position.x + 'px';
    list.style.width = position.width + 'px';
    list.style.maxHeight = position.height * 2 + 'px';

    if (!_data.results.length) {
      const message = document.createElement('li');
      message.classList.add('scaled-font');
      message.textContent = 'No results found!';
      list.prepend(message);
    }
  };
}

export function create_autocomplete<T extends { tier: string }>(
  data: string[],
  data_map: Map<string, T>,
  item_type: string,
  translator: (v: string) => string,
) {
  return new autoComplete({
    data: {
      src: data,
    },
    selector: '#' + item_type + '-choice',
    wrapper: false,
    resultsList: {
      maxResults: 1000,
      tabSelect: true,
      noResults: true,
      class: 'search-box dark-7 rounded-bottom px-2 fw-bold dark-shadow-sm',
      element: autocomplete_msg(item_type),
    },
    resultItem: {
      class: 'scaled-font search-item',
      selected: 'dark-5',
      element: (item: HTMLElement, result: { value: string }) => {
        const val = translator(result.value);
        item.classList.add(data_map.get(val)!.tier);
      },
    },
    events: {
      input: {
        selection: (event: { detail: { selection: { value: string } }; target: HTMLInputElement }) => {
          if (event.detail.selection.value) {
            event.target.value = translator(event.detail.selection.value);
          }
          event.target.dispatchEvent(new Event('change'));
        },
      },
    },
  });
}
