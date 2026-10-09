<?php
declare(strict_types=1);

namespace App\Services\Sales;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use App\Integrations\PhpPos\PosException;

final class SaleMapper
{
    public const STATES = ['Pagada', 'A crédito', 'Abono', 'Devolución', 'Anulada', 'Suspendida'];

    public function map(array $sale): array
    {
        try {
            $rawDate = (string) ($sale['sale_time'] ?? '');
            $date = CarbonImmutable::createFromFormat('!d-m-Y h:i a', $rawDate, 'America/Bogota');
            if (!$date || $date->format('d-m-Y h:i a') !== strtolower($rawDate) || !is_numeric($sale['total'] ?? null) || !is_numeric($sale['sale_id'] ?? null)) {
                throw new PosException();
            }
        } catch (\Throwable) { throw new PosException(); }
        $total = (int) round((float) $sale['total']);
        $payments = array_values(array_unique(array_map(fn ($p) => $this->text($p['payment_type'] ?? '', 80), $sale['payments'] ?? [])));
        $credit = count(array_filter($payments, fn ($p) => Str::lower(Str::ascii($p)) === 'linea de credito')) > 0;
        $state = match (true) {
            filter_var($sale['deleted'] ?? false, FILTER_VALIDATE_BOOLEAN) => 'Anulada',
            ($sale['return_sale_id'] ?? null) !== null || $total < 0 => 'Devolución',
            (string) ($sale['suspended'] ?? '0') === '1' => 'Suspendida',
            ($sale['mode'] ?? '') === 'store_account_payment' => 'Abono',
            $credit => 'A crédito',
            default => 'Pagada',
        };
        $receipt = $sale['receipt_url'] ?? null;
        $receipt = is_string($receipt) && strlen($receipt) <= 512 && filter_var($receipt, FILTER_VALIDATE_URL)
            && in_array(parse_url($receipt, PHP_URL_SCHEME), ['http', 'https'], true) ? $receipt : null;
        return [
            'id' => (int) $sale['sale_id'], 'fecha' => $date->toIso8601String(),
            'cliente' => $this->text(trim(($sale['customer_first_name'] ?? '').' '.($sale['customer_last_name'] ?? '')), 120) ?: 'Sin cliente',
            'total' => $total, 'forma_pago' => $this->text(implode(' + ', array_filter($payments)), 120),
            'items' => (int) array_sum(array_map(fn ($item) => (float) ($item['quantity'] ?? 0), $sale['cart_items'] ?? [])),
            'estado' => $state, 'recibo_url' => $receipt,
            '_cliente_id' => isset($sale['customer_id']) ? (int) $sale['customer_id'] : null,
        ];
    }

    public function detail(array $sale): array
    {
        return [
            'items' => array_map(fn ($item) => [
                'nombre' => $this->text($item['name'] ?? $item['item_name'] ?? 'Artículo', 120),
                'categoria' => $this->text($item['category'] ?? '', 80),
                'cantidad' => (float) ($item['quantity'] ?? 0),
                'precio_unitario' => (int) round((float) ($item['unit_price'] ?? $item['price'] ?? 0)),
                'subtotal' => (int) round((float) ($item['subtotal'] ?? $item['total'] ?? 0)),
            ], $sale['cart_items'] ?? []),
            'pagos' => array_map(fn ($p) => ['tipo' => $this->text($p['payment_type'] ?? '', 80),
                'monto' => (int) round((float) ($p['payment_amount'] ?? $p['amount'] ?? 0))], $sale['payments'] ?? []),
        ];
    }

    private function text(mixed $value, int $max): string
    {
        return mb_substr(trim(strip_tags((string) $value)), 0, $max);
    }
}
