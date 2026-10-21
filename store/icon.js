const sharp = require('sharp');

// Pumping icon. Three options are drawn for docs/design/icon-options.png
// (`node icon.js options`); the chosen one is written to ../assets (`node icon.js`).
//   bag    - a milk storage pouch: tear notches, zip line, write-on stripe, milk, gusset
//   bottle - a pump collection bottle: flat ridged screw cap, straight sides, oz marks
//   tape   - the same pouch with a strip of masking tape and two marker strokes
// Chosen: bag. See docs/design/NOTES.md for why.
const CHOSEN = 'bag';

const CREAM = '#FAF3E8';
const CLAY = '#A8503A';
const CLAY_DARK = '#8E412E';
const MILK = '#FFFDF6';
const MILK_LINE = '#E8D3AE';
const INK = '#33241D';
const TAPE = '#E8D9B8';

const bg = (fill) =>
  fill === 'clay'
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B85C44"/><stop offset="1" stop-color="${CLAY_DARK}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`
    : `<rect width="1024" height="1024" fill="${CREAM}"/>`;

// The storage pouch, drawn on the same 100x142 grid as src/ui/BagDrawing.tsx
// and scaled up: a flat pouch, widest at the top, tapering to a small
// gusset; a heat-sealed strip with two tear notches cut into the outline,
// the zip line under it, the white write-on stripe, milk below, a soft fold.
// No lid, no rim, no shoulders. The notches are cut deep so the pouch still
// reads as a bag, not a cup, at 60 px.
const leftAt = (y) => 5 + ((y - 3) * 4) / 123;
const rightAt = (y) => 95 - ((y - 3) * 4) / 123;
// Outline, clockwise, with a V-shaped tear notch cut into each side at y = 9.
const NOTCH_Y = 9;
const NOTCH_H = 4;
const NOTCH_D = 7;
const POUCH = [
  'M5 3 H95',
  `L${rightAt(NOTCH_Y - NOTCH_H)} ${NOTCH_Y - NOTCH_H}`,
  `L${rightAt(NOTCH_Y) - NOTCH_D} ${NOTCH_Y}`,
  `L${rightAt(NOTCH_Y + NOTCH_H)} ${NOTCH_Y + NOTCH_H}`,
  // soft plastic: the sides bow out a touch instead of running ruler-straight like a cup
  'Q97 70 91 131 Q90.6 137 86 137 H14 Q9.4 137 9 131 Q3 70',
  `${leftAt(NOTCH_Y + NOTCH_H)} ${NOTCH_Y + NOTCH_H}`,
  `L${leftAt(NOTCH_Y) + NOTCH_D} ${NOTCH_Y}`,
  `L${leftAt(NOTCH_Y - NOTCH_H)} ${NOTCH_Y - NOTCH_H}`,
  'Z',
].join(' ');
const pouch = ({ stripe = true, milkY = 84 } = {}) => `
    <defs><clipPath id="p"><path d="${POUCH}"/></clipPath></defs>
    <path d="${POUCH}" fill="#F3E6D3"/>
    <g clip-path="url(#p)">
      <rect x="0" y="${milkY}" width="100" height="60" fill="${MILK}"/>
      <rect x="0" y="${milkY - 0.6}" width="100" height="2" fill="${MILK_LINE}"/>
    </g>
    <path d="${POUCH}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="${leftAt(15)}" y1="15" x2="${rightAt(15)}" y2="15" stroke="${INK}" stroke-width="1.8"/>
    <line x1="${leftAt(20)}" y1="20.5" x2="${rightAt(20)}" y2="20.5" stroke="${CLAY}" stroke-width="3"/>
    <path d="M10 129 Q50 121 90 129" stroke="${INK}" stroke-width="1.3" fill="none" opacity="0.55"/>
    ${[84, 96, 108, 120].map((y, i) => `<line x1="${(i % 2 ? 84 : 80)}" y1="${y}" x2="89" y2="${y}" stroke="${CLAY}" stroke-width="1.8" stroke-linecap="round"/>`).join('')}
    <path d="M68 74 C 73 92, 63 108, 69 127" stroke="${INK}" stroke-width="1.1" fill="none" opacity="0.3"/>
    ${stripe ? `<rect x="17" y="27" width="66" height="40" rx="1.5" fill="#FFFFFF" stroke="${INK}" stroke-width="1"/>
    <path d="M23 39 Q32 36 46 38.5" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <path d="M23 54 Q36 51 66 54" stroke="${CLAY}" stroke-width="3.6" fill="none" stroke-linecap="round"/>` : ''}`;
// 100x142 grid to 1024: scaled 5.2 and centered, leaning a little.
const POUCH_AT = 'translate(512 520) rotate(-10) translate(-260 -384) scale(5.2)';

const art = {
  bag: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${bg('clay')}
    <g transform="${POUCH_AT}">${pouch()}</g>
  </svg>`,
  // A pump collection bottle: wide mouth, straight sides, a flat screw cap with ridges, oz marks.
  bottle: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${bg('clay')}
    <defs><clipPath id="b"><path d="M368 352 H656 Q694 352 696 392 L696 820 Q696 888 628 888 H396 Q328 888 328 820 L328 392 Q330 352 368 352 Z"/></clipPath></defs>
    <rect x="372" y="300" width="280" height="60" fill="#F0E2CE"/>
    <path d="M368 352 H656 Q694 352 696 392 L696 820 Q696 888 628 888 H396 Q328 888 328 820 L328 392 Q330 352 368 352 Z" fill="#F0E2CE"/>
    <g clip-path="url(#b)"><rect x="300" y="580" width="420" height="380" fill="${MILK}"/><rect x="300" y="576" width="420" height="12" fill="${MILK_LINE}"/></g>
    <rect x="340" y="150" width="344" height="160" rx="16" fill="${CREAM}"/>
    ${Array.from({ length: 11 }, (_, i) => `<rect x="${372 + i * 28}" y="176" width="7" height="108" rx="3.5" fill="${CLAY}" opacity="0.45"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i % 2 ? 586 : 546}" y="${450 + i * 64}" width="${i % 2 ? 70 : 110}" height="16" rx="8" fill="${CLAY}"/>`).join('')}
  </svg>`,
  tape: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${bg('clay')}
    <g transform="${POUCH_AT}">${pouch({ stripe: false })}
      <g transform="rotate(-6 50 46)">
        <path d="M6 37 L10 35.5 L7.5 40 L10.5 43 L7.5 46 L10 50 L6 51.5 L94 51.5 L90 50 L92.5 46 L89.5 43 L92.5 40 L90 35.5 L94 37 Z" fill="${TAPE}"/>
        <path d="M18 45 Q28 41 40 44" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M52 45 Q63 41 78 44" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
    </g>
  </svg>`,
};

async function writeChosen() {
  const full = Buffer.from(art[CHOSEN]());
  // App Store icon: no transparency.
  await sharp(full).flatten({ background: CREAM }).resize(1024, 1024).png().toFile('../assets/icon.png');
  await sharp(full).resize(1024, 1024).png().toFile('../assets/android-icon-foreground.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CREAM } }).png().toFile('../assets/android-icon-background.png');
  await sharp(full).resize(1024, 1024).grayscale().png().toFile('../assets/android-icon-monochrome.png');
  await sharp(full).resize(48, 48).png().toFile('../assets/favicon.png');
  await sharp(full).resize(512, 512).png().toFile('../assets/splash-icon.png');
  console.log('icons written:', CHOSEN);
}

/** Each option big, then at 60x60 as it would sit on a home screen, on light and dark wallpaper. */
async function writeOptions() {
  const names = Object.keys(art);
  const W = 1500;
  const H = 820;
  const tiles = [];
  for (const [i, n] of names.entries()) {
    const big = await sharp(Buffer.from(art[n]())).resize(380, 380).png().toBuffer();
    const mask = Buffer.from('<svg width="380" height="380"><rect width="380" height="380" rx="86" fill="#fff"/></svg>');
    const bigRounded = await sharp(big).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const small = await sharp(Buffer.from(art[n]())).resize(60, 60).png().toBuffer();
    const smallMask = Buffer.from('<svg width="60" height="60"><rect width="60" height="60" rx="13.5" fill="#fff"/></svg>');
    const smallRounded = await sharp(small).composite([{ input: smallMask, blend: 'dest-in' }]).png().toBuffer();
    const x = 60 + i * 480;
    tiles.push({ input: bigRounded, left: x, top: 90 });
    tiles.push({ input: smallRounded, left: x + 70, top: 560 });
    tiles.push({ input: smallRounded, left: x + 250, top: 560 });
  }
  const labels = names
    .map((n, i) => {
      const x = 60 + i * 480 + 190;
      const pick = n === CHOSEN ? ' (picked)' : '';
      return `<text x="${x}" y="56" font-family="Georgia" font-size="34" text-anchor="middle" fill="${INK}">${i + 1}. ${n}${pick}</text>
        <text x="${x - 90}" y="660" font-family="Helvetica" font-size="20" text-anchor="middle" fill="#6F5B4F">60 px, light</text>
        <text x="${x + 90}" y="660" font-family="Helvetica" font-size="20" text-anchor="middle" fill="#A39580">60 px, dark</text>`;
    })
    .join('');
  const base = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${CREAM}"/>
    ${names.map((_, i) => `<rect x="${60 + i * 480 + 210}" y="520" width="140" height="160" fill="#111"/>`).join('')}
    ${labels}
    <text x="${W / 2}" y="770" font-family="Helvetica" font-size="22" text-anchor="middle" fill="#6F5B4F">Pumping app icon options. The 60 px tiles are the real home screen size.</text>
  </svg>`);
  // move the dark-wallpaper tiles onto the black patches
  await sharp(base).composite(tiles).png().toFile('../docs/design/icon-options.png');
  console.log('options written');
}

(process.argv[2] === 'options' ? writeOptions() : writeChosen()).catch((e) => {
  console.error(e);
  process.exit(1);
});
