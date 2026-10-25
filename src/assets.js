// De lijst van alle afbeeldingen en geluiden die het spel laadt (door PreloadScene, voor het spel start).
//
// Zet de bestanden in:
//   public/assets/images   (afbeeldingen, bv. PNG)
//   public/assets/audio    (geluiden, bv. MP3 en/of OGG)
//
// en voeg hieronder een regel toe. De 'sleutel' is de naam waarmee je het bestand later in de code gebruikt
// (bv. this.add.image(x, y, 'duiker')). Staat een bestand in de lijst maar niet in de map, dan meldt het spel
// dat in de console en gaat het gewoon verder.
//
// Voorbeelden:
//   { sleutel: 'duiker', bestand: 'duiker.png' }
//   { sleutel: 'botsing', bestanden: ['botsing.ogg', 'botsing.mp3'] }   // meerdere formaten: de browser kiest

export const AFBEELDINGEN = [
  // { sleutel: 'duiker', bestand: 'duiker.png' },
];

export const GELUIDEN = [
  // { sleutel: 'botsing', bestanden: ['botsing.ogg', 'botsing.mp3'] },
];
