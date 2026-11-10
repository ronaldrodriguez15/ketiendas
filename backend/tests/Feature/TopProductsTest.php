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

final class TopProductsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'test']);
        Cache::store('array')->flush(); Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-11 12:00', 'America/Bogota'));
    }
    protected function tearDown(): void { CarbonImmutable::setTestNow(); parent::tearDown(); }
    private function item(int $id, float $quantity): array
    {
        return ['item_id' => $id, 'name' => 'Producto '.$id, 'quantity' => $quantity, 'category_name' => 'Categoría'];
    }
    private function sale(int $id, array $items, array $extra = []): array
    {
        return array_replace(['sale_id' => $id, 'sale_time' => '11-11-2026 09:00 am', 'total' => 100,
            'cart_items' => $items, 'payments' => [['payment_type' => 'Efectivo', 'payment_amount' => 100]]], $extra);
    }
    public function test_ranks_full_day_counts_each_sale_once_and_preserves_fractional_units(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*' => Http::response([
            $this->sale(1, [$this->item(1, 2.5), $this->item(1, 1), $this->item(2, 1)]),
            $this->sale(2, [$this->item(2, 8)], ['payments' => [['payment_type' => 'Línea de crédito']]]),
            $this->sale(3, [$this->item(3, 100)], ['deleted' => true]),
            $this->sale(4, [$this->item(3, 100)], ['suspended' => '1']),
            $this->sale(5, [$this->item(3, 100)], ['return_sale_id' => 1]),
            $this->sale(6, [$this->item(3, 100)], ['store_account_payment' => true]),
            $this->sale(7, [$this->item(3, -1)]),
        ])]);
        $this->getJson('/api/reportes/productos')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', 'item-2')->assertJsonPath('data.0.cantidad', 9)
            ->assertJsonPath('data.0.ventas', 2)->assertJsonPath('data.1.cantidad', 3.5)
            ->assertJsonPath('data.1.ventas', 1)->assertJsonPath('resumen.unidades', 12.5)
            ->assertJsonPath('resumen.ventas', 2)->assertJsonPath('meta.desde', '2026-11-11')
            ->assertJsonMissingPath('data.0._report');
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r['start_date'] === '2026-11-11T05:00:00Z' && $r['end_date'] === '2026-11-12T04:59:59Z');
    }
    public function test_periods_share_daily_requests_with_sales_dashboard_and_customer_report(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*' => Http::response([])]);
        $this->getJson('/api/reportes/productos')->assertOk();
        $this->getJson('/api/reportes/productos?periodo=semana')->assertOk()->assertJsonPath('meta.desde', '2026-11-09');
        Http::assertSentCount(3);
        $this->getJson('/api/reportes/productos?periodo=mes')->assertOk()->assertJsonPath('meta.desde', '2026-11-01');
        Http::assertSentCount(11);
        $this->getJson('/api/ventas?desde=2026-11-01&hasta=2026-11-11')->assertOk();
        $this->getJson('/api/ventas/resumen?desde=2026-11-01&hasta=2026-11-11')->assertOk();
        $this->getJson('/api/reportes/ventas-clientes?desde=2026-11-01&hasta=2026-11-11')->assertOk();
        Http::assertSentCount(11);
    }
    public function test_existing_enriched_sales_cache_avoids_all_upstream_calls(): void
    {
        Sanctum::actingAs(new User());
        $mapped = app(SaleMapper::class)->map($this->sale(1, [$this->item(2, 5)]));
        Cache::store('array')->put('pos_sales_day:2026-11-11', [$mapped], 120);
        $this->getJson('/api/reportes/productos')->assertOk()->assertJsonPath('resumen.unidades', 5);
        Http::assertNothingSent();
    }
    public function test_old_sales_cache_is_upgraded_and_failure_is_not_an_empty_ranking(): void
    {
        Sanctum::actingAs(new User());
        Cache::store('array')->put('pos_sales_day:2026-11-11', [['id' => 1]], 120);
        Http::fake(['*' => Http::sequence()->push([], 503)->push([$this->sale(1, [$this->item(1, 2)])])]);
        $this->getJson('/api/reportes/productos')->assertStatus(502)->assertJsonMissingPath('data');
        $this->getJson('/api/reportes/productos')->assertOk()->assertJsonPath('resumen.unidades', 2);
        Http::assertSentCount(2);
    }
    public function test_invalid_items_and_truncated_days_never_produce_a_partial_ranking(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*' => Http::response([$this->sale(1, [['name' => 'Sin ID', 'quantity' => 5]])])]);
        $this->getJson('/api/reportes/productos')->assertStatus(502)->assertJsonMissingPath('data');
        Cache::store('array')->flush();
        Http::fake(['*' => Http::response([$this->sale(1, [$this->item(1, 2)])], 200, ['x-total-records' => '2'])]);
        $this->getJson('/api/reportes/productos')->assertStatus(502)->assertJsonMissingPath('data');
    }
    public function test_week_can_cross_month_and_uses_bogota_calendar(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-02 02:00', 'UTC')); // Still Sunday in Colombia.
        Sanctum::actingAs(new User()); Http::fake(['*' => Http::response([])]);
        $this->getJson('/api/reportes/productos?periodo=semana')->assertOk()
            ->assertJsonPath('meta.desde', '2026-10-26')->assertJsonPath('meta.hasta', '2026-11-01');
        Http::assertSentCount(7);
    }
    public function test_limits_after_aggregation_and_does_not_merge_kits_with_items(): void
    {
        Sanctum::actingAs(new User());
        $items = array_map(fn ($id) => $this->item($id, $id), range(1, 105));
        $items[] = ['item_kit_id' => 105, 'quantity' => 200, 'name' => 'Kit'];
        Http::fake(['*' => Http::response([$this->sale(1, $items)])]);
        $this->getJson('/api/reportes/productos')->assertOk()->assertJsonCount(100, 'data')
            ->assertJsonPath('data.0.id', 'kit-105')->assertJsonPath('data.1.id', 'item-105')
            ->assertJsonPath('resumen.productos', 106)->assertJsonPath('resumen.unidades', 5765);
    }
    public function test_auth_filters_cache_expiry_and_location_isolation(): void
    {
        $this->getJson('/api/reportes/productos')->assertUnauthorized();
        Sanctum::actingAs(new User(['activo' => false]));
        $this->getJson('/api/reportes/productos')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->getJson('/api/reportes/productos?periodo=anual')->assertUnprocessable();
        $this->getJson('/api/reportes/productos?local_id=0')->assertUnprocessable();
        Http::assertNothingSent();
        Http::fake(['*' => Http::response([])]);
        $this->getJson('/api/reportes/productos')->assertOk();
        $this->getJson('/api/reportes/productos')->assertOk();
        Http::assertSentCount(1);
        $this->getJson('/api/reportes/productos?local_id=2')->assertOk();
        Http::assertSentCount(2);
        CarbonImmutable::setTestNow(CarbonImmutable::now()->addSeconds(121));
        $this->getJson('/api/reportes/productos')->assertOk();
        Http::assertSentCount(3);
    }
}
