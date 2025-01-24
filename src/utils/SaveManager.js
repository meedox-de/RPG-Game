export class SaveManager {
    constructor() {
        this.saveKey = 'gameState';
    }

    saveGame(gameState) {
        const state = {
            playerPosition: gameState.playerPosition,
            houses: gameState.houses,
            trees: gameState.trees,
            timestamp: Date.now()
        };
        
        localStorage.setItem(this.saveKey, JSON.stringify(state));
        console.log('Spiel gespeichert!');
    }

    loadGame() {
        const savedState = localStorage.getItem(this.saveKey);
        return savedState ? JSON.parse(savedState) : null;
    }
}
