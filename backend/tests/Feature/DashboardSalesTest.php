<?php
declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Services\Sales\SaleMapper;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DashboardSalesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'invented']);
        Cache::store('array')->flush();
        Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-16 12:00', 'America/Bogota'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function row(int $id, string $date, array $extra = []): array
    {
        return (new SaleMapper())->map(array_merge([
            'sale_id' => $id, 'sale_time' => CarbonImmutable::parse($date)->format('d-m-Y').' 09:00 am',
            'total' => '100', 'customer_id' => 3, 'customer_first_name' => 'Prueba',
            'payments' => [['payment_type' => 'Efectivo', 'payment_amount' => '100']],
        ], $extra));
    }

    private function cacheDay(string $date, array $rows): void
    {
        Cache::store('array')->put('pos_sales_day:'.$date, $rows, 60);
    }

    public function test_summary_uses_all_sales_and_excludes_non_sales(): void
    {
        Sanctum::actingAs(new User());
        $rows = array_map(fn ($id) => $this->row($id, '2026-10-16'), range(1, 12));
        $rows[] = $this->row(13, '2026-10-16', ['total' => 200, 'payments' => [['payment_type' => 'Línea de crédito', 'payment_amount' => 150], ['payment_type' => 'Efectivo', 'payment_amount' => 50]]]);
        $rows[] = $this->row(14, '2026-10-16', ['deleted' => true]);
        $rows[] = $this->row(15, '2026-10-16', ['suspended' => '1']);
        $rows[] = $this->row(16, '2026-10-16', ['mode' => 'store_account_payment']);
        $rows[] = $this->row(17, '2026-10-16', ['total' => '-20']);
        $this->cacheDay('2026-10-15', []);
        $this->cacheDay('2026-10-16', $rows);
        $response = $this->getJson('/api/ventas/resumen?desde=2026-10-15&hasta=2026-10-16&per_page=10&page=2')
            ->assertOk()->assertJsonPath('resumen.total_ventas', 1400)
            ->assertJsonPath('resumen.cantidad_ventas', 13)->assertJsonPath('resumen.ticket_promedio', 108)
            ->assertJsonPath('resumen.total_credito', 200)->assertJsonPath('resumen.cantidad_credito', 1)
            ->assertJsonPath('resumen.total_cobrado', 1200)->assertJsonPath('dias.0.total', 0)
            ->assertJsonPath('dias.1.total', 1400)->assertJsonPath('dias.1.credito', 200)
            ->assertJsonCount(6, 'ultimas')->assertJsonCount(1, 'creditos')->assertJsonPath('ultimas.0.id', 13)
            ->assertJsonPath('meta.parcial', false);
        $this->assertStringNotContainsString('_cliente_id', $response->getContent());
        $this->assertStringNotContainsString('_pagos', $response->getContent());
        Http::assertNothingSent();
    }

    public function test_old_credit_filter_uses_bogota_calendar_days_and_all_rows_before_pagination(): void
    {
        Sanctum::actingAs(new User());
        $credit = ['payments' => [['payment_type' => 'Línea de crédito', 'payment_amount' => 100]]];
        $this->cacheDay('2026-08-31', array_merge(
            array_map(fn ($id) => $this->row($id, '2026-08-31', $credit), range(1, 12)),
            [$this->row(13, '2026-08-31'), $this->row(14, '2026-08-31', array_merge($credit, ['deleted' => true])),
             $this->row(15, '2026-08-31', array_merge($credit, ['suspended' => '1'])),
             $this->row(16, '2026-08-31', array_merge($credit, ['mode' => 'store_account_payment']))]
        ));
        $this->cacheDay('2026-09-01', [$this->row(20, '2026-09-01', $credit)]);
        $this->getJson('/api/ventas?desde=2026-08-31&hasta=2026-09-01&credito_antiguo=1&page=2')
            ->assertOk()->assertJsonPath('meta.total', 12)->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', 2)->assertJsonPath('data.1.id', 1);
        // Exactly 45 days is excluded, and the boundary changes at midnight in Bogotá.
        $this->getJson('/api/ventas?desde=2026-09-01&hasta=2026-09-01&credito_antiguo=1')
            ->assertOk()->assertJsonPath('meta.total', 0);
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-17 00:01', 'America/Bogota'));
        $this->cacheDay('2026-09-01', [$this->row(20, '2026-09-01', $credit)]);
        $this->getJson('/api/ventas?desde=2026-09-01&hasta=2026-09-01&credito_antiguo=1')
            ->assertOk()->assertJsonPath('meta.total', 1);
        Http::assertNothingSent();
    }

    public function test_missing_days_are_not_displayed_as_zero_and_empty_period_is_valid(): void
    {
        Sanctum::actingAs(new User());
        $this->cacheDay('2026-10-15', []);
        Http::fake(['*' => Http::response([], 503)]);
        $this->getJson('/api/ventas/resumen?desde=2026-10-15&hasta=2026-10-16')->assertStatus(502)->assertJsonMissingPath('resumen');
        $this->getJson('/api/ventas/resumen?desde=2026-10-16&hasta=2026-10-16')->assertStatus(502);
    }

    public function test_summary_and_alerts_keep_authentication_and_range_validation(): void
    {
        $this->getJson('/api/ventas/resumen')->assertUnauthorized();
        $this->getJson('/api/ventas?credito_antiguo=1')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->getJson('/api/ventas/resumen?desde=2026-01-01&hasta=2026-10-16')->assertUnprocessable();
        $this->getJson('/api/ventas?credito_antiguo=incorrecto')->assertUnprocessable();
        Http::assertNothingSent();
    }
}
