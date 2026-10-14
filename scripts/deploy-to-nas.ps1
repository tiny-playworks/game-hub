# Defaults to local preparation. -Activate/-Rollback perform authorised NAS changes.
param(
    [switch]$PrepareOnly,
    [switch]$PreflightOnly,
    [switch]$Activate,
    [switch]$Rollback,
    [string]$NasHost = "synology-nas",
    [string]$NasRoot = "/volume1/docker/game-hub",
    [string]$BaseUrl = "http://192.168.50.21:8089",
    [string]$ReleaseId = ""
)
$ErrorActionPreference = "Stop"
$modes = @($PrepareOnly, $PreflightOnly, $Activate, $Rollback) | Where-Object { $_ }
if ($modes.Count -gt 1) { throw "每次只能选择一个模式。" }
if ($modes.Count -eq 0) { $PrepareOnly = $true }
if ($NasHost -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.@:-]*$') { throw "SSH 主机名不合法。" }
if ($NasRoot -notmatch '^/[A-Za-z0-9_/-]+$') { throw "NAS 根目录不合法。" }
if ($BaseUrl -notmatch '^https?://[A-Za-z0-9.:-]+/?$') { throw "健康检查地址不合法。" }
$BaseUrl = $BaseUrl.TrimEnd('/')
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$remoteScript = Join-Path $PSScriptRoot "nas-release.sh"
function Invoke-NasRelease([string]$Mode, [string]$Id) {
    # Normalise Windows CRLF before sh parses the streamed script.
    Get-Content -Raw -Encoding UTF8 $remoteScript | ssh -o BatchMode=yes -o ConnectTimeout=8 $NasHost "tr -d '\015' | sh -s -- $Mode $NasRoot $Id $BaseUrl"
    if ($LASTEXITCODE -ne 0) { throw "NAS $Mode 失败；未声称部署成功。" }
}
if ($PreflightOnly) {
    Invoke-NasRelease "status" "ignored"
    Write-Host "只读指针检查完成；仍须现场核对 Nginx 配置、父目录挂载、端口与权限。"
    exit 0
}
if ($Rollback) {
    Invoke-NasRelease "rollback" "previous"
    exit 0
}
if (!$ReleaseId) { $ReleaseId = Get-Date -Format "yyyyMMddHHmmss" }
if ($ReleaseId -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$') { throw "版本 ID 不合法。" }
Push-Location $repo
try {
    node ./scripts/prepare-nas-release.mjs $ReleaseId
    if ($LASTEXITCODE -ne 0) { throw "构建或本地版本准备失败。" }
    $releasePath = Join-Path $repo "output/nas/$ReleaseId"
    if ($PrepareOnly) {
        Write-Host "本地版本已准备：$releasePath；没有连接或修改 NAS。"
        exit 0
    }
    Write-Host "激活前必须已核对 deploy/nas/nginx.conf 和父目录挂载；原 site 不会自动删除。"
    Invoke-NasRelease "stage" $ReleaseId
    foreach ($entry in (Get-ChildItem -LiteralPath $releasePath -Force)) {
        scp -O -r $entry.FullName "${NasHost}:${NasRoot}/releases/${ReleaseId}/"
        if ($LASTEXITCODE -ne 0) { throw "上传失败（$($entry.Name)）；当前活动版本未切换。" }
    }
    Invoke-NasRelease "check" $ReleaseId
    Invoke-NasRelease "activate" $ReleaseId
    Write-Host "版本健康检查通过：$ReleaseId，$BaseUrl"
} finally {
    Pop-Location
}
