// ============================================================================
// lb_wxocr_core.cpp — LingBuilder 微信OCR识别模块核心（lingbuilder.ocr 1.0.0）
//
// 借用模式：不随包分发任何腾讯文件。运行时探测本机已安装的微信 4.x，
// 加载其 mmmojo_64.dll，由 mmmojo 拉起 Weixin.exe --type=wxocr 组件子进程，
// 通过 protobuf（本地 IPC）完成握手与识别，返回行级文本/坐标/置信度。
//
// 红线：
//   * 仅支持 64 位构建（微信 4.x 只有 64 位组件）；32 位下全部命令降级为
//     返回 0/空文本并写中文错误。
//   * mmmojo 模块加载后不得 FreeLibrary（其内部线程无法安全停止，卸载必崩），
//     进程内单会话懒启动，OCR_停止 只停环境不卸模块。
//   * 本文件同时用于两个场景：
//       1) 生成器注入：经 scripts/generate-wxocr-runtime.ts 转成 TS String.raw
//          模板拼进生成的 C++ 工程（仅 x64 有效）。
//       2) 独立编译：native/wxocr/tests/driver_main.cpp 直接 include 本文件验收。
//   * 内容不得出现反引号字符与美元符号花括号序列（String.raw 注入安全）。
//
// 协议事实（对微信 4.x WeChatOcr 组件的观察，多实现交叉验证）：
//   * 握手 request_id=10001 OCRSupportMessage{supported(1):bool}
//   * 识别 request_id=10010 ParseOCRReqMessage{task_id(1),pic_path(2),rt(6){t1,t2}}
//   * 结果 request_id=10011 ParseOCRRespMessage{task_id(1),err_code(2),res(3)}
//     OCRResultInfo{lines(3)[]{text(2),rate(3),left(5),top(6),right(7),bottom(8)},
//                   img_width(4),img_height(5)}
// ============================================================================

#ifndef LB_WXOCR_RUNTIME_INCLUDED
#define LB_WXOCR_RUNTIME_INCLUDED

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <string>
#include <vector>
#include <map>
#include <set>
#include <memory>
#include <mutex>
#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <algorithm>

namespace lbwxocr {

// ---------------------------------------------------------------------------
// 错误通道（当前线程最近一次中文错误，对齐 qrcode 模块口径）
// ---------------------------------------------------------------------------
inline thread_local std::wstring g_lastError;

inline void setError(const std::wstring& msg) { g_lastError = msg; }
inline void clearError() { g_lastError.clear(); }

// ---------------------------------------------------------------------------
// 路径与探测
// ---------------------------------------------------------------------------

struct WxOcrPaths {
    std::wstring versionDir;   // 微信版本目录（含 mmmojo_64.dll）
    std::wstring weixinExe;    // 微信主程序（版本目录上一级 Weixin.exe）
    std::wstring appPath;      // OCR 插件 extracted 目录（含 wxocr.dll）
    std::wstring wxocrDll;     // wxocr.dll 完整路径
    std::wstring pluginVer;    // OCR 插件版本号（目录名）
};

inline bool fileExists(const std::wstring& path) {
    const DWORD attr = GetFileAttributesW(path.c_str());
    return attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY);
}

inline std::wstring joinPath(const std::wstring& dir, const std::wstring& name) {
    if (dir.empty()) return name;
    if (dir.back() == L'\\' || dir.back() == L'/') return dir + name;
    return dir + L"\\" + name;
}

inline std::wstring parentDir(const std::wstring& path) {
    const size_t pos = path.find_last_of(L"\\/");
    if (pos == std::wstring::npos || pos == 0) return std::wstring();
    return path.substr(0, pos);
}

// 四段版本号比较：返回负数 a<b、0 相等、正数 a>b。
inline int compareVersionDirs(const std::wstring& a, const std::wstring& b) {
    unsigned long long va[4] = {0, 0, 0, 0}, vb[4] = {0, 0, 0, 0};
    int pa = 0, pb = 0;
    for (int i = 0; i < 4; ++i) {
        va[i] = wcstoull(a.c_str() + pa, nullptr, 10);
        vb[i] = wcstoull(b.c_str() + pb, nullptr, 10);
        const size_t da = a.find(L'.', pa), db = b.find(L'.', pb);
        pa = (da == std::wstring::npos) ? static_cast<int>(a.size()) : static_cast<int>(da + 1);
        pb = (db == std::wstring::npos) ? static_cast<int>(b.size()) : static_cast<int>(db + 1);
    }
    for (int i = 0; i < 4; ++i) {
        if (va[i] != vb[i]) return va[i] < vb[i] ? -1 : 1;
    }
    return 0;
}

// 枚举目录下含 mmmojo_64.dll 的版本号子目录，取版本最大者。
inline bool findLatestVersionDir(const std::wstring& root, std::wstring& bestVer) {
    const std::wstring pattern = joinPath(root, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pattern.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE) return false;
    bool found = false;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) continue;
        if (fd.cFileName[0] == L'.') continue;
        bool numeric = fd.cFileName[0] != 0;
        for (const wchar_t* p = fd.cFileName; *p; ++p) {
            if ((*p < L'0' || *p > L'9') && *p != L'.') { numeric = false; break; }
        }
        if (!numeric) continue;
        if (!fileExists(joinPath(joinPath(root, fd.cFileName), L"mmmojo_64.dll"))) continue;
        if (!found || compareVersionDirs(fd.cFileName, bestVer) > 0) {
            bestVer = fd.cFileName;
            found = true;
        }
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    return found;
}

// 枚举 WeChatOcr 插件目录下含 extracted\wxocr.dll 的版本号子目录，取最大者。
inline bool findLatestOcrPlugin(const std::wstring& pluginsRoot, std::wstring& bestVer, std::wstring& extractedDir) {
    const std::wstring pattern = joinPath(pluginsRoot, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pattern.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE) return false;
    bool found = false;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) continue;
        if (fd.cFileName[0] == L'.') continue;
        bool numeric = fd.cFileName[0] != 0;
        for (const wchar_t* p = fd.cFileName; *p; ++p) {
            if ((*p < L'0' || *p > L'9') && *p != L'.') { numeric = false; break; }
        }
        if (!numeric) continue;
        const std::wstring dir = joinPath(joinPath(pluginsRoot, fd.cFileName), L"extracted");
        if (!fileExists(joinPath(dir, L"wxocr.dll"))) continue;
        if (!found || compareVersionDirs(fd.cFileName, bestVer) > 0) {
            bestVer = fd.cFileName;
            extractedDir = dir;
            found = true;
        }
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    return found;
}

inline std::wstring getEnvW(const wchar_t* name) {
    wchar_t buf[1024];
    const DWORD n = GetEnvironmentVariableW(name, buf, 1024);
    if (n == 0 || n >= 1024) return std::wstring();
    return std::wstring(buf, n);
}

// 探测本机微信与 OCR 组件；不启动任何进程。失败时写入中文错误。
inline bool detectWeChatOcr(WxOcrPaths& out) {
    // 1) 环境变量覆盖（开发调试用）
    const std::wstring envDll = getEnvW(L"LINGBUILDER_WXOCR_DLL");
    const std::wstring envDir = getEnvW(L"LINGBUILDER_WXOCR_DIR");
    if (!envDll.empty() && !envDir.empty()) {
        if (!fileExists(envDll) || GetFileAttributesW(envDir.c_str()) == INVALID_FILE_ATTRIBUTES) {
            setError(L"环境变量指定的微信OCR路径无效：wxocr.dll 或微信版本目录不存在。");
            return false;
        }
        out.wxocrDll = envDll;
        out.versionDir = envDir;
        out.appPath = parentDir(envDll);
        out.weixinExe = joinPath(parentDir(envDir), L"Weixin.exe");
        out.pluginVer = L"env";
        if (!fileExists(out.weixinExe)) {
            setError(L"未在微信版本目录上一级找到 Weixin.exe，无法启动 OCR 组件进程。");
            return false;
        }
        return true;
    }

    // 2) 微信版本目录：Program Files 常见安装位置
    std::wstring root;
    std::wstring bestVer;
    bool found = false;
    const std::wstring pf = getEnvW(L"ProgramFiles");
    const std::wstring pf86 = getEnvW(L"ProgramFiles(x86)");
    for (int pass = 0; pass < 2 && !found; ++pass) {
        const std::wstring& base = (pass == 0) ? pf : pf86;
        if (base.empty()) continue;
        root = joinPath(joinPath(base, L"Tencent"), L"Weixin");
        if (findLatestVersionDir(root, bestVer)) found = true;
    }
    if (!found) {
        setError(L"未在本机找到微信 4.x（请先安装 Windows 版微信；本模块借用其 OCR 组件）。");
        return false;
    }
    out.versionDir = joinPath(root, bestVer);
    out.weixinExe = joinPath(parentDir(out.versionDir), L"Weixin.exe");
    if (!fileExists(out.weixinExe)) {
        setError(L"找到微信版本目录但缺少 Weixin.exe，安装可能不完整，请重装微信。");
        return false;
    }

    // 3) OCR 插件：XPlugin\Plugins\WeChatOcr\<ver>\extracted\wxocr.dll
    const std::wstring appData = getEnvW(L"APPDATA");
    if (appData.empty()) {
        setError(L"无法读取用户 APPDATA 目录。");
        return false;
    }
    const std::wstring pluginsRoot = appData + L"\\Tencent\\xwechat\\XPlugin\\Plugins\\WeChatOcr";
    if (!findLatestOcrPlugin(pluginsRoot, out.pluginVer, out.appPath)) {
        setError(L"本机微信尚未下载 OCR 组件：请在微信里使用一次截图文字识别（或完整登录一次），"
                 L"等其自动下载 WeChatOcr 插件后重试。");
        return false;
    }
    out.wxocrDll = joinPath(out.appPath, L"wxocr.dll");
    return true;
}

// ---------------------------------------------------------------------------
// 编码转换
// ---------------------------------------------------------------------------

inline std::string utf8FromWide(const std::wstring& w) {
    if (w.empty()) return std::string();
    const int need = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), static_cast<int>(w.size()), nullptr, 0, nullptr, nullptr);
    std::string out(static_cast<size_t>(need > 0 ? need : 0), 0);
    if (need > 0) WideCharToMultiByte(CP_UTF8, 0, w.c_str(), static_cast<int>(w.size()), &out[0], need, nullptr, nullptr);
    return out;
}

inline std::wstring wideFromUtf8(const std::string& s) {
    if (s.empty()) return std::wstring();
    const int need = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
    std::wstring out(static_cast<size_t>(need > 0 ? need : 0), 0);
    if (need > 0) MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), &out[0], need);
    return out;
}

// ---------------------------------------------------------------------------
// protobuf wire format（手写，零依赖）
// ---------------------------------------------------------------------------

inline void pbVarint(std::string& out, uint64_t v) {
    while (v >= 0x80) {
        out.push_back(static_cast<char>((v & 0x7F) | 0x80));
        v >>= 7;
    }
    out.push_back(static_cast<char>(v));
}

inline void pbTag(std::string& out, uint32_t field, uint32_t wire) {
    pbVarint(out, (static_cast<uint64_t>(field) << 3) | wire);
}

inline void pbString(std::string& out, uint32_t field, const std::string& s) {
    pbTag(out, field, 2);
    pbVarint(out, s.size());
    out.append(s);
}

inline void pbMessage(std::string& out, uint32_t field, const std::string& inner) {
    pbTag(out, field, 2);
    pbVarint(out, inner.size());
    out.append(inner);
}

inline void pbVarintField(std::string& out, uint32_t field, uint64_t v) {
    if (v == 0) return; // proto3 默认值不发送
    pbTag(out, field, 0);
    pbVarint(out, v);
}

struct PbReader {
    const uint8_t* p;
    const uint8_t* end;
    bool ok;
    explicit PbReader(const void* data, size_t size)
        : p(static_cast<const uint8_t*>(data)), end(p + size), ok(true) {}
    bool atEnd() const { return ok && p >= end; }
    uint64_t readVarint() {
        uint64_t v = 0;
        int shift = 0;
        while (ok) {
            if (p >= end) { ok = false; break; }
            const uint8_t b = *p++;
            v |= static_cast<uint64_t>(b & 0x7F) << shift;
            if (!(b & 0x80)) return v;
            if ((shift += 7) >= 70) { ok = false; break; } // 溢出防护
        }
        return v;
    }
    uint32_t readTag() { return static_cast<uint32_t>(readVarint()); }
    std::string readBytes() {
        const uint64_t len = readVarint();
        if (!ok || p + len > end) { ok = false; return std::string(); }
        std::string s(reinterpret_cast<const char*>(p), static_cast<size_t>(len));
        p += len;
        return s;
    }
    float readFixed32f() {
        uint32_t v = 0;
        if (!ok || p + 4 > end) { ok = false; return 0.0f; }
        memcpy(&v, p, 4);
        p += 4;
        float f;
        memcpy(&f, &v, 4);
        return f;
    }
    void skip(uint32_t wire) {
        if (!ok) return;
        if (wire == 0) { readVarint(); }
        else if (wire == 1) { if (p + 8 > end) ok = false; else p += 8; }
        else if (wire == 2) { readBytes(); }
        else if (wire == 5) { if (p + 4 > end) ok = false; else p += 4; }
        else { ok = false; }
    }
};

// 编码识别请求：ParseOCRReqMessage{ task_id(1), pic_path(2), rt(6){t1(1)=1,t2(2)=1} }；
// 字节集入口追加 pic_data(5)+xx3(3)/xx4(4)（内存图像：像素或文件字节形态由调用方决定）。
inline std::string encodeOcrRequest(uint64_t taskId, const std::string& picPathUtf8, const std::string* picData = nullptr, uint32_t pixelW = 0, uint32_t pixelH = 0) {
    std::string rt;
    pbVarintField(rt, 1, 1);
    pbVarintField(rt, 2, 1);
    std::string req;
    pbVarintField(req, 1, taskId);
    pbString(req, 2, picPathUtf8);
    if (pixelW) pbVarintField(req, 3, pixelW);
    if (pixelH) pbVarintField(req, 4, pixelH);
    if (picData && !picData->empty()) pbString(req, 5, *picData);
    pbMessage(req, 6, rt);
    return req;
}

struct OcrCharBox {
    std::wstring chars;
    float left = 0, top = 0, right = 0, bottom = 0;
};

struct OcrLine {
    std::wstring text;
    double rate = 0;
    float left = 0, top = 0, right = 0, bottom = 0;
    std::vector<OcrCharBox> charBoxes;
};

struct OcrResultData {
    int errcode = 0;
    int width = 0, height = 0;
    std::vector<OcrLine> lines;
};

inline OcrLine decodeLine(PbReader& r, size_t len);

// OCRResultChar：char_box(1) Box{topleft(1)/topright(2)/bottomright(3)/bottomleft(4) Point{x(1),y(2)}},chars(2)
inline OcrCharBox decodeChar(PbReader& r, size_t len) {
    OcrCharBox cb;
    const uint8_t* const subEnd = r.p + len;
    uint32_t state = 0;
    float x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0;
    while (!r.atEnd() && r.p < subEnd && r.ok) {
        const uint32_t tag = r.readTag();
        if (!r.ok) break;
        const uint32_t field = tag >> 3, wire = tag & 7;
        if (field == 1 && wire == 2) {
            const std::string box = r.readBytes();
            PbReader br(box.data(), box.size());
            while (!br.atEnd() && br.ok) {
                const uint32_t btag = br.readTag();
                if (!br.ok) break;
                const uint32_t bfield = btag >> 3, bwire = btag & 7;
                if (bwire != 2) { br.skip(bwire); continue; }
                const std::string pt = br.readBytes();
                PbReader pr(pt.data(), pt.size());
                float px = 0, py = 0;
                while (!pr.atEnd() && pr.ok) {
                    const uint32_t ptag = pr.readTag();
                    if (!pr.ok) break;
                    const uint32_t pfield = ptag >> 3, pwire = ptag & 7;
                    if (pfield == 1 && pwire == 5) px = pr.readFixed32f();
                    else if (pfield == 2 && pwire == 5) py = pr.readFixed32f();
                    else pr.skip(pwire);
                }
                if (bfield == 1) { x0 = px; y0 = py; }
                else if (bfield == 2) { x1 = px; y1 = py; }
                else if (bfield == 3) { x2 = px; y2 = py; }
                else if (bfield == 4) { x3 = px; y3 = py; }
            }
            state |= 2;
        } else if (field == 2 && wire == 2) {
            cb.chars = wideFromUtf8(r.readBytes());
            state |= 1;
        } else {
            r.skip(wire);
        }
    }
    if (r.p > subEnd) r.ok = false;
    if ((state & 3) == 3) {
        cb.left = std::min(x0, x3);
        cb.top = std::min(y0, y1);
        cb.right = std::max(x1, x2);
        cb.bottom = std::max(y2, y3);
    }
    return cb;
}

// OCRResultLine：text(2),rate(3),blocks(4),left(5),top(6),right(7),bottom(8)
inline OcrLine decodeLine(PbReader& r, size_t len) {
    OcrLine line;
    const uint8_t* const subEnd = r.p + len;
    while (!r.atEnd() && r.p < subEnd && r.ok) {
        const uint32_t tag = r.readTag();
        if (!r.ok) break;
        const uint32_t field = tag >> 3, wire = tag & 7;
        if (field == 2 && wire == 2) {
            line.text = wideFromUtf8(r.readBytes());
        } else if (field == 3 && wire == 5) {
            line.rate = r.readFixed32f();
        } else if (field == 5 && wire == 5) {
            line.left = r.readFixed32f();
        } else if (field == 6 && wire == 5) {
            line.top = r.readFixed32f();
        } else if (field == 7 && wire == 5) {
            line.right = r.readFixed32f();
        } else if (field == 8 && wire == 5) {
            line.bottom = r.readFixed32f();
        } else if (field == 4 && wire == 2) {
            const std::string cb = r.readBytes();
            PbReader cr(cb.data(), cb.size());
            line.charBoxes.push_back(decodeChar(cr, cb.size()));
            if (!cr.ok) r.ok = false;
        } else {
            r.skip(wire);
        }
    }
    if (r.p > subEnd) r.ok = false;
    return line;
}

// OCRResultInfo：lines(3),img_width(4),img_height(5)
inline bool decodeResultInfo(const std::string& data, OcrResultData& out) {
    PbReader r(data.data(), data.size());
    while (!r.atEnd() && r.ok) {
        const uint32_t tag = r.readTag();
        if (!r.ok) break;
        const uint32_t field = tag >> 3, wire = tag & 7;
        if (field == 3 && wire == 2) {
            const std::string line = r.readBytes();
            PbReader lr(line.data(), line.size());
            out.lines.push_back(decodeLine(lr, line.size()));
            if (!lr.ok) r.ok = false;
        } else if (field == 4) {
            out.width = static_cast<int>(r.readVarint());
        } else if (field == 5) {
            out.height = static_cast<int>(r.readVarint());
        } else {
            r.skip(wire);
        }
    }
    return r.ok;
}

// ParseOCRRespMessage：task_id(1),err_code(2),res(3)
inline bool decodeOcrResponse(const std::string& data, uint64_t& taskId, int& errCode, OcrResultData& out) {
    PbReader r(data.data(), data.size());
    taskId = 0;
    errCode = 0;
    while (!r.atEnd() && r.ok) {
        const uint32_t tag = r.readTag();
        if (!r.ok) break;
        const uint32_t field = tag >> 3, wire = tag & 7;
        if (field == 1) {
            taskId = r.readVarint();
        } else if (field == 2) {
            errCode = static_cast<int>(static_cast<int32_t>(r.readVarint()));
        } else if (field == 3 && wire == 2) {
            const std::string res = r.readBytes();
            if (!decodeResultInfo(res, out)) r.ok = false;
        } else {
            r.skip(wire);
        }
    }
    return r.ok;
}

#ifdef _WIN64

// ---------------------------------------------------------------------------
// mmmojo 动态绑定（仅 x64；模块加载后永不卸载）
// ---------------------------------------------------------------------------

enum MmMethod { kMmNone = 0, kMmPush = 1, kMmPullReq = 2, kMmPullResp = 3, kMmShared = 4 };
enum MmCallbackType {
    kMmUserData = 0, kMmReadPush = 1, kMmReadPull = 2, kMmReadShared = 3,
    kMmRemoteConnect = 4, kMmRemoteDisconnect = 5, kMmRemoteProcessLaunched = 6,
    kMmRemoteProcessLaunchFailed = 7, kMmRemoteMojoError = 8
};
enum MmInitParamType { kMmHostProcess = 0, kMmLoopStartThread = 1, kMmExePath = 2 };

constexpr uint32_t kRequestIdHandShake = 10001;
constexpr uint32_t kRequestIdReqOcr = 10010;
constexpr uint32_t kRequestIdRespOcr = 10011;

struct MmApi {
    HMODULE module = nullptr;
    const void* (*GetMMMojoReadInfoRequest)(const void*, uint32_t*) = nullptr;
    int (*GetMMMojoReadInfoMethod)(const void*) = nullptr;
    bool (*GetMMMojoReadInfoSync)(const void*) = nullptr;
    void (*RemoveMMMojoReadInfo)(const void*) = nullptr;
    void* (*CreateMMMojoWriteInfo)(int, bool, uint32_t) = nullptr;
    void* (*GetMMMojoWriteInfoRequest)(void*, size_t) = nullptr;
    bool (*SendMMMojoWriteInfo)(void*, void*) = nullptr;
    void (*RemoveMMMojoWriteInfo)(void*) = nullptr;
    void* (*CreateMMMojoEnvironment)() = nullptr;
    void (*SetMMMojoEnvironmentCallbacks)(void*, int, ...) = nullptr;
    void (*SetMMMojoEnvironmentInitParams)(void*, int, ...) = nullptr;
    void (*AppendMMSubProcessSwitchNative)(void*, const char*, const wchar_t*) = nullptr;
    void (*StartMMMojoEnvironment)(void*) = nullptr;
    void (*StopMMMojoEnvironment)(void*) = nullptr;
    void (*RemoveMMMojoEnvironment)(void*) = nullptr;
    void (*InitializeMMMojo)(int, const char* const*) = nullptr;

    bool load(const std::wstring& versionDir) {
        if (module) return true;
        const std::wstring dll = joinPath(versionDir, L"mmmojo_64.dll");
        module = LoadLibraryW(dll.c_str());
        if (!module) return false;
#define LBWX_BIND(name) \
        name = reinterpret_cast<decltype(name)>(reinterpret_cast<void*>(GetProcAddress(module, #name))); \
        if (!name) return false;
        LBWX_BIND(GetMMMojoReadInfoRequest)
        LBWX_BIND(GetMMMojoReadInfoMethod)
        LBWX_BIND(GetMMMojoReadInfoSync)
        LBWX_BIND(RemoveMMMojoReadInfo)
        LBWX_BIND(CreateMMMojoWriteInfo)
        LBWX_BIND(GetMMMojoWriteInfoRequest)
        LBWX_BIND(SendMMMojoWriteInfo)
        LBWX_BIND(RemoveMMMojoWriteInfo)
        LBWX_BIND(CreateMMMojoEnvironment)
        LBWX_BIND(SetMMMojoEnvironmentCallbacks)
        LBWX_BIND(SetMMMojoEnvironmentInitParams)
        LBWX_BIND(AppendMMSubProcessSwitchNative)
        LBWX_BIND(StartMMMojoEnvironment)
        LBWX_BIND(StopMMMojoEnvironment)
        LBWX_BIND(RemoveMMMojoEnvironment)
        LBWX_BIND(InitializeMMMojo)
#undef LBWX_BIND
        return true;
    }
};

// ---------------------------------------------------------------------------
// 会话单例：懒启动、握手、识别、停止
// ---------------------------------------------------------------------------
class WxOcrSession {
public:
    static WxOcrSession& instance() {
        static WxOcrSession s;
        return s;
    }

    // 探测 + 启动 + 等待握手；失败写中文错误并复位到待启动态。
    bool ensureStarted() {
        std::unique_lock<std::mutex> lock(m_mutex);
        if (m_state == kReady) return true;
        if (m_state == kStarting) {
            m_cvState.wait_for(lock, std::chrono::milliseconds(15000), [this] { return m_state != kStarting; });
            return m_state == kReady;
        }
        if (!detectWeChatOcr(m_paths)) return false;
        m_state = kStarting;
        if (!m_api.load(m_paths.versionDir)) {
            setError(L"加载微信 mmmojo_64.dll 失败（路径：" + m_paths.versionDir + L"）。");
            m_state = kIdle;
            return false;
        }
        m_api.InitializeMMMojo(0, nullptr);
        m_env = m_api.CreateMMMojoEnvironment();
        if (!m_env) {
            setError(L"创建 mmmojo 环境失败。");
            m_state = kIdle;
            return false;
        }
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmUserData, this);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmReadPush, &WxOcrSession::onReadThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmReadPull, &WxOcrSession::onReadThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmReadShared, &WxOcrSession::onReadSharedThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmRemoteConnect, &WxOcrSession::onConnectThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmRemoteDisconnect, &WxOcrSession::onDisconnectThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmRemoteProcessLaunched, &WxOcrSession::onLaunchedThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmRemoteProcessLaunchFailed, &WxOcrSession::onLaunchFailedThunk);
        m_api.SetMMMojoEnvironmentCallbacks(m_env, kMmRemoteMojoError, &WxOcrSession::onErrorThunk);
        m_api.SetMMMojoEnvironmentInitParams(m_env, kMmHostProcess, true);
        m_api.SetMMMojoEnvironmentInitParams(m_env, kMmExePath, m_paths.weixinExe.c_str());
        // 组件进程开关：与微信主程序拉起 OCR 组件的命令行同构
        m_api.AppendMMSubProcessSwitchNative(m_env, "no-sandbox", L"");
        m_api.AppendMMSubProcessSwitchNative(m_env, "user-lib-dir", m_paths.versionDir.c_str());
        m_api.AppendMMSubProcessSwitchNative(m_env, "type", L"wxocr");
        m_api.AppendMMSubProcessSwitchNative(m_env, "app-path", m_paths.appPath.c_str());
        m_lastErrorInfo.clear();
        m_api.StartMMMojoEnvironment(m_env);
        if (!m_cvState.wait_for(lock, std::chrono::milliseconds(15000), [this] { return m_state == kReady || m_state == kIdle; })) {
            setError(L"等待微信 OCR 组件握手超时（15 秒）。"
                     + (m_lastErrorInfo.empty() ? std::wstring() : std::wstring(L"组件错误：") + m_lastErrorInfo));
            stopLocked();
            return false;
        }
        if (m_state != kReady) {
            if (g_lastError.empty()) setError(L"微信 OCR 组件握手失败（不支持或组件异常）。");
            stopLocked();
            return false;
        }
        return true;
    }

    // 同步识别：picPathUtf8 必须是绝对路径；picData 非空时走内存入口（像素或文件字节由调用方决定）。
    bool doOcr(const std::string& picPathUtf8, OcrResultData& out, const std::string* picData = nullptr, uint32_t pixelW = 0, uint32_t pixelH = 0) {
        std::unique_lock<std::mutex> lock(m_mutex);
        if (m_state != kReady) {
            lock.unlock();
            if (!ensureStarted()) return false;
            lock.lock();
        }
        const uint64_t taskId = m_taskSeq++;
        if (m_taskSeq > 0x7FFFFFFFull) m_taskSeq = 2;
        m_pending.insert(taskId);
        const std::string req = encodeOcrRequest(taskId, picPathUtf8, picData, pixelW, pixelH);
        void* wi = m_api.CreateMMMojoWriteInfo(kMmPush, false, kRequestIdReqOcr);
        if (!wi) {
            m_pending.erase(taskId);
            setError(L"构造 OCR 请求失败。");
            return false;
        }
        void* buf = m_api.GetMMMojoWriteInfoRequest(wi, req.size());
        if (!buf) {
            m_api.RemoveMMMojoWriteInfo(wi);
            m_pending.erase(taskId);
            setError(L"分配 OCR 请求缓冲失败。");
            return false;
        }
        memcpy(buf, req.data(), req.size());
        if (!m_api.SendMMMojoWriteInfo(m_env, wi)) {
            m_api.RemoveMMMojoWriteInfo(wi);
            m_pending.erase(taskId);
            setError(L"发送 OCR 请求失败（组件进程可能已退出，可执行 OCR_停止 后重试）。");
            m_state = kIdle;
            return false;
        }
        if (!m_cvDone.wait_for(lock, std::chrono::milliseconds(120000), [this, taskId] { return m_pending.find(taskId) == m_pending.end(); })) {
            m_pending.erase(taskId);
            setError(L"OCR 识别超时（120 秒）。");
            return false;
        }
        auto it = m_results.find(taskId);
        if (it == m_results.end()) {
            setError(L"OCR 结果丢失。");
            return false;
        }
        out = it->second;
        m_results.erase(it);
        if (out.errcode != 0) {
            setError(L"微信 OCR 组件返回错误码 " + std::to_wstring(out.errcode) + L"（图片格式可能不支持或已损坏）。");
            return false;
        }
        return true;
    }

    void stop() {
        std::lock_guard<std::mutex> lock(m_mutex);
        stopLocked();
    }

private:
    enum State { kIdle = 0, kStarting = 1, kReady = 2 };

    WxOcrSession() = default;
    ~WxOcrSession() = default;
    WxOcrSession(const WxOcrSession&) = delete;
    WxOcrSession& operator=(const WxOcrSession&) = delete;

    void stopLocked() {
        if (m_env) {
            m_state = kIdle;
            if (m_api.StopMMMojoEnvironment) m_api.StopMMMojoEnvironment(m_env);
            if (m_api.RemoveMMMojoEnvironment) m_api.RemoveMMMojoEnvironment(m_env);
            m_env = nullptr;
            m_cvState.notify_all();
        } else {
            m_state = kIdle;
        }
        m_pending.clear();
        m_results.clear();
        m_cvDone.notify_all();
    }

    // ---- mmmojo 回调（外部线程，快速取数据后在锁内更新状态） ----
    void onRead(uint32_t requestId, const void* readInfo) {
        uint32_t size = 0;
        const void* data = m_api.GetMMMojoReadInfoRequest(readInfo, &size);
        std::string payload(size ? static_cast<const char*>(data) : nullptr, size);
        m_api.RemoveMMMojoReadInfo(readInfo);
        if (requestId == kRequestIdHandShake) {
            // OCRSupportMessage{supported(1):bool}
            bool supported = false;
            PbReader r(payload.data(), payload.size());
            while (!r.atEnd() && r.ok) {
                const uint32_t tag = r.readTag();
                if (!r.ok) break;
                if ((tag >> 3) == 1) supported = r.readVarint() != 0;
                else r.skip(tag & 7);
            }
            std::lock_guard<std::mutex> lock(m_mutex);
            if (m_state == kStarting) {
                if (supported) {
                    m_state = kReady;
                } else {
                    setError(L"本机微信 OCR 组件报告不支持 OCR。");
                }
                m_cvState.notify_all();
            }
        } else if (requestId == kRequestIdRespOcr) {
            uint64_t taskId = 0;
            int errCode = 0;
            OcrResultData res;
            decodeOcrResponse(payload, taskId, errCode, res);
            res.errcode = errCode;
            std::lock_guard<std::mutex> lock(m_mutex);
            if (m_pending.erase(taskId) > 0) {
                m_results[taskId] = std::move(res);
                m_cvDone.notify_all();
            }
        }
    }

    void onConnect(bool connected) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (!connected && m_state == kReady) {
            // 组件进程断开：回到待启动态，下次识别自动重启
            m_state = kIdle;
        }
    }

    void onLaunchFailed(int code) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (m_state == kStarting) {
            setError(L"启动微信 OCR 组件进程失败（错误 " + std::to_wstring(code) + L"）。");
            m_state = kIdle;
            m_cvState.notify_all();
        }
    }

    void onError(const void* buf, int size) {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_lastErrorInfo = wideFromUtf8(std::string(static_cast<const char*>(buf), size > 0 ? static_cast<size_t>(size) : 0));
    }

    static void onReadThunk(uint32_t requestId, const void* readInfo, void* userData) {
        static_cast<WxOcrSession*>(userData)->onRead(requestId, readInfo);
    }
    static bool onReadSharedThunk(uint32_t requestId, const void* readInfo, void* userData) {
        static_cast<WxOcrSession*>(userData)->onRead(requestId, readInfo);
        return true;
    }
    static void onConnectThunk(bool connected, void* userData) {
        static_cast<WxOcrSession*>(userData)->onConnect(connected);
    }
    static void onDisconnectThunk(void* userData) {
        static_cast<WxOcrSession*>(userData)->onConnect(false);
    }
    static void onLaunchedThunk(void*) {}
    static void onLaunchFailedThunk(int code, void* userData) {
        static_cast<WxOcrSession*>(userData)->onLaunchFailed(code);
    }
    static void onErrorThunk(const void* buf, int size, void* userData) {
        static_cast<WxOcrSession*>(userData)->onError(buf, size);
    }

    MmApi m_api;
    void* m_env = nullptr;
    WxOcrPaths m_paths;
    State m_state = kIdle;
    uint64_t m_taskSeq = 2;
    std::set<uint64_t> m_pending;
    std::map<uint64_t, OcrResultData> m_results;
    std::wstring m_lastErrorInfo;
    std::mutex m_mutex;
    std::condition_variable m_cvState;
    std::condition_variable m_cvDone;
};

#endif // _WIN64

// ---------------------------------------------------------------------------
// 结果句柄表
// ---------------------------------------------------------------------------
inline std::mutex g_storeMutex;
inline std::map<long long, std::shared_ptr<OcrResultData>> g_store;
inline std::atomic<long long> g_nextHandle{1};

inline long long storeResult(OcrResultData&& data) {
    const long long id = g_nextHandle.fetch_add(1);
    std::lock_guard<std::mutex> lock(g_storeMutex);
    g_store[id] = std::make_shared<OcrResultData>(std::move(data));
    return id;
}

inline std::shared_ptr<OcrResultData> fetchResult(long long handle) {
    std::lock_guard<std::mutex> lock(g_storeMutex);
    auto it = g_store.find(handle);
    return it == g_store.end() ? nullptr : it->second;
}

inline bool releaseResult(long long handle) {
    std::lock_guard<std::mutex> lock(g_storeMutex);
    return g_store.erase(handle) > 0;
}

// ---------------------------------------------------------------------------
// JSON 输出（UTF-16）
// ---------------------------------------------------------------------------
inline void jsonEscape(std::wstring& out, const std::wstring& s) {
    for (wchar_t c : s) {
        switch (c) {
            case L'"': out += L"\\\""; break;
            case L'\\': out += L"\\\\"; break;
            case L'\n': out += L"\\n"; break;
            case L'\r': out += L"\\r"; break;
            case L'\t': out += L"\\t"; break;
            default:
                if (c < 0x20) {
                    wchar_t buf[8];
                    swprintf(buf, 8, L"\\u%04x", static_cast<unsigned>(c));
                    out += buf;
                } else {
                    out += c;
                }
        }
    }
}

inline std::wstring formatDouble(double v) {
    wchar_t buf[64];
    swprintf(buf, 64, L"%.4f", v);
    std::wstring s = buf;
    while (!s.empty() && s.back() == L'0') s.pop_back();
    if (!s.empty() && s.back() == L'.') s.pop_back();
    return s.empty() ? L"0" : s;
}

inline std::wstring resultToJson(const OcrResultData& data) {
    std::wstring out = L"{\"errcode\":";
    out += std::to_wstring(data.errcode);
    out += L",\"width\":";
    out += std::to_wstring(data.width);
    out += L",\"height\":";
    out += std::to_wstring(data.height);
    out += L",\"lines\":[";
    for (size_t i = 0; i < data.lines.size(); ++i) {
        const OcrLine& ln = data.lines[i];
        if (i) out += L",";
        out += L"{\"text\":\"";
        jsonEscape(out, ln.text);
        out += L"\",\"rate\":";
        out += formatDouble(ln.rate);
        out += L",\"left\":";
        out += formatDouble(ln.left);
        out += L",\"top\":";
        out += formatDouble(ln.top);
        out += L",\"right\":";
        out += formatDouble(ln.right);
        out += L",\"bottom\":";
        out += formatDouble(ln.bottom);
        out += L",\"chars\":[";
        for (size_t j = 0; j < ln.charBoxes.size(); ++j) {
            const OcrCharBox& cb = ln.charBoxes[j];
            if (j) out += L",";
            out += L"{\"chars\":\"";
            jsonEscape(out, cb.chars);
            out += L"\",\"left\":";
            out += formatDouble(cb.left);
            out += L",\"top\":";
            out += formatDouble(cb.top);
            out += L",\"right\":";
            out += formatDouble(cb.right);
            out += L",\"bottom\":";
            out += formatDouble(cb.bottom);
            out += L"}";
        }
        out += L"]}";
    }
    out += L"]}";
    return out;
}

} // namespace lbwxocr

// ============================================================================
// 公开命令（与模块清单 bindings 同名；生成器零绑定直译调用）
// ============================================================================

std::wstring OCR_取版本() {
    return L"lingbuilder.ocr 1.0.0（借用本机微信 4.x OCR 组件；仅支持 64 位构建）";
}

std::wstring OCR_取微信状态() {
    lbwxocr::clearError();
    std::wstring out;
#ifdef _WIN64
    lbwxocr::WxOcrPaths paths;
    if (lbwxocr::detectWeChatOcr(paths)) {
        out = L"{\"found\":true,\"versionDir\":\"";
        lbwxocr::jsonEscape(out, paths.versionDir);
        out += L"\",\"pluginVersion\":\"";
        lbwxocr::jsonEscape(out, paths.pluginVer);
        out += L"\",\"wxocrDll\":\"";
        lbwxocr::jsonEscape(out, paths.wxocrDll);
        out += L"\"}";
    } else {
        out = L"{\"found\":false,\"error\":\"";
        lbwxocr::jsonEscape(out, lbwxocr::g_lastError);
        out += L"\"}";
    }
#else
    out = L"{\"found\":false,\"error\":\"微信OCR 组件仅支持 64 位程序，请切换 x64 构建平台。\"}";
#endif
    return out;
}

std::wstring OCR_取错误() {
    return lbwxocr::g_lastError;
}

bool OCR_停止() {
    lbwxocr::clearError();
#ifdef _WIN64
    lbwxocr::WxOcrSession::instance().stop();
    return true;
#else
    lbwxocr::setError(L"微信OCR 组件仅支持 64 位程序，请切换 x64 构建平台。");
    return false;
#endif
}

long long OCR_识别(const wchar_t* 图片路径) {
    lbwxocr::clearError();
    if (!图片路径 || !*图片路径) {
        lbwxocr::setError(L"图片路径不能为空。");
        return 0;
    }
#ifdef _WIN64
    // 组件要求绝对路径（UTF-8 传递）
    wchar_t absBuf[1024];
    const DWORD n = GetFullPathNameW(图片路径, 1024, absBuf, nullptr);
    if (n == 0 || n >= 1024) {
        lbwxocr::setError(L"解析图片绝对路径失败。");
        return 0;
    }
    if (!lbwxocr::fileExists(absBuf)) {
        lbwxocr::setError(L"图片文件不存在：" + std::wstring(图片路径));
        return 0;
    }
    lbwxocr::OcrResultData data;
    if (!lbwxocr::WxOcrSession::instance().doOcr(lbwxocr::utf8FromWide(absBuf), data)) {
        return 0;
    }
    return lbwxocr::storeResult(std::move(data));
#else
    lbwxocr::setError(L"微信OCR 组件仅支持 64 位程序（微信 4.x 无 32 位组件），请切换 x64 构建平台。");
    return 0;
#endif
}

// 字节集识别入口：数据为图片文件内容（PNG/JPG/BMP 等微信可解码格式）。
// 判断字节集是否为剪贴板 DIB 裸数据（BITMAPINFOHEADER 起，无 14 字节 BITMAPFILEHEADER）。
// 剪贴板_取图片字节集 返回 DIBV5/DIB；组件解码器只认图片文件字节，这里补 BITMAPFILEHEADER 转 BMP。
inline bool looksLikeRawDib(const std::vector<unsigned char>& data) {
    if (data.size() < 40 + 1) return false;
    if (data[0] == 'B' && data[1] == 'M') return false; // 已是 BMP 文件
    unsigned long headerSize = 0;
    std::memcpy(&headerSize, data.data(), 4);
    if (headerSize != 40 && headerSize != 52 && headerSize != 56 && headerSize != 108 && headerSize != 124) return false;
    unsigned short planes = 0, bitCount = 0;
    std::memcpy(&planes, data.data() + 12, 2);
    std::memcpy(&bitCount, data.data() + 14, 2);
    if (planes != 1) return false;
    if (bitCount != 16 && bitCount != 24 && bitCount != 32 && bitCount != 8 && bitCount != 4 && bitCount != 1) return false;
    return true;
}

inline std::vector<unsigned char> wrapDibAsBmp(const std::vector<unsigned char>& dib) {
    unsigned long headerSize = 0;
    std::memcpy(&headerSize, dib.data(), 4);
    unsigned short bitCount = 0;
    std::memcpy(&bitCount, dib.data() + 14, 2);
    unsigned long colorsUsed = 0;
    std::memcpy(&colorsUsed, dib.data() + 32, 4);
    if (colorsUsed == 0 && bitCount <= 8) colorsUsed = 1u << bitCount;
    const unsigned long pixelOffset = 14 + headerSize + colorsUsed * 4;
    std::vector<unsigned char> bmp;
    bmp.reserve(dib.size() + 14);
    bmp.push_back('B');
    bmp.push_back('M');
    const unsigned long fileSize = static_cast<unsigned long>(dib.size()) + 14;
    for (int i = 0; i < 4; ++i) bmp.push_back(static_cast<unsigned char>((fileSize >> (8 * i)) & 0xFF));
    bmp.push_back(0); bmp.push_back(0); bmp.push_back(0); bmp.push_back(0);
    for (int i = 0; i < 4; ++i) bmp.push_back(static_cast<unsigned char>((pixelOffset >> (8 * i)) & 0xFF));
    bmp.insert(bmp.end(), dib.begin(), dib.end());
    return bmp;
}

long long OCR_识别字节集(const std::vector<unsigned char>& 图片数据) {
    lbwxocr::clearError();
    if (图片数据.empty()) {
        lbwxocr::setError(L"图片数据不能为空。");
        return 0;
    }
#ifdef _WIN64
    // 剪贴板 DIB 裸数据补 BITMAPFILEHEADER 转 BMP（剪贴板_取图片字节集 的产物形态）。
    if (looksLikeRawDib(图片数据)) {
        return OCR_识别字节集(wrapDibAsBmp(图片数据));
    }
    // 优先按文件字节直传（pic_data）；组件拒绝（错误码 4）时回退临时文件路径识别。
    lbwxocr::OcrResultData data;
    const std::string picData(reinterpret_cast<const char*>(图片数据.data()), 图片数据.size());
    if (lbwxocr::WxOcrSession::instance().doOcr(std::string(), data, &picData)) {
        return lbwxocr::storeResult(std::move(data));
    }
    // 回退：写入 %TEMP% 独立目录下的临时 PNG/JPG，用路径通道识别后立即删除。
    wchar_t tempDir[MAX_PATH];
    const DWORD n = GetTempPathW(MAX_PATH, tempDir);
    if (n == 0 || n >= MAX_PATH) {
        lbwxocr::setError(L"获取临时目录失败，字节集识别不可用。");
        return 0;
    }
    CreateDirectoryW((std::wstring(tempDir) + L"LingBuilderOcr").c_str(), nullptr);
    wchar_t name[64];
    swprintf(name, 64, L"\\lb-%llu-%d.img", static_cast<unsigned long long>(GetTickCount64()), static_cast<int>(GetCurrentThreadId()));
    const std::wstring tempFile = std::wstring(tempDir) + L"LingBuilderOcr" + name;
    HANDLE f = CreateFileW(tempFile.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, nullptr);
    if (f == INVALID_HANDLE_VALUE) {
        lbwxocr::setError(L"创建字节集识别临时文件失败。");
        return 0;
    }
    DWORD written = 0;
    const BOOL ok = WriteFile(f, 图片数据.data(), static_cast<DWORD>(图片数据.size()), &written, nullptr) && written == 图片数据.size();
    CloseHandle(f);
    if (!ok) {
        DeleteFileW(tempFile.c_str());
        lbwxocr::setError(L"写入字节集识别临时文件失败。");
        return 0;
    }
    lbwxocr::clearError();
    const bool recognized = lbwxocr::WxOcrSession::instance().doOcr(lbwxocr::utf8FromWide(tempFile), data);
    DeleteFileW(tempFile.c_str());
    if (!recognized) {
        return 0;
    }
    return lbwxocr::storeResult(std::move(data));
#else
    lbwxocr::setError(L"微信OCR 组件仅支持 64 位程序（微信 4.x 无 32 位组件），请切换 x64 构建平台。");
    return 0;
#endif
}

int OCR结果_取行数(long long 结果) {
    const auto data = lbwxocr::fetchResult(结果);
    return data ? static_cast<int>(data->lines.size()) : 0;
}

std::wstring OCR结果_取文本(long long 结果, int 索引) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data || 索引 < 0 || 索引 >= static_cast<int>(data->lines.size())) return std::wstring();
    return data->lines[索引].text;
}

std::wstring OCR结果_取全部文本(long long 结果, bool 换行分隔) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data) return std::wstring();
    std::wstring out;
    for (size_t i = 0; i < data->lines.size(); ++i) {
        if (i) out += 换行分隔 ? L"\r\n" : L" ";
        out += data->lines[i].text;
    }
    return out;
}

double OCR结果_取置信度(long long 结果, int 索引) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data || 索引 < 0 || 索引 >= static_cast<int>(data->lines.size())) return 0;
    return data->lines[索引].rate;
}

int OCR结果_取左坐标(long long 结果, int 索引) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data || 索引 < 0 || 索引 >= static_cast<int>(data->lines.size())) return -1;
    return static_cast<int>(data->lines[索引].left);
}

int OCR结果_取上坐标(long long 结果, int 索引) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data || 索引 < 0 || 索引 >= static_cast<int>(data->lines.size())) return -1;
    return static_cast<int>(data->lines[索引].top);
}

int OCR结果_取右坐标(long long 结果, int 索引) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data || 索引 < 0 || 索引 >= static_cast<int>(data->lines.size())) return -1;
    return static_cast<int>(data->lines[索引].right);
}

int OCR结果_取下坐标(long long 结果, int 索引) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data || 索引 < 0 || 索引 >= static_cast<int>(data->lines.size())) return -1;
    return static_cast<int>(data->lines[索引].bottom);
}

int OCR结果_取宽度(long long 结果) {
    const auto data = lbwxocr::fetchResult(结果);
    return data ? data->width : 0;
}

int OCR结果_取高度(long long 结果) {
    const auto data = lbwxocr::fetchResult(结果);
    return data ? data->height : 0;
}

std::wstring OCR结果_取JSON(long long 结果) {
    const auto data = lbwxocr::fetchResult(结果);
    if (!data) return std::wstring();
    return lbwxocr::resultToJson(*data);
}

bool OCR结果_释放(long long 结果) {
    return lbwxocr::releaseResult(结果);
}

void OCR结果_释放全部() {
    std::lock_guard<std::mutex> lock(lbwxocr::g_storeMutex);
    lbwxocr::g_store.clear();
}

#endif // LB_WXOCR_RUNTIME_INCLUDED
