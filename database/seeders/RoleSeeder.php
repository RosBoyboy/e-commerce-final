<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Role::firstOrCreate(
            ['name' => 'customer'],
            ['description' => 'Customer who can buy products']
        );

        Role::firstOrCreate(
            ['name' => 'seller'],
            ['description' => 'Seller who can list and sell products']
        );

        Role::firstOrCreate(
            ['name' => 'admin'],
            ['description' => 'Admin who can manage the platform']
        );

        Role::firstOrCreate(
            ['name' => 'rider'],
            ['description' => 'Delivery rider (built-in fleet accounts)']
        );
    }
}
