// Alle instelbare waarden van het spel staan hier bij elkaar.

export const BREEDTE = 800;
export const HOOGTE = 450;

export const CONFIG = {
  // Duiker
  duikerSnelheid: 260,      // verticale snelheid (pixels per seconde)
  duikerBreedte: 40,
  duikerHoogte: 20,
  duikerPositieX: 0.2,      // 0.2 = 20% van links

  // Snelheid van de wereld (pixels per seconde)
  startSnelheid: 220,
  versnelling: 6,           // extra snelheid per seconde
  maxSnelheid: 800,

  // Tijd tussen twee 'kolommen' hindernissen bij startsnelheid (ms)
  hindernisInterval: 1400,

  // Eerlijkheid: in elke kolom is altijd een doorgang van minstens zoveel pixels hoog
  minimaleOpening: 150,
  // Hoe ver de doorgang tussen twee kolommen mag verschuiven, als fractie van wat
  // de duiker op dat moment kan halen (1 = precies genoeg, lager = makkelijker)
  bereikFactor: 0.5,

  // Kans per kolom op een rots / boot / zeedier (er is altijd minstens één van de drie)
  kansRots: 0.6,
  kansBoot: 0.6,
  kansDier: 0.7,
  // Van de zeedieren is dit het deel dat een octopus is (0.5 = half-half, 1 = alleen octopussen)
  octopusAandeel: 0.5,

  // Rotsen en boten nemen maximaal zoveel van de schermhoogte in (0.2 = 20%)
  maxRandHoogteFractie: 0.2,

  // Rotsen: steken omhoog vanaf de bodem
  rotsBreedte: 60,
  rotsMinHoogte: 60,
  rotsKleur: 0x808890,

  // Boten: hangen naar beneden vanaf de bovenkant
  bootBreedte: 90,
  bootMinHoogte: 50,
  bootKleur: 0x8b5a2b,

  // Octopus: beweegt mee met de achtergrond en dobbert op en neer
  octopusBreedte: 44,
  octopusMinHoogte: 36,
  octopusMaxHoogte: 56,
  octopusKleur: 0x9b4dca,
  dobberHoogte: 30,         // hoeveel pixels omhoog én omlaag
  dobberPeriode: 2500,      // ms voor één volledige golf

  // Vis: zwemt in een rechte lijn, sneller dan de achtergrond
  visBreedte: 56,
  visMinHoogte: 20,
  visMaxHoogte: 32,
  visKleur: 0xff8c1a,
  visSnelheidFactor: 1.6,   // 1.6 = 60% sneller dan de achtergrond

  // Score: pixels afgelegd per scorepunt (meter)
  pixelsPerMeter: 50,

  // Kleuren
  kleurAchtergrond: 0x0b1e4a,
  kleurDecor: 0x2a4a8c,
  kleurDuiker: 0xffe030,
};
