// Kleine hulpfuncties voor de adminpagina (zonder Firebase, zodat ze los te testen zijn).

// Hoogste score eerst; bij gelijke score staat de oudste bovenaan
export function sorteerRegels(regels) {
  return [...regels].sort((a, b) => b.score - a.score || (a.tijdstip?.getTime() ?? 0) - (b.tijdstip?.getTime() ?? 0));
}

// Zet een lijst dagregels (elk met een veld 'dag') om in [{ dag, regels }], nieuwste dag eerst,
// met in elke dag de regels gesorteerd van hoog naar laag
export function groepeerPerDag(regels) {
  const perDag = new Map();
  for (const regel of regels) {
    if (!perDag.has(regel.dag)) perDag.set(regel.dag, []);
    perDag.get(regel.dag).push(regel);
  }
  return [...perDag.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dag, lijst]) => ({ dag, regels: sorteerRegels(lijst) }));
}

// Tijdstip als '24/10/2026 14:35' in de tijdzone van Brussel
const tijdFormaat = new Intl.DateTimeFormat('nl-BE', {
  timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
export const formatTijdstip = (datum) => (datum ? tijdFormaat.format(datum) : '-');

// '2026-10-24' als '24/10/2026'
export const formatDag = (dag) => dag.split('-').reverse().join('/');
