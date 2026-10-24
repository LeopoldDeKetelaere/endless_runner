// De Firebase-instellingen uit .env.local (lokaal) of de omgevingsvariabelen van Vercel.
// Wordt gebruikt door het spel (firebase.js) en door de adminpagina (admin/firebaseAdmin.js).

export const instellingen = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Zijn alle waarden ingevuld? Zo niet, dan start Firebase niet en tonen we een melding.
export const firebaseGeconfigureerd = Object.values(instellingen)
  .every((waarde) => typeof waarde === 'string' && waarde.trim() !== '');

// Alleen voor testen met de Firebase-emulator (zie .env.example)
export const emulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
