import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Constants } from '../utils/Constants.js';
import { SaveManager } from '../utils/SaveManager.js';

export class World {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.blockSize = Constants.WORLD.BLOCK_SIZE;
        this.worldSize = Constants.WORLD.SIZE;
        this.houses = [];
        this.trees = [];
        this.borderTrees = [];  // Neue Array für Grenzbäume
        
        this.createGround(); // Nur den Boden erstellen
    }

    init() {
        this.createGround();
        const savedState = this.loadSavedState();
        
        if (savedState) {
            this.loadWorldObjects(savedState);
        } else {
            this.createBorderTrees();
            this.generateTrees();
            this.generateHouses();
        }
    }

    loadSavedState() {
        const saveManager = new SaveManager();
        return saveManager.loadGame();
    }

    loadWorldObjects(savedState) {
        // Häuser laden
        if (savedState.houses) {
            savedState.houses.forEach(house => {
                this.createHouse(house.x, house.z, house.width, house.height, house.depth);
            });
        }

        // Normale Bäume laden
        if (savedState.trees) {
            savedState.trees.forEach(tree => {
                this.createTree(tree.x, tree.z, tree.height);
            });
        }

        // Grenzbäume laden
        if (savedState.borderTrees) {
            savedState.borderTrees.forEach(tree => {
                this.createTree(tree.x, tree.z, tree.height);
            });
        }
    }

    createGround() {
        const geometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 
            this.worldSize/this.blockSize, this.worldSize/this.blockSize);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x567d46,
            roughness: 0.8
        });
        
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Verbesserte Physik für den Boden
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            material: new CANNON.Material({
                friction: 0.5,
                restitution: 0.3
            })
        });
        groundBody.quaternion.setFromAxisAngle(
            new CANNON.Vec3(1, 0, 0),
            -Math.PI / 2
        );
        this.physicsWorld.addBody(groundBody);
    }

    createBorderTrees() {
        const spacing = 2; // Abstand zwischen den Bäumen
        const borderOffset = 1; // Abstand vom Rand
        
        // Äußere Grenzen der Welt
        const worldBorder = this.worldSize / 2;
        
        // Bäume entlang der X-Achse
        for (let x = -worldBorder + borderOffset; x <= worldBorder - borderOffset; x += spacing) {
            // Vordere Grenze (Z = -worldBorder)
            const frontTree = this.createTree(x, -worldBorder + borderOffset, 3);
            this.borderTrees.push({ x: x, z: -worldBorder + borderOffset, height: 3 });
            
            // Hintere Grenze (Z = worldBorder)
            const backTree = this.createTree(x, worldBorder - borderOffset, 3);
            this.borderTrees.push({ x: x, z: worldBorder - borderOffset, height: 3 });
        }
        
        // Bäume entlang der Z-Achse
        for (let z = -worldBorder + borderOffset; z <= worldBorder - borderOffset; z += spacing) {
            // Linke Grenze (X = -worldBorder)
            const leftTree = this.createTree(-worldBorder + borderOffset, z, 3);
            this.borderTrees.push({ x: -worldBorder + borderOffset, z: z, height: 3 });
            
            // Rechte Grenze (X = worldBorder)
            const rightTree = this.createTree(worldBorder - borderOffset, z, 3);
            this.borderTrees.push({ x: worldBorder - borderOffset, z: z, height: 3 });
        }
    }

    createHouse(x, z, width = 2, height = 2, depth = 2) {
        const house = {
            x: x,
            z: z,
            width: width,
            height: height,
            depth: depth
        };
        
        // Erstelle 3D-Objekt
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.7,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Füge Physik hinzu
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: 0,
            position: new CANNON.Vec3(x, height / 2, z),
            shape: shape
        });
        
        this.scene.add(mesh);
        this.physicsWorld.addBody(body);
        
        house.mesh = mesh;
        house.body = body;
        this.houses.push(house);
        
        return house;
    }

    createTree(x, z, height = 3) {
        const tree = {
            x: x,
            z: z,
            height: height
        };
        
        // Stamm
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, height);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4d2926,
            roughness: 0.8
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, height / 2, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        // Baumkrone
        const crownGeometry = new THREE.ConeGeometry(1, 2, 8);
        const crownMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0b5345,
            roughness: 0.7
        });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.set(0, 1.5, 0);
        trunk.add(crown);
        
        // Füge Physik hinzu
        const shape = new CANNON.Cylinder(0.2, 0.2, height, 8);
        const body = new CANNON.Body({
            mass: 0,
            position: new CANNON.Vec3(x, height / 2, z),
            shape: shape
        });
        
        this.scene.add(trunk);
        this.physicsWorld.addBody(body);
        
        tree.mesh = trunk;
        tree.body = body;
        this.trees.push(tree);
        
        return tree;
    }

    generateTrees() {
        const numberOfTrees = 50;
        for(let i = 0; i < numberOfTrees; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 4);
            const z = (Math.random() - 0.5) * (this.worldSize - 4);
            this.createTree(x, z);
        }
    }

    generateHouses() {
        // Keine zufällige Generierung mehr
        // Die Häuser werden bereits in der Game-Klasse aus der DB geladen
        return;
    }

    getWorldState() {
        return {
            houses: this.houses.map(house => ({
                x: house.x,
                z: house.z,
                width: house.width,
                height: house.height,
                depth: house.depth
            })),
            trees: this.trees.map(tree => ({
                x: tree.x,
                z: tree.z,
                height: tree.height
            })),
            borderTrees: this.borderTrees
        };
    }
}
