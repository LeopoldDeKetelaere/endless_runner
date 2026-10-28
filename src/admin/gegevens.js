// Alles wat de adminpagina met Firestore doet: klassementen laden, tellen en verwijderen.
// De security rules bepalen wie dit mag (alleen het admin-account). Niet-admins krijgen
// de fout 'permission-denied'.

import {
  collection, collectionGroup, doc, query, where, orderBy, getDocs, getCountFromServer, writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseAdmin.js';
import { sorteerRegels, groepeerPerDag } from './hulp.js';

const PER_BATCH = 400; // Firestore laat maximaal 500 bewerkingen per batch toe

// ---------------------------------------------------------------------------
// Toegang
// ---------------------------------------------------------------------------

// Gooit een fout met code 'permission-denied' als dit account geen admin is. We tellen alleen de
// documenten van 'games' (die mag alleen het admin-account oplijsten); er worden geen gegevens gedownload.
export async function controleerToegang() {
  await getCountFromServer(collection(db, 'games'));
}

// ---------------------------------------------------------------------------
// Klassementen laden
// ---------------------------------------------------------------------------

// Een document uit een klassement als eenvoudig object. 'dag' is gevuld bij een daglijst.
function naarRegel(document, dag = null) {
  const d = document.data();
  return {
    id: document.id,           // het spelers-id
    ref: document.ref,
    dag,
    bedrijf: d.bedrijf,
    voornaam: d.voornaam,
    score: d.score,
    tijdstip: d.bijgewerktOp?.toDate?.() ?? null,
    test: d.test === true,
  };
}

// Alle regels uit alle daglijsten. Dat gaat met één 'collection group'-opdracht op 'entries'
// (zonder filter of sortering, dus zonder extra index). Het sorteren doen we hier.
async function alleDagDocumenten() {
  const snap = await getDocs(collectionGroup(db, 'entries'));
  return snap.docs.filter((d) => d.ref.parent.parent?.parent?.id === 'leaderboardDaily');
}

export async function laadAlgemeen() {
  const snap = await getDocs(query(collection(db, 'leaderboardAllTime'), orderBy('score', 'desc')));
  return sorteerRegels(snap.docs.map((d) => naarRegel(d)));
}

// Geeft [{ dag, regels }] terug, nieuwste dag eerst
export async function laadDagen() {
  const docs = await alleDagDocumenten();
  return groepeerPerDag(docs.map((d) => naarRegel(d, d.ref.parent.parent.id)));
}

// ---------------------------------------------------------------------------
// Verwijderen
// ---------------------------------------------------------------------------

// Verwijder documenten in groepjes. Standaard wachten we tot de server het bevestigd heeft
// (de adminpagina moet het echt zeker weten). 'voortgang(gedaan, totaal)' is optioneel.
export async function verwijderRefs(refs, { wacht = true, voortgang } = {}) {
  for (let i = 0; i < refs.length; i += PER_BATCH) {
    const batch = writeBatch(db);
    refs.slice(i, i + PER_BATCH).forEach((ref) => batch.delete(ref));
    const klaar = batch.commit();
    if (wacht) await klaar;
    voortgang?.(Math.min(i + PER_BATCH, refs.length), refs.length);
  }
  return refs.length;
}

// Eén regel uit een klassement halen. Met 'ookAndere' verdwijnt de speler ook uit de andere lijst(en):
// - vanuit een daglijst: ook uit de algemene lijst
// - vanuit de algemene lijst: ook uit alle daglijsten
// Het logboek (games) en de speler zelf blijven altijd bewaard.
export async function verwijderRegel(regel, { ookAndere = false, wacht = true } = {}) {
  const refs = [regel.ref];
  if (ookAndere) {
    if (regel.dag) {
      refs.push(doc(db, 'leaderboardAllTime', regel.id));
    } else {
      const docs = await alleDagDocumenten();
      docs.filter((d) => d.id === regel.id).forEach((d) => refs.push(d.ref));
    }
  }
  return verwijderRefs(refs, { wacht });
}

// ---------------------------------------------------------------------------
// Tellen en opruimen
// ---------------------------------------------------------------------------

// Aantal documenten van een opdracht tellen. Lukt tellen op de server niet, dan halen we ze op.
async function tel(opdracht) {
  try {
    return (await getCountFromServer(opdracht)).data().count;
  } catch {
    return (await getDocs(opdracht)).size;
  }
}

const COLLECTIES = ['players', 'games', 'leaderboardAllTime'];
const alleenTest = (naam) => query(collection(db, naam), where('test', '==', true));

// Hoeveel testdocumenten (test: true) zijn er per soort?
export async function telTestdata() {
  const [players, games, leaderboardAllTime, dagDocs] = await Promise.all([
    ...COLLECTIES.map((naam) => tel(alleenTest(naam))),
    alleDagDocumenten(),
  ]);
  const leaderboardDaily = dagDocs.filter((d) => d.data().test === true).length;
  return { players, games, leaderboardAllTime, leaderboardDaily, totaal: players + games + leaderboardAllTime + leaderboardDaily };
}

// Alle documenten met test: true verwijderen uit alle collecties. Geeft het aantal terug.
export async function wisTestdata(opties = {}) {
  const [players, games, allTime, dagDocs] = await Promise.all([
    ...COLLECTIES.map((naam) => getDocs(alleenTest(naam))),
    alleDagDocumenten(),
  ]);
  const refs = [
    ...players.docs, ...games.docs, ...allTime.docs,
    ...dagDocs.filter((d) => d.data().test === true),
  ].map((d) => d.ref);
  return verwijderRefs(refs, opties);
}

// Hoeveel documenten zijn er in totaal (spelers, spellen, klassementen)?
export async function telAlles() {
  const [players, games, leaderboardAllTime, dagDocs] = await Promise.all([
    ...COLLECTIES.map((naam) => tel(collection(db, naam))),
    alleDagDocumenten(),
  ]);
  const leaderboardDaily = dagDocs.length;
  return { players, games, leaderboardAllTime, leaderboardDaily, totaal: players + games + leaderboardAllTime + leaderboardDaily };
}

// ALLES verwijderen: alle spelers, spellen en klassementen. Niet terug te draaien.
export async function wisAlles(opties = {}) {
  const [players, games, allTime, dagDocs] = await Promise.all([
    ...COLLECTIES.map((naam) => getDocs(collection(db, naam))),
    alleDagDocumenten(),
  ]);
  const refs = [...players.docs, ...games.docs, ...allTime.docs, ...dagDocs].map((d) => d.ref);
  return verwijderRefs(refs, opties);
}

// ---------------------------------------------------------------------------
// Deelnemers en spellen (voor Deelnemers, Winnaars, Statistieken en de exports)
// ---------------------------------------------------------------------------

const naarDatum = (tijdstip) => tijdstip?.toDate?.() ?? null;

// Alle spelers uit 'players' (alleen het admin-account mag de hele lijst lezen)
export async function laadSpelers() {
  const snap = await getDocs(collection(db, 'players'));
  return snap.docs.map((document) => {
    const x = document.data();
    return {
      id: document.id,
      bedrijf: x.bedrijf ?? '',
      voornaam: x.voornaam ?? '',
      aangemaaktOp: naarDatum(x.aangemaaktOp),
      test: x.test === true,
    };
  });
}

// Alle gespeelde spellen uit het logboek 'games'
export async function laadSpellen() {
  const snap = await getDocs(collection(db, 'games'));
  return snap.docs.map((document) => {
    const x = document.data();
    return {
      id: document.id,
      spelerId: x.spelerId,
      score: x.score,
      dag: x.dag ?? null,
      gespeeldOp: naarDatum(x.gespeeldOp),
      test: x.test === true,
    };
  });
}

// GDPR: een speler VOLLEDIG verwijderen: de speler zelf, al zijn spellen en al zijn regels in alle
// klassementen. De speler zelf staat als laatste in de lijst: mislukt het halverwege, dan bestaat
// hij nog en kun je het opnieuw proberen. Geeft terug hoeveel spellen en daglijstregels weg zijn.
export async function verwijderSpelerVolledig(spelerId, opties = {}) {
  const [spellen, dagDocs] = await Promise.all([
    getDocs(query(collection(db, 'games'), where('spelerId', '==', spelerId))),
    alleDagDocumenten(),
  ]);
  const dagRefs = dagDocs.filter((d) => d.id === spelerId).map((d) => d.ref);
  const refs = [
    ...spellen.docs.map((d) => d.ref),
    ...dagRefs,
    doc(db, 'leaderboardAllTime', spelerId),
    doc(db, 'players', spelerId),
  ];
  await verwijderRefs(refs, opties);
  return { spellen: spellen.size, dagregels: dagRefs.length };
}
