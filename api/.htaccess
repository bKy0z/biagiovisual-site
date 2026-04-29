<?php
/**
 * GET /api/check.php
 * Controlla se la sessione admin è ancora valida.
 */

require_once __DIR__ . '/auth.php';

bv_session_start();

if (!bv_is_authenticated()) {
    bv_json(['authenticated' => false]);
}

bv_json([
    'authenticated' => true,
    'expiresAt'     => $_SESSION['bv_expires'] * 1000, // ms per JS
]);