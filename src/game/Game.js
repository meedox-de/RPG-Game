import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { World } from './World.js';
import { Player } from './Player.js';
import { SaveManager } from '../utils/SaveManager.js';
import { Constants } from '../utils/Constants.js';
import { PlayerManager } from '../utils/PlayerManager.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            Constants.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            Constants.CAMERA.NEAR,
            Constants.CAMERA.FAR
        );
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#game'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, Constants.PHYSICS.GRAVITY, 0);
        
        this.world = new World(this.scene, this.physicsWorld);
        this.saveManager = new SaveManager();
        this.playerManager = new PlayerManager(this.scene);
        this.lastUpdateTime = 0;
        this.updateInterval = 1000; // 1 Sekunde
        
        this.setupLighting();
        this.setupEventListeners();
    }

    setupLighting() {
        const sunLight = new THREE.DirectionalLight(
            0xffffff, 
            Constants.LIGHTING.SUN_INTENSITY
        );
        sunLight.position.set(
            Constants.LIGHTING.SUN_POSITION.x,
            Constants.LIGHTING.SUN_POSITION.y,
            Constants.LIGHTING.SUN_POSITION.z
        );
        sunLight.castShadow = true;
        this.scene.add(sunLight);
        
        const ambientLight = new THREE.AmbientLight(
            0xffffff, 
            Constants.LIGHTING.AMBIENT_INTENSITY
        );
        this.scene.add(ambientLight);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    setupSaveButton() {
        document.getElementById('saveButton').addEventListener('click', () => {
            const gameState = {
                playerPosition: this.player.getPosition()
            };
            this.saveManager.saveGame(gameState);
            this.player.resetKeys();
        });
    }

    async initializePlayer(playerName) {
        try {
            this.saveManager.setPlayerId(playerName);
            this.playerManager.setCurrentPlayerId(playerName);
            this.player = new Player(this.scene, this.camera, this.physicsWorld);
            
            // Lade Spielerposition
            const playerState = await this.saveManager.loadPlayerPosition();
            if (playerState) {
                this.player.setPosition(playerState);
            } else {
                this.player.setPosition({ x: 0, y: 0.5, z: 0 });
            }

            this.setupSaveButton();
        } catch (error) {
            console.error('Fehler bei der Spielerinitialisierung:', error);
        }
    }

    async init() {
        try {
            // Zuerst die Welt mit Häusern und Bäumen laden
            const savedState = await this.saveManager.loadGame();
            
            // Häuser aus der DB laden
            if (savedState.houses) {
                savedState.houses.forEach(house => {
                    this.world.createHouse(house.x, house.z, house.width, house.height, house.depth);
                });
            }

            // Bäume aus der DB laden
            if (savedState.trees) {
                savedState.trees.forEach(tree => {
                    this.world.createTree(tree.x, tree.z, tree.height);
                });
            }

            // Grenzbäume aus der DB laden
            if (savedState.borderTrees) {
                savedState.borderTrees.forEach(tree => {
                    this.world.createTree(tree.x, tree.z, tree.height);
                });
            }

            // Kamera initial positionieren
            this.camera.position.set(0, 10, 20);
            this.camera.lookAt(0, 0, 0);

            // Zeige Login-Dialog
            await this.showLoginDialog();

            // Animation starten
            this.animate();
        } catch (error) {
            console.error('Fehler beim Initialisieren:', error);
            throw error;
        }
    }

    async showLoginDialog() {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'login-dialog';
            dialog.innerHTML = `
                <div class="login-content">
                    <h2>Spielername eingeben</h2>
                    <input type="text" id="playerName" placeholder="Name eingeben">
                    <button id="startGame">Spiel starten</button>
                </div>
            `;
            document.body.appendChild(dialog);

            document.getElementById('startGame').addEventListener('click', async () => {
                const playerName = document.getElementById('playerName').value;
                if (playerName) {
                    await this.initializePlayer(playerName);
                    dialog.remove();
                    this.setupSaveButton();
                    this.player.resetKeys();
                    resolve();
                }
            });
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Physik aktualisieren
        this.physicsWorld.step(Constants.PHYSICS.STEP);
        
        // Spiellogik aktualisieren
        this.player.update();
        
        // Andere Spieler aktualisieren (jede Sekunde)
        const currentTime = Date.now();
        if (currentTime - this.lastUpdateTime >= this.updateInterval) {
            this.playerManager.updatePlayers();
            this.lastUpdateTime = currentTime;
        }
        
        // Rendern
        this.renderer.render(this.scene, this.camera);
    }
}
