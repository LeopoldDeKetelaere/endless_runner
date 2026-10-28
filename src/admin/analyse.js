// Rekenwerk voor de adminpagina, zonder Firebase (zodat het los te testen is):
// deelnemers met statistieken, zoeken, sorteren, statistieken en winnaars.

import { vandaagBrussel, formatCsvDag } from './csv.js';
import { sorteerRegels } from './hulp.js';

// Een speler samen met zijn beste score en het aantal gespeelde spellen (uit het logboek 'games')
export function bouwDeelnemers(spelers, spellen) {
  const perSpeler = new Map();
  for (const spel of spellen) {
    const x = perSpeler.get(spel.spelerId) ?? { beste: null, aantal: 0 };
    x.aantal += 1;
    if (x.beste === null || spel.score > x.beste) x.beste = spel.score;
    perSpeler.set(spel.spelerId, x);
  }
  return spelers.map((speler) => ({
    ...speler,
    besteScore: perSpeler.get(speler.id)?.beste ?? null,
    aantalSpellen: perSpeler.get(speler.id)?.aantal ?? 0,
  }));
}

// Testdata (test: true) weglaten, tenzij 'metTest'
export const filterTest = (lijst, metTest) => (metTest ? lijst : lijst.filter((x) => x.test !== true));

// Tekst vergelijkbaar maken: kleine letters en zonder accenten ('Café' vindt 'cafe')
const normaal = (tekst) => String(tekst ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Zoeken op bedrijf of voornaam. Alle woorden die je typt moeten ergens voorkomen.
export function zoekDeelnemers(lijst, zoektekst) {
  const woorden = normaal(zoektekst).split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return lijst;
  return lijst.filter((d) => {
    const tekst = normaal(`${d.bedrijf} ${d.voornaam}`);
    return woorden.every((woord) => tekst.includes(woord));
  });
}

// Sorteren op een kolom. Lege waarden staan altijd onderaan.
export function sorteerDeelnemers(lijst, kolom, richting = 'asc') {
  const factor = richting === 'desc' ? -1 : 1;
  const sleutel = (d) => {
    const w = d[kolom];
    if (w instanceof Date) return w.getTime();
    if (typeof w === 'boolean') return w ? 1 : 0;
    return w;
  };
  return [...lijst].sort((a, b) => {
    const x = sleutel(a), y = sleutel(b);
    const xLeeg = x === null || x === undefined || x === '', yLeeg = y === null || y === undefined || y === '';
    if (xLeeg || yLeeg) return xLeeg === yLeeg ? 0 : xLeeg ? 1 : -1;
    if (typeof x === 'number' && typeof y === 'number') return factor * (x - y);
    return factor * String(x).localeCompare(String(y), 'nl', { sensitivity: 'base' });
  });
}

// ---------------------------------------------------------------------------
// Statistieken
// ---------------------------------------------------------------------------
const dagFormaat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
const dagVan = (datum) => (datum ? dagFormaat.format(datum) : null);

const gemiddelde = (scores) => (scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null);
const hoogste = (scores) => (scores.length ? Math.max(...scores) : null);

// Aantallen per dag en in totaal
export function berekenStatistieken(spelers, spellen, metTest = false) {
  const s = filterTest(spelers, metTest);
  const g = filterTest(spellen, metTest);
  const scores = g.map((x) => x.score);

  const dagen = new Map(); // dag -> { registraties, scores: [] }
  const dag = (d) => { if (!dagen.has(d)) dagen.set(d, { registraties: 0, scores: [] }); return dagen.get(d); };
  for (const speler of s) { const d = dagVan(speler.aangemaaktOp); if (d) dag(d).registraties += 1; }
  for (const spel of g) { if (spel.dag) dag(spel.dag).scores.push(spel.score); }

  return {
    registraties: s.length,
    spellen: g.length,
    gemiddelde: gemiddelde(scores),
    hoogste: hoogste(scores),
    perDag: [...dagen.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, x]) => ({
      dag: d, registraties: x.registraties, spellen: x.scores.length, gemiddelde: gemiddelde(x.scores), hoogste: hoogste(x.scores),
    })),
  };
}

// ---------------------------------------------------------------------------
// Winnaars
// ---------------------------------------------------------------------------

// De top 3 van de algemene lijst en van elke dag (bedrijf, voornaam, score en tijdstip).
// algemeen: [{ id, bedrijf, voornaam, score, tijdstip, test }]; dagen: [{ dag, regels }]
export function bepaalWinnaars({ algemeen, dagen, metTest = false }) {
  const top3 = (regels, klassement) => sorteerRegels(filterTest(regels, metTest)).slice(0, 3).map((r, i) => ({
    klassement,
    plaats: i + 1,
    id: r.id,
    bedrijf: r.bedrijf,
    voornaam: r.voornaam,
    score: r.score,
    tijdstip: r.tijdstip,
    test: r.test === true,
  }));
  return {
    algemeen: top3(algemeen, 'Algemeen'),
    perDag: dagen
      .map(({ dag, regels }) => ({ dag, winnaars: top3(regels, `Dag ${formatCsvDag(dag)}`) }))
      .filter((d) => d.winnaars.length > 0),
  };
}

// Alle winnaars (algemeen en per dag) als één lijst voor de CSV
export const winnaarsAlsLijst = (winnaars) => [...winnaars.algemeen, ...winnaars.perDag.flatMap((d) => d.winnaars)];

// Spellen met bedrijf en voornaam erbij, voor de CSV (spelers die verwijderd zijn, hebben ook geen spellen meer)
export function spellenMetNaam(spellen, spelers, metTest = false) {
  const perId = new Map(spelers.map((s) => [s.id, s]));
  return filterTest(spellen, metTest)
    .map((spel) => ({ ...spel, bedrijf: perId.get(spel.spelerId)?.bedrijf ?? '', voornaam: perId.get(spel.spelerId)?.voornaam ?? '' }))
    .sort((a, b) => (a.gespeeldOp?.getTime() ?? 0) - (b.gespeeldOp?.getTime() ?? 0));
}

export { vandaagBrussel };
