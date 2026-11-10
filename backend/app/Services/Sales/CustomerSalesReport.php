<?php
declare(strict_types=1);
namespace App\Services\Sales;

use App\Integrations\PhpPos\PhpPosClient;
use App\Integrations\PhpPos\PosException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class CustomerSalesReport
{
    public function __construct(private readonly PhpPosClient $client, private readonly SalesService $sales) {}

    public static function fields(array $sale): array
    {
        $fields = [];
        foreach (['phone_number', 'email', 'address_1', 'address_2', 'city', 'state', 'zip'] as $key) {
            $fields[$key] = mb_substr(trim(strip_tags((string) ($sale['customer_'.$key] ?? ''))), 0, 255);
        }
        foreach (['subtotal', 'tax', 'total', 'profit'] as $key) {
            $fields[$key] = is_numeric($sale[$key] ?? null) && is_finite((float) $sale[$key]) ? (float) $sale[$key] : null;
        }
        $items = $sale['cart_items'] ?? null;
        $fields['quantity'] = is_array($items) && count(array_filter($items, fn ($item) => !is_numeric($item['quantity'] ?? null))) === 0
            ? array_sum(array_column($items, 'quantity')) : null;
        $fields['account_payment'] = filter_var($sale['store_account_payment'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $fields['items'] = is_array($items) ? array_map(fn ($item) => [
            'id' => isset($item['item_id']) ? (int) $item['item_id'] : null,
            'quantity' => is_numeric($item['quantity'] ?? null) ? (float) $item['quantity'] : null,
        ], $items) : null;
        return $fields;
    }

    public function listing(array $filters): array
    {
        $cache = Cache::store(config('phppos.cache_store'));
        // Share daily responses with dashboard, sales, closing and product rankings.
        $range = array_intersect_key($filters, array_flip(['desde', 'hasta', 'local_id']));
        $loaded = [$this->sales->listing($range + ['page' => 1, 'per_page' => PHP_INT_MAX, 'requiere_reporte' => true])['data']];
        $groups = [];
        foreach ($loaded as $rows) {
            usort($rows, fn ($a, $b) => strcmp($b['fecha'], $a['fecha']) ?: $b['id'] <=> $a['id']);
            foreach ($rows as $sale) {
                $id = $sale['_cliente_id']; $fields = $sale['_report'];
                if (!$id || in_array($sale['estado'], ['Anulada', 'Suspendida'], true)) continue;
                if (!isset($groups[$id])) {
                    $groups[$id] = array_intersect_key($fields, array_flip(['phone_number', 'email', 'address_1', 'address_2', 'city', 'state', 'zip']))
                        + ['person_id' => $id, 'cliente' => $sale['cliente'], 'subtotal' => 0, 'total' => 0, 'tax' => 0, 'profit' => 0, 'quantity' => 0, 'transactions' => 0, '_items' => []];
                }
                foreach (['subtotal', 'total', 'tax', 'profit', 'quantity'] as $key) {
                    $groups[$id][$key] = $groups[$id][$key] === null || $fields[$key] === null ? null : $groups[$id][$key] + $fields[$key];
                }
                $groups[$id]['transactions']++;
                if (!$fields['account_payment'] && $sale['estado'] !== 'Abono') {
                    if ($fields['items'] === null) $groups[$id]['_items'][] = ['id' => null, 'quantity' => null];
                    else array_push($groups[$id]['_items'], ...$fields['items']);
                }
            }
        }
        $query = Str::lower(Str::ascii(trim((string) ($filters['q'] ?? ''))));
        $rows = array_values(array_filter($groups, fn ($row) => $query === '' || str_contains(Str::lower(Str::ascii($row['cliente'].' '.$row['person_id'].' '.$row['phone_number'])), $query)));
        foreach ($rows as &$row) {
            $row['average_receipt'] = $row['total'] === null ? null : $row['total'] / $row['transactions'];
            $row['average_quantity'] = $row['quantity'] === null ? null : $row['quantity'] / $row['transactions'];
            unset($row['quantity']);
        }
        unset($row);
        usort($rows, fn ($a, $b) => strnatcasecmp($a['cliente'], $b['cliente']) ?: $a['person_id'] <=> $b['person_id']);
        $page = (int) $filters['page']; $size = (int) $filters['per_page'];
        $visible = array_slice($rows, ($page - 1) * $size, $size);
        $flags = []; $missing = [];
        $itemPrefix = 'customer_sales:item:'.hash('sha256', config('phppos.url')).':';
        foreach ($visible as $row) foreach ($row['_items'] as $item) {
            if (!$item['id']) continue;
            $flag = $cache->get($itemPrefix.$item['id']);
            if (is_bool($flag)) $flags[$item['id']] = $flag;
            else $missing[$item['id']] = $item['id'];
        }
        foreach ($this->client->itemServiceFlags(array_values($missing)) as $id => $flag) {
            $flags[$id] = $flag; $cache->put($itemPrefix.$id, $flag, 1800);
        }
        foreach ($visible as &$row) {
            $quantity = 0;
            foreach ($row['_items'] as $item) {
                if (!$item['id'] || $item['quantity'] === null || !array_key_exists($item['id'], $flags)) { $quantity = null; break; }
                if (!$flags[$item['id']]) $quantity += $item['quantity'];
            }
            $row['average_quantity'] = $quantity === null ? null : $quantity / $row['transactions'];
            unset($row['_items']);
        }
        unset($row);
        return ['data' => $visible, 'meta' => [
            'page' => $page, 'per_page' => $size, 'total' => count($rows), 'has_more' => $page * $size < count($rows),
            'desde' => $filters['desde'], 'hasta' => $filters['hasta'], 'generado_en' => CarbonImmutable::now('America/Bogota')->toIso8601String(),
        ]];
    }
}
