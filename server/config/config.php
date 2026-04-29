<?php
/**
 * BIAGIOVISUALS — Configurazione Admin
 * ─────────────────────────────────────────────────────────────────
 * Questo è l'UNICO file dove imposti la password.
 * Non viene mai inviato al browser. Non esiste nel frontend.
 * ─────────────────────────────────────────────────────────────────
 *
 * SETUP: cambia solo la riga ADMIN_PASSWORD con la tua password.
 * Poi non toccare più questo file.
 */

// ── LA TUA PASSWORD ADMIN ─────────────────────────────────────────
define('ADMIN_PASSWORD', 'Biagio@2007');
// ─────────────────────────────────────────────────────────────────

// Durata sessione in secondi (default: 7200 = 2 ore)
define('SESSION_TTL', 7200);

// Rate limiting: max tentativi per IP prima del blocco
define('MAX_ATTEMPTS', 10);

// Blocco in secondi dopo troppi tentativi (900 = 15 minuti)
define('LOCKOUT_SECONDS', 900);

// Cartella upload foto (relativa alla root del sito)
define('UPLOADS_DIR', __DIR__ . '/../uploads/');
define('UPLOADS_URL', 'uploads/');

// File database foto
define('DATA_FILE', __DIR__ . '/../data/photos.json');

// ─── Non modificare sotto questa riga ───────────────────────────

// Blocca accesso diretto a questo file
if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(403);
    exit('Accesso negato.');
}