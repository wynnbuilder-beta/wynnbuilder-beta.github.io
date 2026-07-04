function toggleSection(section: HTMLElement): void {
  const down = section.classList.contains('down');
  const arrow_elem = section.getElementsByClassName('arrow')[0] as HTMLElement;

  if (down) {
    section.classList.remove('down');
    section.classList.add('up');
    arrow_elem.style.transform = 'rotate(180deg)';

    for (const elem of section.children) {
      if (!elem.classList.contains('section-title')) {
        (elem as HTMLElement).style.display = '';
      }
    }
  } else {
    section.classList.remove('up');
    section.classList.add('down');
    arrow_elem.style.transform = 'rotate(0deg)';
    for (const elem of section.children) {
      if (!elem.classList.contains('section-title')) {
        (elem as HTMLElement).style.display = 'none';
      }
    }
  }
}

export function initDevPage(): void {
  const sections = document.getElementsByClassName('section');

  for (const section of sections) {
    const sectionElem = section as HTMLElement;
    sectionElem.classList.add('down');

    const title_row = document.createElement('div');
    title_row.classList.add('row', 'section-title');
    const title = document.createElement('div');
    title.classList.add('col');
    title.textContent = sectionElem.title ? sectionElem.title : '';
    title_row.appendChild(title);
    sectionElem.insertBefore(title_row, sectionElem.firstChild);

    const toggle_char = document.createElement('div');
    toggle_char.classList.add('col-auto', 'arrow');
    toggle_char.textContent = 'V';
    title_row.appendChild(toggle_char);
    title_row.addEventListener(
      'click',
      () => {
        toggleSection(sectionElem);
      },
      false,
    );

    for (const child of sectionElem.children) {
      if (!child.classList.contains('section-title')) {
        (child as HTMLElement).style.display = 'none';
      }
    }
  }
}
