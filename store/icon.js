const sharp = require('sharp');

// Pumping icon: a warm clay field, a cream ring three quarters full (the
// Today ring), and a milk-white drop in the middle. Reads at 60px. (A clay
// drop on cream was tried first and read as blood, so the colors are flipped.)
const art = (bg) => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.38" r="0.75">
      <stop offset="0" stop-color="#C46A50"/>
      <stop offset="1" stop-color="#9C4632"/>
    </radialGradient>
    <linearGradient id="drop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFDF8"/>
      <stop offset="1" stop-color="#F6E9D8"/>
    </linearGradient>
  </defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}
  <circle cx="512" cy="512" r="318" fill="none" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="58"/>
  <circle cx="512" cy="512" r="318" fill="none" stroke="#FCEBD6" stroke-width="58" stroke-linecap="round"
    stroke-dasharray="${2 * Math.PI * 318 * 0.72} 4000" transform="rotate(-90 512 512)"/>
  <g transform="translate(512 528) scale(19) translate(-12 -13)">
    <path d="M12 3.2C12 3.2 5.5 10.1 5.5 14.6A6.5 6.5 0 0 0 18.5 14.6C18.5 10.1 12 3.2 12 3.2Z" fill="url(#drop)"/>
    <path d="M8.6 14.9A3.4 3.4 0 0 0 11.2 18.3" fill="none" stroke="#D9A08A" stroke-width="1.15" stroke-linecap="round"/>
  </g>
</svg>`;

(async () => {
  const full = Buffer.from(art(true));
  // App Store icon: no transparency.
  await sharp(full).flatten({ background: '#A8503A' }).resize(1024, 1024).png().toFile('../assets/icon.png');
  await sharp(Buffer.from(art(false))).resize(1024, 1024).png().toFile('../assets/android-icon-foreground.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#A8503A' } })
    .png()
    .toFile('../assets/android-icon-background.png');
  await sharp(Buffer.from(art(false))).resize(1024, 1024).grayscale().png().toFile('../assets/android-icon-monochrome.png');
  await sharp(full).resize(48, 48).png().toFile('../assets/favicon.png');
  await sharp(full).resize(512, 512).png().toFile('../assets/splash-icon.png');
  console.log('icons written');
})();
