<?php
declare(strict_types=1);

return [
    'url' => rtrim((string) env('PHPPOS_URL', ''), '/'),
    'key' => env('PHPPOS_API_KEY', ''),
    'ttl_hoy' => (int) env('PHPPOS_TTL_HOY', 60),
    'ttl_pasado' => (int) env('PHPPOS_TTL_PASADO', 900),
    'max_dias' => 31,
    'concurrencia' => min(3, max(1, (int) env('PHPPOS_CONCURRENCIA', 3))),
    'timeout' => 20,
    'connect_timeout' => 5,
    'paginated' => (bool) env('PHPPOS_PAGINATED', true),
    'page_size' => 100,
    'max_pages' => 50,
    'cache_store' => env('PHPPOS_CACHE_STORE', 'file'),
    'timezone' => 'America/Bogota',
];
