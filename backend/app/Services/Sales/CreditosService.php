<?php
declare(strict_types=1);
namespace App\Services\Sales;

use App\Integrations\PhpPos\PhpPosClient;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class CreditosService
{
    public function __construct(private readonly SalesService $sales, private readonly PhpPosClient $client) {}

    private function accounts(array $filters): array
    {
        $range = array_intersect_key($filters, array_flip(['desde', 'hasta', 'local_id']));
        ksort($range);
        $key = 'creditos:periodo:v2:'.hash('sha256', config('phppos.url').json_encode($range).CarbonImmutable::now('America/Bogota')->format('Y-m-d'));
        return Cache::store(config('phppos.cache_store'))->remember($key, 120, function () use ($range) {
            // Complete only the validated period (at most 31 days), never the full history.
            $rows = $this->sales->listing($range + ['estado' => 'A crédito', 'credito_antiguo' => true,
                'requiere_pagos' => true, 'page' => 1, 'per_page' => PHP_INT_MAX])['data'];
            $groups = [];
            foreach ($rows as $sale) {
                $customer = $sale['_cliente_id'] > 0 ? $sale['_cliente_id'] : null;
                $id = $customer === null ? 'venta-'.$sale['id'] : 'cliente-'.$customer;
                if (!isset($groups[$id])) $groups[$id] = ['id' => $id, 'cliente_id' => $customer,
                    'nombre' => $sale['cliente'], 'cantidad' => 0, 'total_ventas' => 0, 'total_credito' => 0,
                    'primera_venta' => $sale['fecha'], 'ultima_venta' => $sale['fecha'], 'ventas' => []];
                $credit = 0;
                foreach ($sale['_pagos'] as $payment) {
                    if (Str::lower(Str::ascii($payment['tipo'])) !== 'linea de credito') continue;
                    if ($payment['monto'] === null) { $credit = null; break; }
                    $credit += $payment['monto'];
                }
                $group = &$groups[$id];
                $group['cantidad']++;
                $group['total_ventas'] += $sale['total'];
                $group['total_credito'] = $credit === null || $group['total_credito'] === null ? null : $group['total_credito'] + $credit;
                $group['primera_venta'] = min($group['primera_venta'], $sale['fecha']);
                $group['ultima_venta'] = max($group['ultima_venta'], $sale['fecha']);
                $group['ventas'][] = array_intersect_key($sale, array_flip(['id', 'fecha', 'total', 'forma_pago'])) + ['credito_original' => $credit];
                unset($group);
            }
            return $groups;
        });
    }

    private function paginate(array $rows, array $filters): array
    {
        $page = (int) $filters['page']; $size = (int) $filters['per_page'];
        return ['data' => array_slice($rows, ($page - 1) * $size, $size), 'meta' => [
            'page' => $page, 'per_page' => $size, 'total' => count($rows), 'has_more' => $page * $size < count($rows)]];
    }

    public function listing(array $filters): array
    {
        $rows = array_map(function ($group) { unset($group['ventas']); return $group; }, array_values($this->accounts($filters)));
        return $this->paginate($rows, $filters);
    }

    public function detail(array $filters, string $id): array
    {
        $groups = $this->accounts($filters);
        abort_unless(isset($groups[$id]), 404, 'No hay créditos para este cliente en el periodo.');
        $group = $groups[$id];
        $result = $this->paginate($group['ventas'], $filters);
        unset($group['ventas']);
        $group['saldo_actual'] = null;
        if ($group['cliente_id'] !== null) {
            // Customer balance is requested only when the modal is opened.
            $balanceKey = 'credito:saldo:'.hash('sha256', config('phppos.url')).':'.$group['cliente_id'];
            $balance = Cache::store(config('phppos.cache_store'))->remember($balanceKey, 30,
                fn () => $this->client->getCustomer($group['cliente_id'])['balance'] ?? null);
            $group['saldo_actual'] = is_numeric($balance) && is_finite((float) $balance) ? (float) $balance : null;
        }
        return $result + ['resumen' => $group];
    }
}
