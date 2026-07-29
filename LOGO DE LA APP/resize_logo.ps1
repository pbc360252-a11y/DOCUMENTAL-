[Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null
$srcPath = "C:\Users\gdocumental\Downloads\APP GESTION DOCUMENTAL\LOGO DE LA APP\App_icon_premium_blue_palette_202607061038.jpeg"
$destPath = "C:\Users\gdocumental\Downloads\APP GESTION DOCUMENTAL\LOGO DE LA APP\logo_resized.jpg"

$srcImage = [System.Drawing.Image]::FromFile($srcPath)
$newImage = New-Object System.Drawing.Bitmap(160, 160)
$graphics = [System.Drawing.Graphics]::FromImage($newImage)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($srcImage, 0, 0, 160, 160)

$newImage.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)

$srcImage.Dispose()
$newImage.Dispose()
$graphics.Dispose()

$bytes = [System.IO.File]::ReadAllBytes($destPath)
$base64 = [System.Convert]::ToBase64String($bytes)
[System.IO.File]::WriteAllText("C:\Users\gdocumental\Downloads\APP GESTION DOCUMENTAL\LOGO DE LA APP\logo_base64.txt", $base64)
Write-Output "Resized and saved base64 to logo_base64.txt. Size: $($base64.Length) chars"
