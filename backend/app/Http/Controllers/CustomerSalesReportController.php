<?php
declare(strict_types=1);
namespace App\Http\Controllers;

use App\Http\Requests\CustomerSalesReportRequest;
use App\Services\Sales\CustomerSalesReport;
use Illuminate\Http\JsonResponse;

final class CustomerSalesReportController extends Controller
{
    public function __invoke(CustomerSalesReportRequest $request, CustomerSalesReport $service): JsonResponse
    {
        return response()->json($service->listing($request->validated()))
            ->header('Cache-Control', 'private, no-store')->header('Vary', 'Cookie, Authorization, Origin');
    }
}
