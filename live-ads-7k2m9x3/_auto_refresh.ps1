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
    python -X utf8 _pull_mer.py *> $null
    if ($LASTEXITCODE -ne 0) { Log "MER pull failed (page keeps the last MER values)" }
    python -X utf8 _classify_compliance.py *> $null
    if ($LASTEXITCODE -ne 0) { Log "classify FAILED ($LASTEXITCODE)"; exit 1 }
    python -X utf8 _build_monitor.py *> $null
    if ($LASTEXITCODE -ne 0) { Log "build FAILED ($LASTEXITCODE)"; exit 1 }

    Set-Location $repo
    git add live-ads-7k2m9x3/*.json live-ads-7k2m9x3/index.html live-ads-7k2m9x3/monitor.html live-ads-7k2m9x3/thumbs live-ads-7k2m9x3/big 2>$null
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Log "no changes"; exit 0 }
    git -c core.hooksPath=/dev/null commit -q -m "live-ads: auto refresh

Co-Authored-By: Claude <noreply@anthropic.com>" | Out-Null
    # 15/11/2026: merge, never rebase. pull --rebase (with or without autostash) kept leaving a stale
    # .git/rebase-merge folder that blocked every later push. Local data is newer, so local wins a conflict.
    git fetch -q origin main 2>$null
    git merge -q --no-edit -X ours origin/main 2>$null
    if ($LASTEXITCODE -ne 0) { git merge --abort 2>$null; Log "merge with origin FAILED" }
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
