import { Game } from './core/Game.js';

// Entry point (§9.1 single-player slice). Boot the game once the DOM is ready.
// No wallet, no network, no economy yet — those arrive at §9.5. This is "feel".

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

// eslint-disable-next-line no-new
new Game(canvas, uiRoot);
