export class SaveManager {
    constructor() {
        this.apiUrl = 'http://pokemon-clon.local';
        this.playerId = null;
        this.isLoading = false;
    }

    setPlayerId(playerId) {
        this.playerId = playerId;
    }

    async loadGame() {
        if (!this.playerId) {
            throw new Error('Kein Spieler angemeldet');
        }

        if (this.isLoading) {
            return null;
        }

        this.isLoading = true;

        try {
            const response = await fetch(`${this.apiUrl}?action=load&playerId=${encodeURIComponent(this.playerId)}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unbekannter Serverfehler');
            }

            return this.normalizeGameState(result.gameState);

        } catch (error) {
            return this.getDefaultGameState();
        } finally {
            this.isLoading = false;
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
            playerPosition: gameState.playerPosition || { x: 0, y: 0.5, z: 0 }
        };
    }

    getDefaultGameState() {
        return {
            playerPosition: { x: 0, y: 0.5, z: 0 }
        };
    }
}
