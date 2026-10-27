<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\ListarVentasRequest;
use App\Http\Resources\VentaListadoResource;
use App\Services\Sales\SalesService;
use Illuminate\Http\JsonResponse;

final class VentaController extends Controller
{
    public function index(ListarVentasRequest $request, SalesService $service): JsonResponse
    {
        $result = $service->listing($request->validated());
        $result['data'] = VentaListadoResource::collection($result['data'])->resolve($request);
        return response()->json($result)
            ->header('Cache-Control', 'private, no-store')
            ->header('Vary', 'Cookie, Authorization, Origin');
    }

    public function show(int $id, SalesService $service): JsonResponse
    {
        return response()->json(['data' => $service->detail($id)])
            ->header('Cache-Control', 'private, max-age=30')->header('Vary', 'Cookie, Authorization, Origin');
    }

    public function summary(ListarVentasRequest $request, SalesService $service): JsonResponse
    {
        $filters = array_intersect_key($request->validated(), array_flip(['desde', 'hasta', 'local_id']));
        $result = $service->summary($filters);
        foreach (['ultimas', 'creditos'] as $key) {
            $result[$key] = VentaListadoResource::collection($result[$key])->resolve($request);
        }
        return response()->json($result)->header('Cache-Control', 'private, no-store')
            ->header('Vary', 'Cookie, Authorization, Origin');
    }
}
