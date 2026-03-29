<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AuthWebController extends Controller
{
    /**
     * Handle login form submission
     */
    public function loginStore(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:8',
        ]);

        try {
            // Find user and validate password directly
            $user = User::where('email', $validated['email'])->with('role')->first();

            if (!$user || !Hash::check($validated['password'], $user->password)) {
                return back()->withErrors(['email' => 'Invalid email or password'])->withInput();
            }

            // Create session with user data
            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'address' => $user->address,
                'role' => [
                    'id' => $user->role->id,
                    'name' => $user->role->name,
                ],
                'created_at' => $user->created_at,
            ];

            Session::put('user', $userData);
            Session::put('authenticated', true);

            // Redirect based on role
            $role = $user->role->name;
            if ($role === 'customer') {
                return redirect('/customer/dashboard')->with('success', 'Welcome back!');
            } elseif ($role === 'seller') {
                return redirect('/seller/dashboard')->with('success', 'Welcome back!');
            } elseif ($role === 'admin') {
                return redirect('/admin/dashboard')->with('success', 'Welcome back!');
            }

            return redirect('/UrbanNext')->with('success', 'Welcome back!');
        } catch (\Exception $e) {
            return back()->withErrors(['email' => 'Login failed. Please try again.'])->withInput();
        }
    }

    /**
     * Handle register form submission
     */
    public function registerStore(Request $request)
    {
        $validated = $request->validate(
            [
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'role' => 'required|in:customer,seller',
                'password' => 'required|string|min:8|confirmed',
            ],
            [
                'email.unique' => 'This email is already in use.',
            ]
        );

        try {
            // Get role
            $roleModel = \App\Models\Role::where('name', $validated['role'])->first();
            if (!$roleModel) {
                return back()->withErrors(['role' => 'Invalid role'])->withInput();
            }

            // Create user
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role_id' => $roleModel->id,
            ]);

            $user = $user->fresh()->load('role');

            // Create session with user data
            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'address' => $user->address,
                'role' => [
                    'id' => $user->role->id,
                    'name' => $user->role->name,
                ],
                'created_at' => $user->created_at,
            ];

            Session::put('user', $userData);
            Session::put('authenticated', true);

            // Redirect based on role
            $role = $user->role->name;
            if ($role === 'customer') {
                return redirect('/customer/dashboard')->with('success', 'Account created successfully!');
            } elseif ($role === 'seller') {
                return redirect('/seller/dashboard')->with('success', 'Account created successfully!');
            }

            return redirect('/UrbanNext')->with('success', 'Account created successfully!');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Registration failed. Please try again.'])->withInput();
        }
    }

    /**
     * Handle logout
     */
    public function logout(Request $request)
    {
        Session::forget(['token', 'user', 'authenticated']);
        Session::flush();
        return redirect('/UrbanNext')->with('success', 'Logged out successfully');
    }
}

