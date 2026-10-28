import { registerPlayer, submitScore } from './scoreService.js';

// Testfunctie: voegt 15 nepspelers met nepscores toe (zie 'testfunctieAan' in config.js).
// Sommige scores zijn van gisteren of eergisteren, zodat 'vandaag' en 'aller tijden' verschillen.
// Alles wat hier wordt aangemaakt krijgt in Firestore het veld test: true, zodat je testdata later
// makkelijk kunt herkennen en wissen. Een tweede keer op T drukken maakt geen dubbele spelers:
// het spelers-id hangt aan bedrijf en voornaam.

// [bedrijf, voornaam, [[score, dagen geleden], ...]]
const NEPSPELERS = [
  ['Café De Kroon', 'Leo', [[640, 0], [410, 0]]],
  ['Bar Louis', 'Emma', [[585, 0]]],
  ['Taverne De Zwaan', 'Pieter', [[720, 1], [350, 0]]],      // beste score was gisteren
  ["Brasserie 't Hoekske", 'Sofie', [[470, 0]]],
  ['Hotel Sint-Joris & Spa', 'Marc', [[515, 0]]],
  ['Bierhuis De Kleine Prins', 'An', [[390, 0], [455, 0]]],
  ['Grand Café Het Verzamelhuis van Leuven', 'Jan', [[300, 0]]],   // erg lange naam
  ['Pizzeria Roma', 'Giovanni', [[260, 0]]],
  ['Restaurant Het Geheime Tuinhuis', 'Lotte', [[610, 0]]],
  ["Lunchroom 't Witte Paard", 'Tom', [[205, 0]]],
  ['Eetcafé De Ontmoeting', 'Karen', [[880, 2]]],            // alleen eergisteren
  ['Horeca Groothandel Vandenberghe', 'Wim', [[430, 1]]],    // alleen gisteren
  ['The Irish Pub Dubliners', 'Niall', [[345, 0]]],
  ['Hof ter Linden', 'Els', [[155, 0]]],
  ['Brouwerij & Proeflokaal De Gouden Leeuw', 'Bartholomeus', [[560, 0]]],   // lange naam + voornaam
];

export async function voegTestspelersToe() {
  const nu = Date.now();
  // De spelers tegelijk (sneller bij trage wifi); de scores van één speler wel na elkaar
  await Promise.all(NEPSPELERS.map(async ([bedrijf, voornaam, scores]) => {
    const { id } = await registerPlayer({ bedrijf, voornaam, test: true });
    for (const [score, dagenGeleden] of scores) {
      // Een uur extra per dag terug, zodat 'gisteren' nooit per ongeluk 'vandaag' is
      const datum = nu - (dagenGeleden === 0 ? 0 : dagenGeleden * 24 + 1) * 3600e3;
      await submitScore(id, score, { datum, test: true });
    }
  }));
}
