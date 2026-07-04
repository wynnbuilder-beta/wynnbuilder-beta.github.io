const page = location.pathname.split('/').pop()?.replace(/\.html$/, '') ?? '';
const routes: Record<string, string> = {
  '': 'builder',
  index: 'builder',
  crafter: 'crafter',
  map: 'map',
  customizer: 'custom',
};
const target = routes[page] ?? 'builder';
location.replace(`${location.protocol}//${location.host}/${target}/${location.hash}`);
