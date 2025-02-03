<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

$host = 'localhost';
$db   = 'blockworld';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Datenbankverbindung fehlgeschlagen']);
    exit;
}

// Bei OPTIONS-Request sofort beenden (für CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Debug-Funktion
function debug_to_file($message) {
    error_log(print_r($message, true) . "\n", 3, 'debug.log');
}

try {
    // GET Request: Lade die Welt
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query('SELECT x, y, z, type FROM blocks');
        $blocks = $stmt->fetchAll();
        echo json_encode([
            'success' => true,
            'blocks' => $blocks
        ]);
    }
    // POST Request: Speichere die Welt
    else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['blocks']) || !is_array($data['blocks'])) {
            throw new Exception('Ungültige Daten');
        }

        // Lösche alte Blöcke
        $pdo->exec('TRUNCATE TABLE blocks');
        
        // Füge neue Blöcke ein
        $stmt = $pdo->prepare('INSERT INTO blocks (x, y, z, type) VALUES (?, ?, ?, ?)');
        
        foreach ($data['blocks'] as $block) {
            $stmt->execute([$block['x'], $block['y'], $block['z'], $block['type']]);
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