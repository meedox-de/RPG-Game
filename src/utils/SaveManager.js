export class SaveManager {
    constructor() {
        this.apiUrl = 'http://localhost/RPG-Game/api/index.php';
        this.playerId = null;
        this.isLoading = false;
    }

    setPlayerId(playerId) {
        this.playerId = playerId;
    }

    async loadGame() {
        try {
            const response = await fetch(`${this.apiUrl}?action=load`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return {
                houses: result.gameState.houses || [],
                trees: result.gameState.trees || [],
                borderTrees: result.gameState.borderTrees || []
            };
        } catch (error) {
            return this.getDefaultGameState();
        }
    }

    async loadPlayerPosition() {
        if (!this.playerId) {
            throw new Error('Kein Spieler angemeldet');
        }

        try {
            const response = await fetch(`${this.apiUrl}?action=loadPlayer&playerId=${encodeURIComponent(this.playerId)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return result.gameState?.playerPosition || { x: 0, y: 0.5, z: 0 };
        } catch (error) {
            return { x: 0, y: 0.5, z: 0 };
        }
    }

    async saveGame(gameState) {
        if (!this.playerId) {
            throw new Error('Kein Spieler angemeldet');
        }

        try {
            const response = await fetch(`${this.apiUrl}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerId: this.playerId,
                    gameState: {
                        playerPosition: gameState.playerPosition
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unbekannter Serverfehler');
            }

            console.log('Gespeichert');
            return true;

        } catch (error) {
            throw error;
        }
    }

    normalizeGameState(gameState) {
        return {
            playerPosition: gameState?.playerPosition || { x: 0, y: 0.5, z: 0 },
            houses: gameState?.houses || [],
            trees: gameState?.trees || [],
            borderTrees: gameState?.borderTrees || []
        };
    }

    getDefaultGameState() {
        return {
            playerPosition: { x: 0, y: 0.5, z: 0 },
            houses: [],
            trees: [],
            borderTrees: []
        };
    }
}
