import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Constants } from '../utils/Constants.js';

export class Player {
    constructor(scene, camera, physicsWorld) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        this.moveSpeed = Constants.PLAYER.MOVE_SPEED;
        this.targetPosition = null;
        this.moveDirection = new THREE.Vector3();
        this.keysPressed = {};
        this.cameraDistance = Constants.CAMERA.OFFSET_Z; // Neue Variable für Zoom
        
        this.init();
        this.setupControls();
    }

    init() {
        // Spielerfigur (Zylinder)
        const geometry = new THREE.CylinderGeometry(
            Constants.PLAYER.RADIUS,
            Constants.PLAYER.RADIUS,
            Constants.PLAYER.HEIGHT,
            32
        );
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.position.y = Constants.PLAYER.HEIGHT / 2 + 0.1;
        this.scene.add(this.mesh);

        // Physik für den Spieler
        this.body = new CANNON.Body({
            mass: Constants.PLAYER.MASS,
            shape: new CANNON.Cylinder(
                Constants.PLAYER.RADIUS,
                Constants.PLAYER.RADIUS,
                Constants.PLAYER.HEIGHT,
                32
            ),
            material: new CANNON.Material({
                friction: 0.5,
                restitution: 0.3
            }),
            fixedRotation: true, // Verhindert Umkippen
            updateQuaternion: true
        });
        
        // Kontaktmaterial für verbesserte Kollision
        const playerPhysicsMaterial = new CANNON.Material();
        const worldPhysicsMaterial = new CANNON.Material();
        const contactMaterial = new CANNON.ContactMaterial(
            playerPhysicsMaterial,
            worldPhysicsMaterial,
            {
                friction: 0.5,
                restitution: 0.3
            }
        );
        this.physicsWorld.addContactMaterial(contactMaterial);
        this.body.material = playerPhysicsMaterial;

        this.body.position.copy(this.mesh.position);
        this.body.linearDamping = 0.9; // Bremst die Bewegung sanft ab
        this.physicsWorld.addBody(this.body);
    }

    setupControls() {
        window.addEventListener('keydown', (event) => {
            this.keysPressed[event.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (event) => {
            this.keysPressed[event.key.toLowerCase()] = false;
        });

        // Neue Methode zum Zurücksetzen aller Tasten
        this.resetKeys();

        // Mausklick-Steuerung
        document.addEventListener('click', (e) => {
            if (Object.values(this.keysPressed).some(pressed => pressed)) {
                return; // Ignoriere Mausklicks während WASD gedrückt ist
            }
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );

            raycaster.setFromCamera(mouse, this.camera);
            const intersects = raycaster.intersectObjects(this.scene.children);

            if (intersects.length > 0) {
                this.targetPosition = intersects[0].point;
            }
        });

        // Mausrad-Zoom
        document.addEventListener('wheel', (e) => {
            const zoomSpeed = 2;
            this.cameraDistance = Math.max(
                5, // Minimale Entfernung
                Math.min(
                    40, // Maximale Entfernung
                    this.cameraDistance + e.deltaY * 0.01 * zoomSpeed
                )
            );
        });
    }

    resetKeys() {
        this.keysPressed = {};
        this.targetPosition = null;
    }

    move(x, y, z) {
        // Erhöhte Geschwindigkeit
        const speedMultiplier = 100; // von 30 auf 60 erhöht
        const currentVel = this.body.velocity;
        const targetVel = new CANNON.Vec3(x * speedMultiplier, currentVel.y, z * speedMultiplier);
        
        // Schnellere Interpolation
        this.body.velocity.x += (targetVel.x - currentVel.x) * 0.75; // von 0.35 auf 0.45 erhöht
        this.body.velocity.z += (targetVel.z - currentVel.z) * 0.75;
        
        // Erhöhte maximale Geschwindigkeit
        const maxSpeed = 100; // von 30 auf 60 erhöht
        const currentSpeed = Math.sqrt(
            this.body.velocity.x * this.body.velocity.x + 
            this.body.velocity.z * this.body.velocity.z
        );
        
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            this.body.velocity.x *= scale;
            this.body.velocity.z *= scale;
        }
    }

    // Neue Methode für Mausklick-Bewegung
    moveToTarget() {
        if (!this.targetPosition) return;

        const direction = new THREE.Vector3(
            this.targetPosition.x - this.mesh.position.x,
            0,
            this.targetPosition.z - this.mesh.position.z
        );

        // Wenn wir nah genug am Ziel sind, stoppen
        if (direction.length() < 0.5) {
            this.targetPosition = null;
            return;
        }

        direction.normalize();
        this.move(direction.x, 0, direction.z);
    }

    update() {
        // WASD Bewegung
        const moveVector = new THREE.Vector3(0, 0, 0);
        
        if (this.keysPressed['w']) moveVector.z -= 1;
        if (this.keysPressed['s']) moveVector.z += 1;
        if (this.keysPressed['a']) moveVector.x -= 1;
        if (this.keysPressed['d']) moveVector.x += 1;

        // Normalisiere den Bewegungsvektor für diagonale Bewegung
        if (moveVector.length() > 0) {
            moveVector.normalize();
            this.move(moveVector.x, 0, moveVector.z);
        } else if (this.targetPosition) {
            // Wenn keine Tasten gedrückt sind, prüfe auf Mausklick-Bewegung
            this.moveToTarget();
        }

        // Position aktualisieren
        this.mesh.position.copy(this.body.position);
        
        // Stelle sicher, dass die Figur aufrecht bleibt
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0);
        this.mesh.quaternion.copy(this.body.quaternion);

        // Kamera aktualisieren
        this.updateCamera();
    }

    updateCamera() {
        // Angepasste Kameraposition mit Zoom
        this.camera.position.set(
            this.mesh.position.x,
            this.mesh.position.y + Constants.CAMERA.HEIGHT * (this.cameraDistance / Constants.CAMERA.OFFSET_Z),
            this.mesh.position.z + this.cameraDistance
        );
        this.camera.lookAt(this.mesh.position);
    }

    getPosition() {
        return {
            x: this.mesh.position.x,
            y: this.mesh.position.y,
            z: this.mesh.position.z
        };
    }

    setPosition(position) {
        this.mesh.position.set(position.x, position.y, position.z);
        this.body.position.copy(this.mesh.position);
        this.updateCamera();
    }
}
