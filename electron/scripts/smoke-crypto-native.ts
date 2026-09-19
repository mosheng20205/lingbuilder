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
    builtin('lingbuilder.crypto.asymmetric'),
    builtin('lingbuilder.crypto.windows')
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
    '        @ auto hexBytes = [](const wchar_t* hex) { std::vector<unsigned char> out; auto digit = [](wchar_t c) { return static_cast<unsigned int>(c <= L\'9\' ? c - L\'0\' : ((c | 0x20) - L\'a\' + 10)); }; for (size_t index = 0; hex[index] && hex[index + 1]; index += 2) out.push_back(static_cast<unsigned char>((digit(hex[index]) << 4) | digit(hex[index + 1]))); return out; };',
    '        @ auto bytesHex = [](const std::vector<unsigned char>& bytes) { return std::wstring(LB_CryptoHexEncode(bytes.data(), bytes.size())); };',
    '        @ auto zeros = [](size_t count) { return std::vector<unsigned char>(count, 0); };',
    '        @ auto ascii = [](const char* text) { std::vector<unsigned char> out; while (*text) out.push_back(static_cast<unsigned char>(*text++)); return out; };',
    '        @ std::vector<unsigned char> rawKey(32, 0x21), rawKey16(16, 0x21), rawNonce(12, 0x07), rawPlain; const std::string rawAadText = LB_WideToUtf8(L"context"); std::vector<unsigned char> rawAad(rawAadText.begin(), rawAadText.end());',
    '        @ for (int index = 0; index < 200; ++index) rawPlain.push_back(static_cast<unsigned char>(index));',
    '        @ check(bytesHex(对称_AES128GCM加密裸(zeros(16), zeros(12), zeros(0), zeros(0))) == L"58E2FCCEFA7E3061367F1D57A4E7455A", "RAW-AES128-GCM-NIST-TC1");',
    '        @ check(bytesHex(对称_AES128GCM加密裸(zeros(16), zeros(12), zeros(16), zeros(0))) == L"0388DACE60B6A392F328C2B971B2FE78AB6E47D42CEC13BDF53A67B21257BDDF", "RAW-AES128-GCM-NIST-TC2");',
    '        @ check(对称_AES128GCM解密裸(zeros(16), zeros(12), hexBytes(L"0388DACE60B6A392F328C2B971B2FE78AB6E47D42CEC13BDF53A67B21257BDDF"), zeros(0)) == zeros(16), "RAW-AES128-GCM-NIST-TC2-DECRYPT");',
    '        @ check(bytesHex(对称_AES256GCM加密裸(rawKey, rawNonce, rawPlain, rawAad)) == L"57A78A5A340AD8DCBD33CFFEB1F972BA4F59634139D8BDAD729C65FE529D0914B277AF84092059E0E97C2C71CC9E710742BD3F734DA1084E43E6B5133D4C1BAF14498930B5A2F7F53A122C2F1159349101884EFBC51E51ACD6BC411B04E829D8BA06AA1B5460159C8C6427F5664D3682289F0B257757044FD2347DDFC0CC91512A9FF616B5A718FE43B71EC7B3DB8822D724CE5C2B53DEDF7F45CBFA8365322A2213F9E49609308B12DA89D70097E9FF1519F8D239B23C9FE07704CC0B760AFA0E9B332A27F493179B34D0746359FFCE77B0FFEAC34C05AD", "RAW-AES256-GCM-CROSSCHECK");',
    '        @ check(bytesHex(对称_AES128GCM加密裸(rawKey16, rawNonce, rawPlain, rawAad)) == L"CEA98F1D4B91101DA12494324D8581302C8E4CAC319AD7B14C01078B2569EF5657304ACA5951FE79D2205754C2BE5BA40C518056C83E45C4D4F2165D469BAC16B15D7CFDA3E86B6C7BC06EC7340E574201F0D3FC8C245FEF766745DCD88CF288BC2DDB0BB656321D81EAE43C0335D0D27530380E105AF7948C703AAB9E5EEC9B3AFC82FDCEB6F92C379A4775B988D5D74BC3173FF887158F184C17870F78199D644BC687788829EBC091C44A3D9D6063CAB23B061B5E8097B51F14E0F1385E940DC4282A16B3B57D019CACE169059B821CFF94BE857F2106", "RAW-AES128-GCM-CROSSCHECK");',
    '        @ std::vector<unsigned char> rawCipher = 对称_AES256GCM加密裸(rawKey, rawNonce, rawPlain, rawAad);',
    '        @ check(rawCipher.size() == rawPlain.size() + 16, "RAW-AES256-OUTPUT-SIZE");',
    '        @ check(对称_AES256GCM解密裸(rawKey, rawNonce, rawCipher, rawAad) == rawPlain, "RAW-AES256-ROUNDTRIP");',
    '        @ check(对称_AES256GCM解密裸(rawKey, rawNonce, rawCipher, zeros(0)).empty() && !std::wstring(对称_取错误()).empty(), "RAW-AES256-WRONG-AAD");',
    '        @ { auto tampered = rawCipher; tampered[0] = static_cast<unsigned char>(tampered[0] ^ 0xFF); check(对称_AES256GCM解密裸(rawKey, rawNonce, tampered, rawAad).empty(), "RAW-AES256-TAMPERED"); }',
    '        @ check(对称_AES256GCM解密裸(zeros(32), rawNonce, rawCipher, rawAad).empty(), "RAW-AES256-WRONG-KEY");',
    '        @ std::vector<unsigned char> chromiumValue; const auto versionTag = ascii("v10"); chromiumValue.insert(chromiumValue.end(), versionTag.begin(), versionTag.end()); chromiumValue.insert(chromiumValue.end(), rawNonce.begin(), rawNonce.end()); chromiumValue.insert(chromiumValue.end(), rawCipher.begin(), rawCipher.end());',
    '        @ const std::vector<unsigned char> nonceSlice(chromiumValue.begin() + 3, chromiumValue.begin() + 15); const std::vector<unsigned char> bodySlice(chromiumValue.begin() + 15, chromiumValue.end());',
    '        @ check(对称_AES256GCM解密裸(rawKey, nonceSlice, bodySlice, rawAad) == rawPlain, "RAW-CHROMIUM-ENCRYPTED-VALUE");',
    '        @ check(对称_AES128GCM解密裸(rawKey16, rawNonce, 对称_AES128GCM加密裸(rawKey16, rawNonce, rawPlain, rawAad), rawAad) == rawPlain, "RAW-AES128-ROUNDTRIP");',
    '        @ check(对称_AES256GCM加密裸(zeros(31), rawNonce, rawPlain, rawAad).empty() && std::wstring(对称_取错误()).find(L"32") != std::wstring::npos, "RAW-KEY-LENGTH-REJECTED");',
    '        @ check(对称_AES256GCM加密裸(rawKey, zeros(11), rawPlain, rawAad).empty() && std::wstring(对称_取错误()).find(L"12") != std::wstring::npos, "RAW-NONCE-LENGTH-REJECTED");',
    '        @ check(对称_AES256GCM解密裸(rawKey, rawNonce, zeros(15), rawAad).empty(), "RAW-SHORT-CIPHER-REJECTED");',
    '        @ std::vector<unsigned char> dpapiKey;',
    '        @ for (int index = 0; index < 32; ++index) dpapiKey.push_back(static_cast<unsigned char>(index * 7 + 3));',
    '        @ const std::vector<unsigned char> dpapiCipher = 数据保护_加密字节集(dpapiKey);',
    '        @ check(!dpapiCipher.empty() && 数据保护_解密字节集(dpapiCipher) == dpapiKey, "DPAPI-BYTES-ROUNDTRIP");',
    '        @ std::vector<unsigned char> chromiumEncryptedKey = ascii("DPAPI"); chromiumEncryptedKey.insert(chromiumEncryptedKey.end(), dpapiCipher.begin(), dpapiCipher.end());',
    '        @ check(数据保护_解密字节集(chromiumEncryptedKey) == dpapiKey, "DPAPI-BYTES-PREFIX-AUTOSTRIP");',
    '        @ check(数据保护_解密字节集(zeros(40)).empty() && !std::wstring(数据保护_取错误()).empty(), "DPAPI-BYTES-GARBAGE");',
    '        @ check(数据保护_加密字节集(zeros(0)).empty() && !std::wstring(数据保护_取错误()).empty(), "DPAPI-BYTES-EMPTY-REJECTED");',
    '        @ std::ofstream report("crypto-native-smoke.txt", std::ios::binary | std::ios::trunc);',
    '        @ if (failures.empty()) report << "OK\\n"; else { report << "FAIL\\n"; for (const auto& failure : failures) report << failure << "\\n"; report << LB_WideToUtf8(密码_取错误()) << "\\n" << LB_WideToUtf8(对称_取错误()) << "\\n" << LB_WideToUtf8(非对称_取错误()) << "\\n" << LB_WideToUtf8(数据保护_取错误()) << "\\n"; }',
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
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
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
