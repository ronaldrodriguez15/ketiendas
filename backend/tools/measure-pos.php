<?php
declare(strict_types=1);

// Manual read-only diagnostic, never scheduled. No response bodies or credentials are printed.
require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$date = $argv[1] ?? Carbon\CarbonImmutable::now('America/Bogota')->format('Y-m-d');
$today = Carbon\CarbonImmutable::createFromFormat('!Y-m-d', $date, 'America/Bogota');
if (!$today || $today->format('Y-m-d') !== $date) exit("Invalid date.\n");
$calls = [];
Illuminate\Support\Facades\Log::listen(function ($event) use (&$calls) {
    if ($event->message === 'phppos.request') $calls[] = $event->context;
});
$service = $app->make(App\Services\Sales\SalesService::class);
$filters = ['desde' => $today->subDays(6)->format('Y-m-d'), 'hasta' => $date, 'page' => 1, 'per_page' => 10];
foreach (['first', 'cached'] as $label) {
    $calls = [];
    $started = hrtime(true);
    try {
        $result = $service->listing($filters);
        $summary = ['run' => $label, 'status' => 'ok', 'duration_ms' => round((hrtime(true) - $started) / 1e6, 2),
            'rows' => count($result['data']), 'total' => $result['total'], 'has_more' => $result['has_more'], 'calls' => $calls];
    } catch (App\Integrations\PhpPos\PosException $error) {
        $summary = ['run' => $label, 'status' => $error->kind, 'duration_ms' => round((hrtime(true) - $started) / 1e6, 2), 'calls' => $calls];
    }
    echo json_encode($summary, JSON_UNESCAPED_SLASHES).PHP_EOL;
    if ($summary['status'] !== 'ok') exit(1);
}
