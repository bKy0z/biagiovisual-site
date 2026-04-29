<?php
/**
 * POST /api/logout.php
 */

require_once __DIR__ . '/auth.php';

bv_destroy_session();
bv_json(['success' => true]);