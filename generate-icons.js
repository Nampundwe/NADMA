const sharp = require('sharp');
const path = require('path');

const SVG_TEMPLATE = (size, bg = '#1B2559') => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B2559"/>
      <stop offset="100%" stop-color="#2B3A67"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5B9CF6"/>
      <stop offset="100%" stop-color="#4A8DE8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <circle cx="${size * 0.5}" cy="${size * 0.38}" r="${size * 0.16}" fill="none" stroke="url(#accent)" stroke-width="${size * 0.025}"/>
  <rect x="${size * 0.32}" y="${size * 0.54}" width="${size * 0.36}" height="${size * 0.22}" rx="${size * 0.025}" fill="none" stroke="url(#accent)" stroke-width="${size * 0.025}"/>
  <line x1="${size * 0.5}" y1="${size * 0.54}" x2="${size * 0.5}" y2="${size * 0.76}" stroke="url(#accent)" stroke-width="${size * 0.018}"/>
  <line x1="${size * 0.32}" y1="${size * 0.65}" x2="${size * 0.68}" y2="${size * 0.65}" stroke="url(#accent)" stroke-width="${size * 0.018}"/>
  <text x="${size * 0.5}" y="${size * 0.9}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="${size * 0.11}" fill="#FFFFFF" letter-spacing="1">NADMA</text>
</svg>`;

const SPLASH_SVG = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B2559"/>
      <stop offset="100%" stop-color="#2B3A67"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5B9CF6"/>
      <stop offset="100%" stop-color="#4A8DE8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="195" r="82" fill="none" stroke="url(#accent)" stroke-width="12"/>
  <rect x="164" y="276" width="184" height="112" rx="12" fill="none" stroke="url(#accent)" stroke-width="12"/>
  <line x1="256" y1="276" x2="256" y2="388" stroke="url(#accent)" stroke-width="9"/>
  <line x1="164" y1="332" x2="348" y2="332" stroke="url(#accent)" stroke-width="9"/>
  <text x="256" y="460" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="56" fill="#FFFFFF" letter-spacing="2">NADMA</text>
</svg>`;

const FOREGROUND_SVG = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5B9CF6"/>
      <stop offset="100%" stop-color="#4A8DE8"/>
    </linearGradient>
  </defs>
  <circle cx="512" cy="390" r="164" fill="none" stroke="url(#accent)" stroke-width="24"/>
  <rect x="328" y="552" width="368" height="224" rx="24" fill="none" stroke="url(#accent)" stroke-width="24"/>
  <line x1="512" y1="552" x2="512" y2="776" stroke="url(#accent)" stroke-width="18"/>
  <line x1="328" y1="664" x2="696" y2="664" stroke="url(#accent)" stroke-width="18"/>
  <text x="512" y="920" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="112" fill="#FFFFFF" letter-spacing="4">NADMA</text>
</svg>`;

async function generate() {
  const assets = path.join(__dirname, 'assets');

  await sharp(Buffer.from(SVG_TEMPLATE(1024)))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'icon.png'));
  console.log('Generated icon.png (1024x1024)');

  await sharp(Buffer.from(SPLASH_SVG))
    .resize(1284, 2778)
    .extend({ top: 0, bottom: 0, left: 0, right: 0, background: '#1B2559' })
    .png()
    .toFile(path.join(assets, 'splash.png'));
  console.log('Generated splash.png');

  await sharp(Buffer.from(FOREGROUND_SVG))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'android-icon-foreground.png'));
  console.log('Generated android-icon-foreground.png (1024x1024)');

  await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1B2559"/><stop offset="100%" stop-color="#2B3A67"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>`))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'android-icon-background.png'));
  console.log('Generated android-icon-background.png (1024x1024)');

  await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="m" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5B9CF6"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient></defs><circle cx="512" cy="390" r="164" fill="none" stroke="url(#m)" stroke-width="24"/><rect x="328" y="552" width="368" height="224" rx="24" fill="none" stroke="url(#m)" stroke-width="24"/><line x1="512" y1="552" x2="512" y2="776" stroke="url(#m)" stroke-width="18"/><line x1="328" y1="664" x2="696" y2="664" stroke="url(#m)" stroke-width="18"/><text x="512" y="920" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="112" fill="#FFFFFF" letter-spacing="4">NADMA</text></svg>`))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'android-icon-monochrome.png'));
  console.log('Generated android-icon-monochrome.png (1024x1024)');

  await sharp(Buffer.from(`<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="#1B2559"/><circle cx="24" cy="18" r="6" fill="none" stroke="#5B9CF6" stroke-width="2"/><rect x="15" y="26" width="18" height="11" rx="2" fill="none" stroke="#5B9CF6" stroke-width="2"/><line x1="24" y1="26" x2="24" y2="37" stroke="#5B9CF6" stroke-width="1.5"/><line x1="15" y1="31.5" x2="33" y2="31.5" stroke="#5B9CF6" stroke-width="1.5"/></svg>`))
    .resize(48, 48)
    .png()
    .toFile(path.join(assets, 'favicon.png'));
  console.log('Generated favicon.png (48x48)');

  console.log('All icons generated!');
}

generate().catch(console.error);
