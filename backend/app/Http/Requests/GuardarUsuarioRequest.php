<?php
declare(strict_types=1);
namespace App\Http\Requests;
use App\Enums\Rol;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
final class GuardarUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->route('usuario') ? $this->user()->can('update', $this->route('usuario')) : $this->user()->can('create', User::class);
    }
    protected function prepareForValidation(): void
    {
        if (is_string($this->email)) $this->merge(['email' => mb_strtolower(trim($this->email))]);
    }
    public function rules(): array
    {
        return ['nombre' => ['required', 'string', 'min:2', 'max:80'],
            'email' => ['required', 'email', 'max:254', Rule::unique('users')->ignore($this->route('usuario'))],
            'rol' => ['required', Rule::enum(Rol::class)],
            'password' => [$this->isMethod('POST') ? 'required' : 'nullable', 'string', 'max:1024', Password::min(10)->mixedCase()->numbers(), 'confirmed']];
    }
    public function messages(): array
    {
        return ['*.required' => 'Este campo es obligatorio.', '*.string' => 'Debe ser texto.', 'nombre.min' => 'Escribe al menos 2 caracteres.', 'nombre.max' => 'Máximo 80 caracteres.',
            'email.email' => 'Escribe un correo válido.', 'email.unique' => 'Este correo ya está registrado.', '*.max' => 'El valor es demasiado largo.',
            'rol.enum' => 'Selecciona un rol válido.', 'password.min' => 'Usa al menos 10 caracteres.', 'password.mixed' => 'Incluye mayúsculas y minúsculas.',
            'password.numbers' => 'Incluye al menos un número.', 'password.confirmed' => 'Las contraseñas no coinciden.'];
    }
}
