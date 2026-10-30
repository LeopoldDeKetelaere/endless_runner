import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG, px } from '../config.js';
import { maakKolom, nieuweToestand } from '../hindernissen.js';
import { submitScore } from '../scoreService.js';
import { maakAchtergrond } from '../achtergrond.js';

// Kleuren van de hitbox-kaders in de debugweergave (toets H)
const DEBUG_KLEUREN = { duiker: 0x00ff00, rots: 0xff00ff, boot: 0x00ffff, octopus: 0xffffff, vis: 0xff0000 };

// Geef een object (met al een physics body) zijn eigen hitbox, los van zijn uiterlijk.
// hb komt uit CONFIG.hitbox: breedte en hoogte als fractie van het object, x en y als verschuiving
// van het midden van de hitbox (ook als fractie van het object).
function zetHitbox(object, hb) {
  const b = object.displayWidth;
  const h = object.displayHeight;
  const hitBreedte = hb.breedte * b;
  const hitHoogte = hb.hoogte * h;
  object.body.setSize(hitBreedte, hitHoogte, false);
  // De offset is de afstand van de linkerbovenhoek van het object tot die van de hitbox
  object.body.setOffset(b / 2 + hb.x * b - hitBreedte / 2, h / 2 + hb.y * h - hitHoogte / 2);
}

// Zoals zetHitbox, maar een cirkel: straal als fractie van de breedte, x en y als verschuiving van het midden
// (fractie van breedte en hoogte van het object).
function zetCirkelHitbox(object, hb) {
  const b = object.displayWidth;
  const h = object.displayHeight;
  const straal = hb.straal * b;
  object.body.setCircle(straal, b / 2 + hb.x * b - straal, h / 2 + hb.y * h - straal);
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.snelheid = CONFIG.startSnelheid;
    this.afstand = 0; // in pixels
    this.tijdTotVolgende = CONFIG.hindernisInterval;
    this.kolomToestand = nieuweToestand(); // onthoudt doorgangen en de verdeling
    this.levens = CONFIG.levens;
    this.fase = 'spelen';       // 'spelen', 'wachten' (op spatie) of 'countdown'
    this.onkwetsbaarRest = 0;   // ms onkwetsbaarheid die nog over zijn
    this.eersteStart = true;    // de start van een spel: wel een countdown, maar geen onkwetsbaarheid

    // Achtergrond (scrollt mee met de spelsnelheid) en scrollende bubbels
    this.achtergrond = maakAchtergrond(this);
    this.decor = [];
    for (let i = 0; i < 14; i++) {
      this.maakBubbel(Phaser.Math.Between(0, BREEDTE));
    }

    // Duiker: een onzichtbaar object met de hitbox, en daarover de afbeelding (zie maakDuiker)
    this.stuurRichting = 0;  // -1 = omhoog sturen, 1 = omlaag, 0 = niet
    this.kantel = 0;         // huidige kantelhoek van het beeld (graden)
    this.bubbels = [];
    this.bubbelTimer = Phaser.Math.Between(1200, 2500);
    this.maakDuiker();

    // Hindernissen (rotsen, boten, octopussen en vissen)
    this.hindernissen = this.add.group();
    this.rotsen = this.add.group(); // de rotsen zelf (zonder physics); hun hitbox-delen zitten in this.hindernissen
    this.physics.add.overlap(this.duiker, this.hindernissen, () => this.geraakt());
    // De afbeeldingen van octopussen en vissen volgen hun (onzichtbare) hitbox-object, pas nadat de physics bewogen heeft
    this.events.on('postupdate', this.updateDierBeelden, this);
    // Octopussen en vissen bewegen we zelf, aan het begin van elke frame (voor de physics), zie beweegDieren
    this.events.on('preupdate', this.beweegDieren, this);
    this.events.once('shutdown', () => {
      this.events.off('postupdate', this.updateDierBeelden, this);
      this.events.off('preupdate', this.beweegDieren, this);
    });

    // Besturing
    this.pijlen = this.input.keyboard.createCursorKeys();
    this.input.addPointer(1); // meerdere vingers toelaten

    // Score linksboven
    this.scoreTekst = this.add.text(px(12), px(10), 'Score: 0', {
      fontSize: px(22) + 'px', color: '#ffffff',
    }).setDepth(10);

    // Levens rechtsboven (een symbooltje per leven, verloren levens worden vaag)
    this.levensSymbolen = [];
    for (let i = 0; i < CONFIG.levens; i++) {
      const symbool = this.add.text(BREEDTE - px(12) - i * px(30), px(8), '♥', {
        fontFamily: 'Arial, sans-serif', fontSize: px(28) + 'px', color: '#ff4060',
      }).setOrigin(1, 0).setDepth(10);
      this.levensSymbolen.push(symbool);
    }

    // Grote countdown in het midden (staat verborgen tot er een leven verloren is)
    this.countdownTekst = this.add.text(BREEDTE / 2, HOOGTE / 2, '', {
      fontSize: px(140) + 'px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Tekst die getoond wordt als je een leven kwijt bent en eerst moet bevestigen
    this.wachtTekst = this.add.text(BREEDTE / 2, HOOGTE / 2, 'Druk op spatie of tik om verder te spelen', {
      fontSize: px(28) + 'px', color: '#ffffff', stroke: '#0b1e4a', strokeThickness: px(6),
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Spatie of tik: na een verloren leven de countdown starten
    this.input.keyboard.on('keydown-SPACE', () => this.bevestig());
    this.input.on('pointerdown', () => this.bevestig());

    this.isKlaar = false;

    // Debug: met toets H de hitboxen tonen (alleen als CONFIG.debugHitboxes aan staat)
    this.debugAan = false;
    if (CONFIG.debugHitboxes) {
      this.debugLaag = this.add.graphics().setDepth(50);
      this.debugTekst = this.add.text(BREEDTE / 2, HOOGTE - px(10), 'HITBOXEN (H)', {
        fontSize: px(10) + 'px', color: '#00ff00',
      }).setOrigin(0.5, 1).setDepth(50).setVisible(false);
      this.input.keyboard.on('keydown-H', () => {
        this.debugAan = !this.debugAan;
        this.debugTekst.setVisible(this.debugAan);
        if (!this.debugAan) this.debugLaag.clear();
      });
    }

    // Het spel begint met een countdown 3 - 2 - 1, zodat de speler zich kan voorbereiden
    this.startCountdown();
  }

  // De duiker bestaat uit twee delen:
  // - 'this.duiker': een onzichtbaar object met de hitbox. Dat wordt bestuurd en botst.
  // - 'this.duikerBeeld': de afbeelding erover. Die deint, kantelt en maakt bubbels, zonder de hitbox te verplaatsen.
  // Ontbreekt de afbeelding, dan tonen we het gele blokje.
  maakDuiker() {
    const x = BREEDTE * CONFIG.duikerPositieX;
    const y = HOOGTE / 2;
    // Bestaat er een zwemanimatie (zie PreloadScene), dan gebruiken we die in plaats van de stilstaande afbeelding
    const animatieBeeldjes = this.registry.get('duikerFrames') ?? 0;
    const sleutel = animatieBeeldjes > 0 ? 'duiker_01' : 'duiker';
    const heeftBeeld = this.textures.exists(sleutel);

    // De hoogte volgt uit de afbeelding, zodat de verhouding klopt
    let hoogte = CONFIG.duikerBreedte / 2;
    if (heeftBeeld) {
      const frame = this.textures.getFrame(sleutel);
      hoogte = (CONFIG.duikerBreedte * frame.height) / frame.width;
    }

    this.duiker = this.add.rectangle(x, y, CONFIG.duikerBreedte, hoogte, CONFIG.kleurDuiker);
    this.physics.add.existing(this.duiker);
    zetHitbox(this.duiker, CONFIG.hitbox.duiker);
    this.duiker.body.setCollideWorldBounds(true); // niet buiten beeld

    this.duikerBeeld = null;
    if (!heeftBeeld) return;
    this.duiker.setVisible(false);
    const beeld = this.add.sprite(x, y, sleutel).setDepth(5);
    beeld.setScale(CONFIG.duikerBreedte / beeld.width);
    if (animatieBeeldjes > 0) beeld.play('duiker-zwem');
    this.duikerBeeld = beeld;
  }

  // Het knipperen (onkwetsbaar) gebeurt op het zichtbare beeld
  zetDuikerAlpha(alpha) {
    (this.duikerBeeld ?? this.duiker).setAlpha(alpha);
  }

  // Elke beeldje: rustig deinen, kantelen met het sturen en af en toe bubbels uit de helm
  updateDuikerBeeld(tijd, delta) {
    const beeld = this.duikerBeeld;
    if (!beeld) return;
    const dt = Math.min(delta, 100) / 1000;

    // Rustig op en neer deinen (alleen het beeld; de hitbox blijft waar hij is)
    const dein = Math.sin((tijd / CONFIG.duikerDeinPeriode) * Math.PI * 2) * CONFIG.duikerDeinHoogte;

    // Kantelen als hij omhoog (negatieve hoek: neus omhoog) of omlaag stuurt, en vloeiend terug naar horizontaal
    const richting = this.fase === 'spelen' ? this.stuurRichting : 0;
    const doel = richting * CONFIG.duikerKantelHoek;
    this.kantel += (doel - this.kantel) * (1 - Math.exp(-CONFIG.duikerKantelSnelheid * dt));

    beeld.setPosition(this.duiker.x, this.duiker.y + dein);
    beeld.setAngle(this.kantel);
    this.updateBubbels(delta);
  }

  // Af en toe een stoot van enkele bubbels uit de helm
  updateBubbels(delta) {
    const dt = Math.min(delta, 100) / 1000;
    this.bubbelTimer -= delta;
    if (this.bubbelTimer <= 0) {
      this.bubbelTimer = Phaser.Math.Between(...CONFIG.duikerBubbelInterval);
      const aantal = Phaser.Math.Between(...CONFIG.duikerBubbelsPerStoot);
      for (let i = 0; i < aantal; i++) this.time.delayedCall(i * 160, () => this.maakDuikerBubbel());
    }

    // Bubbels stijgen, drijven met het water mee naar links (alleen als de wereld beweegt), zwaaien zachtjes en vervagen
    const stroming = this.fase === 'spelen' ? this.snelheid * 0.9 : 0;
    for (const b of this.bubbels) {
      b.leeftijd += delta;
      const t = b.leeftijd / b.duur;
      b.obj.x += (-stroming + Math.sin(b.leeftijd / 260 + b.fase) * px(14)) * dt;
      b.obj.y -= b.stijging * dt;
      b.obj.setScale(1 + 0.35 * t).setAlpha(1 - t * t);
    }
    this.bubbels = this.bubbels.filter((b) => {
      if (b.leeftijd < b.duur) return true;
      b.obj.destroy();
      return false;
    });
  }

  maakDuikerBubbel() {
    const beeld = this.duikerBeeld;
    if (!beeld || this.isKlaar) return;
    const punt = CONFIG.duikerBubbelPunt;
    const [rMin, rMax] = CONFIG.duikerBubbelRadius;
    const obj = this.add.circle(
      beeld.x + (punt.x - 0.5) * beeld.displayWidth + Phaser.Math.Between(-px(3), px(3)),
      beeld.y + (punt.y - 0.5) * beeld.displayHeight,
      Phaser.Math.Between(rMin, rMax), 0xcdeeff, 0.9
    ).setStrokeStyle(px(1.2), 0x000000, 1).setDepth(6); // lichte bubbel met een zwarte rand, passend bij de tekening
    this.bubbels.push({
      obj, leeftijd: 0, duur: Phaser.Math.Between(1100, 1900),
      stijging: Phaser.Math.Between(px(40), px(75)), fase: Math.random() * Math.PI * 2,
    });
  }

  // Teken een gekleurd kader om elke hitbox (zoals Phaser hem echt gebruikt voor botsingen)
  tekenHitboxen() {
    const g = this.debugLaag;
    g.clear();
    const kader = (body, kleur) => {
      g.lineStyle(px(1.5), kleur, 1);
      if (body.isCircle) g.strokeCircle(body.center.x, body.center.y, body.halfWidth);
      else g.strokeRect(body.x, body.y, body.width, body.height);
    };
    if (this.duikerBeeld) {
      const b = this.duikerBeeld;
      g.lineStyle(px(0.7), 0x888888, 1); // de afbeelding zelf (grijs)
      g.strokeRect(b.x - b.displayWidth / 2, b.y - b.displayHeight / 2, b.displayWidth, b.displayHeight);
    }
    kader(this.duiker.body, DEBUG_KLEUREN.duiker);
    for (const r of this.rotsen.getChildren()) { // de hele rots (grijs); de piek hiervan telt voor de doorgang
      g.lineStyle(px(0.7), 0x888888, 1);
      g.strokeRect(r.x - r.width / 2, r.y - r.height / 2, r.width, r.height);
    }
    for (const h of this.hindernissen.getChildren()) {
      if (h.beeld) { // het zichtbare dier (grijs), waarmee de doorgang rekent
        g.lineStyle(px(0.7), 0x888888, 1);
        g.strokeRect(h.x - h.displayWidth / 2, h.y - h.displayHeight / 2, h.displayWidth, h.displayHeight);
      }
      kader(h.body, DEBUG_KLEUREN[h.hindernisType]);
    }
  }

  update(tijd, delta) {
    if (this.isKlaar) return;
    if (this.debugAan) this.tekenHitboxen();
    this.updateDuikerBeeld(tijd, delta); // deinen, kantelen en bubbels lopen altijd door

    // Tijdens het wachten en de countdown staat alles stil (ook de score)
    if (this.fase === 'wachten') return;
    if (this.fase === 'countdown') {
      this.updateCountdown(delta);
      return;
    }
    const dt = delta / 1000;

    // Geleidelijk sneller
    this.snelheid = Math.min(this.snelheid + CONFIG.versnelling * dt, CONFIG.maxSnelheid);
    this.afstand += this.snelheid * dt;
    this.scoreTekst.setText('Score: ' + Math.floor(this.afstand / CONFIG.pixelsPerMeter));

    this.beweegDuiker();
    this.beweegDecor(dt);
    this.beheerHindernissen(delta);
    this.updateOnkwetsbaar(delta);
  }

  // Onkwetsbaar: de duiker knippert tot de tijd om is
  updateOnkwetsbaar(delta) {
    if (this.onkwetsbaarRest <= 0) return;
    this.onkwetsbaarRest -= delta;
    if (this.onkwetsbaarRest <= 0) {
      this.zetDuikerAlpha(1);
      return;
    }
    const stap = Math.floor(this.onkwetsbaarRest / CONFIG.knipperInterval);
    this.zetDuikerAlpha(stap % 2 === 0 ? 0.25 : 1);
  }

  // De duiker raakt een hindernis
  geraakt() {
    // Tijdens countdown of onkwetsbaarheid gebeurt er niets
    if (this.isKlaar || this.fase !== 'spelen' || this.onkwetsbaarRest > 0) return;

    this.levens--;
    this.levensSymbolen[this.levens].setAlpha(0.2);
    if (this.levens <= 0) {
      this.gameOver();
      return;
    }
    this.startWachten();
  }

  // Alle hindernissen weg; het spel staat stil tot de speler op spatie drukt
  startWachten() {
    this.fase = 'wachten';
    this.hindernissen.clear(true, true); // verwijder alle hindernissen
    this.rotsen.clear(true, true);
    this.duiker.body.setVelocityY(0);
    this.zetDuikerAlpha(1);
    // De tekst staat lager op het scherm, behalve als de duiker daar zit: dan erboven
    const tekstY = this.duiker.y <= HOOGTE / 2 ? HOOGTE * 0.78 : HOOGTE * 0.22;
    this.wachtTekst.setY(tekstY).setVisible(true);
    // Korte pauze, zodat een toets die nog ingedrukt is niet meteen doorgaat
    this.kanBevestigen = false;
    this.time.delayedCall(CONFIG.bevestigVertraging, () => { this.kanBevestigen = true; });
  }

  // Spatie of tik tijdens het wachten: begin met de countdown
  bevestig() {
    if (this.fase !== 'wachten' || !this.kanBevestigen) return;
    this.startCountdown();
  }

  // 3 - 2 - 1 voordat het verdergaat
  startCountdown() {
    this.fase = 'countdown';
    this.wachtTekst.setVisible(false);
    this.countdownRest = CONFIG.countdownSeconden * 1000;
    this.laatsteGetal = null;
    this.countdownTekst.setVisible(true);
    this.updateCountdown(0);
  }

  updateCountdown(delta) {
    this.countdownRest -= delta;
    if (this.countdownRest <= 0) {
      this.hervatSpel();
      return;
    }
    const getal = Math.ceil(this.countdownRest / 1000);
    if (getal !== this.laatsteGetal) {
      this.laatsteGetal = getal;
      this.countdownTekst.setText(String(getal));
    }
  }

  // Verder op dezelfde snelheid. Na een verloren leven even onkwetsbaar, bij de start niet.
  hervatSpel() {
    this.fase = 'spelen';
    this.countdownTekst.setVisible(false);
    this.onkwetsbaarRest = this.eersteStart ? 0 : CONFIG.onkwetsbaarSeconden * 1000;
    this.eersteStart = false;
    this.tijdTotVolgende = CONFIG.hindernisInterval;
    // Er staan geen oude kolommen meer: de nieuwe doorgang begint bij de duiker
    const half = CONFIG.minimaleOpening / 2;
    const y = Phaser.Math.Clamp(this.duiker.y, half, HOOGTE - half);
    this.kolomToestand.doorgangen = [y];
    this.kolomToestand.doel = y;
  }

  // Pijltjes of aanraking: omhoog/omlaag
  beweegDuiker() {
    let richting = 0;
    if (this.pijlen.up.isDown) richting -= 1;
    if (this.pijlen.down.isDown) richting += 1;

    // Mobiel: bovenste helft = omhoog, onderste helft = omlaag
    for (const p of this.input.manager.pointers) {
      if (p.isDown) richting += p.y < HOOGTE / 2 ? -1 : 1;
    }

    this.stuurRichting = Phaser.Math.Clamp(richting, -1, 1);
    this.duiker.body.setVelocityY(this.stuurRichting * CONFIG.duikerSnelheid);
  }

  // Achtergrond en bubbels naar links; bubbels achteraan weer rechts invoegen
  beweegDecor(dt) {
    this.achtergrond.update(dt * 1000, this.snelheid);
    for (const d of this.decor) {
      d.obj.x -= this.snelheid * d.factor * dt;
      if (d.obj.x + d.obj.width / 2 < 0) {
        d.obj.x = BREEDTE + d.obj.width / 2;
        d.obj.y = Phaser.Math.Between(px(10), HOOGTE - px(10));
      }
    }
  }

  // Nieuwe hindernissen maken, oude opruimen
  beheerHindernissen(delta) {
    // Tijd tussen hindernissen krimpt mee met de snelheid (zelfde onderlinge afstand)
    this.tijdTotVolgende -= delta * (this.snelheid / CONFIG.startSnelheid);
    if (this.tijdTotVolgende <= 0) {
      this.tijdTotVolgende = CONFIG.hindernisInterval;
      this.maakHindernis();
    }

    for (const r of this.rotsen.getChildren().slice()) {
      if (r.x + r.width / 2 < 0) r.destroy(); // uit beeld (neemt ook de hitbox-delen mee)
    }
    for (const h of this.hindernissen.getChildren().slice()) {
      if (h.ouder) continue; // een hitbox-deel van een rots: beweegt met de rots mee (zie beweegDieren)
      // Boten bewegen mee met de achtergrond (rotsen, octopussen en vissen: zie beweegDieren)
      if (h.hindernisType !== 'octopus' && h.hindernisType !== 'vis') h.body.setVelocityX(-this.snelheid * h.snelheidFactor);

      if (h.x + h.width / 2 < 0) h.destroy(); // uit beeld
    }
  }

  // Octopussen en vissen bewegen we zelf, en alleen hier: elke frame, op basis van de verstreken tijd, naar links
  // (met de snelheid van de wereld, bij vissen sneller) en bij octopussen dobberend als een golf rond hun
  // basishoogte. Dit gebeurt vóór de physics van die frame, zodat het (onzichtbare) lichaam met de hitbox precies
  // meebeweegt. Via de physics-snelheid ging het schokkerig: de physics rekent in vaste stapjes van 1/60 s, los van
  // de frames. De pomp-, wieg- en groottebeweging staan in updateDierBeelden en raken het lichaam niet.
  beweegDieren(tijd, delta) {
    if (this.isKlaar || this.fase !== 'spelen') return;
    const dt = Math.min(delta, 100) / 1000;
    // Rotsen: ook zelf bewegen. De hitbox-delen krijgen elke frame hun plek ten opzichte van de rots, zodat ze
    // precies meebewegen (zonder physics-snelheid, dus zonder haperingen).
    for (const r of this.rotsen.getChildren()) {
      r.x -= this.snelheid * dt;
      r.beeld?.setPosition(r.x, r.y);
      for (const deel of r.delen) deel.setPosition(r.x + deel.dx, r.y + deel.dy);
    }
    for (const h of this.hindernissen.getChildren()) {
      if (h.hindernisType !== 'octopus' && h.hindernisType !== 'vis') continue;
      h.leeftijd += dt * 1000;
      h.x -= this.snelheid * h.snelheidFactor * dt;
      if (h.amp > 0) h.y = h.basisY + h.amp * Math.sin((2 * Math.PI * h.leeftijd) / h.periode + h.fase); // vissen zwemmen recht
    }
  }

  // Maak een kolom hindernissen met gegarandeerd een doorgang (zie hindernissen.js)
  maakHindernis() {
    const kolom = maakKolom(this.kolomToestand, this.snelheid);
    if (!kolom) return; // geen eerlijke kolom gevonden: sla over

    for (const item of kolom.items) {
      if (item.type === 'rots') { this.maakRots(item); continue; }
      // Alle hindernissen van een kolom beginnen op dezelfde plek (linkerkant)
      const fase = item.fase ?? 0;
      const startY = item.y + item.amp * Math.sin(fase);
      const h = this.add.rectangle(BREEDTE + item.breedte / 2, startY, item.breedte, item.hoogte, item.kleur);
      // Eigen bewegingsgegevens per hindernis
      h.snelheidFactor = item.snelheidFactor ?? 1;
      h.basisY = item.y;
      h.amp = item.amp;
      h.periode = item.periode;
      h.fase = fase;
      h.leeftijd = 0;
      h.hindernisType = item.type; // 'rots', 'boot', 'octopus' of 'vis'
      this.physics.add.existing(h);
      h.body.setAllowGravity(false);
      if (item.type === 'octopus') this.maakDierBeeld(h, 'octopus');
      else if (item.type === 'vis') this.maakDierBeeld(h, 'vis');
      else zetHitbox(h, CONFIG.hitbox[item.type]);
      this.hindernissen.add(h);
    }
  }

  // Een rots bestaat uit drie soorten delen:
  // - r: een onzichtbaar object ter grootte van de rots (zonder physics), dat naar links beweegt
  // - r.beeld: de afbeelding erover (eventueel gespiegeld)
  // - r.delen: een paar onzichtbare hulplichamen (rechthoeken, CONFIG.hitbox.rots) die trapsgewijs de vorm volgen.
  //   Zij zitten in this.hindernissen en botsen. Ze schalen en spiegelen mee met de rots.
  // Ontbreekt de afbeelding, dan tonen we het grijze blok met één rechthoek als hitbox.
  maakRots(item) {
    const { breedte, hoogte, spiegel } = item;
    const x = BREEDTE + breedte / 2;
    const y = HOOGTE - hoogte / 2; // altijd op de onderrand
    const heeftBeeld = this.textures.exists('rots');
    const r = this.add.rectangle(x, y, breedte, hoogte, item.kleur).setVisible(!heeftBeeld);
    r.delen = [];
    if (heeftBeeld) {
      r.beeld = this.add.sprite(x, y, 'rots').setDepth(1);
      r.beeld.setDisplaySize(breedte, hoogte); // altijd in verhouding: breedte en hoogte samen
      r.beeld.setFlipX(spiegel);
    }
    for (const d of heeftBeeld ? CONFIG.hitbox.rots : [{ van: 0, tot: 1, hoogte: 1 }]) {
      const van = spiegel ? 1 - d.tot : d.van;
      const tot = spiegel ? 1 - d.van : d.tot;
      const dh = hoogte * d.hoogte;
      const dx = ((van + tot) / 2) * breedte - breedte / 2;  // plek van het midden ten opzichte van de rots
      const dy = hoogte / 2 - dh / 2;                          // op de bodem
      const deel = this.add.rectangle(x + dx, y + dy, (tot - van) * breedte, dh, 0xff00ff).setVisible(false);
      this.physics.add.existing(deel);
      deel.body.setAllowGravity(false);
      deel.ouder = r;
      deel.dx = dx;
      deel.dy = dy;
      deel.hindernisType = 'rots';
      this.hindernissen.add(deel);
      r.delen.push(deel);
    }
    r.once('destroy', () => { r.beeld?.destroy(); r.delen.forEach((deel) => deel.destroy()); });
    this.rotsen.add(r);
  }

  // Een octopus of vis bestaat uit twee delen (net als de duiker):
  // - h: een onzichtbaar object ter grootte van het dier met de hitbox (octopus: cirkel, vis: rechthoek). Dat beweegt en botst.
  // - h.beeld: de afbeelding erover (octopus pompt en wiegt, vis wiegt). Ontbreekt de afbeelding, dan blijft het gekleurde blokje.
  maakDierBeeld(h, soort) {
    if (!this.textures.exists(soort)) {
      zetHitbox(h, { breedte: 1, hoogte: 1, x: 0, y: 0 });
      return;
    }
    if (soort === 'octopus') zetCirkelHitbox(h, CONFIG.hitbox.octopus);
    else zetHitbox(h, CONFIG.hitbox[soort]);
    h.setVisible(false);
    // Ze kijken in de tekening al naar links, naar de duiker toe: nooit spiegelen
    h.beeld = this.add.sprite(h.x, h.y, soort).setDepth(1);
    h.beeld.setDisplaySize(h.displayWidth, h.displayHeight);
    h.basisSchaalX = h.beeld.scaleX;
    h.basisSchaalY = h.beeld.scaleY;
    h.pompFase = Math.random() * Math.PI * 2;
    h.wiegFase = Math.random() * Math.PI * 2;
    h.once('destroy', () => h.beeld.destroy());
  }

  // Octopus: pompen (kort samentrekken en uitrekken) en zachtjes wiegen. Vis: snel een paar graden wiegen.
  // Alleen op het beeld, zonder extra beeldjes.
  updateDierBeelden() {
    for (const h of this.hindernissen.getChildren()) {
      if (!h.beeld) continue;
      h.beeld.setPosition(h.x, h.y);
      if (h.hindernisType === 'octopus') {
        const pomp = Math.sin((h.leeftijd / CONFIG.octopusPompPeriode) * Math.PI * 2 + h.pompFase) * CONFIG.octopusPomp;
        const wieg = Math.sin((h.leeftijd / CONFIG.octopusWiegPeriode) * Math.PI * 2 + h.wiegFase) * CONFIG.octopusWiegHoek;
        h.beeld.setScale(h.basisSchaalX * (1 + pomp), h.basisSchaalY * (1 - pomp)); // breder en lager, dan smaller en hoger
        h.beeld.setAngle(wieg);
      } else {
        h.beeld.setAngle(Math.sin((h.leeftijd / CONFIG.visWiegPeriode) * Math.PI * 2 + h.wiegFase) * CONFIG.visWiegHoek);
      }
    }
  }

  maakBubbel(x) {
    const obj = this.add.circle(
      x, Phaser.Math.Between(px(10), HOOGTE - px(10)),
      Phaser.Math.Between(px(2), px(5)), CONFIG.bubbelKleur, CONFIG.bubbelAlpha
    ).setStrokeStyle(px(0.8), CONFIG.bubbelRandKleur, CONFIG.bubbelRandAlpha).setDepth(-50); // achter de hindernissen
    obj.width = obj.height = obj.radius * 2;
    this.decor.push({ obj, factor: 0.8 });
  }

  // Laatste leven kwijt: bewaar de score voor de speler die zich net registreerde
  async gameOver() {
    if (this.isKlaar) return;
    this.isKlaar = true;
    const score = Math.floor(this.afstand / CONFIG.pixelsPerMeter);

    let opgeslagen = null; // null = er was geen speler om de score aan te koppelen
    const spelerId = this.registry.get('spelerId');
    if (spelerId) {
      try {
        await submitScore(spelerId, score);
        opgeslagen = true;
      } catch (fout) {
        console.error('Score opslaan mislukt', fout);
        opgeslagen = false;
      }
    }
    this.scene.start('GameOverScene', { score, opgeslagen });
  }
}
