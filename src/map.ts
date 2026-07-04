import '@/lib/vendor/leaflet';
import { newIcons } from '@/icons';
import {
  claims,
  load_map_init,
  maplocs,
  neighbors,
  resources,
  terrs,
  type MapLocEntry,
  type TerrLocation,
} from '@/load_map';
import { randomColorHSL } from '@/utils';

const map_url_base = location.href.split('#')[0];
const map_url_tag = location.hash.slice(1);

let map: L.Map;
let marker: L.Marker | undefined;
const guilds: string[] = [];
const guildTags = new Map<string, string>();
const guildColors = new Map<string, string>();

const terrObjs: L.Polygon[] = [];
const claimObjs: L.Polygon[] = [];
const routeObjs: L.Polyline[] = [];
const resourceObjs: L.ImageOverlay[] = [];
const locationObjs: L.Marker[] = [];

let drawterrs = false;
let drawclaims = false;
let drawroutes = false;
let drawresources = false;
let drawlocations = false;

const bounds: [L.LatLngTuple, L.LatLngTuple] = [
  [0, 0],
  [6484, 4090],
];

let map_elem: HTMLElement;
let lat: number;
let lng: number;
let terrdata: [string, { guild: string; location?: TerrLocation }][] | undefined;

function init_map(): void {
  map_elem = document.getElementById('mapdiv')!;
  const coordx_elem = document.getElementById('coord-x')!;
  const coordz_elem = document.getElementById('coord-z')!;

  map = L.map('mapdiv', {
    crs: L.CRS.Simple,
    minZoom: -4,
    maxZoom: 2,
    zoomControl: false,
    zoom: 1,
  }).setView([0, 0], 1);
  L.imageOverlay('../media/maps/world-map.png', bounds).addTo(map);

  map.fitBounds(bounds);

  L.control.zoom({
    position: 'topleft',
  }).addTo(map);

  if (map_url_tag) {
    const coords = map_url_tag.split(',');
    const x = parseFloat(coords[0]);
    const y = parseFloat(coords[1]);
    if (parseFloat(coords[0]) && parseFloat(coords[1])) {
      const latlng = xytolatlng(x, y);
      placeMarker(latlng[0], latlng[1]);
    }
  }

  map.addEventListener('mousemove', function (ev) {
    lat = Math.round(ev.latlng.lat);
    lng = Math.round(ev.latlng.lng);
    const coords = latlngtoxy(lat, lng);
    coordx_elem.textContent = String(coords[0]);
    coordz_elem.textContent = String(coords[1]);
  });

  map.on('contextmenu', function (ev) {
    if (ev.originalEvent.which == 3) {
      lat = Math.round(ev.latlng.lat);
      lng = Math.round(ev.latlng.lng);
      console.log([lat, lng]);
      placeMarker(lat, lng);
    }
  });
  map_elem.style.background = '#121516';

  window.addEventListener('wynnb-map-data-updated', () => {
    void refreshData();
  });

  try {
    void refreshData();
    pullguilds();
  } catch (error) {
    console.log(error);
    const header = document.getElementById('header')!;
    const warning = document.createElement('p');
    warning.classList.add('center');
    warning.style.color = 'red';
    warning.textContent = '';
    header.append(warning);
  }
  wireMapEvents();

  console.log('Territory locations:', terrs);
  console.log('Claims:', claims);
  console.log('Territory Neighbors:', neighbors);
  console.log('Territory Resources', resources);
  console.log('List of guilds on the map:', guilds);
  console.log('Guilds and their guild tags:', guildTags);
  console.log('Map locations:', maplocs);
}

/** Wire static HTML controls on the map page (replaces inline onclick). */
function wireMapEvents(): void {
  document.getElementById('territories-button')?.addEventListener('click', () => {
    toggleButton('territories-button');
    toggleTerritories();
  });
  document.getElementById('claims-button')?.addEventListener('click', () => {
    toggleButton('claims-button');
    toggleClaims();
  });
  document.getElementById('routes-button')?.addEventListener('click', () => {
    toggleButton('routes-button');
    toggleRoutes();
  });
  document.getElementById('resources-button')?.addEventListener('click', () => {
    toggleButton('resources-button');
    toggleResources();
  });
  document.getElementById('locations-button')?.addEventListener('click', () => {
    toggleButton('locations-button');
    toggleLocations();
  });
  document.getElementById('pull-button')?.addEventListener('click', () => {
    void refreshData();
  });
}

function placeMarker(lat: number, lng: number): void {
  const coords = latlngtoxy(lat, lng);
  if (marker) {
    map.removeLayer(marker);
  }

  marker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: '../media/icons/' + (newIcons ? 'new/' : 'old/') + 'marker.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      shadowUrl: '../media/icons/' + (newIcons ? 'new/' : 'old/') + 'shadow.png',
      shadowSize: [1, 1],
      shadowAnchor: [16, 32],
      className: 'marker',
    }),
  });

  const mcdx = document.getElementById('marker-coord-x')!;
  mcdx.textContent = String(coords[0]);
  mcdx.style.display = 'grid-item-7';
  const mcdi = document.getElementById('marker-coord-img')!;
  mcdi.style.display = 'grid-item-8';
  const mcdz = document.getElementById('marker-coord-z')!;
  mcdz.textContent = String(coords[1]);
  mcdz.style.display = 'grid-item-9';
  location.hash = coords[0] + ',' + coords[1];
  marker.addTo(map);
}

function xytolatlng(x: number, y: number): L.LatLngTuple {
  return [-y - 123, x + 2392];
}

function latlngtoxy(lat: number, lng: number): [number, number] {
  return [lng - 2392, -lat - 123];
}

function toggleButton(elemID: string): void {
  const elem = document.getElementById(elemID)!;
  if (elem.classList.contains('toggleOn')) {
    elem.classList.remove('toggleOn');
    elem.textContent = elem.textContent!.replace('Hide', 'Show');
  } else {
    elem.classList.add('toggleOn');
    elem.textContent = elem.textContent!.replace('Show', 'Hide');
  }
}

async function refreshData(): Promise<void> {
  claims.clear();
  terrdata = undefined;
  guilds.length = 0;

  const url = 'https://api.wynncraft.com/public_api.php?action=territoryList';
  fetch(url)
    .then((data) => {
      return data.json();
    })
    .then((res) => {
      terrdata = Object.entries(res['territories'] as Record<string, { guild: string }>);
      guilds.length = 0;
      for (const terr of terrdata) {
        claims.set(terr[0], terr[1].guild);
        if (!guilds.includes(terr[1].guild)) {
          guilds.push(terr[1].guild);
        }
      }
      console.log('terrdata \n', terrdata);
      console.log('claims \n', claims);
      console.log('guilds \n', guilds);
      pullguilds();
      console.log('Succesfully pulled and loaded territory data.');
      console.log('Succesfully saved territory data.');
    })
    .catch((error) => {
      console.log(error);
      console.log('Something went wrong pulling and loading territory data. Attempting to load from file...');
    });
}

function pullguilds(): void {
  const guild_url_base = 'https://api.wynncraft.com/public_api.php?action=guildStats&command=';
  for (const guild of guilds) {
    fetch(guild_url_base + guild.replace(/ /g, '%20'))
      .then((data) => {
        return data.json();
      })
      .then((res: { prefix: string }) => {
        guildTags.set(guild, res.prefix);
        guildColors.set(guild, randomColorHSL([0, 1], [0, 1], [0.4, 1]));
      })
      .catch((error) => {
        console.log(error);
        console.log('Something went wrong pulling guild data for ' + guild + '.');
      });
  }
}

function toggleLocations(): void {
  const key_elem = document.getElementById('locationlist')!;

  function drawLocations(): void {
    const imgs = [
      'Content_Dungeon.png',
      'Content_CorruptedDungeon.png',
      'Content_Quest.png',
      'Merchant_Emerald.png',
      'NPC_Blacksmith.png',
      'NPC_ItemIdentifier.png',
      'NPC_PowderMaster.png',
      'Merchant_Potion.png',
      'Merchant_Armour.png',
      'Merchant_Weapon.png',
      'Merchant_Liquid.png',
      'Merchant_Other.png',
      'Merchant_Scroll.png',
      'Merchant_Accessory.png',
      'Merchant_Tool.png',
      'painting.png',
      'Profession_Weaponsmithing.png',
      'Profession_Armouring.png',
      'Profession_Alchemism.png',
      'Profession_Jeweling.png',
      'Profession_Tailoring.png',
      'Profession_Scribing.png',
      'Profession_Cooking.png',
      'Profession_Woodworking.png',
      'Content_Miniquest.png',
      'Special_RootsOfCorruption.png',
      'Special_FastTravel.png',
      'Special_LightRealm.png',
      'Special_Rune.png',
      'Content_UltimateDiscovery.png',
      'Merchant_KeyForge.png',
      'NPC_GuildMaster.png',
      'Content_GrindSpot.png',
      'Content_Cave.png',
      'NPC_TradeMarket.png',
      'Content_BossAltar.png',
      'Content_Raid.png',
      'Merchant_Dungeon.png',
      'tnt.png',
      'Merchant_Seasail.png',
      'Merchant_Horse.png',
    ];

    for (const loc of maplocs) {
      if (loc.icon) {
        const latlng = xytolatlng(loc.x as number, loc.z as number);

        const locObj = L.marker(latlng, {
          icon: L.icon({
            iconUrl: '/media/icons/locations/' + loc.icon,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            shadowUrl: '/media/icons/' + (newIcons ? 'new/' : 'old/') + 'shadow.png',
            shadowSize: [1, 1],
            shadowAnchor: [12, 12],
            className: 'marker',
          }),
        });
        locObj.addTo(map);

        locationObjs.push(locObj);
      }
    }

    document.getElementById('locations-key')!.style.display = '';
    for (const img of imgs) {
      const li = document.createElement('li');

      const i = document.createElement('img');
      i.src = '../media/icons/locations/' + img;
      i.style.maxWidth = '32px';
      i.style.maxHeight = '32px';
      li.appendChild(i);

      let name = img.replace('.png', '');
      let type = '';
      if (name.includes('_')) {
        type = name.split('_')[0];
        name = name.split('_')[1];
      }
      name = name.replace(/([A-Z])/g, ' $1').trim() + (type ? ' (' + type + ') ' : '');
      li.innerHTML = li.innerHTML + name;

      key_elem.appendChild(li);
    }
    console.log('Drew all map locations');
  }

  function deleteLocations(): void {
    for (const location of locationObjs) {
      map.removeLayer(location);
    }
    locationObjs.length = 0;
    key_elem.innerHTML = '';
    document.getElementById('locations-key')!.style.display = 'none';
    console.log('Erased all map locations');
  }

  drawlocations = !drawlocations;
  if (drawlocations) {
    drawLocations();
  } else {
    deleteLocations();
  }
}

function toggleTerritories(): void {
  function drawTerritories(): void {
    for (const [terr, terrbounds] of terrs) {
      const coords: L.LatLngTuple[] = [
        xytolatlng(terrbounds.startX, terrbounds.startY),
        xytolatlng(terrbounds.startX, terrbounds.endY),
        xytolatlng(terrbounds.endX, terrbounds.endY),
        xytolatlng(terrbounds.endX, terrbounds.startY),
      ];
      const terrObj = L.polygon(coords, { color: '#f6c328' })
        .on('mouseover', function () {
          displayTerritoryStats(terr);
        })
        .on('mouseoff', function () {
          eraseTerritoryStats();
        })
        .addTo(map);
      terrObj.bindTooltip(`<p class = 'labelp' style = "color:#f6c328">${terr}</p>`, {
        sticky: true,
        className: 'labelp',
        interactive: false,
        permanent: true,
        direction: 'center',
      });
      terrObjs.push(terrObj);
    }
    console.log('Drew all territories');
  }
  function deleteTerritories(): void {
    for (const terr of terrObjs) {
      map.removeLayer(terr);
    }
    terrObjs.length = 0;
    console.log('Erased all territories');
  }

  drawterrs = !drawterrs;

  if (drawterrs) {
    drawTerritories();
  } else {
    deleteTerritories();
  }
}

function toggleClaims(): void {
  if (drawterrs) {
    toggleTerritories();
    toggleButton('territories-button');
  }
  const guildkey = document.getElementById('guild-key')!;
  const guildkeylist = document.getElementById('guildkeylist')!;

  function drawClaims(): void {
    for (const [terr, terrbounds] of terrs) {
      const guild = claims.get(terr)!;
      const coords: L.LatLngTuple[] = [
        xytolatlng(terrbounds.startX, terrbounds.startY),
        xytolatlng(terrbounds.startX, terrbounds.endY),
        xytolatlng(terrbounds.endX, terrbounds.endY),
        xytolatlng(terrbounds.endX, terrbounds.startY),
      ];
      const claimObj = L.polygon(coords, { color: `${guildColors.get(guild)}` })
        .on('mouseover', function () {
          displayTerritoryStats(terr);
        })
        .on('mouseoff', function () {
          eraseTerritoryStats();
        })
        .addTo(map);
      claimObj.bindTooltip(
        `<p class = 'labelp' style = "color:${guildColors.get(guild)}"><b>${terr}</b><br><b>${guildTags.get(guild)}</b></p>`,
        { sticky: true, className: 'labelp', interactive: false, permanent: true, direction: 'center' },
      );

      claimObjs.push(claimObj);
    }
    guildkey.style.display = '';
    for (const guild of guilds) {
      const guildLI = document.createElement('li');
      guildLI.style.color = guildColors.get(guild)!;
      guildLI.textContent = guildTags.get(guild) + ' | ' + guild;
      guildkeylist.appendChild(guildLI);
    }
    console.log('Drew all claims');
  }
  function deleteClaims(): void {
    for (const claim of claimObjs) {
      map.removeLayer(claim);
    }
    claimObjs.length = 0;
    guildkeylist.innerHTML = '';
    guildkey.style.display = 'none';
    console.log('Erased all claims');
  }

  drawclaims = !drawclaims;
  if (drawclaims) {
    drawClaims();
  } else {
    deleteClaims();
  }
}

function toggleRoutes(): void {
  function drawRoutes(): void {
    const drawnRoutes: [string, string][] = [];
    for (const [terr, terrbounds] of terrs) {
      for (const neighbor of neighbors.get(terr)!) {
        if (!drawnRoutes.includes([neighbor, terr])) {
          const neighborBounds = terrs.get(neighbor)!;
          const coords: L.LatLngTuple[] = [
            xytolatlng((terrbounds.startX + terrbounds.endX) / 2, (terrbounds.startY + terrbounds.endY) / 2),
            xytolatlng(
              (neighborBounds.startX + neighborBounds.endX) / 2,
              (neighborBounds.startY + neighborBounds.endY) / 2,
            ),
          ];
          const routeObj = L.polyline(coords, { color: '#990000' }).addTo(map);
          drawnRoutes.push([terr, neighbor]);
          routeObjs.push(routeObj);
        }
      }
    }
    console.log('Drew all territories');
  }
  function deleteRoutes(): void {
    for (const route of routeObjs) {
      map.removeLayer(route);
    }
    routeObjs.length = 0;
    console.log('Erased all routes');
  }

  drawroutes = !drawroutes;
  if (!drawterrs && !drawclaims && drawroutes) {
    toggleTerritories();
    toggleButton('territories-button');
  } else if (drawterrs && drawclaims && drawroutes) {
    toggleClaims();
    toggleButton('claims-button');
  }

  if (drawroutes) {
    drawRoutes();
  } else {
    deleteRoutes();
  }
}

function toggleResources(): void {
  const resourcekeyelem = document.getElementById('resources-key')!;

  function drawResources(): void {
    for (const terr of terrs.keys()) {
      const terr_resource_stats = resources.get(terr)!;
      let terr_resources = terr_resource_stats.resources.slice();
      const terr_storage = terr_resource_stats.storage.slice();
      if (terr_resource_stats.doubleresource) {
        const temp: string[] = [];
        for (const resource of terr_resources) {
          temp.push(resource);
          temp.push(resource);
        }
        terr_resources = temp.slice();
      }
      if (terr_resource_stats.emeralds) {
        terr_resources.push('Emeralds');
        if (terr_resource_stats.doubleemeralds) {
          terr_resources.push('Emeralds');
        }
      }

      let terrBounds: [[number, number], [number, number]] = [
        [terrs.get(terr)!.startX, terrs.get(terr)!.startY],
        [terrs.get(terr)!.endX, terrs.get(terr)!.endY],
      ];
      if (terrBounds[0][0] > terrBounds[1][0]) {
        const temp = terrBounds[1][0];
        terrBounds[1][0] = terrBounds[0][0];
        terrBounds[0][0] = temp;
      }
      if (terrBounds[0][1] < terrBounds[1][1]) {
        const temp = terrBounds[1][1];
        terrBounds[1][1] = terrBounds[0][1];
        terrBounds[0][1] = temp;
      }
      const TRcorner = terrBounds[1];
      const DRcorner: [number, number] = [terrBounds[1][0], terrBounds[0][1]];
      const gap = 3;

      for (const n in terr_resources) {
        const resource = terr_resources[n];

        let imgBounds: [[number, number], [number, number]] = [
          [TRcorner[0] - 16 * Number(n) - 20 - gap * Number(n), TRcorner[1] + 4],
          [TRcorner[0] - 16 * Number(n) - 4 - gap * Number(n), TRcorner[1] + 20],
        ];
        imgBounds = [xytolatlng(imgBounds[0][0], imgBounds[0][1]), xytolatlng(imgBounds[1][0], imgBounds[1][1])] as [
          [number, number],
          [number, number],
        ];

        const resourceObj = L.imageOverlay(
          '../media/icons/' + (newIcons ? 'new/' : 'old/') + resource + '.png',
          imgBounds,
          { className: `${resource} resourceimg` },
        ).addTo(map);
        resourceObjs.push(resourceObj);
      }
      const gearObj = L.imageOverlay(
        '../media/icons/' + (newIcons ? 'new/' : 'old/') + 'Gears.png',
        [
          xytolatlng(
            TRcorner[0] - 16 * terr_resources.length - 20 - gap * terr_resources.length,
            TRcorner[1] + 4,
          ),
          xytolatlng(
            TRcorner[0] - 16 * terr_resources.length - 4 - gap * terr_resources.length,
            TRcorner[1] + 20,
          ),
        ],
        { className: 'Ore resourceimg' },
      ).addTo(map);
      resourceObjs.push(gearObj);

      for (const n in terr_storage) {
        const storage = terr_storage[n];

        let imgBounds: [[number, number], [number, number]] = [
          [DRcorner[0] - 16 * Number(n) - 20 - gap * Number(n), DRcorner[1] - 20],
          [DRcorner[0] - 16 * Number(n) - 4 - gap * Number(n), DRcorner[1] - 4],
        ];
        imgBounds = [xytolatlng(imgBounds[0][0], imgBounds[0][1]), xytolatlng(imgBounds[1][0], imgBounds[1][1])] as [
          [number, number],
          [number, number],
        ];

        const resourceObj = L.imageOverlay(
          '../media/icons/' + (newIcons ? 'new/' : 'old/') + storage + '.png',
          imgBounds,
          { alt: `${storage}`, className: `${storage} resourceimg` },
        ).addTo(map);
        resourceObjs.push(resourceObj);
      }
      const chestObj = L.imageOverlay(
        '../media/icons/' + (newIcons ? 'new/' : 'old/') + 'Chest.png',
        [
          xytolatlng(
            DRcorner[0] - 16 * terr_storage.length - 20 - gap * terr_storage.length,
            DRcorner[1] - 20,
          ),
          xytolatlng(
            DRcorner[0] - 16 * terr_storage.length - 4 - gap * terr_storage.length,
            DRcorner[1] - 4,
          ),
        ],
        { className: 'Wood resourceimg' },
      ).addTo(map);
      resourceObjs.push(chestObj);
    }

    resourcekeyelem.style.display = '';
    console.log('Drew all resources');
  }
  function deleteResources(): void {
    for (const resourceObj of resourceObjs) {
      console.log(resourceObj);
      map.removeLayer(resourceObj);
    }
    resourceObjs.length = 0;
    resourcekeyelem.style.display = 'none';
    console.log('Erased all resources');
  }

  drawresources = !drawresources;
  if (!drawterrs && !drawclaims && drawresources) {
    toggleTerritories();
    toggleButton('territories-button');
  } else if (drawterrs && drawclaims && drawresources) {
    toggleClaims();
    toggleButton('claims-button');
  }

  if (drawresources) {
    drawResources();
  } else {
    deleteResources();
  }
}

function displayTerritoryStats(terr: string): void {
  const terr_stats_elem = document.getElementById('territory-stats')!;
  terr_stats_elem.innerHTML = '';

  const terr_resource_stats = resources.get(terr)!;
  const terr_resources = terr_resource_stats.resources.slice();
  const terr_storage = terr_resource_stats.storage.slice();
  const doubleemeralds = terr_resource_stats.doubleemeralds;
  const emeralds = terr_resource_stats.emeralds;
  const doubleresource = terr_resource_stats.doubleresource;

  if (drawterrs || drawclaims || drawresources) {
    const stats_title = document.createElement('p');
    stats_title.classList.add('smalltitle');
    stats_title.style.maxWidth = '95%';
    stats_title.style.wordBreak = 'break-word';
    stats_title.textContent = terr;
    terr_stats_elem.appendChild(stats_title);

    const terrBounds = terrs.get(terr)!;
    let p = document.createElement('p');
    p.classList.add('left');
    p.textContent =
      '(' + terrBounds.startX + ', ' + terrBounds.startY + ') \u279C (' + terrBounds.endX + ', ' + terrBounds.endY + ')';
    terr_stats_elem.appendChild(p);

    p = document.createElement('p');
    p.classList.add('left');
    p.textContent = claims.get(terr) + ' (' + guildTags.get(claims.get(terr)!) + ')';
    terr_stats_elem.appendChild(p);

    const neighbors_elem = document.createElement('p');
    neighbors_elem.classList.add('left');
    neighbors_elem.style.maxWidth = '95%';
    neighbors_elem.style.wordBreak = 'break-word';
    neighbors_elem.textContent = 'Neighbors: ';
    for (const neighbor of neighbors.get(terr)!) {
      neighbors_elem.textContent += neighbor + ', ';
    }
    neighbors_elem.textContent = neighbors_elem.textContent.slice(0, -2);
    terr_stats_elem.appendChild(neighbors_elem);

    const produce_elem = document.createElement('p');
    produce_elem.classList.add('left');
    produce_elem.style.maxWidth = '95%';
    produce_elem.style.wordBreak = 'break-word';
    produce_elem.textContent = 'Produces: ';
    for (const resource of terr_resources) {
      produce_elem.textContent += resource + (doubleresource ? ' x2' : '') + ', ';
    }
    if (emeralds) {
      produce_elem.textContent += 'Emeralds' + (doubleemeralds ? ' x2' : '') + ', ';
    }
    produce_elem.textContent = produce_elem.textContent.slice(0, -2);
    terr_stats_elem.appendChild(produce_elem);

    const storage_elem = document.createElement('p');
    storage_elem.classList.add('left');
    storage_elem.style.maxWidth = '95%';
    storage_elem.style.wordBreak = 'break-word';
    storage_elem.textContent = 'Stores: ';
    for (const resource of terr_storage) {
      storage_elem.textContent += resource + ', ';
    }
    storage_elem.textContent = storage_elem.textContent.slice(0, -2);
    terr_stats_elem.appendChild(storage_elem);
  }
}

function eraseTerritoryStats(): void {
  const terr_stats_elem = document.getElementById('territory-stats')!;
  terr_stats_elem.innerHTML = '';
}

export async function initMapPage(): Promise<void> {
  await load_map_init(init_map);
}
