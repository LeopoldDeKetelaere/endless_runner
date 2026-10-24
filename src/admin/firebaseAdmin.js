// Firebase voor de adminpagina. Los van het spel (dat zijn eigen Firebase-verbinding heeft):
// - een eigen 'app' met de naam 'admin', dus een eigen login. Wie op dezelfde computer het
//   stand-account gebruikt, blijft daar ingelogd en komt niet per ongeluk in de adminpagina.
// - de login blijft alleen bewaard zolang dit tabblad open is (browserSessionPersistence).
// - Firestore met enkel een geheugen-cache: er blijft niets van persoonsgegevens op de computer staan.

import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { instellingen, firebaseGeconfigureerd, emulatorUrl } from '../firebaseConfig.js';

export { firebaseGeconfigureerd };

const app = firebaseGeconfigureerd ? initializeApp(instellingen, 'admin') : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? initializeFirestore(app, { localCache: memoryLocalCache() }) : null;

// Alleen voor testen met de Firebase-emulator (zie .env.example)
if (auth && emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });

export async function logIn(email, wachtwoord) {
  await setPersistence(auth, browserSessionPersistence);
  await signInWithEmailAndPassword(auth, email, wachtwoord);
}

export async function logOut() {
  if (auth) await signOut(auth);
}
