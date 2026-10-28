// Maakt de eindeloos herhaalbare achtergrondstrook voor het spel uit assets-bron/achtergrond.png.
//
// Gebruik (opnieuw uitvoeren als de tekening verandert):   npm run achtergrond
//
// Stappen:
// 1. Storende lijntjes in het effen onderste deel weghalen (ze worden opgevuld met de achtergrondkleur).
// 2. Het bovenste deel met textuur uitsnijden, in de verhouding van het spel (16:9).
// 3. Naadloos maken in de breedte: de afbeelding wordt een halve breedte opgeschoven, zodat de oude
//    randen in het midden komen te liggen. Daar laten we de oorspronkelijke afbeelding overvloeien
//    met de opgeschoven versie. Het overvloeien houdt de korreligheid even sterk (geen vervaagde band).
//    Er wordt dus niet gespiegeld, en de linker- en rechterrand sluiten perfect aan.
// 4. Schalen naar 1080 pixels hoog (de breedte volgt uit de verhouding) en opslaan.
// 5. Een testbestand maken waarin de strook 3 keer naast elkaar staat.
// De originele tekening wordt niet aangepast.

import sharp from 'sharp';

const BRON = 'assets-bron/achtergrond.png';
const DOEL = 'public/assets/images/achtergrond.png';
const TEST = 'assets-bron/achtergrond-test.png'; // alleen om te controleren; hoort niet in het spel
const HOOGTE = 1080;       // hoogte van de strook in het spel (pixels)
const VERHOUDING = 16 / 9; // breedte / hoogte van het uitgesneden deel van de bron
const OVERVLOEI = 0.22;    // breedte van de overgangszone, als fractie van de breedte (aan weerszijden van het midden)
const STRAAL = 6;          // hoe ver we rond een lijntje ook opvullen (pixels van de bron)

const { data, info } = await sharp(BRON).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const B = info.width, H0 = info.height, K = 3;
console.log(`Origineel ${B}x${H0}`);

// Achtergrondkleur: de mediaan per kanaal (de korrels zijn lichter, dus de mediaan is de effen kleur)
const mediaan = (waarden) => { const s = Uint8Array.from(waarden).sort(); return s[s.length >> 1]; };
const bg = [0, 1, 2].map((k) => {
  const stap = 37, w = [];
  for (let i = k; i < data.length; i += K * stap) w.push(data[i]);
  return mediaan(w);
});
console.log(`Achtergrondkleur: rgb(${bg.join(', ')})`);

// 1. Lijntjes weghalen: in het onderste deel (daar is geen textuur) alles wat afwijkt van de achtergrondkleur
const vanaf = Math.floor(H0 * 0.78);
const afwijking = (i) => Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
const masker = new Uint8Array(B * H0);
let aantal = 0;
for (let y = vanaf; y < H0; y++) for (let x = 0; x < B; x++) if (afwijking((y * B + x) * K) > 24) { masker[y * B + x] = 1; aantal++; }
for (let y = vanaf; y < H0; y++) {
  for (let x = 0; x < B; x++) {
    if (!masker[y * B + x]) continue;
    for (let dy = -STRAAL; dy <= STRAAL; dy++) for (let dx = -STRAAL; dx <= STRAAL; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= H0 || xx < 0 || xx >= B) continue;
      const i = (yy * B + xx) * K;
      data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2];
    }
  }
}
console.log(`${aantal} afwijkende pixels in het onderste deel opgevuld met de achtergrondkleur`);

// 2. Bovenste deel, in de verhouding van het spel
const H = Math.round(B / VERHOUDING);
const W = B;
console.log(`Uitsnede: bovenste ${W}x${H} (van ${H0} hoog)`);

// 3. Naadloos maken
const orig = new Float32Array(W * H * K);
for (let y = 0; y < H; y++) for (let i = 0; i < W * K; i++) orig[y * W * K + i] = data[y * B * K + i];
const half = W >> 1;
const zone = Math.round(W * OVERVLOEI);
const uit = new Float32Array(W * H * K);
for (let x = 0; x < W; x++) {
  // t = 0: helemaal de opgeschoven versie (aan de randen); t = 1: helemaal het origineel (in het midden)
  const afstand = Math.abs(x - half);                     // afstand tot het midden
  const t = Math.min(Math.max(1 - (afstand - 0) / zone, 0), 1);
  const hoek = (t * Math.PI) / 2;
  const wOrig = Math.sin(hoek), wShift = Math.cos(hoek);  // wOrig² + wShift² = 1: de korreligheid blijft even sterk
  const xShift = (x + half) % W;                           // opgeschoven: de randen komen in het midden
  for (let y = 0; y < H; y++) {
    for (let k = 0; k < K; k++) {
      const a = orig[(y * W + x) * K + k] - bg[k];
      const b = orig[(y * W + xShift) * K + k] - bg[k];
      uit[(y * W + x) * K + k] = bg[k] + wOrig * a + wShift * b;
    }
  }
}
const naadloos = Buffer.alloc(W * H * K);
for (let i = 0; i < naadloos.length; i++) naadloos[i] = Math.min(Math.max(Math.round(uit[i]), 0), 255);

// 4. Schalen en opslaan
const breedte = Math.round(HOOGTE * (W / H));
const strook = await sharp(naadloos, { raw: { width: W, height: H, channels: K } })
  .resize({ width: breedte, height: HOOGTE, kernel: 'lanczos3' })
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();
const meta = await sharp(strook).metadata();
await sharp(strook).toFile(DOEL);
console.log(`${DOEL}: ${meta.width}x${meta.height}`);

// Controle op het eindresultaat: verschil tussen de laatste en eerste kolom (de naad) tegenover buurkolommen
{
  const { data: px, info: pi } = await sharp(DOEL).raw().toBuffer({ resolveWithObject: true });
  const verschil = (a, b) => {
    let s = 0;
    for (let y = 0; y < pi.height; y++) for (let k = 0; k < 3; k++) s += Math.abs(px[(y * pi.width + a) * pi.channels + k] - px[(y * pi.width + b) * pi.channels + k]);
    return s / (pi.height * 3);
  };
  let binnen = 0, n = 0;
  for (let x = 10; x < pi.width - 10; x += 17) { binnen += verschil(x, x + 1); n++; }
  console.log(`Naadcontrole: verschil over de naad ${verschil(pi.width - 1, 0).toFixed(2)}, gemiddeld tussen buurkolommen ${(binnen / n).toFixed(2)}`);
}

// 5. Testbestand: de strook 3 keer naast elkaar
await sharp({ create: { width: meta.width * 3, height: meta.height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
  .composite([0, 1, 2].map((n) => ({ input: strook, left: n * meta.width, top: 0 })))
  .png({ compressionLevel: 6 })
  .toFile(TEST);
console.log(`${TEST}: ${meta.width * 3}x${meta.height} (3 keer naast elkaar)`);
