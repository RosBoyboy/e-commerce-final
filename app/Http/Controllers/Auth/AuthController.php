<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Rider;
use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Reserved domain for delivery partner (rider) accounts — not valid for customer signup. */
    private const RIDER_EMAIL_DOMAIN = 'rider.com';

    /**
     * Register a new user (customer or rider).
     * Riders must use an @rider.com address; that domain is not allowed for customers.
     */
    public function register(Request $request)
    {
        $validated = $request->validate(
            [
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users,email',
                'password' => 'required|string|min:8|confirmed',
                'phone' => 'required|string|max:20',
                'address' => 'required|string|min:10|max:2000',
                'role' => 'nullable|string|in:customer,rider',
                'vehicle_plate' => 'required_if:role,rider|nullable|string|max:32',
            ],
            [
                'email.unique' => 'This email is already in use.',
            ]
        );

        $roleName = $validated['role'] ?? 'customer';
        $email = strtolower(trim($validated['email']));
        $domain = self::RIDER_EMAIL_DOMAIN;
        $mustBeRiderEmail = str_ends_with($email, '@' . $domain);

        if ($roleName === 'rider') {
            if (!$mustBeRiderEmail) {
                throw ValidationException::withMessages([
                    'email' => ["Delivery partner accounts must register with an email ending in @{$domain}."],
                ]);
            }
            $role = Role::where('name', 'rider')->first();
            if (!$role) {
                return response()->json(['message' => 'Rider registration is not available.'], 400);
            }
        } else {
            if ($mustBeRiderEmail) {
                throw ValidationException::withMessages([
                    'email' => ["The @{$domain} address is reserved for delivery partners. Choose “Delivery partner” signup or use another email."],
                ]);
            }
            $role = Role::where('name', 'customer')->first();
            if (!$role) {
                return response()->json(['message' => 'Registration not available.'], 400);
            }
        }

        $user = DB::transaction(function () use ($validated, $email, $role, $roleName) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $email,
                'password' => Hash::make($validated['password']),
                'phone' => $validated['phone'] ?? null,
                'address' => $validated['address'] ?? null,
                'role_id' => $role->id,
            ]);

            if ($roleName === 'rider') {
                Rider::create([
                    'user_id' => $user->id,
                    'phone' => $validated['phone'],
                    'vehicle_plate' => $validated['vehicle_plate'],
                    'address' => $validated['address'],
                    'status' => 'available',
                ]);
            }

            return $user;
        });

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully',
            'user' => $user->load('role'),
            'token' => $token,
        ], 201);
    }

    /**
     * Login user
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->is_archived) {
            throw ValidationException::withMessages([
                'email' => ['This account has been archived. Contact support to restore access.'],
            ]);
        }

        // Delete existing tokens
        $user->tokens()->delete();

        // Create new token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $user->load('role'),
            'token' => $token,
        ], 200);
    }

    /**
     * Get current authenticated user
     */
    public function user(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load('role'),
        ], 200);
    }

    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful',
        ], 200);
    }
}
