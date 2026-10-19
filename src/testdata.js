import { registerPlayer, submitScore } from './scoreService.js';

// Testfunctie: voegt 15 nepspelers met nepscores toe (zie 'testfunctieAan' in config.js).
// Sommige scores zijn van gisteren of eergisteren, zodat 'vandaag' en 'aller tijden' verschillen.
// Ze hebben een e-mailadres op @test.invalid, zodat je ze later makkelijk herkent.

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
  for (const [bedrijf, voornaam, scores] of NEPSPELERS) {
    const id = await registerPlayer({
      voornaam, achternaam: 'Testpersoon', bedrijf,
      email: `${voornaam.toLowerCase()}@test.invalid`, telefoon: '0400 00 00 00', toestemming: true,
    });
    for (const [score, dagenGeleden] of scores) {
      // Een uur extra per dag terug, zodat 'gisteren' nooit per ongeluk 'vandaag' is
      const datum = nu - (dagenGeleden === 0 ? 0 : dagenGeleden * 24 + 1) * 3600e3;
      await submitScore(id, score, { datum });
    }
  }
}
