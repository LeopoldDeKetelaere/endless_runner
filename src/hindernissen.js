import { BREEDTE, HOOGTE, CONFIG } from './config.js';

// Maakt één 'kolom' hindernissen (rots, boot, octopus en/of vis) en
// garandeert dat er een doorgang overblijft. Geeft null als er geen eerlijke
// kolom gevonden is (dan slaan we deze keer gewoon over).
//
// doorgangen: lijst met de midden-hoogtes (y) van de laatste doorgangen (nieuwste laatst)
// snelheid:   huidige wereldsnelheid (pixels per seconde)
// Resultaat:  { items: [{ type, breedte, hoogte, y, kleur, ... }], doorgang }
//
// Hoe de eerlijkheid werkt:
// - Rotsen, boten en octopussen staan in de kolom zelf. Voor een octopus tellen
//   we het hele gebied waar hij op en neer dobbert als 'bezet'.
// - Een vis is sneller dan de achtergrond en kan dus over eerdere kolommen heen
//   zwemmen. Daarom plaatsen we een vis alleen buiten het gebied waar de recente
//   doorgangen zitten: hij kan de doorgang nooit blokkeren.

const rand = (min, max) => min + Math.random() * (max - min);

// Rotsen en boten zijn nooit hoger dan dit deel van het scherm
const maxRandHoogte = () => HOOGTE * CONFIG.maxRandHoogteFractie;

// Afstand (pixels) tussen twee kolommen
const kolomAfstand = () => (CONFIG.hindernisInterval / 1000) * CONFIG.startSnelheid;

// Hoeveel pixels de duiker verticaal kan verschuiven tussen twee kolommen
function maxVerschuiving(snelheid) {
  const breedsteHindernis = Math.max(CONFIG.rotsBreedte, CONFIG.bootBreedte, CONFIG.octopusBreedte);
  const vrijeAfstand = kolomAfstand() - breedsteHindernis - CONFIG.duikerBreedte;
  const tijd = Math.max(vrijeAfstand, 0) / snelheid;
  return CONFIG.duikerSnelheid * tijd * CONFIG.bereikFactor;
}

// Over hoeveel eerdere kolommen kan een vis nog heen zwemmen?
function aantalKolommenVoorVis() {
  const f = CONFIG.visSnelheidFactor;
  if (f <= 1) return 1;
  // Tijdens zijn tocht over het scherm haalt de vis (f - 1)/f * (afstand) in op de achtergrond
  const ingehaald = (BREEDTE + CONFIG.visBreedte) * (f - 1) / f;
  return Math.ceil(ingehaald / kolomAfstand()) + 1;
}

// Bedenk een willekeurige kolom (nog zonder eerlijkheidscontrole)
// Geeft { items, vis }: vis is apart, want die wordt pas later geplaatst.
function bedenkKolom() {
  const items = [];
  let vis = null;
  const rots = Math.random() < CONFIG.kansRots;
  const boot = Math.random() < CONFIG.kansBoot;
  const dier = Math.random() < CONFIG.kansDier || (!rots && !boot);

  if (rots) {
    const hoogte = rand(CONFIG.rotsMinHoogte, maxRandHoogte());
    items.push({ type: 'rots', breedte: CONFIG.rotsBreedte, hoogte, y: HOOGTE - hoogte / 2, amp: 0, kleur: CONFIG.rotsKleur });
  }
  if (boot) {
    const hoogte = rand(CONFIG.bootMinHoogte, maxRandHoogte());
    items.push({ type: 'boot', breedte: CONFIG.bootBreedte, hoogte, y: hoogte / 2, amp: 0, kleur: CONFIG.bootKleur });
  }
  if (dier && Math.random() < CONFIG.octopusAandeel) {
    const hoogte = rand(CONFIG.octopusMinHoogte, CONFIG.octopusMaxHoogte);
    const amp = CONFIG.dobberHoogte;
    // Het hele dobbergebied moet binnen het scherm blijven
    const y = rand(amp + hoogte / 2, HOOGTE - amp - hoogte / 2);
    items.push({
      type: 'octopus', breedte: CONFIG.octopusBreedte, hoogte, y, amp,
      periode: CONFIG.dobberPeriode, fase: rand(0, Math.PI * 2), kleur: CONFIG.octopusKleur,
    });
  } else if (dier) {
    const hoogte = rand(CONFIG.visMinHoogte, CONFIG.visMaxHoogte);
    vis = { type: 'vis', breedte: CONFIG.visBreedte, hoogte, y: 0, amp: 0, snelheidFactor: CONFIG.visSnelheidFactor, kleur: CONFIG.visKleur };
  }
  return { items, vis };
}

// Zoek de vrije stroken (tussen hindernissen en de schermranden)
function vrijeStroken(items) {
  const bezet = items
    .map((i) => [i.y - i.amp - i.hoogte / 2, i.y + i.amp + i.hoogte / 2])
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

// Kies een hoogte voor de vis, buiten het gebied van de recente doorgangen
function plaatsVis(vis, recenteDoorgangen) {
  const half = CONFIG.minimaleOpening / 2;
  const boven = Math.min(...recenteDoorgangen) - half;
  const onder = Math.max(...recenteDoorgangen) + half;
  const opties = [];
  if (boven - vis.hoogte / 2 >= vis.hoogte / 2) opties.push([vis.hoogte / 2, boven - vis.hoogte / 2]);
  if (HOOGTE - vis.hoogte / 2 >= onder + vis.hoogte / 2) opties.push([onder + vis.hoogte / 2, HOOGTE - vis.hoogte / 2]);
  if (opties.length === 0) return false;
  const [van, tot] = opties[Math.floor(Math.random() * opties.length)];
  vis.y = rand(van, tot);
  return true;
}

export function maakKolom(doorgangen, snelheid) {
  const vorige = doorgangen[doorgangen.length - 1];
  for (let poging = 0; poging < 30; poging++) {
    const { items, vis } = bedenkKolom();
    const doorgang = zoekDoorgang(items, vorige, snelheid);
    if (doorgang === null) continue;
    if (vis) {
      const recent = [...doorgangen, doorgang].slice(-aantalKolommenVoorVis());
      if (!plaatsVis(vis, recent)) continue;
      items.push(vis);
    }
    return { items, doorgang };
  }
  return null;
}
