async loadWorld() {
    try {
        // Erstelle eine Standard-Plattform, da Server nicht erreichbar
        const blocks = [];
        for (let x = -8; x < 8; x++) {
            for (let z = -8; z < 8; z++) {
                blocks.push({
                    x: x,
                    y: z,
                    z: 0,
                    block_type: 'grass'
                });
            }
        }

        // Zurücksetzen der Blockzähler
        Object.keys(this.blockCount).forEach(type => {
            this.blockCount[type] = 0;
        });

        // Optimierte Blockgenerierung mit Instancing
        const matrix = new THREE.Matrix4();
        blocks.forEach(block => {
            const position = new THREE.Vector3(
                block.x,
                block.z,
                block.y
            );
            
            matrix.setPosition(position);
            const type = block.block_type;
            
            if (this.blockCount[type] < 10000) {
                this.instancedMeshes[type].setMatrixAt(this.blockCount[type], matrix);
                this.blockCount[type]++;
            }
        });

        // Update Instanced Meshes
        Object.values(this.instancedMeshes).forEach(mesh => {
            mesh.instanceMatrix.needsUpdate = true;
        });

        // Erstelle Collision Bodies für jeden Block
        blocks.forEach(block => {
            const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
            const body = new CANNON.Body({
                mass: 0,
                position: new CANNON.Vec3(block.x, block.z, block.y),
                shape: shape,
                material: new CANNON.Material({
                    friction: 0.5,
                    restitution: 0.3
                })
            });
            this.physicsWorld.addBody(body);
        });

    } catch (error) {
        console.error('Fehler beim Laden der Welt:', error);
        throw error;
    }
}