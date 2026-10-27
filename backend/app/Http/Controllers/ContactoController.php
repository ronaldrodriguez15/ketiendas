<?php
declare(strict_types=1);
namespace App\Http\Controllers;

use App\Http\Requests\ListarContactosRequest;
use App\Http\Resources\ContactoResource;
use App\Integrations\PhpPos\PhpPosClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

final class ContactoController extends Controller
{
    public function index(ListarContactosRequest $request, PhpPosClient $client): JsonResponse
    {
        $params = array_filter($request->validated(), fn ($value) => $value !== null && $value !== '');
        $page = (int) $params['page']; $size = (int) $params['per_page'];
        unset($params['page'], $params['per_page']);
        $params['offset'] = ($page - 1) * $size; $params['limit'] = $size;
        if (isset($params['location_id'])) $params['location_id'] = (int) $params['location_id'];
        ksort($params);
        $resource = $request->routeIs('customers.*') ? 'customers' : 'suppliers';
        $key = 'pos_contacts:'.$resource.':'.hash('sha256', config('phppos.url').json_encode($params));
        $result = Cache::store(config('phppos.cache_store'))->remember($key, 60, function () use ($client, $params, $resource, $request, $page, $size) {
            $result = $resource === 'customers' ? $client->getCustomers($params) : $client->getSuppliers($params);
            return ['data' => ContactoResource::collection($result['data'])->resolve($request), 'page' => $page,
                'per_page' => $size, 'total' => $result['total'], 'has_more' => $params['offset'] + count($result['data']) < $result['total']];
        });
        return $this->response($result);
    }

    public function show(Request $request, string $id, PhpPosClient $client): JsonResponse
    {
        abort_unless(filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) !== false, 404, 'El registro no existe.');
        $row = $request->routeIs('customers.*') ? $client->getCustomer((int) $id) : $client->getSupplier((int) $id);
        return $this->response(['data' => (new ContactoResource($row))->resolve($request)]);
    }

    private function response(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'private, no-store')->header('Vary', 'Cookie, Authorization, Origin');
    }
}
