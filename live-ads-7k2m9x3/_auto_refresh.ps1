# LACALUT Live Ads Monitor - scheduled auto refresh (every 30 min via Task Scheduler)
# Pulls fresh Meta data, rebuilds the page, pushes to GitHub Pages. ASCII only (cp1252-safe).
$dir  = "C:\Users\conta\lacalut-pages\live-ads-7k2m9x3"
$repo = "C:\Users\conta\lacalut-pages"
$log  = Join-Path $dir "_auto_refresh.log"
$lock = Join-Path $dir "_auto_refresh.lock"

function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "dd/MM HH:mm:ss"), $m) }

# never two runs at once; a lock older than 2h is stale (crashed run) and is cleared
if (Test-Path $lock) {
    if ((Get-Item $lock).LastWriteTime -gt (Get-Date).AddHours(-2)) { exit 0 }
    Remove-Item $lock -Force
}
New-Item -Path $lock -ItemType File -Force | Out-Null
try {
    Set-Location $dir
    python -X utf8 _pull_live.py *> $null
    if ($LASTEXITCODE -ne 0) { Log "pull FAILED ($LASTEXITCODE)"; exit 1 }
    python -X utf8 _build_monitor.py *> $null
    if ($LASTEXITCODE -ne 0) { Log "build FAILED ($LASTEXITCODE)"; exit 1 }

    Set-Location $repo
    git add live-ads-7k2m9x3/*.json live-ads-7k2m9x3/index.html live-ads-7k2m9x3/monitor.html live-ads-7k2m9x3/thumbs 2>$null
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Log "no changes"; exit 0 }
    git -c core.hooksPath=/dev/null commit -q -m "live-ads: auto refresh

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" | Out-Null
    git pull --rebase -q origin main 2>$null
    git push -q origin main
    if ($LASTEXITCODE -eq 0) { Log "pushed OK" } else { Log "push FAILED" }
}
finally {
    Remove-Item $lock -Force -ErrorAction SilentlyContinue
}

# keep the log small
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 200KB)) {
    Get-Content $log -Tail 200 | Set-Content $log
}
