Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

[void][Windows.Media.Ocr.OcrEngine, Windows.Media, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.RandomAccessStream, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]

function Await-Async {
    param($AsyncTask, [System.Type]$ResultType)
    $getAwaiter = [WindowsRuntimeSystemExtensions].GetMember('GetAwaiter', 'Method', 'Public,Static') | 
                  Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | 
                  Select-Object -First 1
    return $getAwaiter.MakeGenericMethod($ResultType).Invoke($null, @($AsyncTask)).GetResult()
}

$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($ocrEngine -eq $null) {
    Write-Host "Failed to create OcrEngine. Check if language packs are installed."
    exit 1
}

for ($i = 1; $i -le 10; $i++) {
    $imageFile = "page_$i.png"
    if (Test-Path $imageFile) {
        Write-Host "Processing $imageFile..."
        $imagePath = (Get-Item $imageFile).FullName
        $bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)

        $memoryStream = New-Object System.IO.MemoryStream
        $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $memoryStream.Position = 0

        # Convert .NET MemoryStream to WinRT IRandomAccessStream
        $randomAccessStream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($memoryStream)

        # Decode image to SoftwareBitmap
        $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($randomAccessStream)
        $decoder = Await-Async $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])

        $bitmapTask = $decoder.GetSoftwareBitmapAsync()
        $softwareBitmap = Await-Async $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])

        # Run OCR
        $ocrTask = $ocrEngine.RecognizeAsync($softwareBitmap)
        $result = Await-Async $ocrTask ([Windows.Media.Ocr.OcrResult])

        # Save to text file
        $result.Text | Out-File -FilePath "page_$i.txt" -Encoding utf8
        
        # Clean up resources
        $bitmap.Dispose()
        $memoryStream.Dispose()
    }
}
Write-Host "Batch OCR complete."
