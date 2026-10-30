// Maakt de afbeelding van de boot voor het spel uit assets-bron/boot-klaar.png (het onderwaterdeel van de boot,
// met transparante achtergrond en een rechte bovenkant).
//
// Gebruik (opnieuw uitvoeren als de tekening verandert):   npm run boot
//
// - Snijdt de lege (transparante) rand weg. Bovenaan snijden we NIET weg: de rechte bovenrand van de boot
//   moet precies op de bovenste rij van de afbeelding blijven liggen.
// - public/assets/images/boot.png: verkleind voor in het spel, met transparantie en scherpe lijnen.
// De originele bestanden in assets-bron worden niet aangepast.

import sharp from 'sharp';

const BRON = 'assets-bron/boot-klaar.png';
const DOEL = 'public/assets/images/boot.png';
const HOOGTE_SPEL = 130; // hoogte in pixels van de grootste boot in het spel (zet gelijk aan bootMaxHoogte in config.js)

const { data, info } = await sharp(BRON).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let links = info.width, rechts = -1, boven = info.height, onder = -1;
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
// De bovenrand blijft precies waar hij is (rij 0 van de afbeelding)
const vak = { left: links, top: 0, width: rechts - links + 1, height: onder + 1 };
console.log(`Origineel ${info.width}x${info.height}; boot op x ${links}-${rechts}, y ${boven}-${onder}; uitsnede ${vak.width}x${vak.height}`);
if (boven !== 0) console.warn(`LET OP: de bovenrand ligt niet op rij 0 maar op rij ${boven}. Er zit dan een kier boven de boot.`);

const breedte = Math.round(HOOGTE_SPEL * (vak.width / vak.height));
const uitvoer = await sharp(BRON)
  .ensureAlpha()
  .extract(vak)
  .resize({ width: breedte, height: HOOGTE_SPEL, kernel: 'lanczos3' })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(DOEL);
console.log(`${DOEL}: ${uitvoer.width}x${uitvoer.height}, ${Math.round(uitvoer.size / 1024)} kB`);
console.log(`Hoogte/breedte-verhouding: ${(uitvoer.height / uitvoer.width).toFixed(3)} (zet in config.js bij bootVerhouding)`);
