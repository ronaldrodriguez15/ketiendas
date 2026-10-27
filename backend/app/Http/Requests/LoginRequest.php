<?php
declare(strict_types=1);
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\ValidationException;
final class LoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    protected function prepareForValidation(): void
    {
        if (is_string($this->email)) $this->merge(['email' => mb_strtolower(trim($this->email))]);
    }
    public function rules(): array { return ['email' => ['required', 'email', 'max:254'], 'password' => ['required', 'string', 'max:1024']]; }
    protected function failedValidation(Validator $validator): void
    {
        throw ValidationException::withMessages(['email' => ['Correo o contraseña incorrectos']]);
    }
}
