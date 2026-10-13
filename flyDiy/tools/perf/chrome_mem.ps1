# chrome_mem.ps1 <udd> <outCsv> <stopFile> (G3205, PERF-LEDGER / METLA-ONOFF): every 2 s, the PRIVATE bytes and the working
# set of the Chrome whose browser process runs on --user-data-dir=<udd>, summed over its whole process tree (the renderer and
# the GPU process included), until <stopFile> exists; then one line: the peaks and the last sample, in MB.
param([string]$Udd, [string]$Out, [string]$Stop)
"time,privMB,wsMB,procs" | Out-File -Encoding utf8 $Out
$peakP = 0; $peakW = 0; $last = $null; $u = [regex]::Escape(($Udd -replace '/', '\'))
while (-not (Test-Path $Stop)) {
  $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine, PrivatePageCount, WorkingSetSize
  $root = $all | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -match $u -and $_.CommandLine -notmatch '--type=' } | Select-Object -First 1
  if ($root) {
    $ids = @{ ([int]$root.ProcessId) = 1 }; $grew = $true
    while ($grew) { $grew = $false; foreach ($p in $all) { if (-not $ids.ContainsKey([int]$p.ProcessId) -and $ids.ContainsKey([int]$p.ParentProcessId)) { $ids[[int]$p.ProcessId] = 1; $grew = $true } } }
    $tree = $all | Where-Object { $ids.ContainsKey([int]$_.ProcessId) }
    $pm = ($tree | Measure-Object -Property PrivatePageCount -Sum).Sum / 1MB; $wm = ($tree | Measure-Object -Property WorkingSetSize -Sum).Sum / 1MB
    if ($pm -gt $peakP) { $peakP = $pm }; if ($wm -gt $peakW) { $peakW = $wm }; $last = $pm
    "{0},{1:N0},{2:N0},{3}" -f (Get-Date -Format HH:mm:ss), $pm, $wm, @($tree).Count | Out-File -Append -Encoding utf8 $Out
  }
  Start-Sleep -Seconds 2
}
"CHROME MEM: peak private {0:N0} MB, peak working set {1:N0} MB, last private {2:N0} MB" -f $peakP, $peakW, $last
