import * as THREE from 'three';
import { InstancedMesh } from 'three';

// Weltgrößen-Konstanten anpassen
const WORLD_SIZE = 500;
const BLOCK_SIZE = 1;
const MIN_HEIGHT = -60;
const MAX_HEIGHT = 40; // Erhöht für Hügel
const WATER_LEVEL = 0; // Wasserhöhe

// Szene erstellen
const scene = new THREE.Scene();

// Kamera einrichten
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);

// Renderer einrichten
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Beleuchtung einrichten
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Helleres Umgebungslicht
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
// Lichtposition anpassen
directionalLight.position.set(WORLD_SIZE * 0.5, WORLD_SIZE, WORLD_SIZE * 0.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
// Schattenbereich anpassen
directionalLight.shadow.camera.left = -WORLD_SIZE;
directionalLight.shadow.camera.right = WORLD_SIZE;
directionalLight.shadow.camera.top = WORLD_SIZE;
directionalLight.shadow.camera.bottom = -WORLD_SIZE;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = WORLD_SIZE * 3;
scene.add(directionalLight);

// Materialien für die Blöcke
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x3d9e3d });
const dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

// Geometrie für alle Blöcke
const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

// Blocktypen erweitern
const BLOCK_TYPES = {
    'grass': { 
        material: new THREE.MeshStandardMaterial({ color: 0x556B2F }), // Olivgrün
        probability: 0.4,
        minHeight: -1,
        maxHeight: MAX_HEIGHT
    },
    'dirt': { 
        material: new THREE.MeshStandardMaterial({ color: 0x8b4513 }), 
        probability: 0.3,
        minHeight: -10,
        maxHeight: -2
    },
    'stone': { 
        material: new THREE.MeshStandardMaterial({ color: 0x808080 }), 
        probability: 0.3,
        minHeight: MIN_HEIGHT,
        maxHeight: -11
    },
    'water': {
        material: new THREE.MeshStandardMaterial({ 
            color: 0x0077be,
            transparent: true,
            opacity: 0.6
        }),
        probability: 0,
        minHeight: MIN_HEIGHT,
        maxHeight: WATER_LEVEL
    }
};

// Am Anfang der Datei nach den Konstanten
let tempBlocks = new Map(); // Globale Variable für Block-Positionen

// Hilfsfunktion zum Prüfen der Nachbarblöcke
function hasVisibleFaces(x, y, z, blocks) {
    const neighbors = [
        {x: x+1, y: y, z: z}, // rechts
        {x: x-1, y: y, z: z}, // links
        {x: x, y: y+1, z: z}, // oben
        {x: x, y: y-1, z: z}, // unten
        {x: x, y: y, z: z+1}, // vorne
        {x: x, y: y, z: z-1}  // hinten
    ];

    // Block ist sichtbar, wenn mindestens ein Nachbar fehlt
    return neighbors.some(pos => 
        !blocks.find(b => 
            b.x === pos.x && 
            b.y === pos.y && 
            b.z === pos.z
        )
    );
}

// Neue Variablen
let player = null;
let playerMesh = null;
let playerName = null;

// Neue Konstanten für die Bewegung
const MOVEMENT_SPEED = 0.15;
const GRAVITY = -0.015;
const JUMP_FORCE = 0.3;

// Bewegungsvariablen
let playerVelocity = new THREE.Vector3();
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

// Neue Konstanten für die Kamera-Positionen
const CAMERA_POSITIONS = {
    SOUTH: 0,      // 0°
    SOUTH_EAST: 1, // 45°
    EAST: 2,       // 90°
    NORTH_EAST: 3, // 135°
    NORTH: 4,      // 180°
    NORTH_WEST: 5, // 225°
    WEST: 6,       // 270°
    SOUTH_WEST: 7  // 315°
};

// Aktuelle Kamera-Position
let currentCameraPosition = CAMERA_POSITIONS.SOUTH;

// Neue Konstanten für Zoom
const MIN_ZOOM = 8;  // Minimale Distanz
const MAX_ZOOM = 25; // Maximale Distanz
let currentZoom = 15; // Aktuelle Distanz (startet bei 15)

// Event-Listener für Mausrad
document.addEventListener('wheel', (event) => {
    // Zoom-Geschwindigkeit
    const zoomSpeed = 0.5;
    
    // Zoom basierend auf Mausrad-Richtung
    if (event.deltaY > 0) {
        // Rauszoomen
        currentZoom = Math.min(currentZoom + zoomSpeed, MAX_ZOOM);
    } else {
        // Reinzoomen
        currentZoom = Math.max(currentZoom - zoomSpeed, MIN_ZOOM);
    }
});

// Tastatur-Event-Listener
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'KeyQ': // Gegen den Uhrzeigersinn drehen
            currentCameraPosition = (currentCameraPosition + 7) % 8;
            break;
        case 'KeyE': // Im Uhrzeigersinn drehen
            currentCameraPosition = (currentCameraPosition + 1) % 8;
            break;
        case 'Space': if (canJump) {
            playerVelocity.y = JUMP_FORCE;
            canJump = false;
        } break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
});

// Kollisionserkennung
function checkBlockCollision(position) {
    const blockX = Math.floor(position.x);
    const blockY = Math.floor(position.y - 0.9);
    const blockZ = Math.floor(position.z);
    
    // Prüfe auch die umliegenden Blöcke für bessere Kollisionserkennung
    for (let xOffset = -0.3; xOffset <= 0.3; xOffset += 0.3) {
        for (let zOffset = -0.3; zOffset <= 0.3; zOffset += 0.3) {
            const checkX = Math.floor(position.x + xOffset);
            const checkZ = Math.floor(position.z + zOffset);
            if (tempBlocks.has(`${checkX},${blockY},${checkZ}`)) {
                return true;
            }
        }
    }
    return false;
}

// Bewegungs-Update-Funktion
function updatePlayerMovement() {
    if (!playerMesh) return;

    // Bewegungsrichtung basierend auf Kamera-Position
    const angle = (currentCameraPosition * Math.PI / 4);
    
    // Horizontale Bewegung
    let moveX = 0;
    let moveZ = 0;

    if (moveForward) {
        moveX -= Math.sin(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        moveZ -= Math.cos(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        playerMesh.rotation.y = angle + Math.PI;    // 180° gedreht
    }
    if (moveBackward) {
        moveX += Math.sin(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        moveZ += Math.cos(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        playerMesh.rotation.y = angle;              // Nicht gedreht
    }
    if (moveLeft) {
        moveX -= Math.cos(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        moveZ += Math.sin(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        playerMesh.rotation.y = angle + Math.PI/2;  // 90° gedreht
    }
    if (moveRight) {
        moveX += Math.cos(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        moveZ -= Math.sin(angle) * MOVEMENT_SPEED;  // Vorzeichen umgedreht
        playerMesh.rotation.y = angle - Math.PI/2;  // -90° gedreht
    }

    // Gravitation
    playerVelocity.y += GRAVITY;

    // Separate Bewegungsrichtungen für bessere Kollisionserkennung
    const newPosition = playerMesh.position.clone();
    
    // X-Bewegung
    newPosition.x += moveX;
    if (!checkBlockCollision(newPosition)) {
        playerMesh.position.x = newPosition.x;
    }
    newPosition.x = playerMesh.position.x;
    
    // Y-Bewegung
    newPosition.y += playerVelocity.y;
    if (!checkBlockCollision(newPosition)) {
        playerMesh.position.y = newPosition.y;
    } else {
        if (playerVelocity.y < 0) { // Nur beim Fallen zurücksetzen
            playerVelocity.y = 0;
            canJump = true;
        }
    }
    newPosition.y = playerMesh.position.y;
    
    // Z-Bewegung
    newPosition.z += moveZ;
    if (!checkBlockCollision(newPosition)) {
        playerMesh.position.z = newPosition.z;
    }

    // Zusätzliche Boden-Kollisionsprüfung für sanftere Bewegung
    if (!checkBlockCollision(new THREE.Vector3(
        playerMesh.position.x,
        playerMesh.position.y - 0.1, // Kleine Offset für bessere Bodenerkennung
        playerMesh.position.z
    ))) {
        canJump = false;
    }
}

// Kamera-Follow für Spieler (vereinfacht)
function updateCamera() {
    if (playerMesh && playerName) {
        const height = currentZoom * 0.8;  // Höhe proportional zum Zoom
        const distance = currentZoom;      // Abstand = Zoom-Level
        
        // Berechne Winkel basierend auf aktueller Position
        const angle = (currentCameraPosition * Math.PI / 4);
        
        // Berechne neue Kamera-Position
        const x = playerMesh.position.x + Math.sin(angle) * distance;
        const z = playerMesh.position.z + Math.cos(angle) * distance;
        
        camera.position.set(
            x,
            playerMesh.position.y + height,
            z
        );
        
        // Kamera schaut immer auf den Spieler, aber etwas über Bodenhöhe
        camera.lookAt(
            playerMesh.position.x,
            playerMesh.position.y + 1,
            playerMesh.position.z
        );
    }
}

// Spieler erstellen anpassen
function createPlayer(x, y, z, rotationY) {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 32);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    playerMesh = new THREE.Mesh(geometry, material);
    
    // Finde höchsten Block unter Spielerposition
    let spawnY = y;
    for (let checkY = MAX_HEIGHT; checkY >= MIN_HEIGHT; checkY--) {
        const key = `${Math.floor(x)},${checkY},${Math.floor(z)}`;
        if (tempBlocks.has(key)) {
            spawnY = checkY + 2;
            break;
        }
    }

    playerMesh.position.set(x, spawnY, z);
    playerMesh.rotation.y = rotationY;
    scene.add(playerMesh);
    
    // Direkte Kamera-Positionierung ohne Animation
    updateCamera();
    
    console.log('Spieler erstellt an Position:', x, spawnY, z);
}

// Spieler laden/erstellen anpassen
async function loadPlayer(name) {
    try {
        const response = await fetch(`http://pokemon-clon.local?player=${name}`);
        const data = await response.json();
        if (data.success) {
            playerName = name;
            createPlayer(
                data.player.x, 
                data.player.y + 2,
                data.player.z, 
                data.player.rotation_y
            );
            
            // Kamera-Position wiederherstellen
            currentCameraPosition = data.player.camera_position || CAMERA_POSITIONS.SOUTH;
            
            // Starte Positions-Update-Intervall
            setInterval(async () => {
                if (playerMesh) {
                    try {
                        const response = await fetch(`http://pokemon-clon.local?updatePlayer`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                name: playerName,
                                x: playerMesh.position.x,
                                y: playerMesh.position.y - 0.9,
                                z: playerMesh.position.z,
                                rotation_y: playerMesh.rotation.y,
                                camera_position: currentCameraPosition // Neue Kamera-Position
                            })
                        });
                        
                        const data = await response.json();
                        if (!data.success) {
                            console.error('Fehler beim Speichern der Position');
                        }
                    } catch (error) {
                        console.error('Fehler beim Aktualisieren der Spielerposition:', error);
                    }
                }
            }, 5000);
        }
    } catch (error) {
        console.error('Fehler beim Laden des Spielers:', error);
    }
}

// Popup-Handling
function showPlayerNamePopup() {
    document.getElementById('playerNamePopup').style.display = 'block';
}

// Event-Listener für das Popup
document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('submitNameButton');
    const playerNameInput = document.getElementById('playerNameInput');

    submitButton.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (name) {
            document.getElementById('playerNamePopup').style.display = 'none';
            loadPlayer(name);
        }
    });

    // Enter-Taste auch erlauben
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const name = playerNameInput.value.trim();
            if (name) {
                document.getElementById('playerNamePopup').style.display = 'none';
                loadPlayer(name);
            }
        }
    });

    console.log('Starte Anwendung...');
    loadAndDisplayWorld();
});

// API-Funktionen
async function loadWorld() {
    try {
        const response = await fetch('http://pokemon-clon.local');
        const data = await response.json();
        if (!data.success) throw new Error('Laden fehlgeschlagen');
        return data.blocks;
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        return null;
    }
}

// Modifizierte Weltlade-Funktion (ersetzt generateWorld)
async function loadAndDisplayWorld() {
    console.log('Lade Welt aus Datenbank...');
    const blocks = [];
    tempBlocks.clear(); // Map leeren statt neu zu erstellen

    try {
        const savedBlocks = await loadWorld();
        if (!savedBlocks || savedBlocks.length === 0) {
            console.error('Keine gespeicherte Welt gefunden');
            alert('Keine gespeicherte Welt gefunden!');
            return;
        }

        // Blocks in temporäre Map laden
        for (const block of savedBlocks) {
            tempBlocks.set(`${block.x},${block.y},${block.z}`, block);
        }

        // Optimierte Funktion zum Prüfen der Nachbarn
        function hasNeighbor(x, y, z) {
            return tempBlocks.has(`${x},${y},${z}`);
        }

        // Zähle die Blöcke pro Typ und erstelle nur sichtbare Blöcke
        const blockCounts = {};
        const visibleBlocks = [];

        for (const block of tempBlocks.values()) {
            const { x, y, z } = block;
            
            // Prüfe Nachbarn mit optimierter Funktion
            if (!hasNeighbor(x+1, y, z) || !hasNeighbor(x-1, y, z) ||
                !hasNeighbor(x, y+1, z) || !hasNeighbor(x, y-1, z) ||
                !hasNeighbor(x, y, z+1) || !hasNeighbor(x, y, z-1)) {
                
                blockCounts[block.type] = (blockCounts[block.type] || 0) + 1;
                visibleBlocks.push(block);
            }
        }

        // Erstelle InstancedMesh für jeden Blocktyp
        for (const [type, count] of Object.entries(blockCounts)) {
            if (count > 0) {
                BLOCK_TYPES[type].instancedMesh = new InstancedMesh(
                    blockGeometry,
                    BLOCK_TYPES[type].material,
                    count
                );
                BLOCK_TYPES[type].instancedMesh.castShadow = true;
                BLOCK_TYPES[type].instancedMesh.receiveShadow = true;
                scene.add(BLOCK_TYPES[type].instancedMesh);
            }
        }

        // Matrix für die Positionierung
        const matrix = new THREE.Matrix4();
        const instanceCounts = {};
        
        // Platziere nur sichtbare Blöcke
        for (const block of visibleBlocks) {
            instanceCounts[block.type] = instanceCounts[block.type] || 0;
            
            matrix.setPosition(
                block.x + BLOCK_SIZE/2,
                block.y + BLOCK_SIZE/2,
                block.z + BLOCK_SIZE/2
            );
            
            BLOCK_TYPES[block.type].instancedMesh.setMatrixAt(
                instanceCounts[block.type]++,
                matrix
            );
            
            blocks.push(block);
        }

        // Update die Matrizen
        for (const data of Object.values(BLOCK_TYPES)) {
            if (data.instancedMesh) {
                data.instancedMesh.instanceMatrix.needsUpdate = true;
            }
        }

        console.log('Welt erfolgreich geladen');
        showPlayerNamePopup();
        return blocks;
    } catch (error) {
        console.error('Fehler beim Laden der Welt:', error);
        alert('Fehler beim Laden der Welt!');
    }
}

// Initial-Kamera-Position anpassen
function setInitialCamera() {
    camera.position.set(
        WORLD_SIZE * 0.5,  // Zentrum X
        WORLD_SIZE * 0.5,  // Höhe
        WORLD_SIZE * 0.75  // Etwas südlich vom Zentrum
    );
    camera.lookAt(WORLD_SIZE * 0.5, 0, WORLD_SIZE * 0.5);
}

// Kompass-Logik
const compassNeedle = document.getElementById('compass-needle');

// Kompass aktualisieren basierend auf Kameraposition
function updateCompass() {
    // Berechne den Winkel zwischen Kamera und Zentrum der Welt
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Berechne den Winkel in Grad (0° = Norden, 90° = Osten)
    let angle = Math.atan2(cameraDirection.x, cameraDirection.z) * (180 / Math.PI);
    
    // Setze die Rotation des Kompass-Zeigers
    compassNeedle.style.transform = `rotate(${angle}deg)`;
}

// Koordinaten-Update-Funktion
function updateCoordinates() {
    if (playerMesh) {
        const coords = document.getElementById('coordinates');
        coords.textContent = `X: ${Math.round(playerMesh.position.x)} Y: ${Math.round(playerMesh.position.y)} Z: ${Math.round(playerMesh.position.z)}`;
    }
}

// Neue FPS-Berechnung
let lastTime = performance.now();
let frameCount = 0;

// FPS-Update-Funktion
function updateFPS() {
    const fpsDisplay = document.getElementById('fps');
    const currentTime = performance.now();
    frameCount++;

    if (currentTime >= lastTime + 1000) {
        fpsDisplay.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastTime = currentTime;
    }
}

// Animation-Loop anpassen
function animate() {
    requestAnimationFrame(animate);
    updateCompass();
    updateCamera();
    updatePlayerMovement();
    updateCoordinates();
    updateFPS();
    renderer.render(scene, camera);
}

// Fenster-Resize-Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Nach der Szenen-Erstellung und vor der Kamera
// Himmel erstellen
const vertexShader = `
varying vec3 vWorldPosition;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;

varying vec3 vWorldPosition;

void main() {
    float h = normalize(vWorldPosition + offset).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
}`;

const uniforms = {
    topColor: { value: new THREE.Color(0x0077ff) },    // Hellblau
    bottomColor: { value: new THREE.Color(0xffffff) }, // Weiß
    offset: { value: 33 },
    exponent: { value: 0.6 }
};

const skyGeo = new THREE.SphereGeometry(WORLD_SIZE * 2, 32, 15);
const skyMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide
});

const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Anpassen der Szenenbeleuchtung für bessere Atmosphäre
scene.fog = new THREE.Fog(0xffffff, WORLD_SIZE * 0.1, WORLD_SIZE * 1.5);
renderer.setClearColor(0x87ceeb); // Hellblauer Fallback

// Beleuchtung anpassen
directionalLight.intensity = 1.2; // Helleres Sonnenlicht
ambientLight.intensity = 0.4;    // Dunkleres Umgebungslicht für mehr Kontrast

// Neue Variablen für andere Spieler
const otherPlayers = new Map(); // Speichert andere Spieler-Meshes mit Namen als Key

// Farben für andere Spieler
const PLAYER_COLORS = [
    0x00ff00,  // Grün
    0x0000ff,  // Blau
    0xffff00,  // Gelb
    0xff00ff,  // Magenta
    0x00ffff,  // Cyan
    0xffa500   // Orange
];

// Funktion zum Erstellen eines Spieler-Meshes
function createPlayerMesh(color) {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 32);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        emissive: color,
        emissiveIntensity: 0.5
    });
    return new THREE.Mesh(geometry, material);
}

// Funktion zum Aktualisieren anderer Spieler
async function updateOtherPlayers() {
    try {
        const response = await fetch(`http://pokemon-clon.local?getAllPlayers`);
        const data = await response.json();
        
        if (data.success && data.players) {
            // Aktuelle Spielerliste
            const currentPlayers = new Set(data.players.map(p => p.name));
            
            // Entferne nicht mehr vorhandene Spieler
            for (const [name, mesh] of otherPlayers) {
                if (!currentPlayers.has(name) || name === playerName) {
                    scene.remove(mesh);
                    otherPlayers.delete(name);
                }
            }
            
            // Aktualisiere oder erstelle andere Spieler
            let colorIndex = 0;
            for (const player of data.players) {
                if (player.name !== playerName) {
                    let playerMesh = otherPlayers.get(player.name);
                    
                    if (!playerMesh) {
                        // Erstelle neuen Spieler
                        playerMesh = createPlayerMesh(PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]);
                        otherPlayers.set(player.name, playerMesh);
                        scene.add(playerMesh);
                        colorIndex++;
                    }
                    
                    // Aktualisiere Position
                    playerMesh.position.set(player.x, player.y + 0.9, player.z);
                    playerMesh.rotation.y = player.rotation_y;
                }
            }
        }
    } catch (error) {
        console.error('Fehler beim Aktualisieren anderer Spieler:', error);
    }
}

// Starte Update-Intervall für andere Spieler
setInterval(updateOtherPlayers, 1000);

animate(); 