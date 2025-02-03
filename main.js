import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Konstanten für die Weltgröße
const WORLD_SIZE = 50;
const BLOCK_SIZE = 1;

// Stats für FPS-Anzeige
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// Szene erstellen
const scene = new THREE.Scene();

// Kamera einrichten
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(WORLD_SIZE / 2, WORLD_SIZE * 0.8, WORLD_SIZE * 1.5);
camera.lookAt(WORLD_SIZE / 2, 0, WORLD_SIZE / 2);

// Renderer einrichten
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Beleuchtung einrichten
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 50, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Materialien für die Blöcke
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x3d9e3d });
const dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

// Geometrie für alle Blöcke
const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

// Welt generieren
function generateWorld() {
    for (let x = 0; x < WORLD_SIZE; x++) {
        for (let z = 0; z < WORLD_SIZE; z++) {
            // Zufällige Auswahl des Materials
            const random = Math.random();
            let material;
            
            if (random < 0.4) {
                material = grassMaterial;
            } else if (random < 0.7) {
                material = dirtMaterial;
            } else {
                material = stoneMaterial;
            }

            const block = new THREE.Mesh(blockGeometry, material);
            block.position.set(x + BLOCK_SIZE/2, 0, z + BLOCK_SIZE/2);
            block.castShadow = true;
            block.receiveShadow = true;
            scene.add(block);
        }
    }
}

// Orbit Controls für die Kamera
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.5;
controls.minAzimuthAngle = 0; // Fixiert die Kamera auf Süd-Nord-Blick
controls.maxAzimuthAngle = 0;
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = true;

// Welt generieren
generateWorld();

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