$ErrorActionPreference = "Stop"
$dir = "T:\electron\lingbuilder\.zcode\tmp\aoa-driver"
$cn  = "LingBuilder AOA Driver"
$kit = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64"

# 1. self-signed code-signing cert (machine My store, reused if present)
$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -eq "CN=$cn" } | Select-Object -First 1
if (-not $cert) {
  $cert = New-SelfSignedCertificate -Subject "CN=$cn" -Type CodeSigningCert -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -CertStoreLocation Cert:\LocalMachine\My `
    -NotAfter (Get-Date).AddYears(15)
  Write-Output ("cert created  " + $cert.Thumbprint)
} else {
  Write-Output ("cert reused   " + $cert.Thumbprint)
}

# 2. trust the PUBLIC part in machine Root + TrustedPublisher (libwdi/Zadig 同机制)
$pubBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$pub = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(, $pubBytes)
foreach ($storeName in @("Root", "TrustedPublisher")) {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "LocalMachine")
  $store.Open("ReadWrite")
  if (-not ($store.Certificates | Where-Object { $_.Thumbprint -eq $pub.Thumbprint })) {
    $store.Add($pub)
    Write-Output ("trusted added " + $storeName)
  } else {
    Write-Output ("trusted ok    " + $storeName)
  }
  $store.Close()
}

# 3. catalog + sign
Push-Location $dir
& "$kit\makecat.exe" lingbuilder-aoa.cdf
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "makecat failed" }
& "$kit\signtool.exe" sign /fd SHA256 /sm /s My /n $cn lingbuilder-aoa.cat
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "signtool failed" }

# 4. driver store + force install on matching present devices
$out = pnputil.exe /add-driver lingbuilder-aoa.inf /install 2>&1
$out | ForEach-Object { Write-Output $_ }
Write-Output ("pnputil exit=" + $LASTEXITCODE)
Pop-Location
