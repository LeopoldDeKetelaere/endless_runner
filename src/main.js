import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css'; // retro lettertype, zit in het project (werkt ook zonder internet)
import { BREEDTE, HOOGTE, CONFIG } from './config.js';
import StartScene from './scenes/StartScene.js';
import RegistratieScene from './scenes/RegistratieScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

// Wacht kort tot het lettertype geladen is, zodat de eerste tekst meteen goed staat
// (na maximaal 2 seconden starten we toch)
const lettertypeKlaar = Promise.race([
  document.fonts.load('12px "Press Start 2P"', 'ÉéAa1'),
  new Promise((klaar) => setTimeout(klaar, 2000)),
]);

lettertypeKlaar.then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    width: BREEDTE,
    height: HOOGTE,
    parent: 'game',
    backgroundColor: CONFIG.kleurAchtergrond,
    pixelArt: true, // scherpe pixels als het spel op een groot scherm wordt opgeschaald
    physics: { default: 'arcade' },
    // Schaal mee met het scherm en centreer
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [StartScene, RegistratieScene, GameScene, GameOverScene],
  });
});
