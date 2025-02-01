export class SaveManager {
    constructor() {
        this.apiUrl = 'http://pokemon-clon.local/api/save_game.php';
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

        // Verhindere doppeltes Laden
        if (this.isLoading) {
            console.log('Lade-Vorgang läuft bereits...');
            return null;
        }

        this.isLoading = true;

        try {
            console.log('Lade Spiel vom Server für Player:', this.playerId);
            const response = await fetch(`${this.apiUrl}?action=load&playerId=${encodeURIComponent(this.playerId)}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unbekannter Serverfehler');
            }

            console.log('Geladene Daten:', result.gameState);
            return this.normalizeGameState(result.gameState);

        } catch (error) {
            console.error('Fehler beim Laden:', error);
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
            const response = await fetch(`${this.apiUrl}?action=save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerId: this.playerId,
                    playerPosition: gameState.playerPosition
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Unbekannter Serverfehler');
            }

            console.log('Spielstand erfolgreich gespeichert:', result);
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
        }
    }

    normalizeGameState(gameState) {
        // Hier die Logik zur Normalisierung des Spielstands implementieren
        return gameState;
    }

    getDefaultGameState() {
        // Hier die Logik für den Standard-Spielstand implementieren
        return {};
    }
}
