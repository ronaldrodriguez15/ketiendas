<?php
declare(strict_types=1);
namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CierreTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'invented', 'phppos.page_size' => 100]);
        Cache::store('array')->flush();
        Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-09 12:00', 'America/Bogota'));
    }
    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }
    private function sale(int $id, array $payments, array $extra = []): array
    {
        return array_merge(['sale_id' => $id, 'sale_time' => '09-10-2026 09:00 am', 'total' => '100', 'payments' => array_map(fn ($p) => ['payment_type' => $p[0], 'payment_amount' => $p[1]], $payments)], $extra);
    }
    public function test_daily_breakdown_counts_each_operation_once_per_method(): void
    {
        Sanctum::actingAs(new User());
        $rows = [
            $this->sale(1, [['Efectivo', 60], ['Transferencia', 40]]),
            $this->sale(2, [['Efectivo', 30], ['Efectivo', 70]]),
            $this->sale(3, [['Efectivo', -20]], ['total' => '-20']),
            $this->sale(4, [['Efectivo', 500]], ['deleted' => true]),
            $this->sale(5, [['Efectivo', 500]], ['suspended' => '1']),
            $this->sale(6, [['Línea de crédito', 100]]),
            $this->sale(7, [['Transferencia', 50]], ['mode' => 'store_account_payment']),
        ];
        Http::fake(['*' => Http::response($rows, 200, ['x-total-records' => '7'])]);
        $response = $this->getJson('/api/cierre')->assertOk()->assertJsonPath('meta.fecha', '2026-10-09')
            ->assertJsonPath('resumen.operaciones', 5)->assertJsonPath('resumen.ventas', 3)
            ->assertJsonPath('resumen.abonos', 1)->assertJsonPath('resumen.devoluciones', 1)
            ->assertJsonPath('resumen.anuladas', 1)->assertJsonPath('resumen.suspendidas', 1)
            ->assertJsonPath('resumen.neto', 230)->assertJsonPath('resumen.ingresos', 250)
            ->assertJsonPath('resumen.egresos', 20)->assertJsonPath('resumen.credito', 100)
            ->assertJsonPath('meta.incompleto', false);
        $groups = collect($response->json('data'))->keyBy('forma_pago');
        $this->assertSame(3, $groups['Efectivo']['cantidad']);
        $this->assertSame(4, $groups['Efectivo']['pagos']);
        $this->assertSame(140, $groups['Efectivo']['total']);
        $this->assertSame(2, $groups['Transferencia']['cantidad']);
        Http::assertSent(fn ($r) => $r->method() === 'GET' && $r['start_date'] === '2026-10-09T05:00:00Z' && $r['end_date'] === '2026-10-10T04:59:59Z');
        $this->getJson('/api/cierre')->assertOk();
        Http::assertSentCount(1);
        $this->assertStringNotContainsString('cliente', $response->getContent());
    }
    public function test_only_selected_day_all_pages_and_old_cache_upgrade(): void
    {
        Sanctum::actingAs(new User());
        config(['phppos.page_size' => 1]);
        Cache::store('array')->put('pos_sales_day:2026-10-08', [['id' => 99]], 60);
        Http::fake(['*' => Http::response([$this->sale(1, [['Efectivo', 100]], ['sale_time' => '08-10-2026 10:00 am']), $this->sale(2, [['Transferencia', 100]], ['sale_time' => '08-10-2026 11:00 am'])], 200, ['x-total-records' => '2'])]);
        $this->getJson('/api/cierre?fecha=2026-10-08')->assertOk()->assertJsonPath('resumen.neto', 200)->assertJsonPath('resumen.operaciones', 2);
        Http::assertSentCount(1);
        foreach (Http::recorded() as [$request]) $this->assertSame('2026-10-08T05:00:00Z', $request['start_date']);
    }
    public function test_missing_payments_are_reported_without_inventing_money(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*' => Http::response([$this->sale(1, []), $this->sale(2, [['Efectivo', null]])], 200, ['x-total-records' => '2'])]);
        $this->getJson('/api/cierre')->assertOk()->assertJsonPath('meta.incompleto', true)
            ->assertJsonPath('resumen.neto', 0)->assertJsonPath('resumen.sin_pago', 1)->assertJsonPath('resumen.pagos_sin_monto', 1);
    }

    public function test_payment_detail_is_paginated_and_counts_only_selected_method(): void
    {
        Sanctum::actingAs(new User());
        $rows = array_map(fn ($id) => $this->sale($id, [['Efectivo', 30], ['Efectivo', 20], ['Transferencia', 50]]), range(1, 12));
        $rows[] = $this->sale(13, [['Efectivo', 500]], ['deleted' => true]);
        $rows[] = $this->sale(14, [['Efectivo', -10]], ['total' => '-10']);
        Http::fake(['*' => Http::response($rows, 200, ['x-total-records' => '14'])]);
        $response = $this->getJson('/api/cierre?fecha=2026-10-09&forma_pago=Efectivo&page=2&per_page=10')
            ->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 13)
            ->assertJsonPath('meta.last_page', 2)->assertJsonPath('meta.total_importe', 590)
            ->assertJsonPath('data.0.importe', 50)->assertJsonPath('data.0.total_venta', 100)->assertJsonPath('data.0.pagos', 2);
        $this->assertSame(['id', 'fecha', 'cliente', 'estado', 'total_venta', 'importe', 'pagos', 'sin_monto'], array_keys($response->json('data.0')));
        $this->getJson('/api/cierre?forma_pago=Transferencia')->assertOk()->assertJsonPath('meta.total', 12)->assertJsonPath('meta.total_importe', 600);
        $this->getJson('/api/cierre?forma_pago=Otro')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/cierre?forma_pago=Efectivo&per_page=999')->assertUnprocessable();
        Http::assertSentCount(1);
    }
    public function test_empty_failed_invalid_and_unauthenticated_requests(): void
    {
        $this->getJson('/api/cierre')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->getJson('/api/cierre?fecha=2026-10-10')->assertUnprocessable();
        $this->getJson('/api/cierre?fecha=bad')->assertUnprocessable();
        Http::assertNothingSent();
        Http::fakeSequence()->push([], 503)->push([], 200, ['x-total-records' => '0']);
        $this->getJson('/api/cierre')->assertStatus(502);
        $this->assertNull(Cache::store('array')->get('pos_sales_day:2026-10-09'));
        $this->getJson('/api/cierre')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('resumen.neto', 0);
    }
}
