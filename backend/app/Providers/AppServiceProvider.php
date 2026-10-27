<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Gate::policy(\App\Models\User::class, \App\Policies\UsuarioPolicy::class);
        foreach (['dashboard.ver', 'ventas.ver', 'reportes.ver', 'usuarios.gestionar'] as $permission) {
            \Illuminate\Support\Facades\Gate::define($permission, fn (\App\Models\User $user) => $user->activo && in_array($permission, $user->rol->permisos(), true));
        }
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $email = is_string($request->input('email')) ? mb_strtolower(trim($request->input('email'))) : '';
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by(hash('sha256', $email.'|'.$request->ip()))
                ->response(fn ($request, $headers) => response()->json(['message' => 'Demasiados intentos. Espera un minuto.'], 429, $headers));
        });
    }
}
