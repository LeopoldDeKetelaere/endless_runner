import { BREEDTE, HOOGTE, CONFIG } from './config.js';

// Maakt 'kolommen' hindernissen (rots, boot, octopussen en/of vissen) en
// garandeert dat er in elke kolom een doorgang overblijft.
//
// Gebruik:
//   const toestand = nieuweToestand();         // één keer bij de start van een spel
//   const kolom = maakKolom(toestand, snelheid);  // daarna bij elke nieuwe kolom
// Resultaat: { items: [{ type, breedte, hoogte, y, kleur, ... }], doorgang } of null
// (null = geen eerlijke kolom gevonden, sla deze keer gewoon over).
//
// Hoe de eerlijkheid werkt:
// 1. We kiezen EERST de doorgang: een vrije strook van minimaleOpening pixels hoog,
//    die haalbaar is vanaf de vorige doorgang. Hij zwerft heen en weer tussen boven, midden en onder.
// 2. Daarna plaatsen we alles eromheen. Niets mag de strook raken. Voor een octopus
//    telt het hele gebied waar hij op en neer dobbert.
// 3. Een vis is sneller dan de achtergrond en kan over eerdere kolommen heen
//    zwemmen. Daarom blijft hij ook buiten de doorgangen van de recente kolommen.
//
// Hoe de verdeling gelijk blijft:
// - Rotsen en boten komen in paren: na een rots volgt de volgende keer een boot
//   en andersom. Zo staan ze altijd gelijk (hooguit 1 verschil tussendoor).
// - Octopussen en vissen werken precies zo.
// - Zeedieren staan overal op het scherm, behalve in de doorgang zelf.

// De doorgang zwerft tussen zoveel hoogtes (3 = boven, midden, onder)
const DOORGANG_ZONES = 3;

// Het scherm is verdeeld in zoveel horizontale banen voor de verdeling van de dieren
const AANTAL_BANEN = 6;

export function nieuweToestand() {
  return {
    doorgangen: [HOOGTE / 2], // midden van de laatste doorgangen (nieuwste laatst)
    doel: HOOGTE / 2,         // waar de doorgang naartoe zwerft
    rotsMinBoot: 0,           // aantal rotsen min aantal boten
    octopusMinVis: 0,         // aantal octopussen min aantal vissen
    // Hoeveel dieren er al in elke horizontale baan van het scherm zaten, per soort.
    // Zo kiezen we steeds de minst gebruikte baan en komen ze overal even vaak voor.
    banen: { octopus: Array(AANTAL_BANEN).fill(0), vis: Array(AANTAL_BANEN).fill(0) },
  };
}

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const klem = (x, min, max) => Math.min(Math.max(x, min), max);

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

// Kies de doorgang voor deze kolom. Hij zwerft naar een willekeurig doel (boven, midden
// of onder), maar nooit verder dan de duiker kan halen.
function kiesDoorgang(toestand, snelheid) {
  const vorige = toestand.doorgangen[toestand.doorgangen.length - 1];
  if (Math.abs(toestand.doel - vorige) < 5 || Math.random() < CONFIG.doorgangNieuwDoel) {
    // Doel: willekeurig boven, midden of onder (met een beetje spreiding). Zo is de
    // doorgang ongeveer even vaak op elke hoogte en blijft het midden niet altijd vrij.
    const zone = randInt(0, DOORGANG_ZONES - 1);
    const minY = halveOpening();
    const maxY = HOOGTE - halveOpening();
    const midden = minY + (maxY - minY) * zone / (DOORGANG_ZONES - 1);
    toestand.doel = klem(midden + rand(-20, 20), minY, maxY);
  }
  const verschuiving = maxVerschuiving(snelheid);
  return vorige + klem(toestand.doel - vorige, -verschuiving, verschuiving);
}

// Wie is er aan de beurt? Degene met de minste, bij gelijkstand willekeurig.
// Geeft true voor de 'eerste' soort (verschil <= 0), false voor de tweede.
function eersteIsAanDeBeurt(verschil) {
  if (verschil === 0) return Math.random() < 0.5;
  return verschil < 0;
}

// Overlapt het gebied [boven, onder] met een ander gebied?
const overlapt = (b1, o1, b2, o2) => b1 < o2 && o1 > b2;

// Gebied (boven, onder) dat een item inneemt, inclusief dobberen
const gebied = (i) => [i.y - i.amp - i.hoogte / 2, i.y + i.amp + i.hoogte / 2];

// Zet een dier neer dat 'verboden' gebieden vermijdt. We proberen eerst de baan van het
// scherm waar van deze soort tot nu toe het minste zaten, en zo verder. Zo komen de dieren
// over het hele scherm even vaak voor (voor zover de doorgang dat toelaat).
// maakItem(y) levert het item; ruimte is [minY, maxY]; tellers is de baan-teller van de soort.
function plaatsDier(maakItem, ruimte, verboden, bestaande, tellers) {
  const baanHoogte = HOOGTE / AANTAL_BANEN;
  // Banen van minst naar meest gebruikt (bij gelijkstand willekeurig)
  const volgorde = tellers
    .map((aantal, baan) => ({ baan, aantal, lot: Math.random() }))
    .sort((a, b) => a.aantal - b.aantal || a.lot - b.lot);

  for (const { baan } of volgorde) {
    const van = Math.max(ruimte[0], baan * baanHoogte);
    const tot = Math.min(ruimte[1], (baan + 1) * baanHoogte);
    if (van > tot) continue;
    for (let poging = 0; poging < 6; poging++) {
      const item = maakItem(rand(van, tot));
      const [boven, onder] = gebied(item);
      if (verboden.some(([vb, vo]) => overlapt(boven, onder, vb, vo))) continue;
      // Niet bovenop een ander dier van dezelfde soort in deze kolom
      if (bestaande.some((b) => b.type === item.type && overlapt(boven, onder, ...gebied(b)))) continue;
      tellers[baan]++;
      return item;
    }
  }
  return null;
}

export function maakKolom(toestand, snelheid) {
  const half = halveOpening();

  for (let poging = 0; poging < 30; poging++) {
    const doorgang = kiesDoorgang(toestand, snelheid);
    const doorgangBoven = doorgang - half;
    const doorgangOnder = doorgang + half;
    const items = [];
    let rotsMinBoot = toestand.rotsMinBoot;
    let octopusMinVis = toestand.octopusMinVis;

    // Rots of boot (om en om). Past de aan de beurt zijnde soort niet, dan slaan we over.
    if (Math.random() < CONFIG.kansRotsOfBoot) {
      if (eersteIsAanDeBeurt(rotsMinBoot)) {
        // Rots: vanaf de bodem, mag de doorgang niet raken
        const maxHoogte = Math.min(maxRandHoogte(), HOOGTE - doorgangOnder);
        if (maxHoogte >= CONFIG.rotsMinHoogte) {
          const hoogte = rand(CONFIG.rotsMinHoogte, maxHoogte);
          items.push({ type: 'rots', breedte: CONFIG.rotsBreedte, hoogte, y: HOOGTE - hoogte / 2, amp: 0, kleur: CONFIG.rotsKleur });
          rotsMinBoot++;
        }
      } else {
        // Boot: vanaf de bovenkant
        const maxHoogte = Math.min(maxRandHoogte(), doorgangBoven);
        if (maxHoogte >= CONFIG.bootMinHoogte) {
          const hoogte = rand(CONFIG.bootMinHoogte, maxHoogte);
          items.push({ type: 'boot', breedte: CONFIG.bootBreedte, hoogte, y: hoogte / 2, amp: 0, kleur: CONFIG.bootKleur });
          rotsMinBoot--;
        }
      }
    }

    // Zeedieren (om en om octopus en vis)
    const verbodenKolom = [[doorgangBoven, doorgangOnder]];
    // Vissen blijven buiten het gebied van alle recente doorgangen
    const recent = [...toestand.doorgangen, doorgang].slice(-aantalKolommenVoorVis());
    const verbodenVis = [[Math.min(...recent) - half, Math.max(...recent) + half]];
    const dieren = [];
    const aantal = randInt(CONFIG.minDieren, CONFIG.maxDieren);

    for (let n = 0; n < aantal; n++) {
      let dier;
      if (eersteIsAanDeBeurt(octopusMinVis)) {
        const hoogte = rand(CONFIG.octopusMinHoogte, CONFIG.octopusMaxHoogte);
        const amp = CONFIG.dobberHoogte;
        const fase = rand(0, Math.PI * 2);
        // Het hele dobbergebied moet binnen het scherm blijven
        dier = plaatsDier(
          (y) => ({ type: 'octopus', breedte: CONFIG.octopusBreedte, hoogte, y, amp, periode: CONFIG.dobberPeriode, fase, kleur: CONFIG.octopusKleur }),
          [amp + hoogte / 2, HOOGTE - amp - hoogte / 2], verbodenKolom, dieren, toestand.banen.octopus
        );
        if (dier) octopusMinVis++;
      } else {
        const hoogte = rand(CONFIG.visMinHoogte, CONFIG.visMaxHoogte);
        dier = plaatsDier(
          (y) => ({ type: 'vis', breedte: CONFIG.visBreedte, hoogte, y, amp: 0, snelheidFactor: CONFIG.visSnelheidFactor, kleur: CONFIG.visKleur }),
          [hoogte / 2, HOOGTE - hoogte / 2], verbodenVis, dieren, toestand.banen.vis
        );
        if (dier) octopusMinVis--;
      }
      if (dier) dieren.push(dier);
    }
    items.push(...dieren);

    if (items.length > 0) {
      // Pas nu bewaren: alleen een kolom die we echt gebruiken telt mee
      toestand.rotsMinBoot = rotsMinBoot;
      toestand.octopusMinVis = octopusMinVis;
      toestand.doorgangen.push(doorgang);
      if (toestand.doorgangen.length > 10) toestand.doorgangen.shift();
      return { items, doorgang };
    }
  }
  return null;
}
