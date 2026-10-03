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

  // Kans dat een type in een kolom voorkomt (er is altijd minstens één type)
  kansRots: 0.6,
  kansBoot: 0.6,
  kansRood: 0.5,

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

  // Rode hindernissen: zweven op willekeurige hoogte
  roodBreedte: 36,
  roodMinHoogte: 40,
  roodMaxHoogte: 160,
  roodKleur: 0xe02424,

  // Score: pixels afgelegd per scorepunt (meter)
  pixelsPerMeter: 50,

  // Kleuren
  kleurAchtergrond: 0x0b1e4a,
  kleurDecor: 0x2a4a8c,
  kleurDuiker: 0xffe030,
};
