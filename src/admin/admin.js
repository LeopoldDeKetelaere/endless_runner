import './admin.css';
import { onAuthStateChanged } from 'firebase/auth';
import { CONFIG } from '../config.js';
import { firebaseGeconfigureerd, auth, logIn, logOut } from './firebaseAdmin.js';
import * as gegevens from './gegevens.js';
import { formatTijdstip, formatDag } from './hulp.js';
import {
  bouwDeelnemers, filterTest, zoekDeelnemers, sorteerDeelnemers, berekenStatistieken,
  bepaalWinnaars, winnaarsAlsLijst, spellenMetNaam,
} from './analyse.js';
import {
  maakCsv, bestandsnaam, KOLOMMEN_DEELNEMERS, KOLOMMEN_SPELLEN, KOLOMMEN_WINNAARS,
} from './csv.js';

// De adminpagina (/admin). Los van het spel: het spel linkt nergens naar deze pagina.
// Alle tekst van gebruikers (bedrijf, voornaam) komt met textContent in de pagina, nooit als HTML.

const root = document.getElementById('app');

// ---------------------------------------------------------------------------
// Kleine hulpfuncties
// ---------------------------------------------------------------------------
function el(tag, klasse, tekst) {
  const node = document.createElement(tag);
  if (klasse) node.className = klasse;
  if (tekst !== undefined) node.textContent = tekst;
  return node;
}

function toon(...kinderen) {
  root.replaceChildren(...kinderen);
}

const foutTekst = (fout) => fout?.code ?? fout?.message ?? 'onbekende fout';

// Een bestand laten downloaden. De tekst (met BOM) gaat als UTF-8 mee, zodat Excel de accenten goed leest.
function downloadCsv(naam, tekst) {
  const blob = new Blob([tekst], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = naam;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------------------
// Bevestigingsvenster. Geeft null terug bij Annuleren, anders { extra } (het vinkje).
// ---------------------------------------------------------------------------
function vraag({ titel, regels = [], extraLabel, typWoord, bevestig = 'OK', gevaar = false }) {
  return new Promise((klaar) => {
    const overlay = el('div', 'overlay');
    const venster = el('div', 'venster');
    venster.setAttribute('role', 'dialog');
    venster.setAttribute('aria-modal', 'true');
    venster.append(el('h2', null, titel));
    regels.forEach((tekst) => venster.append(el('p', null, tekst)));

    let vink = null;
    if (extraLabel) {
      const label = el('label', 'vink');
      vink = el('input');
      vink.type = 'checkbox';
      label.append(vink, el('span', null, extraLabel));
      venster.append(label);
    }

    let woord = null;
    if (typWoord) {
      venster.append(el('p', null, `Typ het woord ${typWoord} om te bevestigen:`));
      woord = el('input', 'tekstveld');
      woord.type = 'text';
      woord.autocomplete = 'off';
      venster.append(woord);
    }

    const annuleer = el('button', 'knop', 'Annuleren');
    const ok = el('button', gevaar ? 'knop gevaar' : 'knop primair', bevestig);
    const knoppen = el('div', 'knoppen');
    knoppen.append(annuleer, ok);
    venster.append(knoppen);
    overlay.append(venster);

    const toets = (e) => { if (e.key === 'Escape') sluit(null); };
    const sluit = (resultaat) => {
      document.removeEventListener('keydown', toets);
      overlay.remove();
      klaar(resultaat);
    };
    const controle = () => { ok.disabled = !!typWoord && woord.value.trim() !== typWoord; };
    woord?.addEventListener('input', controle);
    woord?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
    controle();
    ok.addEventListener('click', () => sluit({ extra: !!vink?.checked }));
    annuleer.addEventListener('click', () => sluit(null));
    document.addEventListener('keydown', toets);

    document.body.append(overlay);
    (woord ?? annuleer).focus(); // bij gevaarlijke acties staat de focus op Annuleren
  });
}

// ---------------------------------------------------------------------------
// Inloggen
// ---------------------------------------------------------------------------
let volgendeMelding = null; // { tekst, soort } die op het inlogscherm getoond wordt

function toonLogin() {
  const kaart = el('main', 'kaart smal');
  kaart.append(el('h1', null, 'Admin'), el('p', 'uitleg', 'Log in met het admin-account.'));

  if (!firebaseGeconfigureerd) {
    kaart.append(el('p', 'melding fout', 'Firebase is nog niet ingesteld (zie .env.local).'));
    toon(kaart);
    return;
  }

  const formulier = el('form');
  const maakVeld = (label, type, autocomplete) => {
    const wrap = el('label', 'veld');
    const input = el('input');
    input.type = type;
    input.required = true;
    input.autocomplete = autocomplete;
    wrap.append(el('span', null, label), input);
    formulier.append(wrap);
    return input;
  };
  const email = maakVeld('E-mailadres', 'email', 'username');
  const wachtwoord = maakVeld('Wachtwoord', 'password', 'current-password');
  const melding = el('p', 'melding');
  melding.setAttribute('role', 'alert');
  const knop = el('button', 'knop primair breed', 'Inloggen');
  knop.type = 'submit';
  formulier.append(knop, melding);
  kaart.append(formulier);

  if (volgendeMelding) {
    melding.textContent = volgendeMelding.tekst;
    melding.classList.add(volgendeMelding.soort);
    volgendeMelding = null;
  }

  formulier.addEventListener('submit', async (e) => {
    e.preventDefault();
    knop.disabled = true;
    melding.className = 'melding info';
    melding.textContent = 'Bezig met inloggen…';
    try {
      await logIn(email.value.trim(), wachtwoord.value);
      // Verder gaat het in onAuthStateChanged hieronder
    } catch (fout) {
      wachtwoord.value = '';
      knop.disabled = false;
      melding.className = 'melding fout';
      // Bewust algemeen: we verklappen niet of een e-mailadres bestaat
      if (fout?.code === 'auth/network-request-failed') melding.textContent = 'Geen verbinding. Controleer het internet.';
      else if (fout?.code === 'auth/too-many-requests') melding.textContent = 'Te veel pogingen. Wacht even en probeer het opnieuw.';
      else melding.textContent = 'Inloggen mislukt. Controleer je gegevens.';
    }
  });

  toon(kaart);
  email.focus();
}

function toonLaden(tekst) {
  const kaart = el('main', 'kaart smal');
  kaart.append(el('p', 'uitleg', tekst));
  toon(kaart);
}

// ---------------------------------------------------------------------------
// Automatisch uitloggen na een periode zonder activiteit (de pagina toont persoonsgegevens)
// ---------------------------------------------------------------------------
let laatsteActiviteit = Date.now();
const noteerActiviteit = () => { laatsteActiviteit = Date.now(); };
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach((naam) => {
  window.addEventListener(naam, noteerActiviteit, { passive: true });
});

setInterval(() => {
  if (!auth?.currentUser) return;
  const grens = CONFIG.adminInactiviteitMinuten * 60 * 1000;
  if (Date.now() - laatsteActiviteit > grens) {
    volgendeMelding = {
      tekst: `Automatisch uitgelogd na ${CONFIG.adminInactiviteitMinuten} minuten zonder activiteit.`,
      soort: 'info',
    };
    logOut();
  }
}, 5000);

// ---------------------------------------------------------------------------
// De pagina na het inloggen: kop, tabbladen en gedeelde gegevens
// ---------------------------------------------------------------------------
const TABS = [
  ['klassementen', 'Klassementen'],
  ['deelnemers', 'Deelnemers'],
  ['winnaars', 'Winnaars'],
  ['statistieken', 'Statistieken'],
  ['opruimen', 'Opruimen'],
];

let tab = 'klassementen';
let paneel = null;          // het element van het actieve tabblad
let tabKnoppen = {};

// Wat al geladen is (we laden pas als je een tabblad opent, en bewaren het tot je op Vernieuwen klikt)
const cache = { klassementen: null, spelers: null };
// Wat je op het scherm hebt ingesteld
const weergave = { testMeenemen: false, zoek: '', sorteerKolom: 'aangemaaktOp', sorteerRichting: 'desc', gekozenDag: null };

const vernieuwAlles = () => { cache.klassementen = null; cache.spelers = null; };

async function laadKlassementenData() {
  if (!cache.klassementen) {
    const [algemeen, dagen] = await Promise.all([gegevens.laadAlgemeen(), gegevens.laadDagen()]);
    cache.klassementen = { algemeen, dagen };
  }
  return cache.klassementen;
}

async function laadSpelersData() {
  if (!cache.spelers) {
    const [spelers, spellen] = await Promise.all([gegevens.laadSpelers(), gegevens.laadSpellen()]);
    cache.spelers = { spelers, spellen };
  }
  return cache.spelers;
}

function toonApp(gebruiker) {
  const kop = el('header', 'kop');
  kop.append(el('h1', null, 'Admin'));
  const rechts = el('div', 'kop-rechts');
  rechts.append(el('span', 'wie', gebruiker.email ?? ''));
  const uitloggen = el('button', 'knop', 'Uitloggen');
  uitloggen.addEventListener('click', () => { logOut(); });
  rechts.append(uitloggen);
  kop.append(rechts);

  const tabs = el('nav', 'tabs');
  tabKnoppen = {};
  for (const [sleutel, naam] of TABS) {
    const knop = el('button', 'tab', naam);
    knop.addEventListener('click', () => { tab = sleutel; kiesTab(); });
    tabKnoppen[sleutel] = knop;
    tabs.append(knop);
  }
  paneel = el('main', 'paneel');
  toon(kop, tabs, paneel);
  vernieuwAlles();
  kiesTab();
}

function kiesTab() {
  paneel.className = tab === 'deelnemers' ? 'paneel extra-breed' : 'paneel'; // de tabel met deelnemers heeft veel kolommen
  for (const [sleutel, knop] of Object.entries(tabKnoppen)) knop.classList.toggle('actief', sleutel === tab);
  if (tab === 'klassementen') toonKlassementen();
  else if (tab === 'deelnemers') toonDeelnemers();
  else if (tab === 'winnaars') toonWinnaars();
  else if (tab === 'statistieken') toonStatistieken();
  else toonOpruimen();
}

// Laad de gegevens voor een tabblad (met een melding terwijl het laadt) en teken ze daarna
async function laadEnTeken(tabNaam, laad, teken) {
  paneel.replaceChildren(el('p', 'uitleg', 'Laden…'));
  try {
    const data = await laad();
    if (tab === tabNaam) teken(data);
  } catch (fout) {
    if (tab !== tabNaam) return;
    paneel.replaceChildren(el('p', 'melding fout', `Laden mislukt (${foutTekst(fout)}).`), maakVernieuwKnop());
  }
}

function maakVernieuwKnop() {
  const knop = el('button', 'knop', 'Vernieuwen');
  knop.addEventListener('click', () => { vernieuwAlles(); kiesTab(); });
  return knop;
}

// De balk bovenaan een tabblad: Vernieuwen en (als je wilt) het vinkje voor testdata
function maakWerkbalk(metTestVink) {
  const balk = el('div', 'werkbalk');
  if (metTestVink) {
    const label = el('label', 'vink los');
    const vink = el('input');
    vink.type = 'checkbox';
    vink.checked = weergave.testMeenemen;
    vink.addEventListener('change', () => { weergave.testMeenemen = vink.checked; kiesTab(); });
    label.append(vink, el('span', null, 'Testdata meenemen'));
    balk.append(label);
  }
  balk.append(maakVernieuwKnop());
  return balk;
}

// Een tabel. kolommen: [{ kop, waarde: (rij) => tekst of element, sleutel? (om op te sorteren) }]
function maakTabel(kolommen, rijen, { sorteer, klasse } = {}) {
  const wrap = el('div', 'tabel-wrap');
  const tabel = el('table');
  if (klasse) tabel.className = klasse;
  const kop = el('tr');
  for (const kolom of kolommen) {
    const th = el('th');
    if (sorteer && kolom.sleutel) {
      const knop = el('button', 'sorteerknop', kolom.kop);
      const actief = sorteer.kolom === kolom.sleutel;
      if (actief) knop.textContent = `${kolom.kop} ${sorteer.richting === 'asc' ? '▲' : '▼'}`;
      knop.addEventListener('click', () => sorteer.kies(kolom.sleutel));
      th.append(knop);
    } else {
      th.textContent = kolom.kop;
    }
    kop.append(th);
  }
  const tabelkop = el('thead');
  tabelkop.append(kop);
  tabel.append(tabelkop);

  const lichaam = el('tbody');
  for (const rij of rijen) {
    const tr = el('tr');
    for (const kolom of kolommen) {
      const td = el('td');
      td.dataset.label = kolom.kop; // bij een smal scherm tonen we dit label vóór de waarde
      const inhoud = kolom.waarde(rij);
      if (inhoud instanceof Node) td.append(inhoud); else td.textContent = inhoud ?? '';
      tr.append(td);
    }
    lichaam.append(tr);
  }
  tabel.append(lichaam);
  wrap.append(tabel);
  return wrap;
}

const badgeTest = (rij) => (rij.test ? el('span', 'badge', 'test') : '');

// ---------------------------------------------------------------------------
// Tabblad Klassementen
// ---------------------------------------------------------------------------
function toonKlassementen() {
  laadEnTeken('klassementen', laadKlassementenData, tekenKlassementen);
}

function tekenKlassementen({ algemeen, dagen }) {
  const algemeenKaart = el('section', 'kaart');
  algemeenKaart.append(el('h2', null, `Algemene top (${algemeen.length})`), maakKlassementTabel(algemeen, null));

  const dagKaart = el('section', 'kaart');
  dagKaart.append(el('h2', null, 'Daglijst'));
  if (dagen.length === 0) {
    dagKaart.append(el('p', 'leeg', 'Er zijn nog geen dagen met scores.'));
  } else {
    if (!dagen.some((d) => d.dag === weergave.gekozenDag)) weergave.gekozenDag = dagen[0].dag;
    const keuze = el('select');
    for (const { dag, regels } of dagen) {
      const optie = el('option', null, `${formatDag(dag)} (${regels.length})`);
      optie.value = dag;
      keuze.append(optie);
    }
    keuze.value = weergave.gekozenDag;
    const lijst = el('div');
    const teken = () => lijst.replaceChildren(maakKlassementTabel(dagen.find((d) => d.dag === weergave.gekozenDag).regels, weergave.gekozenDag));
    keuze.addEventListener('change', () => { weergave.gekozenDag = keuze.value; teken(); });
    const keuzeRij = el('label', 'veld rij');
    keuzeRij.append(el('span', null, 'Dag:'), keuze);
    dagKaart.append(keuzeRij, lijst);
    teken();
  }
  paneel.replaceChildren(maakWerkbalk(false), algemeenKaart, dagKaart);
}

// Een tabel met klassementsregels. 'dag' is de dag van de daglijst, of null voor de algemene lijst.
function maakKlassementTabel(regels, dag) {
  if (regels.length === 0) return el('p', 'leeg', 'Nog geen scores.');
  const rijen = regels.map((regel, i) => ({ ...regel, plaats: i + 1 }));
  return maakTabel([
    { kop: 'Plaats', waarde: (r) => String(r.plaats) },
    { kop: 'Bedrijf', waarde: (r) => r.bedrijf },
    { kop: 'Voornaam', waarde: (r) => r.voornaam },
    { kop: 'Score', waarde: (r) => String(r.score) },
    { kop: 'Tijdstip', waarde: (r) => formatTijdstip(r.tijdstip) },
    { kop: 'Test', waarde: badgeTest },
    { kop: '', waarde: (r) => knopMetActie('Verwijderen', 'knop klein gevaar', () => verwijderRegel(r, dag)) },
  ], rijen);
}

function knopMetActie(tekst, klasse, actie) {
  const knop = el('button', klasse, tekst);
  knop.addEventListener('click', actie);
  return knop;
}

async function verwijderRegel(regel, dag) {
  const waar = dag ? `de daglijst van ${formatDag(dag)}` : 'de algemene lijst';
  const antwoord = await vraag({
    titel: 'Regel verwijderen?',
    regels: [
      `${regel.bedrijf} (${regel.voornaam}), ${regel.score} punten, wordt uit ${waar} gehaald.`,
      'Het logboek van gespeelde spellen en de gegevens van de speler blijven bewaard.',
    ],
    extraLabel: dag ? 'Ook uit de algemene lijst verwijderen' : 'Ook uit alle daglijsten verwijderen',
    bevestig: 'Verwijderen',
    gevaar: true,
  });
  if (!antwoord) return;
  try {
    paneel.replaceChildren(el('p', 'uitleg', 'Bezig met verwijderen…'));
    await gegevens.verwijderRegel(regel, { ookAndere: antwoord.extra });
  } catch (fout) {
    alert(`Verwijderen mislukt (${foutTekst(fout)}).`);
  }
  cache.klassementen = null;
  kiesTab();
}

// ---------------------------------------------------------------------------
// Tabblad Deelnemers (met zoeken, sorteren, GDPR-verwijderen en exporteren)
// ---------------------------------------------------------------------------
function toonDeelnemers() {
  laadEnTeken('deelnemers', laadSpelersData, tekenDeelnemers);
}

function tekenDeelnemers({ spelers, spellen }) {
  const alle = bouwDeelnemers(spelers, spellen);

  // Exporteren
  const exportKaart = el('section', 'kaart');
  exportKaart.append(
    el('h2', null, 'Exporteren'),
    el('p', 'uitleg', 'CSV-bestanden voor Excel (puntkomma, UTF-8). Testdata wordt weggelaten, tenzij je het vinkje "Testdata meenemen" aanzet. Zoeken en sorteren hebben geen invloed: je krijgt altijd alles.'),
  );
  const uitvoer = el('p', 'melding info');
  uitvoer.setAttribute('role', 'status');
  const exporteer = (naam, kolommen, rijen) => {
    downloadCsv(bestandsnaam(naam), maakCsv(kolommen, rijen));
    uitvoer.textContent = `${bestandsnaam(naam)} gedownload (${rijen.length} rijen).`;
  };
  const knoppen = el('div', 'knoppenrij');
  knoppen.append(
    knopMetActie('Exporteer deelnemers', 'knop primair', () => exporteer('deelnemers', KOLOMMEN_DEELNEMERS, filterTest(alle, weergave.testMeenemen))),
    knopMetActie('Exporteer alle spellen', 'knop', () => exporteer('spellen', KOLOMMEN_SPELLEN, spellenMetNaam(spellen, spelers, weergave.testMeenemen))),
  );
  exportKaart.append(knoppen, uitvoer);

  // De lijst met zoekveld
  const lijstKaart = el('section', 'kaart');
  const titel = el('h2');
  const zoekveld = el('input');
  zoekveld.type = 'search';
  zoekveld.placeholder = 'Zoek op bedrijf of voornaam';
  zoekveld.autocomplete = 'off';
  zoekveld.value = weergave.zoek;
  zoekveld.setAttribute('aria-label', 'Zoeken');
  const lijst = el('div');

  const kolommen = [
    { kop: 'Bedrijf', sleutel: 'bedrijf', waarde: (d) => d.bedrijf },
    { kop: 'Voornaam', sleutel: 'voornaam', waarde: (d) => d.voornaam },
    { kop: 'Geregistreerd', sleutel: 'aangemaaktOp', waarde: (d) => formatTijdstip(d.aangemaaktOp) },
    { kop: 'Beste score', sleutel: 'besteScore', waarde: (d) => (d.besteScore === null ? '-' : String(d.besteScore)) },
    { kop: 'Spellen', sleutel: 'aantalSpellen', waarde: (d) => String(d.aantalSpellen) },
    { kop: 'Test', waarde: badgeTest },
    { kop: '', waarde: (d) => knopMetActie('Volledig verwijderen (GDPR)', 'knop klein gevaar', () => verwijderDeelnemer(d)) },
  ];

  const teken = () => {
    const zichtbaar = zoekDeelnemers(filterTest(alle, weergave.testMeenemen), weergave.zoek);
    const gesorteerd = sorteerDeelnemers(zichtbaar, weergave.sorteerKolom, weergave.sorteerRichting);
    titel.textContent = `Deelnemers (${gesorteerd.length}${gesorteerd.length !== alle.length ? ` van ${alle.length}` : ''})`;
    if (gesorteerd.length === 0) { lijst.replaceChildren(el('p', 'leeg', 'Geen deelnemers gevonden.')); return; }
    const sorteer = {
      kolom: weergave.sorteerKolom,
      richting: weergave.sorteerRichting,
      kies: (kolom) => {
        if (kolom === weergave.sorteerKolom) weergave.sorteerRichting = weergave.sorteerRichting === 'asc' ? 'desc' : 'asc';
        else { weergave.sorteerKolom = kolom; weergave.sorteerRichting = ['aangemaaktOp', 'besteScore', 'aantalSpellen'].includes(kolom) ? 'desc' : 'asc'; }
        teken();
      },
    };
    lijst.replaceChildren(maakTabel(kolommen, gesorteerd, { sorteer, klasse: 'breed' }));
  };
  zoekveld.addEventListener('input', () => { weergave.zoek = zoekveld.value; teken(); });

  // Op een smal scherm (gsm) zijn de kolomkoppen verborgen; daar kies je de sortering met een keuzelijst
  const sorteerKeuze = el('select');
  sorteerKeuze.setAttribute('aria-label', 'Sorteren op');
  for (const kolom of kolommen.filter((k) => k.sleutel)) {
    const optie = el('option', null, kolom.kop);
    optie.value = kolom.sleutel;
    sorteerKeuze.append(optie);
  }
  sorteerKeuze.value = weergave.sorteerKolom;
  const richtingKnop = el('button', 'knop', weergave.sorteerRichting === 'asc' ? '▲ Oplopend' : '▼ Aflopend');
  sorteerKeuze.addEventListener('change', () => { weergave.sorteerKolom = sorteerKeuze.value; teken(); });
  richtingKnop.addEventListener('click', () => {
    weergave.sorteerRichting = weergave.sorteerRichting === 'asc' ? 'desc' : 'asc';
    richtingKnop.textContent = weergave.sorteerRichting === 'asc' ? '▲ Oplopend' : '▼ Aflopend';
    teken();
  });
  const sorteerRij = el('div', 'sorteerrij alleen-smal');
  sorteerRij.append(sorteerKeuze, richtingKnop);

  lijstKaart.append(titel, zoekveld, sorteerRij, lijst);
  teken();
  paneel.replaceChildren(maakWerkbalk(true), exportKaart, lijstKaart);
}

async function verwijderDeelnemer(speler) {
  const naam = speler.voornaam;
  const antwoord = await vraag({
    titel: `${naam} volledig verwijderen?`,
    regels: [
      `${naam} van ${speler.bedrijf} wordt volledig gewist (GDPR):`,
      '• de gegevens van de speler (bedrijf en voornaam)',
      `• alle gespeelde spellen (${speler.aantalSpellen})`,
      '• alle regels in alle klassementen',
      'Dit kan niet ongedaan gemaakt worden.',
    ],
    bevestig: 'Volledig verwijderen',
    gevaar: true,
  });
  if (!antwoord) return;
  try {
    paneel.replaceChildren(el('p', 'uitleg', `Bezig met verwijderen van ${naam}…`));
    await gegevens.verwijderSpelerVolledig(speler.id);
  } catch (fout) {
    alert(`Verwijderen mislukt (${foutTekst(fout)}).`);
  }
  vernieuwAlles();
  kiesTab();
}

// ---------------------------------------------------------------------------
// Tabblad Winnaars
// ---------------------------------------------------------------------------
function toonWinnaars() {
  laadEnTeken('winnaars', laadKlassementenData, tekenWinnaars);
}

function maakWinnaarsTabel(winnaars) {
  return maakTabel([
    { kop: 'Plaats', waarde: (w) => String(w.plaats) },
    { kop: 'Bedrijf', waarde: (w) => w.bedrijf },
    { kop: 'Voornaam', waarde: (w) => w.voornaam },
    { kop: 'Score', waarde: (w) => String(w.score) },
    { kop: 'Tijdstip', waarde: (w) => formatTijdstip(w.tijdstip) },
    { kop: 'Test', waarde: badgeTest },
  ], winnaars);
}

function tekenWinnaars({ algemeen, dagen }) {
  const winnaars = bepaalWinnaars({ algemeen, dagen, metTest: weergave.testMeenemen });
  const lijst = winnaarsAlsLijst(winnaars);

  const exportKaart = el('section', 'kaart');
  const uitvoer = el('p', 'melding info');
  uitvoer.setAttribute('role', 'status');
  exportKaart.append(
    el('h2', null, 'Exporteren'),
    knopMetActie('Exporteer winnaars (CSV)', 'knop primair', () => {
      downloadCsv(bestandsnaam('winnaars'), maakCsv(KOLOMMEN_WINNAARS, lijst));
      uitvoer.textContent = `${bestandsnaam('winnaars')} gedownload (${lijst.length} rijen).`;
    }),
    uitvoer,
  );

  const algemeenKaart = el('section', 'kaart');
  algemeenKaart.append(el('h2', null, 'Algemene top 3'));
  algemeenKaart.append(winnaars.algemeen.length ? maakWinnaarsTabel(winnaars.algemeen) : el('p', 'leeg', 'Nog geen scores.'));

  const kaarten = [maakWerkbalk(true), exportKaart, algemeenKaart];
  for (const { dag, winnaars: top } of winnaars.perDag) {
    const kaart = el('section', 'kaart');
    kaart.append(el('h2', null, `Dag ${formatDag(dag)}`), maakWinnaarsTabel(top));
    kaarten.push(kaart);
  }
  paneel.replaceChildren(...kaarten);
}

// ---------------------------------------------------------------------------
// Tabblad Statistieken
// ---------------------------------------------------------------------------
function toonStatistieken() {
  laadEnTeken('statistieken', laadSpelersData, tekenStatistieken);
}

function tekenStatistieken({ spelers, spellen }) {
  const s = berekenStatistieken(spelers, spellen, weergave.testMeenemen);
  const getal = (w) => (w === null ? '-' : String(w).replace('.', ','));

  const tegels = el('div', 'tegels');
  for (const [label, waarde] of [
    ['Registraties', s.registraties], ['Gespeelde spellen', s.spellen],
    ['Gemiddelde score', getal(s.gemiddelde)], ['Hoogste score', getal(s.hoogste)],
  ]) {
    const tegel = el('div', 'tegel');
    tegel.append(el('div', 'tegel-waarde', String(waarde)), el('div', 'tegel-label', label));
    tegels.append(tegel);
  }

  const dagKaart = el('section', 'kaart');
  dagKaart.append(el('h2', null, 'Per dag'));
  dagKaart.append(s.perDag.length === 0 ? el('p', 'leeg', 'Nog geen gegevens.') : maakTabel([
    { kop: 'Dag', waarde: (r) => formatDag(r.dag) },
    { kop: 'Registraties', waarde: (r) => String(r.registraties) },
    { kop: 'Spellen', waarde: (r) => String(r.spellen) },
    { kop: 'Gemiddelde score', waarde: (r) => getal(r.gemiddelde) },
    { kop: 'Hoogste score', waarde: (r) => getal(r.hoogste) },
  ], s.perDag));

  paneel.replaceChildren(maakWerkbalk(true), tegels, dagKaart);
}

// ---------------------------------------------------------------------------
// Tabblad Opruimen
// ---------------------------------------------------------------------------
function telRegels(t) {
  return [
    `• ${t.players} spelers`,
    `• ${t.games} spellen (logboek)`,
    `• ${t.leaderboardAllTime} regels in het algemene klassement`,
    `• ${t.leaderboardDaily} regels in daglijsten`,
  ];
}

function toonOpruimen() {
  const uitvoer = el('p', 'melding');
  uitvoer.setAttribute('role', 'status');
  const knoppen = [];

  // Voert een opruimactie uit en zet intussen alle knoppen op slot
  const voerUit = async (actie) => {
    knoppen.forEach((k) => { k.disabled = true; });
    uitvoer.className = 'melding info';
    uitvoer.textContent = 'Bezig…';
    try {
      const bericht = await actie();
      uitvoer.className = 'melding info';
      uitvoer.textContent = bericht ?? '';
    } catch (fout) {
      uitvoer.className = 'melding fout';
      uitvoer.textContent = `Mislukt (${foutTekst(fout)}).`;
    } finally {
      knoppen.forEach((k) => { k.disabled = false; });
      vernieuwAlles(); // de lijsten moeten opnieuw geladen worden
    }
  };

  // 1. Testdata
  const testKaart = el('section', 'kaart');
  testKaart.append(
    el('h2', null, 'Testdata wissen'),
    el('p', null, 'Verwijdert alle documenten met test: true uit alle collecties (spelers, spellen en klassementen). Echte gegevens blijven ongemoeid.'),
  );
  const testKnop = el('button', 'knop gevaar', 'Alle testdata wissen');
  testKnop.addEventListener('click', () => voerUit(async () => {
    const t = await gegevens.telTestdata();
    if (t.totaal === 0) return 'Er is geen testdata gevonden.';
    const antwoord = await vraag({
      titel: 'Alle testdata wissen?',
      regels: [`Er worden ${t.totaal} documenten gewist:`, ...telRegels(t)],
      bevestig: 'Testdata wissen',
      gevaar: true,
    });
    if (!antwoord) return 'Geannuleerd. Er is niets gewist.';
    const aantal = await gegevens.wisTestdata();
    return `Klaar: ${aantal} documenten met testdata gewist.`;
  }));
  knoppen.push(testKnop);
  testKaart.append(testKnop);

  // 2. Alles wissen
  const allesKaart = el('section', 'kaart gevaar-kaart');
  allesKaart.append(
    el('h2', null, 'Alles wissen voor de start van het event'),
    el('p', null, 'Verwijdert ALLE spelers, spellen en klassementen, ook de echte. Gebruik dit alleen om de testperiode af te sluiten. Dit kan niet ongedaan gemaakt worden.'),
  );
  const allesKnop = el('button', 'knop gevaar', 'Alles wissen…');
  allesKnop.addEventListener('click', () => voerUit(async () => {
    const t = await gegevens.telAlles();
    if (t.totaal === 0) return 'Er is niets om te wissen.';
    const eerste = await vraag({
      titel: 'ALLES wissen?',
      regels: [`Er worden ${t.totaal} documenten verwijderd, inclusief echte gegevens:`, ...telRegels(t), 'Dit kan niet ongedaan gemaakt worden.'],
      bevestig: 'Doorgaan',
      gevaar: true,
    });
    if (!eerste) return 'Geannuleerd. Er is niets gewist.';
    const tweede = await vraag({
      titel: 'Laatste controle',
      regels: [`Alle ${t.totaal} documenten worden definitief gewist.`],
      typWoord: 'WISSEN',
      bevestig: 'Definitief alles wissen',
      gevaar: true,
    });
    if (!tweede) return 'Geannuleerd. Er is niets gewist.';
    const aantal = await gegevens.wisAlles();
    return `Klaar: ${aantal} documenten gewist.`;
  }));
  knoppen.push(allesKnop);
  allesKaart.append(allesKnop);

  paneel.replaceChildren(testKaart, allesKaart, uitvoer);
}

// ---------------------------------------------------------------------------
// Wie is er ingelogd? Alleen het admin-account komt binnen.
// ---------------------------------------------------------------------------
if (!auth) {
  toonLogin();
} else {
  onAuthStateChanged(auth, async (gebruiker) => {
    if (!gebruiker) {
      toonLogin();
      return;
    }
    toonLaden('Toegang controleren…');
    noteerActiviteit();
    try {
      await gegevens.controleerToegang(); // de security rules bepalen of dit account admin is
      toonApp(gebruiker);
    } catch (fout) {
      volgendeMelding = fout?.code === 'permission-denied'
        ? { tekst: 'Geen toegang.', soort: 'fout' }
        : { tekst: 'De toegang kon niet gecontroleerd worden. Probeer het opnieuw.', soort: 'fout' };
      await logOut(); // meteen uitloggen
    }
  });
}
