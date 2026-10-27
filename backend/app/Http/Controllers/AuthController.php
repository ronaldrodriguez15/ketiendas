<?php
declare(strict_types=1);
namespace App\Http\Controllers;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UsuarioResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
final class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        // Generate the fallback for every attempt, so absent users do not skip hashing work.
        $fallback = Hash::make(bin2hex(random_bytes(32)));
        return DB::transaction(function () use ($request, $fallback) {
            $user = User::where('email', $request->validated('email'))->lockForUpdate()->first();
            $valid = Hash::check($request->validated('password'), $user?->password ?? $fallback);
            if (!$valid || !$user || !$user->activo) throw ValidationException::withMessages(['email' => ['Correo o contraseña incorrectos']]);
            $user->update(['ultimo_acceso' => now()]);
            return response()->json(['token' => $user->createToken('panel')->plainTextToken,
                'user' => (new UsuarioResource($user))->resolve(), 'permisos' => $user->rol->permisos()])->header('Cache-Control', 'no-store');
        });
    }
    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => (new UsuarioResource($request->user()))->resolve(), 'permisos' => $request->user()->rol->permisos()]);
    }
    public function logout(Request $request): \Illuminate\Http\Response
    {
        $request->user()->currentAccessToken()?->delete();
        return response()->noContent();
    }
}
