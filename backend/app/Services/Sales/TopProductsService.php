<?php
declare(strict_types=1);
namespace App\Services\Sales;

use App\Integrations\PhpPos\PosException;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;

final class TopProductsService
{
    public function __construct(private readonly SalesService $sales) {}

    public function report(array $filters): array
    {
        $today = CarbonImmutable::now('America/Bogota')->startOfDay();
        $start = match ($filters['periodo']) {
            'semana' => $today->startOfWeek(CarbonInterface::MONDAY),
            'mes' => $today->startOfMonth(),
            default => $today,
        };
        $range = ['desde' => $start->format('Y-m-d'), 'hasta' => $today->format('Y-m-d')];
        if (isset($filters['local_id'])) $range['local_id'] = (int) $filters['local_id'];
        $key = 'top_products:v1:'.hash('sha256', config('phppos.url').config('phppos.key').json_encode($range));
        // Reuse whole-period aggregates as well as the shared daily sales cache.
        return Cache::store(config('phppos.cache_store'))->remember($key, 120, function () use ($range) {
            $result = $this->sales->listing($range + ['page' => 1, 'per_page' => PHP_INT_MAX, 'requiere_productos' => true]);
            $groups = []; $transactions = 0; $quantity = 0.0;
            foreach ($result['data'] as $sale) {
                if (!in_array($sale['estado'], ['Pagada', 'A crédito'], true)) continue;
                if (!is_array($sale['_productos'] ?? null)) throw new PosException('invalid_response');
                $seen = [];
                foreach ($sale['_productos'] as $item) {
                    if ($item['cantidad'] <= 0) continue;
                    $id = $item['id'];
                    if (!isset($groups[$id])) $groups[$id] = array_diff_key($item, ['cantidad' => true]) + ['cantidad' => 0.0, 'ventas' => 0];
                    $groups[$id]['cantidad'] += $item['cantidad'];
                    $quantity += $item['cantidad'];
                    if (!isset($seen[$id])) $groups[$id]['ventas']++;
                    $seen[$id] = true;
                }
                if ($seen) $transactions++;
            }
            $rows = array_values($groups);
            usort($rows, fn ($a, $b) => $b['cantidad'] <=> $a['cantidad'] ?: strcmp($a['id'], $b['id']));
            $count = count($rows);
            // Bounded response: full-period aggregation happens BEFORE choosing the top 100.
            $rows = array_slice($rows, 0, 100);
            foreach ($rows as &$row) {
                $row['participacion'] = $quantity > 0 ? round($row['cantidad'] / $quantity * 100, 2) : 0;
                $row['cantidad'] = round($row['cantidad'], 4);
            }
            unset($row);
            return ['data' => $rows, 'resumen' => ['unidades' => round($quantity, 4), 'productos' => $count, 'ventas' => $transactions],
                'meta' => $range + ['limite' => 100, 'generado_en' => CarbonImmutable::now('America/Bogota')->toIso8601String()]];
        });
    }
}
