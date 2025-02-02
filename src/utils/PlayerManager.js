import * as THREE from 'three';

export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.apiUrl = 'http://localhost/RPG-Game/api/index.php';
        this.otherPlayers = new Map(); // playerId -> playerMesh
        this.currentPlayerId = null;
        this.colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff]; // Verschiedene Farben
        this.colorIndex = 0;
    }

    setCurrentPlayerId(playerId) {
        this.currentPlayerId = playerId;
    }

    getNextColor() {
        const color = this.colors[this.colorIndex];
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        return color;
    }

    async updatePlayers() {
        try {
            const response = await fetch(`${this.apiUrl}?action=getPlayers`);
            if (!response.ok) throw new Error('Netzwerkfehler');
            
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            // Spieler aktualisieren
            const activePlayers = new Set();
            
            data.players.forEach(player => {
                if (player.id !== this.currentPlayerId) {
                    activePlayers.add(player.id);
                    
                    if (!this.otherPlayers.has(player.id)) {
                        // Neuen Spieler erstellen
                        const geometry = new THREE.BoxGeometry(1, 2, 1);
                        const material = new THREE.MeshPhongMaterial({ color: this.getNextColor() });
                        const playerMesh = new THREE.Mesh(geometry, material);
                        this.scene.add(playerMesh);
                        this.otherPlayers.set(player.id, playerMesh);
                    }
                    
                    // Position aktualisieren
                    const playerMesh = this.otherPlayers.get(player.id);
                    const pos = JSON.parse(player.position);
                    playerMesh.position.set(pos.x, pos.y, pos.z);
                }
            });

            // Nicht mehr aktive Spieler entfernen
            for (const [playerId, mesh] of this.otherPlayers) {
                if (!activePlayers.has(playerId)) {
                    this.scene.remove(mesh);
                    this.otherPlayers.delete(playerId);
                }
            }

        } catch (error) {
            console.error('Fehler beim Aktualisieren der Spieler:', error);
        }
    }
} 