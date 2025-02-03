import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { InstancedMesh } from 'three';

// Weltgrößen-Konstanten anpassen
const WORLD_SIZE = 500;
const BLOCK_SIZE = 1;
const MIN_HEIGHT = -60;
const MAX_HEIGHT = 40; // Erhöht für Hügel
const WATER_LEVEL = 0; // Wasserhöhe

// Stats für FPS-Anzeige
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

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
        material: new THREE.MeshStandardMaterial({ color: 0x3d9e3d }), 
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

// Tastatur-Event-Listener
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
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

    // Bewegungsrichtung basierend auf Kamera-Rotation
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const angle = Math.atan2(cameraDirection.x, cameraDirection.z);

    // Horizontale Bewegung
    let moveX = 0;
    let moveZ = 0;

    if (moveForward) {
        moveX += Math.sin(angle) * MOVEMENT_SPEED;
        moveZ += Math.cos(angle) * MOVEMENT_SPEED;
    }
    if (moveBackward) {
        moveX -= Math.sin(angle) * MOVEMENT_SPEED;
        moveZ -= Math.cos(angle) * MOVEMENT_SPEED;
    }
    if (moveLeft) {
        moveX += Math.cos(angle) * MOVEMENT_SPEED;
        moveZ -= Math.sin(angle) * MOVEMENT_SPEED;
    }
    if (moveRight) {
        moveX -= Math.cos(angle) * MOVEMENT_SPEED;
        moveZ += Math.sin(angle) * MOVEMENT_SPEED;
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

// Position-Update-Timer
let lastUpdateTime = Date.now();

// Positions-Update zur Datenbank
function updatePlayerPositionInDB() {
    const currentTime = Date.now();
    if (currentTime - lastUpdateTime >= 5000) { // Alle 5 Sekunden
        lastUpdateTime = currentTime;
        updatePlayerPosition();
    }
}

// Initial-Kamera-Position (von oben)
function setInitialCamera() {
    camera.position.set(
        WORLD_SIZE * 0.5,  // Zentrum X
        WORLD_SIZE * 1,    // Höhe
        WORLD_SIZE * 1.5   // Abstand
    );
    camera.lookAt(WORLD_SIZE * 0.5, -WORLD_SIZE * 0.2, WORLD_SIZE * 0.5);
    controls.target.set(WORLD_SIZE * 0.5, 0, WORLD_SIZE * 0.5);
}

// Kamera-Follow für Spieler
function updateCamera() {
    if (playerMesh && playerName) { // Nur updaten wenn Spieler existiert und eingeloggt
        // Aktuelle Kamera-Distanz zum Target beibehalten
        const currentDistance = camera.position.distanceTo(controls.target);
        
        // Setze das Target auf die Spielerposition
        controls.target.copy(playerMesh.position);
        
        // Berechne neue Kamera-Position basierend auf aktueller Rotation und Distanz
        const theta = controls.getAzimuthalAngle();
        const phi = controls.getPolarAngle();
        
        camera.position.set(
            playerMesh.position.x + currentDistance * Math.sin(phi) * Math.sin(theta),
            playerMesh.position.y + currentDistance * Math.cos(phi),
            playerMesh.position.z + currentDistance * Math.sin(phi) * Math.cos(theta)
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
    playerMesh.position.set(x, y + 0.9, z);
    playerMesh.rotation.y = rotationY;
    scene.add(playerMesh);
    
    // Sanfter Übergang zur Spieler-Perspektive
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPosition = new THREE.Vector3(x - 10, y + 5, z - 10);
    const endTarget = playerMesh.position;
    
    // Animation der Kamera-Transition
    const duration = 2000; // 2 Sekunden
    const startTime = Date.now();
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth-Step-Funktion für sanftere Bewegung
        const t = progress * progress * (3 - 2 * progress);
        
        camera.position.lerpVectors(startPosition, endPosition, t);
        controls.target.lerpVectors(startTarget, endTarget, t);
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
    
    console.log('Spieler erstellt an Position:', x, y, z);

    // Finde höchsten Block unter Spielerposition
    let spawnY = y;
    for (let checkY = MAX_HEIGHT; checkY >= MIN_HEIGHT; checkY--) {
        const key = `${Math.floor(x)},${checkY},${Math.floor(z)}`;
        if (tempBlocks.has(key)) {
            console.log('Spawn-Block gefunden bei Y:', checkY);
            spawnY = checkY + 2;
            break;
        }
    }

    playerMesh.position.set(x, spawnY, z);
    console.log('Spieler platziert bei:', x, spawnY, z);
}

// Spieler Position aktualisieren
async function updatePlayerPosition() {
    if (!playerMesh || !playerName) return;
    
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
                rotation_y: playerMesh.rotation.y
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

// Spieler laden/erstellen anpassen
async function loadPlayer(name) {
    try {
        const response = await fetch(`http://pokemon-clon.local?player=${name}`);
        const data = await response.json();
        if (data.success) {
            playerName = name;
            console.log('Lade Spieler:', data.player); // Debug-Log
            createPlayer(
                data.player.x, 
                data.player.y + 2, // Etwas höher setzen
                data.player.z, 
                data.player.rotation_y
            );
            
            // Starte Positions-Update-Intervall
            setInterval(updatePlayerPosition, 5000);
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

// OrbitControls anpassen
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minPolarAngle = Math.PI / 6;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = false;

// Initial-Kamera setzen
setInitialCamera();

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

// Animation-Loop anpassen
function animate() {
    stats.begin();
    
    requestAnimationFrame(animate);
    controls.update();
    updateCompass();
    updateCamera();
    updatePlayerMovement(); // Bewegung updaten
    updatePlayerPositionInDB(); // DB-Update prüfen
    renderer.render(scene, camera);
    
    stats.end();
}

// Fenster-Resize-Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(); 