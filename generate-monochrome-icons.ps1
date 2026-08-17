Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(13, 14, 18))

# Draw rounded border
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 255, 255, 255)), 4
$graphics.DrawRectangle($pen, 10, 10, 236, 236)

# Draw minimalist white hourglass
$whitePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 14
$whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

# Top and bottom bars
$graphics.DrawLine($whitePen, 64, 52, 192, 52)
$graphics.DrawLine($whitePen, 64, 204, 192, 204)

# Top triangle/curve
$topPoints = @(
    [System.Drawing.PointF]::new(76, 52),
    [System.Drawing.PointF]::new(110, 100),
    [System.Drawing.PointF]::new(128, 128),
    [System.Drawing.PointF]::new(146, 100),
    [System.Drawing.PointF]::new(180, 52)
)
$graphics.DrawCurve($whitePen, $topPoints, 0.5)

# Bottom triangle/curve
$bottomPoints = @(
    [System.Drawing.PointF]::new(76, 204),
    [System.Drawing.PointF]::new(110, 156),
    [System.Drawing.PointF]::new(128, 128),
    [System.Drawing.PointF]::new(146, 156),
    [System.Drawing.PointF]::new(180, 204)
)
$graphics.DrawCurve($whitePen, $bottomPoints, 0.5)

# Center diamond/crystal
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$diamond = @(
    [System.Drawing.Point]::new(128, 106),
    [System.Drawing.Point]::new(144, 128),
    [System.Drawing.Point]::new(128, 150),
    [System.Drawing.Point]::new(112, 128)
)
$graphics.FillPolygon($brush, $diamond)

# Save PNGs
$bitmap.Save("d:\Devs\ArcRift\desktop\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save("d:\Devs\ArcRift\dashboard\public\logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save("d:\Devs\ArcRift\dashboard\public\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Convert to ICO
$hIcon = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fileStream = New-Object System.IO.FileStream("d:\Devs\ArcRift\desktop\icon.ico", [System.IO.FileMode]::Create)
$icon.Save($fileStream)
$fileStream.Close()
$icon.Dispose()

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Successfully generated monochrome PNG and ICO icons!"
