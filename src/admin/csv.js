// CSV-bestanden die goed openen in een Belgische versie van Excel:
// - puntkomma als scheidingsteken (komma is in Belgisch Excel het decimaalteken)
// - UTF-8 met BOM, zodat accenten (é, ë, ç) goed getoond worden
// - Windows-regeleinden (CRLF)
// - datums en tijden leesbaar in Belgische tijd: 24/10/2026 14:35
// - tekst die met = + - @ begint, krijgt een apostrof ervoor, zodat Excel er nooit een formule van maakt

const BOM = String.fromCharCode(0xFEFF); // het "byte order mark" dat Excel vertelt dat het bestand UTF-8 is

const tijdFormaat = new Intl.DateTimeFormat('nl-BE', {
  timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// '24/10/2026 14:35' in Belgische tijd (zonder komma, anders is het in een CSV lastig)
export function formatDatumTijd(datum) {
  if (!datum) return '';
  const delen = Object.fromEntries(tijdFormaat.formatToParts(datum).map((d) => [d.type, d.value]));
  return `${delen.day}/${delen.month}/${delen.year} ${delen.hour}:${delen.minute}`;
}

// '2026-10-24' als '24/10/2026'
export const formatCsvDag = (dag) => (dag ? dag.split('-').reverse().join('/') : '');

// De datum van vandaag in Brussel als '2026-11-15', voor in de bestandsnaam
const dagFormaat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
export const vandaagBrussel = (nu = new Date()) => dagFormaat.format(nu);

// deelnemers_2026-11-15.csv
export const bestandsnaam = (soort, datum = vandaagBrussel()) => `${soort}_${datum}.csv`;

// Eén cel
function cel(waarde) {
  let tekst;
  if (waarde === null || waarde === undefined) tekst = '';
  else if (typeof waarde === 'boolean') tekst = waarde ? 'ja' : 'nee';
  else if (waarde instanceof Date) tekst = formatDatumTijd(waarde);
  else tekst = String(waarde);

  if (typeof waarde === 'string' && /^[=+\-@\t\r]/.test(tekst)) {
    tekst = `'${tekst}`; // beschermt tegen formules (CSV-injectie)
  }
  // Tussen aanhalingstekens als er een puntkomma, aanhalingsteken of regeleinde in staat
  return /[;"\r\n]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

// kolommen: [{ kop, waarde: (rij) => ... }], rijen: lijst objecten
export function maakCsv(kolommen, rijen) {
  const kop = kolommen.map((k) => cel(k.kop)).join(';');
  const regels = rijen.map((rij) => kolommen.map((k) => cel(k.waarde(rij))).join(';'));
  return BOM + [kop, ...regels].join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// De drie soorten bestanden
// ---------------------------------------------------------------------------

// Alle velden van een speler, plus beste score en aantal spellen
export const KOLOMMEN_DEELNEMERS = [
  { kop: 'Bedrijf / horecazaak', waarde: (r) => r.bedrijf },
  { kop: 'Voornaam', waarde: (r) => r.voornaam },
  { kop: 'Geregistreerd op', waarde: (r) => r.aangemaaktOp },
  { kop: 'Beste score', waarde: (r) => r.besteScore },
  { kop: 'Aantal spellen', waarde: (r) => r.aantalSpellen },
  { kop: 'Testdata', waarde: (r) => r.test === true },
];

// Elk gespeeld spel (bedrijf en voornaam komen uit de speler)
export const KOLOMMEN_SPELLEN = [
  { kop: 'Bedrijf / horecazaak', waarde: (r) => r.bedrijf },
  { kop: 'Voornaam', waarde: (r) => r.voornaam },
  { kop: 'Score', waarde: (r) => r.score },
  { kop: 'Dag', waarde: (r) => formatCsvDag(r.dag) },
  { kop: 'Tijdstip', waarde: (r) => r.gespeeldOp },
  { kop: 'Testdata', waarde: (r) => r.test === true },
];

// De winnaars: de top 3 per dag en algemeen
export const KOLOMMEN_WINNAARS = [
  { kop: 'Klassement', waarde: (r) => r.klassement },
  { kop: 'Plaats', waarde: (r) => r.plaats },
  { kop: 'Bedrijf / horecazaak', waarde: (r) => r.bedrijf },
  { kop: 'Voornaam', waarde: (r) => r.voornaam },
  { kop: 'Score', waarde: (r) => r.score },
  { kop: 'Tijdstip', waarde: (r) => r.tijdstip },
  { kop: 'Testdata', waarde: (r) => r.test === true },
];
