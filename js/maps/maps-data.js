'use strict';

  // ---------- maps ----------
  // Prices, in points. Points come from your runs and are SPENT when you buy something.
  // The original map is free and always yours.
  const FOREST_PRICE = 10000;
  const ROCKY_PRICE = 20000;
  const CITY_PRICE = 35000;
  const DAWN_PRICE = 60000;
  const LAVA_PRICE = 85000;
  const GLACIER_PRICE = 100000;
  const TESLA_PRICE = 120000;
  const OCEAN_PRICE = 130000;
  const LIGHTHOUSE_PRICE = 150000;

  // Mix two #rrggbb colours; t is the share of a.
  const mixHex = (a, b, t) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return 'rgb(' + pa.map((v, i) => Math.round(v * t + pb[i] * (1 - t))).join(',') + ')';
  };
  const fmtNum = (n) => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const mulberry32 = (a) => () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const MAPS = [
    {
      id: 'classic', name: 'Classic', price: 0, style: null,
      blurb: 'The original pink blocks.',
      theme: { ink: '#2431D6', deep: '#141A7A', hill: 'rgba(20,26,122,0.32)', pshadow: 'rgba(20,26,122,0.7)', scrim: 'rgba(20,26,122,0.62)' }
    },
    {
      id: 'forest', name: 'Forest', price: FOREST_PRICE, style: 'forest',
      blurb: 'Pine and oak trees.',
      theme: {
        ink: '#1C6B57', deep: '#0C3A30', hill: 'rgba(8,50,40,0.34)', pshadow: 'rgba(8,40,32,0.7)', scrim: 'rgba(8,52,42,0.62)',
        leaf: '#5CCB6E', leafShade: '#2E9A54', leafLight: '#B4F58F', trunk: '#9A6238', trunkShade: '#6A4024'
      }
    },
    {
      id: 'rocky', name: 'Rocky', price: ROCKY_PRICE, style: 'rocky',
      blurb: 'Jagged boulders.',
      theme: {
        ink: '#553F8E', deep: '#2A1D52', hill: 'rgba(28,16,64,0.34)', pshadow: 'rgba(24,14,54,0.7)', scrim: 'rgba(38,24,78,0.62)',
        rock: '#A89A8E', rockShade: '#77695F', rockLight: '#D8CCBF', crack: '#4A3F39'
      }
    },
    {
      id: 'city', name: 'N-City', price: CITY_PRICE, style: 'city',
      blurb: 'Skyscrapers under city lights.',
      theme: {
        ink: '#12143A', deep: '#08091C', hill: 'rgba(40,110,150,0.26)', pshadow: 'rgba(8,9,25,0.74)', scrim: 'rgba(11,12,32,0.64)',
        skyFar: 'rgba(35,32,90,0.85)', winFar: 'rgba(255,201,102,0.55)',
        body: '#333A66', bodyShade: '#20244A', bodyLight: '#4E5890',
        windowLit: '#FFC966', windowCool: '#9FE8FF', antenna: '#C9CFE6', antennaLight: '#FF5C5C'
      }
    },
    {
      id: 'dawn', name: 'The 7AM', price: DAWN_PRICE, style: 'dawn',
      blurb: 'Steam pipes at first light.',
      theme: {
        ink: '#5B4A52', deep: '#2E2229', hill: 'rgba(255,158,102,0.24)', pshadow: 'rgba(15,10,13,0.72)', scrim: 'rgba(24,17,22,0.64)',
        pipe: '#B5714A', pipeShade: '#7A4A2E', pipeLight: '#D99B6E',
        flange: '#4A4640', rivet: '#D8D2C4', steam: '#FFF7EB'
      }
    },
    {
      id: 'lava', name: 'Magma', price: LAVA_PRICE, style: 'lava',
      blurb: 'Molten blocks under ash skies.',
      theme: {
        ink: '#2A1310', deep: '#120807', hill: 'rgba(255,96,32,0.15)', pshadow: 'rgba(10,4,3,0.75)', scrim: 'rgba(24,9,7,0.66)',
        crust: '#7A4030', crustShade: '#4A2119', crustLight: '#A65A40',
        lava: '#FF6A1F', lavaHot: '#FFC83D',
        mountFar: 'rgba(16,7,6,0.72)', craterGlow: 'rgba(255,128,48,0.85)', ember: '#FF9A4D'
      }
    },
    {
      id: 'glacier', name: 'Glaciers', price: GLACIER_PRICE, style: 'ice',
      blurb: 'Ice spires in drifting snow.',
      theme: {
        ink: '#4F7EAC', deep: '#16304F', hill: 'rgba(255,255,255,0.16)', pshadow: 'rgba(12,30,54,0.62)', scrim: 'rgba(16,38,66,0.66)',
        ice: '#D9F1FF', iceShade: '#8FCBEE', iceLight: '#FFFFFF', iceEdge: '#1F4E7C',
        snow: '#FFFFFF', peakLight: 'rgba(255,255,255,0.26)', peakShade: 'rgba(214,234,250,0.13)'
      }
    },
    {
      id: 'tesla', name: 'Tesla', price: TESLA_PRICE, style: 'coil',
      blurb: 'Crackling coils and lightning.',
      theme: {
        ink: '#0A0E2C', deep: '#04061A', hill: 'rgba(100,120,255,0.19)', pshadow: 'rgba(2,3,14,0.78)', scrim: 'rgba(6,8,32,0.68)',
        coilBody: '#4D5AA8', coilLight: '#A9B6F2', coilShade: '#1D2558', coilMetal: '#3A4690',
        chrome: '#E4EAFF', chromeShade: '#8B96CF', copper: '#E8A04A',
        arc: '#7DF9FF', arcCore: '#F2FDFF', violet: '#B48CFF'
      }
    },
    {
      id: 'ocean', name: 'Ocean', price: OCEAN_PRICE, style: 'ocean',
      blurb: 'Kelp forests and coral in the deep blue.',
      theme: {
        ink: '#0B4A6B', deep: '#052537', hill: 'rgba(8,58,80,0.34)', pshadow: 'rgba(4,26,38,0.7)', scrim: 'rgba(7,46,64,0.62)',
        weed: '#2FA27A', weedShade: '#1B6B52', weedLight: '#8CE9C0', stem: '#1F5B46',
        coralPalette: [
          { base: '#FF6F91', shade: '#C94A6C', light: '#FFC2D4' },
          { base: '#FF9F45', shade: '#D97328', light: '#FFD9A8' },
          { base: '#9B87FF', shade: '#6B57D6', light: '#D6CCFF' },
          { base: '#4FD3C4', shade: '#2B9C8F', light: '#B4F3EA' }
        ],
        polyp: '#FFF6DE', bubble: 'rgba(216,248,255,0.9)', ray: 'rgba(190,240,255,0.09)', sandFar: 'rgba(18,80,96,0.3)'
      }
    },
    {
      id: 'lighthouse', name: 'LitHom', price: LIGHTHOUSE_PRICE, style: 'lighthouse',
      blurb: 'Beacons sweeping a moonlit coast.',
      theme: {
        ink: '#0A1B33', deep: '#040B18', hill: 'rgba(110,145,195,0.14)', pshadow: 'rgba(4,10,20,0.72)', scrim: 'rgba(10,27,51,0.62)',
        tower: '#E8E1CE', towerShade: '#9C9480', towerLight: '#FFFBF0', band: '#262A34',
        rail: '#3A3F4A', glass: '#FFD27A', glassCore: '#FFF3C4', roof: '#3E4756', roofShade: '#242A33',
        beam: '#FFE9A8', beamCore: '#FFF7DD', star: '#EAF2FF', mist: '#B9C9DE', islandFar: 'rgba(6,14,26,0.6)'
      }
    }
  ];
  for (const m of MAPS) m.theme.shadowSolid = mixHex(m.theme.deep, m.theme.ink, 0.55);
  const UNLOCKABLES = [];   // everything you can buy with points: maps and sprites
  for (const m of MAPS) { m.kind = 'map'; UNLOCKABLES.push(m); }

  const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
