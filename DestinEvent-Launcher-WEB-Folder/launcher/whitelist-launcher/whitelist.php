<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$file = __DIR__ . '/whitelist.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    if ($input) {
        $decoded = json_decode($input, true);
        if ($decoded !== null) {
            file_put_contents($file, json_encode($decoded, JSON_PRETTY_PRINT));
            echo json_encode(['status' => 'success', 'data' => $decoded]);
            exit();
        }
    }
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit();
}

if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    $defaultData = [
        'enabled' => true,
        'players' => ['GimoveTv', 'GimoveTTv', 'KillaIsBack'],
        'staffs' => ['GimoveTv', 'GimoveTTv', 'KillaIsBack'],
        'announcement' => ['active' => false, 'text' => ''],
        'rolloutStartTime' => null
    ];
    file_put_contents($file, json_encode($defaultData, JSON_PRETTY_PRINT));
    echo json_encode($defaultData);
}
?>
