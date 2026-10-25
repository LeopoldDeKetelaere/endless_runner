import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG, px } from '../config.js';
import { getTopScoresToday, getTopScoresAllTime, volgSchrijfFouten } from '../scoreService.js';
import { voegTestspelersToe } from '../testdata.js';
import { volgVerbinding } from '../firebase.js';

const LETTERTYPE = '"Press Start 2P", monospace';
const MARGE = px(16);
const PLAATS_TEKENS = 4; // "10. " of " 1. "

// Kort een tekst in met "…" als hij langer is dan 'max' tekens
function kort(tekst, max) {
  if (tekst.length <= max) return tekst;
  return tekst.slice(0, Math.max(max - 1, 0)).trimEnd() + '…';
}

// Eén regel van het scorebord, altijd precies 'tekens' tekens lang (het lettertype is monospace,
// dus alle kolommen lijnen netjes uit): "1. CAFÉ DE KROON (LEO) ...... 12450"
function maakRegel(plaats, item, tekens, scoreBreedte) {
  const voorvoegsel = String(plaats).padStart(2, ' ') + '. ';
  if (!item) return voorvoegsel + '.'.repeat(tekens - PLAATS_TEKENS); // lege plek

  const score = String(item.score).padStart(scoreBreedte, ' ');
  // Ruimte voor "BEDRIJF (VOORNAAM)": minstens 2 tekens over voor de puntjes (spatie, punt, spatie)
  const naamRuimte = tekens - PLAATS_TEKENS - scoreBreedte - 3;
  const voornaam = kort(item.voornaam.normalize('NFC').toUpperCase(), 8);
  const bedrijf = kort(item.bedrijf.normalize('NFC').toUpperCase(), naamRuimte - voornaam.length - 3);
  const naam = `${bedrijf} (${voornaam})`;
  const puntjes = '.'.repeat(Math.max(tekens - PLAATS_TEKENS - naam.length - scoreBreedte - 2, 1));
  return `${voorvoegsel}${naam} ${puntjes} ${score}`;
}

export default class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create() {
    this.afgesloten = false;
    this.registry.remove('spelerId'); // een nieuwe speler moet zich eerst registreren
    this.events.once('shutdown', () => { this.afgesloten = true; });
    this.cameras.main.setBackgroundColor(CONFIG.kleurAchtergrond);

    // Titel
    this.add.text(BREEDTE / 2, px(36), CONFIG.spelTitel, {
      fontFamily: LETTERTYPE, fontSize: px(40) + 'px', color: '#ffe030', stroke: '#000000', strokeThickness: px(8),
    }).setOrigin(0.5);

    this.maakStartDuiker();

    // Twee kolommen met de top 10
    const fontPx = CONFIG.scorebordLettergrootte;
    const kolomBreedte = (BREEDTE - 3 * MARGE) / 2;
    // Een teken is in dit lettertype precies even breed als de lettergrootte
    const proef = this.add.text(0, 0, 'M'.repeat(10), { fontFamily: LETTERTYPE, fontSize: fontPx + 'px' });
    this.tekens = Math.floor(kolomBreedte / (proef.width / 10));
    proef.destroy();

    this.kolommen = [
      { titel: 'TOP 10 VANDAAG', x: MARGE },
      { titel: 'TOP 10 ALLER TIJDEN', x: MARGE * 2 + kolomBreedte },
    ].map(({ titel, x }) => {
      this.add.text(x, px(152), titel, { fontFamily: LETTERTYPE, fontSize: px(16) + 'px', color: '#7fd4ff' });
      const regels = [];
      for (let i = 0; i < CONFIG.topAantal; i++) {
        regels.push(this.add.text(x, px(176) + i * (fontPx + px(14)), '', {
          fontFamily: LETTERTYPE, fontSize: fontPx + 'px', color: '#ffffff',
        }));
      }
      return regels;
    });
    this.vulBorden();

    // Klein bolletje rechtsboven: groen = verbinding met Firebase actief, rood = geen verbinding
    // (grijs = nog onbekend). Zo zie je op de stand meteen of de wifi wegvalt.
    const bolletje = this.add.circle(BREEDTE - px(10), px(10), px(4), 0x555555);
    const stopVolgen = volgVerbinding((verbonden) => {
      if (this.afgesloten) return;
      bolletje.setFillStyle(verbonden === true ? 0x3fdc5a : verbonden === false ? 0xff4040 : 0x555555);
    });
    this.events.once('shutdown', stopVolgen);

    // Klein rood bericht rechtsonder als het doorsturen van scores naar de server is mislukt
    // (bijvoorbeeld door de security rules). Zo blijft zo'n fout niet onopgemerkt.
    const opslagFout = this.add.text(BREEDTE - MARGE, HOOGTE - px(12), '', {
      fontFamily: LETTERTYPE, fontSize: px(8) + 'px', color: '#ff6b6b',
    }).setOrigin(1, 1);
    const stopFouten = volgSchrijfFouten((aantal) => {
      if (this.afgesloten) return;
      opslagFout.setText(aantal > 0 ? `OPSLAGFOUT (${aantal})` : '');
    });
    this.events.once('shutdown', stopFouten);

    // Knipperende tekst
    const start = this.add.text(BREEDTE / 2, HOOGTE - px(34), 'DRUK OP SPATIE', {
      fontFamily: LETTERTYPE, fontSize: px(24) + 'px', color: '#ffffff', stroke: '#000000', strokeThickness: px(6),
    }).setOrigin(0.5);
    this.time.addEvent({ delay: 500, loop: true, callback: () => start.setVisible(!start.visible) });

    // Spatie (of tik) gaat naar de registratie
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('RegistratieScene'));
    this.input.on('pointerdown', () => this.scene.start('RegistratieScene'));

    // Testfunctie: toets T voegt nepspelers toe
    if (CONFIG.testfunctieAan) {
      this.meldingTekst = this.add.text(MARGE, HOOGTE - px(12), 'TESTMODUS: TOETS T = 15 NEPSPELERS', {
        fontFamily: LETTERTYPE, fontSize: px(8) + 'px', color: '#7fd4ff',
      }).setOrigin(0, 1).setAlpha(0.8);
      this.input.keyboard.on('keydown-T', async () => {
        await voegTestspelersToe();
        if (this.afgesloten) return;
        this.meldingTekst.setText('15 NEPSPELERS TOEGEVOEGD').setColor('#ffe030');
        this.vulBorden();
      });
    }
  }

  // De grote duiker die langzaam heen en weer zwemt, tussen de titel en het scorebord.
  // Voorkeur: een grote zwemanimatie, dan de gewone zwemanimatie, anders de grote stilstaande afbeelding.
  maakStartDuiker() {
    let sleutel = null;
    let animatie = null;
    if ((this.registry.get('duikerGrootFrames') ?? 0) > 0) { sleutel = 'duiker_groot_01'; animatie = 'duiker-groot-zwem'; }
    else if ((this.registry.get('duikerFrames') ?? 0) > 0) { sleutel = 'duiker_01'; animatie = 'duiker-zwem'; }
    else if (this.textures.exists('duiker_groot')) sleutel = 'duiker_groot';
    if (!sleutel) return; // geen afbeelding: gewoon geen duiker

    const beeld = this.add.sprite(0, 0, sleutel).setDepth(1);
    beeld.setScale(CONFIG.startDuikerBreedte / beeld.width);
    if (animatie) beeld.play(animatie);
    const marge = beeld.displayWidth / 2 + px(20);
    beeld.x = marge;
    this.startDuiker = { beeld, richting: 1, marge };
  }

  update(tijd, delta) {
    const duiker = this.startDuiker;
    if (!duiker) return;
    const dt = Math.min(delta, 100) / 1000;
    const golf = (tijd / CONFIG.duikerDeinPeriode) * Math.PI * 2;

    // Heen en weer zwemmen; aan het einde draait hij om
    duiker.beeld.x += duiker.richting * CONFIG.startDuikerSnelheid * dt;
    if (duiker.beeld.x > BREEDTE - duiker.marge) duiker.richting = -1;
    else if (duiker.beeld.x < duiker.marge) duiker.richting = 1;
    duiker.beeld.setFlipX(duiker.richting < 0);

    // Rustig op en neer en een heel klein beetje kantelen
    duiker.beeld.y = px(105) + Math.sin(golf) * px(6);
    duiker.beeld.setAngle(Math.sin(golf + 1.2) * 2.5);
  }

  // Haal de toppen op en toon ze
  async vulBorden() {
    const [vandaag, alles] = await Promise.all([
      getTopScoresToday(CONFIG.topAantal),
      getTopScoresAllTime(CONFIG.topAantal),
    ]);
    if (this.afgesloten) return; // scherm is intussen verlaten

    [vandaag, alles].forEach((lijst, k) => {
      // Alle scores in een kolom krijgen dezelfde breedte, zodat de scores onder elkaar staan
      const scoreBreedte = Math.max(5, ...lijst.map((s) => String(s.score).length));
      this.kolommen[k].forEach((regel, i) => {
        regel.setText(maakRegel(i + 1, lijst[i], this.tekens, scoreBreedte));
        regel.setColor(lijst[i] ? '#ffffff' : '#4a6aa8'); // lege plekken dimmen
      });
    });
  }
}
