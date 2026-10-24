// lb_pngcodec.h — LingBuilder 自带 PNG 编解码单头（word-bridge 图片嵌入 / barcode 识别输入共用）。
// 依赖：miniz.h（tinfl 解压 / tdefl 压缩 / mz_crc32），须在包含路径上提供。
// 约束：本文件内容会被脚本内联进生成器运行时（String.raw 注入），不得出现反引号与 ${ 序列。
// 能力边界：解码支持颜色型 0/2/3/4/6、位深 8（16 位折半）、非隔行；编码输出 8 位 RGB/灰度。
#ifndef LB_PNGCODEC_H
#define LB_PNGCODEC_H

#include "miniz.h"

#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>

namespace lbpng {

struct Image {
    int width = 0;
    int height = 0;
    int channels = 3; // 1=灰度 3=RGB 4=RGBA
    std::vector<uint8_t> pixels; // 紧凑行序，无行尾填充
};

inline uint32_t readU32be(const uint8_t* p) {
    return (uint32_t(p[0]) << 24) | (uint32_t(p[1]) << 16) | (uint32_t(p[2]) << 8) | uint32_t(p[3]);
}

inline void writeU32be(std::vector<uint8_t>& out, uint32_t value) {
    out.push_back(uint8_t(value >> 24)); out.push_back(uint8_t(value >> 16));
    out.push_back(uint8_t(value >> 8)); out.push_back(uint8_t(value));
}

inline void paeth(uint8_t a, uint8_t b, uint8_t c, uint8_t& out) {
    int p = int(a) + int(b) - int(c);
    int pa = p > int(a) ? p - int(a) : int(a) - p;
    int pb = p > int(b) ? p - int(b) : int(b) - p;
    int pc = p > int(c) ? p - int(c) : int(c) - p;
    out = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

inline void unfilterRow(const uint8_t* row, const uint8_t* prev, uint8_t* out, int filter, int bpp, int rowBytes) {
    for (int i = 0; i < rowBytes; i++) {
        int left = i >= bpp ? out[i - bpp] : 0;
        int up = prev ? prev[i] : 0;
        int ul = (prev && i >= bpp) ? prev[i - bpp] : 0;
        int v = row[i];
        switch (filter) {
            case 1: v += left; break;
            case 2: v += up; break;
            case 3: v += (left + up) / 2; break;
            case 4: { uint8_t pred = 0; paeth(uint8_t(left), uint8_t(up), uint8_t(ul), pred); v += pred; break; }
            default: break;
        }
        out[i] = uint8_t(v);
    }
}

// 解码 PNG 字节集；失败返回 false 并写 reason（可传 nullptr）。
inline bool decode(const uint8_t* data, size_t size, Image& image, std::string* reason) {
    auto fail = [&](const char* what) {
        if (reason) *reason = what;
        return false;
    };
    if (size < 8 || data[0] != 0x89 || data[1] != 'P' || data[2] != 'N' || data[3] != 'G') return fail("不是 PNG 文件");
    const uint8_t* pos = data + 8;
    const uint8_t* end = data + size;
    int width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
    std::vector<uint8_t> idat;
    std::vector<uint8_t> palette;      // RGB 三元组
    std::vector<uint8_t> transparency; // PLTE 透明表
    while (pos + 8 <= end) {
        uint32_t len = readU32be(pos);
        const uint8_t* type = pos + 4;
        const uint8_t* body = pos + 8;
        if (body + len + 4 > end) return fail("PNG 数据截断");
        if (!memcmp(type, "IHDR", 4) && len == 13) {
            width = int(readU32be(body));
            height = int(readU32be(body + 4));
            bitDepth = body[8];
            colorType = body[9];
            interlace = body[12];
        } else if (!memcmp(type, "PLTE", 4)) {
            palette.assign(body, body + len);
        } else if (!memcmp(type, "tRNS", 4)) {
            transparency.assign(body, body + len);
        } else if (!memcmp(type, "IDAT", 4)) {
            idat.insert(idat.end(), body, body + len);
        } else if (!memcmp(type, "IEND", 4)) {
            break;
        }
        pos = body + len + 4;
    }
    if (width <= 0 || height <= 0) return fail("PNG 尺寸非法");
    if (bitDepth != 8 && bitDepth != 16) return fail("仅支持 8/16 位深的 PNG");
    if (interlace != 0) return fail("暂不支持隔行 PNG");
    int srcChannels = colorType == 0 ? 1 : colorType == 2 ? 3 : colorType == 4 ? 2 : colorType == 6 ? 4 : 1;
    size_t inflated = 0;
    void* raw = tinfl_decompress_mem_to_heap(idat.data(), idat.size(), &inflated, 0);
    if (!raw) return fail("PNG 解压失败");
    size_t rowBytes = size_t(width) * srcChannels * (bitDepth == 16 ? 2 : 1);
    std::vector<uint8_t> raws(static_cast<uint8_t*>(raw), static_cast<uint8_t*>(raw) + inflated);
    mz_free(raw);
    if (raws.size() < (rowBytes + 1) * size_t(height)) return fail("PNG 数据不完整");
    image.width = width;
    image.height = height;
    image.channels = (colorType == 3 && transparency.size() >= 3) ? 4 : (colorType == 0 || colorType == 3) ? 3 : (colorType == 4 ? 3 : colorType == 6 ? 4 : 3);
    image.pixels.assign(size_t(width) * height * image.channels, 0);
    std::vector<uint8_t> cur(rowBytes), prev(rowBytes, 0);
    for (int y = 0; y < height; y++) {
        int filter = raws[y * (rowBytes + 1)];
        unfilterRow(raws.data() + y * (rowBytes + 1) + 1, y ? prev.data() : nullptr, cur.data(), filter, srcChannels * (bitDepth == 16 ? 2 : 1), int(rowBytes));
        for (int x = 0; x < width; x++) {
            uint8_t* dst = &image.pixels[(size_t(y) * width + x) * image.channels];
            size_t si = size_t(x) * srcChannels;
            auto sample = [&](int c) { return bitDepth == 16 ? cur[si + c * 2] : cur[si + c]; };
            switch (colorType) {
                case 0: dst[0] = dst[1] = dst[2] = sample(0); break;
                case 2: dst[0] = sample(0); dst[1] = sample(1); dst[2] = sample(2); break;
                case 3: {
                    int idx = cur[si];
                    if (palette.size() >= size_t(idx) * 3 + 3) {
                        dst[0] = palette[size_t(idx) * 3];
                        dst[1] = palette[size_t(idx) * 3 + 1];
                        dst[2] = palette[size_t(idx) * 3 + 2];
                    }
                    if (image.channels == 4) dst[3] = size_t(idx) < transparency.size() ? transparency[idx] : 255;
                    break;
                }
                case 4: dst[0] = dst[1] = dst[2] = sample(0); break;
                case 6: dst[0] = sample(0); dst[1] = sample(1); dst[2] = sample(2); dst[3] = sample(3); break;
                default: break;
            }
        }
        prev = cur;
    }
    return true;
}

inline void writeChunk(std::vector<uint8_t>& out, const char* type, const uint8_t* body, size_t len) {
    writeU32be(out, uint32_t(len));
    out.insert(out.end(), type, type + 4);
    if (len) out.insert(out.end(), body, body + len);
    uint32_t crc = mz_crc32(MZ_CRC32_INIT, reinterpret_cast<const mz_uint8*>(type), 4);
    if (len) crc = mz_crc32(crc, body, len);
    writeU32be(out, crc);
}

// 编码 RGB(channels=3) 或灰度(channels=1) 为 PNG 字节集。
inline bool encode(const Image& image, std::vector<uint8_t>& out) {
    if (image.width <= 0 || image.height <= 0) return false;
    int ch = image.channels == 1 ? 1 : 3;
    size_t rowBytes = size_t(image.width) * ch;
    std::vector<uint8_t> raw((rowBytes + 1) * image.height);
    for (int y = 0; y < image.height; y++) {
        raw[size_t(y) * (rowBytes + 1)] = 0; // filter none
        if (ch == 1) {
            for (int x = 0; x < image.width; x++) {
                uint8_t g = image.pixels[(size_t(y) * image.width + x) * image.channels];
                raw[size_t(y) * (rowBytes + 1) + 1 + x] = g;
            }
        } else {
            for (int x = 0; x < image.width; x++) {
                const uint8_t* src = &image.pixels[(size_t(y) * image.width + x) * image.channels];
                uint8_t* dst = &raw[size_t(y) * (rowBytes + 1) + 1 + size_t(x) * 3];
                dst[0] = src[0]; dst[1] = src[1]; dst[2] = src[2];
            }
        }
    }
    size_t deflated = 0;
    void* compressed = tdefl_compress_mem_to_heap(raw.data(), raw.size(), &deflated, 128 /* 默认压缩级 */);
    if (!compressed) return false;
    const uint8_t header[8] = {0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    out.assign(header, header + 8);
    uint8_t ih[13];
    ih[0] = uint8_t(image.width >> 24); ih[1] = uint8_t(image.width >> 16); ih[2] = uint8_t(image.width >> 8); ih[3] = uint8_t(image.width);
    ih[4] = uint8_t(image.height >> 24); ih[5] = uint8_t(image.height >> 16); ih[6] = uint8_t(image.height >> 8); ih[7] = uint8_t(image.height);
    ih[8] = 8; ih[9] = ch == 1 ? 0 : 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
    writeChunk(out, "IHDR", ih, 13);
    writeChunk(out, "IDAT", static_cast<const uint8_t*>(compressed), deflated);
    writeChunk(out, "IEND", nullptr, 0);
    mz_free(compressed);
    return true;
}

} // namespace lbpng

#endif // LB_PNGCODEC_H
