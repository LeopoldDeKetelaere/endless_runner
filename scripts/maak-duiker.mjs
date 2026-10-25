// Maakt de afbeeldingen van de duiker voor het spel uit de originele tekening in assets-bron/duiker.png.
//
// Gebruik (opnieuw uitvoeren als de tekening verandert):   npm run duiker
//
// - Snijdt de lege (transparante) rand weg, zodat de afbeelding precies om de duiker past.
// - public/assets/images/duiker.png        klein, voor in het spel
// - public/assets/images/duiker_groot.png  groot, voor het startscherm
// De transparantie blijft behouden en we gebruiken de scherpste verkleinmethode (Lanczos),
// zodat de zwarte lijnen scherp blijven.

import sharp from 'sharp';

const BRON = 'assets-bron/duiker.png';
const DOEL = 'public/assets/images/';
const KLEIN = 230;  // breedte van de afbeelding voor in het spel (pixels). De hoogte volgt uit de verhouding.
const GROOT = 900;  // breedte van de afbeelding voor het startscherm
const MARGE = 4;    // pixels van de originele tekening die we rond de duiker laten staan

// 1. Zoek waar de duiker staat (de pixels die niet transparant zijn)
const { data, info } = await sharp(BRON).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let links = info.width, boven = info.height, rechts = -1, onder = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 10) {
      if (x < links) links = x;
      if (x > rechts) rechts = x;
      if (y < boven) boven = y;
      if (y > onder) onder = y;
    }
  }
}
const vak = {
  left: Math.max(links - MARGE, 0),
  top: Math.max(boven - MARGE, 0),
  width: Math.min(rechts + MARGE, info.width - 1) - Math.max(links - MARGE, 0) + 1,
  height: Math.min(onder + MARGE, info.height - 1) - Math.max(boven - MARGE, 0) + 1,
};
console.log(`Origineel ${info.width}x${info.height}; duiker op x ${links}-${rechts}, y ${boven}-${onder}; uitsnede ${vak.width}x${vak.height}`);

// 2. Uitsnijden en verkleinen
for (const [naam, breedte] of [['duiker.png', KLEIN], ['duiker_groot.png', GROOT]]) {
  const uitvoer = await sharp(BRON)
    .ensureAlpha()
    .extract(vak)
    .resize({ width: breedte, kernel: 'lanczos3' })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(DOEL + naam);
  console.log(`${DOEL}${naam}: ${uitvoer.width}x${uitvoer.height}, ${Math.round(uitvoer.size / 1024)} kB`);
}
