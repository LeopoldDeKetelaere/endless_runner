// Opslag van spelers en scores.
//
// NU: tijdelijk met localStorage in de browser.
// LATER: de binnenkant van deze functies wordt vervangen door Firebase. De rest van het
// spel gebruikt alleen de functies hieronder (allemaal async), dus daar verandert niets.
//
// Privacy: persoonsgegevens en scores staan APART opgeslagen.
// - Spelers (voornaam, achternaam, bedrijf, e-mail, telefoon, toestemmingen) staan onder één sleutel.
// - Scores bevatten alleen wat op het scorebord staat (bedrijf, voornaam, score, datum)
//   plus het spelers-id. Nooit e-mail, telefoonnummer of achternaam.

const SLEUTEL_SPELERS = 'duikersgame:spelers';
const SLEUTEL_SCORES = 'duikersgame:scores';
const TIJDZONE = 'Europe/Brussels';

// Noodopslag in het geheugen, voor als localStorage niet beschikbaar is
const geheugen = {};

function lees(sleutel, standaard) {
  try {
    const tekst = localStorage.getItem(sleutel);
    return tekst ? JSON.parse(tekst) : standaard;
  } catch {
    return geheugen[sleutel] ?? standaard;
  }
}

function schrijf(sleutel, waarde) {
  try {
    localStorage.setItem(sleutel, JSON.stringify(waarde));
  } catch {
    geheugen[sleutel] = waarde;
  }
}

// Datum van een tijdstip als 'JJJJ-MM-DD' in de tijdzone van Brussel
const dagFormaat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIJDZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const dagBrussel = (datum) => dagFormaat.format(new Date(datum));

function nieuwId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const normaliseerEmail = (email) => String(email ?? '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Spelers
// ---------------------------------------------------------------------------

// gegevens: { voornaam, achternaam, bedrijf, email, telefoon, toestemming, nieuwsbrief }
// - toestemming: mag deelnemen aan de wedstrijd (ja/nee)
// - nieuwsbrief: mogen we nieuws en aanbiedingen sturen (ja/nee)
// Geeft het spelers-id terug.
export async function registerPlayer(gegevens) {
  const voornaam = String(gegevens.voornaam ?? '').trim();
  const bedrijf = String(gegevens.bedrijf ?? '').trim();
  // Deze twee staan later op het scorebord, dus ze moeten er zijn
  if (!voornaam || !bedrijf) throw new Error('Voornaam en bedrijf zijn verplicht');

  const id = nieuwId();
  const nu = new Date().toISOString();
  const spelers = lees(SLEUTEL_SPELERS, {});
  spelers[id] = {
    voornaam,
    achternaam: String(gegevens.achternaam ?? '').trim(),
    bedrijf,
    email: normaliseerEmail(gegevens.email),
    telefoon: String(gegevens.telefoon ?? '').trim(),
    toestemming: gegevens.toestemming === true,
    nieuwsbrief: gegevens.nieuwsbrief === true,
    toestemmingTijdstip: nu,
    geregistreerd: nu,
  };
  schrijf(SLEUTEL_SPELERS, spelers);
  return id;
}

// Is dit e-mailadres al bekend? Dan geven we { id, voornaam } terug, anders null.
// (Er komen bewust geen andere persoonsgegevens mee terug.)
export async function findPlayerByEmail(email) {
  const gezocht = normaliseerEmail(email);
  if (!gezocht) return null;
  const spelers = lees(SLEUTEL_SPELERS, {});
  for (const [id, speler] of Object.entries(spelers)) {
    if (speler.email === gezocht) return { id, voornaam: speler.voornaam };
  }
  return null;
}

// Terugkerende speler: werk alleen de nieuwsbriefkeuze en het tijdstip daarvan bij.
// De andere gegevens blijven ongewijzigd, zodat de speler onder dezelfde naam op het scorebord blijft.
export async function updateNewsletterConsent(spelerId, nieuwsbrief) {
  const spelers = lees(SLEUTEL_SPELERS, {});
  if (!spelers[spelerId]) throw new Error('Onbekende speler');
  spelers[spelerId].nieuwsbrief = nieuwsbrief === true;
  spelers[spelerId].toestemmingTijdstip = new Date().toISOString();
  schrijf(SLEUTEL_SPELERS, spelers);
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

// Bewaar een score voor een speler. De optie 'datum' is alleen bedoeld voor testdata.
// Geeft de opgeslagen score terug.
export async function submitScore(spelerId, score, opties = {}) {
  const speler = lees(SLEUTEL_SPELERS, {})[spelerId];
  if (!speler) throw new Error('Onbekende speler');
  if (!Number.isFinite(score) || score < 0) throw new Error('Ongeldige score');

  // Alleen wat op het scorebord staat, plus het id
  const item = {
    spelerId,
    bedrijf: speler.bedrijf,
    voornaam: speler.voornaam,
    score: Math.floor(score),
    datum: new Date(opties.datum ?? Date.now()).toISOString(),
  };
  const scores = lees(SLEUTEL_SCORES, []);
  scores.push(item);
  schrijf(SLEUTEL_SCORES, scores);
  return item;
}

// Per speler alleen de beste score (bij gelijke score telt de oudste), hoogste eerst
function besteScoresPerSpeler(scores) {
  const beste = new Map();
  for (const s of scores) {
    const huidig = beste.get(s.spelerId);
    if (!huidig || s.score > huidig.score || (s.score === huidig.score && s.datum < huidig.datum)) {
      beste.set(s.spelerId, s);
    }
  }
  return [...beste.values()].sort((a, b) => b.score - a.score || a.datum.localeCompare(b.datum));
}

const scoresVanVandaag = () => {
  const vandaag = dagBrussel(Date.now());
  return lees(SLEUTEL_SCORES, []).filter((s) => dagBrussel(s.datum) === vandaag);
};

// Top van vandaag (dag in Brussel): [{ spelerId, bedrijf, voornaam, score, datum }]
export async function getTopScoresToday(aantal = 10) {
  return besteScoresPerSpeler(scoresVanVandaag()).slice(0, aantal);
}

// Top aller tijden
export async function getTopScoresAllTime(aantal = 10) {
  return besteScoresPerSpeler(lees(SLEUTEL_SCORES, [])).slice(0, aantal);
}

// Op welke plaats komt deze score op het scorebord? 1 = eerste.
// Geeft { vandaag, allTime } terug. Spelers tellen maar één keer mee (hun beste score).
export async function getRank(score) {
  const rang = (scores) => 1 + besteScoresPerSpeler(scores).filter((s) => s.score > score).length;
  return {
    vandaag: rang(scoresVanVandaag()),
    allTime: rang(lees(SLEUTEL_SCORES, [])),
  };
}
