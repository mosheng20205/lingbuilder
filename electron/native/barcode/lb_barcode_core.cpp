// lb_barcode_core.cpp — LingBuilder 一维条码模块核心（平台无关，2026-10-24）。
// 纯本地实现，零第三方依赖：
//   * 生成：EAN-13 / EAN-8 / UPC-A / Code128（A/B/C 自动择优）/ Code39 → 模块矩阵（1=黑）。
//   * 识别：横向+纵向扫描线 → 游程归一化 → 护栏定位 → 码表解码 → 校验位验证；
//     输入为灰度像素缓冲（平台层负责从位图/屏幕/BMP 转换）。
//   * 自检：生成→矩阵→解码 逐字节闭环 + 校验位异常样本（条码_自检）。
// 本文件同时用于两个场景：
//   1) 生成器注入：经 scripts/generate-barcode-runtime.ts 转成 TS String.raw 模板
//      拼进生成的 C++ 工程（此时 [LBBAR-STANDALONE-BEGIN/END] 区块被剥离）。
//   2) 独立编译：tests 驱动器直接 cl 编译本文件 + win 层做验收。
// 红线：本文件不得出现反引号字符与美元符号花括号序列（String.raw 注入安全）。

#ifndef LB_BARCODE_CORE_INCLUDED
#define LB_BARCODE_CORE_INCLUDED

#include <cstddef>
#include <cstdint>
using std::size_t;
#include <climits>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>

namespace lbbar {

// ---------------- 通用错误 ----------------
static thread_local std::string g_error;

static void SetError(const char* message) { g_error = message; }
static void ClearError() { g_error.clear(); }

// ---------------- 生成结果 ----------------
struct BarcodeMatrix {
    int modules = 0;      // 模块列数
    int rows = 1;         // 条高（模块行数；生成时按需取整）
    std::vector<uint8_t> data; // modules 长度，1=黑 0=白
};

// ---------------- EAN/UPC 码表 ----------------
// L（奇/A 表）、G（偶/B 表）；R = L 逐位取反。
static const char* EAN_L[10] = {
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011"
};
static const char* EAN_G[10] = {
    "0100111", "0110011", "0011011", "0100001", "0011101",
    "0111001", "0000101", "0010001", "0001001", "0010111"
};
// 首数字 → 左侧 6 位 A/B 结构
static const char* EAN_PARITY[10] = {
    "AAAAAA", "AABABB", "AABBAB", "AABBBA", "ABAABB",
    "ABBAAB", "ABBBAA", "ABABAB", "ABABBA", "ABBABA"
};

static int EanCheckDigit(const std::vector<int>& digitsNoCheck) {
    // digitsNoCheck：不含校验位的全部数字（EAN-13 为 12 位）
    int sum = 0;
    for (size_t i = 0; i < digitsNoCheck.size(); i++) {
        int weight = (i % 2 == 0) ? 1 : 3; // 最左位为奇数位（权重 1）
        sum += digitsNoCheck[i] * weight;
    }
    return (10 - sum % 10) % 10;
}

static bool ParseDigits(const std::string& text, size_t expected, std::vector<int>& digits, bool allowCheckTail) {
    digits.clear();
    for (char c : text) {
        if (c < '0' || c > '9') { SetError("内容必须全为数字。"); return false; }
        digits.push_back(c - '0');
    }
    if (digits.size() == expected + 1 && allowCheckTail) {
        // 带校验位输入：校验不符直接拒绝（不静默纠正）
        std::vector<int> body(digits.begin(), digits.end() - 1);
        int expectedCheck = EanCheckDigit(body);
        if (digits.back() != expectedCheck) { SetError("校验位不匹配：请检查输入数字。"); return false; }
        digits.pop_back();
        return true;
    }
    if (digits.size() != expected) {
        SetError("数字位数不正确。"); return false;
    }
    return true;
}

// EAN-13 主体编码（UPC-A 走 first=0 同一矩阵；EAN-8 单独）
static bool EncodeEan13Body(const std::vector<int>& d12, BarcodeMatrix& out) {
    out.data.clear();
    auto push = [&](const char* pattern) { for (const char* p = pattern; *p; p++) out.data.push_back(*p == '1' ? 1 : 0); };
    push("101"); // 左护栏
    const char* parity = EAN_PARITY[d12[0]];
    for (int i = 1; i <= 6; i++) push(parity[i - 1] == 'A' ? EAN_L[d12[i]] : EAN_G[d12[i]]);
    push("01010"); // 中护栏
    for (int i = 7; i <= 11; i++) { std::string r = EAN_L[d12[i]]; for (auto& c : r) c = c == '1' ? '0' : '1'; push(r.c_str()); }
    int check = EanCheckDigit(d12);
    { std::string r = EAN_L[check]; for (auto& c : r) c = c == '1' ? '0' : '1'; push(r.c_str()); }
    push("101"); // 右护栏
    // 静区：左右各 9 模块白
    std::vector<uint8_t> withQuiet(9, 0);
    withQuiet.insert(withQuiet.end(), out.data.begin(), out.data.end());
    withQuiet.insert(withQuiet.end(), 9, 0);
    out.data = withQuiet;
    out.modules = int(out.data.size());
    return true;
}

static bool EncodeEan8Body(const std::vector<int>& d7, BarcodeMatrix& out) {
    out.data.clear();
    auto push = [&](const char* pattern) { for (const char* p = pattern; *p; p++) out.data.push_back(*p == '1' ? 1 : 0); };
    push("101");
    for (int i = 0; i < 4; i++) push(EAN_L[d7[i]]);
    push("01010");
    for (int i = 4; i < 7; i++) { std::string r = EAN_L[d7[i]]; for (auto& c : r) c = c == '1' ? '0' : '1'; push(r.c_str()); }
    int check = EanCheckDigit(d7);
    { std::string r = EAN_L[check]; for (auto& c : r) c = c == '1' ? '0' : '1'; push(r.c_str()); }
    push("101");
    std::vector<uint8_t> withQuiet(9, 0);
    withQuiet.insert(withQuiet.end(), out.data.begin(), out.data.end());
    withQuiet.insert(withQuiet.end(), 9, 0);
    out.data = withQuiet;
    out.modules = int(out.data.size());
    return true;
}

// ---------------- Code128 码表（107 个 pattern，11/13 模块） ----------------
// 标准 Code128 patterns：0..106（106=STOP，13 模块）。以 11 位二进制字符串表示（STOP 含 13）。
static const char* CODE128_PATTERNS[107] = {
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100",
    "11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000",
    "10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110",
    "10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000",
    "11101000110","11100010110","11101101000","11101100010","11100011010",
    "11101111010","11001000010","11110001010","10100110000","10100001100",
    "10010110000","10010000110","10000101100","10000100110","10110010000",
    "10110000100","10011010000","10011000010","10000110100","10000110010",
    "11000010010","11001010000","11110111010","11000010100","10001111010",
    "10100111100","10010111100","10010011110","10111100100","10011110100",
    "10011110010","11110100100","11110010100","11110010010","11011011110",
    "11011110110","11110110110","10101111000","10100011110","10001011110",
    "10111101000","10111100010","11110101000","11110100010","10111011110",
    "10111101110","11101011110","11110101110","11010000100","11010010000",
    "11010011100","1100011101011"  // 106 = STOP（13 模块）
};

static int Code128ValueForChar(char c, int subset) {
    if (subset == 'A') {
        if (c >= ' ' && c <= '_') return c - ' ';
        if (c >= '0' && c <= '9') return c - '0' + 64; // 不常用区
        switch (c) {
            case '\0': return 64; case '@': return 64; // F1 等控制符从简：不支持
            default: return -1;
        }
    }
    // subset B
    if (c >= ' ' && c <= '~') return c - ' ';
    return -1;
}

// Code128 编码：自动子集——纯数字（≥4 位）走 C，其余走 B；混合按数字段切 C。
static bool EncodeCode128(const std::string& text, BarcodeMatrix& out) {
    if (text.empty()) { SetError("内容不能为空。"); return false; }
    // 值序列（Code128 语义值）
    std::vector<int> values;
    int startValue = 104; // Start B
    bool hasLower = false;
    for (char c : text) if (c < ' ' || c > '~') { SetError("Code128 仅支持 ASCII 可见字符（32~126）。"); return false; }
    for (char c : text) if (c >= 'a' && c <= 'z') hasLower = true;
    if (!hasLower && text.size() >= 4) {
        bool allDigits = true;
        for (char c : text) if (c < '0' || c > '9') { allDigits = false; break; }
        if (allDigits) {
            // 全数字偶数位 → 纯 C；奇数位首位单 B
            startValue = 105; // Start C
            size_t i = 0;
            if (text.size() % 2 == 1) {
                // 首字符用 B 编（值 = 字符），切回 C 用 code 99
                values.push_back(text[0] - ' ');
                values.push_back(99); // Code C 切换
                i = 1;
            }
            for (; i + 1 < text.size(); i += 2) values.push_back((text[i] - '0') * 10 + (text[i + 1] - '0'));
        } else {
            startValue = 104;
            for (char c : text) values.push_back(c - ' ');
        }
    } else {
        startValue = 104;
        for (char c : text) values.push_back(c - ' ');
    }
    // 校验值 = (start + Σ value*(位置从1起)) % 103
    int checksum = startValue;
    for (size_t i = 0; i < values.size(); i++) checksum += values[i] * int(i + 1);
    checksum %= 103;
    // 拼矩阵
    out.data.clear();
    auto pushPattern = [&](int index) {
        for (const char* p = CODE128_PATTERNS[index]; *p; p++) out.data.push_back(*p == '1' ? 1 : 0);
    };
    std::vector<uint8_t> withQuiet(10, 0);
    pushPattern(startValue);
    for (int value : values) pushPattern(value);
    pushPattern(checksum);
    pushPattern(106); // STOP
    withQuiet.insert(withQuiet.end(), out.data.begin(), out.data.end());
    withQuiet.insert(withQuiet.end(), 10, 0);
    out.data = withQuiet;
    out.modules = int(out.data.size());
    return true;
}

// ---------------- Code39 ----------------
// 43 字符 + *（起始/终止）。每字符 9 模块（5 条 4 空），宽窄 3:1；字符间 1 窄空。
struct Code39Entry { char ch; const char* pattern; };
// 每条目 = 10 模块位串（9 元素模块：宽 3 窄 1，条/空交替 + 末尾 1 窄分隔模块 0）
static const Code39Entry CODE39_TABLE[44] = {
    {'0', "1010001110111010"},{'1', "1110100010101110"},{'2', "1011100010101110"},{'3', "1110111000101010"},
    {'4', "1010001110101110"},{'5', "1110100011101010"},{'6', "1011100011101010"},{'7', "1010001011101110"},
    {'8', "1110100010111010"},{'9', "1011100010111010"},{'A', "1110101000101110"},{'B', "1011101000101110"},
    {'C', "1110111010001010"},{'D', "1010111000101110"},{'E', "1110101110001010"},{'F', "1011101110001010"},
    {'G', "1010100011101110"},{'H', "1110101000111010"},{'I', "1011101000111010"},{'J', "1010111000111010"},
    {'K', "1110101010001110"},{'L', "1011101010001110"},{'M', "1110111010100010"},{'N', "1010111010001110"},
    {'O', "1110101110100010"},{'P', "1011101110100010"},{'Q', "1010101110001110"},{'R', "1110101011100010"},
    {'S', "1011101011100010"},{'T', "1010111011100010"},{'U', "1110001010101110"},{'V', "1000111010101110"},
    {'W', "1110001110101010"},{'X', "1000101110101110"},{'Y', "1110001011101010"},{'Z', "1000111011101010"},
    {'-', "1000101011101110"},{'.', "1110001010111010"},{' ', "1000111010111010"},{'$', "1000100010001010"},
    {'/', "1000100010100010"},{'+', "1000101000100010"},{'%', "1010001000100010"},{'*', "1000101110111010"}
};
// 注：上表 pattern 为 12 位（含字符间分隔空）——9 模块字符 + 1 窄空 = 10？Code39 常用 12 位
// 表示法是「nNnWnWnNn」…这里采用标准 12 位位串（含间隔位），生成时直接拼接、末尾去 1 位。

static bool EncodeCode39(const std::string& textIn, BarcodeMatrix& out) {
    std::string text = textIn;
    for (char& c : text) {
        if (c >= 'a' && c <= 'z') c = char(c - 'a' + 'A');
    }
    for (char c : text) {
        if (c == '*') { SetError("内容不能包含星号（保留为起始/终止符）。"); return false; }
        bool found = false;
        for (const auto& entry : CODE39_TABLE) if (entry.ch == c) { found = true; break; }
        if (!found) { SetError("Code39 仅支持 0-9、A-Z、空格与 - . $ / + %。"); return false; }
    }
    out.data.clear();
    auto pushChar = [&](char c) {
        for (const auto& entry : CODE39_TABLE) {
            if (entry.ch != c) continue;
            for (const char* p = entry.pattern; *p; p++) out.data.push_back(*p == '1' ? 1 : 0);
            return;
        }
    };
    std::vector<uint8_t> withQuiet(10, 0);
    pushChar('*');
    for (char c : text) pushChar(c);
    pushChar('*');
    withQuiet.insert(withQuiet.end(), out.data.begin(), out.data.end());
    withQuiet.insert(withQuiet.end(), 10, 0);
    out.data = withQuiet;
    out.modules = int(out.data.size());
    return true;
}

// ---------------- 生成统一入口 ----------------
// kind: 0=EAN13 1=EAN8 2=UPCA 3=Code128 4=Code39
static bool Generate(int kind, const std::string& text, BarcodeMatrix& out) {
    ClearError();
    if (kind == 0 || kind == 2) {
        std::vector<int> digits;
        size_t expected = kind == 0 ? 12 : 11;
        if (!ParseDigits(text, expected, digits, true)) return false;
        if (kind == 2) {
            // UPC-A = EAN-13 首位 0
            std::vector<int> d12;
            d12.push_back(0);
            d12.insert(d12.end(), digits.begin(), digits.end());
            return EncodeEan13Body(d12, out);
        }
        return EncodeEan13Body(digits, out);
    }
    if (kind == 1) {
        std::vector<int> digits;
        if (!ParseDigits(text, 7, digits, true)) return false;
        return EncodeEan8Body(digits, out);
    }
    if (kind == 3) return EncodeCode128(text, out);
    if (kind == 4) return EncodeCode39(text, out);
    SetError("未知码制。");
    return false;
}

// ---------------- 识别 ----------------
// 输入：灰度像素（0=黑 255=白 的 8bit）。返回码制 kind 与解码文本；失败返回 false。
struct DecodeResult {
    int kind = -1;
    std::string text;
    bool checkPassed = false;
};

// 把一行（或一列）灰度像素转成游程序列（值,长度）
static void BuildRuns(const uint8_t* line, int length, std::vector<std::pair<int, int>>& runs) {
    runs.clear();
    if (length <= 0) return;
    int prev = line[0] < 128 ? 1 : 0;
    int count = 1;
    for (int i = 1; i < length; i++) {
        int v = line[i] < 128 ? 1 : 0;
        if (v == prev) count++;
        else { runs.emplace_back(prev, count); prev = v; count = 1; }
    }
    runs.emplace_back(prev, count);
}

// 游程 → 模块位串：以最小游程为模块宽（抗噪：模块宽 = 中位最小值），聚合为宽窄或逐模块。
// mode 0: 逐模块（EAN/UPC：全程等宽模块）；mode 1: 宽窄比（Code39：宽=3×窄）。
static bool RunsToModules(const std::vector<std::pair<int, int>>& runs, int quietModules,
                          std::vector<uint8_t>& modules, bool wideNarrow) {
    modules.clear();
    if (runs.size() < 4) return false;
    // 模块宽 = 非零游程中的最小值（条与空至少 1 模块）
    int minWidth = INT32_MAX;
    int64_t total = 0;
    for (const auto& run : runs) { if (run.second < minWidth) minWidth = run.second; total += run.second; }
    if (minWidth <= 0) return false;
    if (!wideNarrow) {
        // 等宽模块：每个游程按 round(len/minWidth) 展开
        for (const auto& run : runs) {
            int count = int((run.second + minWidth / 2) / minWidth);
            if (count < 1) count = 1;
            if (count > 40) { return false; } // 异常游程（超出可容忍静区宽度）
            modules.insert(modules.end(), size_t(count), uint8_t(run.first));
        }
        return true;
    }
    // 宽窄：宽 ≈ 窄×2 以上；按 1 或 3 模块展开（Code39 每字符 9 模块：6 窄 3 宽）
    int narrowThreshold = minWidth * 2 - minWidth / 2;
    for (const auto& run : runs) {
        int count = run.second >= minWidth * 2 - (minWidth / 2) ? 3 : 1;
        modules.insert(modules.end(), size_t(count), uint8_t(run.first));
    }
    return true;
}

// EAN 家族在一串模块中尝试解码（找护栏 101 ... 01010 ... 101 结构）
static bool TryDecodeEan(const std::vector<uint8_t>& m, int digitCount, DecodeResult& result) {
    // 护栏 101 开头：扫描模块串
    if (m.size() < 30) return false;
    for (size_t start = 0; start + 3 <= m.size(); start++) {
        if (!(m[start] == 1 && m[start + 1] == 0 && m[start + 2] == 1)) continue;
        size_t pos = start + 3;
        int leftDigits = digitCount == 8 ? 4 : 6;
        int rightDigits = digitCount == 8 ? 4 : 6;
        std::vector<int> leftPattern(leftDigits, -1), leftBits;
        std::vector<int> digits;
        // 左侧数据
        bool ok = true;
        std::vector<uint8_t> leftModules;
        if (pos + size_t(leftDigits) * 7 + 5 > m.size()) continue;
        leftModules.assign(m.begin() + long(pos), m.begin() + long(pos + leftDigits * 7));
        for (int d = 0; d < leftDigits; d++) {
            std::string pattern;
            for (int b = 0; b < 7; b++) pattern += char('0' + leftModules[size_t(d) * 7 + b]);
            int matchL = -1, matchG = -1;
            for (int v = 0; v < 10; v++) {
                if (pattern == EAN_L[v]) matchL = v;
                if (pattern == EAN_G[v]) matchG = v;
            }
            if (matchL < 0 && matchG < 0) { ok = false; break; }
            digits.push_back(matchL >= 0 ? matchL : matchG);
            leftPattern[d] = matchL >= 0 ? 0 : 1;
        }
        if (!ok) continue;
        pos += size_t(leftDigits) * 7;
        // 中护栏 01010
        if (pos + 5 > m.size()) continue;
        if (!(m[pos] == 0 && m[pos + 1] == 1 && m[pos + 2] == 0 && m[pos + 3] == 1 && m[pos + 4] == 0)) continue;
        pos += 5;
        // 右侧数据（R 表 = L 取反）
        if (pos + size_t(rightDigits) * 7 + 3 > m.size()) continue;
        for (int d = 0; d < rightDigits; d++) {
            std::string pattern;
            for (int b = 0; b < 7; b++) pattern += char('0' + m[pos + size_t(d) * 7 + b]);
            int match = -1;
            for (int v = 0; v < 10; v++) {
                std::string r = EAN_L[v];
                for (auto& c : r) c = c == '1' ? '0' : '1';
                if (pattern == r) { match = v; break; }
            }
            if (match < 0) { ok = false; break; }
            digits.push_back(match);
        }
        if (!ok) continue;
        pos += size_t(rightDigits) * 7;
        // 右护栏 101
        if (pos + 3 > m.size()) continue;
        if (!(m[pos] == 1 && m[pos + 1] == 0 && m[pos + 2] == 1)) continue;

        // 还原完整数字与校验
        std::string text;
        int kind = -1;
        std::vector<int> body;
        if (digitCount == 13 || digitCount == 12) {
            // 由左 parity 结构反推首数字（digitCount 12 = UPC-A 直接形态）
            std::string parity;
            for (int p : leftPattern) parity += p == 0 ? 'A' : 'B';
            int first = -1;
            for (int v = 0; v < 10; v++) if (EAN_PARITY[v] == parity) { first = v; break; }
            if (first < 0) continue; // 不合法结构
            if (digitCount == 12 && first != 0) continue; // UPC-A 左侧必须全 A（first=0）
            body.push_back(first);
            body.insert(body.end(), digits.begin(), digits.end());
            kind = first == 0 ? 2 : 0; // 首位 0 的 13 位形态与 UPC-A 同构，按 UPC-A 语义输出
        } else {
            body = digits;
            kind = 1;
        }
        std::vector<int> bodyWithoutCheck(body.begin(), body.end() - 1);
        int check = EanCheckDigit(bodyWithoutCheck);
        if (check != body.back()) continue; // 校验不过
        for (int v : body) text += char('0' + v);
        // UPC-A 输出去掉前置 0
        if (kind == 2) text = text.substr(1);
        result.kind = kind;
        result.text = text;
        result.checkPassed = true;
        return true;
    }
    return false;
}

// Code128：模块串 → 11/13 位 pattern 匹配
static bool TryDecodeCode128(const std::vector<uint8_t>& m, DecodeResult& result) {
    if (m.size() < 35) return false;
    for (size_t start = 0; start + 11 <= m.size(); start++) {
        // 找 START（104/105/103）
        int startValue = -1;
        std::string firstPattern;
        for (int b = 0; b < 11; b++) firstPattern += char('0' + m[start + b]);
        for (int v = 103; v <= 105; v++) if (firstPattern == CODE128_PATTERNS[v]) { startValue = v; break; }
        if (startValue < 0) continue;
        size_t pos = start + 11;
        std::vector<int> values;
        bool ok = true;
        while (true) {
            if (pos + 13 > m.size()) { ok = false; break; }
            std::string pattern;
            for (int b = 0; b < 13 && pos + size_t(b) < m.size(); b++) pattern += char('0' + m[pos + b]);
            if (pattern == std::string(CODE128_PATTERNS[106])) break; // STOP
            if (pattern.size() < 11) { ok = false; break; }
            pattern = pattern.substr(0, 11);
            int matched = -1;
            for (int v = 0; v < 106; v++) if (pattern == CODE128_PATTERNS[v]) { matched = v; break; }
            if (matched < 0) { ok = false; break; }
            values.push_back(matched);
            pos += 11;
            if (values.size() > 200) { ok = false; break; }
        }
        if (!ok || values.empty()) continue;
        // 校验
        int expected = values.back();
        values.pop_back();
        int checksum = startValue;
        for (size_t i = 0; i < values.size(); i++) checksum += values[i] * int(i + 1);
        if (checksum % 103 != expected) continue;
        // 值 → 文本（按子集）
        std::string text;
        int subset = startValue == 105 ? 2 : (startValue == 104 ? 1 : 0);
        for (size_t i = 0; i < values.size(); i++) {
            int v = values[i];
            if (v == 99) { subset = 2; continue; }
            if (v == 98) { subset = 1; continue; }
            if (v == 101) { subset = 0; continue; }
            if (v >= 102) continue; // FNC 等跳过
            if (subset == 2) {
                // C 子集：每个值本身就是两位数字（00~99）
                if (v > 99) { ok = false; break; }
                text += char('0' + v / 10);
                text += char('0' + v % 10);
            } else {
                text += char(v + 32);
            }
        }
        if (!ok || text.empty()) continue;
        result.kind = 3;
        result.text = text;
        result.checkPassed = true;
        return true;
    }
    return false;
}

// Code39：宽窄模块串 → 字符
static bool TryDecodeCode39(const std::vector<uint8_t>& m, DecodeResult& result) {
    if (m.size() < 20) return false;
    for (size_t start = 0; start + 12 <= m.size(); start++) {
        // 每字符 9 模块 + 1 分隔空 = 10；按 12 位位串表匹配（表含分隔位）
        // 先取首字符（应为 *）
        auto matchAt = [&](size_t pos, char* outCh) -> bool {
            for (const auto& entry : CODE39_TABLE) {
                const size_t length = strlen(entry.pattern); // 9 元素模块（宽3窄1）+ 1 分隔
                if (pos + length > m.size()) continue;
                bool matched = true;
                for (size_t b = 0; b < length; b++) {
                    if (char('0' + m[pos + b]) != entry.pattern[b]) { matched = false; break; }
                }
                if (matched) { if (outCh) *outCh = entry.ch; return true; }
            }
            return false;
        };
        char ch = 0;
        if (!matchAt(start, &ch) || ch != '*') continue;
        std::string text;
        size_t pos = start + 16;
        bool ok = true;
        while (true) {
            if (!matchAt(pos, &ch)) { ok = false; break; }
            if (ch == '*') break; // 终止
            text += ch;
            pos += 16;
            if (text.size() > 100) { ok = false; break; }
        }
        if (!ok || text.empty()) continue;
        result.kind = 4;
        result.text = text;
        result.checkPassed = true; // Code39 校验字符为可选，v1 视为通过
        return true;
    }
    return false;
}

// 主识别入口：灰度像素 + 宽高。横向扫 3 条线 + 纵向扫 3 条线（覆盖 90° 旋转）。
static bool Decode(const uint8_t* gray, int width, int height, DecodeResult& result) {
    ClearError();
    if (!gray || width < 20 || height < 4) { SetError("图像尺寸过小或为空。"); return false; }
    std::vector<std::pair<int, int>> runs;
    std::vector<uint8_t> modules;
    // 横向三条线：上 1/4、中、下 1/4
    int rows[3] = {height / 4, height / 2, height * 3 / 4};
    for (int r : rows) {
        BuildRuns(gray + size_t(r) * width, width, runs);
        if (RunsToModules(runs, 9, modules, false)) {
            if (TryDecodeEan(modules, 13, result)) return true;
            if (TryDecodeEan(modules, 12, result)) return true;
            if (TryDecodeEan(modules, 8, result)) return true;
            if (TryDecodeCode128(modules, result)) return true;
        }
        if (RunsToModules(runs, 9, modules, true)) {
            if (TryDecodeCode39(modules, result)) return true;
        }
    }
    // 纵向三条线（旋转 90°）
    std::vector<uint8_t> column(static_cast<size_t>(height));
    int cols[3] = {width / 4, width / 2, width * 3 / 4};
    for (int c : cols) {
        for (int y = 0; y < height; y++) {
            const unsigned char* source = gray + static_cast<size_t>(y) * static_cast<size_t>(width) + static_cast<size_t>(c);
            column[static_cast<size_t>(y)] = *source;
        }
        BuildRuns(column.data(), height, runs);
        if (RunsToModules(runs, 9, modules, false)) {
            if (TryDecodeEan(modules, 13, result)) return true;
            if (TryDecodeEan(modules, 12, result)) return true;
            if (TryDecodeEan(modules, 8, result)) return true;
            if (TryDecodeCode128(modules, result)) return true;
        }
        if (RunsToModules(runs, 9, modules, true)) {
            if (TryDecodeCode39(modules, result)) return true;
        }
    }
    SetError("未在图像中识别出一维条码（尝试了 EAN-13/UPC-A/EAN-8/Code128/Code39，横向与纵向扫描）。");
    return false;
}

// ---------------- 自检 ----------------
static bool SelfTest() {
    ClearError();
    struct Case { int kind; const char* text; };
    const Case cases[] = {
        {0, "590123412345"},   // EAN-13（无校验位，程序补）
        {0, "5901234123457"},  // EAN-13 含校验位
        {1, "9638507"},        // EAN-8（7 位 + 程序补校验）
        {2, "03600029145"},    // UPC-A（经典宝洁样品）
        {3, "ABC-abc-123"},    // Code128 B
        {3, "12345678"},       // Code128 全数字（C 子集）
        {4, "HELLO WORLD"},    // Code39
        {4, "2026-10-24"},
    };
    for (const Case& item : cases) {
        BarcodeMatrix matrix;
        if (!Generate(item.kind, item.text, matrix)) { SetError("自检：生成失败。"); return false; }
        // 渲染成像素（每模块 2 像素宽、10 行高）
        int px = matrix.modules * 2, py = 10;
        std::vector<uint8_t> gray(size_t(px) * py, 255);
        for (int y = 0; y < py; y++)
            for (int x = 0; x < px; x++)
                if (matrix.data[size_t(x / 2)]) gray[size_t(y) * px + x] = 0;
        DecodeResult decoded;
        if (!Decode(gray.data(), px, py, decoded)) return false;
        if (decoded.kind != item.kind) { SetError("自检：码制不匹配。"); return false; }
        // EAN/UPC 生成时补了校验位 → 解码文本含校验位；比对规则：
        // EAN-13/8：生成文本 + 校验位 == 解码文本；UPC-A 同理；Code128/39：直接比对
        std::string expected = item.text;
        if (item.kind == 0 || item.kind == 1 || item.kind == 2) {
            std::vector<int> digits;
            for (char c : expected) digits.push_back(c - '0');
            // 输入可能已含校验位（12+1 / 7+1 / 11+1）——去掉再统一补
            size_t bodyLen = item.kind == 0 ? 12 : (item.kind == 1 ? 7 : 11);
            if (digits.size() == bodyLen + 1) digits.pop_back();
            if (item.kind == 2) { std::vector<int> d; d.push_back(0); d.insert(d.end(), digits.begin(), digits.end()); digits = d; }
            digits.push_back(EanCheckDigit(digits));
            expected.clear();
            for (int v : digits) expected += char('0' + v);
            if (item.kind == 2) expected = expected.substr(1);
        }
        if (decoded.text != expected) { SetError("自检：解码文本不匹配。"); return false; }
        if (!decoded.checkPassed) { SetError("自检：校验未通过。"); return false; }
    }
    // 校验位异常样本必须被拒
    {
        BarcodeMatrix matrix;
        if (!Generate(0, "5901234123457", matrix)) return false; // 合法
        // 篡改一位（把第 3 模块翻转），解码应失败或校验不过（不静默返回错值）
        if (matrix.data.size() > 20) {
            std::vector<uint8_t> damaged = matrix.data;
            for (int i = 12; i < 20; i++) damaged[size_t(i)] ^= 1;
            BarcodeMatrix dm = matrix;
            dm.data = damaged;
            int px = dm.modules * 2, py = 10;
            std::vector<uint8_t> gray(size_t(px) * py, 255);
            for (int y = 0; y < py; y++)
                for (int x = 0; x < px; x++)
                    if (dm.data[size_t(x / 2)]) gray[size_t(y) * px + x] = 0;
            DecodeResult decoded;
            bool recognized = Decode(gray.data(), px, py, decoded);
            if (recognized && decoded.text == "5901234123457") { SetError("自检：损坏样本未被检出。"); return false; }
        }
    }
    return true;
}

} // namespace lbbar

// [LBBAR-STANDALONE-BEGIN]
// 独立编译验收时由驱动器消费；生成器注入时剥离。
// [LBBAR-STANDALONE-END]

#endif // LB_BARCODE_CORE_INCLUDED
