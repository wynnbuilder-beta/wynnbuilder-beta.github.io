const pdfs = new Map<string, [string, string, string, string]>([
  [
    'Wynncraft Damage Calculation',
    [
      'Mechanics',
      'Damage_calculation',
      'hppeng, ferricles, et al.',
      "A complete guide to Wynncraft's damage calculations. Includes formulas, tested game values, and worked examples.",
    ],
  ],
  [
    'Crafted Weapon Powder Mechanics',
    [
      'Mechanics',
      'Crafted_Weapon_Powder_Mechanics',
      'ferricles',
      'A short guide to the mechanics of powder application on crafted weapons. Includes formulas and a worked example.',
    ],
  ],
  [
    'Spell Costs',
    [
      'Mechanics',
      'Spell_Costs',
      'Bart MC, ferricles',
      'A documentation of spell costs and the mechanics of spell cost reduction.',
    ],
  ],
]);

const changelog = new Map<string, string[]>([
  [
    'Build Version 6 (20 May 2022)',
    [
      ' + Added Tomes',
      ' + Changed Build encode and decode schemes to account for tomes',
    ],
  ],
  [
    'WynnBuilder^2 (12 May 2022)',
    [' + Switched most of Wynnbuilder over to Bootstrap', ' - Old UI'],
  ],
]);

const sections = ['Changelog', 'Mechanics', 'History'];

function initSections(): void {
  const main = document.getElementById('main')!;
  for (const sec of sections) {
    const div = document.createElement('div');
    div.classList.add('row', 'my-2');
    div.id = sec;

    const secspan = document.createElement('span');
    secspan.classList.add('row', 'up', 'clickable');
    div.appendChild(secspan);
    const title = document.createElement('div');
    title.classList.add('col-10', 'item-title', 'text-start');
    title.style.margin = '0 0 0';
    title.textContent = 'Section: ' + sec;
    const indicator = document.createElement('div');
    indicator.classList.add('col-auto', 'fw-bold', 'box-title');
    indicator.textContent = 'V';
    secspan.appendChild(title);
    secspan.appendChild(indicator);

    const section = document.createElement('section');
    section.classList.add('toggle-section');
    section.id = sec + '-section';
    section.style.display = 'none';
    div.appendChild(section);
    main.appendChild(div);

    secspan.addEventListener('click', function () {
      if (secspan.classList.contains('up')) {
        secspan.classList.remove('up');
        secspan.classList.add('down');
        indicator.style.transform = 'rotate(180deg)';
        section.style.display = '';
      } else {
        secspan.classList.remove('down');
        secspan.classList.add('up');
        indicator.style.transform = 'rotate(0deg)';
        section.style.display = 'none';
      }
    });
  }
}

function init(): void {
  initSections();

  for (const [title, pdf] of pdfs) {
    const sec = document.getElementById(pdf[0] + '-section');
    if (sec) {
      const pre = document.createElement('pre');
      const firstline = document.createElement('div');
      firstline.style.display = 'flex';
      firstline.style.justifyContent = 'space-between';

      const titleElem = document.createElement('p');
      titleElem.textContent = title;

      const a = document.createElement('a');
      a.href = './pdfs/' + pdf[1] + '.pdf';
      a.target = '_blank';
      a.textContent = pdf[1] + '.pdf';
      a.classList.add('link');
      a.style.display = 'flex-end';

      const secondline = document.createElement('div');
      secondline.style.display = 'flex';
      const ul = document.createElement('ul');
      ul.style.wordBreak = 'break-word';
      let li = document.createElement('li');
      if (pdf[2]) {
        li.textContent = 'Author(s): ' + pdf[2];
      } else {
        li.textContent = 'Author(s): Unknown';
      }
      ul.appendChild(li);
      li = document.createElement('li');
      const div = document.createElement('div');
      if (pdf[3]) {
        div.textContent = 'Description: ' + pdf[3];
      } else {
        div.textContent = 'Description: None';
      }
      li.appendChild(div);
      ul.appendChild(li);
      pre.appendChild(firstline);
      firstline.appendChild(titleElem);
      firstline.appendChild(a);
      pre.appendChild(secondline);
      secondline.appendChild(ul);

      sec.appendChild(document.createElement('br'));
      sec.appendChild(pre);
    } else {
      console.log('Invalid paper type for ' + title + ': ' + pdf[0]);
    }
  }

  const sec = document.getElementById('Changelog-section')!;
  for (const [version, changes] of changelog) {
    const pre = document.createElement('pre');
    const firstline = document.createElement('div');
    firstline.style.display = 'flex';
    firstline.style.justifyContent = 'space-between';

    const titleElem = document.createElement('p');
    titleElem.textContent = 'Version ' + version;

    pre.appendChild(firstline);
    firstline.appendChild(titleElem);
    sec.appendChild(document.createElement('br'));
    sec.appendChild(pre);

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    for (const change of changes) {
      const li = document.createElement('li');
      li.textContent = change;
      if (change.substring(0, 3) === ' + ') {
        li.classList.add('positive');
      } else if (change.substring(0, 3) === ' - ') {
        li.classList.add('negative');
      }
      ul.appendChild(li);
    }

    pre.appendChild(ul);
  }
}

init();
