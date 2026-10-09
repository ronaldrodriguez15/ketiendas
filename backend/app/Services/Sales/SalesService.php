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
        $loaded = []; $missing = []; $failed = [];
        for ($day = $start; $day <= $end; $day = $day->addDay()) {
            $key = $day->format('Y-m-d');
            $cached = $cache->get($this->key($key, $local));
            if (is_array($cached)) $loaded[$key] = $cached;
            else $missing[$key] = $day;
        }
        foreach (array_chunk($missing, min(3, max(1, (int) config('phppos.concurrencia'))), true) as $chunk) {
            $locks = []; $fetch = [];
            try {
                foreach ($chunk as $key => $day) {
                    // Lease covers even the configured worst case of all pages and retries.
                    $lease = (int) config('phppos.max_pages') * (2 * (int) config('phppos.timeout') + 30) + 60;
                    $lock = $cache->lock($this->key($key, $local).':lock', $lease);
                    try {
                        $lock->block(5); $locks[$key] = $lock;
                        $cached = $cache->get($this->key($key, $local));
                        if (is_array($cached)) $loaded[$key] = $cached;
                        else $fetch[$key] = $day;
                    } catch (\Illuminate\Contracts\Cache\LockTimeoutException) { $failed[$key] = new PosException(); }
                }
                foreach ($this->client->salesForDays($fetch, $local) as $key => $rows) {
                    if ($rows instanceof PosException) { $failed[$key] = $rows; continue; }
                    $ttl = $key === CarbonImmutable::now('America/Bogota')->format('Y-m-d') ? config('phppos.ttl_hoy') : config('phppos.ttl_pasado');
                    $cache->put($this->key($key, $local), $rows, (int) $ttl);
                    $loaded[$key] = $rows;
                }
            } finally { foreach ($locks as $lock) $lock->release(); }
        }
        if (!$loaded && $failed) {
            foreach ($failed as $error) if ($error->kind === 'auth') throw $error;
            throw new PosException();
        }
        $query = Str::lower(Str::ascii(trim((string) ($filters['q'] ?? ''))));
        $rows = array_values(array_filter(array_merge([], ...array_values($loaded)), function ($row) use ($filters, $query) {
            return ($query === '' || str_contains(Str::lower(Str::ascii($row['cliente'].' '.$row['id'])), ltrim($query, '#')))
                && (empty($filters['estado']) || $row['estado'] === $filters['estado'])
                && (!isset($filters['cliente_id']) || $row['_cliente_id'] === (int) $filters['cliente_id']);
        }));
        usort($rows, fn ($a, $b) => strcmp($b['fecha'], $a['fecha']) ?: $b['id'] <=> $a['id']);
        $total = count($rows); $size = (int) ($filters['per_page'] ?? 10);
        $last = max(1, (int) ceil($total / $size)); $page = min((int) ($filters['page'] ?? 1), $last);
        return ['data' => array_slice($rows, ($page - 1) * $size, $size), 'meta' => [
            'page' => $page, 'per_page' => $size, 'total' => $total, 'last_page' => $last,
            'desde' => $filters['desde'], 'hasta' => $filters['hasta'],
            'total_cobrado' => array_sum(array_column(array_filter($rows, fn ($r) => $r['estado'] === 'Pagada'), 'total')),
            'parcial' => count($failed) > 0, 'dias_fallidos' => array_keys($failed),
            'generado_en' => CarbonImmutable::now('America/Bogota')->toIso8601String(),
        ]];
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

    private function key(string $day, ?int $local): string { return 'ventas:'.($local ?? 'all').':'.$day; }
}
