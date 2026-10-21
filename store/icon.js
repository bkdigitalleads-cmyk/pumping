const sharp = require('sharp');

// Pumping icon. Three options are drawn for docs/design/icon-options.png
// (`node icon.js options`); the chosen one is written to ../assets (`node icon.js`).
//   bag    - a milk storage bag: clay zip top, milk to the fill line, a write-on stripe
//   bottle - a bottle with printed ounce marks, milk two thirds up
//   tape   - a storage bag with a strip of masking tape and two marker strokes
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

// A storage pouch, in a 1024 box: taller than wide, a sealed zip strip on
// top, tear notches under it, and a rounded gusset at the bottom.
const POUCH = 'M318 250 H706 L712 806 Q712 884 634 884 H390 Q312 884 312 806 Z';
const pouch = ({ stripe = true, fill = 600 } = {}) => `
    <defs><clipPath id="p"><path d="${POUCH}"/></clipPath></defs>
    <path d="${POUCH}" fill="#F3E6D3"/>
    <g clip-path="url(#p)">
      <rect x="290" y="${fill}" width="440" height="320" fill="${MILK}"/>
      <rect x="290" y="${fill - 4}" width="440" height="14" fill="${MILK_LINE}"/>
      <path d="M312 834 Q512 790 712 834" stroke="${MILK_LINE}" stroke-width="10" fill="none"/>
    </g>
    <rect x="306" y="150" width="412" height="112" rx="22" fill="${CREAM}"/>
    <rect x="306" y="196" width="412" height="10" fill="${MILK_LINE}"/>
    <path d="M312 290 L344 308 L312 326 Z" fill="${CLAY}"/>
    <path d="M712 290 L680 308 L712 326 Z" fill="${CLAY}"/>
    ${stripe ? `<rect x="368" y="350" width="288" height="170" rx="10" fill="#FFFFFF"/>
    <path d="M400 410 Q450 396 520 408" stroke="${INK}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <path d="M400 468 Q470 454 610 470" stroke="${INK}" stroke-width="20" fill="none" stroke-linecap="round"/>` : ''}`;

const art = {
  bag: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${bg('clay')}
    <g transform="translate(512 520) scale(1.16) translate(-512 -520) rotate(-7 512 540)">${pouch()}</g>
  </svg>`,
  bottle: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${bg('clay')}
    <defs><clipPath id="b"><path d="M404 356 H620 Q664 356 670 404 L680 820 Q680 892 610 892 H414 Q344 892 344 820 L354 404 Q360 356 404 356 Z"/></clipPath></defs>
    <path d="M462 214 C462 150 486 112 512 112 C538 112 562 150 562 214 Z" fill="${TAPE}"/>
    <rect x="374" y="206" width="276" height="150" rx="30" fill="${CREAM}"/>
    <path d="M404 356 H620 Q664 356 670 404 L680 820 Q680 892 610 892 H414 Q344 892 344 820 L354 404 Q360 356 404 356 Z" fill="#F0E2CE"/>
    <g clip-path="url(#b)"><rect x="300" y="560" width="420" height="380" fill="${MILK}"/><rect x="300" y="556" width="420" height="12" fill="${MILK_LINE}"/></g>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i % 2 ? 560 : 520}" y="${450 + i * 70}" width="${i % 2 ? 80 : 120}" height="16" rx="8" fill="${CLAY}"/>`).join('')}
  </svg>`,
  tape: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    ${bg('clay')}
    <g transform="translate(512 520) scale(1.16) translate(-512 -520) rotate(-7 512 540)">${pouch({ stripe: false })}
      <g transform="rotate(-6 512 440)">
        <path d="M250 380 L280 370 L262 400 L284 418 L262 438 L282 466 L250 476 L774 476 L744 464 L764 438 L742 418 L764 398 L746 370 L774 380 Z" fill="${TAPE}"/>
        <path d="M330 428 Q400 404 480 422" stroke="${INK}" stroke-width="24" fill="none" stroke-linecap="round"/>
        <path d="M540 430 Q610 410 690 424" stroke="${INK}" stroke-width="24" fill="none" stroke-linecap="round"/>
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
