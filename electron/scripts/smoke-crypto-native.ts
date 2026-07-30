import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'crypto-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('加密冒烟测试目录越出工作区。');
  const enabledModules = [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.crypto.hash'),
    builtin('lingbuilder.crypto.password'),
    builtin('lingbuilder.crypto.symmetric'),
    builtin('lingbuilder.crypto.asymmetric')
  ];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'crypto-native-smoke',
    name: '加密模块原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '加密模块原生冒烟测试', width: 420, height: 240, background: '#202028', description: '验证真实加密运行时', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        @ std::vector<std::string> failures;',
    '        @ auto check = [&](bool value, const char* name) { if (!value) failures.emplace_back(name); };',
    '        @ check(std::wstring(哈希_MD5文本(L"abc")) == L"900150983CD24FB0D6963F7D28E17F72", "MD5");',
    '        @ check(std::wstring(哈希_SHA1文本(L"abc")) == L"A9993E364706816ABA3E25717850C26C9CD0D89D", "SHA1");',
    '        @ check(std::wstring(哈希_SHA256文本(L"abc")) == L"BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", "SHA256");',
    '        @ check(std::wstring(哈希_SHA3_256文本(L"abc")) == L"3A985DA74FE225B2045C172D6BD390BD855F086E3E9D525B46BFE24511431532", "SHA3-256");',
    '        @ check(std::wstring(哈希_SM3文本(L"abc")) == L"66C7F0F462EEEDD9D1F2D46BDC10E4E24167C4875CF2F7A2297DA02B8F4BA8E0", "SM3");',
    '        @ check(std::wstring(哈希_BLAKE2b文本(L"abc")) == L"BA80A53F981C4D0D6A2797B69F12F6E94C212F14685AC4B74B12BB6FDBFFA2D17D87C5392AAB792DC252D5DE4533CC9518D38AA8DBF1925AB92386EDD4009923", "BLAKE2b");',
    '        @ check(std::wstring(哈希_BLAKE3文本(L"abc")) == L"6437B3AC38465133FFB63B75273A8DB548C558465D79DB03FD359C6CD5BD9D85", "BLAKE3");',
    '        @ std::ofstream vectorFile("crypto-hash-vector.bin", std::ios::binary | std::ios::trunc); vectorFile.write("abc", 3); vectorFile.close();',
    '        @ check(std::wstring(哈希_MD5文件(L"crypto-hash-vector.bin")) == L"900150983CD24FB0D6963F7D28E17F72", "MD5-FILE");',
    '        @ check(std::wstring(哈希_SHA1文件(L"crypto-hash-vector.bin")) == L"A9993E364706816ABA3E25717850C26C9CD0D89D", "SHA1-FILE");',
    '        @ check(std::wstring(哈希_SHA256文件(L"crypto-hash-vector.bin")) == L"BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", "SHA256-FILE");',
    '        @ check(std::wstring(哈希_SHA3_256文件(L"crypto-hash-vector.bin")) == L"3A985DA74FE225B2045C172D6BD390BD855F086E3E9D525B46BFE24511431532", "SHA3-256-FILE");',
    '        @ check(std::wstring(哈希_SM3文件(L"crypto-hash-vector.bin")) == L"66C7F0F462EEEDD9D1F2D46BDC10E4E24167C4875CF2F7A2297DA02B8F4BA8E0", "SM3-FILE");',
    '        @ check(std::wstring(哈希_BLAKE2b文件(L"crypto-hash-vector.bin")) == L"BA80A53F981C4D0D6A2797B69F12F6E94C212F14685AC4B74B12BB6FDBFFA2D17D87C5392AAB792DC252D5DE4533CC9518D38AA8DBF1925AB92386EDD4009923", "BLAKE2b-FILE");',
    '        @ check(std::wstring(哈希_BLAKE3文件(L"crypto-hash-vector.bin")) == L"6437B3AC38465133FFB63B75273A8DB548C558465D79DB03FD359C6CD5BD9D85", "BLAKE3-FILE");',
    '        @ std::wstring argon = 密码_Argon2id哈希(L"口令", 8192, 1, 1);',
    '        @ check(!argon.empty() && 密码_Argon2id验证(L"口令", argon.c_str()) && !密码_Argon2id验证(L"错误", argon.c_str()), "Argon2id");',
    '        @ std::wstring scrypt = 密码_scrypt哈希(L"口令", 1024, 8, 1);',
    '        @ check(!scrypt.empty() && 密码_scrypt验证(L"口令", scrypt.c_str()) && !密码_scrypt验证(L"错误", scrypt.c_str()), "scrypt");',
    '        @ std::wstring bcrypt = 密码_bcrypt哈希(L"口令", 4);',
    '        @ check(!bcrypt.empty() && 密码_bcrypt验证(L"口令", bcrypt.c_str()) && !密码_bcrypt验证(L"错误", bcrypt.c_str()), "bcrypt");',
    '        @ std::wstring pbkdf2 = 密码_PBKDF2_SHA256哈希(L"口令", 10000);',
    '        @ check(!pbkdf2.empty() && 密码_PBKDF2_SHA256验证(L"口令", pbkdf2.c_str()) && !密码_PBKDF2_SHA256验证(L"错误", pbkdf2.c_str()), "PBKDF2");',
    '        @ std::wstring key32 = 对称_生成密钥(32);',
    '        @ std::wstring key16 = 对称_生成密钥(16);',
    '        @ std::wstring key24 = 对称_生成密钥(24);',
    '        @ std::wstring key8 = 对称_生成密钥(8);',
    '        @ auto aead = [&](auto enc, auto dec, const wchar_t* key) { std::wstring cipher = enc(L"中文明文", key, L"上下文"); return !cipher.empty() && std::wstring(dec(cipher.c_str(), key, L"上下文")) == L"中文明文" && std::wstring(dec(cipher.c_str(), key, L"错误上下文")).empty(); };',
    '        @ auto legacy = [&](auto enc, auto dec, const wchar_t* key) { std::wstring cipher = enc(L"中文明文", key); return !cipher.empty() && std::wstring(dec(cipher.c_str(), key)) == L"中文明文"; };',
    '        @ check(aead(对称_AES256GCM加密, 对称_AES256GCM解密, key32.c_str()), "AES-256-GCM");',
    '        @ check(aead(对称_ChaCha20Poly1305加密, 对称_ChaCha20Poly1305解密, key32.c_str()), "ChaCha20-Poly1305");',
    '        @ check(aead(对称_SM4GCM加密, 对称_SM4GCM解密, key16.c_str()), "SM4-GCM");',
    '        @ check(aead(对称_Camellia256GCM加密, 对称_Camellia256GCM解密, key32.c_str()), "Camellia-256-GCM");',
    '        @ check(aead(对称_TwofishGCM加密, 对称_TwofishGCM解密, key32.c_str()), "Twofish-GCM");',
    '        @ check(aead(对称_SerpentGCM加密, 对称_SerpentGCM解密, key32.c_str()), "Serpent-GCM");',
    '        @ check(legacy(对称_AES256CBC加密, 对称_AES256CBC解密, key32.c_str()), "AES-256-CBC");',
    '        @ check(legacy(对称_BlowfishCBC加密, 对称_BlowfishCBC解密, key32.c_str()), "Blowfish-CBC");',
    '        @ check(legacy(对称_DESCBC加密, 对称_DESCBC解密, key8.c_str()), "DES-CBC");',
    '        @ check(legacy(对称_三DES_CBC加密, 对称_三DES_CBC解密, key24.c_str()), "3DES-CBC");',
    '        @ check(legacy(对称_RC4加密, 对称_RC4解密, key16.c_str()), "RC4");',
    '        @ check(legacy(对称_RC2CBC加密, 对称_RC2CBC解密, key16.c_str()), "RC2-CBC");',
    '        @ std::wstring rsaPrivate = 非对称_RSA生成私钥(2048);',
    '        @ std::wstring rsaPublic = 非对称_RSA取公钥(rsaPrivate.c_str());',
    '        @ std::wstring rsaCipher = 非对称_RSA_OAEP_SHA256加密(L"RSA中文", rsaPublic.c_str());',
    '        @ std::wstring rsaSignature = 非对称_RSA_PSS_SHA256签名(L"RSA中文", rsaPrivate.c_str());',
    '        @ check(!rsaCipher.empty() && std::wstring(非对称_RSA_OAEP_SHA256解密(rsaCipher.c_str(), rsaPrivate.c_str())) == L"RSA中文", "RSA-OAEP");',
    '        @ check(!rsaSignature.empty() && 非对称_RSA_PSS_SHA256验签(L"RSA中文", rsaSignature.c_str(), rsaPublic.c_str()) && !非对称_RSA_PSS_SHA256验签(L"篡改", rsaSignature.c_str(), rsaPublic.c_str()), "RSA-PSS");',
    '        @ std::wstring ecdsaPrivate = 非对称_ECDSA_P256生成私钥();',
    '        @ std::wstring ecdsaPublic = 非对称_ECDSA_P256取公钥(ecdsaPrivate.c_str());',
    '        @ std::wstring ecdsaSignature = 非对称_ECDSA_P256签名(L"ECDSA中文", ecdsaPrivate.c_str());',
    '        @ check(!ecdsaSignature.empty() && 非对称_ECDSA_P256验签(L"ECDSA中文", ecdsaSignature.c_str(), ecdsaPublic.c_str()), "ECDSA-P256");',
    '        @ std::wstring sm2Private = 非对称_SM2生成私钥();',
    '        @ std::wstring sm2Public = 非对称_SM2取公钥(sm2Private.c_str());',
    '        @ std::wstring sm2Cipher = 非对称_SM2加密(L"SM2中文", sm2Public.c_str());',
    '        @ std::wstring sm2Signature = 非对称_SM2签名(L"SM2中文", sm2Private.c_str(), L"1234567812345678");',
    '        @ check(!sm2Cipher.empty() && std::wstring(非对称_SM2解密(sm2Cipher.c_str(), sm2Private.c_str())) == L"SM2中文", "SM2-ENC");',
    '        @ check(!sm2Signature.empty() && 非对称_SM2验签(L"SM2中文", sm2Signature.c_str(), sm2Public.c_str(), L"1234567812345678"), "SM2-SIGN");',
    '        @ std::wstring ecdhA = 非对称_ECDH_P256生成私钥(); std::wstring ecdhB = 非对称_ECDH_P256生成私钥();',
    '        @ std::wstring ecdhAPub = 非对称_ECDH_P256取公钥(ecdhA.c_str()); std::wstring ecdhBPub = 非对称_ECDH_P256取公钥(ecdhB.c_str());',
    '        @ std::wstring ecdhSecretA = 非对称_ECDH_P256协商(ecdhA.c_str(), ecdhBPub.c_str()); std::wstring ecdhSecretB = 非对称_ECDH_P256协商(ecdhB.c_str(), ecdhAPub.c_str());',
    '        @ check(!ecdhSecretA.empty() && ecdhSecretA == ecdhSecretB, "ECDH-P256");',
    '        @ std::wstring xA = 非对称_X25519生成私钥(); std::wstring xB = 非对称_X25519生成私钥();',
    '        @ std::wstring xAPub = 非对称_X25519取公钥(xA.c_str()); std::wstring xBPub = 非对称_X25519取公钥(xB.c_str());',
    '        @ std::wstring xSecretA = 非对称_X25519协商(xA.c_str(), xBPub.c_str()); std::wstring xSecretB = 非对称_X25519协商(xB.c_str(), xAPub.c_str());',
    '        @ check(!xSecretA.empty() && xSecretA == xSecretB, "X25519");',
    '        @ std::wstring elgamalPrivate = 非对称_ElGamal生成私钥(2048); std::wstring elgamalPublic = 非对称_ElGamal取公钥(elgamalPrivate.c_str());',
    '        @ std::wstring elgamalCipher = 非对称_ElGamal加密(L"ElGamal中文", elgamalPublic.c_str());',
    '        @ check(!elgamalCipher.empty() && std::wstring(非对称_ElGamal解密(elgamalCipher.c_str(), elgamalPrivate.c_str())) == L"ElGamal中文", "ElGamal");',
    '        @ std::ofstream report("crypto-native-smoke.txt", std::ios::binary | std::ios::trunc);',
    '        @ if (failures.empty()) report << "OK\\n"; else { report << "FAIL\\n"; for (const auto& failure : failures) report << failure << "\\n"; report << LB_WideToUtf8(密码_取错误()) << "\\n" << LB_WideToUtf8(对称_取错误()) << "\\n" << LB_WideToUtf8(非对称_取错误()) << "\\n"; }',
    '        @ report.close();',
    '        @ ExitProcess(failures.empty() ? 0 : 2);',
    '    结束',
    '结束类'
  ].join('\n');

  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  const unexpectedDiagnostics = generated.blockingDiagnostics.filter(diagnostic => !diagnostic.includes('找不到功能库'));
  if (unexpectedDiagnostics.length) throw new Error(unexpectedDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  const run = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).catch(error => ({ error }));
  if ('error' in run) throw run.error;
  const report = await fs.readFile(path.join(path.dirname(executable), 'crypto-native-smoke.txt'), 'utf8');
  if (report.trim() !== 'OK') throw new Error(`原生加密验证失败：\n${report}`);
  console.log(JSON.stringify({ ok: true, projectDir, executable, platforms: ['Win32', 'x64'], report: report.trim() }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
