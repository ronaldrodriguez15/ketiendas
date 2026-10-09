<?php
declare(strict_types=1);

namespace App\Integrations\PhpPos;

use App\Services\Sales\SaleMapper;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

final class PhpPosClient
{
    public function __construct(private readonly SaleMapper $mapper) {}

    public function salesForDay(CarbonInterface $dia, ?int $localId = null): array
    {
        $key = $dia->format('Y-m-d');
        $result = $this->salesForDays([$key => $dia], $localId)[$key];
        if ($result instanceof PosException) throw $result;
        return $result;
    }

    /** @return array<string, array|PosException> Reduced rows only, never raw response bodies. */
    public function salesForDays(array $days, ?int $localId = null): array
    {
        $results = [];
        foreach (array_chunk($days, min(3, max(1, (int) config('phppos.concurrencia'))), true) as $chunk) {
            $pending = $chunk; $rows = []; $offsets = []; $totals = [];
            foreach ($chunk as $key => $day) { $rows[$key] = []; $offsets[$key] = 0; }
            while ($pending) {
                $queries = [];
                foreach ($pending as $key => $day) {
                    $queries[$key] = ['path' => '/sales', 'query' => array_filter([
                        'start_date' => $day->copy()->startOfDay()->format('Y-m-d\TH:i:sP'),
                        'end_date' => $day->copy()->endOfDay()->format('Y-m-d\TH:i:sP'),
                        'location_id' => $localId,
                        'limit' => config('phppos.paginated') ? (int) config('phppos.page_size') : null,
                        'offset' => config('phppos.paginated') ? $offsets[$key] : null,
                    ], fn ($v) => $v !== null)];
                }
                $responses = $this->batch($queries);
                foreach ($pending as $key => $day) {
                    try {
                        $response = $responses[$key];
                        $this->ensureResponse($response);
                        $raw = $response->json();
                        $raw = isset($raw['data']) ? $raw['data'] : $raw;
                        if (!is_array($raw) || !array_is_list($raw)) throw new PosException();
                        $count = count($raw);
                        $header = $response->header('x-total-records');
                        $total = ctype_digit((string) $header) ? (int) $header : null;
                        if (isset($totals[$key]) && $total !== $totals[$key]) throw new PosException();
                        $totals[$key] = $total;
                        foreach ($raw as $sale) {
                            $row = $this->mapper->map($sale);
                            if (substr($row['fecha'], 0, 10) !== $key || isset($rows[$key][$row['id']])) throw new PosException();
                            $rows[$key][$row['id']] = $row;
                        }
                        unset($raw);
                        $offsets[$key] += $count;
                        $size = (int) config('phppos.page_size');
                        $done = $total !== null ? $offsets[$key] >= $total : $count < $size;
                        if (!config('phppos.paginated')) {
                            // Without a count header, completeness cannot be established on this POS.
                            if ($total === null || $count < $total) throw new PosException();
                            $done = true;
                        }
                        if ($done) {
                            $results[$key] = array_values($rows[$key]); unset($pending[$key]);
                        } elseif ($count === 0 || $offsets[$key] >= $size * (int) config('phppos.max_pages')) {
                            throw new PosException();
                        }
                    } catch (Throwable $error) {
                        $results[$key] = $error instanceof PosException ? $error : new PosException();
                        unset($pending[$key], $rows[$key]);
                    }
                    unset($responses[$key], $response, $raw);
                }
            }
        }
        return $results;
    }

    public function sale(int $id): array
    {
        $response = $this->batch(['detail' => ['path' => '/sales/'.$id, 'query' => []]])['detail'];
        $this->ensureResponse($response);
        $raw = $response->json();
        $raw = $raw['data'] ?? $raw;
        if (!is_array($raw) || !isset($raw['sale_id'])) throw new PosException();
        return $this->mapper->detail($raw);
    }

    private function request(PendingRequest $request): PendingRequest
    {
        return $request->baseUrl((string) config('phppos.url'))
            ->withHeaders(['x-api-key' => (string) config('phppos.key')])->acceptJson()
            ->timeout((int) config('phppos.timeout'))->connectTimeout((int) config('phppos.connect_timeout'))
            ->retry(2, 300, throw: false)->withOptions(['allow_redirects' => false]);
    }

    private function batch(array $queries): array
    {
        try {
            if (!config('phppos.key') || !str_starts_with((string) config('phppos.url'), 'https://')) throw new PosException('auth');
            // Shared gate also bounds concurrency across PHP workers and the warmer.
            $ttl = 2 * max((int) config('phppos.timeout'), (int) config('phppos.connect_timeout')) + 15;
            return Cache::store(config('phppos.cache_store'))->lock('phppos:http-pool', $ttl)->block(10, function () use ($queries) {
                return Http::pool(function (Pool $pool) use ($queries) {
                    foreach ($queries as $key => $query) {
                        $this->request($pool->as((string) $key))->get($query['path'], $query['query']);
                    }
                }, concurrency: min(3, max(1, (int) config('phppos.concurrencia'))));
            });
        } catch (Throwable $error) {
            return array_fill_keys(array_keys($queries), $error instanceof PosException ? $error : new PosException());
        }
    }

    private function ensureResponse(mixed $response): void
    {
        if ($response instanceof PosException) throw $response;
        if (!$response instanceof Response) throw new PosException();
        if (in_array($response->status(), [401, 403], true)) throw new PosException('auth');
        if ($response->status() === 404) throw new PosException('not_found');
        if (!$response->successful()) throw new PosException();
    }
}
