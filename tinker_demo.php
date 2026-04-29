<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$roles = ['admin', 'customer', 'seller', 'rider'];
$roleIds = [];
foreach ($roles as $r) {
    $role = Role::firstOrCreate(['name' => $r]);
    $roleIds[$r] = $role->id;
}

$users = [
    ['name' => 'Admin', 'email' => 'admin@example.com', 'password' => Hash::make('password123'), 'role_id' => $roleIds['Admin']],
    ['name' => 'Customer', 'email' => 'customer@example.com', 'password' => Hash::make('password123'), 'role_id' => $roleIds['Customer']],
    ['name' => 'Seller', 'email' => 'seller@example.com', 'password' => Hash::make('password123'), 'role_id' => $roleIds['Seller']],
    ['name' => 'Marnel Rider', 'email' => 'marnel@rider.com', 'password' => Hash::make('password123'), 'role_id' => $roleIds['Rider']],
    ['name' => 'Jeban Rider', 'email' => 'jeban@rider.com', 'password' => Hash::make('password123'), 'role_id' => $roleIds['Rider']],
];

foreach ($users as $u) {
    User::firstOrCreate(['email' => $u['email']], $u);
}

echo "Demo accounts created successfully!\n";
