Set-Location "C:\Users\Hershey\Desktop\축구게임 만들기"
$htmlPath = "mobile_release.html"
$htmlContent = [IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$images = @(
    @{ Path = "sample picture\cat.jpg"; Search = "sample picture/cat.jpg"; Mime = "image/jpeg" },
    @{ Path = "sample picture\monkey.jpg"; Search = "sample picture/monkey.jpg"; Mime = "image/jpeg" },
    @{ Path = "sample picture\soccor ball.jpg"; Search = "sample picture/soccor ball.jpg"; Mime = "image/jpeg" }
)

foreach ($img in $images) {
    $bytes = [IO.File]::ReadAllBytes((Resolve-Path $img.Path).Path)
    $base64 = [Convert]::ToBase64String($bytes)
    $dataUri = "data:$($img.Mime);base64,$base64"
    $htmlContent = $htmlContent.Replace($img.Search, $dataUri)
}

[IO.File]::WriteAllText($htmlPath, $htmlContent, [System.Text.Encoding]::UTF8)
Write-Output "Done"