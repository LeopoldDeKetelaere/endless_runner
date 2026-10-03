import { HOOGTE, CONFIG } from './config.js';

// Maakt één 'kolom' hindernissen (rots, boot en/of rood op dezelfde plek) en
// garandeert dat er een doorgang overblijft. Geeft null als er geen eerlijke
// kolom gevonden is (dan slaan we deze keer gewoon over).
//
// vorigeDoorgang: hoogte (y) van het midden van de vorige doorgang
// snelheid:       huidige wereldsnelheid (pixels per seconde)
// Resultaat:      { items: [{ type, breedte, hoogte, y, kleur }], doorgang }

const rand = (min, max) => min + Math.random() * (max - min);

// Hoeveel pixels de duiker verticaal kan verschuiven tussen twee kolommen
function maxVerschuiving(snelheid) {
  const breedsteHindernis = Math.max(CONFIG.rotsBreedte, CONFIG.bootBreedte, CONFIG.roodBreedte);
  const afstandTussenKolommen = (CONFIG.hindernisInterval / 1000) * CONFIG.startSnelheid;
  const vrijeAfstand = afstandTussenKolommen - breedsteHindernis - CONFIG.duikerBreedte;
  const tijd = Math.max(vrijeAfstand, 0) / snelheid;
  return CONFIG.duikerSnelheid * tijd * CONFIG.bereikFactor;
}

// Rotsen en boten zijn nooit hoger dan dit deel van het scherm
const maxRandHoogte = () => HOOGTE * CONFIG.maxRandHoogteFractie;

// Bedenk een willekeurige kolom (nog zonder eerlijkheidscontrole)
function bedenkKolom() {
  const items = [];
  const rots = Math.random() < CONFIG.kansRots;
  const boot = Math.random() < CONFIG.kansBoot;
  const rood = Math.random() < CONFIG.kansRood;

  if (rots) {
    const hoogte = rand(CONFIG.rotsMinHoogte, maxRandHoogte());
    items.push({ type: 'rots', breedte: CONFIG.rotsBreedte, hoogte, y: HOOGTE - hoogte / 2, kleur: CONFIG.rotsKleur });
  }
  if (boot) {
    const hoogte = rand(CONFIG.bootMinHoogte, maxRandHoogte());
    items.push({ type: 'boot', breedte: CONFIG.bootBreedte, hoogte, y: hoogte / 2, kleur: CONFIG.bootKleur });
  }
  if (rood || items.length === 0) {
    const hoogte = rand(CONFIG.roodMinHoogte, CONFIG.roodMaxHoogte);
    items.push({ type: 'rood', breedte: CONFIG.roodBreedte, hoogte, y: rand(hoogte / 2, HOOGTE - hoogte / 2), kleur: CONFIG.roodKleur });
  }
  return items;
}

// Zoek de vrije stroken (tussen hindernissen en de schermranden)
function vrijeStroken(items) {
  const bezet = items
    .map((i) => [i.y - i.hoogte / 2, i.y + i.hoogte / 2])
    .sort((a, b) => a[0] - b[0]);
  const stroken = [];
  let huidig = 0;
  for (const [boven, onder] of bezet) {
    if (boven > huidig) stroken.push([huidig, boven]);
    huidig = Math.max(huidig, onder);
  }
  if (huidig < HOOGTE) stroken.push([huidig, HOOGTE]);
  return stroken;
}

// Is er een strook die groot genoeg is én haalbaar vanaf de vorige doorgang?
// Zo ja: geef het midden van een doorgang terug (willekeurig gekozen uit alle
// haalbare plekken, zodat de doorgang niet altijd naar boven of onder drijft).
function zoekDoorgang(items, vorigeDoorgang, snelheid) {
  const half = CONFIG.minimaleOpening / 2;
  const verschuiving = maxVerschuiving(snelheid);
  const opties = [];
  for (const [boven, onder] of vrijeStroken(items)) {
    if (onder - boven < CONFIG.minimaleOpening) continue;
    // Het midden van de duiker mag in dit bereik liggen, en moet haalbaar zijn
    const van = Math.max(boven + half, vorigeDoorgang - verschuiving);
    const tot = Math.min(onder - half, vorigeDoorgang + verschuiving);
    if (van <= tot) opties.push([van, tot]);
  }
  if (opties.length === 0) return null;
  const [van, tot] = opties[Math.floor(Math.random() * opties.length)];
  return rand(van, tot);
}

export function maakKolom(vorigeDoorgang, snelheid) {
  for (let poging = 0; poging < 30; poging++) {
    const items = bedenkKolom();
    const doorgang = zoekDoorgang(items, vorigeDoorgang, snelheid);
    if (doorgang !== null) return { items, doorgang };
  }
  return null;
}
