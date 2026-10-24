import './admin.css';
import { onAuthStateChanged } from 'firebase/auth';
import { CONFIG } from '../config.js';
import { firebaseGeconfigureerd, auth, logIn, logOut } from './firebaseAdmin.js';
import * as gegevens from './gegevens.js';
import { formatTijdstip, formatDag } from './hulp.js';

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
// De pagina na het inloggen
// ---------------------------------------------------------------------------
let tab = 'klassementen';
let klassementen = null; // { algemeen, dagen, gekozenDag } nadat ze geladen zijn
let paneel = null;       // het element van het actieve tabblad

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
  const knoppen = {};
  for (const [sleutel, naam] of [['klassementen', 'Klassementen'], ['opruimen', 'Opruimen']]) {
    const knop = el('button', 'tab', naam);
    knop.addEventListener('click', () => { tab = sleutel; kiesTab(knoppen); });
    knoppen[sleutel] = knop;
    tabs.append(knop);
  }
  paneel = el('main', 'paneel');
  toon(kop, tabs, paneel);
  klassementen = null;
  kiesTab(knoppen);
}

function kiesTab(knoppen) {
  for (const [sleutel, knop] of Object.entries(knoppen)) knop.classList.toggle('actief', sleutel === tab);
  if (tab === 'klassementen') toonKlassementen();
  else toonOpruimen();
}

// ---------------------------------------------------------------------------
// Tabblad Klassementen
// ---------------------------------------------------------------------------
async function toonKlassementen() {
  if (klassementen) { tekenKlassementen(); return; }
  paneel.replaceChildren(el('p', 'uitleg', 'Klassementen laden…'));
  try {
    const [algemeen, dagen] = await Promise.all([gegevens.laadAlgemeen(), gegevens.laadDagen()]);
    klassementen = { algemeen, dagen, gekozenDag: dagen[0]?.dag ?? null };
    if (tab === 'klassementen') tekenKlassementen();
  } catch (fout) {
    paneel.replaceChildren(el('p', 'melding fout', `Laden mislukt (${foutTekst(fout)}).`), maakVernieuwKnop());
  }
}

function maakVernieuwKnop() {
  const knop = el('button', 'knop', 'Vernieuwen');
  knop.addEventListener('click', () => { klassementen = null; toonKlassementen(); });
  return knop;
}

function tekenKlassementen() {
  const { algemeen, dagen } = klassementen;
  const actie = el('div', 'balk');
  actie.append(maakVernieuwKnop());

  // Algemene top
  const algemeenKaart = el('section', 'kaart');
  algemeenKaart.append(el('h2', null, `Algemene top (${algemeen.length})`), maakTabel(algemeen, null));

  // Daglijst met keuzelijst
  const dagKaart = el('section', 'kaart');
  dagKaart.append(el('h2', null, 'Daglijst'));
  if (dagen.length === 0) {
    dagKaart.append(el('p', 'leeg', 'Er zijn nog geen dagen met scores.'));
  } else {
    const keuze = el('select');
    for (const { dag, regels } of dagen) {
      const optie = el('option', null, `${formatDag(dag)} (${regels.length})`);
      optie.value = dag;
      keuze.append(optie);
    }
    keuze.value = klassementen.gekozenDag;
    if (keuze.value !== klassementen.gekozenDag) { klassementen.gekozenDag = dagen[0].dag; keuze.value = dagen[0].dag; }
    const lijst = el('div');
    const teken = () => lijst.replaceChildren(maakTabel(dagen.find((d) => d.dag === klassementen.gekozenDag).regels, klassementen.gekozenDag));
    keuze.addEventListener('change', () => { klassementen.gekozenDag = keuze.value; teken(); });
    const keuzeRij = el('label', 'veld rij');
    keuzeRij.append(el('span', null, 'Dag:'), keuze);
    dagKaart.append(keuzeRij, lijst);
    teken();
  }
  paneel.replaceChildren(actie, algemeenKaart, dagKaart);
}

// Een tabel met klassementsregels. 'dag' is de dag van de daglijst, of null voor de algemene lijst.
function maakTabel(regels, dag) {
  if (regels.length === 0) return el('p', 'leeg', 'Nog geen scores.');
  const wrap = el('div', 'tabel-wrap');
  const tabel = el('table');
  const kop = el('tr');
  ['Plaats', 'Bedrijf', 'Voornaam', 'Score', 'Tijdstip', 'Test', ''].forEach((naam) => kop.append(el('th', null, naam)));
  const tabelkop = el('thead');
  tabelkop.append(kop);
  tabel.append(tabelkop);
  const lichaam = el('tbody');
  regels.forEach((regel, i) => {
    const rij = el('tr');
    const cel = (label, inhoud) => {
      const td = el('td');
      td.dataset.label = label; // bij een smal scherm tonen we dit label vóór de waarde
      if (typeof inhoud === 'string') td.textContent = inhoud; else td.append(inhoud);
      rij.append(td);
    };
    cel('Plaats', String(i + 1));
    cel('Bedrijf', regel.bedrijf);
    cel('Voornaam', regel.voornaam);
    cel('Score', String(regel.score));
    cel('Tijdstip', formatTijdstip(regel.tijdstip));
    cel('Test', regel.test ? el('span', 'badge', 'test') : '');
    const verwijder = el('button', 'knop klein gevaar', 'Verwijderen');
    verwijder.addEventListener('click', () => verwijderRegel(regel, dag));
    cel('', verwijder);
    lichaam.append(rij);
  });
  tabel.append(lichaam);
  wrap.append(tabel);
  return wrap;
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
  klassementen = null;
  toonKlassementen();
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
      klassementen = null; // de lijsten moeten opnieuw geladen worden
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
