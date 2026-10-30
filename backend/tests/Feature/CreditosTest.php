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

final class CreditosTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'test']);
        Cache::store('array')->flush(); Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-01 12:00', 'America/Bogota'));
    }
    protected function tearDown(): void { CarbonImmutable::setTestNow(); parent::tearDown(); }
    private function row(int $id, ?int $customer = 3, array $extra = []): array
    {
        return (new SaleMapper())->map(array_replace(['sale_id' => $id, 'sale_time' => '31-08-2026 09:00 am', 'total' => 100,
            'customer_id' => $customer, 'customer_first_name' => 'Same name',
            'payments' => [['payment_type' => 'Línea de crédito', 'payment_amount' => 60], ['payment_type' => 'Efectivo', 'payment_amount' => 40]]], $extra));
    }
    public function test_groups_complete_period_before_pagination_and_fetches_balance_only_for_detail(): void
    {
        Sanctum::actingAs(new User());
        Cache::store('array')->put('pos_sales_day:2026-08-31', [...array_map(fn ($id) => $this->row($id), range(1, 12)), $this->row(13, 4)], 300);
        $range = '?desde=2026-08-31&hasta=2026-08-31';
        $this->getJson('/api/creditos'.$range.'&per_page=1')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.cliente_id', 4)->assertJsonMissingPath('data.0.ventas');
        $this->getJson('/api/creditos'.$range.'&per_page=1&page=2')->assertOk()->assertJsonPath('data.0.cantidad', 12)->assertJsonPath('data.0.total_ventas', 1200)->assertJsonPath('data.0.total_credito', 720);
        Http::assertNothingSent();
        Http::fake(['*/customers/3' => Http::response(['person_id' => 3, 'balance' => 250])]);
        $this->getJson('/api/creditos/cliente-3'.$range)->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('resumen.saldo_actual', 250)->assertJsonPath('resumen.total_credito', 720)->assertJsonPath('meta.has_more', true);
        $this->getJson('/api/creditos/cliente-3'.$range.'&page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.has_more', false);
        Http::assertSentCount(1);
    }
    public function test_unknown_clients_stay_separate_and_unknown_amounts_are_not_zero(): void
    {
        Sanctum::actingAs(new User());
        Cache::store('array')->put('pos_sales_day:2026-08-31', [$this->row(1, null), $this->row(2, null, ['payments' => [['payment_type' => 'Línea de crédito']]])], 300);
        $range = '?desde=2026-08-31&hasta=2026-08-31';
        $this->getJson('/api/creditos'.$range)->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.total_credito', null);
        $this->getJson('/api/creditos/venta-2'.$range)->assertOk()->assertJsonPath('resumen.saldo_actual', null)->assertJsonCount(1, 'data');
        $this->getJson('/api/creditos/cliente-99'.$range)->assertNotFound(); Http::assertNothingSent();
    }
    public function test_auth_range_and_failures_are_enforced(): void
    {
        $this->getJson('/api/creditos')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->getJson('/api/creditos?desde=2020-01-01&hasta=2026-10-16')->assertUnprocessable();
        Http::fake(['*' => Http::response([], 503)]);
        $this->getJson('/api/creditos?desde=2026-08-31&hasta=2026-08-31')->assertStatus(502)->assertJsonMissingPath('data');
    }

    public function test_sixty_day_boundary_and_name_search_before_pagination(): void
    {
        Sanctum::actingAs(new User());
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-31 12:00', 'America/Bogota'));
        Cache::store('array')->put('pos_sales_day:2026-08-31', [
            $this->row(1, 3, ['customer_first_name' => 'María']),
            $this->row(2, 4, ['customer_first_name' => 'Pedro']),
            $this->row(3, 5, ['customer_first_name' => 'MARIA Elena']),
        ], 1800);
        Cache::store('array')->put('pos_sales_day:2026-09-01', [
            $this->row(4, 6, ['sale_time' => '01-09-2026 09:00 am', 'customer_first_name' => 'Maria']),
        ], 1800);
        $range = '?desde=2026-08-31&hasta=2026-09-01';
        $this->getJson('/api/creditos'.$range)->assertOk()->assertJsonPath('meta.total', 3);
        $this->getJson('/api/creditos'.$range.'&q=maria&per_page=1')->assertOk()
            ->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.cliente_id', 5);
        $this->getJson('/api/creditos'.$range.'&q=maria&per_page=1&page=2')->assertOk()
            ->assertJsonPath('data.0.cliente_id', 3);
        $this->getJson('/api/creditos'.$range.'&q=nadie')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/creditos/cliente-6'.$range)->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_search_and_pagination_reuse_period_without_pos_requests(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*/sales*' => Http::response([[
            'sale_id' => 1, 'sale_time' => '31-08-2026 09:00 am', 'total' => 100,
            'customer_id' => 3, 'customer_first_name' => 'Ana',
            'payments' => [['payment_type' => 'Línea de crédito', 'payment_amount' => 100]],
        ]])]);
        $range = '?desde=2026-08-31&hasta=2026-08-31';
        $this->getJson('/api/creditos'.$range)->assertOk()->assertJsonPath('meta.total', 1);
        Cache::store('array')->forget('pos_sales_day:2026-08-31');
        CarbonImmutable::setTestNow(CarbonImmutable::now()->addMinutes(3));
        $this->getJson('/api/creditos'.$range.'&q=ana')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/creditos'.$range.'&page=2')->assertOk()->assertJsonCount(0, 'data');
        Http::assertSentCount(1);
    }

    public function test_full_month_queue_includes_every_day_and_reuses_the_result(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*/sales*' => Http::response([])]);
        $range = '?desde=2026-08-01&hasta=2026-08-31';
        $this->getJson('/api/creditos'.$range)->assertOk()->assertJsonPath('meta.total', 0);
        Http::assertSentCount(31);
        for ($day = 1; $day <= 31; $day++) {
            $date = sprintf('2026-08-%02d', $day);
            Http::assertSent(fn ($request) => $request['start_date'] === $date.'T05:00:00Z');
        }
        $this->getJson('/api/creditos'.$range.'&q=ana')->assertOk();
        Http::assertSentCount(31);
    }
}
