const { spawn } = require('node:child_process');
const executablePath = require('node:path').resolve(__dirname, '..', 'build', 'vendor', 'MicrosoftEdgeWebview2Setup.exe');
const script = [
  "$signature = Get-AuthenticodeSignature -LiteralPath $env:LINGBUILDER_INSTALLER_PATH",
  "Write-Output ('STATUS=' + $signature.Status)",
  "Write-Output ('SUBJECT=' + $signature.SignerCertificate.Subject)",
  "if ($signature.Status -ne 'Valid') { exit 1 }",
  "if ($signature.SignerCertificate.Subject -notmatch 'Microsoft') { exit 1 }"
].join('; ');
const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, LINGBUILDER_INSTALLER_PATH: executablePath }
});
child.stdout.on('data', chunk => process.stdout.write(`STDOUT:${chunk}`));
child.stderr.on('data', chunk => process.stdout.write(`STDERR:${chunk}`));
child.once('error', error => console.log('ERROR', error));
child.once('exit', code => console.log('EXIT', code));
