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
    Write-Host "Failed to create OcrEngine."
    exit 1
}

# Get total pages from PDF using a simple python one-liner
$totalPages = & .venv\Scripts\python -c "import fitz; doc=fitz.open('T1-2.pdf'); print(len(doc))"
$totalPages = [int]$totalPages.Trim()
Write-Host "Total Pages in PDF: $totalPages"

$report = @()

for ($i = 1; $i -le $totalPages; $i++) {
    # Extract page i using python
    $pageIdx = $i - 1
    & .venv\Scripts\python -c "import fitz; doc=fitz.open('T1-2.pdf'); page=doc.load_page($pageIdx); pix=page.get_pixmap(dpi=100); pix.save('temp_page.png')"
    
    if (Test-Path "temp_page.png") {
        $imagePath = (Get-Item "temp_page.png").FullName
        $bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)

        $memoryStream = New-Object System.IO.MemoryStream
        $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $memoryStream.Position = 0

        $randomAccessStream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($memoryStream)

        $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($randomAccessStream)
        $decoder = Await-Async $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])

        $bitmapTask = $decoder.GetSoftwareBitmapAsync()
        $softwareBitmap = Await-Async $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])

        $ocrTask = $ocrEngine.RecognizeAsync($softwareBitmap)
        $result = Await-Async $ocrTask ([Windows.Media.Ocr.OcrResult])

        # Get first few lines of text
        $lines = $result.Text -split "`n"
        $header = ""
        $count = 0
        foreach ($line in $lines) {
            if ($line.Trim() -ne "") {
                $header += $line.Trim() + " | "
                $count++
                if ($count -ge 3) { break }
            }
        }
        
        $pageInfo = "Page $i : $header"
        Write-Host $pageInfo
        $report += $pageInfo

        $bitmap.Dispose()
        $memoryStream.Dispose()
        Remove-Item "temp_page.png" -ErrorAction SilentlyContinue
    }
}

$report | Out-File -FilePath "pdf_structure.txt" -Encoding utf8
Write-Host "Structure saved to pdf_structure.txt"
