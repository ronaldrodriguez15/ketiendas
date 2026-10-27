<?php
declare(strict_types=1);
namespace App\Integrations\PhpPos;

use App\Services\Sales\SaleMapper;
use Carbon\CarbonInterface;
use GuzzleHttp\TransferStats;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class PhpPosClient
{
    public function __construct(private readonly SaleMapper $mapper) {}

    public function salesForDay(CarbonInterface $day, ?int $localId = null): array
    {
        $key = $day->format('Y-m-d');
        $result = $this->salesForDays([$key => $day], $localId)[$key];
        if ($result instanceof PosException) throw $result;
        return $result;
    }

    /** One complete request per local day. Sales has no remote pagination. */
    public function salesForDays(array $days, ?int $localId = null): array
    {
        $results = [];
        foreach (array_chunk($days, 5, true) as $chunk) {
            $queries = [];
            foreach ($chunk as $key => $day) {
                $queries[$key] = ['path' => '/sales', 'query' => array_filter([
                    'start_date' => $day->copy()->startOfDay()->utc()->format('Y-m-d\TH:i:s\Z'),
                    'end_date' => $day->copy()->endOfDay()->utc()->format('Y-m-d\TH:i:s\Z'),
                    'location_id' => $localId,
                ], fn ($value) => $value !== null)];
            }
            foreach ($this->batch($queries) as $key => $response) {
                try {
                    $this->ensureResponse($response);
                    $raw = $response->json();
                    $raw = $raw['data'] ?? $raw;
                    if (!is_array($raw) || !array_is_list($raw)) throw new PosException('invalid_response');
                    $header = $response->header('x-total-records');
                    // Fail explicitly if the upstream reports a truncated day.
                    if ($header !== '' && $header !== null && (!ctype_digit((string) $header) || (int) $header !== count($raw))) throw new PosException('invalid_response');
                    $rows = [];
                    foreach ($raw as $sale) {
                        if (!is_array($sale)) throw new PosException('invalid_response');
                        $row = $this->mapper->map($sale);
                        if (substr($row['fecha'], 0, 10) !== (string) $key || isset($rows[$row['id']])) throw new PosException('invalid_response');
                        $rows[$row['id']] = $row;
                    }
                    $results[$key] = array_values($rows);
                } catch (Throwable $error) {
                    $results[$key] = $this->failure($error, '/sales', ['day' => (string) $key]);
                }
            }
        }
        return $results;
    }

    public function sale(int $id): array
    {
        try {
            $response = $this->batch(['detail' => ['path' => '/sales/'.$id, 'query' => []]])['detail'];
            $this->ensureResponse($response);
            $raw = $response->json();
            $raw = $raw['data'] ?? $raw;
            if (!is_array($raw) || !isset($raw['sale_id'])) throw new PosException('invalid_response');
            return $this->mapper->detail($raw);
        } catch (Throwable $error) { throw $this->failure($error, '/sales/'.$id); }
    }

    public function getCustomers(array $params): array { return $this->contacts('customers', $params); }

    public function getCustomer(int $id): array { return $this->contacts('customers', [], $id); }
    public function getSuppliers(array $params): array { return $this->contacts('suppliers', $params); }
    public function getSupplier(int $id): array { return $this->contacts('suppliers', [], $id); }

    private function contacts(string $resource, array $params, ?int $id = null): array
    {
        $path = '/'.$resource.($id === null ? '' : '/'.$id);
        try {
            $params = $id === null ? array_replace(['offset' => 0, 'limit' => 10], $params) : [];
            $response = $this->batch(['contacts' => ['path' => $path, 'query' => $params]])['contacts'];
            if ($response instanceof Response && $response->status() === 404) throw new PosException('contact_not_found');
            $this->ensureResponse($response);
            $raw = $response->json();
            if (!is_array($raw)) throw new PosException('invalid_response');
            if ($id !== null) {
                if (!$this->validContact($raw) || (int) $raw['person_id'] !== $id) throw new PosException('invalid_response');
                return $raw;
            }
            $header = $response->header('x-total-records');
            if (!array_is_list($raw) || filter_var($header, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]) === false
                || $header === null || count($raw) > (int) $params['limit']) throw new PosException('invalid_response');
            foreach ($raw as $row) if (!$this->validContact($row)) throw new PosException('invalid_response');
            $total = (int) $header;
            if ($raw && (int) $params['offset'] + count($raw) > $total) throw new PosException('invalid_response');
            return ['data' => $raw, 'total' => $total, 'offset' => (int) $params['offset'], 'limit' => (int) $params['limit']];
        } catch (Throwable $error) { throw $this->failure($error, $path); }
    }

    private function validContact(mixed $row): bool
    {
        return is_array($row) && isset($row['person_id'])
            && filter_var($row['person_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) !== false;
    }

    private function request(PendingRequest $request, string $path, array $params): PendingRequest
    {
        $bundle = config('phppos.ca_bundle');
        $safeParams = $params;
        if (isset($safeParams['search'])) $safeParams['search'] = '[redacted]';
        return $request->baseUrl((string) config('phppos.url'))
            ->withHeaders(['x-api-key' => (string) config('phppos.key')])->acceptJson()
            ->timeout(25)->connectTimeout(10)
            ->retry(2, 150, fn (Throwable $error) => $this->retryConnection($error), throw: false)
            ->withOptions([
                'allow_redirects' => false,
                'verify' => is_string($bundle) && is_file($bundle) && is_readable($bundle) ? $bundle : true,
                'on_stats' => function (TransferStats $stats) use ($path, $safeParams): void {
                    $errno = $stats->getHandlerErrorData();
                    Log::info('phppos.request', ['path' => $path, 'params' => $safeParams,
                        'duration_ms' => round($stats->getTransferTime() * 1000, 2),
                        'status' => $stats->hasResponse() ? $stats->getResponse()->getStatusCode() : null,
                        'connection_error' => is_int($errno) ? $errno : null]);
                },
            ]);
    }

    private function retryConnection(Throwable $error): bool
    {
        if (!$error instanceof ConnectionException) return false;
        $previous = $error->getPrevious();
        $context = $previous && method_exists($previous, 'getHandlerContext') ? $previous->getHandlerContext() : [];
        // Only proxy/DNS/connect failures; cURL 28 (timeout) is never retried.
        return in_array($context['errno'] ?? null, [5, 6, 7], true);
    }

    private function batch(array $queries): array
    {
        if (!$queries) return [];
        try {
            if (!config('phppos.key') || !str_starts_with((string) config('phppos.url'), 'https://')) throw new PosException('auth');
            return Http::pool(function (Pool $pool) use ($queries) {
                foreach ($queries as $key => $query) {
                    $this->request($pool->as((string) $key), $query['path'], $query['query'])->get($query['path'], $query['query']);
                }
            }, concurrency: 5);
        } catch (Throwable $error) {
            return array_fill_keys(array_keys($queries), $error instanceof PosException ? $error : new PosException());
        }
    }

    private function ensureResponse(mixed $response): void
    {
        if ($response instanceof PosException) throw $response;
        if (!$response instanceof Response) throw new PosException();
        if (in_array($response->status(), [400, 422], true)) throw new PosException('invalid_parameters');
        if (in_array($response->status(), [401, 403], true)) throw new PosException('auth');
        if ($response->status() === 404) throw new PosException('not_found');
        if (!$response->successful()) throw new PosException('upstream_failure');
    }

    private function failure(Throwable $error, string $path, array $context = []): PosException
    {
        $safe = $error instanceof PosException ? $error : new PosException();
        Log::warning('phppos.error', ['path' => $path, 'kind' => $safe->kind] + $context);
        return $safe;
    }
}
