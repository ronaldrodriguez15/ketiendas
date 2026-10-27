<?php
declare(strict_types=1);
namespace App\Http\Controllers;
use App\Enums\Rol;
use App\Http\Requests\GuardarUsuarioRequest;
use App\Http\Resources\UsuarioResource;
use App\Models\User;
use App\Services\UsuarioService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class UsuarioController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', User::class);
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:60'], 'rol' => ['nullable', Rule::enum(Rol::class)],
            'activo' => ['nullable', Rule::in(['true', 'false', '1', '0'])], 'page' => ['integer', 'min:1'], 'per_page' => ['integer', Rule::in([10, 25, 50])]],
            ['*.in' => 'Selecciona un valor válido.', '*.integer' => 'Debe ser un entero.', 'q.max' => 'Máximo 60 caracteres.', 'rol.enum' => 'Selecciona un rol válido.']);
        $query = User::query()->select(['id', 'name', 'email', 'rol', 'activo', 'ultimo_acceso', 'created_at']);
        if (!empty($filters['q'])) {
            $q = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($filters['q'])).'%';
            $query->where(fn ($query) => $query->whereRaw("name LIKE ? ESCAPE '!'", [$q])->orWhereRaw("email LIKE ? ESCAPE '!'", [$q]));
        }
        if (!empty($filters['rol'])) $query->where('rol', $filters['rol']);
        if (isset($filters['activo'])) $query->where('activo', filter_var($filters['activo'], FILTER_VALIDATE_BOOLEAN));
        $page = $query->orderBy('name')->orderBy('id')->paginate((int) ($filters['per_page'] ?? 10));
        return response()->json(['data' => UsuarioResource::collection($page->items())->resolve(),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()]]);
    }
    public function store(GuardarUsuarioRequest $request, UsuarioService $service)
    {
        return (new UsuarioResource($service->create($request->user(), $request->validated())))->response()->setStatusCode(201);
    }
    public function show(User $usuario)
    {
        Gate::authorize('view', $usuario);
        return new UsuarioResource($usuario);
    }
    public function update(GuardarUsuarioRequest $request, User $usuario, UsuarioService $service)
    {
        return new UsuarioResource($service->change($request->user(), $usuario, $request->validated()));
    }
    public function activo(Request $request, User $usuario, UsuarioService $service)
    {
        Gate::authorize('update', $usuario);
        $data = $request->validate(['activo' => ['required', 'boolean']], ['activo.required' => 'Indica el estado.', 'activo.boolean' => 'El estado debe ser verdadero o falso.']);
        $data['activo'] = (bool) $data['activo'];
        return new UsuarioResource($service->change($request->user(), $usuario, $data));
    }
    public function destroy(Request $request, User $usuario, UsuarioService $service)
    {
        Gate::authorize('delete', $usuario);
        $service->change($request->user(), $usuario, delete: true);
        return response()->noContent();
    }
}
