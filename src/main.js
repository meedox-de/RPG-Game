import { Game } from './game/Game.js';

// Warte auf DOM-Load
document.addEventListener('DOMContentLoaded', function() {
    const game = new Game();
    game.init().catch(error => {
        console.error('Fehler beim Initialisieren des Spiels:', error);
    });
});
