param(
    [Parameter(Mandatory = $true)]
    [string]$RendererPath,

    [Parameter(Mandatory = $true)]
    [string]$ResourceRoot
)

$ErrorActionPreference = "Stop"
$renderer = (Resolve-Path -LiteralPath $RendererPath).Path
$resources = (Resolve-Path -LiteralPath $ResourceRoot).Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$outputPath = Join-Path $projectRoot "public\local-assets\novice-default.png"
$temporaryOutput = Join-Path ([System.IO.Path]::GetTempPath()) ("novice-render-" + [guid]::NewGuid())
$rendererDirectory = Split-Path -Parent $renderer

if (-not (Test-Path -LiteralPath (Join-Path $resources "data\luafiles514\lua files\datainfo\accessoryid.lub"))) {
    throw "ResourceRoot must contain the extracted data\luafiles514\lua files resources."
}

if (-not (Test-Path -LiteralPath (Join-Path $resources "data\sprite"))) {
    throw "ResourceRoot\data\sprite was not found."
}

New-Item -ItemType Directory -Path $temporaryOutput -Force | Out-Null

$arguments = @(
    "--resourcepath=$resources"
    "--job=0"
    "--gender=male"
    "--head=1"
    "--action=0"
    "--frame=0"
    "--headPalette=1"
    "--bodyPalette=0"
    "--headdir=straight"
    "--enableShadow=true"
    "--singleframes=true"
    "--canvas=200x200+100+150"
    "--outdir=$temporaryOutput"
    "--outputFormat=png"
)

try {
    Push-Location -LiteralPath $rendererDirectory
    try {
        & $renderer @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "zrenderer exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    $renderedImages = @(Get-ChildItem -LiteralPath $temporaryOutput -Recurse -File -Filter "*.png")
    if ($renderedImages.Count -ne 1) {
        throw "Expected one Novice frame, but zrenderer produced $($renderedImages.Count) PNG files."
    }

    $destinationDirectory = Split-Path -Parent $outputPath
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $renderedImages[0].FullName -Destination $outputPath -Force
    Write-Output "Created local preview: $outputPath"
}
finally {
    if (Test-Path -LiteralPath $temporaryOutput) {
        Remove-Item -LiteralPath $temporaryOutput -Recurse -Force
    }
}
