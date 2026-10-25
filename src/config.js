// Alle instelbare waarden van het spel staan hier bij elkaar.
//
// Het spel is 1920x1080 pixels (16:9) en schaalt mee met het scherm. Alle maten, snelheden en
// afstanden hieronder zijn omgerekend uit het oude formaat van 800x450: alles x 2,4 (SCHAAL).
// Daardoor voelt het spel precies even moeilijk aan. Tijden (ms, seconden) en verhoudingen
// (kansen, fracties) zijn niet veranderd.

export const BREEDTE = 1920;
export const HOOGTE = 1080;

// Het oude ontwerp was 800 breed. Zo rekenen we maten uit dat ontwerp om naar het huidige formaat:
// px(16) = 38,4 pixels. Wordt gebruikt voor tekstgroottes en posities in de scènes.
export const SCHAAL = BREEDTE / 800;
export const px = (maat) => maat * SCHAAL;

// De HTML-formulieren (inloggen, registratie, uitloggen) zijn ontworpen op 800x450 en worden
// door de code over het spel heen geschaald. Dit is dus NIET de breedte van het spel.
export const OVERLAY_BREEDTE = 800;

export const CONFIG = {
  // Startscherm en scorebord
  spelTitel: 'DUIKER SWIM MANIA',
  topAantal: 10,                // aantal regels per top
  scorebordLettergrootte: 21.6, // in pixels van het 1920x1080 spelscherm (was 9 op 800x450)
  // Testfunctie: toets T voegt 15 nepspelers met nepscores toe.
  // ZET OP false VOOR HET EVENT!
  testfunctieAan: true,

  // Debug: met toets H worden de hitboxen als gekleurde kaders getoond (alleen als dit aan staat).
  // Zet dit op false voor het event.
  debugHitboxes: false,

  // Registratie
  maxBedrijfTekens: 40,                 // maximale lengte van het bedrijf / de horecazaak
  registratieInactiviteitSeconden: 30,  // zonder toets: alles wissen en terug naar het startscherm
  gameOverSeconden: 30,                 // na zoveel seconden gaat het game-over-scherm vanzelf naar het scorebord
  welkomTerugSeconden: 2,               // hoe lang 'WELKOM TERUG' blijft staan

  // Adminpagina (/admin): automatisch uitloggen na zoveel minuten zonder activiteit
  adminInactiviteitMinuten: 30,

  // Duiker
  duikerSnelheid: 624,      // verticale snelheid (pixels per seconde)
  duikerBreedte: 96,
  duikerHoogte: 48,
  duikerPositieX: 0.2,      // 0.2 = 20% van links

  // Levens
  levens: 3,                // aantal levens bij de start
  bevestigVertraging: 400,  // ms na een verloren leven voordat spatie/tik telt
  countdownSeconden: 3,     // countdown (3 - 2 - 1) na het verliezen van een leven
  onkwetsbaarSeconden: 3,   // onkwetsbaar na de countdown (de duiker knippert)
  knipperInterval: 120,     // ms per knipper-stap tijdens het onkwetsbaar zijn

  // Snelheid van de wereld (pixels per seconde)
  startSnelheid: 528,
  versnelling: 14.4,        // extra snelheid per seconde
  maxSnelheid: 1920,

  // Tijd tussen twee 'kolommen' hindernissen bij startsnelheid (ms)
  hindernisInterval: 1400,

  // Eerlijkheid: in elke kolom is altijd een doorgang van minstens zoveel pixels hoog
  minimaleOpening: 360,
  // Hoe ver de doorgang tussen twee kolommen mag verschuiven, als fractie van wat
  // de duiker op dat moment kan halen (1 = precies genoeg, lager = makkelijker)
  bereikFactor: 0.5,

  // Kans per kolom op een rots of een boot. Rotsen en boten wisselen elkaar altijd af,
  // dus er zijn precies evenveel van allebei (5 en 5 per 10).
  kansRotsOfBoot: 0.4,
  // Aantal zeedieren per kolom (willekeurig tussen min en max). Octopussen en vissen
  // wisselen elkaar ook af, dus evenveel van allebei.
  minDieren: 1,
  maxDieren: 3,
  // De vrije doorgang zwerft over het hele scherm naar een willekeurig doel.
  // Kans per kolom dat hij een nieuw doel kiest (hoger = onrustiger)
  doorgangNieuwDoel: 0.25,

  // Rotsen en boten nemen maximaal zoveel van de schermhoogte in (0.2 = 20%)
  maxRandHoogteFractie: 0.2,

  // Rotsen: steken omhoog vanaf de bodem
  rotsBreedte: 144,
  rotsMinHoogte: 144,
  rotsKleur: 0x808890,

  // Boten: hangen naar beneden vanaf de bovenkant
  bootBreedte: 216,
  bootMinHoogte: 120,
  bootKleur: 0x8b5a2b,

  // Octopus: beweegt mee met de achtergrond en dobbert op en neer
  octopusBreedte: 105.6,
  octopusMinHoogte: 86.4,
  octopusMaxHoogte: 134.4,
  octopusKleur: 0x9b4dca,
  dobberHoogte: 72,         // hoeveel pixels omhoog én omlaag
  dobberPeriode: 2500,      // ms voor één volledige golf

  // Vis: zwemt in een rechte lijn, sneller dan de achtergrond
  visBreedte: 134.4,
  visMinHoogte: 48,
  visMaxHoogte: 76.8,
  visKleur: 0xff8c1a,
  visSnelheidFactor: 1.6,   // 1.6 = 60% sneller dan de achtergrond

  // Hitboxen: het deel van een afbeelding dat telt bij een botsing. Los van het uiterlijk, zodat
  // je met mooie afbeeldingen toch eerlijke botsingen houdt (bv. de rand van een rots mag raken
  // zonder dat het meteen een botsing is). Alle waarden zijn FRACTIES van de afmeting van het
  // object zelf, want hindernissen hebben wisselende hoogtes:
  //   breedte, hoogte: 1 = even groot als de afbeelding, 0.8 = 80%
  //   x, y: verschuiving van het midden van de hitbox, in fracties van de afbeelding
  //         (x positief = naar rechts, y positief = naar beneden; 0 = gecentreerd)
  // Tip: houd de hitbox niet groter dan de afbeelding. Het spel houdt altijd rekening met de
  // hitbox bij het vrijhouden van een doorgang, maar een kleinere hitbox voelt eerlijker.
  hitbox: {
    duiker: { breedte: 1, hoogte: 1, x: 0, y: 0 },
    rots: { breedte: 1, hoogte: 1, x: 0, y: 0 },
    boot: { breedte: 1, hoogte: 1, x: 0, y: 0 },
    octopus: { breedte: 1, hoogte: 1, x: 0, y: 0 },
    vis: { breedte: 1, hoogte: 1, x: 0, y: 0 },
  },

  // Score: pixels afgelegd per scorepunt (meter)
  pixelsPerMeter: 120,

  // Kleuren
  kleurAchtergrond: 0x0b1e4a,
  kleurDecor: 0x2a4a8c,
  kleurDuiker: 0xffe030,
};
