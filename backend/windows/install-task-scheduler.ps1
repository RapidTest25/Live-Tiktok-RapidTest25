$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendCmd = Join-Path $scriptRoot "start-backend.cmd"
$tunnelCmd = Join-Path $scriptRoot "start-cloudflared-named.cmd"

$backendAction = New-ScheduledTaskAction -Execute $backendCmd
$tunnelAction = New-ScheduledTaskAction -Execute $tunnelCmd
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName "TikTok Live Backend" -Action $backendAction -Trigger $trigger -Principal $principal -Force
Register-ScheduledTask -TaskName "TikTok Live Tunnel" -Action $tunnelAction -Trigger $trigger -Principal $principal -Force

Write-Host "Task Scheduler selesai dibuat."
