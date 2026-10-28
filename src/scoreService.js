// Opslag van spelers en scores in Firestore (Firebase).
// De rest van het spel gebruikt alleen de functies hieronder (allemaal async).
//
// Gegevensmodel (persoonsgegevens en scorebord strikt gescheiden):
// - players/{spelerId}                         de speler: bedrijf, voornaam, aangemaaktOp (alleen voor het personeel)
//     spelerId = SHA-256 van bedrijf + "|" + voornaam, beide genormaliseerd (zie spelerIdVan)
// - games/{automatisch id}                     logboek van elk gespeeld spel: spelerId, score, dag, gespeeldOp
// - leaderboardAllTime/{spelerId}              enkel wat op het scherm komt: bedrijf, voornaam, score, bijgewerktOp
// - leaderboardDaily/{dag}/entries/{spelerId}  idem, per dag (YYYY-MM-DD in Europe/Brussels)
//
// Er worden geen contactgegevens bewaard: die hebben we al via een ander systeem.
// Testdocumenten krijgen het veld test: true, zodat je ze later makkelijk kunt herkennen en wissen.
//
// Werkt ook zonder internet: Firestore bewaart schrijfacties lokaal (offline-cache, zie firebase.js)
// en stuurt ze door zodra de wifi terug is. Daarom WACHTEN we bij schrijven niet op de server
// (dat zou zonder wifi eindeloos duren). We gebruiken bewust geen transacties: die werken niet offline.

import {
  collection, doc, getDoc, getDocFromCache, setDoc, addDoc,
  query, orderBy, limit, where, getDocs, getDocsFromCache, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const TIJDZONE = 'Europe/Brussels';
const LEES_TIMEOUT_MS = 3000; // langer wachten op de server? Dan gebruiken we wat lokaal bewaard is

// Datum van een tijdstip als 'JJJJ-MM-DD' in de tijdzone van Brussel
const dagFormaat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIJDZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const dagBrussel = (datum) => dagFormaat.format(new Date(datum));

// Kleine letters, spaties vooraan en achteraan weg, meerdere spaties na elkaar worden één spatie
const normaliseer = (tekst) => String(tekst ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

// Het spelers-id: SHA-256 van bedrijf + "|" + voornaam (genormaliseerd), als 64 hexadecimale tekens.
// Dezelfde speler (ook met andere hoofdletters of extra spaties) krijgt dus altijd hetzelfde id.
async function spelerIdVan(bedrijf, voornaam) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 is niet beschikbaar (https of localhost nodig)');
  const bytes = new TextEncoder().encode(`${normaliseer(bedrijf)}|${normaliseer(voornaam)}`);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Hulpfuncties voor lezen en schrijven
// ---------------------------------------------------------------------------

// Wacht maximaal 'ms' op een belofte
function metTimeout(belofte, ms) {
  let timer;
  const te_laat = new Promise((_, afwijzen) => { timer = setTimeout(() => afwijzen(new Error('timeout')), ms); });
  return Promise.race([belofte, te_laat]).finally(() => clearTimeout(timer));
}

// Eén document lezen. Eerst de server (maximaal 3 seconden); lukt dat niet (geen wifi), dan wat
// lokaal bewaard is. Geeft null terug als we het echt niet weten.
async function leesDoc(ref) {
  try {
    return await metTimeout(getDoc(ref), LEES_TIMEOUT_MS);
  } catch {
    try { return await getDocFromCache(ref); } catch { return null; }
  }
}

// Een lijst (query) lezen, met dezelfde terugval. Geeft de documenten terug (lege lijst als het niet lukt).
async function leesLijst(zoekopdracht) {
  try {
    return (await metTimeout(getDocs(zoekopdracht), LEES_TIMEOUT_MS)).docs;
  } catch {
    try { return (await getDocsFromCache(zoekopdracht)).docs; } catch { return []; }
  }
}

// Mislukte schrijfacties (bv. door de security rules) laten we zien via volgSchrijfFouten()
let aantalSchrijfFouten = 0;
const foutLuisteraars = new Set();

// Een schrijfactie versturen zonder te wachten op de server. Lokaal is hij meteen zichtbaar.
function verstuur(belofte) {
  belofte.catch((fout) => {
    aantalSchrijfFouten++;
    console.error('Opslaan in Firestore mislukt', fout);
    foutLuisteraars.forEach((luisteraar) => luisteraar(aantalSchrijfFouten));
  });
}

// Meld je aan om te horen hoeveel schrijfacties er mislukt zijn: callback(aantal).
// Geeft een functie terug om je weer af te melden.
export function volgSchrijfFouten(callback) {
  foutLuisteraars.add(callback);
  callback(aantalSchrijfFouten);
  return () => foutLuisteraars.delete(callback);
}

// Bedrijf en voornaam van spelers die we deze sessie al zagen, zodat we ze niet opnieuw hoeven te lezen
const bekendeSpelers = new Map();
const onthoud = (id, speler) => bekendeSpelers.set(id, { bedrijf: speler.bedrijf, voornaam: speler.voornaam });

async function spelerGegevens(spelerId) {
  if (bekendeSpelers.has(spelerId)) return bekendeSpelers.get(spelerId);
  const snap = await leesDoc(doc(db, 'players', spelerId));
  if (!snap?.exists()) return null;
  onthoud(spelerId, snap.data());
  return bekendeSpelers.get(spelerId);
}

// Een scorebordregel uit een Firestore-document
function bordRegel(document) {
  const d = document.data();
  return {
    spelerId: document.id,
    bedrijf: d.bedrijf,
    voornaam: d.voornaam,
    score: d.score,
    datum: d.bijgewerktOp?.toDate?.().toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Spelers
// ---------------------------------------------------------------------------

// gegevens: { bedrijf, voornaam, test }
// - test: true bij testdata
// Bestaat de speler al (zelfde bedrijf en voornaam, genormaliseerd), dan blijft alles zoals de speler het
// de eerste keer intypte (zo staat hij op het scorebord altijd hetzelfde) en blijft zijn beste score gelden.
// Geeft { id, bedrijf, voornaam, bestaand } terug, met bedrijf en voornaam zoals bewaard.
export async function registerPlayer(gegevens) {
  const voornaam = String(gegevens.voornaam ?? '').trim().replace(/\s+/g, ' ');
  const bedrijf = String(gegevens.bedrijf ?? '').trim().replace(/\s+/g, ' ');
  if (!voornaam || !bedrijf) throw new Error('Bedrijf en voornaam zijn verplicht');

  const id = await spelerIdVan(bedrijf, voornaam);
  const ref = doc(db, 'players', id);

  const bestaand = await leesDoc(ref); // een get op één document, niet zoeken in de hele collectie
  if (bestaand?.exists()) {
    onthoud(id, bestaand.data());
    return { id, ...bekendeSpelers.get(id), bestaand: true };
  }

  const speler = { bedrijf, voornaam, aangemaaktOp: Timestamp.now() };
  if (gegevens.test === true) speler.test = true;
  verstuur(setDoc(ref, speler));
  onthoud(id, speler);
  return { id, bedrijf, voornaam, bestaand: false };
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

// Schrijf de score op het scorebord, maar alleen als ze hoger is dan de bestaande score van die speler.
// (Bij gelijke score blijft de oudste staan.) Als we de bestaande score niet kennen, schrijven we
// toch: de security rules laten op de server geen lagere score toe.
async function schrijfAlsHoger(ref, bordgegevens) {
  const snap = await leesDoc(ref);
  const huidig = snap?.exists() ? snap.data().score : -1;
  if (bordgegevens.score > huidig) verstuur(setDoc(ref, bordgegevens));
}

// Bewaar een score voor een speler. Opties (alleen voor testdata): { datum, test }.
// Lokaal opgeslagen = klaar. Het doorsturen naar de server gebeurt op de achtergrond.
export async function submitScore(spelerId, score, opties = {}) {
  if (!Number.isFinite(score) || score < 0) throw new Error('Ongeldige score');
  const speler = await spelerGegevens(spelerId);
  if (!speler) throw new Error('Onbekende speler');

  const punten = Math.floor(score);
  const tijdstip = new Date(opties.datum ?? Date.now());
  const dag = dagBrussel(tijdstip);
  const gespeeldOp = Timestamp.fromDate(tijdstip);
  const testVeld = opties.test === true ? { test: true } : {};

  // 1. Altijd een regel in het logboek
  verstuur(addDoc(collection(db, 'games'), { spelerId, score: punten, dag, gespeeldOp, ...testVeld }));

  // 2. Op het scorebord (aller tijden en van die dag): enkel wat op het scherm komt
  const bord = { bedrijf: speler.bedrijf, voornaam: speler.voornaam, score: punten, bijgewerktOp: gespeeldOp, ...testVeld };
  await Promise.all([
    schrijfAlsHoger(doc(db, 'leaderboardAllTime', spelerId), bord),
    schrijfAlsHoger(doc(db, 'leaderboardDaily', dag, 'entries', spelerId), bord),
  ]);
  return { spelerId, score: punten, dag };
}

// De collectie met het scorebord van vandaag (dag in Brussel) en van aller tijden
const bordVandaag = () => collection(db, 'leaderboardDaily', dagBrussel(Date.now()), 'entries');
const bordAllTime = () => collection(db, 'leaderboardAllTime');

// Top van vandaag: [{ spelerId, bedrijf, voornaam, score, datum }]
// Elke speler heeft maar één document per bord, dus staat hij er automatisch maar één keer in.
export async function getTopScoresToday(aantal = 10) {
  const docs = await leesLijst(query(bordVandaag(), orderBy('score', 'desc'), limit(aantal)));
  return docs.map(bordRegel);
}

// Top aller tijden
export async function getTopScoresAllTime(aantal = 10) {
  const docs = await leesLijst(query(bordAllTime(), orderBy('score', 'desc'), limit(aantal)));
  return docs.map(bordRegel);
}

// Op welke plaats komt deze score op het scorebord? 1 = eerste.
// Geeft { vandaag, allTime } terug: 1 + het aantal spelers met een hogere score.
export async function getRank(score) {
  const [vandaag, allTime] = await Promise.all([
    leesLijst(query(bordVandaag(), where('score', '>', score))),
    leesLijst(query(bordAllTime(), where('score', '>', score))),
  ]);
  return { vandaag: 1 + vandaag.length, allTime: 1 + allTime.length };
}
