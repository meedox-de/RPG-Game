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

        // Bäume laden
        if (savedState.trees) {
            savedState.trees.forEach(tree => {
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
        const borderOffset = this.blockSize * 2;
        
        for(let x = -this.worldSize/2; x <= this.worldSize/2; x += this.blockSize * 2) {
            this.createTree(x, -this.worldSize/2 + borderOffset);
            this.createTree(x, this.worldSize/2 - borderOffset);
            this.createTree(-this.worldSize/2 + borderOffset, x);
            this.createTree(this.worldSize/2 - borderOffset, x);
        }
    }

    createTree(x, z, height = null) {
        height = height || 2 + Math.random() * 2;
        const geometry = new THREE.ConeGeometry(1, height, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        
        const tree = new THREE.Mesh(geometry, material);
        tree.position.set(x, height/2, z);
        tree.castShadow = true;
        tree.receiveShadow = true;
        this.scene.add(tree);

        // Verbesserte Physik für den Baum
        const treeBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Cylinder(1, 1, height, 8),
            material: new CANNON.Material({
                friction: 0.5,
                restitution: 0.3
            })
        });
        treeBody.position.set(x, height/2, z);
        this.physicsWorld.addBody(treeBody);
        
        // Kollisionsgruppe für Bäume
        treeBody.collisionFilterGroup = 2;
        treeBody.collisionFilterMask = 1; // Kollidiert nur mit Spieler

        this.trees.push({
            x, z, height
        });
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
        const numberOfHouses = 10;
        for(let i = 0; i < numberOfHouses; i++) {
            this.createHouse(
                (Math.random() - 0.5) * (this.worldSize - 8),
                (Math.random() - 0.5) * (this.worldSize - 8)
            );
        }
    }

    createHouse(x, z, width = null, height = null, depth = null) {
        width = width || 3 + Math.random() * 2;
        height = height || 4 + Math.random() * 2;
        depth = depth || 3 + Math.random() * 2;

        // Hauswände
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        
        const house = new THREE.Mesh(geometry, material);
        house.position.set(x, height/2, z);
        house.castShadow = true;
        house.receiveShadow = true;
        this.scene.add(house);

        // Dach
        const roofGeometry = new THREE.ConeGeometry(Math.max(width, depth)/1.5, height/2, 4);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(x, height + height/4, z);
        roof.castShadow = true;
        this.scene.add(roof);

        // Verbesserte Physik für das Haus
        const houseBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2)),
            material: new CANNON.Material({
                friction: 0.5,
                restitution: 0.3
            })
        });
        houseBody.position.set(x, height/2, z);
        this.physicsWorld.addBody(houseBody);
        
        // Kollisionsgruppe für Häuser
        houseBody.collisionFilterGroup = 2;
        houseBody.collisionFilterMask = 1; // Kollidiert nur mit Spieler

        this.houses.push({
            x, z, width, height, depth
        });
    }

    getWorldState() {
        return {
            houses: this.houses,
            trees: this.trees
        };
    }
}
