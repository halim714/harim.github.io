# MekiSamsungSync.ps1 — Samsung Notes → Meki Windows 래퍼
# 사용법: Samsung Notes 내보내기(.sdocx) 폴더를 이 스크립트로 드래그 앤 드롭
# 또는 PowerShell에서: .\MekiSamsungSync.ps1 "C:\Users\...\Downloads\notes"

param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Paths
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Node.js 탐색
$NodeExe = $null
foreach ($candidate in @(
    (Get-Command node -ErrorAction SilentlyContinue)?.Source,
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:APPDATA\nvm\current\node.exe"
)) {
    if ($candidate -and (Test-Path $candidate)) {
        $NodeExe = $candidate
        break
    }
}

if (-not $NodeExe) {
    [System.Windows.Forms.MessageBox]::Show(
        "Node.js가 설치되지 않았습니다.`nhttps://nodejs.org 에서 설치 후 다시 시도하세요.",
        "Meki Samsung Sync", "OK", "Error"
    ) | Out-Null
    exit 1
}

# 경로 없이 실행하면 폴더 선택 대화상자
if (-not $Paths) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Samsung Notes .sdocx 파일이 있는 폴더를 선택하세요"
    if ($dialog.ShowDialog() -eq "OK") {
        $Paths = @($dialog.SelectedPath)
    } else {
        exit 0
    }
}

# bridge-server.js 실행
$ServerScript = Join-Path $ScriptDir "bridge-server.js"
& $NodeExe $ServerScript @Paths
