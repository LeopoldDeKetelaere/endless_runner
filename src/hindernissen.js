import { BREEDTE, HOOGTE, CONFIG } from './config.js';

// Maakt één 'kolom' hindernissen (rots, boot, octopussen en/of vissen) en
// garandeert dat er een doorgang overblijft. Geeft null als er geen kolom
// gevonden is (dan slaan we deze keer gewoon over).
//
// doorgangen: lijst met de midden-hoogtes (y) van de laatste doorgangen (nieuwste laatst)
// snelheid:   huidige wereldsnelheid (pixels per seconde)
// Resultaat:  { items: [{ type, breedte, hoogte, y, kleur, ... }], doorgang }
//
// Hoe de eerlijkheid werkt:
// 1. We kiezen EERST de doorgang: een vrije strook van minimaleOpening pixels hoog,
//    die haalbaar is vanaf de vorige doorgang.
// 2. Daarna plaatsen we alles eromheen. Niets mag de strook raken. Voor een octopus
//    telt het hele gebied waar hij op en neer dobbert.
// 3. Een vis is sneller dan de achtergrond en kan over eerdere kolommen heen
//    zwemmen. Daarom blijft hij ook buiten de doorgangen van de recente kolommen.

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// Willekeurig getal met normale verdeling (klokvorm) rond 'midden'
function normaal(midden, spreiding) {
  const u = 1 - Math.random();
  const v = Math.random();
  return midden + spreiding * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const halveOpening = () => CONFIG.minimaleOpening / 2;

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

// Kies de doorgang voor deze kolom: haalbaar vanaf de vorige, binnen het scherm.
// Meestal schuift hij weg van het midden, zodat het midden niet altijd veilig is.
function kiesDoorgang(vorige, snelheid) {
  const verschuiving = maxVerschuiving(snelheid);
  const van = Math.max(halveOpening(), vorige - verschuiving);
  const tot = Math.min(HOOGTE - halveOpening(), vorige + verschuiving);
  const a = rand(van, tot);
  if (Math.random() >= CONFIG.doorgangWegVanMidden) return a;
  const b = rand(van, tot);
  // Neem van twee gokken degene die het verst van het midden ligt
  return Math.abs(a - HOOGTE / 2) > Math.abs(b - HOOGTE / 2) ? a : b;
}

// Overlapt het gebied [boven, onder] met een ander gebied?
const overlapt = (b1, o1, b2, o2) => b1 < o2 && o1 > b2;

// Gebied (boven, onder) dat een item inneemt, inclusief dobberen
const gebied = (i) => [i.y - i.amp - i.hoogte / 2, i.y + i.amp + i.hoogte / 2];

// Probeer een dier op een middenvoorkeur-hoogte te zetten dat 'verboden' gebieden vermijdt.
// maakItem(y) levert het item; verboden is een lijst [boven, onder]; ruimte is [minY, maxY].
function plaatsDier(maakItem, ruimte, verboden, bestaande) {
  for (let poging = 0; poging < 15; poging++) {
    const y = Math.min(Math.max(normaal(HOOGTE / 2, CONFIG.dierMiddenSpreiding), ruimte[0]), ruimte[1]);
    const item = maakItem(y);
    const [boven, onder] = gebied(item);
    if (verboden.some(([vb, vo]) => overlapt(boven, onder, vb, vo))) continue;
    // Niet bovenop een ander dier van dezelfde soort in deze kolom
    if (bestaande.some((b) => b.type === item.type && overlapt(boven, onder, ...gebied(b)))) continue;
    return item;
  }
  return null;
}

export function maakKolom(doorgangen, snelheid) {
  const vorige = doorgangen[doorgangen.length - 1];
  const half = halveOpening();
  const recent = (doorgang) => [...doorgangen, doorgang].slice(-aantalKolommenVoorVis());

  for (let poging = 0; poging < 30; poging++) {
    const doorgang = kiesDoorgang(vorige, snelheid);
    const doorgangBoven = doorgang - half;
    const doorgangOnder = doorgang + half;
    const items = [];

    // Rots: vanaf de bodem, mag de doorgang niet raken
    if (Math.random() < CONFIG.kansRots) {
      const hoogte = rand(CONFIG.rotsMinHoogte, maxRandHoogte());
      if (HOOGTE - hoogte >= doorgangOnder) {
        items.push({ type: 'rots', breedte: CONFIG.rotsBreedte, hoogte, y: HOOGTE - hoogte / 2, amp: 0, kleur: CONFIG.rotsKleur });
      }
    }
    // Boot: vanaf de bovenkant
    if (Math.random() < CONFIG.kansBoot) {
      const hoogte = rand(CONFIG.bootMinHoogte, maxRandHoogte());
      if (hoogte <= doorgangBoven) {
        items.push({ type: 'boot', breedte: CONFIG.bootBreedte, hoogte, y: hoogte / 2, amp: 0, kleur: CONFIG.bootKleur });
      }
    }

    // Zeedieren
    const verbodenKolom = [[doorgangBoven, doorgangOnder]];
    const dieren = [];
    const aantal = randInt(CONFIG.minDieren, CONFIG.maxDieren);
    // Vissen blijven buiten het gebied van alle recente doorgangen
    const r = recent(doorgang);
    const verbodenVis = [[Math.min(...r) - half, Math.max(...r) + half]];

    for (let n = 0; n < aantal; n++) {
      let dier = null;
      if (Math.random() < CONFIG.octopusAandeel) {
        const hoogte = rand(CONFIG.octopusMinHoogte, CONFIG.octopusMaxHoogte);
        const amp = CONFIG.dobberHoogte;
        const fase = rand(0, Math.PI * 2);
        // Het hele dobbergebied moet binnen het scherm blijven
        dier = plaatsDier(
          (y) => ({ type: 'octopus', breedte: CONFIG.octopusBreedte, hoogte, y, amp, periode: CONFIG.dobberPeriode, fase, kleur: CONFIG.octopusKleur }),
          [amp + hoogte / 2, HOOGTE - amp - hoogte / 2], verbodenKolom, dieren
        );
      } else {
        const hoogte = rand(CONFIG.visMinHoogte, CONFIG.visMaxHoogte);
        dier = plaatsDier(
          (y) => ({ type: 'vis', breedte: CONFIG.visBreedte, hoogte, y, amp: 0, snelheidFactor: CONFIG.visSnelheidFactor, kleur: CONFIG.visKleur }),
          [hoogte / 2, HOOGTE - hoogte / 2], verbodenVis, dieren
        );
      }
      if (dier) dieren.push(dier);
    }

    items.push(...dieren);
    if (items.length > 0) return { items, doorgang };
  }
  return null;
}
