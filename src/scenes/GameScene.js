import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG } from '../config.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.snelheid = CONFIG.startSnelheid;
    this.afstand = 0; // in pixels
    this.tijdTotVolgende = CONFIG.hindernisInterval;

    // Scrollend decor: strepen en bubbels
    this.decor = [];
    for (let i = 0; i < 8; i++) {
      this.maakStreep(Phaser.Math.Between(0, BREEDTE));
    }
    for (let i = 0; i < 14; i++) {
      this.maakBubbel(Phaser.Math.Between(0, BREEDTE));
    }

    // Duiker (geel rechthoekje)
    this.duiker = this.add.rectangle(
      BREEDTE * CONFIG.duikerPositieX, HOOGTE / 2,
      CONFIG.duikerBreedte, CONFIG.duikerHoogte, CONFIG.kleurDuiker
    );
    this.physics.add.existing(this.duiker);
    this.duiker.body.setCollideWorldBounds(true); // niet buiten beeld

    // Hindernissen (rode rechthoeken)
    this.hindernissen = this.add.group();
    this.physics.add.overlap(this.duiker, this.hindernissen, () => this.gameOver());

    // Besturing
    this.pijlen = this.input.keyboard.createCursorKeys();
    this.input.addPointer(1); // meerdere vingers toelaten

    // Score linksboven
    this.scoreTekst = this.add.text(12, 10, 'Score: 0', {
      fontSize: '22px', color: '#ffffff',
    }).setDepth(10);

    this.isKlaar = false;
  }

  update(tijd, delta) {
    if (this.isKlaar) return;
    const dt = delta / 1000;

    // Geleidelijk sneller
    this.snelheid = Math.min(this.snelheid + CONFIG.versnelling * dt, CONFIG.maxSnelheid);
    this.afstand += this.snelheid * dt;
    this.scoreTekst.setText('Score: ' + Math.floor(this.afstand / CONFIG.pixelsPerMeter));

    this.beweegDuiker();
    this.beweegDecor(dt);
    this.beheerHindernissen(delta);
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

    this.duiker.body.setVelocityY(Phaser.Math.Clamp(richting, -1, 1) * CONFIG.duikerSnelheid);
  }

  // Strepen en bubbels naar links; achteraan weer rechts invoegen
  beweegDecor(dt) {
    for (const d of this.decor) {
      d.obj.x -= this.snelheid * d.factor * dt;
      if (d.obj.x + d.obj.width / 2 < 0) {
        d.obj.x = BREEDTE + d.obj.width / 2;
        d.obj.y = Phaser.Math.Between(10, HOOGTE - 10);
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

    for (const h of this.hindernissen.getChildren().slice()) {
      h.body.setVelocityX(-this.snelheid);
      if (h.x + h.width / 2 < 0) h.destroy(); // uit beeld
    }
  }

  maakHindernis() {
    const hoogte = Phaser.Math.Between(CONFIG.hindernisMinHoogte, CONFIG.hindernisMaxHoogte);
    const y = Phaser.Math.Between(hoogte / 2, HOOGTE - hoogte / 2);
    const h = this.add.rectangle(
      BREEDTE + CONFIG.hindernisBreedte, y,
      CONFIG.hindernisBreedte, hoogte, CONFIG.kleurHindernis
    );
    this.physics.add.existing(h);
    h.body.setAllowGravity(false);
    this.hindernissen.add(h);
  }

  maakStreep(x) {
    const obj = this.add.rectangle(
      x, Phaser.Math.Between(10, HOOGTE - 10),
      Phaser.Math.Between(60, 140), 3, CONFIG.kleurDecor, 0.6
    );
    this.decor.push({ obj, factor: 0.5 });
  }

  maakBubbel(x) {
    const obj = this.add.circle(
      x, Phaser.Math.Between(10, HOOGTE - 10),
      Phaser.Math.Between(2, 5), CONFIG.kleurDecor, 0.8
    );
    obj.width = obj.height = obj.radius * 2;
    this.decor.push({ obj, factor: 0.8 });
  }

  gameOver() {
    if (this.isKlaar) return;
    this.isKlaar = true;
    this.scene.start('GameOverScene', { score: Math.floor(this.afstand / CONFIG.pixelsPerMeter) });
  }
}
