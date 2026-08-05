$port = 8080
$path = "C:\Users\es330\.gemini\antigravity\scratch\transport-ledger"

$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, $port)
$tcpListener = New-Object System.Net.Sockets.TcpListener($endpoint)
$tcpListener.Start()

Write-Host "Transport Ledger Server listening on all interfaces on port $port!"
Write-Host "Mobile Access URL: http://172.16.20.12:$port/"

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

            $localPath = Join-Path $path $urlPath.TrimStart("/").Replace("/", "\")

            if (Test-Path $localPath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($localPath)
                $ext = [System.IO.Path]::GetExtension($localPath).ToLower()

                $contentType = "text/plain"
                switch ($ext) {
                    ".html" { $contentType = "text/html; charset=utf-8" }
                    ".css"  { $contentType = "text/css; charset=utf-8" }
                    ".js"   { $contentType = "application/javascript; charset=utf-8" }
                    ".json" { $contentType = "application/json; charset=utf-8" }
                    ".svg"  { $contentType = "image/svg+xml" }
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
