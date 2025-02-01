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
        'root',
        '',
        array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
    );

    // Aktion aus der URL holen
    $action = $_GET['action'] ?? '';

    if ($action === 'load') {
        // Lade Welt-Objekte (ohne Spieler)
        $houses = $db->query("SELECT x, z, width, height, depth FROM houses")->fetchAll();
        $trees = $db->query("SELECT x, z, height, is_border FROM trees")->fetchAll();

        $normalTrees = array_filter($trees, fn($tree) => !$tree['is_border']);
        $borderTrees = array_filter($trees, fn($tree) => $tree['is_border']);

        echo json_encode([
            'success' => true,
            'gameState' => [
                'houses' => $houses,
                'trees' => array_values($normalTrees),
                'borderTrees' => array_values($borderTrees)
            ]
        ]);
    } 
    else if ($action === 'loadPlayer') {
        if (!isset($_GET['playerId'])) {
            throw new Exception('Player ID fehlt');
        }

        $playerId = $_GET['playerId'];
        $stmt = $db->prepare("SELECT player_position FROM game_saves WHERE player_id = ?");
        $stmt->execute([$playerId]);
        $result = $stmt->fetch();

        echo json_encode([
            'success' => true,
            'gameState' => [
                'playerPosition' => $result ? json_decode($result['player_position'], true) : null
            ]
        ]);
    }
    else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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