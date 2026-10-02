/**
 * 二维码模块（lingbuilder.qrcode）生成器注入运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/qrcode/lb_qrcode_core.cpp + lb_qrcode_win.cpp
 * 再生命令：npm run qrcode:runtime（--check 模式供门禁）
 * 注入点：lingCppWin32Project.ts 中 generateQrCodeRuntime(enabledModules)，
 * 模块启用时拼进生成的 C++ 工程（x64/win32 通用）。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const QRCODE_MODULE_ID = 'lingbuilder.qrcode';

export const QRCODE_RUNTIME = String.raw`// ============================================================================
// lb_qrcode_core.cpp — LingBuilder 二维码模块核心（ISO/IEC 18004）
//
// 纯本地实现，零第三方依赖：
//   * 生成：数字/字母数字/字节(UTF-8) 自动择短，版本 1-40 自动选最小，
//           纠错级别 L/M/Q/H，GF(256) RS 纠错，format/version BCH，
//           8 掩码全试按标准四条罚分取最低。
//   * 识别：定位图形 1:1:3:1:1 游程定位 → 仿射/单应重采样 → 去掩码 →
//           反交织 → RS 纠错（真纠错，不止校验）→ 分段解析出文本/字节。
//   * PNG 编解码（deflate 自带，存储块/固定/动态 Huffman 全解）、
//     基线 JPEG 解码（霍夫曼/反量化/IDCT/色度上采样）全部自带。
//
// 本文件同时用于两个场景：
//   1) 生成器注入：经 scripts/generate-qrcode-runtime.ts 转成 TS String.raw
//      模板拼进生成的 C++ 工程（此时 [LBQR-STANDALONE-BEGIN/END] 区块被剥离）。
//   2) 独立编译：tests 驱动器直接 cl 编译本文件做验收。
// 红线：本文件不得出现反引号字符与美元符号花括号序列（String.raw 注入安全）。
// ============================================================================

#include <windows.h>
#include <string>
#include <vector>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <algorithm>
#include <map>
#include <memory>

#ifndef LB_QRCODE_RUNTIME_INCLUDED
#define LB_QRCODE_RUNTIME_INCLUDED

namespace lbqr {

// 诊断开关（驱动器经 LBQR_DBG 环境变量置 1）
int lbqrDbg = 0;

// ---------------------------------------------------------------------------
// 基础图像
// ---------------------------------------------------------------------------
struct GrayImage {
    int w = 0;
    int h = 0;
    std::vector<unsigned char> px; // 行优先灰度
    unsigned char at(int x, int y) const {
        return (x >= 0 && y >= 0 && x < w && y < h) ? px[static_cast<size_t>(y) * w + x] : 0;
    }
    unsigned char bilinear(double fx, double fy) const {
        if (fx < 0) fx = 0;
        if (fy < 0) fy = 0;
        if (fx > w - 1) fx = w - 1.0;
        if (fy > h - 1) fy = h - 1.0;
        const int x0 = static_cast<int>(fx), y0 = static_cast<int>(fy);
        const int x1 = (std::min)(x0 + 1, w - 1), y1 = (std::min)(y0 + 1, h - 1);
        const double dx = fx - x0, dy = fy - y0;
        const double a = at(x0, y0) * (1 - dx) + at(x1, y0) * dx;
        const double b = at(x0, y1) * (1 - dx) + at(x1, y1) * dx;
        return static_cast<unsigned char>(a * (1 - dy) + b * dy + 0.5);
    }
};

// ---------------------------------------------------------------------------
// GF(256)，本原多项式 0x11D，生成元 α=2
// ---------------------------------------------------------------------------
struct GfTables {
    uint8_t exp[512];
    uint8_t log[256];
    GfTables() {
        unsigned x = 1;
        for (int i = 0; i < 255; ++i) {
            exp[i] = static_cast<uint8_t>(x);
            log[x] = static_cast<uint8_t>(i);
            x <<= 1;
            if (x & 0x100u) x ^= 0x11Du;
        }
        for (int i = 255; i < 512; ++i) exp[i] = exp[i - 255];
    }
    int mul(int a, int b) const { return (a == 0 || b == 0) ? 0 : exp[log[a] + log[b]]; }
    int div(int a, int b) const { return a == 0 ? 0 : exp[log[a] + 255 - log[b]]; }
    int pow(int a, int e) const { return a == 0 ? 0 : exp[(log[a] * e) % 255]; }
    int inv(int a) const { return exp[255 - log[a]]; }
};

static const GfTables& gf() { static const GfTables t; return t; }

// 生成多项式 g(x) = Π (x - α^i)，i = 0..n-1（QR 约定首根 α^0）；系数最高次在下标 0。
static std::vector<uint8_t> rsGenerator(int n) {
    std::vector<uint8_t> poly(1, 1);
    const GfTables& g = gf();
    for (int i = 0; i < n; ++i) {
        std::vector<uint8_t> next(poly.size() + 1, 0);
        for (size_t j = 0; j < poly.size(); ++j) {
            next[j] = static_cast<uint8_t>(next[j] ^ poly[j]);
            next[j + 1] = static_cast<uint8_t>(next[j + 1] ^ g.mul(poly[j], g.exp[i]));
        }
        poly.swap(next);
    }
    return poly;
}

// 余式除法（生成侧编码与自检共用）
static void rsRemainder(const std::vector<uint8_t>& bytes, int n, std::vector<uint8_t>& rem) {
    const std::vector<uint8_t> gen = rsGenerator(n);
    rem.assign(n, 0);
    const GfTables& g = gf();
    for (size_t k = 0; k < bytes.size(); ++k) {
        const uint8_t factor = static_cast<uint8_t>(bytes[k] ^ rem[0]);
        for (int i = 0; i < n - 1; ++i) rem[i] = rem[i + 1];
        rem[n - 1] = 0;
        for (int i = 0; i < n; ++i) rem[i] = static_cast<uint8_t>(rem[i] ^ g.mul(gen[i + 1], factor));
    }
}

static std::vector<uint8_t> rsEncodeRemainder(const std::vector<uint8_t>& data, int n) {
    std::vector<uint8_t> rem;
    rsRemainder(data, n, rem);
    return rem;
}

// 伴随式全零校验（把 data+ecc 整体再除一次生成多项式）
static bool rsSyndromeZero(const std::vector<uint8_t>& codeword, int n) {
    std::vector<uint8_t> rem;
    rsRemainder(codeword, n, rem);
    for (int i = 0; i < n; ++i) if (rem[i]) return false;
    return true;
}

// RS 纠错解码：cw 就地修正，返回纠正的错误码字个数；无法纠时返回 -1。
// 多项式约定：cw[0] 为最高次项；伴随式 S_i = cw(α^i)，i = 0..ecc-1（首根 α^0）。
static int rsDecode(std::vector<uint8_t>& cw, int ecc) {
    const GfTables& g = gf();
    const int n = static_cast<int>(cw.size());
    std::vector<int> S(ecc, 0);
    for (int i = 0; i < ecc; ++i) {
        int v = 0;
        for (int j = 0; j < n; ++j) v = g.mul(v, g.exp[i]) ^ cw[j];
        S[i] = v;
    }
    bool allZero = true;
    for (int i = 0; i < ecc; ++i) if (S[i]) { allZero = false; break; }
    if (allZero) return 0;

    // Berlekamp-Massey 求错误位置多项式 Λ(x)
    std::vector<int> Lm(ecc + 1, 0), Bm(ecc + 1, 0), Tmp(ecc + 1, 0);
    Lm[0] = 1; Bm[0] = 1;
    int L = 0, shift = 1, b = 1;
    for (int nn = 0; nn < ecc; ++nn) {
        int d = S[nn];
        for (int i = 1; i <= L; ++i) d ^= g.mul(Lm[i], S[nn - i]);
        if (d == 0) { ++shift; continue; }
        const int coef = g.div(d, b);
        std::copy(Lm.begin(), Lm.end(), Tmp.begin());
        for (int i = 0; i + shift <= ecc; ++i) Lm[i + shift] ^= g.mul(coef, Bm[i]);
        if (2 * L <= nn) {
            L = nn + 1 - L;
            std::copy(Tmp.begin(), Tmp.end(), Bm.begin());
            b = d;
            shift = 1;
        } else {
            ++shift;
        }
    }
    if (L == 0 || L > ecc / 2) return -1;
    if (lbqrDbg) {
        std::fprintf(stderr, "[rs] L=%d Lambda:", L);
        for (int i = 0; i <= L; ++i) std::fprintf(stderr, " %02X", Lm[i]);
        std::fprintf(stderr, "\n");
    }
    // 钱搜索：错误位置 j（0 起从首字节计）满足 Λ(α^{-(N-1-j)}) == 0
    std::vector<int> errPos;
    for (int j = 0; j < n; ++j) {
        const int p = (n - 1 - j) % 255;
        const int xinv = g.exp[(255 - p) % 255];
        int v = 1;
        for (int i = 1; i <= L; ++i) v ^= g.mul(Lm[i], g.pow(xinv, i));
        if (v == 0) errPos.push_back(j);
    }
    if (static_cast<int>(errPos.size()) != L) return -1;
    if (lbqrDbg) {
        std::fprintf(stderr, "[rs] errPos:");
        for (int pp : errPos) std::fprintf(stderr, " %d", pp);
        std::fprintf(stderr, "\n");
    }
    // Forney：Ω(x) = S(x)·Λ(x) mod x^ecc；幅值 = X·Ω(X^-1) / Λ'(X^-1)
    std::vector<int> omega(ecc, 0);
    for (int i = 0; i < ecc; ++i) {
        int v = 0;
        for (int j = (std::max)(0, i - L); j <= i; ++j) v ^= g.mul(S[j], Lm[i - j]);
        omega[i] = v;
    }
    if (lbqrDbg) {
        std::fprintf(stderr, "[rs] S:");
        for (int i = 0; i < ecc; ++i) std::fprintf(stderr, " %02X", S[i]);
        std::fprintf(stderr, " omega:");
        for (int i = 0; i < ecc; ++i) std::fprintf(stderr, " %02X", omega[i]);
        std::fprintf(stderr, "\n");
    }
    for (size_t idx = 0; idx < errPos.size(); ++idx) {
        const int j = errPos[idx];
        const int p = (n - 1 - j) % 255;
        const int xi = g.exp[p]; // X = α^(N-1-j)
        const int xinv = g.inv(xi);
        int num = 0;
        for (int i = 0; i < ecc; ++i) num ^= g.mul(omega[i], g.pow(xinv, i));
        int den = 0; // Λ'(x)：奇次项
        for (int i = 1; i <= L; i += 2) den ^= g.mul(Lm[i], g.pow(xinv, i - 1));
        if (den == 0) return -1;
        const int mag = g.mul(xi, g.div(num, den));
        if (lbqrDbg) std::fprintf(stderr, "[rs] fix j=%d xi=%02X num=%02X den=%02X mag=%02X (was %02X)\n", j, xi, num, den, mag, cw[j]);
        cw[j] = static_cast<uint8_t>(cw[j] ^ mag);
    }
    // 复核伴随式
    for (int i = 0; i < ecc; ++i) {
        int v = 0;
        for (int j = 0; j < n; ++j) v = g.mul(v, g.exp[i]) ^ cw[j];
        if (v != 0) return -1;
    }
    return L;
}

// ---------------------------------------------------------------------------
// 标准表（与 nayuki qrcodegen 逐项核对；M v1-20 另与参考实现 qr-encode.mjs 逐项核对）
// ---------------------------------------------------------------------------
static const int8_t ECC_PER_BLOCK[4][41] = {
    {-1,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
        28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},
    {-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
        26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28},
    {-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30,
        28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},
    {-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28,
        30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},
};
static const int8_t NUM_BLOCKS[4][41] = {
    {-1,  1,  1,  1,  1,  1,  2,  2,  2,  2,  4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,
         8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25},
    {-1,  1,  1,  1,  2,  2,  4,  4,  4,  5,  5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16,
        17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49},
    {-1,  1,  1,  2,  2,  4,  4,  6,  6,  8,  8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20,
        23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68},
    {-1,  1,  1,  2,  4,  4,  4,  5,  6,  8,  8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
        25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81},
};

static int rawDataModules(int ver) {
    int result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const int numAlign = ver / 7 + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7) result -= 36;
    }
    return result;
}
static int totalCodewords(int ver) { return rawDataModules(ver) / 8; }
static int dataCodewords(int ver, int level) {
    return totalCodewords(ver) - ECC_PER_BLOCK[level][ver] * NUM_BLOCKS[level][ver];
}

static std::vector<int> alignmentPositions(int ver) {
    std::vector<int> result;
    if (ver == 1) return result;
    const int numAlign = ver / 7 + 2;
    const int step = (ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4) * 2;
    int pos = ver * 4 + 17 - 7;
    for (int i = 0; i < numAlign - 1; ++i, pos -= step) result.insert(result.begin(), pos);
    result.insert(result.begin(), 6);
    return result;
}

// format BCH(15,5)：生成多项式 0x537，整体 XOR 0x5412；级别位 L=01 M=00 Q=11 H=10
static int bitLength(int v) { int n = 0; while (v) { ++n; v >>= 1; } return n; }
static int polyModDiv(int msg, int gen) {
    const int g = bitLength(gen) - 1;
    int v = msg;
    while (bitLength(v) - 1 >= g) v ^= gen << (bitLength(v) - 1 - g);
    return v;
}
static int formatBitsValue(int level, int mask) {
    static const int LEVEL_BITS[4] = { 0b01, 0b00, 0b11, 0b10 }; // L M Q H
    const int data = (LEVEL_BITS[level] << 3) | mask;
    return ((data << 10) | polyModDiv(data << 10, 0x537)) ^ 0x5412;
}
static int versionBitsValue(int ver) { return (ver << 12) | polyModDiv(ver << 12, 0x1F25); }

// ---------------------------------------------------------------------------
// 矩阵构建（放置次序与参考实现一致）
// ---------------------------------------------------------------------------
struct QrMatrix {
    int size = 0;
    std::vector<uint8_t> mod; // 1 = 深色
    std::vector<uint8_t> fn;  // 1 = 功能图形
    uint8_t at(int r, int c) const { return mod[static_cast<size_t>(r) * size + c]; }
    uint8_t& m(int r, int c) { return mod[static_cast<size_t>(r) * size + c]; }
    uint8_t f(int r, int c) const { return fn[static_cast<size_t>(r) * size + c]; }
    uint8_t& fset(int r, int c) { return fn[static_cast<size_t>(r) * size + c]; }
};

static void placeFinder(QrMatrix& m, int r0, int c0) {
    for (int r = -1; r <= 7; ++r) for (int c = -1; c <= 7; ++c) {
        const int rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= m.size || cc >= m.size) continue;
        const bool on = (r >= 0 && r <= 6 && (c == 0 || c == 6)) || (c >= 0 && c <= 6 && (r == 0 || r == 6))
            || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        m.m(rr, cc) = on ? 1 : 0;
        m.fset(rr, cc) = 1;
    }
}
static void placeAlign(QrMatrix& m, int r0, int c0) {
    for (int r = -2; r <= 2; ++r) for (int c = -2; c <= 2; ++c) {
        m.m(r0 + r, c0 + c) = (std::max)(std::abs(r), std::abs(c)) != 1 ? 1 : 0;
        m.fset(r0 + r, c0 + c) = 1;
    }
}
static QrMatrix buildFunctionPattern(int ver) {
    QrMatrix m;
    m.size = ver * 4 + 17;
    m.mod.assign(static_cast<size_t>(m.size) * m.size, 0);
    m.fn.assign(static_cast<size_t>(m.size) * m.size, 0);
    placeFinder(m, 0, 0);
    placeFinder(m, 0, m.size - 7);
    placeFinder(m, m.size - 7, 0);
    for (int i = 0; i < m.size; ++i) { // 定位线
        if (!m.f(6, i)) { m.m(6, i) = (i % 2 == 0) ? 1 : 0; m.fset(6, i) = 1; }
        if (!m.f(i, 6)) { m.m(i, 6) = (i % 2 == 0) ? 1 : 0; m.fset(i, 6) = 1; }
    }
    const std::vector<int> ap = alignmentPositions(ver);
    for (size_t a = 0; a < ap.size(); ++a) for (size_t b = 0; b < ap.size(); ++b) {
        const int r = ap[a], c = ap[b];
        if ((r == 6 && c == 6) || (r == 6 && c == m.size - 7) || (r == m.size - 7 && c == 6)) continue;
        placeAlign(m, r, c);
    }
    m.m(m.size - 8, 8) = 1; m.fset(m.size - 8, 8) = 1; // 黑点
    // format 预留（ISO/IEC 18004 与 nayuki 口径：副本一 + 副本二，(8,6)/(6,8) 属 timing 不动）
    for (int i = 0; i <= 5; ++i) m.fset(i, 8) = 1;
    m.fset(7, 8) = 1;
    m.fset(8, 8) = 1;
    m.fset(8, 7) = 1;
    for (int i = 9; i < 15; ++i) m.fset(8, 14 - i) = 1;
    for (int i = 0; i < 8; ++i) m.fset(8, m.size - 1 - i) = 1;
    for (int i = 8; i < 15; ++i) m.fset(m.size - 15 + i, 8) = 1;
    if (ver >= 7) { // version 预留
        for (int i = 0; i < 6; ++i) for (int j = 0; j < 3; ++j) {
            m.fset(m.size - 11 + j, i) = 1;
            m.fset(i, m.size - 11 + j) = 1;
        }
    }
    return m;
}
static void placeData(QrMatrix& m, const std::vector<uint8_t>& stream) {
    size_t i = 0;
    for (int right = m.size - 1; right >= 1; right -= 2) {
        if (right == 6) right = 5;
        for (int vert = 0; vert < m.size; ++vert) {
            for (int j = 0; j < 2; ++j) {
                const int c = right - j;
                const bool upward = ((right + 1) & 2) == 0;
                const int r = upward ? m.size - 1 - vert : vert;
                if (m.f(r, c)) continue;
                m.m(r, c) = i < stream.size() ? stream[i] : 0;
                ++i;
            }
        }
    }
}
static bool maskFormula(int id, int r, int c) {
    switch (id) {
        case 0: return (r + c) % 2 == 0;
        case 1: return r % 2 == 0;
        case 2: return c % 3 == 0;
        case 3: return (r + c) % 3 == 0;
        case 4: return (r / 2 + c / 3) % 2 == 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) == 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 == 0;
        default: return (((r + c) % 2) + ((r * c) % 3)) % 2 == 0;
    }
}
static void applyMask(QrMatrix& m, int mask) {
    for (int r = 0; r < m.size; ++r) for (int c = 0; c < m.size; ++c)
        if (!m.f(r, c) && maskFormula(mask, r, c)) m.m(r, c) ^= 1;
}
static void placeFormat(QrMatrix& m, int bits) {
    const int s = m.size;
    auto setBit = [&m](int row, int col, int bit) { m.m(row, col) = static_cast<uint8_t>(bit); };
    for (int i = 0; i <= 5; ++i) setBit(i, 8, (bits >> i) & 1);
    setBit(7, 8, (bits >> 6) & 1);
    setBit(8, 8, (bits >> 7) & 1);
    setBit(8, 7, (bits >> 8) & 1);
    for (int i = 9; i < 15; ++i) setBit(8, 14 - i, (bits >> i) & 1);
    for (int i = 0; i < 8; ++i) setBit(8, s - 1 - i, (bits >> i) & 1);
    for (int i = 8; i < 15; ++i) setBit(s - 15 + i, 8, (bits >> i) & 1);
    setBit(s - 8, 8, 1); // 黑点
}
static void placeVersion(QrMatrix& m, int bits) {
    for (int i = 0; i < 18; ++i) {
        const int b = (bits >> i) & 1;
        const int r = i / 3, c = i % 3;
        m.m(m.size - 11 + c, r) = static_cast<uint8_t>(b);
        m.m(r, m.size - 11 + c) = static_cast<uint8_t>(b);
    }
}
// 罚分：与参考实现逐规则一致（N4 = floor(|深色占比-50%|/5%) × 10，整数口径）
static long penaltyScore(const QrMatrix& m) {
    const int n = m.size;
    long score = 0;
    auto scanLine = [&](int fixed, bool vertical) {
        int run = 1;
        auto val = [&](int i) { return vertical ? m.at(i, fixed) : m.at(fixed, i); };
        for (int i = 1; i < n; ++i) {
            if (val(i) == val(i - 1)) { ++run; }
            else { if (run >= 5) score += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) score += 3 + (run - 5);
    };
    for (int r = 0; r < n; ++r) scanLine(r, false);
    for (int c = 0; c < n; ++c) scanLine(c, true);
    for (int r = 0; r < n - 1; ++r) for (int c = 0; c < n - 1; ++c) {
        const uint8_t v = m.at(r, c);
        if (v == m.at(r, c + 1) && v == m.at(r + 1, c) && v == m.at(r + 1, c + 1)) score += 3;
    }
    static const int PAT[11] = { 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0 };
    int REV[11];
    for (int i = 0; i < 11; ++i) REV[i] = PAT[10 - i];
    auto test = [&](const int* p, int r, int c0, bool vertical) {
        for (int k = 0; k < 11; ++k) {
            const int v = vertical ? m.at(r + k, c0) : m.at(r, c0 + k);
            if (v != p[k]) return false;
        }
        return true;
    };
    for (int r = 0; r < n; ++r) for (int c = 0; c + 11 <= n; ++c)
        if (test(PAT, r, c, false) || test(REV, r, c, false)) score += 40;
    for (int c = 0; c < n; ++c) for (int r = 0; r + 11 <= n; ++r)
        if (test(PAT, r, c, true) || test(REV, r, c, true)) score += 40;
    long dark = 0;
    for (int r = 0; r < n; ++r) for (int c = 0; c < n; ++c) dark += m.at(r, c);
    const long total = static_cast<long>(n) * n;
    score += (std::labs(dark * 20 - total * 10) / total) * 10;
    return score;
}

// ---------------------------------------------------------------------------
// 编码：模式 / 版本 / 比特流 / 分块交织 / 掩码择优
// ---------------------------------------------------------------------------
enum SegmentMode { MODE_NUMERIC = 1, MODE_ALNUM = 2, MODE_BYTE = 4, MODE_KANJI = 8 };

static const char* ALNUM_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

static bool isNumericText(const std::string& s) {
    if (s.empty()) return false;
    for (char ch : s) if (ch < '0' || ch > '9') return false;
    return true;
}
static bool isAlnumText(const std::string& s) {
    if (s.empty()) return false;
    for (char ch : s) if (!std::strchr(ALNUM_CHARSET, ch)) return false;
    return true;
}
static int charCountBits(int mode, int ver) {
    if (ver <= 9) return mode == MODE_NUMERIC ? 10 : mode == MODE_ALNUM ? 9 : mode == MODE_KANJI ? 8 : 8;
    if (ver <= 26) return mode == MODE_NUMERIC ? 12 : mode == MODE_ALNUM ? 11 : mode == MODE_KANJI ? 10 : 16;
    return mode == MODE_NUMERIC ? 14 : mode == MODE_ALNUM ? 13 : mode == MODE_KANJI ? 12 : 16;
}

struct EncodeResult {
    int version = 0;
    int mask = 0;
    int level = 1;
    int mode = MODE_BYTE;
    int size = 0;      // 单边模块数
    int codewords = 0;
    long penalty = 0;
    std::vector<uint8_t> matrix; // size*size，1=深色
};

struct EncodeOptions {
    int level = 1;        // 0=L 1=M 2=Q 3=H
    int forceVersion = 0; // 0=自动
    int forceMode = 0;    // 0=自动，否则 MODE_*
};

static int chooseMode(const std::string& utf8, int forced) {
    if (forced) return forced;
    if (isNumericText(utf8)) return MODE_NUMERIC;
    if (isAlnumText(utf8)) return MODE_ALNUM;
    return MODE_BYTE;
}

static bool payloadFits(const std::string& utf8, int mode, int ver, int level) {
    const long bytes = static_cast<long>(utf8.size());
    long bits = 4 + charCountBits(mode, ver);
    switch (mode) {
        case MODE_NUMERIC: {
            bits += (bytes / 3) * 10;
            const long rem = bytes % 3;
            if (rem == 1) bits += 4;
            else if (rem == 2) bits += 7;
            break;
        }
        case MODE_ALNUM: {
            bits += (bytes / 2) * 11;
            if (bytes % 2) bits += 6;
            break;
        }
        default:
            bits += bytes * 8;
            break;
    }
    return bits <= static_cast<long>(dataCodewords(ver, level)) * 8;
}

static int chooseVersion(const std::string& utf8, int mode, int level, int forced) {
    if (forced >= 1 && forced <= 40) {
        if (!payloadFits(utf8, mode, forced, level)) return -1;
        return forced;
    }
    for (int v = 1; v <= 40; ++v) if (payloadFits(utf8, mode, v, level)) return v;
    return -1;
}

static void pushBits(std::vector<uint8_t>& bits, unsigned value, int n) {
    for (int i = n - 1; i >= 0; --i) bits.push_back(static_cast<uint8_t>((value >> i) & 1));
}

static std::vector<uint8_t> buildDataStream(const std::string& utf8, int mode, int ver, int capBytes) {
    std::vector<uint8_t> bits;
    pushBits(bits, static_cast<unsigned>(mode), 4);
    pushBits(bits, static_cast<unsigned>(utf8.size()), charCountBits(mode, ver));
    if (mode == MODE_NUMERIC) {
        size_t i = 0;
        for (; i + 3 <= utf8.size(); i += 3) {
            const unsigned v = static_cast<unsigned>(utf8[i] - '0') * 100
                + static_cast<unsigned>(utf8[i + 1] - '0') * 10
                + static_cast<unsigned>(utf8[i + 2] - '0');
            pushBits(bits, v, 10);
        }
        const size_t rem = utf8.size() - i;
        if (rem == 1) pushBits(bits, static_cast<unsigned>(utf8[i] - '0'), 4);
        else if (rem == 2) pushBits(bits, static_cast<unsigned>(utf8[i] - '0') * 10 + static_cast<unsigned>(utf8[i + 1] - '0'), 7);
    } else if (mode == MODE_ALNUM) {
        auto indexOf = [](char ch) -> unsigned {
            const char* p = std::strchr(ALNUM_CHARSET, ch);
            return p ? static_cast<unsigned>(p - ALNUM_CHARSET) : 0;
        };
        size_t i = 0;
        for (; i + 2 <= utf8.size(); i += 2) pushBits(bits, indexOf(utf8[i]) * 45 + indexOf(utf8[i + 1]), 11);
        if (i < utf8.size()) pushBits(bits, indexOf(utf8[i]), 6);
    } else {
        for (char ch : utf8) pushBits(bits, static_cast<unsigned char>(ch), 8);
    }
    const size_t capBits = static_cast<size_t>(capBytes) * 8;
    const size_t term = (std::min)(static_cast<size_t>(4), capBits - bits.size());
    pushBits(bits, 0, static_cast<int>(term));
    while (bits.size() % 8) bits.push_back(0);
    size_t pad = 0;
    while (bits.size() < capBits) { pushBits(bits, (pad % 2) ? 0x11u : 0xECu, 8); ++pad; }
    return bits;
}

static std::vector<uint8_t> interleave(const std::string& utf8, int mode, int ver, int level) {
    const int ecc = ECC_PER_BLOCK[level][ver];
    const int blocks = NUM_BLOCKS[level][ver];
    const int dataTotal = dataCodewords(ver, level);
    const int shortLen = dataTotal / blocks;
    const int longCount = dataTotal - shortLen * blocks;
    const std::vector<uint8_t> bits = buildDataStream(utf8, mode, ver, dataTotal);
    std::vector<uint8_t> dataBytes;
    for (size_t i = 0; i + 8 <= bits.size(); i += 8) {
        unsigned b = 0;
        for (int k = 0; k < 8; ++k) b = (b << 1) | bits[i + k];
        dataBytes.push_back(static_cast<uint8_t>(b));
    }
    std::vector<std::vector<uint8_t>> blockData(blocks);
    std::vector<std::vector<uint8_t>> blockEcc(blocks);
    size_t off = 0;
    for (int b = 0; b < blocks; ++b) {
        const int len = b < blocks - longCount ? shortLen : shortLen + 1;
        std::vector<uint8_t> part(dataBytes.begin() + off, dataBytes.begin() + off + len);
        off += len;
        blockEcc[b] = rsEncodeRemainder(part, ecc);
        blockData[b] = std::move(part);
    }
    std::vector<uint8_t> out;
    out.reserve(static_cast<size_t>(dataTotal + blocks * ecc));
    for (int i = 0; i < shortLen + 1; ++i)
        for (int b = 0; b < blocks; ++b)
            if (i < static_cast<int>(blockData[b].size())) out.push_back(blockData[b][i]);
    for (int i = 0; i < ecc; ++i)
        for (int b = 0; b < blocks; ++b) out.push_back(blockEcc[b][i]);
    return out;
}

static bool encodeQrInternal(const std::string& utf8, const EncodeOptions& opt, EncodeResult& out, std::wstring& err) {
    if (utf8.empty()) { err = L"内容为空，无法生成二维码。"; return false; }
    if (utf8.size() > 4096) { err = L"内容过长（UTF-8 超过 4096 字节），超出二维码容量。"; return false; }
    if (opt.level < 0 || opt.level > 3) { err = L"纠错级别无效，只允许 L、M、Q、H。"; return false; }
    const int mode = chooseMode(utf8, opt.forceMode);
    const int ver = chooseVersion(utf8, mode, opt.level, opt.forceVersion);
    if (ver < 0) {
        if (opt.forceVersion >= 1)
            err = L"指定版本 " + std::to_wstring(opt.forceVersion) + L" 装不下当前内容，请降低纠错级别或允许自动选版。";
        else
            err = L"内容超出 40-H 版本容量（最长约 1273 字节），无法生成二维码。";
        return false;
    }
    const std::vector<uint8_t> cw = interleave(utf8, mode, ver, opt.level);
    if (static_cast<int>(cw.size()) != totalCodewords(ver)) { err = L"内部错误：码字总数不一致。"; return false; }
    std::vector<uint8_t> stream;
    stream.reserve(cw.size() * 8);
    for (uint8_t b : cw) pushBits(stream, b, 8);
    QrMatrix best;
    int bestMask = 0;
    long bestPenalty = 0;
    for (int mask = 0; mask < 8; ++mask) {
        QrMatrix m = buildFunctionPattern(ver);
        placeData(m, stream);
        applyMask(m, mask);
        placeFormat(m, formatBitsValue(opt.level, mask));
        if (ver >= 7) placeVersion(m, versionBitsValue(ver));
        const long p = penaltyScore(m);
        if (mask == 0 || p < bestPenalty) {
            bestPenalty = p;
            bestMask = mask;
            best = std::move(m);
        }
    }
    out.version = ver;
    out.mask = bestMask;
    out.level = opt.level;
    out.mode = mode;
    out.size = best.size;
    out.penalty = bestPenalty;
    out.codewords = static_cast<int>(cw.size());
    out.matrix = std::move(best.mod);
    return true;
}

// ---------------------------------------------------------------------------
// 解码公共尾段：format → 去掩码 → 读码字 → 反交织 → RS → 分段解析
// ---------------------------------------------------------------------------
static const char* LEVEL_NAMES[4] = { "L", "M", "Q", "H" };
static const wchar_t* LEVEL_WNAMES[4] = { L"L", L"M", L"Q", L"H" };

struct DecodeOutput {
    std::string utf8;
    std::vector<uint8_t> raw;
    int version = 0;
    int mask = -1;
    int level = -1;
    int mode = 0;
    int corrected = 0;
};

static int hammingDistance(int a, int b) {
    int x = a ^ b, d = 0;
    while (x) { d += x & 1; x >>= 1; }
    return d;
}

// 从 15 位 format 原始值反推级别与掩码（对 32 个合法值取最小汉明距离，≤3 才接受）
static bool hammingDecodeFormat(int raw15, int& level, int& mask) {
    int bestDist = 99;
    int bestData = -1;
    for (int lv = 0; lv < 4; ++lv) for (int mk = 0; mk < 8; ++mk) {
        const int candidate = formatBitsValue(lv, mk);
        const int dist = hammingDistance(candidate, raw15);
        if (dist < bestDist) { bestDist = dist; bestData = (lv << 3) | mk; }
    }
    if (bestDist > 3) return false;
    level = bestData >> 3;
    mask = bestData & 7;
    return true;
}

// 从已重采样的 size×size 位矩阵（1=深色）解出内容
static bool decodeMatrix(int size, const std::vector<uint8_t>& bits, DecodeOutput& out, std::wstring& err) {
    const int ver = (size - 17) / 4;
    if (ver < 1 || ver > 40 || ver * 4 + 17 != size) { err = L"二维码尺寸非法。"; return false; }
    // 读 format（两份，任一份通过即可）
    int raw1 = 0, raw2 = 0;
    for (int i = 0; i < 15; ++i) {
        int b1 = 0, b2 = 0;
        if (i <= 5) b1 = bits[static_cast<size_t>(i) * size + 8];
        else if (i == 6) b1 = bits[static_cast<size_t>(7) * size + 8];
        else if (i == 7) b1 = bits[static_cast<size_t>(8) * size + 8];
        else if (i == 8) b1 = bits[static_cast<size_t>(8) * size + 7];
        else b1 = bits[static_cast<size_t>(8) * size + (14 - i)];
        if (i <= 7) b2 = bits[static_cast<size_t>(8) * size + (size - 1 - i)];
        else b2 = bits[static_cast<size_t>(size - 15 + i) * size + 8];
        raw1 |= b1 << i;
        raw2 |= b2 << i;
    }
    int level = -1, mask = -1;
    if (!hammingDecodeFormat(raw1, level, mask) && !hammingDecodeFormat(raw2, level, mask)) {
        err = L"格式信息损坏：无法从 format 区恢复纠错级别与掩码号。";
        return false;
    }
    out.level = level;
    out.mask = mask;
    // 重建功能图形表并去掩码
    QrMatrix m = buildFunctionPattern(ver);
    std::vector<uint8_t> grid(static_cast<size_t>(size) * size, 0);
    for (int r = 0; r < size; ++r) for (int c = 0; c < size; ++c) {
        uint8_t v = bits[static_cast<size_t>(r) * size + c];
        if (!m.f(r, c) && maskFormula(mask, r, c)) v ^= 1;
        grid[static_cast<size_t>(r) * size + c] = v;
    }
    // 蛇形读码字
    const int total = totalCodewords(ver);
    std::vector<uint8_t> stream;
    stream.reserve(static_cast<size_t>(total) * 8);
    for (int right = size - 1; right >= 1; right -= 2) {
        if (right == 6) right = 5;
        for (int vert = 0; vert < size; ++vert) {
            for (int j = 0; j < 2; ++j) {
                const int c = right - j;
                const bool upward = ((right + 1) & 2) == 0;
                const int r = upward ? size - 1 - vert : vert;
                if (m.f(r, c)) continue;
                stream.push_back(grid[static_cast<size_t>(r) * size + c]);
            }
        }
    }
    std::vector<uint8_t> cw;
    cw.reserve(total);
    for (size_t i = 0; i + 8 <= stream.size() && static_cast<int>(cw.size()) < total; i += 8) {
        unsigned b = 0;
        for (int k = 0; k < 8; ++k) b = (b << 1) | stream[i + k];
        cw.push_back(static_cast<uint8_t>(b));
    }
    // 反交织 + RS 纠错
    const int ecc = ECC_PER_BLOCK[level][ver];
    const int blocks = NUM_BLOCKS[level][ver];
    const int dataTotal = dataCodewords(ver, level);
    const int shortLen = dataTotal / blocks;
    const int longCount = dataTotal - shortLen * blocks;
    std::vector<std::vector<uint8_t>> blockData(blocks);
    std::vector<std::vector<uint8_t>> blockEcc(blocks);
    size_t pos = 0;
    for (int i = 0; i < shortLen + 1; ++i)
        for (int b = 0; b < blocks; ++b)
            if (i < shortLen + (b < blocks - longCount ? 0 : 1)) blockData[b].push_back(cw[pos++]);
    for (int i = 0; i < ecc; ++i)
        for (int b = 0; b < blocks; ++b) blockEcc[b].push_back(cw[pos++]);
    int corrected = 0;
    for (int b = 0; b < blocks; ++b) {
        std::vector<uint8_t> full = blockData[b];
        full.insert(full.end(), blockEcc[b].begin(), blockEcc[b].end());
        const int fixed = rsDecode(full, ecc);
        if (fixed < 0) {
            err = L"纠错失败：码字损伤超出该纠错级别的能力（块 " + std::to_wstring(b + 1) + L"/" + std::to_wstring(blocks) + L"）。";
            return false;
        }
        corrected += fixed;
        blockData[b].assign(full.begin(), full.begin() + (full.size() - ecc));
    }
    out.corrected = corrected;
    // 数据比特流
    std::vector<uint8_t> dataBits;
    dataBits.reserve(static_cast<size_t>(dataTotal) * 8);
    for (int b = 0; b < blocks; ++b)
        for (uint8_t byte : blockData[b])
            for (int k = 7; k >= 0; --k) dataBits.push_back(static_cast<uint8_t>((byte >> k) & 1));
    // 分段解析
    size_t p = 0;
    auto readBits = [&](int count) -> unsigned {
        unsigned v = 0;
        for (int i = 0; i < count && p < dataBits.size(); ++i) v = (v << 1) | dataBits[p++];
        return v;
    };
    const size_t totalBits = dataBits.size();
    std::string text;
    std::vector<uint8_t> rawBytes;
    int firstMode = 0;
    while (p + 4 <= totalBits) {
        const unsigned mode = readBits(4);
        if (mode == 0) break; // 终止符
        const int cbits = charCountBits(static_cast<int>(mode), ver);
        if (p + cbits > totalBits) break;
        const unsigned count = readBits(cbits);
        if (!firstMode) firstMode = static_cast<int>(mode);
        const size_t textStart = text.size();
        if (mode == MODE_NUMERIC) {
            unsigned i = 0;
            for (; i + 3 <= count && p + 10 <= totalBits; i += 3) {
                const unsigned v = readBits(10);
                text += static_cast<char>('0' + (v / 100) % 10);
                text += static_cast<char>('0' + (v / 10) % 10);
                text += static_cast<char>('0' + v % 10);
            }
            if (count - i == 2 && p + 7 <= totalBits) {
                const unsigned v = readBits(7);
                text += static_cast<char>('0' + (v / 10) % 10);
                text += static_cast<char>('0' + v % 10);
            } else if (count - i == 1 && p + 4 <= totalBits) {
                text += static_cast<char>('0' + (readBits(4) % 10));
            }
            for (size_t ti = textStart; ti < text.size(); ++ti) rawBytes.push_back(static_cast<uint8_t>(text[ti]));
        } else if (mode == MODE_ALNUM) {
            unsigned i = 0;
            for (; i + 2 <= count && p + 11 <= totalBits; i += 2) {
                const unsigned v = readBits(11);
                text += ALNUM_CHARSET[v / 45];
                text += ALNUM_CHARSET[v % 45];
            }
            if (i < count && p + 6 <= totalBits) text += ALNUM_CHARSET[readBits(6) % 45];
            for (size_t ti = textStart; ti < text.size(); ++ti) rawBytes.push_back(static_cast<uint8_t>(text[ti]));
        } else if (mode == MODE_BYTE) {
            for (unsigned i = 0; i < count && p + 8 <= totalBits; ++i) {
                const uint8_t byte = static_cast<uint8_t>(readBits(8));
                rawBytes.push_back(byte);
                text.push_back(static_cast<char>(byte));
            }
        } else if (mode == MODE_KANJI) {
            for (unsigned i = 0; i < count && p + 13 <= totalBits; ++i) {
                const unsigned d = readBits(13);
                const unsigned sjis = d >= 0x1F00u ? d + 0xC140u : d + 0x8140u;
                const unsigned char sj[2] = { static_cast<unsigned char>(sjis >> 8), static_cast<unsigned char>(sjis & 0xFF) };
                wchar_t wide[4] = {};
                const int got = MultiByteToWideChar(932, 0, reinterpret_cast<const char*>(sj), 2, wide, 4);
                if (got > 0) {
                    char u8[8] = {};
                    const int need = WideCharToMultiByte(CP_UTF8, 0, wide, got, u8, sizeof(u8), nullptr, nullptr);
                    if (need > 0) text.append(u8, static_cast<size_t>(need));
                }
                rawBytes.push_back(sj[0]);
                rawBytes.push_back(sj[1]);
            }
        } else if (mode == 7) { // ECI：跳过 8 位分配号
            if (p + 8 > totalBits) break;
            readBits(8);
        } else {
            break; // 保留模式
        }
    }
    out.utf8 = text;
    out.raw = rawBytes;
    out.mode = firstMode;
    out.version = ver;
    return true;
}

// ---------------------------------------------------------------------------
// 大津阈值 / 自适应阈值
// ---------------------------------------------------------------------------
static int otsuThreshold(const GrayImage& img) {
    long hist[256] = {};
    for (unsigned char v : img.px) ++hist[v];
    const long total = static_cast<long>(img.px.size());
    long sum = 0;
    for (int i = 0; i < 256; ++i) sum += static_cast<long>(i) * hist[i];
    long sumB = 0, wB = 0;
    double bestVar = -1.0;
    int threshold = 127;
    for (int t = 0; t < 256; ++t) {
        wB += hist[t];
        if (wB == 0) continue;
        const long wF = total - wB;
        if (wF == 0) break;
        sumB += static_cast<long>(t) * hist[t];
        const double mB = static_cast<double>(sumB) / wB;
        const double mF = static_cast<double>(sum - sumB) / wF;
        const double between = static_cast<double>(wB) * wF * (mB - mF) * (mB - mF);
        if (between > bestVar) { bestVar = between; threshold = t; }
    }
    return threshold;
}

static void binarizeOtsu(const GrayImage& img, std::vector<uint8_t>& bin) {
    const int threshold = otsuThreshold(img);
    bin.resize(img.px.size());
    for (size_t i = 0; i < img.px.size(); ++i) bin[i] = img.px[i] <= threshold ? 1 : 0;
}

static void binarizeAdaptive(const GrayImage& img, std::vector<uint8_t>& bin) {
    bin.resize(img.px.size());
    std::vector<double> integral(static_cast<size_t>(img.w + 1) * (img.h + 1), 0.0);
    for (int y = 0; y < img.h; ++y)
        for (int x = 0; x < img.w; ++x)
            integral[static_cast<size_t>(y + 1) * (img.w + 1) + x + 1] = img.px[static_cast<size_t>(y) * img.w + x]
                + integral[static_cast<size_t>(y) * (img.w + 1) + x + 1]
                + integral[static_cast<size_t>(y + 1) * (img.w + 1) + x]
                - integral[static_cast<size_t>(y) * (img.w + 1) + x];
    int win = (std::min)(img.w, img.h) / 16;
    if (win < 9) win = 9;
    for (int y = 0; y < img.h; ++y) for (int x = 0; x < img.w; ++x) {
        const int x0 = (std::max)(0, x - win), y0 = (std::max)(0, y - win);
        const int x1 = (std::min)(img.w - 1, x + win), y1 = (std::min)(img.h - 1, y + win);
        const double area = static_cast<double>((x1 - x0 + 1) * (y1 - y0 + 1));
        const double sum = integral[static_cast<size_t>(y1 + 1) * (img.w + 1) + x1 + 1]
            - integral[static_cast<size_t>(y0) * (img.w + 1) + x1 + 1]
            - integral[static_cast<size_t>(y1 + 1) * (img.w + 1) + x0]
            + integral[static_cast<size_t>(y0) * (img.w + 1) + x0];
        bin[static_cast<size_t>(y) * img.w + x] = img.px[static_cast<size_t>(y) * img.w + x] < sum / area * 0.92 ? 1 : 0;
    }
}

// ---------------------------------------------------------------------------
// 定位：游程 1:1:3:1:1 找定位图形 → 三点配对 → 单应重采样
// ---------------------------------------------------------------------------
struct FinderHit {
    double x = 0, y = 0, unit = 0;
};
struct Quad {
    int x[4] = {};
    int y[4] = {}; // 0左上 1右上 2右下 3左下
};

struct Homography {
    double h[9] = { 1, 0, 0, 0, 1, 0, 0, 0, 1 };
    void map(double mx, double my, double& ox, double& oy) const {
        const double d = h[6] * mx + h[7] * my + h[8];
        ox = (h[0] * mx + h[1] * my + h[2]) / d;
        oy = (h[3] * mx + h[4] * my + h[5]) / d;
    }
};

// 在二值图（1=深色）的每一行按游程找 浅-深-浅-深-浅 且比例 1:1:3:1:1 的候选
static void scanRowFinders(const std::vector<uint8_t>& bin, int w, int h, std::vector<FinderHit>& hits) {
    std::vector<int> runs;
    std::vector<int> starts;
    for (int y = 0; y < h; ++y) {
        runs.clear();
        starts.clear();
        int runLen = 1;
        int runVal = bin[static_cast<size_t>(y) * w];
        starts.push_back(0);
        for (int x = 1; x < w; ++x) {
            const int v = bin[static_cast<size_t>(y) * w + x];
            if (v == runVal) { ++runLen; }
            else {
                runs.push_back(runVal ? runLen : -runLen); // 深=正，浅=负
                runVal = v;
                runLen = 1;
                starts.push_back(x);
            }
        }
        runs.push_back(runVal ? runLen : -runLen);
        for (size_t i = 0; i + 4 < runs.size(); ++i) {
            if (!(runs[i] > 0 && runs[i + 1] < 0 && runs[i + 2] > 0 && runs[i + 3] < 0 && runs[i + 4] > 0)) continue; // 深-浅-深-浅-深
            const double parts[5] = { fabs(static_cast<double>(runs[i])), fabs(static_cast<double>(runs[i + 1])),
                fabs(static_cast<double>(runs[i + 2])), fabs(static_cast<double>(runs[i + 3])),
                fabs(static_cast<double>(runs[i + 4])) };
            const double total = parts[0] + parts[1] + parts[2] + parts[3] + parts[4];
            if (total < 6.9) continue; // 允许 1 像素/模块的干净矩阵直解
            const double unit = total / 7.0;
            static const double ideal[5] = { 1, 1, 3, 1, 1 };
            bool ok = true;
            for (int k = 0; k < 5; ++k)
                if (parts[k] < ideal[k] * unit * 0.55 || parts[k] > ideal[k] * unit * 1.45) { ok = false; break; }
            if (!ok) continue;
            const double cx = starts[i] + parts[0] + parts[1] + parts[2] / 2.0;
            hits.push_back({ cx, static_cast<double>(y) + 0.5, unit });
        }
    }
}

// 竖向 1:1:3:1:1 交叉校验
static bool verticalCrossCheck(const std::vector<uint8_t>& bin, int w, int h, double x, double y, double unit) {
    const int cx = static_cast<int>(x + 0.5);
    const int y0 = (std::max)(0, static_cast<int>(y - unit * 4 - 2));
    const int y1 = (std::min)(h - 1, static_cast<int>(y + unit * 4 + 2));
    if (y1 - y0 < 7) return false;
    std::vector<int> runs;
    int runLen = 1;
    int runVal = bin[static_cast<size_t>(y0) * w + cx];
    for (int yy = y0 + 1; yy <= y1; ++yy) {
        const int v = bin[static_cast<size_t>(yy) * w + cx];
        if (v == runVal) { ++runLen; }
        else { runs.push_back(runVal ? runLen : -runLen); runVal = v; runLen = 1; }
    }
    runs.push_back(runVal ? runLen : -runLen);
    for (size_t i = 0; i + 4 < runs.size(); ++i) {
        if (!(runs[i] > 0 && runs[i + 1] < 0 && runs[i + 2] > 0 && runs[i + 3] < 0 && runs[i + 4] > 0)) continue; // 深-浅-深-浅-深
        const double total = fabs(static_cast<double>(runs[i])) + fabs(static_cast<double>(runs[i + 1]))
            + fabs(static_cast<double>(runs[i + 2])) + fabs(static_cast<double>(runs[i + 3]))
            + fabs(static_cast<double>(runs[i + 4]));
        const double u = total / 7.0;
        if (u < unit * 0.5 || u > unit * 2.0) continue;
        static const double ideal[5] = { 1, 1, 3, 1, 1 };
        const double parts[5] = { fabs(static_cast<double>(runs[i])), fabs(static_cast<double>(runs[i + 1])),
            fabs(static_cast<double>(runs[i + 2])), fabs(static_cast<double>(runs[i + 3])),
            fabs(static_cast<double>(runs[i + 4])) };
        bool ok = true;
        for (int k = 0; k < 5; ++k)
            if (parts[k] < ideal[k] * u * 0.55 || parts[k] > ideal[k] * u * 1.45) { ok = false; break; }
        if (ok) return true;
    }
    return false;
}

static bool solveHomography4(const double src[4][2], const double dst[4][2], Homography& out) {
    double A[8][9] = {};
    for (int i = 0; i < 4; ++i) {
        const double x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
        A[i * 2][0] = x; A[i * 2][1] = y; A[i * 2][2] = 1; A[i * 2][6] = -u * x; A[i * 2][7] = -u * y; A[i * 2][8] = u;
        A[i * 2 + 1][3] = x; A[i * 2 + 1][4] = y; A[i * 2 + 1][5] = 1; A[i * 2 + 1][6] = -v * x; A[i * 2 + 1][7] = -v * y; A[i * 2 + 1][8] = v;
    }
    for (int col = 0; col < 8; ++col) {
        int pivot = col;
        for (int r = col + 1; r < 8; ++r) if (fabs(A[r][col]) > fabs(A[pivot][col])) pivot = r;
        if (fabs(A[pivot][col]) < 1e-9) return false;
        if (pivot != col) for (int k = col; k < 9; ++k) std::swap(A[col][k], A[pivot][k]);
        for (int r = 0; r < 8; ++r) {
            if (r == col) continue;
            const double f = A[r][col] / A[col][col];
            if (f == 0.0) continue;
            for (int k = col; k < 9; ++k) A[r][k] -= f * A[col][k];
        }
    }
    for (int i = 0; i < 8; ++i) {
        if (fabs(A[i][i]) < 1e-12) return false;
        out.h[i] = A[i][8] / A[i][i];
    }
    out.h[8] = 1.0;
    return true;
}

struct Localization {
    int size = 0;     // 单边模块数 N
    Homography h;     // 模块坐标 → 像素坐标
    Quad quad;        // 符号外接四角（像素）
};

// 由三个定位图形中心 + 第 4 点（对齐图形搜索或平行四边形估计）解单应
static bool buildHomographyFor(const GrayImage& img, const std::vector<uint8_t>& bin,
                               const FinderHit& tl, const FinderHit& tr, const FinderHit& bl,
                               int n, Localization& loc) {
    const int ver = (n - 17) / 4;
    // 模块坐标中心的对应像素
    const double msrc[3][2] = { { 3.5, 3.5 }, { n - 3.5, 3.5 }, { 3.5, n - 3.5 } };
    const double mdst[3][2] = { { tl.x, tl.y }, { tr.x, tr.y }, { bl.x, bl.y } };
    // 仿射初值（模块 → 像素）：以第一点为原点解 2×2
    double a11, a12, a21, a22, a13, a23;
    {
        const double e1x = msrc[1][0] - msrc[0][0], e1y = msrc[1][1] - msrc[0][1];
        const double e2x = msrc[2][0] - msrc[0][0], e2y = msrc[2][1] - msrc[0][1];
        const double p1x = mdst[1][0] - mdst[0][0], p1y = mdst[1][1] - mdst[0][1];
        const double p2x = mdst[2][0] - mdst[0][0], p2y = mdst[2][1] - mdst[0][1];
        const double det = e1x * e2y - e1y * e2x;
        if (fabs(det) < 1e-9) return false;
        a11 = (p1x * e2y - p2x * e1y) / det;
        a12 = (p2x * e1x - p1x * e2x) / det;
        a21 = (p1y * e2y - p2y * e1y) / det;
        a22 = (p2y * e1x - p1y * e2x) / det;
        a13 = mdst[0][0] - a11 * msrc[0][0] - a12 * msrc[0][1];
        a23 = mdst[0][1] - a21 * msrc[0][0] - a22 * msrc[0][1];
    }
    double src4[4][2] = { { 3.5, 3.5 }, { n - 3.5, 3.5 }, { 3.5, n - 3.5 }, { n - 3.5, n - 3.5 } };
    double dst4[4][2] = { { tl.x, tl.y }, { tr.x, tr.y }, { bl.x, bl.y },
        { tr.x + bl.x - tl.x, tr.y + bl.y - tl.y } }; // 平行四边形估计
    if (ver >= 2) { // 版本 ≥2 才有对齐图形：在期望位置 ±2 模块内做 5×5 理想图案匹配
        const std::vector<int> ap = alignmentPositions(ver);
        const double am = static_cast<double>(ap.back()) + 0.5;
        const double expX = a11 * am + a12 * am + a13;
        const double expY = a21 * am + a22 * am + a23;
        const double unitAvg = (tl.unit + tr.unit + bl.unit) / 3.0;
        static const int IDEAL[5][5] = { { 1, 1, 1, 1, 1 }, { 1, 0, 0, 0, 1 }, { 1, 0, 1, 0, 1 }, { 1, 0, 0, 0, 1 }, { 1, 1, 1, 1, 1 } };
        double bestScore = -1.0, bestDist2 = 1e18, bestX = expX, bestY = expY;
        for (double dy = -2.0; dy <= 2.001; dy += 0.5) for (double dx = -2.0; dx <= 2.001; dx += 0.5) {
            const double cx = expX + dx * unitAvg, cy = expY + dy * unitAvg;
            int score = 0;
            for (int py = -2; py <= 2; ++py) for (int px = -2; px <= 2; ++px) {
                const double sx = cx + px * unitAvg, sy = cy + py * unitAvg;
                if (sx < 0 || sy < 0 || sx > img.w - 1 || sy > img.h - 1) continue;
                // 用二值图 floor 取样：模块中心采样不受跨像素均值干扰
                const int dark = bin[static_cast<size_t>(static_cast<int>(sy)) * img.w + static_cast<int>(sx)] ? 1 : 0;
                if (dark == IDEAL[py + 2][px + 2]) ++score;
            }
            const double dist2 = (cx - expX) * (cx - expX) + (cy - expY) * (cy - expY);
            if (score > bestScore || (score == bestScore && dist2 < bestDist2)) {
                bestScore = static_cast<double>(score);
                bestDist2 = dist2;
                bestX = cx;
                bestY = cy;
            }
        }
        if (lbqrDbg) std::fprintf(stderr, "[align] expected=(%.1f,%.1f) best=(%.1f,%.1f) score=%.0f/25\n", expX, expY, bestX, bestY, bestScore);
        if (bestScore >= 20.0) {
            src4[3][0] = am;
            src4[3][1] = am;
            dst4[3][0] = bestX;
            dst4[3][1] = bestY;
        }
    }
    Homography h;
    if (!solveHomography4(src4, dst4, h)) return false;
    loc.size = n;
    loc.h = h;
    const double corners[4][2] = { { 0, 0 }, { static_cast<double>(n), 0 },
        { static_cast<double>(n), static_cast<double>(n) }, { 0, static_cast<double>(n) } };
    for (int i = 0; i < 4; ++i) {
        double ox, oy;
        h.map(corners[i][0], corners[i][1], ox, oy);
        loc.quad.x[i] = static_cast<int>(ox + 0.5);
        loc.quad.y[i] = static_cast<int>(oy + 0.5);
    }
    return true;
}

// 聚类：合并横向扫描出的相邻候选
static void clusterHits(const std::vector<FinderHit>& verified, std::vector<FinderHit>& clusters) {
    std::vector<int> ccount;
    for (const FinderHit& f : verified) {
        bool merged = false;
        for (size_t i = 0; i < clusters.size(); ++i) {
            const double dx = clusters[i].x - f.x, dy = clusters[i].y - f.y;
            if (sqrt(dx * dx + dy * dy) < f.unit * 2.5
                && fabs(clusters[i].unit - f.unit) < 0.35 * (std::max)(clusters[i].unit, f.unit)) {
                clusters[i].x = (clusters[i].x * ccount[i] + f.x) / (ccount[i] + 1);
                clusters[i].y = (clusters[i].y * ccount[i] + f.y) / (ccount[i] + 1);
                clusters[i].unit = (clusters[i].unit * ccount[i] + f.unit) / (ccount[i] + 1);
                ++ccount[i];
                merged = true;
                break;
            }
        }
        if (!merged) {
            clusters.push_back(f);
            ccount.push_back(1);
        }
    }
}

// 主识别入口：灰度图 → 定位 → 重采样 → 解码
static bool decodeGrayPasses(const GrayImage& img, DecodeOutput& out,
                             int& findersOut, Quad& quadOut, std::wstring& err) {
    std::vector<uint8_t> bin;
    for (int pass = 0; pass < 2; ++pass) {
        if (pass == 0) binarizeOtsu(img, bin);
        else binarizeAdaptive(img, bin);
        std::vector<FinderHit> hits;
        scanRowFinders(bin, img.w, img.h, hits);
        std::vector<FinderHit> verified;
        for (const FinderHit& f : hits)
            if (verticalCrossCheck(bin, img.w, img.h, f.x, f.y, f.unit)) verified.push_back(f);
        std::vector<FinderHit> clusters;
        clusterHits(verified, clusters);
        findersOut = static_cast<int>(clusters.size());
        if (clusters.size() < 3) {
            if (pass == 0) continue;
            err = L"未识别到二维码：图像中找不到三个定位图形（可能没有二维码或损伤过重）。";
            return false;
        }
        struct Candidate {
            Localization loc;
            double score;
        };
        std::vector<Candidate> candidates;
        const int cn = static_cast<int>(clusters.size());
        for (int a = 0; a < cn; ++a) for (int b = a + 1; b < cn; ++b) for (int c = b + 1; c < cn; ++c) {
            const FinderHit* pts[3] = { &clusters[a], &clusters[b], &clusters[c] };
            int tlIdx = 0;
            double bestCos = 1e9;
            for (int t = 0; t < 3; ++t) {
                const int i1 = (t + 1) % 3, i2 = (t + 2) % 3;
                const double v1x = pts[i1]->x - pts[t]->x, v1y = pts[i1]->y - pts[t]->y;
                const double v2x = pts[i2]->x - pts[t]->x, v2y = pts[i2]->y - pts[t]->y;
                const double cosv = fabs(v1x * v2x + v1y * v2y)
                    / (sqrt(v1x * v1x + v1y * v1y) * sqrt(v2x * v2x + v2y * v2y) + 1e-9);
                if (cosv < bestCos) { bestCos = cosv; tlIdx = t; }
            }
            const int i1 = (tlIdx + 1) % 3, i2 = (tlIdx + 2) % 3;
            const FinderHit& T = *pts[tlIdx];
            const FinderHit& P = *pts[i1];
            const FinderHit& Q = *pts[i2];
            const double cross = (P.x - T.x) * (Q.y - T.y) - (P.y - T.y) * (Q.x - T.x);
            const FinderHit& trHit = cross > 0 ? P : Q; // 图像坐标 y 向下：P 在 x 轴方向即右上
            const FinderHit& blHit = cross > 0 ? Q : P;
            const double dTR = sqrt((trHit.x - T.x) * (trHit.x - T.x) + (trHit.y - T.y) * (trHit.y - T.y));
            const double dBL = sqrt((blHit.x - T.x) * (blHit.x - T.x) + (blHit.y - T.y) * (blHit.y - T.y));
            const double unitAvg = (T.unit + trHit.unit + blHit.unit) / 3.0;
            const int nBase = static_cast<int>(dTR / unitAvg + 0.5) + 7;
            const int n2 = static_cast<int>(dBL / unitAvg + 0.5) + 7;
            // 缩放/模糊下 unit 估计有偏，对版本数做 ±4（±1 版）容差；n2 差超过一版才淘汰
            const double ratio = dTR / (dBL + 1e-9);
            if (ratio < 0.85 || ratio > 1.18) continue;
            if (std::abs(nBase - n2) > 4) continue;
            for (int nTry = nBase - 4; nTry <= nBase + 4; nTry += 4) {
                if (nTry < 21 || nTry > 177 || (nTry - 17) % 4 != 0) continue;
                if (lbqrDbg) std::fprintf(stderr, "[cand] nTry=%d (base=%d n2=%d ratio=%.3f) T=(%.1f,%.1f) TR=(%.1f,%.1f) BL=(%.1f,%.1f)\n", nTry, nBase, n2, ratio, T.x, T.y, trHit.x, trHit.y, blHit.x, blHit.y);
                Localization loc;
                const bool built = buildHomographyFor(img, bin, T, trHit, blHit, nTry, loc);
                if (!built) continue;
                double bx, by;
                loc.h.map(3.5, 3.5, bx, by);
                const double backErr = sqrt((bx - T.x) * (bx - T.x) + (by - T.y) * (by - T.y)) / unitAvg;
                if (backErr > 0.6) continue;
                Candidate cand;
                cand.loc = loc;
                cand.score = fabs(dTR - dBL) / unitAvg + bestCos * 4.0 + (nTry == nBase ? 0.0 : 1.0);
                candidates.push_back(cand);
            }
        }
        if (candidates.empty()) {
            if (pass == 0) continue;
            err = L"未识别到二维码：定位图形无法配对成有效的二维码区域。";
            return false;
        }
        std::sort(candidates.begin(), candidates.end(),
                  [](const Candidate& a, const Candidate& b) { return a.score < b.score; });
        const int imgThreshold = otsuThreshold(img); // 全图 Otsu：退化图的采样网格可能失去双峰性
        for (const Candidate& cand : candidates) {
            const int n = cand.loc.size;
            std::vector<unsigned char> sampled(static_cast<size_t>(n) * n);
            // 模块尺寸小于 1.5 像素（如 N×N 矩阵直解）时，双线性会跨模块取均值，改用最近像素
            {
                double ax, ay, bx, by;
                cand.loc.h.map(0, 0, ax, ay);
                cand.loc.h.map(1, 0, bx, by);
                const double modulePx = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
                // 9 点全部用最近像素采样：纯像素值不产生跨像素混色，Otsu 阈值语义稳定
                auto samplePoint = [&](double x, double y) -> unsigned char {
                    const int sx = static_cast<int>(std::floor(x)), sy = static_cast<int>(std::floor(y));
                    return img.at(sx, sy);
                };
                for (int r = 0; r < n; ++r) for (int c = 0; c < n; ++c) {
                    double ox, oy;
                    cand.loc.h.map(c + 0.5, r + 0.5, ox, oy);
                    sampled[static_cast<size_t>(r) * n + c] = samplePoint(ox, oy);
                }
                GrayImage gridImg;
                gridImg.w = n;
                gridImg.h = n;
                gridImg.px = sampled;
                // 三级阈值：采样网格 Otsu → 全图 Otsu → 128，同一几何逐级重试
                int thresholds[3] = { otsuThreshold(gridImg), imgThreshold, 128 };
                static const double OFF[9][2] = { { 0, 0 }, { -0.25, -0.25 }, { 0.25, -0.25 }, { -0.25, 0.25 }, { 0.25, 0.25 }, { -0.25, 0 }, { 0.25, 0 }, { 0, -0.25 }, { 0, 0.25 } };
                DecodeOutput dec;
                std::wstring derr;
                for (int ti = 0; ti < 3; ++ti) {
                    if (ti > 0 && thresholds[ti] == thresholds[ti - 1]) continue;
                    std::vector<uint8_t> bits(static_cast<size_t>(n) * n, 0);
                    for (int r = 0; r < n; ++r) for (int c = 0; c < n; ++c) {
                        double ox, oy;
                        cand.loc.h.map(c + 0.5, r + 0.5, ox, oy);
                        int dark = 0;
                        for (int k = 0; k < 9; ++k)
                            if (samplePoint(ox + OFF[k][0] * modulePx, oy + OFF[k][1] * modulePx) <= thresholds[ti]) ++dark;
                        bits[static_cast<size_t>(r) * n + c] = dark >= 5 ? 1 : 0;
                    }
                    if (decodeMatrix(n, bits, dec, derr)) {
                        out = dec;
                        quadOut = cand.loc.quad;
                        return true;
                    }
                    err = derr;
                }
                if (lbqrDbg) std::fprintf(stderr, "[cand] tryDecode n=%d failed\n", n);
            }
        }
        if (pass == 0) continue; // 换自适应阈值再试
        if (err.empty()) err = L"未识别到二维码：定位成功但数据纠错失败。";
        return false;
    }
    err = L"未识别到二维码。";
    return false;
}

static bool decodeGrayImage(const GrayImage& img, DecodeOutput& out,
                            int& findersOut, Quad& quadOut, std::wstring& err) {
    if (img.w < 21 || img.h < 21) { err = L"图像太小：至少需要 21×21 像素。"; return false; }
    if (decodeGrayPasses(img, out, findersOut, quadOut, err)) return true;
    // 模块只有 2～4 像素时边界反锯齿像素污染采样，放大 3 倍再试一次
    if (img.w <= 1200 && img.h <= 1200) {
        GrayImage up;
        up.w = img.w * 3;
        up.h = img.h * 3;
        up.px.resize(static_cast<size_t>(up.w) * up.h);
        for (int y = 0; y < up.h; ++y)
            for (int x = 0; x < up.w; ++x)
                up.px[static_cast<size_t>(y) * up.w + x] = img.bilinear(static_cast<double>(x) / 3.0, static_cast<double>(y) / 3.0);
        std::wstring upErr;
        DecodeOutput upOut;
        int upFinders = 0;
        Quad upQuad;
        if (decodeGrayPasses(up, upOut, upFinders, upQuad, upErr)) {
            out = upOut;
            findersOut = upFinders;
            quadOut = upQuad;
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// PNG 编码（灰度 8bit / RGB 8bit，行过滤 None，deflate 存储块）与解码（完整 inflate）
// ---------------------------------------------------------------------------
static uint32_t crc32Of(const std::vector<unsigned char>& data) {
    static uint32_t table[256];
    static bool ready = false;
    if (!ready) {
        for (uint32_t i = 0; i < 256; ++i) {
            uint32_t c = i;
            for (int k = 0; k < 8; ++k) c = (c & 1) ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[i] = c;
        }
        ready = true;
    }
    uint32_t c = 0xFFFFFFFFu;
    for (unsigned char b : data) c = table[(c ^ b) & 0xFF] ^ (c >> 8);
    return c ^ 0xFFFFFFFFu;
}

static void putU32(std::vector<unsigned char>& v, uint32_t x) {
    v.push_back(static_cast<unsigned char>((x >> 24) & 0xFF));
    v.push_back(static_cast<unsigned char>((x >> 16) & 0xFF));
    v.push_back(static_cast<unsigned char>((x >> 8) & 0xFF));
    v.push_back(static_cast<unsigned char>(x & 0xFF));
}

static bool encodePngToBytes(int w, int h, const std::vector<unsigned char>& pixels, bool gray,
                             std::vector<unsigned char>& outPng, std::wstring& err) {
    if (w <= 0 || h <= 0 || w > 4096 || h > 4096) {
        err = L"PNG 尺寸越界：" + std::to_wstring(w) + L"×" + std::to_wstring(h) + L"，边长上限 4096 像素。";
        return false;
    }
    const int bpp = gray ? 1 : 3;
    if (pixels.size() != static_cast<size_t>(w) * h * bpp) { err = L"内部错误：像素缓冲大小不一致。"; return false; }
    std::vector<unsigned char> raw;
    raw.reserve(static_cast<size_t>(h) * (1 + w * bpp));
    for (int y = 0; y < h; ++y) {
        raw.push_back(0); // filter None
        raw.insert(raw.end(), pixels.begin() + static_cast<size_t>(y) * w * bpp,
                   pixels.begin() + (static_cast<size_t>(y) + 1) * w * bpp);
    }
    // deflate 存储块 + adler32
    std::vector<unsigned char> z;
    z.push_back(0x78);
    z.push_back(0x01);
    size_t off = 0;
    do {
        const size_t chunk = (std::min)(static_cast<size_t>(65535), raw.size() - off);
        const bool last = off + chunk >= raw.size();
        z.push_back(last ? 1 : 0);
        z.push_back(static_cast<unsigned char>(chunk & 0xFF));
        z.push_back(static_cast<unsigned char>((chunk >> 8) & 0xFF));
        z.push_back(static_cast<unsigned char>((~chunk) & 0xFF));
        z.push_back(static_cast<unsigned char>(((~chunk) >> 8) & 0xFF));
        z.insert(z.end(), raw.begin() + off, raw.begin() + off + chunk);
        off += chunk;
    } while (off < raw.size());
    uint32_t s1 = 1, s2 = 0;
    for (size_t i = 0; i < raw.size(); ++i) {
        s1 += raw[i];
        s2 += s1;
        if ((i % 5552u) == 5551u) { s1 %= 65521u; s2 %= 65521u; } // NMAX=5552 防溢出
    }
    s1 %= 65521u;
    s2 %= 65521u;
    putU32(z, (s2 << 16) | s1);
    std::vector<unsigned char> png;
    static const unsigned char SIG[8] = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    png.insert(png.end(), SIG, SIG + 8);
    auto appendChunk = [&png](const char* type, const std::vector<unsigned char>& body) {
        std::vector<unsigned char> tmp;
        putU32(tmp, static_cast<uint32_t>(body.size()));
        std::vector<unsigned char> crcBody;
        for (int k = 0; k < 4; ++k) {
            tmp.push_back(static_cast<unsigned char>(type[k]));
            crcBody.push_back(static_cast<unsigned char>(type[k]));
        }
        crcBody.insert(crcBody.end(), body.begin(), body.end());
        const uint32_t crc = crc32Of(crcBody); // PNG 规范：CRC 只覆盖 type + data
        png.insert(png.end(), tmp.begin(), tmp.end());
        png.insert(png.end(), body.begin(), body.end());
        putU32(png, crc);
    };
    std::vector<unsigned char> ihdr;
    putU32(ihdr, static_cast<uint32_t>(w));
    putU32(ihdr, static_cast<uint32_t>(h));
    ihdr.push_back(8);
    ihdr.push_back(gray ? 0 : 2);
    ihdr.push_back(0);
    ihdr.push_back(0);
    ihdr.push_back(0);
    appendChunk("IHDR", ihdr);
    appendChunk("IDAT", z);
    appendChunk("IEND", std::vector<unsigned char>());
    outPng = std::move(png);
    return true;
}

// --- inflate（puff 风格，支持存储/固定/动态 Huffman） ---
namespace inflate_ns {
struct BitReader {
    const unsigned char* data;
    size_t size;
    size_t pos = 0;
    long bitBuf = 0;
    int bitCnt = 0;
    int bits(int need, bool& ok) {
        ok = true;
        long val = bitBuf;
        while (bitCnt < need) {
            if (pos >= size) { ok = false; return 0; }
            val |= static_cast<long>(data[pos++]) << bitCnt;
            bitCnt += 8;
        }
        bitBuf = val >> need;
        bitCnt -= need;
        return static_cast<int>(val & ((1L << need) - 1));
    }
    void alignByte() { bitBuf = 0; bitCnt = 0; }
};
struct Huffman {
    short count[16] = {};
    short symbol[288] = {};
    bool build(const unsigned char* lengths, int n) {
        for (int i = 0; i < 16; ++i) count[i] = 0;
        for (int i = 0; i < n; ++i) ++count[lengths[i]];
        if (count[0] == n) return true;
        int left = 1;
        for (int len = 1; len < 16; ++len) {
            left <<= 1;
            left -= count[len];
            if (left < 0) return false;
        }
        short offs[16];
        offs[1] = 0;
        for (int len = 1; len < 15; ++len) offs[len + 1] = static_cast<short>(offs[len] + count[len]);
        for (int i = 0; i < n; ++i) if (lengths[i]) symbol[offs[lengths[i]]++] = static_cast<short>(i);
        return true;
    }
    int decode(BitReader& br, bool& ok) const {
        int code = 0, first = 0, index = 0;
        for (int len = 1; len < 16; ++len) {
            code |= br.bits(1, ok);
            if (!ok) return -1;
            const int cnt = count[len];
            if (code - first < cnt) return symbol[index + (code - first)];
            index += cnt;
            first += cnt;
            first <<= 1;
            code <<= 1;
        }
        ok = false;
        return -1;
    }
};
static const short LEN_BASE[29] = { 3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258 };
static const short LEN_EXTRA[29] = { 0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0 };
static const short DIST_BASE[30] = { 1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577 };
static const short DIST_EXTRA[30] = { 0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13 };

static bool codes(BitReader& br, Huffman& lit, Huffman& dist, std::vector<unsigned char>& out) {
    for (;;) {
        bool ok = true;
        const int sym = lit.decode(br, ok);
        if (!ok || sym < 0) return false;
        if (sym < 256) out.push_back(static_cast<unsigned char>(sym));
        else if (sym == 256) return true;
        else {
            const int li = sym - 257;
            if (li >= 29) return false;
            const int len = LEN_BASE[li] + br.bits(LEN_EXTRA[li], ok);
            if (!ok) return false;
            const int dsym = dist.decode(br, ok);
            if (!ok || dsym < 0 || dsym >= 30) return false;
            const int distance = DIST_BASE[dsym] + br.bits(DIST_EXTRA[dsym], ok);
            if (!ok) return false;
            if (distance > static_cast<int>(out.size())) return false;
            for (int i = 0; i < len; ++i) out.push_back(out[out.size() - distance]);
        }
    }
}
static bool storedBlock(BitReader& br, std::vector<unsigned char>& out) {
    br.alignByte();
    bool ok = true;
    const int len = br.bits(16, ok);
    if (!ok) return false;
    const int nlen = br.bits(16, ok);
    if (!ok || (len ^ 0xFFFF) != nlen) return false;
    for (int i = 0; i < len; ++i) {
        const int b = br.bits(8, ok);
        if (!ok) return false;
        out.push_back(static_cast<unsigned char>(b));
    }
    return true;
}
static bool fixedBlock(BitReader& br, std::vector<unsigned char>& out) {
    unsigned char lengths[288 + 30];
    for (int i = 0; i < 144; ++i) lengths[i] = 8;
    for (int i = 144; i < 256; ++i) lengths[i] = 9;
    for (int i = 256; i < 280; ++i) lengths[i] = 7;
    for (int i = 280; i < 288; ++i) lengths[i] = 8;
    for (int i = 288; i < 318; ++i) lengths[i] = 5;
    Huffman lit, dist;
    lit.build(lengths, 288);
    dist.build(lengths + 288, 30);
    return codes(br, lit, dist, out);
}
static bool dynamicBlock(BitReader& br, std::vector<unsigned char>& out) {
    bool ok = true;
    const int nlen = br.bits(5, ok) + 257;
    const int ndist = br.bits(5, ok) + 1;
    const int ncode = br.bits(4, ok) + 4;
    if (!ok || nlen > 286 || ndist > 30) return false;
    static const unsigned char ORDER[19] = { 16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15 };
    unsigned char clens[19] = {};
    for (int i = 0; i < ncode; ++i) clens[ORDER[i]] = static_cast<unsigned char>(br.bits(3, ok));
    if (!ok) return false;
    Huffman clh;
    if (!clh.build(clens, 19)) return false;
    unsigned char lengths[286 + 30] = {};
    int index = 0;
    while (index < nlen + ndist) {
        const int sym = clh.decode(br, ok);
        if (!ok || sym < 0) return false;
        if (sym < 16) lengths[index++] = static_cast<unsigned char>(sym);
        else {
            int len = 0, rep = 0;
            if (sym == 16) {
                if (index == 0) return false;
                len = lengths[index - 1];
                rep = 3 + br.bits(2, ok);
            } else if (sym == 17) {
                rep = 3 + br.bits(3, ok);
            } else {
                rep = 11 + br.bits(7, ok);
            }
            if (!ok) return false;
            if (index + rep > nlen + ndist) return false;
            while (rep--) lengths[index++] = static_cast<unsigned char>(len);
        }
    }
    Huffman lit, dist;
    if (!lit.build(lengths, nlen)) return false;
    if (!dist.build(lengths + nlen, ndist)) return false;
    return codes(br, lit, dist, out);
}
} // namespace inflate_ns

static bool inflateZlib(const std::vector<unsigned char>& z, std::vector<unsigned char>& out, std::wstring& err) {
    if (z.size() < 8) { err = L"zlib 数据过短。"; return false; }
    // zlib 头：CMF/FLG 两字节（跳过并做基本校验），尾部 4 字节 adler32
    const unsigned cmf = z[0], flg = z[1];
    if ((cmf & 0x0Fu) != 0x08u || ((cmf << 8) | flg) % 31u != 0u) { err = L"zlib 头非法。"; return false; }
    if (flg & 0x20u) { err = L"不支持带预设字典的 zlib 数据。"; return false; }
    inflate_ns::BitReader br{ z.data() + 2, z.size() - 6, 0, 0, 0 };
    bool finalBlock = false;
    while (!finalBlock) {
        bool ok = true;
        finalBlock = br.bits(1, ok) != 0;
        if (!ok) { err = L"PNG 数据流提前结束。"; return false; }
        const int type = br.bits(2, ok);
        if (!ok) { err = L"PNG 数据流提前结束。"; return false; }
        if (type == 0) { if (!inflate_ns::storedBlock(br, out)) { err = L"PNG 存储块损坏。"; return false; } }
        else if (type == 1) { if (!inflate_ns::fixedBlock(br, out)) { err = L"PNG 固定 Huffman 块损坏。"; return false; } }
        else if (type == 2) { if (!inflate_ns::dynamicBlock(br, out)) { err = L"PNG 动态 Huffman 块损坏。"; return false; } }
        else { err = L"PNG 数据块类型非法。"; return false; }
    }
    return true;
}

static uint32_t getU32(const std::vector<unsigned char>& v, size_t off) {
    if (off + 4 > v.size()) return 0;
    return (static_cast<uint32_t>(v[off]) << 24) | (static_cast<uint32_t>(v[off + 1]) << 16)
        | (static_cast<uint32_t>(v[off + 2]) << 8) | static_cast<uint32_t>(v[off + 3]);
}

static bool decodePngToGray(const std::vector<unsigned char>& png, GrayImage& out, std::wstring& err) {
    static const unsigned char SIG[8] = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    if (png.size() < 8 || std::memcmp(png.data(), SIG, 8) != 0) { err = L"不是有效的 PNG 文件。"; return false; }
    size_t off = 8;
    int w = 0, h = 0, bitDepth = 8, colorType = 0, interlace = 0;
    std::vector<unsigned char> idat;
    std::vector<unsigned char> palette;
    while (off + 8 <= png.size()) {
        const uint32_t len = getU32(png, off);
        if (off + 12 + len > png.size()) { err = L"PNG 数据块不完整。"; return false; }
        const char* type = reinterpret_cast<const char*>(&png[off + 4]);
        const size_t body = off + 8;
        if (std::memcmp(type, "IHDR", 4) == 0) {
            w = static_cast<int>(getU32(png, body));
            h = static_cast<int>(getU32(png, body + 4));
            bitDepth = png[body + 8];
            colorType = png[body + 9];
            interlace = png[body + 12];
        } else if (std::memcmp(type, "PLTE", 4) == 0) {
            palette.assign(png.begin() + body, png.begin() + body + len);
        } else if (std::memcmp(type, "IDAT", 4) == 0) {
            idat.insert(idat.end(), png.begin() + body, png.begin() + body + len);
        } else if (std::memcmp(type, "IEND", 4) == 0) {
            break;
        }
        off += 12 + len;
    }
    if (w <= 0 || h <= 0 || w > 8192 || h > 8192) { err = L"PNG 尺寸异常或超过 8192 像素上限。"; return false; }
    if (interlace) { err = L"暂不支持隔行（Adam7）PNG。"; return false; }
    if (bitDepth != 1 && bitDepth != 2 && bitDepth != 4 && bitDepth != 8 && bitDepth != 16) {
        err = L"不支持的 PNG 位深 " + std::to_wstring(bitDepth) + L"。";
        return false;
    }
    const bool hasPalette = colorType == 3;
    if (colorType != 0 && colorType != 2 && colorType != 3 && colorType != 4 && colorType != 6) {
        err = L"不支持的 PNG 颜色类型。";
        return false;
    }
    if (hasPalette && palette.empty()) { err = L"PNG 调色板缺失。"; return false; }
    std::vector<unsigned char> raw;
    if (!inflateZlib(idat, raw, err)) return false;
    const int channels = colorType == 2 ? 3 : colorType == 4 ? 2 : colorType == 6 ? 4 : 1;
    const int bytesPerRow = (w * channels * bitDepth + 7) / 8;
    if (raw.size() < static_cast<size_t>(bytesPerRow + 1) * h) { err = L"PNG 像素数据不完整。"; return false; }
    std::vector<unsigned char> lines(static_cast<size_t>(bytesPerRow) * h);
    const int unit = (std::max)(1, bitDepth / 8);
    for (int y = 0; y < h; ++y) {
        const unsigned char filter = raw[static_cast<size_t>(y) * (bytesPerRow + 1)];
        const unsigned char* src = &raw[static_cast<size_t>(y) * (bytesPerRow + 1) + 1];
        unsigned char* dst = &lines[static_cast<size_t>(y) * bytesPerRow];
        for (int i = 0; i < bytesPerRow; ++i) {
            const int a = i >= unit ? dst[i - unit] : 0;
            const int b = y > 0 ? lines[static_cast<size_t>(y - 1) * bytesPerRow + i] : 0;
            const int c = (i >= unit && y > 0) ? lines[static_cast<size_t>(y - 1) * bytesPerRow + i - unit] : 0;
            int val = src[i];
            switch (filter) {
                case 0: break;
                case 1: val += a; break;
                case 2: val += b; break;
                case 3: val += (a + b) / 2; break;
                case 4: {
                    const int pa = std::abs(b - c), pb = std::abs(a - c), pc = std::abs(a + b - 2 * c);
                    val += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
                    break;
                }
                default: err = L"PNG 行过滤类型非法。"; return false;
            }
            dst[i] = static_cast<unsigned char>(val & 0xFF);
        }
    }
    auto sample = [&](int x, int y) -> unsigned char {
        const unsigned char* row = &lines[static_cast<size_t>(y) * bytesPerRow];
        if (bitDepth == 16) {
            const size_t base = static_cast<size_t>(x) * channels * 2;
            return row[base];
        }
        if (bitDepth == 8) {
            const size_t base = static_cast<size_t>(x) * channels;
            if (hasPalette) {
                const int pi = row[base] * 3;
                if (pi + 2 >= static_cast<int>(palette.size())) return 0;
                return static_cast<unsigned char>((palette[pi] * 299 + palette[pi + 1] * 587 + palette[pi + 2] * 114) / 1000);
            }
            if (colorType == 0 || colorType == 4) return row[base];
            return static_cast<unsigned char>((row[base] * 299 + row[base + 1] * 587 + row[base + 2] * 114) / 1000);
        }
        const int perByte = 8 / bitDepth;
        const int idx = x / perByte, sub = x % perByte;
        const int v = (row[idx] >> (8 - bitDepth * (sub + 1))) & ((1 << bitDepth) - 1);
        if (hasPalette) {
            const int pi = v * 3;
            if (pi + 2 >= static_cast<int>(palette.size())) return 0;
            return static_cast<unsigned char>((palette[pi] * 299 + palette[pi + 1] * 587 + palette[pi + 2] * 114) / 1000);
        }
        const int scale = 255 / ((1 << bitDepth) - 1);
        return static_cast<unsigned char>(v * scale);
    };
    out.w = w;
    out.h = h;
    out.px.resize(static_cast<size_t>(w) * h);
    for (int y = 0; y < h; ++y) for (int x = 0; x < w; ++x) out.px[static_cast<size_t>(y) * w + x] = sample(x, y);
    return true;
}

// ---------------------------------------------------------------------------
// 基线 JPEG 解码（自带；不支持渐进式与算术编码）
// ---------------------------------------------------------------------------
namespace jpeg_ns {
struct Component {
    int id = 0, hh = 1, vv = 1, tq = 0;
    int dcTable = 0, acTable = 0;
    int dcPred = 0;
    int blocksW = 0, blocksH = 0;
    std::vector<unsigned char> data;
};
struct HuffTable {
    unsigned char lengths[17] = {};
    unsigned char values[280] = {};
    int mincode[17] = {}, maxcode[17] = {}, valptr[17] = {};
    bool ready = false;
    void build() {
        int code = 0, k = 0;
        for (int l = 1; l <= 16; ++l) {
            valptr[l] = k;
            mincode[l] = code;
            code += lengths[l];
            k += lengths[l];
            maxcode[l] = code - 1;
            code <<= 1;
        }
        ready = true;
        for (int l = 1; l <= 16; ++l) if (lengths[l]) { ready = true; break; }
    }
};
struct BitStream {
    const unsigned char* p;
    size_t n;
    size_t pos = 0;
    int buf = 0, cnt = 0;
    int fill() {
        if (cnt == 0) {
            if (pos >= n) return -1;
            unsigned char b = p[pos++];
            if (b == 0xFF && pos < n && p[pos] == 0x00) ++pos;
            buf = b;
            cnt = 8;
        }
        --cnt;
        return (buf >> cnt) & 1;
    }
    int receive(int nBits, bool& ok) {
        int v = 0;
        for (int i = 0; i < nBits; ++i) {
            const int b = fill();
            if (b < 0) { ok = false; return 0; }
            v = (v << 1) | b;
        }
        ok = true;
        return v;
    }
    int decodeHuff(const HuffTable& t, bool& ok) {
        int code = receive(1, ok);
        if (!ok) return -1;
        int l = 1;
        while (l <= 16 && code > t.maxcode[l]) {
            const int b = receive(1, ok);
            if (!ok) return -1;
            code = (code << 1) | b;
            ++l;
        }
        if (l > 16) { ok = false; return -1; }
        return t.values[t.valptr[l] + code - t.mincode[l]];
    }
    static int extend(int v, int nBits) {
        return v < (1 << (nBits - 1)) ? v - (1 << nBits) + 1 : v;
    }
};
struct CosTable {
    double c[8][8];
    CosTable() {
        const double PI = 3.14159265358979323846;
        for (int x = 0; x < 8; ++x) for (int u = 0; u < 8; ++u)
            c[x][u] = cos((2 * x + 1) * u * PI / 16.0);
    }
};
static const CosTable& cosTable() { static const CosTable t; return t; }
static void idct8x8(const int* block, unsigned char* out, int stride) {
    double tmp[8][8];
    const CosTable& ct = cosTable();
    for (int y = 0; y < 8; ++y) for (int x = 0; x < 8; ++x) {
        double sum = 0;
        for (int v = 0; v < 8; ++v) for (int u = 0; u < 8; ++u) {
            if (block[v * 8 + u] == 0) continue;
            const double cu = (u == 0) ? 0.7071067811865476 : 1.0;
            const double cv = (v == 0) ? 0.7071067811865476 : 1.0;
            sum += cu * cv * block[v * 8 + u] * ct.c[x][u] * ct.c[y][v];
        }
        tmp[y][x] = sum * 0.25;
    }
    for (int y = 0; y < 8; ++y) for (int x = 0; x < 8; ++x) {
        const double val = tmp[y][x] + 128.5;
        out[y * stride + x] = static_cast<unsigned char>(val < 0 ? 0 : val > 255 ? 255 : val);
    }
}
} // namespace jpeg_ns

static bool decodeJpegToGray(const std::vector<unsigned char>& jpg, GrayImage& out, std::wstring& err) {
    using namespace jpeg_ns;
    if (jpg.size() < 4 || jpg[0] != 0xFF || jpg[1] != 0xD8) { err = L"不是有效的 JPEG 文件。"; return false; }
    int qt[4][64] = {};
    HuffTable dcT[4], acT[4];
    int restartInterval = 0;
    int width = 0, height = 0;
    Component comps[4];
    int compCount = 0;
    size_t pos = 2;
    bool sofSeen = false, sosSeen = false;
    while (pos + 4 <= jpg.size()) {
        if (jpg[pos] != 0xFF) { ++pos; continue; }
        const unsigned char marker = jpg[pos + 1];
        if (marker == 0xFF) { ++pos; continue; }
        if (marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD7)) { pos += 2; continue; }
        if (marker == 0xD9) break;
        const size_t segLen = (static_cast<size_t>(jpg[pos + 2]) << 8) | jpg[pos + 3];
        if (pos + 2 + segLen > jpg.size()) { err = L"JPEG 数据段不完整。"; return false; }
        const size_t body = pos + 4;
        if (marker == 0xDB) { // DQT
            size_t q = body;
            const size_t end = pos + 2 + segLen;
            while (q < end) {
                const int pq = jpg[q] >> 4;
                const int id = jpg[q] & 0x0F;
                ++q;
                for (int i = 0; i < 64 && q < end; ++i) {
                    qt[id][i] = pq ? jpg[q] : jpg[q]; // 16bit 表取高字节近似
                    q += pq ? 2 : 1;
                }
            }
        } else if (marker == 0xC0 || marker == 0xC1) {
            height = (jpg[body + 1] << 8) | jpg[body + 2];
            width = (jpg[body + 3] << 8) | jpg[body + 4];
            compCount = jpg[body + 5];
            for (int i = 0; i < compCount && i < 4; ++i) {
                const size_t b = body + 6 + static_cast<size_t>(i) * 3;
                comps[i].id = jpg[b];
                comps[i].hh = jpg[b + 1] >> 4;
                comps[i].vv = jpg[b + 1] & 0x0F;
                comps[i].tq = jpg[b + 2];
            }
            sofSeen = true;
        } else if (marker >= 0xC2 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC) {
            err = marker == 0xC2 ? L"暂不支持渐进式（Progressive）JPEG。" : L"暂不支持该 JPEG 编码方式。";
            return false;
        } else if (marker == 0xC4) { // DHT
            size_t b = body;
            const size_t end = pos + 2 + segLen;
            while (b + 17 <= end) {
                const int tc = jpg[b] >> 4, th = jpg[b] & 0x0F;
                HuffTable& t = tc ? acT[th] : dcT[th];
                int total = 0;
                for (int l = 1; l <= 16; ++l) {
                    t.lengths[l] = jpg[b + l];
                    total += t.lengths[l];
                }
                b += 17;
                for (int i = 0; i < total && b < end; ++i) t.values[i] = jpg[b++];
                t.build();
            }
        } else if (marker == 0xDD) { // DRI
            restartInterval = (jpg[body] << 8) | jpg[body + 1];
        } else if (marker == 0xDA) { // SOS
            sosSeen = true;
            const int ns = jpg[body];
            for (int i = 0; i < ns; ++i) {
                const int cid = jpg[body + 1 + i * 2];
                const int tables = jpg[body + 2 + i * 2];
                for (int c = 0; c < compCount; ++c)
                    if (comps[c].id == cid) { comps[c].dcTable = tables >> 4; comps[c].acTable = tables & 0x0F; }
            }
            pos += 2 + segLen; // 扫描数据起点
            break;
        }
        pos += 2 + segLen;
    }
    if (!sofSeen || !sosSeen) { err = L"JPEG 缺少关键数据段。"; return false; }
    if (width <= 0 || height <= 0 || width > 8192 || height > 8192) { err = L"JPEG 尺寸异常或超过 8192 像素上限。"; return false; }
    int hmax = 1, vmax = 1;
    for (int c = 0; c < compCount; ++c) { hmax = (std::max)(hmax, comps[c].hh); vmax = (std::max)(vmax, comps[c].vv); }
    const int mcuW = 8 * hmax, mcuH = 8 * vmax;
    const int mcusX = (width + mcuW - 1) / mcuW, mcusY = (height + mcuH - 1) / mcuH;
    for (int c = 0; c < compCount; ++c) {
        comps[c].blocksW = mcusX * comps[c].hh;
        comps[c].blocksH = mcusY * comps[c].vv;
        comps[c].data.assign(static_cast<size_t>(comps[c].blocksW) * 8 * comps[c].blocksH * 8, 128);
    }
    BitStream bs{ jpg.data(), jpg.size(), pos, 0, 0 };
    int restartLeft = restartInterval;
    for (int my = 0; my < mcusY; ++my) {
        for (int mx = 0; mx < mcusX; ++mx) {
            if (restartInterval > 0 && restartLeft == 0) {
                bs.cnt = 0;
                while (bs.pos + 1 < jpg.size()) {
                    if (jpg[bs.pos] == 0xFF && jpg[bs.pos + 1] >= 0xD0 && jpg[bs.pos + 1] <= 0xD7) break;
                    if (jpg[bs.pos] == 0xFF && jpg[bs.pos + 1] == 0xD9) break;
                    ++bs.pos;
                }
                bs.pos += 2;
                for (int c = 0; c < compCount; ++c) comps[c].dcPred = 0;
                restartLeft = restartInterval;
            }
            --restartLeft;
            for (int c = 0; c < compCount; ++c) {
                Component& comp = comps[c];
                for (int by = 0; by < comp.vv; ++by) for (int bx = 0; bx < comp.hh; ++bx) {
                    int block[64] = {};
                    bool ok = true;
                    const int t = bs.decodeHuff(dcT[comp.dcTable], ok);
                    if (!ok) { err = L"JPEG 霍夫曼解码失败。"; return false; }
                    const int diff = t ? bs.extend(bs.receive(t, ok), t) : 0;
                    if (!ok) { err = L"JPEG 位流提前结束。"; return false; }
                    comp.dcPred += diff;
                    block[0] = comp.dcPred * qt[comp.tq][0];
                    for (int k = 1; k < 64; ++k) {
                        const int rs = bs.decodeHuff(acT[comp.acTable], ok);
                        if (!ok) { err = L"JPEG 位流提前结束。"; return false; }
                        const int r = rs >> 4, s = rs & 0x0F;
                        if (s == 0) {
                            if (r == 15) { k += 15; continue; }
                            break;
                        }
                        k += r;
                        if (k > 63) break;
                        const int v = bs.extend(bs.receive(s, ok), s);
                        if (!ok) { err = L"JPEG 位流提前结束。"; return false; }
                        static const int ZIGZAG[64] = {
                            0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,
                            35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63 };
                        block[ZIGZAG[k]] = v * qt[comp.tq][k];
                    }
                    const int px = (mx * comp.hh + bx) * 8;
                    const int py = (my * comp.vv + by) * 8;
                    unsigned char* dst = &comp.data[static_cast<size_t>(py) * comp.blocksW * 8 + px];
                    idct8x8(block, dst, comp.blocksW * 8);
                }
            }
        }
    }
    out.w = width;
    out.h = height;
    out.px.resize(static_cast<size_t>(width) * height);
    auto planeAt = [&](const Component& comp, int x, int y) -> unsigned char {
        const int sx = (std::min)(x * comp.hh / hmax, comp.blocksW * 8 - 1);
        const int sy = (std::min)(y * comp.vv / vmax, comp.blocksH * 8 - 1);
        const int bw = comp.blocksW * 8;
        return comp.data[static_cast<size_t>(sy) * bw + sx];
    };
    for (int y = 0; y < height; ++y) for (int x = 0; x < width; ++x) {
        unsigned char g;
        if (compCount == 1) g = planeAt(comps[0], x, y);
        else g = planeAt(comps[0], x, y); // Y 平面本身即感知亮度
        out.px[static_cast<size_t>(y) * width + x] = g;
    }
    return true;
}

// ---------------------------------------------------------------------------
// 统一入口：从字节识别图像格式并解码为灰度
// ---------------------------------------------------------------------------
static bool decodeImageBytesToGray(const std::vector<unsigned char>& bytes, GrayImage& out, std::wstring& err) {
    if (bytes.size() >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50) return decodePngToGray(bytes, out, err);
    if (bytes.size() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8) return decodeJpegToGray(bytes, out, err);
    err = L"不支持的图像格式：二维码模块只内置 PNG 与 JPEG（基线）解码。";
    return false;
}

// ---------------------------------------------------------------------------
// 栅格化（生成侧渲染）
// ---------------------------------------------------------------------------
static void rasterizeMatrix(const std::vector<uint8_t>& matrix, int n, int edge, int quiet,
                            unsigned char fgR, unsigned char fgG, unsigned char fgB,
                            unsigned char bgR, unsigned char bgG, unsigned char bgB,
                            std::vector<unsigned char>& pixels, bool& gray) {
    gray = fgR == fgG && fgG == fgB && bgR == bgG && bgG == bgB;
    const int size = (n + quiet * 2) * edge;
    const int bpp = gray ? 1 : 3;
    pixels.assign(static_cast<size_t>(size) * size * bpp, 0);
    for (int y = 0; y < size; ++y) {
        const int mr = y / edge - quiet;
        for (int x = 0; x < size; ++x) {
            const int mc = x / edge - quiet;
            const bool dark = mr >= 0 && mc >= 0 && mr < n && mc < n && matrix[static_cast<size_t>(mr) * n + mc];
            const size_t o = static_cast<size_t>(y) * size * bpp + static_cast<size_t>(x) * bpp;
            if (gray) {
                pixels[o] = dark ? fgR : bgR;
            } else {
                pixels[o] = dark ? fgR : bgR;
                pixels[o + 1] = dark ? fgG : bgG;
                pixels[o + 2] = dark ? fgB : bgB;
            }
        }
    }
}

} // namespace lbqr



#endif // LB_QRCODE_RUNTIME_INCLUDED

// ============================================================================
// lb_qrcode_win.cpp — 二维码模块 GDI 集成、句柄管理与公开中文命令
//
// 续接 lb_qrcode_core.cpp（同一编译单元）。公开命令的 ABI 与模块 bindings
// 一致：文本=const wchar_t*、整数=int、长整数/句柄=long long、逻辑=bool、
// 字节集=const std::vector<unsigned char>& / std::vector<unsigned char>、
// wideString 返回=std::wstring。
// ============================================================================

#include <cstdio>
#include <cwctype>

namespace lbqr {

// ---------------------------------------------------------------------------
// 句柄注册表（生成 / 识别各一套），代次计数防句柄复用串扰
// ---------------------------------------------------------------------------
struct QrCodeState {
    EncodeResult enc;
    std::wstring text;
    std::string utf8;
    int edge = 8;
    int quiet = 4;
    std::map<long long, HBITMAP> bitmaps; // (前景色<<32|背景色) → 位图，随句柄释放
};
struct QrRecState {
    DecodeOutput dec;
    std::wstring text;
    int finders = 0;
    Quad quad;
    bool hasQuad = false;
};

static SRWLOCK g_qrLock = SRWLOCK_INIT;
static std::map<long long, std::shared_ptr<QrCodeState>> g_qrCodes;
static std::map<long long, std::shared_ptr<QrRecState>> g_qrRecs;
static long long g_qrNextId = 0x7100000000000000LL;
static long long g_qrNextRecId = 0x7200000000000000LL;

static std::wstring g_qrGenError;
static std::wstring g_qrRecError;

static std::shared_ptr<QrCodeState> qrFindCode(long long handle) {
    AcquireSRWLockShared(&g_qrLock);
    auto it = g_qrCodes.find(handle);
    auto state = it != g_qrCodes.end() ? it->second : nullptr;
    ReleaseSRWLockShared(&g_qrLock);
    return state;
}
static std::shared_ptr<QrRecState> qrFindRec(long long handle) {
    AcquireSRWLockShared(&g_qrLock);
    auto it = g_qrRecs.find(handle);
    auto state = it != g_qrRecs.end() ? it->second : nullptr;
    ReleaseSRWLockShared(&g_qrLock);
    return state;
}

static bool parseLevelText(const wchar_t* text, int& level) {
    const std::wstring v = text ? text : L"";
    if (v.empty()) return false;
    const wint_t c = towupper(v[0]);
    if (c == L'L') { level = 0; return true; }
    if (c == L'M') { level = 1; return true; }
    if (c == L'Q') { level = 2; return true; }
    if (c == L'H') { level = 3; return true; }
    return false;
}

static void splitArgb(long long argb, unsigned char& r, unsigned char& g, unsigned char& b) {
    const unsigned long long v = static_cast<unsigned long long>(argb) & 0xFFFFFFFFULL;
    r = static_cast<unsigned char>((v >> 16) & 0xFF);
    g = static_cast<unsigned char>((v >> 8) & 0xFF);
    b = static_cast<unsigned char>(v & 0xFF);
}

static bool writeFileBytes(const wchar_t* path, const std::vector<unsigned char>& bytes, std::wstring& err) {
    FILE* f = nullptr;
    if (_wfopen_s(&f, path, L"wb") != 0 || !f) {
        err = L"无法写入文件（路径或权限问题）：" + std::wstring(path ? path : L"");
        return false;
    }
    const bool ok = bytes.empty() || std::fwrite(bytes.data(), 1, bytes.size(), f) == bytes.size();
    std::fclose(f);
    if (!ok) { err = L"写入文件失败：" + std::wstring(path ? path : L""); return false; }
    return true;
}

static bool readFileBytes(const wchar_t* path, std::vector<unsigned char>& bytes, std::wstring& err) {
    FILE* f = nullptr;
    if (_wfopen_s(&f, path, L"rb") != 0 || !f) {
        err = L"无法读取文件（不存在、被占用或路径无权限）：" + std::wstring(path ? path : L"");
        return false;
    }
    _fseeki64(f, 0, SEEK_END);
    const long long size = _ftelli64(f);
    _fseeki64(f, 0, SEEK_SET);
    if (size <= 0 || size > 256LL * 1024 * 1024) {
        std::fclose(f);
        err = L"图像文件为空或超过 256MB 上限。";
        return false;
    }
    bytes.resize(static_cast<size_t>(size));
    const bool ok = std::fread(bytes.data(), 1, bytes.size(), f) == bytes.size();
    std::fclose(f);
    if (!ok) { err = L"读取图像文件失败：" + std::wstring(path ? path : L""); return false; }
    return true;
}

// DIB 内存布局为 BGRA
static GrayImage grayFromBgra(int w, int h, const unsigned char* bgra) {
    GrayImage img;
    img.w = w;
    img.h = h;
    img.px.resize(static_cast<size_t>(w) * h);
    for (size_t i = 0; i < img.px.size(); ++i) {
        const unsigned char bb = bgra[i * 4], gg = bgra[i * 4 + 1], rr = bgra[i * 4 + 2];
        img.px[i] = static_cast<unsigned char>((rr * 299 + gg * 587 + bb * 114) / 1000);
    }
    return img;
}

static long long recognizeGray(const GrayImage& img, std::wstring& err) {
    QrRecState state;
    DecodeOutput dec;
    int finders = 0;
    Quad quad;
    if (!decodeGrayImage(img, dec, finders, quad, err)) return 0;
    state.dec = std::move(dec);
    state.text = LB_Utf8ToWide(state.dec.utf8);
    state.finders = finders;
    state.quad = quad;
    state.hasQuad = true;
    AcquireSRWLockExclusive(&g_qrLock);
    const long long id = ++g_qrNextRecId;
    g_qrRecs[id] = std::make_shared<QrRecState>(std::move(state));
    ReleaseSRWLockExclusive(&g_qrLock);
    return id;
}

// ---------------------------------------------------------------------------
// 公开命令 · 生成侧
// ---------------------------------------------------------------------------
std::wstring 二维码_取版本() {
    return LB_ReturnText(L"lingbuilder.qrcode 1.0.0（ISO/IEC 18004，纯本地实现，内置 PNG/JPEG 编解码与图像定位）");
}

long long 二维码_生成(const wchar_t* 内容, const wchar_t* 纠错级别, int 边长像素, int 空白边模块数) {
    g_qrGenError.clear();
    int level = 1;
    if (!parseLevelText(纠错级别, level)) {
        g_qrGenError = L"纠错级别无效：只允许 L、M、Q、H。";
        return 0;
    }
    if (边长像素 <= 0) {
        g_qrGenError = L"边长像素必须大于 0（默认 8）。";
        return 0;
    }
    if (边长像素 > 64) {
        g_qrGenError = L"边长像素过大：上限 64（默认 8）。";
        return 0;
    }
    if (空白边模块数 < 0 || 空白边模块数 > 32) {
        g_qrGenError = L"空白边模块数越界：允许 0～32（默认 4）。";
        return 0;
    }
    const std::string utf8 = LB_WideToUtf8(内容 ? 内容 : L"");
    EncodeResult enc;
    std::wstring err;
    if (!encodeQrInternal(utf8, EncodeOptions{ level, 0, 0 }, enc, err)) {
        g_qrGenError = err;
        return 0;
    }
    const int pixelEdge = (enc.size + 空白边模块数 * 2) * 边长像素;
    if (pixelEdge > 4096) {
        g_qrGenError = L"输出边长 " + std::to_wstring(pixelEdge) + L" 像素超过 4096 上限，请减小边长像素或空白边模块数。";
        return 0;
    }
    QrCodeState state;
    state.enc = std::move(enc);
    state.utf8 = utf8;
    state.text = 内容 ? 内容 : L"";
    state.edge = 边长像素;
    state.quiet = 空白边模块数;
    AcquireSRWLockExclusive(&g_qrLock);
    const long long id = ++g_qrNextId;
    g_qrCodes[id] = std::make_shared<QrCodeState>(std::move(state));
    ReleaseSRWLockExclusive(&g_qrLock);
    return id;
}

std::wstring 二维码_取错误() {
    return LB_ReturnText(g_qrGenError);
}

int 二维码_取模块数(long long 码) {
    const auto s = qrFindCode(码);
    return s ? s->enc.size : 0;
}

int 二维码_取版本号(long long 码) {
    const auto s = qrFindCode(码);
    return s ? s->enc.version : 0;
}

int 二维码_取掩码(long long 码) {
    const auto s = qrFindCode(码);
    return s ? s->enc.mask : -1;
}

std::wstring 二维码_取纠错级别(long long 码) {
    const auto s = qrFindCode(码);
    if (!s) return LB_ReturnText(L"");
    return LB_ReturnText(LEVEL_WNAMES[s->enc.level]);
}

bool 二维码_取深色(long long 码, int 行, int 列) {
    const auto s = qrFindCode(码);
    if (!s || 行 < 0 || 列 < 0 || 行 >= s->enc.size || 列 >= s->enc.size) return false;
    return s->enc.matrix[static_cast<size_t>(行) * s->enc.size + 列] != 0;
}

bool 二维码_保存PNG(long long 码, const wchar_t* 路径, long long 前景色, long long 背景色) {
    g_qrGenError.clear();
    const auto s = qrFindCode(码);
    if (!s) {
        g_qrGenError = L"二维码句柄无效（可能已释放）。";
        return false;
    }
    unsigned char fr, fg, fb, br, bg, bb;
    splitArgb(前景色, fr, fg, fb);
    splitArgb(背景色, br, bg, bb);
    std::vector<unsigned char> pixels;
    bool gray = false;
    rasterizeMatrix(s->enc.matrix, s->enc.size, s->edge, s->quiet, fr, fg, fb, br, bg, bb, pixels, gray);
    const int size = (s->enc.size + s->quiet * 2) * s->edge;
    std::vector<unsigned char> png;
    std::wstring err;
    if (!encodePngToBytes(size, size, pixels, gray, png, err)) {
        g_qrGenError = err;
        return false;
    }
    if (!writeFileBytes(路径, png, err)) {
        g_qrGenError = err;
        return false;
    }
    return true;
}

long long 二维码_取位图(long long 码, long long 前景色, long long 背景色) {
    g_qrGenError.clear();
    const auto s = qrFindCode(码);
    if (!s) {
        g_qrGenError = L"二维码句柄无效（可能已释放）。";
        return 0;
    }
    const long long key = ((前景色 & 0xFFFFFFFFLL) << 32) | (背景色 & 0xFFFFFFFFLL);
    AcquireSRWLockShared(&g_qrLock);
    auto it = s->bitmaps.find(key);
    if (it != s->bitmaps.end()) {
        const HBITMAP cached = it->second;
        ReleaseSRWLockShared(&g_qrLock);
        return reinterpret_cast<long long>(cached);
    }
    ReleaseSRWLockShared(&g_qrLock);
    unsigned char fr, fg, fb, br, bg, bb;
    splitArgb(前景色, fr, fg, fb);
    splitArgb(背景色, br, bg, bb);
    const int size = (s->enc.size + s->quiet * 2) * s->edge;
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = size;
    info.bmiHeader.biHeight = -size;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    void* bitsPtr = nullptr;
    HDC screen = GetDC(nullptr);
    HBITMAP bmp = CreateDIBSection(screen, &info, DIB_RGB_COLORS, &bitsPtr, nullptr, 0);
    ReleaseDC(nullptr, screen);
    if (!bmp || !bitsPtr) {
        if (bmp) DeleteObject(bmp);
        g_qrGenError = L"创建位图失败。";
        return 0;
    }
    auto* dst = static_cast<unsigned char*>(bitsPtr);
    const bool gray = fr == fg && fg == fb && br == bg && bg == bb;
    for (int y = 0; y < size; ++y) {
        const int mr = y / s->edge - s->quiet;
        for (int x = 0; x < size; ++x) {
            const int mc = x / s->edge - s->quiet;
            const bool isDark = mr >= 0 && mc >= 0 && mr < s->enc.size && mc < s->enc.size
                && s->enc.matrix[static_cast<size_t>(mr) * s->enc.size + mc];
            const size_t o = (static_cast<size_t>(y) * size + x) * 4;
            if (gray) {
                const unsigned char v = isDark ? fr : br;
                dst[o] = v;
                dst[o + 1] = v;
                dst[o + 2] = v;
            } else {
                dst[o] = isDark ? fb : bb;
                dst[o + 1] = isDark ? fg : bg;
                dst[o + 2] = isDark ? fr : br;
            }
            dst[o + 3] = 255;
        }
    }
    AcquireSRWLockExclusive(&g_qrLock);
    s->bitmaps[key] = bmp;
    ReleaseSRWLockExclusive(&g_qrLock);
    return reinterpret_cast<long long>(bmp);
}

bool 二维码_释放(long long 码) {
    AcquireSRWLockExclusive(&g_qrLock);
    auto it = g_qrCodes.find(码);
    if (it == g_qrCodes.end()) {
        ReleaseSRWLockExclusive(&g_qrLock);
        return false;
    }
    for (auto& pair : it->second->bitmaps) DeleteObject(pair.second);
    g_qrCodes.erase(it);
    ReleaseSRWLockExclusive(&g_qrLock);
    return true;
}

void 二维码_释放全部() {
    AcquireSRWLockExclusive(&g_qrLock);
    for (auto& pair : g_qrCodes)
        for (auto& bmp : pair.second->bitmaps) DeleteObject(bmp.second);
    g_qrCodes.clear();
    ReleaseSRWLockExclusive(&g_qrLock);
}

// ---------------------------------------------------------------------------
// 公开命令 · 识别侧
// ---------------------------------------------------------------------------
long long 二维码_识别PNG(const wchar_t* 路径) {
    g_qrRecError.clear();
    std::vector<unsigned char> bytes;
    std::wstring err;
    if (!readFileBytes(路径, bytes, err)) {
        g_qrRecError = err;
        return 0;
    }
    GrayImage img;
    if (!decodeImageBytesToGray(bytes, img, err)) {
        g_qrRecError = err;
        return 0;
    }
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

long long 二维码_识别位图(long long 位图句柄) {
    g_qrRecError.clear();
    const HBITMAP bmp = reinterpret_cast<HBITMAP>(位图句柄);
    BITMAP bm = {};
    if (!bmp || !GetObjectW(bmp, sizeof(bm), &bm) || bm.bmWidth <= 0 || bm.bmHeight <= 0) {
        g_qrRecError = L"位图句柄无效。";
        return 0;
    }
    const int w = bm.bmWidth, h = std::abs(bm.bmHeight);
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = w;
    info.bmiHeader.biHeight = -h;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    std::vector<unsigned char> buffer(static_cast<size_t>(w) * h * 4);
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    const int got = GetDIBits(mem, bmp, 0, h, buffer.data(), &info, DIB_RGB_COLORS);
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    if (got == 0) {
        g_qrRecError = L"读取位图像素失败。";
        return 0;
    }
    const GrayImage img = grayFromBgra(w, h, buffer.data());
    std::wstring err;
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

long long 二维码_识别字节集(const std::vector<unsigned char>& 数据, int 宽度, int 高度, int 通道数) {
    g_qrRecError.clear();
    if (宽度 <= 0 || 高度 <= 0) {
        g_qrRecError = L"宽度与高度必须大于 0。";
        return 0;
    }
    if (通道数 != 1 && 通道数 != 3 && 通道数 != 4) {
        g_qrRecError = L"通道数只支持 1（灰度）、3（BGR）、4（BGRX）。";
        return 0;
    }
    if (数据.size() != static_cast<size_t>(宽度) * 高度 * 通道数) {
        g_qrRecError = L"字节集长度 " + std::to_wstring(数据.size()) + L" 与 宽度×高度×通道数 "
            + std::to_wstring(static_cast<long long>(宽度) * 高度 * 通道数) + L" 不一致。";
        return 0;
    }
    GrayImage img;
    img.w = 宽度;
    img.h = 高度;
    img.px.resize(static_cast<size_t>(宽度) * 高度);
    for (size_t i = 0; i < img.px.size(); ++i) {
        if (通道数 == 1) img.px[i] = 数据[i];
        else {
            const unsigned char bb = 数据[i * 通道数], gg = 数据[i * 通道数 + 1], rr = 数据[i * 通道数 + 2];
            img.px[i] = static_cast<unsigned char>((rr * 299 + gg * 587 + bb * 114) / 1000);
        }
    }
    std::wstring err;
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

long long 二维码_识别屏幕(int 横, int 纵, int 宽, int 高) {
    g_qrRecError.clear();
    if (宽 <= 0 || 高 <= 0) {
        g_qrRecError = L"截图区域的宽高必须大于 0。";
        return 0;
    }
    const int screenW = GetSystemMetrics(SM_CXSCREEN);
    const int screenH = GetSystemMetrics(SM_CYSCREEN);
    if (横 < 0 || 纵 < 0 || 横 + 宽 > screenW || 纵 + 高 > screenH) {
        g_qrRecError = L"截图区域越界：屏幕为 " + std::to_wstring(screenW) + L"×" + std::to_wstring(screenH)
            + L"，请求区域 (" + std::to_wstring(横) + L"," + std::to_wstring(纵) + L") "
            + std::to_wstring(宽) + L"×" + std::to_wstring(高) + L"。";
        return 0;
    }
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    HBITMAP bmp = CreateCompatibleBitmap(screen, 宽, 高);
    const HGDIOBJ old = SelectObject(mem, bmp);
    BitBlt(mem, 0, 0, 宽, 高, screen, 横, 纵, SRCCOPY | CAPTUREBLT);
    SelectObject(mem, old);
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = 宽;
    info.bmiHeader.biHeight = -高;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    std::vector<unsigned char> buffer(static_cast<size_t>(宽) * 高 * 4);
    const int got = GetDIBits(mem, bmp, 0, 高, buffer.data(), &info, DIB_RGB_COLORS);
    DeleteObject(bmp);
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    if (got == 0) {
        g_qrRecError = L"屏幕抓取失败。";
        return 0;
    }
    const GrayImage img = grayFromBgra(宽, 高, buffer.data());
    std::wstring err;
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

std::wstring 二维码_识别取文本(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? LB_ReturnText(s->text) : LB_ReturnText(L"");
}

std::vector<unsigned char> 二维码_识别取字节(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.raw : std::vector<unsigned char>();
}

int 二维码_识别取版本(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.version : 0;
}

int 二维码_识别取掩码(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.mask : -1;
}

std::wstring 二维码_识别取纠错级别(long long 结果) {
    const auto s = qrFindRec(结果);
    if (!s || s->dec.level < 0 || s->dec.level > 3) return LB_ReturnText(L"");
    return LB_ReturnText(LEVEL_WNAMES[s->dec.level]);
}

std::wstring 二维码_识别取模式(long long 结果) {
    const auto s = qrFindRec(结果);
    if (!s) return LB_ReturnText(L"");
    switch (s->dec.mode) {
        case MODE_NUMERIC: return LB_ReturnText(L"数字");
        case MODE_ALNUM: return LB_ReturnText(L"字母数字");
        case MODE_BYTE: return LB_ReturnText(L"字节");
        case MODE_KANJI: return LB_ReturnText(L"汉字");
        default: return LB_ReturnText(L"其它");
    }
}

int 二维码_识别取修复码字数(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.corrected : -1;
}

int 二维码_识别取定位点数(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->finders : -1;
}

int 二维码_识别取角点横坐标(long long 结果, int 索引, int 角点) {
    const auto s = qrFindRec(结果);
    if (!s || 索引 != 0 || 角点 < 0 || 角点 > 3 || !s->hasQuad) return -1;
    return s->quad.x[角点];
}

int 二维码_识别取角点纵坐标(long long 结果, int 索引, int 角点) {
    const auto s = qrFindRec(结果);
    if (!s || 索引 != 0 || 角点 < 0 || 角点 > 3 || !s->hasQuad) return -1;
    return s->quad.y[角点];
}

std::vector<unsigned char> 二维码_识别取外接四边形(long long 结果, int 索引) {
    const auto s = qrFindRec(结果);
    std::vector<unsigned char> out;
    if (!s || 索引 != 0 || !s->hasQuad) return out;
    out.resize(32);
    for (int i = 0; i < 4; ++i) {
        const int xi = s->quad.x[i], yi = s->quad.y[i];
        out[i * 8 + 0] = static_cast<unsigned char>(xi & 0xFF);
        out[i * 8 + 1] = static_cast<unsigned char>((xi >> 8) & 0xFF);
        out[i * 8 + 2] = static_cast<unsigned char>((xi >> 16) & 0xFF);
        out[i * 8 + 3] = static_cast<unsigned char>((xi >> 24) & 0xFF);
        out[i * 8 + 4] = static_cast<unsigned char>(yi & 0xFF);
        out[i * 8 + 5] = static_cast<unsigned char>((yi >> 8) & 0xFF);
        out[i * 8 + 6] = static_cast<unsigned char>((yi >> 16) & 0xFF);
        out[i * 8 + 7] = static_cast<unsigned char>((yi >> 24) & 0xFF);
    }
    return out;
}

std::wstring 二维码_识别取错误() {
    return LB_ReturnText(g_qrRecError);
}

bool 二维码_识别释放(long long 结果) {
    AcquireSRWLockExclusive(&g_qrLock);
    const bool ok = g_qrRecs.erase(结果) != 0;
    ReleaseSRWLockExclusive(&g_qrLock);
    return ok;
}

void 二维码_识别释放全部() {
    AcquireSRWLockExclusive(&g_qrLock);
    g_qrRecs.clear();
    ReleaseSRWLockExclusive(&g_qrLock);
}

// ---------------------------------------------------------------------------
// 自检：已知答案 + 全表 RS 伴随式 + 生成→渲染→识别 闭环 + 带损伤纠错
// ---------------------------------------------------------------------------
static bool qrSelfCheckInternal(std::wstring& report) {
    // 1) format 已知答案：M+掩码0 = 0x5412；M+掩码3 = 0x5B4B
    if (formatBitsValue(1, 0) != 0x5412) { report = L"format 已知答案失败：M+掩码0 应为 0x5412。"; return false; }
    if (formatBitsValue(1, 3) != 0x5B4B) { report = L"format 已知答案失败：M+掩码3 应为 0x5B4B。"; return false; }
    // 2) 版本选择已知答案："HELLO WORLD" → v1-M、21 模块
    {
        EncodeResult enc;
        std::wstring err;
        if (!encodeQrInternal("HELLO WORLD", EncodeOptions{ 1, 0, 0 }, enc, err)
            || enc.version != 1 || enc.size != 21) {
            report = L"已知答案失败：\"HELLO WORLD\" 应为版本 1、21 模块。";
            return false;
        }
    }
    // 3) M 级 v1-20 数据码字数与参考实现逐项核对
    static const int M_DATA_V1_20[20] = { 16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669 };
    for (int v = 1; v <= 20; ++v) {
        if (dataCodewords(v, 1) != M_DATA_V1_20[v - 1]) {
            report = L"分块表核对失败：版本 " + std::to_wstring(v) + L" 的 M 级数据码字数与标准不符。";
            return false;
        }
    }
    // 4) 全表 160 组合：字节模式满容量编码 → 每块 RS 伴随式必须全零
    for (int v = 1; v <= 40; ++v) for (int level = 0; level < 4; ++level) {
        const int dataCw = dataCodewords(v, level);
        if (dataCw <= 0) {
            report = L"分块表异常：版本 " + std::to_wstring(v) + L" 级别 " + std::to_wstring(level) + L"。";
            return false;
        }
        std::string payload;
        payload.resize(static_cast<size_t>(v <= 9 ? (dataCw * 8 - 16) / 8 : (dataCw * 8 - 24) / 8));
        for (size_t i = 0; i < payload.size(); ++i) payload[i] = static_cast<char>(0x21 + (i * 31 + 7) % 90);
        const std::vector<uint8_t> cw = interleave(payload, MODE_BYTE, v, level);
        if (static_cast<int>(cw.size()) != totalCodewords(v)) {
            report = L"码字总数异常：版本 " + std::to_wstring(v) + L"。";
            return false;
        }
        const int ecc = ECC_PER_BLOCK[level][v];
        const int blocks = NUM_BLOCKS[level][v];
        const int shortLen = dataCw / blocks;
        const int longCount = dataCw - shortLen * blocks;
        // 先反交织还原各块，再做伴随式校验
        std::vector<std::vector<uint8_t>> blockFull(blocks);
        {
            std::vector<std::vector<uint8_t>> dataOf(blocks);
            size_t pos = 0;
            for (int i = 0; i < shortLen + 1; ++i)
                for (int b = 0; b < blocks; ++b)
                    if (i < shortLen + (b < blocks - longCount ? 0 : 1)) dataOf[b].push_back(cw[pos++]);
            for (int i = 0; i < ecc; ++i)
                for (int b = 0; b < blocks; ++b) blockFull[b].push_back(cw[pos++]);
            for (int b = 0; b < blocks; ++b)
                blockFull[b].insert(blockFull[b].begin(), dataOf[b].begin(), dataOf[b].end());
        }
        for (int b = 0; b < blocks; ++b) {
            if (!rsSyndromeZero(blockFull[b], ecc)) {
                report = L"RS 伴随式校验失败：版本 " + std::to_wstring(v) + L" 级别 " + std::to_wstring(level) + L" 块 " + std::to_wstring(b + 1) + L"。";
                return false;
            }
        }
    }
    // 5) 闭环：生成 → 栅格化 → 识别，文本逐字节一致、版本/掩码/级别一致
    static const int LOOP_V[10] = { 1, 4, 7, 10, 15, 20, 25, 30, 35, 40 };
    for (int vi = 0; vi < 10; ++vi) for (int level = 0; level < 4; ++level) {
        const int v = LOOP_V[vi];
        const int target = (std::max)(1, dataCodewords(v, level) * 2 / 3);
        std::string payload;
        payload.reserve(static_cast<size_t>(target));
        static const char CHUNK[] = "QR\xE4\xBA\x8C\xE7\xBB\xB4\xE7\xA0\x81#9";
        while (static_cast<int>(payload.size()) < target) payload += CHUNK;
        payload.resize(static_cast<size_t>(target));
        EncodeResult enc;
        std::wstring err;
        if (!encodeQrInternal(payload, EncodeOptions{ level, v, MODE_BYTE }, enc, err)) {
            report = L"闭环失败：v" + std::to_wstring(v) + L"-" + LEVEL_WNAMES[level] + L" 编码失败：" + err;
            return false;
        }
        std::vector<unsigned char> pixels;
        bool gray = false;
        rasterizeMatrix(enc.matrix, enc.size, 3, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        const int size = (enc.size + 8) * 3;
        GrayImage img;
        img.w = size;
        img.h = size;
        img.px = pixels;
        DecodeOutput dec;
        int finders = 0;
        Quad quad;
        if (!decodeGrayImage(img, dec, finders, quad, err)) {
            report = L"闭环失败：v" + std::to_wstring(v) + L"-" + LEVEL_WNAMES[level] + L" 识别失败：" + err;
            return false;
        }
        if (dec.utf8 != payload || dec.version != enc.version || dec.mask != enc.mask || dec.level != level) {
            report = L"闭环失败：v" + std::to_wstring(v) + L"-" + LEVEL_WNAMES[level] + L" 回读不一致。";
            return false;
        }
    }
    // 6) 带损伤纠错：对 v5-M 扰动 6 个非功能图形模块（RS 可纠），必须原样解出
    {
        EncodeResult enc;
        std::wstring err;
        if (!encodeQrInternal("QR-ERROR-CORRECTION-CHECK-2026", EncodeOptions{ 1, 5, MODE_BYTE }, enc, err)) {
            report = L"损伤测试失败：编码阶段出错。";
            return false;
        }
        int flipped = 0;
        for (int r = 9; r < enc.size - 9 && flipped < 6; ++r)
            for (int c = 9; c < enc.size - 9 && flipped < 6; ++c)
                if (enc.matrix[static_cast<size_t>(r) * enc.size + c]) {
                    enc.matrix[static_cast<size_t>(r) * enc.size + c] = 0;
                    ++flipped;
                    c += 5;
                }
        std::vector<unsigned char> pixels;
        bool gray = false;
        rasterizeMatrix(enc.matrix, enc.size, 4, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        const int size = (enc.size + 8) * 4;
        GrayImage img;
        img.w = size;
        img.h = size;
        img.px = pixels;
        DecodeOutput dec;
        int finders = 0;
        Quad quad;
        if (!decodeGrayImage(img, dec, finders, quad, err) || dec.utf8 != "QR-ERROR-CORRECTION-CHECK-2026") {
            report = L"损伤测试失败：扰动后未能原样解出。";
            return false;
        }
    }
    report.clear();
    return true;
}

} // namespace lbqr

// ---------------------------------------------------------------------------
// 公开命令（全局命名空间，符号名与 bindings.runtimeName 一致）
// ---------------------------------------------------------------------------
std::wstring 二维码_取版本() { return lbqr::二维码_取版本(); }
long long 二维码_生成(const wchar_t* 内容, const wchar_t* 纠错级别, int 边长像素, int 空白边模块数) { return lbqr::二维码_生成(内容, 纠错级别, 边长像素, 空白边模块数); }
std::wstring 二维码_取错误() { return lbqr::二维码_取错误(); }
int 二维码_取模块数(long long 码) { return lbqr::二维码_取模块数(码); }
int 二维码_取版本号(long long 码) { return lbqr::二维码_取版本号(码); }
int 二维码_取掩码(long long 码) { return lbqr::二维码_取掩码(码); }
std::wstring 二维码_取纠错级别(long long 码) { return lbqr::二维码_取纠错级别(码); }
bool 二维码_取深色(long long 码, int 行, int 列) { return lbqr::二维码_取深色(码, 行, 列); }
bool 二维码_保存PNG(long long 码, const wchar_t* 路径, long long 前景色, long long 背景色) { return lbqr::二维码_保存PNG(码, 路径, 前景色, 背景色); }
long long 二维码_取位图(long long 码, long long 前景色, long long 背景色) { return lbqr::二维码_取位图(码, 前景色, 背景色); }
bool 二维码_释放(long long 码) { return lbqr::二维码_释放(码); }
void 二维码_释放全部() { lbqr::二维码_释放全部(); }
long long 二维码_识别PNG(const wchar_t* 路径) { return lbqr::二维码_识别PNG(路径); }
long long 二维码_识别位图(long long 位图句柄) { return lbqr::二维码_识别位图(位图句柄); }
long long 二维码_识别字节集(const std::vector<unsigned char>& 数据, int 宽度, int 高度, int 通道数) { return lbqr::二维码_识别字节集(数据, 宽度, 高度, 通道数); }
long long 二维码_识别屏幕(int 横, int 纵, int 宽, int 高) { return lbqr::二维码_识别屏幕(横, 纵, 宽, 高); }
std::wstring 二维码_识别取文本(long long 结果) { return lbqr::二维码_识别取文本(结果); }
std::vector<unsigned char> 二维码_识别取字节(long long 结果) { return lbqr::二维码_识别取字节(结果); }
int 二维码_识别取版本(long long 结果) { return lbqr::二维码_识别取版本(结果); }
int 二维码_识别取掩码(long long 结果) { return lbqr::二维码_识别取掩码(结果); }
std::wstring 二维码_识别取纠错级别(long long 结果) { return lbqr::二维码_识别取纠错级别(结果); }
std::wstring 二维码_识别取模式(long long 结果) { return lbqr::二维码_识别取模式(结果); }
int 二维码_识别取修复码字数(long long 结果) { return lbqr::二维码_识别取修复码字数(结果); }
int 二维码_识别取定位点数(long long 结果) { return lbqr::二维码_识别取定位点数(结果); }
int 二维码_识别取角点横坐标(long long 结果, int 索引, int 角点) { return lbqr::二维码_识别取角点横坐标(结果, 索引, 角点); }
int 二维码_识别取角点纵坐标(long long 结果, int 索引, int 角点) { return lbqr::二维码_识别取角点纵坐标(结果, 索引, 角点); }
std::vector<unsigned char> 二维码_识别取外接四边形(long long 结果, int 索引) { return lbqr::二维码_识别取外接四边形(结果, 索引); }
std::wstring 二维码_识别取错误() { return lbqr::二维码_识别取错误(); }
bool 二维码_识别释放(long long 结果) { return lbqr::二维码_识别释放(结果); }
void 二维码_识别释放全部() { lbqr::二维码_识别释放全部(); }
bool 二维码_自检() {
    lbqr::g_qrGenError.clear();
    std::wstring report;
    if (!lbqr::qrSelfCheckInternal(report)) {
        lbqr::g_qrGenError = report.empty() ? std::wstring(L"自检失败。") : report;
        return false;
    }
    return true;
}
`;

/** 模块启用时返回运行时源码，未启用返回空串。 */
export function generateQrCodeRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === QRCODE_MODULE_ID) ? QRCODE_RUNTIME : '';
}
