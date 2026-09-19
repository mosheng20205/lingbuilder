/**
 * 文本编解码内核：编码名称解析、BOM 检测、代码页编解码与自动识别的唯一实现。
 *
 * 编码转换模块、文件按编码读取、表格数据源内核和 SQLite 虚拟表运行时都拼接本片段；
 * 头文件保护宏保证同一编译单元多次拼接只生效一次，禁止在别处再写第二套代码页映射。
 */
export const TEXT_CODECS_RUNTIME = String.raw`
#ifndef LB_TEXT_CODECS_RUNTIME_INCLUDED
#define LB_TEXT_CODECS_RUNTIME_INCLUDED

enum class LB_EncodingKind { Unknown, Auto, Utf8, Utf16Le, Utf16Be, Utf32Le, Utf32Be, Ansi, Gbk, Gb2312, Gb18030 };

static std::wstring LB_NormalizeEncodingName(const wchar_t* name) {
    std::wstring result;
    for (wchar_t ch : LB_Wide(name)) {
        if (ch == L'-' || ch == L'_' || iswspace(ch)) continue;
        result.push_back(static_cast<wchar_t>(towupper(ch)));
    }
    return result;
}

static LB_EncodingKind LB_ParseEncodingKind(const wchar_t* name) {
    const std::wstring value = LB_NormalizeEncodingName(name);
    if (value.empty() || value == L"AUTO" || value == L"自动") return LB_EncodingKind::Auto;
    if (value == L"UTF8") return LB_EncodingKind::Utf8;
    if (value == L"UTF16LE" || value == L"UNICODE") return LB_EncodingKind::Utf16Le;
    if (value == L"UTF16BE") return LB_EncodingKind::Utf16Be;
    if (value == L"UTF32LE") return LB_EncodingKind::Utf32Le;
    if (value == L"UTF32BE") return LB_EncodingKind::Utf32Be;
    if (value == L"ANSI" || value == L"ACP" || value == L"SYSTEM") return LB_EncodingKind::Ansi;
    if (value == L"GBK" || value == L"CP936") return LB_EncodingKind::Gbk;
    if (value == L"GB2312") return LB_EncodingKind::Gb2312;
    if (value == L"GB18030" || value == L"CP54936") return LB_EncodingKind::Gb18030;
    return LB_EncodingKind::Unknown;
}

static const wchar_t* LB_EncodingKindName(LB_EncodingKind kind) {
    switch (kind) {
        case LB_EncodingKind::Auto: return L"AUTO";
        case LB_EncodingKind::Utf8: return L"UTF-8";
        case LB_EncodingKind::Utf16Le: return L"UTF-16LE";
        case LB_EncodingKind::Utf16Be: return L"UTF-16BE";
        case LB_EncodingKind::Utf32Le: return L"UTF-32LE";
        case LB_EncodingKind::Utf32Be: return L"UTF-32BE";
        case LB_EncodingKind::Ansi: return L"ANSI";
        case LB_EncodingKind::Gbk: return L"GBK";
        case LB_EncodingKind::Gb2312: return L"GB2312";
        case LB_EncodingKind::Gb18030: return L"GB18030";
        default: return L"";
    }
}

static LB_EncodingKind LB_DetectBomKind(const std::vector<unsigned char>& bytes, size_t* bomSize = nullptr) {
    LB_EncodingKind kind = LB_EncodingKind::Unknown;
    size_t size = 0;
    if (bytes.size() >= 4 && bytes[0] == 0xff && bytes[1] == 0xfe && bytes[2] == 0x00 && bytes[3] == 0x00) { kind = LB_EncodingKind::Utf32Le; size = 4; }
    else if (bytes.size() >= 4 && bytes[0] == 0x00 && bytes[1] == 0x00 && bytes[2] == 0xfe && bytes[3] == 0xff) { kind = LB_EncodingKind::Utf32Be; size = 4; }
    else if (bytes.size() >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf) { kind = LB_EncodingKind::Utf8; size = 3; }
    else if (bytes.size() >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe) { kind = LB_EncodingKind::Utf16Le; size = 2; }
    else if (bytes.size() >= 2 && bytes[0] == 0xfe && bytes[1] == 0xff) { kind = LB_EncodingKind::Utf16Be; size = 2; }
    if (bomSize) *bomSize = size;
    return kind;
}

static std::vector<unsigned char> LB_BomBytes(LB_EncodingKind kind) {
    switch (kind) {
        case LB_EncodingKind::Utf8: return { 0xef, 0xbb, 0xbf };
        case LB_EncodingKind::Utf16Le: return { 0xff, 0xfe };
        case LB_EncodingKind::Utf16Be: return { 0xfe, 0xff };
        case LB_EncodingKind::Utf32Le: return { 0xff, 0xfe, 0x00, 0x00 };
        case LB_EncodingKind::Utf32Be: return { 0x00, 0x00, 0xfe, 0xff };
        default: return {};
    }
}

static bool LB_WideToCodePoints(const wchar_t* text, std::vector<uint32_t>& points) {
    const std::wstring value = LB_Wide(text);
    points.clear();
    points.reserve(value.size());
    for (size_t index = 0; index < value.size(); ++index) {
        const uint32_t first = static_cast<uint16_t>(value[index]);
        if (first >= 0xd800 && first <= 0xdbff) {
            if (index + 1 >= value.size()) return false;
            const uint32_t second = static_cast<uint16_t>(value[index + 1]);
            if (second < 0xdc00 || second > 0xdfff) return false;
            points.push_back(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00));
            ++index;
            continue;
        }
        if (first >= 0xdc00 && first <= 0xdfff) return false;
        points.push_back(first);
    }
    return true;
}

static bool LB_CodePointsToWide(const std::vector<uint32_t>& points, std::wstring& text) {
    text.clear();
    for (uint32_t point : points) {
        if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) { text.clear(); return false; }
        if (point <= 0xffff) text.push_back(static_cast<wchar_t>(point));
        else {
            point -= 0x10000;
            text.push_back(static_cast<wchar_t>(0xd800 + (point >> 10)));
            text.push_back(static_cast<wchar_t>(0xdc00 + (point & 0x3ff)));
        }
    }
    return true;
}

static bool LB_IsGb2312Bytes(const std::vector<unsigned char>& bytes) {
    for (size_t index = 0; index < bytes.size();) {
        if (bytes[index] <= 0x7f) { ++index; continue; }
        if (index + 1 >= bytes.size() || bytes[index] < 0xa1 || bytes[index] > 0xf7 || bytes[index + 1] < 0xa1 || bytes[index + 1] > 0xfe) return false;
        index += 2;
    }
    return true;
}

static bool LB_WideToCodePage(const wchar_t* text, UINT requestedCodePage, std::vector<unsigned char>& bytes) {
    const std::wstring value = LB_Wide(text);
    bytes.clear();
    if (value.empty()) return true;
    const UINT codePage = requestedCodePage == CP_ACP ? GetACP() : requestedCodePage;
    const bool strictUnicodeCodePage = codePage == CP_UTF8 || codePage == 54936;
    const DWORD flags = strictUnicodeCodePage ? WC_ERR_INVALID_CHARS : WC_NO_BEST_FIT_CHARS;
    BOOL usedDefault = FALSE;
    BOOL* usedDefaultPointer = strictUnicodeCodePage ? nullptr : &usedDefault;
    const int size = WideCharToMultiByte(codePage, flags, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, usedDefaultPointer);
    if (size <= 0 || usedDefault) return false;
    bytes.resize(static_cast<size_t>(size));
    if (WideCharToMultiByte(codePage, flags, value.data(), static_cast<int>(value.size()), reinterpret_cast<char*>(bytes.data()), size, nullptr, usedDefaultPointer) != size || usedDefault) {
        bytes.clear(); return false;
    }
    return true;
}

static bool LB_CodePageToWide(const std::vector<unsigned char>& bytes, UINT requestedCodePage, std::wstring& text) {
    text.clear();
    if (bytes.empty()) return true;
    const UINT codePage = requestedCodePage == CP_ACP ? GetACP() : requestedCodePage;
    const DWORD flags = codePage == CP_UTF8 || codePage == 54936 ? MB_ERR_INVALID_CHARS : 0;
    const int size = MultiByteToWideChar(codePage, flags, reinterpret_cast<const char*>(bytes.data()), static_cast<int>(bytes.size()), nullptr, 0);
    if (size <= 0) return false;
    text.resize(static_cast<size_t>(size));
    if (MultiByteToWideChar(codePage, flags, reinterpret_cast<const char*>(bytes.data()), static_cast<int>(bytes.size()), text.data(), size) != size) {
        text.clear(); return false;
    }
    return true;
}

static bool LB_EncodeTextBytes(const wchar_t* text, LB_EncodingKind kind, std::vector<unsigned char>& bytes) {
    bytes.clear();
    if (kind == LB_EncodingKind::Auto) kind = LB_EncodingKind::Utf8;
    if (kind == LB_EncodingKind::Utf8) return LB_WideToCodePage(text, CP_UTF8, bytes);
    if (kind == LB_EncodingKind::Ansi) return LB_WideToCodePage(text, CP_ACP, bytes);
    if (kind == LB_EncodingKind::Gbk || kind == LB_EncodingKind::Gb2312) {
        if (!LB_WideToCodePage(text, 936, bytes)) return false;
        if (kind == LB_EncodingKind::Gb2312 && !LB_IsGb2312Bytes(bytes)) { bytes.clear(); return false; }
        return true;
    }
    if (kind == LB_EncodingKind::Gb18030) return LB_WideToCodePage(text, 54936, bytes);

    std::vector<uint32_t> points;
    if (!LB_WideToCodePoints(text, points)) return false;
    if (kind == LB_EncodingKind::Utf16Le || kind == LB_EncodingKind::Utf16Be) {
        const bool little = kind == LB_EncodingKind::Utf16Le;
        const std::wstring value = LB_Wide(text);
        bytes.reserve(value.size() * 2);
        for (wchar_t character : value) {
            const uint16_t unit = static_cast<uint16_t>(character);
            const unsigned char low = static_cast<unsigned char>(unit & 0xff);
            const unsigned char high = static_cast<unsigned char>((unit >> 8) & 0xff);
            bytes.push_back(little ? low : high); bytes.push_back(little ? high : low);
        }
        return true;
    }
    if (kind == LB_EncodingKind::Utf32Le || kind == LB_EncodingKind::Utf32Be) {
        const bool little = kind == LB_EncodingKind::Utf32Le;
        bytes.reserve(points.size() * 4);
        for (uint32_t point : points) {
            const unsigned char a = static_cast<unsigned char>(point & 0xff);
            const unsigned char b = static_cast<unsigned char>((point >> 8) & 0xff);
            const unsigned char c = static_cast<unsigned char>((point >> 16) & 0xff);
            const unsigned char d = static_cast<unsigned char>((point >> 24) & 0xff);
            if (little) bytes.insert(bytes.end(), { a, b, c, d });
            else bytes.insert(bytes.end(), { d, c, b, a });
        }
        return true;
    }
    return false;
}

static bool LB_DecodeTextBytes(std::vector<unsigned char> bytes, LB_EncodingKind kind, std::wstring& text) {
    text.clear();
    if (kind == LB_EncodingKind::Unknown) return false;
    size_t bomSize = 0;
    const LB_EncodingKind bomKind = LB_DetectBomKind(bytes, &bomSize);
    if (kind == LB_EncodingKind::Auto) kind = bomKind == LB_EncodingKind::Unknown ? LB_EncodingKind::Utf8 : bomKind;
    if (bomSize > 0 && (kind == bomKind)) bytes.erase(bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(bomSize));
    if (kind == LB_EncodingKind::Utf8) return LB_CodePageToWide(bytes, CP_UTF8, text);
    if (kind == LB_EncodingKind::Ansi) return LB_CodePageToWide(bytes, CP_ACP, text);
    if (kind == LB_EncodingKind::Gbk || kind == LB_EncodingKind::Gb2312) {
        if (kind == LB_EncodingKind::Gb2312 && !LB_IsGb2312Bytes(bytes)) return false;
        return LB_CodePageToWide(bytes, 936, text);
    }
    if (kind == LB_EncodingKind::Gb18030) return LB_CodePageToWide(bytes, 54936, text);
    if (kind == LB_EncodingKind::Utf16Le || kind == LB_EncodingKind::Utf16Be) {
        if (bytes.size() % 2 != 0) return false;
        const bool little = kind == LB_EncodingKind::Utf16Le;
        std::vector<uint32_t> points;
        for (size_t index = 0; index < bytes.size(); index += 2) {
            const uint16_t unit = little
                ? static_cast<uint16_t>(bytes[index] | (static_cast<uint16_t>(bytes[index + 1]) << 8))
                : static_cast<uint16_t>((static_cast<uint16_t>(bytes[index]) << 8) | bytes[index + 1]);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                if (index + 3 >= bytes.size()) return false;
                index += 2;
                const uint16_t second = little
                    ? static_cast<uint16_t>(bytes[index] | (static_cast<uint16_t>(bytes[index + 1]) << 8))
                    : static_cast<uint16_t>((static_cast<uint16_t>(bytes[index]) << 8) | bytes[index + 1]);
                if (second < 0xdc00 || second > 0xdfff) return false;
                points.push_back(0x10000 + ((unit - 0xd800) << 10) + (second - 0xdc00));
            } else {
                if (unit >= 0xdc00 && unit <= 0xdfff) return false;
                points.push_back(unit);
            }
        }
        return LB_CodePointsToWide(points, text);
    }
    if (kind == LB_EncodingKind::Utf32Le || kind == LB_EncodingKind::Utf32Be) {
        if (bytes.size() % 4 != 0) return false;
        const bool little = kind == LB_EncodingKind::Utf32Le;
        std::vector<uint32_t> points;
        points.reserve(bytes.size() / 4);
        for (size_t index = 0; index < bytes.size(); index += 4) {
            const uint32_t point = little
                ? static_cast<uint32_t>(bytes[index]) | (static_cast<uint32_t>(bytes[index + 1]) << 8) | (static_cast<uint32_t>(bytes[index + 2]) << 16) | (static_cast<uint32_t>(bytes[index + 3]) << 24)
                : (static_cast<uint32_t>(bytes[index]) << 24) | (static_cast<uint32_t>(bytes[index + 1]) << 16) | (static_cast<uint32_t>(bytes[index + 2]) << 8) | static_cast<uint32_t>(bytes[index + 3]);
            points.push_back(point);
        }
        return LB_CodePointsToWide(points, text);
    }
    return false;
}

// 自动识别固定三级：BOM -> 严格 UTF-8 -> GB18030 兜底（GBK/GB2312 都是 GB18030 子集）。
// 不做启发式猜测，避免把合法但语义错误的字节流当成某种中文编码。
static LB_EncodingKind LB_AutoDetectEncodingKind(const std::vector<unsigned char>& bytes) {
    size_t bomSize = 0;
    const LB_EncodingKind bomKind = LB_DetectBomKind(bytes, &bomSize);
    if (bomKind != LB_EncodingKind::Unknown) return bomKind;
    std::wstring probe;
    if (LB_CodePageToWide(bytes, CP_UTF8, probe)) return LB_EncodingKind::Utf8;
    return LB_EncodingKind::Gb18030;
}

static bool LB_ReadFileBytes(const wchar_t* path, std::vector<unsigned char>& bytes, std::wstring& error) {
    bytes.clear();
    error.clear();
    std::ifstream stream(std::filesystem::path(LB_Wide(path)), std::ios::binary | std::ios::ate);
    if (!stream) { error = L"无法打开文件：" + LB_Wide(path); return false; }
    const std::streamoff size = stream.tellg();
    if (size < 0) { error = L"读取文件长度失败：" + LB_Wide(path); return false; }
    stream.seekg(0, std::ios::beg);
    bytes.resize(static_cast<size_t>(size));
    if (!bytes.empty() && !stream.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()))) {
        bytes.clear();
        error = L"读取文件内容失败：" + LB_Wide(path);
        return false;
    }
    return true;
}

// 编码名称解析失败必须显式报错，不得静默退回默认编码，否则中文内容会以错误编码入库。
static bool LB_ResolveEncodingKind(const wchar_t* encodingName, const std::vector<unsigned char>& bytes, LB_EncodingKind& kind) {
    kind = LB_ParseEncodingKind(encodingName);
    if (kind == LB_EncodingKind::Unknown) return false;
    if (kind == LB_EncodingKind::Auto) kind = LB_AutoDetectEncodingKind(bytes);
    return true;
}

static bool LB_DecodeFileText(const wchar_t* path, const wchar_t* encodingName, std::wstring& text, std::wstring& error) {
    text.clear();
    std::vector<unsigned char> bytes;
    if (!LB_ReadFileBytes(path, bytes, error)) return false;
    LB_EncodingKind kind = LB_EncodingKind::Unknown;
    if (!LB_ResolveEncodingKind(encodingName, bytes, kind)) {
        error = std::wstring(L"不支持的编码名称：") + LB_Wide(encodingName) + L"；可用 AUTO、UTF-8、UTF-16LE、UTF-16BE、UTF-32LE、UTF-32BE、ANSI、GBK、GB2312、GB18030。";
        return false;
    }
    if (!LB_DecodeTextBytes(std::move(bytes), kind, text)) {
        text.clear();
        error = L"按 " + std::wstring(LB_EncodingKindName(kind)) + L" 解码失败：" + LB_Wide(path) + L"；内容不是该编码的合法字节序列。";
        return false;
    }
    return true;
}

#endif // LB_TEXT_CODECS_RUNTIME_INCLUDED
`;
