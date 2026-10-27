<?php
declare(strict_types=1);
namespace App\Services\Sales;

use Illuminate\Support\Str;

final class CierreService
{
    public function __construct(private readonly SalesService $sales) {}

    public function detail(string $fecha, string $method, int $page, int $size): array
    {
        $result = $this->sales->listing(['desde' => $fecha, 'hasta' => $fecha, 'per_page' => PHP_INT_MAX, 'requiere_pagos' => true]);
        $key = Str::lower(Str::ascii(trim($method)));
        $rows = [];
        foreach ($result['data'] as $sale) {
            if (in_array($sale['estado'], ['Anulada', 'Suspendida'], true)) continue;
            $payments = array_values(array_filter($sale['_pagos'], fn ($p) => Str::lower(Str::ascii(trim($p['tipo']))) === $key));
            if (!$payments) continue;
            $known = array_filter($payments, fn ($p) => $p['monto'] !== null);
            $rows[] = ['id' => $sale['id'], 'fecha' => $sale['fecha'], 'cliente' => $sale['cliente'],
                'estado' => $sale['estado'], 'total_venta' => $sale['total'],
                'importe' => $known ? array_sum(array_column($known, 'monto')) : null,
                'pagos' => count($payments), 'sin_monto' => count($payments) - count($known)];
        }
        $total = count($rows);
        $last = max(1, (int) ceil($total / $size));
        $page = min($page, $last);
        return ['data' => array_slice($rows, ($page - 1) * $size, $size), 'meta' => [
            'fecha' => $fecha, 'forma_pago' => $method, 'page' => $page, 'per_page' => $size,
            'total' => $total, 'last_page' => $last, 'total_importe' => array_sum(array_column($rows, 'importe')),
            'pagos_sin_monto' => array_sum(array_column($rows, 'sin_monto')),
        ]];
    }

    public function summary(string $fecha): array
    {
        $result = $this->sales->listing(['desde' => $fecha, 'hasta' => $fecha, 'per_page' => PHP_INT_MAX, 'requiere_pagos' => true]);
        $groups = [];
        $summary = ['operaciones' => 0, 'ventas' => 0, 'abonos' => 0, 'devoluciones' => 0,
            'anuladas' => 0, 'suspendidas' => 0, 'sin_pago' => 0, 'pagos_sin_monto' => 0,
            'ingresos' => 0, 'egresos' => 0, 'neto' => 0, 'credito' => 0];
        foreach ($result['data'] as $sale) {
            if ($sale['estado'] === 'Anulada') { $summary['anuladas']++; continue; }
            if ($sale['estado'] === 'Suspendida') { $summary['suspendidas']++; continue; }
            $summary['operaciones']++;
            $summary[match ($sale['estado']) { 'Abono' => 'abonos', 'Devolución' => 'devoluciones', default => 'ventas' }]++;
            if (!$sale['_pagos']) $summary['sin_pago']++;
            $seen = [];
            foreach ($sale['_pagos'] as $payment) {
                $key = Str::lower(Str::ascii(trim($payment['tipo'])));
                $credit = $key === 'linea de credito';
                $groups[$key] ??= ['forma_pago' => $payment['tipo'], 'es_credito' => $credit,
                    'cantidad' => 0, 'pagos' => 0, 'ingresos' => 0, 'egresos' => 0, 'total' => 0, 'sin_monto' => 0];
                if (!isset($seen[$key])) { $groups[$key]['cantidad']++; $seen[$key] = true; }
                $groups[$key]['pagos']++;
                if ($payment['monto'] === null) { $groups[$key]['sin_monto']++; $summary['pagos_sin_monto']++; continue; }
                $amount = $payment['monto'];
                $groups[$key]['ingresos'] += max(0, $amount);
                $groups[$key]['egresos'] += max(0, -$amount);
                $groups[$key]['total'] += $amount;
                if ($credit) { $summary['credito'] += $amount; continue; }
                $summary['ingresos'] += max(0, $amount);
                $summary['egresos'] += max(0, -$amount);
                $summary['neto'] += $amount;
            }
        }
        $groups = array_values($groups);
        usort($groups, fn ($a, $b) => ($a['es_credito'] <=> $b['es_credito']) ?: ($b['total'] <=> $a['total']) ?: strcmp($a['forma_pago'], $b['forma_pago']));
        return ['data' => $groups, 'resumen' => $summary, 'meta' => ['fecha' => $fecha,
            'generado_en' => $result['meta']['generado_en'], 'incompleto' => $summary['sin_pago'] > 0 || $summary['pagos_sin_monto'] > 0]];
    }
}
