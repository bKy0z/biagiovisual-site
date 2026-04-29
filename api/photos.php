<?php
/**
 * /api/photos.php
 * ─────────────────────────────────────────────
 * GET              → lista foto (pubblico)
 * POST             → carica foto (auth)
 * DELETE ?id=...   → elimina foto (auth)
 * PUT    ?id=...   → aggiorna categoria/titolo (auth)
 */

require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'];

/* ── GET: lista pubblica ── */
if ($method === 'GET') {
    $db = bv_read_db();
    bv_json(['photos' => $db['photos']]);
}

/* ── POST: carica foto (richiede auth) ── */
if ($method === 'POST') {
    bv_require_auth();

    if (empty($_FILES['image'])) {
        bv_json(['error' => 'Nessun file ricevuto.'], 400);
    }

    $file     = $_FILES['image'];
    $allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $maxSize  = 25 * 1024 * 1024; // 25 MB

    if ($file['error'] !== UPLOAD_ERR_OK) {
        bv_json(['error' => 'Errore nel caricamento.'], 400);
    }
    if ($file['size'] > $maxSize) {
        bv_json(['error' => 'File troppo grande (max 25 MB).'], 400);
    }

    // Verifica mime type reale (non solo l'estensione dichiarata)
    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeReal = $finfo->file($file['tmp_name']);

    if (!in_array($mimeReal, $allowed)) {
        bv_json(['error' => 'Formato non supportato. Usa JPG, PNG o WEBP.'], 400);
    }

    $category = $_POST['category'] ?? '';
    if (!in_array($category, ['eventi', 'ritratti', 'social'])) {
        bv_json(['error' => 'Categoria non valida.'], 400);
    }

    $title = mb_substr(strip_tags($_POST['title'] ?? 'Senza titolo'), 0, 100);

    // Estensione sicura dall'mime type reale
    $extMap = [
        'image/jpeg' => '.jpg',
        'image/png'  => '.png',
        'image/webp' => '.webp',
        'image/gif'  => '.gif',
    ];
    $ext      = $extMap[$mimeReal] ?? '.jpg';
    $filename = bv_gen_id() . $ext;

    // Crea cartella uploads se non esiste
    if (!is_dir(UPLOADS_DIR)) {
        mkdir(UPLOADS_DIR, 0755, true);
        // .htaccess di protezione: blocca esecuzione di PHP dentro uploads
        file_put_contents(UPLOADS_DIR . '.htaccess',
            "Options -Indexes\nAddType text/plain .php .php5 .phtml\n"
        );
    }

    $destPath = UPLOADS_DIR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        bv_json(['error' => 'Impossibile salvare il file.'], 500);
    }

    $photo = [
        'id'       => bv_gen_id(),
        'filename' => $filename,
        'url'      => UPLOADS_URL . $filename,
        'title'    => $title,
        'category' => $category,
        'date'     => date('c'),
        'size'     => $file['size'],
    ];

    $db = bv_read_db();
    array_unshift($db['photos'], $photo); // più recenti prima
    bv_write_db($db);

    error_log("[BV] Foto caricata: {$filename} ({$category})");
    bv_json(['success' => true, 'photo' => $photo], 201);
}

/* ── DELETE: elimina foto (richiede auth) ── */
if ($method === 'DELETE') {
    bv_require_auth();

    $id = $_GET['id'] ?? '';
    if (!$id) bv_json(['error' => 'ID mancante.'], 400);

    $db  = bv_read_db();
    $idx = -1;
    foreach ($db['photos'] as $i => $p) {
        if ($p['id'] === $id) { $idx = $i; break; }
    }

    if ($idx === -1) bv_json(['error' => 'Foto non trovata.'], 404);

    $photo = $db['photos'][$idx];
    array_splice($db['photos'], $idx, 1);
    bv_write_db($db);

    // Elimina file fisico
    $filePath = UPLOADS_DIR . $photo['filename'];
    if (file_exists($filePath)) @unlink($filePath);

    error_log("[BV] Foto eliminata: {$photo['filename']}");
    bv_json(['success' => true]);
}

/* ── PUT: aggiorna categoria/titolo (richiede auth) ── */
if ($method === 'PUT') {
    bv_require_auth();

    $id   = $_GET['id'] ?? '';
    if (!$id) bv_json(['error' => 'ID mancante.'], 400);

    $body     = json_decode(file_get_contents('php://input'), true) ?: [];
    $category = $body['category'] ?? null;
    $title    = $body['title']    ?? null;

    if ($category && !in_array($category, ['eventi', 'ritratti', 'social'])) {
        bv_json(['error' => 'Categoria non valida.'], 400);
    }

    $db  = bv_read_db();
    $idx = -1;
    foreach ($db['photos'] as $i => $p) {
        if ($p['id'] === $id) { $idx = $i; break; }
    }
    if ($idx === -1) bv_json(['error' => 'Foto non trovata.'], 404);

    if ($category) $db['photos'][$idx]['category']  = $category;
    if ($title)    $db['photos'][$idx]['title']      = mb_substr(strip_tags($title), 0, 100);
    $db['photos'][$idx]['updatedAt'] = date('c');

    bv_write_db($db);
    bv_json(['success' => true, 'photo' => $db['photos'][$idx]]);
}

bv_json(['error' => 'Metodo non consentito.'], 405);