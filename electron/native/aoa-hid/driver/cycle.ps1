$ErrorActionPreference = "Stop"
$dir = "T:\electron\lingbuilder\.zcode\tmp\aoa-driver"
$cn  = "LingBuilder AOA Driver"
$kit = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64"

# 1. INF -> UTF-16LE BOM
$infPath = Join-Path $dir "lingbuilder-aoa.inf"
$t = [IO.File]::ReadAllText($infPath)
[IO.File]::WriteAllText($infPath, $t, (New-Object System.Text.UnicodeEncoding($false, $true)))
Write-Output "inf utf16 ok"

# 2. cert trust (reuse)
$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -eq "CN=$cn" } | Select-Object -First 1
if (-not $cert) { throw "signing cert missing" }
$pubBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$pub = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(, $pubBytes)
foreach ($storeName in @("Root", "TrustedPublisher")) {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "LocalMachine")
  $store.Open("ReadWrite")
  if (-not ($store.Certificates | Where-Object { $_.Thumbprint -eq $pub.Thumbprint })) { $store.Add($pub) }
  $store.Close()
}

# 3. catalog + sign
Push-Location $dir
& "$kit\makecat.exe" lingbuilder-aoa.cdf | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "makecat failed" }
& "$kit\signtool.exe" sign /fd SHA256 /sm /s My /n $cn lingbuilder-aoa.cat | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "signtool failed" }

# 4. remove previous staged versions, add new
$old = pnputil.exe /enum-drivers 2>&1 | Select-String -Pattern "oem(\d+)\.inf" -Context 0,0 | Out-Null
foreach ($line in (pnputil.exe /enum-drivers 2>&1)) {
  if ($line -match "^Published Name\s*:\s*(oem\d+\.inf)" -or $line -match "^(oem\d+\.inf)$") { }
}
pnputil.exe /delete-driver oem36.inf 2>&1 | Out-Null
$addOut = pnputil.exe /add-driver lingbuilder-aoa.inf /install 2>&1
$addOut | ForEach-Object { Write-Output $_ }
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "add-driver failed" }
Pop-Location

# 5. force update on present matching devices
$cs = @"
using System;
using System.Runtime.InteropServices;
public static class DevInstallC {
  [DllImport("newdev.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool UpdateDriverForPlugAndPlayDevices(
     IntPtr hwndParent, string HardwareId, string FullInfPath, uint InstallFlags, out bool RebootRequired);
}
"@
Add-Type -TypeDefinition $cs
$storeDirs = Get-ChildItem "C:\Windows\System32\DriverStore\FileRepository" -Directory -Filter "lingbuilder-aoa.inf_amd64_*" |
  Sort-Object LastWriteTime -Descending
$repo = Join-Path $storeDirs[0].FullName "lingbuilder-aoa.inf"
Write-Output ("repo = " + $repo)
$rb = $false
$ok = [DevInstallC]::UpdateDriverForPlugAndPlayDevices([IntPtr]::Zero, "USB\VID_2717&PID_FF40", $repo, 3, [ref]$rb)
$err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
Write-Output ("force update ok=" + $ok + " err=" + $err)
