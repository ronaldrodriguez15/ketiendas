<?php
declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class SalesAuthTest extends TestCase
{
    public function test_sales_require_authentication(): void
    {
        Http::preventStrayRequests();
        $this->getJson('/api/ventas')->assertUnauthorized();
        $this->getJson('/api/ventas/1')->assertUnauthorized();
        Http::assertNothingSent();
    }
}
