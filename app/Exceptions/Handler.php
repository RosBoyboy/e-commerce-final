<?php

namespace App\Exceptions;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use PDOException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<Throwable>>
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed for validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Add CORS headers to API error responses so browser doesn't block with "No CORS header"
     */
    protected function shouldReturnJson($request, Throwable $e)
    {
        return $request->expectsJson() || $request->is('api/*');
    }

    public function render($request, Throwable $e)
    {
        if ($request->is('api/*') && $this->isDatabaseConnectionException($e)) {
            return response()->json([
                'message' => 'Cannot connect to the database. Please start MySQL and verify your DB settings in .env.',
            ], 500);
        }

        $response = parent::render($request, $e);
        if ($request->is('api/*') && method_exists($response, 'header')) {
            $origin = $request->header('Origin');
            $allowed = in_array($origin, [
                'https://urbannext.vercel.app',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
            ], true) || ($origin && preg_match('#^https://[a-z0-9.-]+\.vercel\.app$#', $origin));
            if ($allowed && $origin) {
                $response->header('Access-Control-Allow-Origin', $origin);
                $response->header('Access-Control-Allow-Credentials', 'true');
                $response->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                $response->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
            }
        }
        return $response;
    }

    protected function isDatabaseConnectionException(Throwable $e): bool
    {
        $current = $e;
        while ($current) {
            if ($current instanceof PDOException || $current instanceof QueryException) {
                return true;
            }
            $current = $current->getPrevious();
        }
        return false;
    }
}
