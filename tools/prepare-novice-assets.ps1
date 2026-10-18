param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceRoot
)

$ErrorActionPreference = "Stop"
$resources = (Resolve-Path -LiteralPath $ResourceRoot).Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$outputDirectory = Join-Path $projectRoot "public\local-assets\novice"
$male = [char]0xB0A8
$bodyCategory = -join ([char[]](0xBAB8, 0xD1B5))
$headCategory = -join ([char[]](0xBA38, 0xB9AC, 0xD1B5))
$humanCategory = -join ([char[]](0xC778, 0xAC04, 0xC871))
$bodyPaletteCategory = [char]0xBAB8
$headPaletteCategory = -join ([char[]](0xBA38, 0xB9AC))
$beginner = -join ([char[]](0xCD08, 0xBCF4, 0xC790))
$bodyBaseName = "${beginner}_$male"
$hairOutputDirectory = Join-Path $outputDirectory "hair"
$files = @{
    "body.spr" = Join-Path $resources "data\sprite\$humanCategory\$bodyCategory\$male\$bodyBaseName.spr"
    "body.act" = Join-Path $resources "data\sprite\$humanCategory\$bodyCategory\$male\$bodyBaseName.act"
    "body.imf" = Join-Path $resources "data\imf\$bodyBaseName.imf"
}

foreach ($name in $files.Keys) {
    if (-not (Test-Path -LiteralPath $files[$name] -PathType Leaf)) {
        throw "Required Novice asset was not found: $($files[$name])"
    }
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $hairOutputDirectory -Force | Out-Null
foreach ($name in $files.Keys) {
    Copy-Item -LiteralPath $files[$name] -Destination (Join-Path $outputDirectory $name) -Force
}

for ($palette = 0; $palette -le 8; $palette++) {
    $palettePath = Join-Path $resources "data\palette\$bodyPaletteCategory\$bodyBaseName`_$palette.pal"
    if (-not (Test-Path -LiteralPath $palettePath -PathType Leaf)) {
        throw "Required Novice body palette was not found: $palettePath"
    }
    Copy-Item -LiteralPath $palettePath -Destination (Join-Path $outputDirectory "body_$palette.pal") -Force
}

for ($hairStyle = 1; $hairStyle -le 42; $hairStyle++) {
    $hairBaseName = "${hairStyle}_$male"
    $spritePath = Join-Path $resources "data\sprite\$humanCategory\$headCategory\$male\$hairBaseName.spr"
    $actionPath = Join-Path $resources "data\sprite\$humanCategory\$headCategory\$male\$hairBaseName.act"
    foreach ($sourcePath in @($spritePath, $actionPath)) {
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Required Novice hairstyle asset was not found: $sourcePath"
        }
    }

    $spriteOutputPath = Join-Path $hairOutputDirectory "$hairStyle.spr"
    Copy-Item -LiteralPath $spritePath -Destination $spriteOutputPath -Force
    Copy-Item -LiteralPath $actionPath -Destination (Join-Path $hairOutputDirectory "$hairStyle.act") -Force

    for ($palette = 0; $palette -le 8; $palette++) {
        $paletteName = "${headPaletteCategory}${hairBaseName}_${palette}.pal"
        $palettePath = Join-Path $resources "data\palette\$headPaletteCategory\$paletteName"
        $paletteOutputPath = Join-Path $hairOutputDirectory "${hairStyle}_${palette}.pal"
        if (Test-Path -LiteralPath $palettePath -PathType Leaf) {
            Copy-Item -LiteralPath $palettePath -Destination $paletteOutputPath -Force
        }
        elseif ($palette -eq 0) {
            $spriteBytes = [System.IO.File]::ReadAllBytes($spritePath)
            if ($spriteBytes.Length -lt 1024) {
                throw "SPR file is too small to contain an embedded palette: $spritePath"
            }
            $embeddedPalette = New-Object byte[] 1024
            [Array]::Copy($spriteBytes, $spriteBytes.Length - 1024, $embeddedPalette, 0, 1024)
            [System.IO.File]::WriteAllBytes($paletteOutputPath, $embeddedPalette)
        }
        else {
            throw "Required Novice hairstyle palette was not found: $palettePath"
        }
    }
}

$jobAssetPreparer = Join-Path $PSScriptRoot "prepare-local-job-assets.js"
$jobOutputDirectory = Join-Path $projectRoot "public\local-assets\jobs"
$jobListPath = Join-Path $projectRoot "src\components\character\JobList.vue"
& node $jobAssetPreparer $resources $jobOutputDirectory $jobListPath
if ($LASTEXITCODE -ne 0) {
    throw "Local job asset preparation failed."
}

$equipmentPreparer = Join-Path $PSScriptRoot "prepare-novice-equipment-assets.js"
$itemsPath = Join-Path $projectRoot "src\db\items.json"
$jobManifestPath = Join-Path $jobOutputDirectory "manifest.json"
& node $equipmentPreparer $resources $outputDirectory $itemsPath $jobManifestPath
if ($LASTEXITCODE -ne 0) {
    throw "Local equipment asset preparation failed."
}

Write-Output "Prepared Novice equipment in $outputDirectory and all available job/gender assets in $jobOutputDirectory"
