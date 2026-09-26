<#
  Transport Ledger - PowerShell Server Launcher & Fallback Runner
  Automatically detects Node.js runtime and launches the Enterprise REST API server.
  If Node.js is not present, runs a native PowerShell static file server.
#>

$port = 8080
$rootPath = $PSScriptRoot

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Transport Ledger - Launcher" -ForegroundColor Green
Write-Host "  Directory: $rootPath" -ForegroundColor Gray
Write-Host "================================================================" -ForegroundColor Cyan

# Check for Node.js
$nodeInstalled = $false
try {
    $nodeVersion = node -v 2>$null
    if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
        $nodeInstalled = $true
    }
} catch {
    $nodeInstalled = $false
}

if ($nodeInstalled) {
    Write-Host "Node.js detected ($nodeVersion). Starting full REST API server (server.js)..." -ForegroundColor Yellow
    Push-Location $rootPath
    try {
        & node server.js
    } finally {
        Pop-Location
    }
    exit
}

Write-Host "Node.js not detected on PATH. Starting native PowerShell HTTP listener..." -ForegroundColor Yellow

$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, $port)
$tcpListener = New-Object System.Net.Sockets.TcpListener($endpoint)
$tcpListener.Start()

Write-Host "PowerShell Server listening on all interfaces on port $port!" -ForegroundColor Green
Write-Host "Local URL: http://localhost:$port/" -ForegroundColor Cyan

try {
    while ($true) {
        $client = $tcpListener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $writer = New-Object System.IO.StreamWriter($stream)

        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($requestLine)) {
            $client.Close()
            continue
        }

        $tokens = $requestLine.Split(' ')
        if ($tokens.Length -ge 2) {
            $urlPath = $tokens[1]
            if ($urlPath -eq "/") { $urlPath = "/index.html" }
            
            # Remove query params
            if ($urlPath.Contains("?")) {
                $urlPath = $urlPath.Substring(0, $urlPath.IndexOf("?"))
            }

            $localPath = Join-Path $rootPath $urlPath.TrimStart("/").Replace("/", "\")

            if (Test-Path $localPath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($localPath)
                $ext = [System.IO.Path]::GetExtension($localPath).ToLower()

                $contentType = "application/octet-stream"
                switch ($ext) {
                    ".html" { $contentType = "text/html; charset=utf-8" }
                    ".css"  { $contentType = "text/css; charset=utf-8" }
                    ".js"   { $contentType = "application/javascript; charset=utf-8" }
                    ".json" { $contentType = "application/json; charset=utf-8" }
                    ".svg"  { $contentType = "image/svg+xml" }
                    ".png"  { $contentType = "image/png" }
                    ".jpg"  { $contentType = "image/jpeg" }
                    ".webp" { $contentType = "image/webp" }
                }

                $header = "HTTP/1.1 200 OK`r`n" +
                          "Content-Type: $contentType`r`n" +
                          "Content-Length: $($bytes.Length)`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Connection: close`r`n`r`n"

                $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            } else {
                $notFound = "HTTP/1.1 404 Not Found`r`nContent-Length: 9`r`n`r`nNot Found"
                $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($notFound)
                $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
            }
        }
        $stream.Flush()
        $client.Close()
    }
} finally {
    $tcpListener.Stop()
}
