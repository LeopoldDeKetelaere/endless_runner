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
  maxVoornaamTekens: 20,                // maximale lengte van de voornaam
  registratieInactiviteitSeconden: 30,  // zonder toets: alles wissen en terug naar het startscherm
  gameOverSeconden: 30,                 // na zoveel seconden gaat het game-over-scherm vanzelf naar het scorebord
  welkomTerugSeconden: 2,               // hoe lang 'WELKOM TERUG' blijft staan

  // Adminpagina (/admin): automatisch uitloggen na zoveel minuten zonder activiteit
  adminInactiviteitMinuten: 30,

  // Duiker
  duikerSnelheid: 624,      // verticale snelheid (pixels per seconde)
  duikerBreedte: 230,       // breedte van de duiker op het scherm (pixels); de hoogte volgt uit de afbeelding
  duikerPositieX: 0.2,      // 0.2 = 20% van links
  kleurDuiker: 0xffe030,    // blokje dat getoond wordt als de afbeelding ontbreekt

  // Duiker: levendig, zonder extra beeldjes
  duikerDeinHoogte: 9,         // hoeveel pixels hij rustig op en neer deint
  duikerDeinPeriode: 2600,     // ms voor één keer op en neer
  duikerKantelHoek: 8,         // hoeveel graden hij kantelt als hij omhoog of omlaag stuurt
  duikerKantelSnelheid: 9,     // hoe snel hij kantelt en terugdraait (hoger = sneller)
  duikerBubbelInterval: [2500, 5500],  // ms tussen twee bubbelstoten (willekeurig tussen deze twee)
  duikerBubbelsPerStoot: [2, 4],       // aantal bubbels per stoot (willekeurig tussen deze twee)
  duikerBubbelPunt: { x: 0.77, y: 0.04 },  // waar de bubbels uit de helm komen (fractie van de afbeelding)
  duikerBubbelRadius: [6, 14], // grootte van een bubbel in pixels (straal, willekeurig tussen deze twee)

  // Zwemanimatie: staan er bestanden duiker_01.png, duiker_02.png, ... in public/assets/images,
  // dan speelt die animatie af in plaats van de stilstaande afbeelding (zie assets.js).
  duikerAnimatieFps: 10,       // beeldjes per seconde

  // Grote duiker op het startscherm: zwemt langzaam heen en weer boven het scorebord
  startDuikerBreedte: 420,     // pixels
  startDuikerSnelheid: 140,    // pixels per seconde

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

  // Octopus: beweegt mee met de achtergrond en dobbert op en neer.
  // De afbeelding (octopus.png) wordt gemaakt met: npm run octopus (uit assets-bron/octopus.png).
  octopusBreedte: 200,      // breedte van een gemiddelde octopus (pixels); zet dezelfde waarde in scripts/maak-octopus.mjs
  octopusVerhouding: 0.845, // hoogte / breedte van de afbeelding (het script meldt dit getal)
  octopusKleur: 0x9b4dca,   // blokje dat getoond wordt als de afbeelding ontbreekt
  octopusGrootte: [0.9, 1.1],  // willekeurige grootte per octopus (90% tot 110%)
  dobberHoogte: 72,         // hoeveel pixels omhoog én omlaag
  dobberPeriode: 2500,      // ms voor één volledige golf
  // Levendig, zonder extra beeldjes
  octopusPomp: 0.05,        // pompbeweging: zoveel (0.05 = 5%) breder en lager, dan smaller en hoger
  octopusPompPeriode: 1400, // ms voor één pomp
  octopusWiegHoek: 3,       // wiegbeweging: zoveel graden naar links en naar rechts
  octopusWiegPeriode: 3800, // ms voor één wieg

  // Vis: zwemt in een rechte lijn, sneller dan de achtergrond
  // De afbeelding (vis.png) wordt gemaakt met: npm run vis (uit assets-bron/vis.png).
  visBreedte: 220,          // breedte van een gemiddelde vis (pixels); zet dezelfde waarde in scripts/maak-vis.mjs
  visVerhouding: 0.282,     // hoogte / breedte van de afbeelding (het script meldt dit getal)
  visKleur: 0xff8c1a,       // blokje dat getoond wordt als de afbeelding ontbreekt
  visGrootte: [0.9, 1.1],   // willekeurige grootte per vis (90% tot 110%)
  visWiegHoek: 4,           // lichte, snelle golfbeweging: zoveel graden naar links en rechts
  visWiegPeriode: 450,      // ms voor één wieg
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
    // De duiker: alleen de romp en de helm tellen. De uitgestrekte arm met het glas, de vrije hand en
    // de voeten tellen niet mee. (Bekijk het met toets H en debugHitboxes: true.)
    duiker: { breedte: 0.38, hoogte: 0.69, x: 0.19, y: -0.12 },
    rots: { breedte: 1, hoogte: 1, x: 0, y: 0 },
    boot: { breedte: 1, hoogte: 1, x: 0, y: 0 },
    // De octopus heeft een CIRKEL rond de kop en het midden van het lichaam; de tentakels tellen niet mee.
    //   straal: als fractie van de breedte van de octopus; x: als fractie van de breedte, y: als fractie van de hoogte
    //   (verschuiving van het midden van de cirkel ten opzichte van het midden van de afbeelding).
    // Hij schaalt mee met de grootte van de octopus. Voor de doorgang telt de hele zichtbare octopus (met tentakels).
    octopus: { straal: 0.25, x: 0.085, y: -0.14 },
    // De vis: een rechthoek rond kop en lichaam; de dunne staart en de vinnen tellen niet mee.
    // Hij schaalt mee met de grootte van de vis. Voor de doorgang telt de hele zichtbare vis.
    vis: { breedte: 0.52, hoogte: 0.8, x: -0.238, y: 0.03 },
  },

  // Score: pixels afgelegd per scorepunt (meter)
  pixelsPerMeter: 120,

  // Kleuren
  kleurAchtergrond: 0x0b1e4a,   // effen kleur achter alles (en in de menuschermen het donkere vlak)

  // Achtergrond: de naadloze textuur (npm run achtergrond), eindeloos scrollend naar links
  achtergrond: {
    aan: true,
    // Hoofdlaag. De snelheden zijn een fractie van de spelsnelheid (0.25 = een kwart), dus de achtergrond versnelt mee.
    hoofdSnelheid: 0.25,
    hoofdAlpha: 1,
    // Tweede laag voor diepte: dezelfde textuur, groter, half doorzichtig en trager
    laag2Aan: true,
    laag2Schaal: 1.5,
    laag2Alpha: 0.5,
    laag2Snelheid: 0.12,
    laag2Start: 700,        // beginpositie (pixels van de afbeelding), zodat de vlekken niet over elkaar liggen
    // Kleurverloop erover: bovenaan lichter, onderaan donkerder blauw (zet verloopAan op false om te vergelijken)
    verloopAan: true,
    verloopBoven: 0x3b78b8, verloopBovenAlpha: 0.4,
    verloopOnder: 0x061838, verloopOnderAlpha: 0.72,
    // Menuschermen (start, inloggen, registratie, game over): stilstaand of heel traag
    menuSnelheid: 20,       // pixels per seconde (0 = stilstaand)
    menuVeilAlpha: 0.35,    // donker, half doorzichtig vlak over de achtergrond, voor leesbare tekst (0 = geen)
  },

  // Bubbels in het spel: doorschijnend wit met een dun, donkerder randje
  bubbelKleur: 0xffffff,
  bubbelAlpha: 0.35,
  bubbelRandKleur: 0x1c3a6e,
  bubbelRandAlpha: 0.9,
};
