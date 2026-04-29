<?php
/**
 * POST /api/login.php
 * Verifica la password e crea la sessione admin.
 * La password non esiste nel frontend — mai.
 */

require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bv_json(['error' => 'Metodo non consentito.'], 405);
}

$ip    = $_SERVER['REMOTE_ADDR'];
$check = bv_rate_limit_check($ip);

if ($check['blocked']) {
    $min = ceil($check['retry_after'] / 60);
    bv_json([
        'authenticated' => false,
        'error' => "Troppi tentativi falliti. Riprova tra {$min} minuti.",
    ], 429);
}

$body = json_decode(file_get_contents('php://input'), true);
$pwd  = trim($body['password'] ?? '');

if ($pwd === '') {
    bv_json(['authenticated' => false, 'error' => 'Password mancante.'], 400);
}

// Confronto sicuro a tempo costante — nessuna timing oracle
$valid = hash_equals(
    hash_hmac('sha256', ADMIN_PASSWORD, 'bv_verify'),
    hash_hmac('sha256', $pwd,           'bv_verify')
);

if (!$valid) {
    bv_rate_limit_fail($check);
    // Log solo server-side, mai al client
    error_log("[BV] Login fallito da {$ip}");
    bv_json(['authenticated' => false, 'error' => 'Password errata.'], 401);
}

// Login riuscito
bv_rate_limit_reset($check);
bv_create_session();
error_log("[BV] Login admin OK da {$ip}");

bv_json([
    'authenticated' => true,
    'expiresIn'     => SESSION_TTL,
]);