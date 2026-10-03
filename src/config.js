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

  // Hindernissen
  hindernisInterval: 1400,  // ms tussen hindernissen bij startsnelheid
  hindernisBreedte: 36,
  hindernisMinHoogte: 40,
  hindernisMaxHoogte: 160,

  // Score: pixels afgelegd per scorepunt (meter)
  pixelsPerMeter: 50,

  // Kleuren
  kleurAchtergrond: 0x0b1e4a,
  kleurDecor: 0x2a4a8c,
  kleurDuiker: 0xffe030,
  kleurHindernis: 0xe02424,
};
