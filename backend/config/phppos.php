<?php
declare(strict_types=1);
return [
    'url' => rtrim((string) env('PHPPOS_URL', ''), '/'),
    'key' => env('PHPPOS_API_KEY', ''),
    'ttl_hoy' => 120,
    'ttl_pasado' => 1800,
    'max_dias' => 31,
    'concurrencia' => 5,
    'timeout' => 25,
    'connect_timeout' => 10,
    'ca_bundle' => env('PHPPOS_CA_BUNDLE'),
    'cache_store' => 'file',
    'timezone' => 'America/Bogota',
];