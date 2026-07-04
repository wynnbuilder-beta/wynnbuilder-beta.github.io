const window_storage = window.localStorage;

export let newIcons = true;

/** Toggle icons on the ENTIRE page. */
export function toggleIcons(): void {
  newIcons = !newIcons;
  window_storage.setItem('newicons', newIcons.toString());
  const newOrOld = newIcons ? 'new' : 'old';

  const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (favicon) {
    favicon.href = favicon.href.replace(
      'media/icons/' + (newIcons ? 'old' : 'new'),
      'media/icons/' + newOrOld,
    );
  }
  const imgs = document.getElementsByTagName('img');
  const divs = document.getElementsByClassName('item-display-new-toggleable');
  for (const img of imgs) {
    // if doesn't contain, replace() does nothing
    img.src = img.src.replace(
      'media/icons/' + (newIcons ? 'old' : 'new'),
      'media/icons/' + newOrOld,
    );
  }
  for (let i = 0; i < divs.length; i++) {
    const div = divs.item(i) as HTMLElement | null;
    if (div) {
      div.style.backgroundImage =
        "url('../media/items/" + (newIcons ? 'new' : 'old') + ".png')";
    }
  }
}

if (window_storage.getItem('newicons') === 'false') {
  toggleIcons();
}

