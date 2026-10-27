<?php
declare(strict_types=1);
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
final class UsuarioActivo
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->activo && !$request->user()->trashed(), 401, 'La sesión no está disponible.');
        return $next($request)->header('Cache-Control', 'no-store');
    }
}
