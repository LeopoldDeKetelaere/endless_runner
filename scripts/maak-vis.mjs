// Maakt de afbeelding van de vis voor het spel uit de originele tekening in assets-bron/vis.png.
//
// Gebruik (opnieuw uitvoeren als de tekening verandert):   npm run vis
//
// - Controleert of de achtergrond transparant is (een witte achtergrond wordt gemeld).
// - Snijdt de lege (transparante) rand weg, zodat de afbeelding precies om de vis past.
// - public/assets/images/vis.png: verkleind voor in het spel.
// De transparantie blijft behouden en we gebruiken de scherpste verkleinmethode (Lanczos),
// zodat de zwarte lijnen scherp blijven. De originele tekening wordt niet aangepast.

import sharp from 'sharp';

const BRON = 'assets-bron/vis.png';
const DOEL = 'public/assets/images/vis.png';
const BREEDTE = 220; // breedte in pixels (bij een scherm van 1920x1080). Zet dezelfde waarde in config.js (visBreedte).
const MARGE = 4;     // pixels van de originele tekening die we rond de vis laten staan

const { data, info } = await sharp(BRON).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let links = info.width, boven = info.height, rechts = -1, onder = -1;
let witte = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i + 3] <= 10) continue; // transparant
    if (Math.min(data[i], data[i + 1], data[i + 2]) > 235) witte++;
    if (x < links) links = x;
    if (x > rechts) rechts = x;
    if (y < boven) boven = y;
    if (y > onder) onder = y;
  }
}
if (witte > 0) console.warn(`LET OP: ${witte} (bijna) witte pixels gevonden. De achtergrond is niet transparant; maak ze eerst transparant.`);
else console.log('Achtergrond is transparant, geen witte pixels gevonden.');

const vak = {
  left: Math.max(links - MARGE, 0),
  top: Math.max(boven - MARGE, 0),
  width: Math.min(rechts + MARGE, info.width - 1) - Math.max(links - MARGE, 0) + 1,
  height: Math.min(onder + MARGE, info.height - 1) - Math.max(boven - MARGE, 0) + 1,
};
console.log(`Origineel ${info.width}x${info.height}; vis op x ${links}-${rechts}, y ${boven}-${onder}; uitsnede ${vak.width}x${vak.height} (vak: links ${vak.left}, boven ${vak.top})`);

const uitvoer = await sharp(BRON)
  .ensureAlpha()
  .extract(vak)
  .resize({ width: BREEDTE, kernel: 'lanczos3' })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(DOEL);
console.log(`${DOEL}: ${uitvoer.width}x${uitvoer.height}, ${Math.round(uitvoer.size / 1024)} kB`);
console.log(`Hoogte/breedte-verhouding: ${(uitvoer.height / uitvoer.width).toFixed(3)} (zet in config.js bij visVerhouding)`);
