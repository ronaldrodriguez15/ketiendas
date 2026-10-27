<?php
declare(strict_types=1);

namespace App\Services\Sales;

use App\Integrations\PhpPos\PhpPosClient;
use App\Integrations\PhpPos\PosException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class SalesService
{
    public function __construct(private readonly PhpPosClient $client) {}

    public function listing(array $filters): array
    {
        $cache = Cache::store(config('phppos.cache_store'));
        $start = CarbonImmutable::parse($filters['desde'], 'America/Bogota')->startOfDay();
        $end = CarbonImmutable::parse($filters['hasta'], 'America/Bogota')->startOfDay();
        $local = isset($filters['local_id']) ? (int) $filters['local_id'] : null;
        $size = (int) ($filters['per_page'] ?? 10);
        $page = (int) ($filters['page'] ?? 1);
        // Only internal summaries/closing request all rows, never a normal listing.
        $all = $size === PHP_INT_MAX;
        $needed = $all ? PHP_INT_MAX : $page * $size + 1;
        $days = []; $loaded = [];
        for ($day = $end; $day >= $start; $day = $day->subDay()) {
            $key = $day->format('Y-m-d');
            $days[$key] = $day;
            $cached = $cache->get($this->key($key, $local));
            if ($this->usable($cached, $filters)) $loaded[$key] = $cached;
        }
        $query = Str::lower(Str::ascii(trim((string) ($filters['q'] ?? ''))));
        $cutoff = CarbonImmutable::now('America/Bogota')->startOfDay()->subDays(45)->format('Y-m-d');
        $matches = function ($row) use ($filters, $query, $cutoff) {
            return ($query === '' || str_contains(Str::lower(Str::ascii($row['cliente'].' '.$row['id'])), ltrim($query, '#')))
                && (empty($filters['estado']) || $row['estado'] === $filters['estado'])
                && (empty($filters['credito_antiguo']) || ($row['estado'] === 'A crédito' && substr($row['fecha'], 0, 10) < $cutoff))
                && (!isset($filters['cliente_id']) || $row['_cliente_id'] === (int) $filters['cliente_id']);
        };
        $rows = []; $keys = array_keys($days); $fetched = false;
        foreach ($keys as $index => $key) {
            if (!array_key_exists($key, $loaded)) {
                $fetch = [];
                // Probe the newest missing day first; sparse ranges use pools of up to five.
                $batchSize = $all || $fetched ? 5 : 1;
                foreach (array_slice($keys, $index) as $candidate) {
                    if (!array_key_exists($candidate, $loaded)) $fetch[$candidate] = $days[$candidate];
                    if (count($fetch) >= $batchSize) break;
                }
                $failures = [];
                foreach ($this->client->salesForDays($fetch, $local) as $date => $result) {
                    if ($result instanceof PosException) { $failures[] = $result; continue; }
                    $ttl = $date === CarbonImmutable::now('America/Bogota')->format('Y-m-d') ? 120 : 1800;
                    $cache->put($this->key($date, $local), $result, $ttl);
                    $loaded[$date] = $result;
                }
                // No response may pretend a failed day was empty.
                if ($failures) throw $failures[0];
                if (!array_key_exists($key, $loaded)) throw new PosException();
                $fetched = true;
            }
            array_push($rows, ...array_filter($loaded[$key], $matches));
            if (!$all && count($rows) >= $needed) break;
        }
        $complete = count($loaded) === count($days);
        // Cached older days cost no network and permit an exact total.
        if ($complete) $rows = array_values(array_filter(array_merge([], ...array_values($loaded)), $matches));
        usort($rows, fn ($a, $b) => strcmp($b['fecha'], $a['fecha']) ?: $b['id'] <=> $a['id']);
        $total = $complete ? count($rows) : null;
        $slice = array_slice($rows, ($page - 1) * $size, $size);
        $hasMore = count($rows) > $page * $size;
        $meta = [
            'page' => $page, 'per_page' => $size, 'total' => $total, 'has_more' => $hasMore,
            'last_page' => $total === null ? null : max(1, (int) ceil($total / $size)),
            'desde' => $filters['desde'], 'hasta' => $filters['hasta'],
            'total_cobrado' => $complete ? array_sum(array_column(array_filter($rows, fn ($row) => $row['estado'] === 'Pagada'), 'total')) : null,
            'cobrado_pagina' => array_sum(array_column(array_filter($slice, fn ($row) => $row['estado'] === 'Pagada'), 'total')),
            'parcial' => false, 'dias_fallidos' => [],
            'generado_en' => CarbonImmutable::now('America/Bogota')->toIso8601String(),
        ];
        return ['data' => $slice] + array_intersect_key($meta, array_flip(['page', 'per_page', 'total', 'has_more', 'desde', 'hasta'])) + ['meta' => $meta];
    }

    public function summary(array $filters): array
    {
        // Aggregate every sale in the period, never just the visible page.
        $result = $this->listing(array_merge($filters, ['page' => 1, 'per_page' => PHP_INT_MAX]));
        $sales = array_values(array_filter($result['data'], fn ($row) => in_array($row['estado'], ['Pagada', 'A crédito'], true)));
        $credits = array_values(array_filter($sales, fn ($row) => $row['estado'] === 'A crédito'));
        $total = array_sum(array_column($sales, 'total'));
        $days = [];
        $failed = array_flip($result['meta']['dias_fallidos']);
        $end = CarbonImmutable::parse($filters['hasta'], 'America/Bogota');
        for ($day = CarbonImmutable::parse($filters['desde'], 'America/Bogota'); $day <= $end; $day = $day->addDay()) {
            $key = $day->format('Y-m-d');
            $days[$key] = ['fecha' => $key, 'total' => isset($failed[$key]) ? null : 0, 'credito' => isset($failed[$key]) ? null : 0];
        }
        foreach ($sales as $sale) {
            $key = substr($sale['fecha'], 0, 10);
            $days[$key]['total'] += $sale['total'];
            if ($sale['estado'] === 'A crédito') $days[$key]['credito'] += $sale['total'];
        }
        return [
            'resumen' => ['total_ventas' => $total, 'cantidad_ventas' => count($sales),
                'ticket_promedio' => count($sales) ? (int) round($total / count($sales)) : 0,
                'total_credito' => array_sum(array_column($credits, 'total')), 'cantidad_credito' => count($credits),
                'total_cobrado' => $result['meta']['total_cobrado']],
            'dias' => array_values($days), 'ultimas' => array_slice($sales, 0, 6),
            'creditos' => array_slice($credits, 0, 6),
            'meta' => array_intersect_key($result['meta'], array_flip(['desde', 'hasta', 'parcial', 'dias_fallidos', 'generado_en'])),
        ];
    }

    public function detail(int $id): array
    {
        $cache = Cache::store(config('phppos.cache_store'));
        $key = 'ventas:detalle:'.$id;
        if (is_array($hit = $cache->get($key))) return $hit;
        try {
            return $cache->lock($key.':lock', 60)->block(5, fn () => $cache->remember($key, 300, fn () => $this->client->sale($id)));
        } catch (\Illuminate\Contracts\Cache\LockTimeoutException) { throw new PosException(); }
    }

    private function usable(mixed $cached, array $filters): bool
    {
        if (!is_array($cached)) return false;
        // Upgrade older daily cache entries only when the payment breakdown is requested.
        return empty($filters['requiere_pagos']) || count(array_filter($cached, fn ($row) => !array_key_exists('_pagos', $row))) === 0;
    }

    private function key(string $day, ?int $local): string { return 'pos_sales_day:'.$day.($local === null ? '' : ':local:'.$local); }
}
