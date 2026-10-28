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
// Zwemanimatie van de duiker: zet genummerde beeldjes in public/assets/images, zonder gaten in de nummering:
//   duiker_01.png, duiker_02.png, duiker_03.png, ...        (in het spel; zelfde formaat als duiker.png)
//   duiker_groot_01.png, duiker_groot_02.png, ...           (optioneel: voor het startscherm)
// Die hoef je hier NIET in te vullen: het spel zoekt ze zelf. Zijn ze er, dan speelt de animatie af in
// plaats van de stilstaande afbeelding. Het tempo staat in config.js (duikerAnimatieFps).
//
// Voorbeelden:
//   { sleutel: 'duiker', bestand: 'duiker.png' }
//   { sleutel: 'botsing', bestanden: ['botsing.ogg', 'botsing.mp3'] }   // meerdere formaten: de browser kiest

export const AFBEELDINGEN = [
  { sleutel: 'duiker', bestand: 'duiker.png' },              // de duiker in het spel
  { sleutel: 'duiker_groot', bestand: 'duiker_groot.png' },  // de grote duiker op het startscherm
  // Beide worden gemaakt met:  npm run duiker  (uit assets-bron/duiker.png)
  { sleutel: 'octopus', bestand: 'octopus.png' },            // de octopus (alleen als hindernis in het spel)
  // De octopus wordt gemaakt met:  npm run octopus  (uit assets-bron/octopus.png)
  { sleutel: 'achtergrond', bestand: 'achtergrond.png' },    // de naadloze achtergrondstrook (1920x1080)
  // Wordt gemaakt met:  npm run achtergrond  (uit assets-bron/achtergrond.png)
];

export const GELUIDEN = [
  // { sleutel: 'botsing', bestanden: ['botsing.ogg', 'botsing.mp3'] },
];
