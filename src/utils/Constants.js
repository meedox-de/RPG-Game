export const Constants = {
    WORLD: {
        SIZE: 50,           // Weltgröße in Metern
        BLOCK_SIZE: 0.5,    // Blockgröße in Metern
    },
    
    PLAYER: {
        HEIGHT: 1.8,        // Spielerhöhe in Metern
        RADIUS: 0.3,        // Spielerradius in Metern
        MOVE_SPEED: 0.1,    // Bewegungsgeschwindigkeit
        MASS: 5            // Masse für Physikberechnung
    },
    
    CAMERA: {
        FOV: 45,           // Sichtfeld in Grad
        HEIGHT: 20,        // Höhe über Spieler
        OFFSET_Z: 20,      // Versatz nach hinten
        NEAR: 0.1,         // Nahebene
        FAR: 1000          // Fernebene
    },
    
    LIGHTING: {
        SUN_INTENSITY: 1,
        AMBIENT_INTENSITY: 0.4,
        SUN_POSITION: {
            x: 50,
            y: 100,
            z: 50
        }
    },
    
    PHYSICS: {
        GRAVITY: -9.82,    // Erdanziehung in m/s²
        STEP: 1/60,         // Physik-Update-Rate
        PLAYER_FORCE: 60,
        FRICTION: 0.5,
        RESTITUTION: 0.3,
        COLLISION_GROUPS: {
            PLAYER: 1,
            OBSTACLES: 2
        }
    }
};
