<?php
declare(strict_types=1);

// Read-only contract diagnostic. Prints field names/types, never values or credentials.
require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (($argv[1] ?? '') === '--measure') {
    $service = $app->make(App\Services\Sales\TopProductsService::class);
    $calls = 0;
    Illuminate\Support\Facades\Log::listen(function ($event) use (&$calls) {
        if ($event->message === 'phppos.request') $calls++;
    });
    foreach (['dia', 'semana', 'mes'] as $period) {
        foreach (['first', 'cached'] as $run) {
            $calls = 0; $started = hrtime(true);
            try {
                $result = $service->report(['periodo' => $period]);
                echo json_encode(['period' => $period, 'run' => $run, 'duration_ms' => round((hrtime(true) - $started) / 1e6, 2),
                    'pos_requests' => $calls, 'rows' => count($result['data']), 'status' => 'ok']).PHP_EOL;
            } catch (App\Integrations\PhpPos\PosException $error) {
                echo json_encode(['period' => $period, 'status' => $error->kind]).PHP_EOL; exit(1);
            }
        }
    }
    exit(0);
}
function shape(mixed $value, int $depth = 0): mixed {
    if (!is_array($value)) return get_debug_type($value);
    if ($depth > 5) return 'array';
    if (array_is_list($value)) return ['count' => count($value), 'first' => $value ? shape($value[0], $depth + 1) : null];
    return array_map(fn ($item) => shape($item, $depth + 1), $value);
}
$day = Carbon\CarbonImmutable::now('America/Bogota')->format('Y-m-d');
$started = hrtime(true);
try {
    $raw = $app->make(App\Integrations\PhpPos\PhpPosClient::class)->topSellers([
        'start_date' => $day.' 00:00:00', 'end_date' => $day.' 23:59:59',
        'order_by' => 'quantity_purchased', 'sale_type' => 'sales', 'limit' => 10, 'offset' => 0,
    ]);
    echo json_encode(['duration_ms' => round((hrtime(true) - $started) / 1e6), 'shape' => shape($raw)], JSON_PRETTY_PRINT).PHP_EOL;
} catch (App\Integrations\PhpPos\PosException $error) {
    echo json_encode(['status' => $error->kind]).PHP_EOL;
    if ($error->kind === 'report_not_available') {
        $bundle = config('phppos.ca_bundle');
        $response = Illuminate\Support\Facades\Http::baseUrl(config('phppos.url'))
            ->withHeaders(['x-api-key' => config('phppos.key')])->acceptJson()->timeout(25)
            ->withOptions(['allow_redirects' => false, 'verify' => is_string($bundle) && is_file($bundle) ? $bundle : true])
            ->get('/sales', ['start_date' => $day.'T05:00:00Z', 'end_date' => Carbon\CarbonImmutable::parse($day)->addDay()->format('Y-m-d').'T04:59:59Z']);
        $raw = $response->json();
        echo json_encode(['sales_status' => $response->status(), 'shape' => shape($raw)], JSON_PRETTY_PRINT).PHP_EOL;
    }
    exit(1);
}
