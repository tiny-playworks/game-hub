# One-click deploy game-hub to Synology NAS
$ErrorActionPreference = "Stop"

Write-Host "==> 1. 构建生产静态资源..." -ForegroundColor Cyan
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Error "构建失败，已中止部署。"
    exit $LASTEXITCODE
}

Write-Host "==> 2. 同步静态文件到群晖 NAS (/volume1/docker/game-hub/site)..." -ForegroundColor Cyan
scp -O -r dist/* synology-nas:/volume1/docker/game-hub/site/
if ($LASTEXITCODE -ne 0) {
    Write-Error "文件同步失败，请检查 SSH 连接与权限。"
    exit $LASTEXITCODE
}

Write-Host "==> 部署更新完成！可直接在局域网访问: http://192.168.50.21:8089" -ForegroundColor Green
