<?php
declare(strict_types=1);
namespace App\Http\Controllers;
use App\Http\Requests\ListarVentasRequest;
use App\Services\Sales\CreditosService;
use Illuminate\Http\JsonResponse;

final class CreditoController extends Controller
{
    public function index(ListarVentasRequest $request, CreditosService $service): JsonResponse
    {
        return $this->response($service->listing($request->validated()));
    }
    public function show(ListarVentasRequest $request, string $id, CreditosService $service): JsonResponse
    {
        return $this->response($service->detail($request->validated(), $id));
    }
    private function response(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'private, no-store')->header('Vary', 'Cookie, Authorization, Origin');
    }
}
