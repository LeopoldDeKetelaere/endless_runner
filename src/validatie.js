// Controle van wat de speler invult. Elke functie geeft { ok, waarde, fout } terug:
// 'waarde' is de opgeschoonde invoer die we bewaren, 'fout' de melding voor op het scherm.

// Voornaam, achternaam en bedrijf: mogen niet leeg zijn
export function controleerTekst(invoer, foutmelding) {
  const waarde = String(invoer ?? '').trim().replace(/\s+/g, ' ');
  return waarde ? { ok: true, waarde } : { ok: false, fout: foutmelding };
}

// E-mailadres: iets@iets.iets (geen spaties). We bewaren het in kleine letters.
export function controleerEmail(invoer) {
  const waarde = String(invoer ?? '').trim().toLowerCase();
  if (!waarde) return { ok: false, fout: 'VUL JE E-MAILADRES IN' };
  if (waarde.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(waarde)) {
    return { ok: false, fout: 'DIT E-MAILADRES KLOPT NIET' };
  }
  return { ok: true, waarde };
}

// Telefoonnummer: Belgisch (0470 12 34 56, 03 123 45 67) of internationaal
// (+32 470 12 34 56, 0032 470 12 34 56). Spaties, punten, streepjes, schuine strepen
// en haakjes mogen erin staan; we bewaren het nummer zonder die tekens.
export function controleerTelefoon(invoer) {
  const ruw = String(invoer ?? '').trim();
  if (!ruw) return { ok: false, fout: 'VUL JE TELEFOONNUMMER IN' };
  const waarde = ruw.replace(/[\s.\-/()]/g, '');
  const belgisch = /^0[1-9]\d{7,8}$/;          // 9 of 10 cijfers, begint met 0
  const internationaal = /^(\+|00)[1-9]\d{7,14}$/;
  if (!belgisch.test(waarde) && !internationaal.test(waarde)) {
    return { ok: false, fout: 'DIT NUMMER KLOPT NIET (BV. 0470 12 34 56)' };
  }
  return { ok: true, waarde };
}
