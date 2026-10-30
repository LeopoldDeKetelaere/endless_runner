// Maakt de afbeelding van de rots voor het spel uit de originele tekening in assets-bron/rots.png.
//
// Gebruik (opnieuw uitvoeren als de tekening verandert):   npm run rots
//
// De tekening heeft een zwarte achtergrond met een bruinige gloed rond de rots. De rots zelf bevat ook zwart
// (gaten, schaduwen) en heeft een zwarte contourlijn, dus we kunnen niet simpelweg alle zwart wegmaken.
// Werkwijze:
// 1. Rots-vulling = de heldere pixels. Rondom ligt de zwarte contourlijn (ongeveer 15 pixels dik).
// 2. Vanaf de rand van het beeld "stromen" we naar binnen door de achtergrond: door de gloed (helderder dan zwart)
//    en door zwart dat ver van de rots af ligt. De contourlijn houdt die stroom tegen, want die is zwart en ligt
//    vlak bij de rots. Alles wat de stroom bereikt, is buiten de rots en wordt transparant.
//    Alles wat de stroom niet bereikt (de rots, de contour en alle zwarte vlakken erin) blijft ondoorzichtig.
// 3. De rand wordt zacht gemaakt (anti-aliasing) en kleurt zwart, zodat er geen bruine gloedrand overblijft.
// 4. De onderkant wordt vlak afgesneden, zodat de rots netjes op de bodem staat.
// 5. Snijden tot de rots en verkleinen naar spelgrootte (de grootste hoogte uit config.js, rotsMaxHoogte).
// 6. Een testbestand (assets-bron/rots-test.png) met de rots op een blauwgrijze achtergrond.
// De originele tekening wordt niet aangepast.

import sharp from 'sharp';

const BRON = 'assets-bron/rots.png';
const DOEL = 'public/assets/images/rots.png';
const TEST = 'assets-bron/rots-test.png'; // alleen om te controleren; hoort niet in het spel
const HOOGTE_SPEL = 216;  // hoogte in pixels van de grootste rots in het spel (zet gelijk aan rotsMaxHoogte in config.js)
const TEST_ACHTERGROND = { r: 70, g: 104, b: 146 }; // blauwgrijs, ongeveer de spelachtergrond

const T_VULLING = 110;    // helderheid vanaf waar een pixel rotsvulling is
const T_ZWART = 26;       // onder deze helderheid is een pixel zwart (contour, gaten, achtergrond)
const R_CONTOUR = 17;     // zwart dat dichter dan dit bij de vulling ligt, hoort bij de contour (houdt de stroom tegen)
const RAND_ZACHT = 3;     // pixels langs de rand die we zacht en zwart maken
const ZWART = [10, 8, 6]; // kleur van de contour
const SNIJ_PERCENTIEL = 0.04; // de onderkant snijden we op de hoogte tot waar 96% van de kolommen reiken

const { data, info } = await sharp(BRON).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const B = info.width, H = info.height, N = B * H;
const lum = new Uint8Array(N);
for (let p = 0; p < N; p++) lum[p] = Math.round(0.299 * data[p * 3] + 0.587 * data[p * 3 + 1] + 0.114 * data[p * 3 + 2]);
console.log(`Origineel ${B}x${H}`);

// 1. Afstand tot de rotsvulling (benaderd, twee rondes over het beeld)
const vulling = new Uint8Array(N);
for (let p = 0; p < N; p++) vulling[p] = lum[p] >= T_VULLING ? 1 : 0;
const dist = new Float32Array(N).fill(1e9);
for (let p = 0; p < N; p++) if (vulling[p]) dist[p] = 0;
const DIAG = Math.SQRT2;
for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) {
  const p = y * B + x; let d = dist[p];
  if (x > 0) d = Math.min(d, dist[p - 1] + 1);
  if (y > 0) { d = Math.min(d, dist[p - B] + 1); if (x > 0) d = Math.min(d, dist[p - B - 1] + DIAG); if (x < B - 1) d = Math.min(d, dist[p - B + 1] + DIAG); }
  dist[p] = d;
}
for (let y = H - 1; y >= 0; y--) for (let x = B - 1; x >= 0; x--) {
  const p = y * B + x; let d = dist[p];
  if (x < B - 1) d = Math.min(d, dist[p + 1] + 1);
  if (y < H - 1) { d = Math.min(d, dist[p + B] + 1); if (x < B - 1) d = Math.min(d, dist[p + B + 1] + DIAG); if (x > 0) d = Math.min(d, dist[p + B - 1] + DIAG); }
  dist[p] = d;
}

// 2. De stroom vanaf de rand van het beeld door de achtergrond
const toegestaan = (p) => !vulling[p] && (lum[p] >= T_ZWART || dist[p] > R_CONTOUR);
const buiten = new Uint8Array(N);
const rij = new Int32Array(N);
let kop = 0, staart = 0;
const start = (p) => { if (!buiten[p] && toegestaan(p)) { buiten[p] = 1; rij[staart++] = p; } };
for (let x = 0; x < B; x++) { start(x); start((H - 1) * B + x); }
for (let y = 0; y < H; y++) { start(y * B); start(y * B + B - 1); }
while (kop < staart) {
  const p = rij[kop++]; const x = p % B, y = (p / B) | 0;
  if (x > 0) start(p - 1);
  if (x < B - 1) start(p + 1);
  if (y > 0) start(p - B);
  if (y < H - 1) start(p + B);
}

// De rots = alles wat de stroom niet bereikt. We houden alleen het grootste aaneengesloten stuk.
let rots = new Uint8Array(N);
for (let p = 0; p < N; p++) rots[p] = buiten[p] ? 0 : 1;
{
  const label = new Int32Array(N); const groottes = [0]; let n = 0;
  for (let s = 0; s < N; s++) {
    if (!rots[s] || label[s]) continue;
    n++; groottes.push(0); let k = 0, e = 0; rij[e++] = s; label[s] = n;
    while (k < e) {
      const p = rij[k++]; groottes[n]++; const x = p % B, y = (p / B) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < B - 1 ? p + 1 : -1, y > 0 ? p - B : -1, y < H - 1 ? p + B : -1]) if (q >= 0 && rots[q] && !label[q]) { label[q] = n; rij[e++] = q; }
    }
  }
  let grootste = 1; for (let i = 1; i <= n; i++) if (groottes[i] > groottes[grootste]) grootste = i;
  console.log(`${n} aaneengesloten stukken; het grootste heeft ${groottes[grootste]} pixels (de rest, ${n - 1} stukjes, wordt weggelaten)`);
  for (let p = 0; p < N; p++) rots[p] = label[p] === grootste ? 1 : 0;
}

// 4. Onderkant vlak: kijk per kolom hoe laag de rots reikt, en snij op het 4e percentiel
const onderkanten = [];
for (let x = 0; x < B; x++) {
  let laagste = -1, hoogste = H;
  for (let y = 0; y < H; y++) if (rots[y * B + x]) { if (y > laagste) laagste = y; if (y < hoogste) hoogste = y; }
  if (laagste >= 0 && laagste - hoogste > 60) onderkanten.push(laagste);
}
onderkanten.sort((a, b) => a - b);
const snijY = onderkanten[Math.floor(onderkanten.length * SNIJ_PERCENTIEL)];
console.log(`Onderkant: de rots reikt per kolom tot y ${onderkanten[0]}..${onderkanten[onderkanten.length - 1]}; we snijden op y ${snijY}`);
for (let y = snijY + 1; y < H; y++) for (let x = 0; x < B; x++) rots[y * B + x] = 0;
// Kolommen die niet tot de snede reiken (kleine inkepingen en de schuine uiteinden): vul ze zwart op tot de snede,
// zodat er onderaan geen gaatjes of zwevende randjes zijn.
const opgevuld = new Uint8Array(N);
for (let x = 0; x < B; x++) {
  let laagste = -1, hoogste = H;
  for (let y = 0; y <= snijY; y++) if (rots[y * B + x]) { if (y > laagste) laagste = y; if (y < hoogste) hoogste = y; }
  if (laagste < 0 || laagste - hoogste <= 60) continue;
  for (let y = laagste + 1; y <= snijY; y++) { rots[y * B + x] = 1; opgevuld[y * B + x] = 1; }
}

// Vak om de rots
let links = B, rechts = -1, boven = H;
for (let y = 0; y <= snijY; y++) for (let x = 0; x < B; x++) if (rots[y * B + x]) { if (x < links) links = x; if (x > rechts) rechts = x; if (y < boven) boven = y; }
const vak = { left: links, top: boven, width: rechts - links + 1, height: snijY - boven + 1 };
console.log(`Rots: ${vak.width}x${vak.height} (breedte x hoogte), vak links ${vak.left} boven ${vak.top}`);

// 3. Zachte, zwarte rand. Afstand vanaf de buitenkant naar binnen, binnen de rots.
const binnen = new Float32Array(N).fill(1e9);
for (let p = 0; p < N; p++) if (!rots[p]) binnen[p] = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) {
  const p = y * B + x; let d = binnen[p];
  if (x > 0) d = Math.min(d, binnen[p - 1] + 1);
  if (y > 0) { d = Math.min(d, binnen[p - B] + 1); if (x > 0) d = Math.min(d, binnen[p - B - 1] + DIAG); if (x < B - 1) d = Math.min(d, binnen[p - B + 1] + DIAG); }
  binnen[p] = d;
}
for (let y = H - 1; y >= 0; y--) for (let x = B - 1; x >= 0; x--) {
  const p = y * B + x; let d = binnen[p];
  if (x < B - 1) d = Math.min(d, binnen[p + 1] + 1);
  if (y < H - 1) { d = Math.min(d, binnen[p + B] + 1); if (x < B - 1) d = Math.min(d, binnen[p + B + 1] + DIAG); if (x > 0) d = Math.min(d, binnen[p + B - 1] + DIAG); }
  binnen[p] = d;
}
// De onderkant (de snede) is geen rand: daar blijft de rots tot en met de laatste rij helemaal ondoorzichtig.
const uit = Buffer.alloc(vak.width * vak.height * 4);
for (let y = 0; y < vak.height; y++) {
  for (let x = 0; x < vak.width; x++) {
    const p = (vak.top + y) * B + (vak.left + x);
    let d = binnen[p];
    if (y === vak.height - 1 || y >= vak.height - RAND_ZACHT) d = Math.max(d, 1e3 * (rots[p] ? 1 : 0)); // geen zachte rand langs de snede
    const o = (y * vak.width + x) * 4;
    // alpha: 0 buiten, oplopend naar 1 over 2 pixels langs de rand
    const alpha = rots[p] ? Math.min(1, Math.max(0, d / 2)) : 0;
    // Langs de rand de zwarte contourkleur, zodat er nooit gloed doorschijnt
    const zwart = (d < RAND_ZACHT && !(y >= vak.height - RAND_ZACHT)) || opgevuld[p] === 1;
    uit[o] = zwart ? ZWART[0] : data[p * 3];
    uit[o + 1] = zwart ? ZWART[1] : data[p * 3 + 1];
    uit[o + 2] = zwart ? ZWART[2] : data[p * 3 + 2];
    uit[o + 3] = Math.round(alpha * 255);
  }
}

// 5. Verkleinen naar spelgrootte
const volledig = sharp(uit, { raw: { width: vak.width, height: vak.height, channels: 4 } });
const breedteSpel = Math.round(HOOGTE_SPEL * (vak.width / vak.height));
const klein = await volledig.clone().resize({ width: breedteSpel, height: HOOGTE_SPEL, kernel: 'lanczos3' }).png({ compressionLevel: 9, effort: 10 }).toBuffer();
await sharp(klein).toFile(DOEL);
console.log(`${DOEL}: ${breedteSpel}x${HOOGTE_SPEL}`);
console.log(`Hoogte/breedte-verhouding: ${(HOOGTE_SPEL / breedteSpel).toFixed(3)} (zet in config.js bij rotsVerhouding)`);

// 6. Testbestand: de rots op blauwgrijs, groot (om de gaten en de rand te bekijken) en op spelgrootte
const groot = await volledig.clone().png().toBuffer();
const rand = 40;
const testBreedte = vak.width + 2 * rand;
const rijHoogte = HOOGTE_SPEL + 2 * rand;
const testHoogte = vak.height + 2 * rand + rijHoogte;
const kleinGespiegeld = await sharp(klein).flop().toBuffer();
const kleinLaag = await sharp(klein).resize({ height: 144 }).toBuffer();
const kleinLaagMeta = await sharp(kleinLaag).metadata();
await sharp({ create: { width: testBreedte, height: testHoogte, channels: 3, background: TEST_ACHTERGROND } })
  .composite([
    { input: groot, left: rand, top: rand },
    { input: klein, left: rand, top: vak.height + 2 * rand },
    { input: kleinGespiegeld, left: rand + breedteSpel + rand, top: vak.height + 2 * rand },
    { input: kleinLaag, left: rand + 2 * (breedteSpel + rand), top: vak.height + 2 * rand + (HOOGTE_SPEL - 144) },
  ])
  .png({ compressionLevel: 6 })
  .toFile(TEST);
console.log(`${TEST}: ${testBreedte}x${testHoogte}`);
