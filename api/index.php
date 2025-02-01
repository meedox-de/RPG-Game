<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Bei OPTIONS-Request sofort beenden (für CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Debug-Funktion
function debug_to_file($message) {
    error_log(print_r($message, true) . "\n", 3, 'debug.log');
}

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=rpg-game',
        'root', // Dein Datenbankbenutzer
        '',     // Dein Datenbankpasswort
        array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8'
        )
    );

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!isset($_GET['playerId'])) {
            throw new Exception('Player ID nicht angegeben');
        }

        $playerId = $_GET['playerId'];
        
        // Spielerposition laden
        $stmt = $db->prepare("SELECT player_position FROM game_saves WHERE player_id = ?");
        $stmt->execute([$playerId]);
        $result = $stmt->fetch();

        // Lade alle Häuser
        $stmt = $db->prepare("SELECT x, z, width, height, depth, color FROM houses");
        $stmt->execute();
        $houses = $stmt->fetchAll();

        // Lade alle Bäume
        $stmt = $db->prepare("SELECT x, z, height, color, is_border FROM trees");
        $stmt->execute();
        $trees = $stmt->fetchAll();

        // Verarbeite Bäume
        $normalTrees = [];
        $borderTrees = [];
        foreach ($trees as $tree) {
            $treeData = [
                'x' => (float)$tree['x'],
                'z' => (float)$tree['z'],
                'height' => (float)$tree['height'],
                'color' => (int)$tree['color']
            ];
            if ($tree['is_border']) {
                $borderTrees[] = $treeData;
            } else {
                $normalTrees[] = $treeData;
            }
        }

        // Konvertiere Haustypen
        $houses = array_map(function($house) {
            return [
                'x' => (float)$house['x'],
                'z' => (float)$house['z'],
                'width' => (float)$house['width'],
                'height' => (float)$house['height'],
                'depth' => (float)$house['depth'],
                'color' => (int)$house['color']
            ];
        }, $houses);

        echo json_encode([
            'success' => true,
            'gameState' => [
                'playerPosition' => $result ? json_decode($result['player_position'], true) : null,
                'houses' => $houses,
                'trees' => $normalTrees,
                'borderTrees' => $borderTrees
            ]
        ], JSON_NUMERIC_CHECK);

    } else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (!$data || !isset($data['playerId']) || !isset($data['gameState'])) {
            throw new Exception('Ungültige Eingabedaten');
        }

        $playerId = $data['playerId'];
        $gameState = $data['gameState'];

        // Überprüfe ob Spieler existiert
        $stmt = $db->prepare("SELECT player_id FROM game_saves WHERE player_id = ?");
        $stmt->execute([$playerId]);
        
        if (!$stmt->fetch()) {
            $stmt = $db->prepare("INSERT INTO game_saves (player_id, player_position) VALUES (?, ?)");
            $stmt->execute([$playerId, json_encode($gameState['playerPosition'])]);
        } else {
            $stmt = $db->prepare("UPDATE game_saves SET player_position = ? WHERE player_id = ?");
            $stmt->execute([json_encode($gameState['playerPosition']), $playerId]);
        }

        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    debug_to_file("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 