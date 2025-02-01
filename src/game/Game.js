import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { World } from './World.js';
import { Player } from './Player.js';
import { SaveManager } from '../utils/SaveManager.js';
import { Constants } from '../utils/Constants.js';

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
        
        // Physik-Welt initialisieren
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, Constants.PHYSICS.GRAVITY, 0);
        
        // Komponenten erstellen
        this.world = new World(this.scene, this.physicsWorld);
        this.saveManager = new SaveManager();
        
        this.setupLighting();
        this.setupEventListeners();
        this.setupSaveButton();
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
                playerPosition: this.player.getPosition(),
                ...this.world.getWorldState()
            };
            this.saveManager.saveGame(gameState);
        });
    }

    async initializePlayer(playerName) {
        try {
            this.saveManager.setPlayerId(playerName);
            this.player = new Player(this.scene, this.camera, this.physicsWorld);
            this.player.setPosition({ x: 0, y: 0.5, z: 0 });

            const savedState = await this.saveManager.loadGame();
            if (savedState && savedState.playerPosition) {
                this.player.setPosition(savedState.playerPosition);
            }

            this.setupSaveButton();
        } catch (error) {
            console.error('Fehler bei der Spielerinitialisierung:', error);
            // Hier könnte eine Fehlerbehandlung implementiert werden
        }
    }

    async init() {
        try {
            // Zuerst den Spieler initialisieren
            await this.initializePlayer('default_player');
            
            // Spielstand laden
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

            // Kamera positionieren
            this.camera.position.set(0, 10, 20);
            this.camera.lookAt(0, 0, 0);

            // Animation starten
            this.animate();
        } catch (error) {
            console.error('Fehler beim Initialisieren:', error);
            throw error;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Physik aktualisieren
        this.physicsWorld.step(Constants.PHYSICS.STEP);
        
        // Spiellogik aktualisieren
        this.player.update();
        
        // Rendern
        this.renderer.render(this.scene, this.camera);
    }
}
