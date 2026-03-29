<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RiderSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::where('name', 'rider')->first();
        if (!$role) {
            return;
        }

        $riders = [
            [
                'name' => 'Marnel Lusica',
                'email' => 'marnel@rider.com',
                'password' => 'password123',
                'phone' => '09171234567',
                'vehicle_plate' => '2456SW',
            ],
            [
                'name' => 'Jeban Orit',
                'email' => 'jeban@rider.com',
                'password' => 'password123',
                'phone' => '09179876543',
                'vehicle_plate' => '223SF',
            ],
        ];

        foreach ($riders as $data) {
            $user = User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make($data['password']),
                    'role_id' => $role->id,
                    'phone' => $data['phone'],
                ]
            );

            if (!$user->wasRecentlyCreated) {
                $user->update([
                    'name' => $data['name'],
                    'role_id' => $role->id,
                    'password' => Hash::make($data['password']),
                    'phone' => $data['phone'],
                ]);
            }

            $rider = Rider::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'phone' => $data['phone'],
                    'vehicle_plate' => $data['vehicle_plate'],
                    'status' => 'available',
                ]
            );
            $rider->update([
                'phone' => $data['phone'],
                'vehicle_plate' => $data['vehicle_plate'],
            ]);
        }
    }
}
