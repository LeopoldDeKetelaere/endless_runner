// Firebase: verbinding en inloggen.
// De instellingen komen uit .env.local (lokaal) of uit de omgevingsvariabelen van Vercel.
// Die variabelen beginnen met VITE_ zodat Vite ze in het spel zet (zie .env.example).

import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';

const instellingen = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Zijn alle waarden ingevuld? Zo niet, dan start Firebase niet en toont het spel een melding.
export const firebaseGeconfigureerd = Object.values(instellingen)
  .every((waarde) => typeof waarde === 'string' && waarde.trim() !== '');

export const app = firebaseGeconfigureerd ? initializeApp(instellingen) : null;
export const auth = app ? getAuth(app) : null;

// De database (Firestore) met offline-cache: scores worden eerst lokaal in de browser bewaard
// en vanzelf doorgestuurd zodra de wifi terug is. 'MultipleTabManager' zorgt dat het ook
// werkt als de pagina per ongeluk in twee tabbladen openstaat.
function maakDatabase() {
  if (!app) return null;
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app); // al eerder gestart (bv. na een herlading tijdens het ontwikkelen)
  }
}
export const db = maakDatabase();

// Alleen voor testen met de Firebase-emulator (zie .env.example)
const emulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
if (auth && emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });

// Wacht tot Firebase weet of er iemand ingelogd is (ook zonder internet: de login staat op dit toestel).
// Geeft de ingelogde gebruiker terug, of null.
export async function huidigeGebruiker() {
  if (!auth) return null;
  await auth.authStateReady();
  return auth.currentUser;
}

// Inloggen met e-mail en wachtwoord. De login blijft bewaard op dit toestel, ook na het
// herstarten van de browser (zolang de browser zijn gegevens niet wist bij afsluiten).
export async function logIn(email, wachtwoord) {
  await setPersistence(auth, browserLocalPersistence);
  await signInWithEmailAndPassword(auth, email, wachtwoord);
}

export async function logOut() {
  if (auth) await signOut(auth);
}

// ---------------------------------------------------------------------------
// Verbindingsstatus (voor het bolletje op het startscherm)
// ---------------------------------------------------------------------------
// We controleren om de 15 seconden of Firebase bereikbaar is. Dat doen we met een
// verzoek naar de Google-server van Firebase Authentication: lukt dat, dan is de
// verbinding goed. (Het antwoord zelf lezen mag niet, maar dat is ook niet nodig.)
// Als we later Firestore gebruiken, kan de controle daarop gericht worden.

const CONTROLE_URL = 'https://identitytoolkit.googleapis.com/';
const CONTROLE_INTERVAL_MS = 15000;
const CONTROLE_TIMEOUT_MS = 5000;

let verbonden = firebaseGeconfigureerd && navigator.onLine ? null : false; // null = nog onbekend
const luisteraars = new Set();

function zetStatus(nieuw) {
  if (nieuw === verbonden) return;
  verbonden = nieuw;
  luisteraars.forEach((luisteraar) => luisteraar(verbonden));
}

async function controleerVerbinding() {
  if (!firebaseGeconfigureerd || !navigator.onLine) { zetStatus(false); return; }
  const afbreken = new AbortController();
  const timer = setTimeout(() => afbreken.abort(), CONTROLE_TIMEOUT_MS);
  try {
    await fetch(CONTROLE_URL, { mode: 'no-cors', cache: 'no-store', signal: afbreken.signal });
    zetStatus(true);
  } catch {
    zetStatus(false);
  } finally {
    clearTimeout(timer);
  }
}

if (firebaseGeconfigureerd) {
  setInterval(controleerVerbinding, CONTROLE_INTERVAL_MS);
  window.addEventListener('online', controleerVerbinding);
  window.addEventListener('offline', () => zetStatus(false));
  controleerVerbinding();
}

// Meld je aan voor wijzigingen: callback(true | false | null). Geeft een functie terug om je af te melden.
export function volgVerbinding(callback) {
  luisteraars.add(callback);
  callback(verbonden);
  return () => luisteraars.delete(callback);
}
