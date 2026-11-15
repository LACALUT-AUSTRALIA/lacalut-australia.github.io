$a = New-ScheduledTaskAction -Execute 'C:\Python314\pythonw.exe' -Argument '-X utf8 "C:\Users\conta\lacalut-pages\live-ads-7k2m9x3\_pause_alert.py"' -WorkingDirectory 'C:\Users\conta\lacalut-pages\live-ads-7k2m9x3'
$t = New-ScheduledTaskTrigger -Daily -At 7:30am
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Lacalut - Media Buyer Pause Alert' -Action $a -Trigger $t -Settings $s -Force | Select-Object TaskName,State | Format-List
