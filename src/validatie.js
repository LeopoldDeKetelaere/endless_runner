// Controle van wat de speler invult. De functie geeft { ok, waarde, fout } terug:
// 'waarde' is de opgeschoonde invoer die we bewaren, 'fout' de melding voor op het scherm.

// Bedrijf en voornaam: mogen niet leeg zijn en niet langer dan 'max' tekens.
// Spaties vooraan en achteraan verdwijnen, meerdere spaties na elkaar worden één spatie.
export function controleerTekst(invoer, max, foutLeeg) {
  const waarde = String(invoer ?? '').trim().replace(/\s+/g, ' ');
  if (!waarde) return { ok: false, fout: foutLeeg };
  if (waarde.length > max) return { ok: false, fout: `MAXIMAAL ${max} TEKENS` };
  return { ok: true, waarde };
}
