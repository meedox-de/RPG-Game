import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { InstancedMesh } from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

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
// Kamera weiter nach unten neigen
camera.position.set(
    WORLD_SIZE * 0.5,  // Zentrum X
    WORLD_SIZE * 1,  // Höhe reduziert (war 0.8)
    WORLD_SIZE * 1.5   // Abstand
);
camera.lookAt(WORLD_SIZE * 0.5, -WORLD_SIZE * 0.2, WORLD_SIZE * 0.5); // Blick nach unten angepasst

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

// Noise-Funktion für das Terrain
const noise = new SimplexNoise();

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

// Terrain-Generierungs-Funktionen
function getTerrainHeight(x, z) {
    // Noch kleinere Skalierung für breitere Hügel
    const scale1 = 0.004; // Große Hügel (war 0.008) - macht die Hügel breiter
    const scale2 = 0.01;  // Mittlere Details (war 0.02) - breitere mittlere Strukturen
    const scale3 = 0.02;  // Kleine Details (war 0.04) - sanftere kleine Details

    // Höhenamplituden bleiben gleich für gleiche Höhe
    const height1 = noise.noise(x * scale1, z * scale1) * 15;
    const height2 = noise.noise(x * scale2, z * scale2) * 5;
    const height3 = noise.noise(x * scale3, z * scale3) * 2;

    // Kombiniere die Höhen
    let height = height1 + height2 + height3;

    // Fluss-Generierung bleibt gleich
    const riverNoise = noise.noise(x * 0.005, z * 0.005);
    const riverPath = Math.abs(riverNoise);
    
    if (riverPath < 0.05) {
        const distanceToRiver = riverPath / 0.05;
        const riverDepth = 8;
        const riverHeight = WATER_LEVEL - riverDepth * (1 - distanceToRiver * distanceToRiver);
        height = Math.min(height, riverHeight);
    }

    // Grundhöhe anheben und glätten
    height = Math.floor(height + 10);
    
    return height;
}

// Modifizierte generateWorld-Funktion
async function generateWorld() {
    const blocks = [];
    const tempBlocks = new Map();

    console.log('Starte Weltgenerierung...');

    // Erste Schleife: Generiere alle Blöcke
    for (let x = 0; x < WORLD_SIZE; x++) {
        for (let z = 0; z < WORLD_SIZE; z++) {
            const surfaceHeight = getTerrainHeight(x, z);

            for (let y = MIN_HEIGHT; y <= Math.max(surfaceHeight, WATER_LEVEL); y++) {
                let blockType;

                // Neue Block-Typ-Bestimmung
                if (y <= surfaceHeight) {
                    if (y === surfaceHeight) {
                        blockType = 'grass';
                    } else if (y > surfaceHeight - 5) {
                        blockType = 'dirt';
                    } else {
                        blockType = 'stone';
                    }
                } else if (y <= WATER_LEVEL) {
                    blockType = 'water';
                }

                if (blockType) {
                    const block = {
                        x: x,
                        y: y,
                        z: z,
                        type: blockType
                    };
                    tempBlocks.set(`${x},${y},${z}`, block);
                }
            }
        }
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

    console.log('Weltgenerierung abgeschlossen');
    return blocks;
}

// Modifizierte Weltlade-Funktion (ersetzt generateWorld)
async function loadAndDisplayWorld() {
    console.log('Lade Welt aus Datenbank...');
    const blocks = [];
    const tempBlocks = new Map();

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
        return blocks;
    } catch (error) {
        console.error('Fehler beim Laden der Welt:', error);
        alert('Fehler beim Laden der Welt!');
    }
}

// Initialisierung anpassen
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starte Anwendung...');
    loadAndDisplayWorld();
});

// OrbitControls anpassen für besseren Blickwinkel
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minPolarAngle = Math.PI / 4; // Minimaler Winkel hinzugefügt
controls.minDistance = 10;
controls.maxDistance = WORLD_SIZE * 2;
controls.target.set(WORLD_SIZE * 0.5, 0, WORLD_SIZE * 0.5);
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;

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

// Animation
function animate() {
    stats.begin();
    
    requestAnimationFrame(animate);
    controls.update();
    updateCompass();
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