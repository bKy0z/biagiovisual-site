<?php
/**
 * BIAGIOVISUALS — Auth helpers
 * Gestione sessione PHP e rate limiting su file.
 */

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(403); exit;
}

require_once __DIR__ . '/config.php';

// ── Avvia sessione sicura ─────────────────────────────────────────
function bv_session_start() {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => SESSION_TTL,
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']),  // HTTPS in produzione
            'httponly' => true,   // JS non può leggere il cookie
            'samesite' => 'Strict',
        ]);
        session_start();
    }
}

// ── Verifica se la sessione admin è valida ───────────────────────
function bv_is_authenticated() {
    bv_session_start();
    if (empty($_SESSION['bv_admin']) || empty($_SESSION['bv_expires'])) return false;
    if (time() > $_SESSION['bv_expires']) {
        session_destroy();
        return false;
    }
    return $_SESSION['bv_admin'] === true;
}

// ── Crea sessione dopo login riuscito ────────────────────────────
function bv_create_session() {
    bv_session_start();
    session_regenerate_id(true); // previene session fixation
    $_SESSION['bv_admin']   = true;
    $_SESSION['bv_expires'] = time() + SESSION_TTL;
    $_SESSION['bv_ip']      = $_SERVER['REMOTE_ADDR'];
}

// ── Distrugge la sessione ────────────────────────────────────────
function bv_destroy_session() {
    bv_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 86400,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// ── Rate limiting basato su file ─────────────────────────────────
function bv_rate_limit_check($ip) {
    $dir  = sys_get_temp_dir() . '/bv_rl/';
    if (!is_dir($dir)) mkdir($dir, 0700, true);

    $key  = $dir . 'ip_' . md5($ip) . '.json';
    $now  = time();
    $data = ['attempts' => 0, 'first_at' => $now, 'locked_until' => 0];

    if (file_exists($key)) {
        $data = json_decode(file_get_contents($key), true) ?: $data;
    }

    // Se è ancora bloccato
    if ($data['locked_until'] > $now) {
        $wait = $data['locked_until'] - $now;
        return ['blocked' => true, 'retry_after' => $wait];
    }

    // Reset finestra se scaduta
    if (($now - $data['first_at']) > LOCKOUT_SECONDS) {
        $data = ['attempts' => 0, 'first_at' => $now, 'locked_until' => 0];
    }

    return ['blocked' => false, 'data' => $data, 'key' => $key, 'now' => $now];
}

function bv_rate_limit_fail($check) {
    if ($check['blocked']) return;
    $data      = $check['data'];
    $data['attempts']++;
    if ($data['attempts'] >= MAX_ATTEMPTS) {
        $data['locked_until'] = $check['now'] + LOCKOUT_SECONDS;
    }
    file_put_contents($check['key'], json_encode($data), LOCK_EX);
}

function bv_rate_limit_reset($check) {
    if (!empty($check['key'])) {
        @unlink($check['key']);
    }
}

// ── JSON response helpers ────────────────────────────────────────
function bv_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    echo json_encode($data);
    exit;
}

function bv_require_auth() {
    if (!bv_is_authenticated()) {
        bv_json(['error' => 'Non autorizzato.'], 401);
    }
}

// ── Helpers database foto ─────────────────────────────────────────
function bv_read_db() {
    if (!file_exists(DATA_FILE)) return ['photos' => []];
    $raw = file_get_contents(DATA_FILE);
    return json_decode($raw, true) ?: ['photos' => []];
}

function bv_write_db($data) {
    $dir = dirname(DATA_FILE);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function bv_gen_id() {
    return bin2hex(random_bytes(16));
}