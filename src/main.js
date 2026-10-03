import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG } from './config.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: BREEDTE,
  height: HOOGTE,
  parent: 'game',
  backgroundColor: CONFIG.kleurAchtergrond,
  physics: { default: 'arcade' },
  // Schaal mee met het scherm en centreer
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene, GameOverScene],
});
