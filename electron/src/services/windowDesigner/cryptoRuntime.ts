/**
 * 密码学模块的确定性 C++ 运行时。
 *
 * Botan 与 BLAKE3 由 lingbuilder.crypto.sdk 资产模块提供；这里仅维护稳定的
 * 中文 DSL ABI、参数边界、自描述格式和错误语义。不得在 React 组件中复制。
 */

const CRYPTO_COMMON_RUNTIME = String.raw`
#include <botan/ffi.h>
#include <blake3.h>

static std::wstring g_lbPasswordError;
static std::wstring g_lbSymmetricError;
static std::wstring g_lbAsymmetricError;

static std::wstring LB_CryptoErrorText(const char* prefix, int code) {
    std::wstring result = LB_Utf8ToWide(prefix ? prefix : "密码学操作失败");
    result += L"（Botan 错误 "; result += std::to_wstring(code); result += L"：";
    result += LB_Utf8ToWide(botan_error_description(code)); result += L"）";
    return result;
}

static std::string LB_CryptoBase64Encode(const uint8_t* data, size_t size, bool padding = true) {
    static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string output; output.reserve(((size + 2) / 3) * 4);
    for (size_t offset = 0; offset < size; offset += 3) {
        const size_t remain = size - offset;
        uint32_t block = static_cast<uint32_t>(data[offset]) << 16;
        if (remain > 1) block |= static_cast<uint32_t>(data[offset + 1]) << 8;
        if (remain > 2) block |= data[offset + 2];
        output.push_back(alphabet[(block >> 18) & 63]); output.push_back(alphabet[(block >> 12) & 63]);
        if (remain > 1) output.push_back(alphabet[(block >> 6) & 63]); else if (padding) output.push_back('=');
        if (remain > 2) output.push_back(alphabet[block & 63]); else if (padding) output.push_back('=');
    }
    return output;
}

static int LB_CryptoBase64Digit(char value) {
    if (value >= 'A' && value <= 'Z') return value - 'A';
    if (value >= 'a' && value <= 'z') return value - 'a' + 26;
    if (value >= '0' && value <= '9') return value - '0' + 52;
    if (value == '+') return 62; if (value == '/') return 63; return -1;
}

static bool LB_CryptoBase64Decode(std::string input, std::vector<uint8_t>& output) {
    output.clear();
    while (!input.empty() && input.back() == '=') input.pop_back();
    if (input.size() % 4 == 1) return false;
    uint32_t bits = 0; int bitCount = 0;
    for (char ch : input) {
        const int digit = LB_CryptoBase64Digit(ch); if (digit < 0) return false;
        bits = (bits << 6) | static_cast<uint32_t>(digit); bitCount += 6;
        if (bitCount >= 8) { bitCount -= 8; output.push_back(static_cast<uint8_t>((bits >> bitCount) & 0xff)); }
    }
    return true;
}

static bool LB_CryptoHexDecode(const wchar_t* input, std::vector<uint8_t>& output) {
    output.clear(); const std::wstring value = LB_Wide(input);
    if (value.size() % 2 != 0) return false;
    output.reserve(value.size() / 2);
    for (size_t index = 0; index < value.size(); index += 2) {
        const int hi = LB_HexDigit(value[index]); const int lo = LB_HexDigit(value[index + 1]);
        if (hi < 0 || lo < 0) { output.clear(); return false; }
        output.push_back(static_cast<uint8_t>((hi << 4) | lo));
    }
    return true;
}

static std::wstring LB_CryptoHexEncode(const uint8_t* data, size_t size) {
    static constexpr wchar_t digits[] = L"0123456789ABCDEF";
    std::wstring output; output.reserve(size * 2);
    for (size_t index = 0; index < size; ++index) { output.push_back(digits[data[index] >> 4]); output.push_back(digits[data[index] & 15]); }
    return output;
}

static bool LB_CryptoRandom(std::vector<uint8_t>& output, size_t size) {
    output.assign(size, 0);
    return size == 0 || BCryptGenRandom(nullptr, output.data(), static_cast<ULONG>(size), BCRYPT_USE_SYSTEM_PREFERRED_RNG) >= 0;
}

static bool LB_CryptoConstantEqual(const std::vector<uint8_t>& left, const std::vector<uint8_t>& right) {
    return left.size() == right.size() && botan_constant_time_compare(left.data(), right.data(), left.size()) == 0;
}

static std::vector<std::string> LB_CryptoSplit(const std::string& value, char separator) {
    std::vector<std::string> result; size_t start = 0;
    while (start <= value.size()) { size_t end = value.find(separator, start); if (end == std::string::npos) end = value.size(); result.push_back(value.substr(start, end - start)); if (end == value.size()) break; start = end + 1; }
    return result;
}

static bool LB_CryptoParsePositive(const std::string& value, size_t& output, size_t minimum, size_t maximum) {
    if (value.empty() || value.size() > 12) return false;
    uint64_t parsed = 0; for (char ch : value) { if (ch < '0' || ch > '9') return false; parsed = parsed * 10 + static_cast<unsigned>(ch - '0'); if (parsed > maximum) return false; }
    if (parsed < minimum || parsed > maximum) return false; output = static_cast<size_t>(parsed); return true;
}
`;

const HASH_RUNTIME = String.raw`
static std::wstring LB_CryptoBotanHash(const char* algorithm, const uint8_t* data, size_t size) {
    botan_hash_t hash = nullptr; if (botan_hash_init(&hash, algorithm, 0) != 0) return {};
    size_t outputLength = 0; int result = botan_hash_output_length(hash, &outputLength);
    std::vector<uint8_t> output(outputLength);
    if (result == 0) result = botan_hash_update(hash, data, size);
    if (result == 0) result = botan_hash_final(hash, output.data());
    botan_hash_destroy(hash); return result == 0 ? LB_CryptoHexEncode(output.data(), output.size()) : std::wstring();
}

static std::wstring LB_CryptoBlake3(const uint8_t* data, size_t size) {
    std::array<uint8_t, BLAKE3_OUT_LEN> output = {}; blake3_hasher hasher;
    blake3_hasher_init(&hasher); blake3_hasher_update(&hasher, data, size); blake3_hasher_finalize(&hasher, output.data(), output.size());
    return LB_CryptoHexEncode(output.data(), output.size());
}

static const wchar_t* LB_CryptoHashText(const char* algorithm, const wchar_t* text, bool blake3 = false) {
    const std::string bytes = LB_WideToUtf8(text); const std::wstring result = blake3
        ? LB_CryptoBlake3(reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size())
        : LB_CryptoBotanHash(algorithm, reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size());
    return LB_ReturnText(result);
}

static const wchar_t* LB_CryptoHashFile(const char* algorithm, const wchar_t* path, bool blake3 = false) {
    std::ifstream stream(std::filesystem::path(LB_Wide(path)), std::ios::binary); if (!stream) return LB_ReturnText(L"");
    std::array<uint8_t, 64 * 1024> buffer = {};
    if (blake3) {
        blake3_hasher hasher; blake3_hasher_init(&hasher);
        while (stream) { stream.read(reinterpret_cast<char*>(buffer.data()), buffer.size()); const auto count = stream.gcount(); if (count > 0) blake3_hasher_update(&hasher, buffer.data(), static_cast<size_t>(count)); }
        std::array<uint8_t, BLAKE3_OUT_LEN> output = {}; blake3_hasher_finalize(&hasher, output.data(), output.size()); return LB_ReturnText(LB_CryptoHexEncode(output.data(), output.size()));
    }
    botan_hash_t hash = nullptr; if (botan_hash_init(&hash, algorithm, 0) != 0) return LB_ReturnText(L"");
    int result = 0; while (stream && result == 0) { stream.read(reinterpret_cast<char*>(buffer.data()), buffer.size()); const auto count = stream.gcount(); if (count > 0) result = botan_hash_update(hash, buffer.data(), static_cast<size_t>(count)); }
    size_t outputLength = 0; if (result == 0) result = botan_hash_output_length(hash, &outputLength); std::vector<uint8_t> output(outputLength);
    if (result == 0) result = botan_hash_final(hash, output.data()); botan_hash_destroy(hash);
    return LB_ReturnText(result == 0 ? LB_CryptoHexEncode(output.data(), output.size()) : L"");
}

#define LB_HASH_PAIR(suffix, algorithm) \
const wchar_t* 哈希_##suffix##文本(const wchar_t* text) { return LB_CryptoHashText(algorithm, text); } \
const wchar_t* 哈希_##suffix##文件(const wchar_t* path) { return LB_CryptoHashFile(algorithm, path); }
LB_HASH_PAIR(MD5, "MD5")
LB_HASH_PAIR(SHA1, "SHA-1")
LB_HASH_PAIR(SHA256, "SHA-256")
LB_HASH_PAIR(SHA3_256, "SHA-3(256)")
LB_HASH_PAIR(SM3, "SM3")
LB_HASH_PAIR(BLAKE2b, "BLAKE2b(512)")
#undef LB_HASH_PAIR
const wchar_t* 哈希_BLAKE3文本(const wchar_t* text) { return LB_CryptoHashText(nullptr, text, true); }
const wchar_t* 哈希_BLAKE3文件(const wchar_t* path) { return LB_CryptoHashFile(nullptr, path, true); }
const wchar_t* 哈希_安全随机十六进制(int byteCount) { std::vector<uint8_t> bytes; const size_t size = static_cast<size_t>((std::max)(0, (std::min)(byteCount, 1024 * 1024))); return LB_ReturnText(LB_CryptoRandom(bytes, size) ? LB_CryptoHexEncode(bytes.data(), bytes.size()) : L""); }
`;

const PASSWORD_RUNTIME = String.raw`
const wchar_t* 密码_取错误() { return LB_ReturnText(g_lbPasswordError); }

static bool LB_PasswordDerive(const char* algorithm, size_t first, size_t second, size_t third, const std::string& password, const std::vector<uint8_t>& salt, std::vector<uint8_t>& output) {
    const int result = botan_pwdhash(algorithm, first, second, third, output.data(), output.size(), password.data(), password.size(), salt.data(), salt.size());
    if (result != 0) { g_lbPasswordError = LB_CryptoErrorText("密码派生失败", result); return false; } return true;
}

static const wchar_t* LB_PasswordPhc(const char* algorithm, const char* prefix, size_t first, size_t second, size_t third, const std::string& params, const wchar_t* passwordText) {
    g_lbPasswordError.clear(); std::vector<uint8_t> salt, derived(32); if (!LB_CryptoRandom(salt, 16)) { g_lbPasswordError = L"系统密码学随机数生成失败。"; return LB_ReturnText(L""); }
    const std::string password = LB_WideToUtf8(passwordText); if (!LB_PasswordDerive(algorithm, first, second, third, password, salt, derived)) return LB_ReturnText(L"");
    const std::string encoded = std::string(prefix) + params + "$" + LB_CryptoBase64Encode(salt.data(), salt.size(), false) + "$" + LB_CryptoBase64Encode(derived.data(), derived.size(), false);
    return LB_ReturnText(LB_Utf8ToWide(encoded));
}

const wchar_t* 密码_Argon2id哈希(const wchar_t* password, int memoryKb, int iterations, int parallelism) {
    if (memoryKb < 8192 || memoryKb > 1048576 || iterations < 1 || iterations > 20 || parallelism < 1 || parallelism > 16) { g_lbPasswordError = L"Argon2id 参数超出安全范围。"; return LB_ReturnText(L""); }
    return LB_PasswordPhc("Argon2id", "$argon2id$v=19$", static_cast<size_t>(memoryKb), static_cast<size_t>(iterations), static_cast<size_t>(parallelism), "m=" + std::to_string(memoryKb) + ",t=" + std::to_string(iterations) + ",p=" + std::to_string(parallelism), password);
}

bool 密码_Argon2id验证(const wchar_t* passwordText, const wchar_t* storedText) {
    g_lbPasswordError.clear(); const auto fields = LB_CryptoSplit(LB_WideToUtf8(storedText), '$');
    if (fields.size() != 6 || !fields[0].empty() || fields[1] != "argon2id" || fields[2] != "v=19") { g_lbPasswordError = L"Argon2id 哈希格式无效。"; return false; }
    const auto params = LB_CryptoSplit(fields[3], ','); size_t memory = 0, iterations = 0, parallelism = 0;
    if (params.size() != 3 || params[0].rfind("m=", 0) != 0 || params[1].rfind("t=", 0) != 0 || params[2].rfind("p=", 0) != 0 ||
        !LB_CryptoParsePositive(params[0].substr(2), memory, 8192, 1048576) || !LB_CryptoParsePositive(params[1].substr(2), iterations, 1, 20) || !LB_CryptoParsePositive(params[2].substr(2), parallelism, 1, 16)) { g_lbPasswordError = L"Argon2id 参数格式无效。"; return false; }
    std::vector<uint8_t> salt, expected; if (!LB_CryptoBase64Decode(fields[4], salt) || !LB_CryptoBase64Decode(fields[5], expected) || salt.size() < 8 || expected.size() < 16 || expected.size() > 64) { g_lbPasswordError = L"Argon2id 盐或摘要编码无效。"; return false; }
    std::vector<uint8_t> actual(expected.size()); const std::string password = LB_WideToUtf8(passwordText);
    return LB_PasswordDerive("Argon2id", memory, iterations, parallelism, password, salt, actual) && LB_CryptoConstantEqual(actual, expected);
}

const wchar_t* 密码_scrypt哈希(const wchar_t* password, int N, int r, int p) {
    if (N < 1024 || N > 1048576 || (N & (N - 1)) != 0 || r < 1 || r > 64 || p < 1 || p > 16) { g_lbPasswordError = L"scrypt 参数无效；N 必须是 1024～1048576 范围内的 2 的幂。"; return LB_ReturnText(L""); }
    int logN = 0; for (int value = N; value > 1; value >>= 1) ++logN;
    return LB_PasswordPhc("Scrypt", "$scrypt$", static_cast<size_t>(N), static_cast<size_t>(r), static_cast<size_t>(p), "ln=" + std::to_string(logN) + ",r=" + std::to_string(r) + ",p=" + std::to_string(p), password);
}

bool 密码_scrypt验证(const wchar_t* passwordText, const wchar_t* storedText) {
    g_lbPasswordError.clear(); const auto fields = LB_CryptoSplit(LB_WideToUtf8(storedText), '$');
    if (fields.size() != 5 || !fields[0].empty() || fields[1] != "scrypt") { g_lbPasswordError = L"scrypt 哈希格式无效。"; return false; }
    const auto params = LB_CryptoSplit(fields[2], ','); size_t logN = 0, r = 0, p = 0;
    if (params.size() != 3 || params[0].rfind("ln=", 0) != 0 || params[1].rfind("r=", 0) != 0 || params[2].rfind("p=", 0) != 0 || !LB_CryptoParsePositive(params[0].substr(3), logN, 10, 20) || !LB_CryptoParsePositive(params[1].substr(2), r, 1, 64) || !LB_CryptoParsePositive(params[2].substr(2), p, 1, 16)) { g_lbPasswordError = L"scrypt 参数格式无效。"; return false; }
    std::vector<uint8_t> salt, expected; if (!LB_CryptoBase64Decode(fields[3], salt) || !LB_CryptoBase64Decode(fields[4], expected) || salt.size() < 8 || expected.size() < 16 || expected.size() > 64) { g_lbPasswordError = L"scrypt 盐或摘要编码无效。"; return false; }
    std::vector<uint8_t> actual(expected.size()); const std::string password = LB_WideToUtf8(passwordText); const size_t N = static_cast<size_t>(1) << logN;
    return LB_PasswordDerive("Scrypt", N, r, p, password, salt, actual) && LB_CryptoConstantEqual(actual, expected);
}

const wchar_t* 密码_bcrypt哈希(const wchar_t* passwordText, int cost) {
    g_lbPasswordError.clear(); if (cost < 4 || cost > 18) { g_lbPasswordError = L"bcrypt 成本必须在 4～18 之间。"; return LB_ReturnText(L""); }
    botan_rng_t rng = nullptr; int result = botan_rng_init(&rng, "system"); std::array<uint8_t, 64> output = {}; size_t length = output.size(); const std::string password = LB_WideToUtf8(passwordText);
    if (result == 0) result = botan_bcrypt_generate(output.data(), &length, password.c_str(), rng, static_cast<size_t>(cost), 0); if (rng) botan_rng_destroy(rng);
    if (result != 0) { g_lbPasswordError = LB_CryptoErrorText("bcrypt 哈希失败", result); return LB_ReturnText(L""); }
    return LB_ReturnText(LB_Utf8ToWide(std::string(reinterpret_cast<char*>(output.data()), length)));
}

bool 密码_bcrypt验证(const wchar_t* passwordText, const wchar_t* storedText) {
    g_lbPasswordError.clear(); const std::string password = LB_WideToUtf8(passwordText), stored = LB_WideToUtf8(storedText); const int result = botan_bcrypt_is_valid(password.c_str(), stored.c_str());
    if (result < 0) g_lbPasswordError = LB_CryptoErrorText("bcrypt 验证失败", result); return result == 0;
}

const wchar_t* 密码_PBKDF2_SHA256哈希(const wchar_t* password, int iterations) {
    if (iterations < 10000 || iterations > 10000000) { g_lbPasswordError = L"PBKDF2 迭代次数必须在 10000～10000000 之间。"; return LB_ReturnText(L""); }
    return LB_PasswordPhc("PBKDF2(SHA-256)", "$pbkdf2-sha256$", static_cast<size_t>(iterations), 0, 0, "i=" + std::to_string(iterations), password);
}

bool 密码_PBKDF2_SHA256验证(const wchar_t* passwordText, const wchar_t* storedText) {
    g_lbPasswordError.clear(); const auto fields = LB_CryptoSplit(LB_WideToUtf8(storedText), '$'); size_t iterations = 0;
    if (fields.size() != 5 || !fields[0].empty() || fields[1] != "pbkdf2-sha256" || fields[2].rfind("i=", 0) != 0 || !LB_CryptoParsePositive(fields[2].substr(2), iterations, 10000, 10000000)) { g_lbPasswordError = L"PBKDF2 哈希格式无效。"; return false; }
    std::vector<uint8_t> salt, expected; if (!LB_CryptoBase64Decode(fields[3], salt) || !LB_CryptoBase64Decode(fields[4], expected) || salt.size() < 8 || expected.size() < 16 || expected.size() > 64) { g_lbPasswordError = L"PBKDF2 盐或摘要编码无效。"; return false; }
    std::vector<uint8_t> actual(expected.size()); const std::string password = LB_WideToUtf8(passwordText);
    return LB_PasswordDerive("PBKDF2(SHA-256)", iterations, 0, 0, password, salt, actual) && LB_CryptoConstantEqual(actual, expected);
}
`;

const SYMMETRIC_RUNTIME = String.raw`
const wchar_t* 对称_取错误() { return LB_ReturnText(g_lbSymmetricError); }
const wchar_t* 对称_生成密钥(int byteCount) { g_lbSymmetricError.clear(); if (byteCount < 1 || byteCount > 1024) { g_lbSymmetricError = L"密钥字节数必须在 1～1024 之间。"; return LB_ReturnText(L""); } std::vector<uint8_t> bytes; if (!LB_CryptoRandom(bytes, static_cast<size_t>(byteCount))) { g_lbSymmetricError = L"系统密码学随机数生成失败。"; return LB_ReturnText(L""); } return LB_ReturnText(LB_CryptoHexEncode(bytes.data(), bytes.size())); }

static const wchar_t* LB_SymmetricEncrypt(const char* botanName, const char* envelopeName, size_t requiredKeyBytes, bool authenticated, const wchar_t* plainText, const wchar_t* keyHex, const wchar_t* aadText) {
    g_lbSymmetricError.clear(); std::vector<uint8_t> key;
    if (!LB_CryptoHexDecode(keyHex, key) || key.size() != requiredKeyBytes) { g_lbSymmetricError = L"密钥必须是指定长度的严格十六进制文本。"; return LB_ReturnText(L""); }
    botan_cipher_t cipher = nullptr; int result = botan_cipher_init(&cipher, botanName, BOTAN_CIPHER_INIT_FLAG_ENCRYPT);
    size_t nonceLength = 0, outputLength = 0; std::vector<uint8_t> nonce;
    if (result == 0) result = botan_cipher_set_key(cipher, key.data(), key.size());
    if (result == 0) result = botan_cipher_get_default_nonce_length(cipher, &nonceLength);
    if (result == 0 && !LB_CryptoRandom(nonce, nonceLength)) result = -20;
    const std::string aad = LB_WideToUtf8(aadText), plain = LB_WideToUtf8(plainText);
    if (result == 0 && authenticated) result = botan_cipher_set_associated_data(cipher, reinterpret_cast<const uint8_t*>(aad.data()), aad.size());
    if (result == 0) result = botan_cipher_start(cipher, nonce.empty() ? nullptr : nonce.data(), nonce.size());
    if (result == 0) result = botan_cipher_output_length(cipher, plain.size(), &outputLength);
    std::vector<uint8_t> encrypted(outputLength + 64); size_t written = 0, consumed = 0;
    if (result == 0) result = botan_cipher_update(cipher, BOTAN_CIPHER_UPDATE_FLAG_FINAL, encrypted.data(), encrypted.size(), &written, reinterpret_cast<const uint8_t*>(plain.data()), plain.size(), &consumed);
    if (cipher) botan_cipher_destroy(cipher); if (result != 0 || consumed != plain.size()) { g_lbSymmetricError = result == -20 ? L"系统密码学随机数生成失败。" : LB_CryptoErrorText("对称加密失败", result); return LB_ReturnText(L""); }
    encrypted.resize(written); const std::string envelope = std::string("$lbce$1$") + envelopeName + "$" + LB_CryptoBase64Encode(nonce.data(), nonce.size()) + "$" + LB_CryptoBase64Encode(encrypted.data(), encrypted.size());
    return LB_ReturnText(LB_Utf8ToWide(envelope));
}

static const wchar_t* LB_SymmetricDecrypt(const char* botanName, const char* envelopeName, size_t requiredKeyBytes, bool authenticated, const wchar_t* envelopeText, const wchar_t* keyHex, const wchar_t* aadText) {
    g_lbSymmetricError.clear(); std::vector<uint8_t> key; if (!LB_CryptoHexDecode(keyHex, key) || key.size() != requiredKeyBytes) { g_lbSymmetricError = L"密钥必须是指定长度的严格十六进制文本。"; return LB_ReturnText(L""); }
    const auto fields = LB_CryptoSplit(LB_WideToUtf8(envelopeText), '$');
    if (fields.size() != 6 || !fields[0].empty() || fields[1] != "lbce" || fields[2] != "1" || fields[3] != envelopeName) { g_lbSymmetricError = L"自描述密文格式或算法标识不匹配。"; return LB_ReturnText(L""); }
    std::vector<uint8_t> nonce, encrypted; if (!LB_CryptoBase64Decode(fields[4], nonce) || !LB_CryptoBase64Decode(fields[5], encrypted)) { g_lbSymmetricError = L"密文中的 Base64 编码无效。"; return LB_ReturnText(L""); }
    botan_cipher_t cipher = nullptr; int result = botan_cipher_init(&cipher, botanName, BOTAN_CIPHER_INIT_FLAG_DECRYPT); const std::string aad = LB_WideToUtf8(aadText);
    if (result == 0) result = botan_cipher_set_key(cipher, key.data(), key.size());
    if (result == 0 && botan_cipher_valid_nonce_length(cipher, nonce.size()) != 1) result = -32;
    if (result == 0 && authenticated) result = botan_cipher_set_associated_data(cipher, reinterpret_cast<const uint8_t*>(aad.data()), aad.size());
    if (result == 0) result = botan_cipher_start(cipher, nonce.empty() ? nullptr : nonce.data(), nonce.size());
    size_t outputLength = 0; if (result == 0) result = botan_cipher_output_length(cipher, encrypted.size(), &outputLength); std::vector<uint8_t> plain(outputLength + 64); size_t written = 0, consumed = 0;
    if (result == 0) result = botan_cipher_update(cipher, BOTAN_CIPHER_UPDATE_FLAG_FINAL, plain.data(), plain.size(), &written, encrypted.data(), encrypted.size(), &consumed);
    if (cipher) botan_cipher_destroy(cipher); if (result != 0 || consumed != encrypted.size()) { g_lbSymmetricError = result == -32 ? L"密文 nonce 长度无效。" : LB_CryptoErrorText(authenticated ? "认证或解密失败" : "对称解密失败", result); return LB_ReturnText(L""); }
    plain.resize(written); return LB_ReturnText(LB_Utf8ToWide(std::string(reinterpret_cast<const char*>(plain.data()), plain.size())));
}

#define LB_AEAD_WRAPPERS(suffix, botanName, envelopeName, keyBytes) \
const wchar_t* 对称_##suffix##加密(const wchar_t* plain, const wchar_t* key, const wchar_t* aad) { return LB_SymmetricEncrypt(botanName, envelopeName, keyBytes, true, plain, key, aad); } \
const wchar_t* 对称_##suffix##解密(const wchar_t* cipher, const wchar_t* key, const wchar_t* aad) { return LB_SymmetricDecrypt(botanName, envelopeName, keyBytes, true, cipher, key, aad); }
LB_AEAD_WRAPPERS(AES256GCM, "AES-256/GCM", "AES-256-GCM", 32)
LB_AEAD_WRAPPERS(ChaCha20Poly1305, "ChaCha20Poly1305", "CHACHA20-POLY1305", 32)
LB_AEAD_WRAPPERS(SM4GCM, "SM4/GCM", "SM4-GCM", 16)
LB_AEAD_WRAPPERS(Camellia256GCM, "Camellia-256/GCM", "CAMELLIA-256-GCM", 32)
LB_AEAD_WRAPPERS(TwofishGCM, "Twofish/GCM", "TWOFISH-GCM", 32)
LB_AEAD_WRAPPERS(SerpentGCM, "Serpent/GCM", "SERPENT-GCM", 32)
#undef LB_AEAD_WRAPPERS

// 裸 AEAD：随机数由调用方提供、输出 密文 || 标签，不写任何自描述头，也不做 Base64/UTF-8/十六进制转换；
// 用于兼容 Chromium encrypted_value 等外部密文格式。需要模块自描述封装时改用同名的非 裸 命令。
static std::vector<uint8_t> LB_SymmetricRawAead(bool encrypt, const char* botanName, size_t requiredKeyBytes, const char* label, const std::vector<uint8_t>& key, const std::vector<uint8_t>& nonce, const std::vector<uint8_t>& input, const std::vector<uint8_t>& aad) {
    g_lbSymmetricError.clear(); const std::wstring prefix = LB_Utf8ToWide(label);
    if (key.size() != requiredKeyBytes) { g_lbSymmetricError = prefix + L" 裸密钥必须恰好 " + std::to_wstring(requiredKeyBytes) + L" 字节。"; return {}; }
    if (nonce.size() != 12) { g_lbSymmetricError = prefix + L" 裸随机数必须恰好 12 字节，且由调用方从密文里自行拆出。"; return {}; }
    if (!encrypt && input.size() < 16) { g_lbSymmetricError = prefix + L" 裸密文与标签合计不足 16 字节认证标签。"; return {}; }
    botan_cipher_t cipher = nullptr; size_t outputLength = 0, written = 0, consumed = 0; std::vector<uint8_t> output;
    int result = botan_cipher_init(&cipher, botanName, encrypt ? BOTAN_CIPHER_INIT_FLAG_ENCRYPT : BOTAN_CIPHER_INIT_FLAG_DECRYPT);
    if (result == 0) result = botan_cipher_set_key(cipher, key.data(), key.size());
    if (result == 0) result = botan_cipher_set_associated_data(cipher, aad.empty() ? nullptr : aad.data(), aad.size());
    if (result == 0) result = botan_cipher_start(cipher, nonce.data(), nonce.size());
    if (result == 0) result = botan_cipher_output_length(cipher, input.size(), &outputLength);
    if (result == 0) { output.assign((std::max)(outputLength, static_cast<size_t>(64)) + 64, 0); result = botan_cipher_update(cipher, BOTAN_CIPHER_UPDATE_FLAG_FINAL, output.data(), output.size(), &written, input.data(), input.size(), &consumed); }
    if (cipher) botan_cipher_destroy(cipher);
    if (result != 0 || consumed != input.size()) { g_lbSymmetricError = LB_CryptoErrorText(encrypt ? (std::string(label) + " 裸加密失败").c_str() : (std::string(label) + " 裸解密或认证标签校验失败").c_str(), result); return {}; }
    output.resize(written); return output;
}

#define LB_RAW_AEAD_WRAPPERS(suffix, botanName, keyBytes, label) \
std::vector<uint8_t> 对称_##suffix##加密裸(const std::vector<uint8_t>& key, const std::vector<uint8_t>& nonce, const std::vector<uint8_t>& plain, const std::vector<uint8_t>& aad) { return LB_SymmetricRawAead(true, botanName, keyBytes, label, key, nonce, plain, aad); } \
std::vector<uint8_t> 对称_##suffix##解密裸(const std::vector<uint8_t>& key, const std::vector<uint8_t>& nonce, const std::vector<uint8_t>& cipher, const std::vector<uint8_t>& aad) { return LB_SymmetricRawAead(false, botanName, keyBytes, label, key, nonce, cipher, aad); }
LB_RAW_AEAD_WRAPPERS(AES256GCM, "AES-256/GCM", 32, "AES-256-GCM")
LB_RAW_AEAD_WRAPPERS(AES128GCM, "AES-128/GCM", 16, "AES-128-GCM")
#undef LB_RAW_AEAD_WRAPPERS

#define LB_LEGACY_WRAPPERS(suffix, botanName, envelopeName, keyBytes) \
const wchar_t* 对称_##suffix##加密(const wchar_t* plain, const wchar_t* key) { return LB_SymmetricEncrypt(botanName, envelopeName, keyBytes, false, plain, key, L""); } \
const wchar_t* 对称_##suffix##解密(const wchar_t* cipher, const wchar_t* key) { return LB_SymmetricDecrypt(botanName, envelopeName, keyBytes, false, cipher, key, L""); }
LB_LEGACY_WRAPPERS(AES256CBC, "AES-256/CBC/PKCS7", "AES-256-CBC", 32)
LB_LEGACY_WRAPPERS(BlowfishCBC, "Blowfish/CBC/PKCS7", "BLOWFISH-CBC", 32)
LB_LEGACY_WRAPPERS(DESCBC, "DES/CBC/PKCS7", "DES-CBC", 8)
LB_LEGACY_WRAPPERS(三DES_CBC, "TripleDES/CBC/PKCS7", "3DES-CBC", 24)
LB_LEGACY_WRAPPERS(RC4, "RC4", "RC4", 16)
#undef LB_LEGACY_WRAPPERS

#pragma comment(lib, "advapi32.lib")
static bool LB_RC2CreateKey(const std::vector<uint8_t>& keyBytes, const std::vector<uint8_t>& iv, HCRYPTPROV& provider, HCRYPTKEY& key) {
    provider = 0; key = 0; if (!CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) { g_lbSymmetricError = L"RC2 密码服务提供程序初始化失败。"; return false; }
    struct LB_RC2KeyBlob { BLOBHEADER header; DWORD length; BYTE bytes[16]; } blob{};
    blob.header.bType = PLAINTEXTKEYBLOB; blob.header.bVersion = CUR_BLOB_VERSION; blob.header.aiKeyAlg = CALG_RC2; blob.length = 16; std::copy(keyBytes.begin(), keyBytes.end(), blob.bytes);
    if (!CryptImportKey(provider, reinterpret_cast<const BYTE*>(&blob), sizeof(blob), 0, CRYPT_EXPORTABLE, &key)) { CryptReleaseContext(provider, 0); provider = 0; g_lbSymmetricError = L"RC2 密钥导入失败。"; return false; }
    DWORD effectiveBits = 128; if (!CryptSetKeyParam(key, KP_EFFECTIVE_KEYLEN, reinterpret_cast<const BYTE*>(&effectiveBits), 0) || !CryptSetKeyParam(key, KP_IV, iv.data(), 0)) { CryptDestroyKey(key); CryptReleaseContext(provider, 0); key = 0; provider = 0; g_lbSymmetricError = L"RC2 参数设置失败。"; return false; }
    return true;
}

const wchar_t* 对称_RC2CBC加密(const wchar_t* plainText, const wchar_t* keyHex) {
    g_lbSymmetricError.clear(); std::vector<uint8_t> keyBytes, iv; if (!LB_CryptoHexDecode(keyHex, keyBytes) || keyBytes.size() != 16) { g_lbSymmetricError = L"RC2 密钥必须是 16 字节严格十六进制文本。"; return LB_ReturnText(L""); }
    if (!LB_CryptoRandom(iv, 8)) { g_lbSymmetricError = L"系统密码学随机数生成失败。"; return LB_ReturnText(L""); }
    HCRYPTPROV provider = 0; HCRYPTKEY key = 0; if (!LB_RC2CreateKey(keyBytes, iv, provider, key)) return LB_ReturnText(L""); const std::string plain = LB_WideToUtf8(plainText); std::vector<uint8_t> encrypted(plain.size() + 16); std::copy(plain.begin(), plain.end(), encrypted.begin()); DWORD length = static_cast<DWORD>(plain.size());
    const BOOL ok = CryptEncrypt(key, 0, TRUE, 0, encrypted.data(), &length, static_cast<DWORD>(encrypted.size())); CryptDestroyKey(key); CryptReleaseContext(provider, 0); if (!ok) { g_lbSymmetricError = L"RC2 加密失败。"; return LB_ReturnText(L""); } encrypted.resize(length);
    return LB_ReturnText(LB_Utf8ToWide(std::string("$lbce$1$RC2-CBC$") + LB_CryptoBase64Encode(iv.data(), iv.size()) + "$" + LB_CryptoBase64Encode(encrypted.data(), encrypted.size())));
}

const wchar_t* 对称_RC2CBC解密(const wchar_t* envelopeText, const wchar_t* keyHex) {
    g_lbSymmetricError.clear(); std::vector<uint8_t> keyBytes; if (!LB_CryptoHexDecode(keyHex, keyBytes) || keyBytes.size() != 16) { g_lbSymmetricError = L"RC2 密钥必须是 16 字节严格十六进制文本。"; return LB_ReturnText(L""); }
    const auto fields = LB_CryptoSplit(LB_WideToUtf8(envelopeText), '$'); if (fields.size() != 6 || !fields[0].empty() || fields[1] != "lbce" || fields[2] != "1" || fields[3] != "RC2-CBC") { g_lbSymmetricError = L"RC2 自描述密文格式无效。"; return LB_ReturnText(L""); }
    std::vector<uint8_t> iv, encrypted; if (!LB_CryptoBase64Decode(fields[4], iv) || iv.size() != 8 || !LB_CryptoBase64Decode(fields[5], encrypted) || encrypted.empty()) { g_lbSymmetricError = L"RC2 密文编码无效。"; return LB_ReturnText(L""); }
    HCRYPTPROV provider = 0; HCRYPTKEY key = 0; if (!LB_RC2CreateKey(keyBytes, iv, provider, key)) return LB_ReturnText(L""); DWORD length = static_cast<DWORD>(encrypted.size()); const BOOL ok = CryptDecrypt(key, 0, TRUE, 0, encrypted.data(), &length); CryptDestroyKey(key); CryptReleaseContext(provider, 0); if (!ok) { g_lbSymmetricError = L"RC2 解密或填充校验失败。"; return LB_ReturnText(L""); }
    return LB_ReturnText(LB_Utf8ToWide(std::string(reinterpret_cast<const char*>(encrypted.data()), length)));
}
`;

const ASYMMETRIC_RUNTIME = String.raw`
const wchar_t* 非对称_取错误() { return LB_ReturnText(g_lbAsymmetricError); }

static bool LB_AsymmetricRng(botan_rng_t& rng) { const int result = botan_rng_init(&rng, "system"); if (result != 0) g_lbAsymmetricError = LB_CryptoErrorText("随机数生成器初始化失败", result); return result == 0; }
static bool LB_AsymmetricLoadPrivate(const wchar_t* pem, botan_privkey_t& key) { const std::string bytes = LB_WideToUtf8(pem); const int result = botan_privkey_load(&key, nullptr, reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size(), nullptr); if (result != 0) g_lbAsymmetricError = LB_CryptoErrorText("私钥 PEM 读取失败", result); return result == 0; }
static bool LB_AsymmetricLoadPublic(const wchar_t* pem, botan_pubkey_t& key) { const std::string bytes = LB_WideToUtf8(pem); const int result = botan_pubkey_load(&key, reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size()); if (result != 0) g_lbAsymmetricError = LB_CryptoErrorText("公钥 PEM 读取失败", result); return result == 0; }
static int LB_AsymmetricCaptureText(botan_view_ctx context, const char* text, size_t length) { static_cast<std::string*>(context)->assign(text, length); return 0; }
static int LB_AsymmetricCaptureBytes(botan_view_ctx context, const uint8_t* bytes, size_t length) { static_cast<std::vector<uint8_t>*>(context)->assign(bytes, bytes + length); return 0; }

static std::wstring LB_AsymmetricExportPrivate(botan_privkey_t key) { std::string output; const int result = botan_privkey_view_pem(key, &output, LB_AsymmetricCaptureText); if (result != 0) { g_lbAsymmetricError = LB_CryptoErrorText("私钥导出失败", result); return {}; } while (!output.empty() && output.back() == '\0') output.pop_back(); return LB_Utf8ToWide(output); }
static std::wstring LB_AsymmetricExportPublic(botan_pubkey_t key) { std::string output; const int result = botan_pubkey_view_pem(key, &output, LB_AsymmetricCaptureText); if (result != 0) { g_lbAsymmetricError = LB_CryptoErrorText("公钥导出失败", result); return {}; } while (!output.empty() && output.back() == '\0') output.pop_back(); return LB_Utf8ToWide(output); }

static const wchar_t* LB_AsymmetricGenerate(const char* algorithm, const char* parameters) {
    g_lbAsymmetricError.clear(); botan_rng_t rng = nullptr; botan_privkey_t key = nullptr; if (!LB_AsymmetricRng(rng)) return LB_ReturnText(L"");
    const int result = botan_privkey_create(&key, algorithm, parameters, rng); if (result != 0) g_lbAsymmetricError = LB_CryptoErrorText("非对称私钥生成失败", result);
    const std::wstring output = result == 0 ? LB_AsymmetricExportPrivate(key) : L""; if (key) botan_privkey_destroy(key); botan_rng_destroy(rng); return LB_ReturnText(output);
}

static const wchar_t* LB_AsymmetricPublicFromPrivate(const wchar_t* privatePem) {
    g_lbAsymmetricError.clear(); botan_privkey_t privateKey = nullptr; botan_pubkey_t publicKey = nullptr; if (!LB_AsymmetricLoadPrivate(privatePem, privateKey)) return LB_ReturnText(L"");
    const int result = botan_privkey_export_pubkey(&publicKey, privateKey); if (result != 0) g_lbAsymmetricError = LB_CryptoErrorText("公钥导出失败", result);
    const std::wstring output = result == 0 ? LB_AsymmetricExportPublic(publicKey) : L""; if (publicKey) botan_pubkey_destroy(publicKey); botan_privkey_destroy(privateKey); return LB_ReturnText(output);
}

static const wchar_t* LB_AsymmetricEncrypt(const wchar_t* plainText, const wchar_t* publicPem, const char* padding) {
    g_lbAsymmetricError.clear(); botan_rng_t rng = nullptr; botan_pubkey_t key = nullptr; botan_pk_op_encrypt_t operation = nullptr; if (!LB_AsymmetricRng(rng) || !LB_AsymmetricLoadPublic(publicPem, key)) { if (rng) botan_rng_destroy(rng); return LB_ReturnText(L""); }
    const std::string plain = LB_WideToUtf8(plainText); int result = botan_pk_op_encrypt_create(&operation, key, padding, 0); size_t length = 0;
    if (result == 0) result = botan_pk_op_encrypt_output_length(operation, plain.size(), &length); std::vector<uint8_t> output(length);
    if (result == 0) result = botan_pk_op_encrypt(operation, rng, output.data(), &length, reinterpret_cast<const uint8_t*>(plain.data()), plain.size());
    if (operation) botan_pk_op_encrypt_destroy(operation); botan_pubkey_destroy(key); botan_rng_destroy(rng);
    if (result != 0) { g_lbAsymmetricError = LB_CryptoErrorText("非对称加密失败", result); return LB_ReturnText(L""); } return LB_ReturnText(LB_Utf8ToWide(LB_CryptoBase64Encode(output.data(), length)));
}

static const wchar_t* LB_AsymmetricDecrypt(const wchar_t* cipherText, const wchar_t* privatePem, const char* padding) {
    g_lbAsymmetricError.clear(); std::vector<uint8_t> cipher; if (!LB_CryptoBase64Decode(LB_WideToUtf8(cipherText), cipher)) { g_lbAsymmetricError = L"密文 Base64 编码无效。"; return LB_ReturnText(L""); }
    botan_privkey_t key = nullptr; botan_pk_op_decrypt_t operation = nullptr; if (!LB_AsymmetricLoadPrivate(privatePem, key)) return LB_ReturnText(L""); int result = botan_pk_op_decrypt_create(&operation, key, padding, 0); size_t length = 0;
    if (result == 0) result = botan_pk_op_decrypt_output_length(operation, cipher.size(), &length); std::vector<uint8_t> output(length);
    if (result == 0) result = botan_pk_op_decrypt(operation, output.data(), &length, cipher.data(), cipher.size()); if (operation) botan_pk_op_decrypt_destroy(operation); botan_privkey_destroy(key);
    if (result != 0) { g_lbAsymmetricError = LB_CryptoErrorText("非对称解密失败", result); return LB_ReturnText(L""); } return LB_ReturnText(LB_Utf8ToWide(std::string(reinterpret_cast<char*>(output.data()), length)));
}

static const wchar_t* LB_AsymmetricSign(const wchar_t* text, const wchar_t* privatePem, const std::string& scheme) {
    g_lbAsymmetricError.clear(); botan_rng_t rng = nullptr; botan_privkey_t key = nullptr; botan_pk_op_sign_t operation = nullptr; if (!LB_AsymmetricRng(rng) || !LB_AsymmetricLoadPrivate(privatePem, key)) { if (rng) botan_rng_destroy(rng); return LB_ReturnText(L""); }
    const std::string message = LB_WideToUtf8(text); int result = botan_pk_op_sign_create(&operation, key, scheme.c_str(), 0); size_t length = 0;
    if (result == 0) result = botan_pk_op_sign_update(operation, reinterpret_cast<const uint8_t*>(message.data()), message.size()); if (result == 0) result = botan_pk_op_sign_output_length(operation, &length); std::vector<uint8_t> signature(length);
    if (result == 0) result = botan_pk_op_sign_finish(operation, rng, signature.data(), &length); if (operation) botan_pk_op_sign_destroy(operation); botan_privkey_destroy(key); botan_rng_destroy(rng);
    if (result != 0) { g_lbAsymmetricError = LB_CryptoErrorText("数字签名失败", result); return LB_ReturnText(L""); } return LB_ReturnText(LB_Utf8ToWide(LB_CryptoBase64Encode(signature.data(), length)));
}

static bool LB_AsymmetricVerify(const wchar_t* text, const wchar_t* signatureText, const wchar_t* publicPem, const std::string& scheme) {
    g_lbAsymmetricError.clear(); std::vector<uint8_t> signature; if (!LB_CryptoBase64Decode(LB_WideToUtf8(signatureText), signature)) { g_lbAsymmetricError = L"签名 Base64 编码无效。"; return false; }
    botan_pubkey_t key = nullptr; botan_pk_op_verify_t operation = nullptr; if (!LB_AsymmetricLoadPublic(publicPem, key)) return false; const std::string message = LB_WideToUtf8(text); int result = botan_pk_op_verify_create(&operation, key, scheme.c_str(), 0);
    if (result == 0) result = botan_pk_op_verify_update(operation, reinterpret_cast<const uint8_t*>(message.data()), message.size()); if (result == 0) result = botan_pk_op_verify_finish(operation, signature.data(), signature.size()); if (operation) botan_pk_op_verify_destroy(operation); botan_pubkey_destroy(key);
    if (result < 0) g_lbAsymmetricError = LB_CryptoErrorText("数字签名验证失败", result); return result == 0;
}

static const wchar_t* LB_AsymmetricAgreement(const wchar_t* privatePem, const wchar_t* peerPublicPem) {
    g_lbAsymmetricError.clear(); botan_privkey_t privateKey = nullptr; botan_pubkey_t publicKey = nullptr; botan_pk_op_ka_t operation = nullptr; if (!LB_AsymmetricLoadPrivate(privatePem, privateKey) || !LB_AsymmetricLoadPublic(peerPublicPem, publicKey)) { if (privateKey) botan_privkey_destroy(privateKey); return LB_ReturnText(L""); }
    std::vector<uint8_t> peer; int result = botan_pubkey_view_raw(publicKey, &peer, LB_AsymmetricCaptureBytes); const size_t peerLength = peer.size();
    if (result == 0) result = botan_pk_op_key_agreement_create(&operation, privateKey, "HKDF(SHA-256)", 0); size_t outputLength = 32; std::vector<uint8_t> output(outputLength);
    if (result == 0) result = botan_pk_op_key_agreement(operation, output.data(), &outputLength, peer.data(), peerLength, nullptr, 0); if (operation) botan_pk_op_key_agreement_destroy(operation); botan_pubkey_destroy(publicKey); botan_privkey_destroy(privateKey);
    if (result != 0) { g_lbAsymmetricError = LB_CryptoErrorText("密钥协商失败", result); return LB_ReturnText(L""); } return LB_ReturnText(LB_CryptoHexEncode(output.data(), outputLength));
}

const wchar_t* 非对称_RSA生成私钥(int bits) { if (bits != 2048 && bits != 3072 && bits != 4096) { g_lbAsymmetricError = L"RSA 位数只允许 2048、3072 或 4096。"; return LB_ReturnText(L""); } const std::string value = std::to_string(bits); return LB_AsymmetricGenerate("RSA", value.c_str()); }
const wchar_t* 非对称_RSA取公钥(const wchar_t* key) { return LB_AsymmetricPublicFromPrivate(key); }
const wchar_t* 非对称_RSA_OAEP_SHA256加密(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricEncrypt(text, key, "OAEP(SHA-256)"); }
const wchar_t* 非对称_RSA_OAEP_SHA256解密(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricDecrypt(text, key, "OAEP(SHA-256)"); }
const wchar_t* 非对称_RSA_PSS_SHA256签名(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricSign(text, key, "PSS(SHA-256)"); }
bool 非对称_RSA_PSS_SHA256验签(const wchar_t* text, const wchar_t* signature, const wchar_t* key) { return LB_AsymmetricVerify(text, signature, key, "PSS(SHA-256)"); }
const wchar_t* 非对称_ECDSA_P256生成私钥() { return LB_AsymmetricGenerate("ECDSA", "secp256r1"); }
const wchar_t* 非对称_ECDSA_P256取公钥(const wchar_t* key) { return LB_AsymmetricPublicFromPrivate(key); }
const wchar_t* 非对称_ECDSA_P256签名(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricSign(text, key, "SHA-256"); }
bool 非对称_ECDSA_P256验签(const wchar_t* text, const wchar_t* signature, const wchar_t* key) { return LB_AsymmetricVerify(text, signature, key, "SHA-256"); }
const wchar_t* 非对称_SM2生成私钥() { return LB_AsymmetricGenerate("SM2", "sm2p256v1"); }
const wchar_t* 非对称_SM2取公钥(const wchar_t* key) { return LB_AsymmetricPublicFromPrivate(key); }
const wchar_t* 非对称_SM2加密(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricEncrypt(text, key, "SM3"); }
const wchar_t* 非对称_SM2解密(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricDecrypt(text, key, "SM3"); }
const wchar_t* 非对称_SM2签名(const wchar_t* text, const wchar_t* key, const wchar_t* userId) { const std::string id = LB_WideToUtf8(userId); if (id.find(',') != std::string::npos) { g_lbAsymmetricError = L"SM2 用户标识不能包含英文逗号。"; return LB_ReturnText(L""); } return LB_AsymmetricSign(text, key, id + ",SM3"); }
bool 非对称_SM2验签(const wchar_t* text, const wchar_t* signature, const wchar_t* key, const wchar_t* userId) { const std::string id = LB_WideToUtf8(userId); if (id.find(',') != std::string::npos) { g_lbAsymmetricError = L"SM2 用户标识不能包含英文逗号。"; return false; } return LB_AsymmetricVerify(text, signature, key, id + ",SM3"); }
const wchar_t* 非对称_ECDH_P256生成私钥() { return LB_AsymmetricGenerate("ECDH", "secp256r1"); }
const wchar_t* 非对称_ECDH_P256取公钥(const wchar_t* key) { return LB_AsymmetricPublicFromPrivate(key); }
const wchar_t* 非对称_ECDH_P256协商(const wchar_t* key, const wchar_t* peer) { return LB_AsymmetricAgreement(key, peer); }
const wchar_t* 非对称_X25519生成私钥() { return LB_AsymmetricGenerate("X25519", ""); }
const wchar_t* 非对称_X25519取公钥(const wchar_t* key) { return LB_AsymmetricPublicFromPrivate(key); }
const wchar_t* 非对称_X25519协商(const wchar_t* key, const wchar_t* peer) { return LB_AsymmetricAgreement(key, peer); }
const wchar_t* 非对称_ElGamal生成私钥(int bits) { if (bits != 2048 && bits != 3072) { g_lbAsymmetricError = L"ElGamal 位数只允许 2048 或 3072。"; return LB_ReturnText(L""); } return LB_AsymmetricGenerate("ElGamal", bits == 2048 ? "modp/ietf/2048" : "modp/ietf/3072"); }
const wchar_t* 非对称_ElGamal取公钥(const wchar_t* key) { return LB_AsymmetricPublicFromPrivate(key); }
const wchar_t* 非对称_ElGamal加密(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricEncrypt(text, key, "OAEP(SHA-256)"); }
const wchar_t* 非对称_ElGamal解密(const wchar_t* text, const wchar_t* key) { return LB_AsymmetricDecrypt(text, key, "OAEP(SHA-256)"); }
`;

const CRYPTO_MODULE_RUNTIMES: Record<string, string> = {
  'lingbuilder.crypto.hash': HASH_RUNTIME,
  'lingbuilder.crypto.password': PASSWORD_RUNTIME,
  'lingbuilder.crypto.symmetric': SYMMETRIC_RUNTIME,
  'lingbuilder.crypto.asymmetric': ASYMMETRIC_RUNTIME
};

export function generateCryptoRuntime(enabledModuleIds: ReadonlySet<string>): string {
  const fragments = Object.entries(CRYPTO_MODULE_RUNTIMES)
    .filter(([moduleId]) => enabledModuleIds.has(moduleId))
    .map(([, runtime]) => runtime);
  return fragments.length > 0 ? `${CRYPTO_COMMON_RUNTIME}\n${fragments.join('\n')}` : '';
}
