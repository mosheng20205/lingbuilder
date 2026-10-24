/**
 * PDF 写出器运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/pdf-writer/lb_pdfwrite.h
 * 再生命令：npm run pdfwriter:runtime（--check 模式供门禁）
 * 注入点：dataMediaRuntime.ts 在 Excel 等需要「运行时直接写 PDF」的模块启用时拼接；
 * word-bridge 等桥 DLL 场景不走本文件（DLL 直接编译头文件）。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PDF_WRITER_RUNTIME = String.raw`// lb_pdfwrite.h — LingBuilder 自带 PDF 写出器单头（word-bridge 导出 PDF 与 Excel_导出PDF 运行时共用）。
// 设计口径：
//   * 中文与西文统一走 Type0/CID 字体 STSong-Light + UniGB-UCS2-H 预定义 CMap（不嵌入字体，
//     依赖查看器字体替换——与 reportlab 内置 CID 字体同路线；Chrome/Edge/WPS 可直接显示）。
//   * 加粗用文字渲染模式 2（填充+描边）模拟，不引入第二套字体。
//   * 文本与图形内容流不压缩；RGB 位图可选用 Flate 压缩（需定义 LBPDF_WITH_MINIZ 且 miniz.h 在包含路径上）。
//   * 图片支持 JPEG 原样透传（DCTDecode）与 RGB 原始位图；绘制指令即时写入当页内容流。
//   * 文本宽度度量用 GDI 宋体（SimSun）近似 STSong。
// 约束：本文件内容会被脚本内联进生成器运行时（String.raw 注入），注入安全禁用字符序列见生成脚本校验。


#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#ifdef LBPDF_WITH_MINIZ
#include "miniz.h"
#endif

namespace lbpdf {

// UTF-8 → UTF-16BE 十六进制串；非法字节按 U+FFFD。
inline std::string utf8ToUtf16Hex(const std::string& text) {
    std::string hex;
    char buf[8];
    size_t i = 0;
    while (i < text.size()) {
        uint8_t c = uint8_t(text[i]);
        uint32_t cp = 0xFFFD; size_t len = 1;
        if (c < 0x80) { cp = c; len = 1; }
        else if ((c & 0xE0) == 0xC0 && i + 1 < text.size()) { cp = c & 0x1F; len = 2; }
        else if ((c & 0xF0) == 0xE0 && i + 2 < text.size()) { cp = c & 0x0F; len = 3; }
        else if ((c & 0xF8) == 0xF0 && i + 3 < text.size()) { cp = c & 0x07; len = 4; }
        bool ok = true; // 单字节 ASCII 恒合法，多字节由后续续字节校验
        for (size_t k = 1; k < len && ok; k++) {
            uint8_t cc = uint8_t(text[i + k]);
            if ((cc & 0xC0) != 0x80) ok = false; else cp = (cp << 6) | (cc & 0x3F);
        }
        if (!ok || (len == 2 && cp < 0x80) || (len == 3 && cp < 0x800) || (len == 4 && cp < 0x10000)) { cp = 0xFFFD; len = 1; }
        if (cp > 0xFFFF) { cp -= 0x10000; snprintf(buf, sizeof buf, "%04X%04X", 0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
        else snprintf(buf, sizeof buf, "%04X", cp);
        hex += buf;
        i += len;
    }
    return hex;
}

inline std::wstring utf8ToWide(const std::string& text) {
    std::wstring wide;
    size_t i = 0;
    while (i < text.size()) {
        uint8_t c = uint8_t(text[i]);
        uint32_t cp = 0xFFFD; size_t len = 1;
        if (c < 0x80) { cp = c; len = 1; }
        else if ((c & 0xE0) == 0xC0 && i + 1 < text.size()) { cp = c & 0x1F; len = 2; }
        else if ((c & 0xF0) == 0xE0 && i + 2 < text.size()) { cp = c & 0x0F; len = 3; }
        else if ((c & 0xF8) == 0xF0 && i + 3 < text.size()) { cp = c & 0x07; len = 4; }
        bool ok = true; // 单字节 ASCII 恒合法，多字节由后续续字节校验
        for (size_t k = 1; k < len && ok; k++) {
            uint8_t cc = uint8_t(text[i + k]);
            if ((cc & 0xC0) != 0x80) ok = false; else cp = (cp << 6) | (cc & 0x3F);
        }
        if (!ok || (len == 2 && cp < 0x80) || (len == 3 && cp < 0x800) || (len == 4 && cp < 0x10000)) { cp = 0xFFFD; len = 1; }
        if (cp > 0xFFFF) { cp -= 0x10000; wide.push_back(wchar_t(0xD800 + (cp >> 10))); wide.push_back(wchar_t(0xDC00 + (cp & 0x3FF))); }
        else wide.push_back(wchar_t(cp));
        i += len;
    }
    return wide;
}

// GDI 度量：宋体近似 STSong；返回文本宽度（pt）。进程内缓存 HDC/HFONT。
inline double measureTextWidth(const wchar_t* text, size_t len, double fontPt);

class PdfWriter {
public:
    void begin(double pageWidthPt, double pageHeightPt, double marginPt) {
        w_ = pageWidthPt; h_ = pageHeightPt; m_ = marginPt;
        pages_.clear(); images_.clear(); nextPage();
    }
    void nextPage() { pages_.emplace_back(); }
    double pageWidth() const { return w_; }
    double pageHeight() const { return h_; }
    double margin() const { return m_; }

    void text(double x, double y, const std::string& utf8, double sizePt, bool bold, uint32_t color = 0) {
        if (utf8.empty()) return;
        std::string hex = utf8ToUtf16Hex(utf8);
        char buf[192];
        std::string op = "BT ";
        snprintf(buf, sizeof buf, "/F1 %.2f Tf ", sizePt); op += buf;
        if (bold) { snprintf(buf, sizeof buf, "2 Tr %.3f w ", sizePt * 0.027); op += buf; }
        else op += "0 Tr ";
        snprintf(buf, sizeof buf, "%.3f %.3f %.3f rg ", double((color >> 16) & 255) / 255.0, double((color >> 8) & 255) / 255.0, double(color & 255) / 255.0); op += buf;
        snprintf(buf, sizeof buf, "1 0 0 1 %.3f %.3f Tm <", x, y); op += buf;
        op += hex;
        op += "> Tj ET\n";
        pages_.back().content += op;
    }

    void line(double x1, double y1, double x2, double y2, double widthPt, uint32_t color = 0) {
        char buf[192];
        snprintf(buf, sizeof buf, "%.3f %.3f %.3f RG %.3f w %.3f %.3f m %.3f %.3f l S\n",
                 double((color >> 16) & 255) / 255.0, double((color >> 8) & 255) / 255.0, double(color & 255) / 255.0,
                 widthPt, x1, y1, x2, y2);
        pages_.back().content += buf;
    }

    void rect(double x, double y, double w, double h, bool fill, bool stroke, uint32_t color = 0, double widthPt = 0.75) {
        char buf[192];
        std::string op;
        snprintf(buf, sizeof buf, "%.3f %.3f %.3f %.3f re ", x, y, w, h); op += buf;
        if (fill && stroke) {
            snprintf(buf, sizeof buf, "%.3f %.3f %.3f rg B\n", double((color >> 16) & 255) / 255.0, double((color >> 8) & 255) / 255.0, double(color & 255) / 255.0);
            op += buf;
        } else if (fill) {
            snprintf(buf, sizeof buf, "%.3f %.3f %.3f rg f\n", double((color >> 16) & 255) / 255.0, double((color >> 8) & 255) / 255.0, double(color & 255) / 255.0);
            op += buf;
        } else {
            snprintf(buf, sizeof buf, "%.3f %.3f %.3f RG %.3f w S\n", double((color >> 16) & 255) / 255.0, double((color >> 8) & 255) / 255.0, double(color & 255) / 255.0, widthPt);
            op += buf;
        }
        pages_.back().content += op;
    }

    // 登记图片数据，返回图片序号（0 起）；不产生绘制指令。
    size_t addImageJpeg(const uint8_t* data, size_t size) {
        images_.push_back(ImageEntry{std::vector<uint8_t>(data, data + size), 0, 0, true});
        return images_.size() - 1;
    }

    size_t addImageRgb(int wPix, int hPix, const uint8_t* rgb, size_t size) {
        std::vector<uint8_t> stored;
        bool flate = false;
#ifdef LBPDF_WITH_MINIZ
        size_t outLen = 0;
        void* compressed = tdefl_compress_mem_to_heap(rgb, size, &outLen, 128);
        if (compressed && outLen < size) {
            stored.assign(static_cast<uint8_t*>(compressed), static_cast<uint8_t*>(compressed) + outLen);
            flate = true;
        }
        if (compressed) mz_free(compressed);
#endif
        if (!flate) stored.assign(rgb, rgb + size);
        images_.push_back(ImageEntry{std::move(stored), wPix, hPix, false});
        return images_.size() - 1;
    }

    // 在当前页放置已登记图片（pt 坐标，y 为图片底边）。
    void placeImage(size_t index, double x, double y, double wPt, double hPt) {
        char buf[96];
        snprintf(buf, sizeof buf, "q %.3f 0 0 %.3f %.3f %.3f cm /Im%zu Do Q\n", wPt, hPt, x, y, index);
        pages_.back().content += buf;
    }

    void appendContent(const std::string& op) { pages_.back().content += op; }

    // 序列化为 PDF 字节集。图片绘制指令在图片登记时写入当页内容流（z 序与登记顺序一致）。
    bool serialize(std::vector<uint8_t>& out, std::string* error) {
        out.clear();
        // 对象编号从 1 起连续分配（不得留空洞，ImportPages 对 xref 严格校验）。
        std::vector<size_t> pageIds(pages_.size()), contentIds(pages_.size());
        size_t next = 1;
        for (size_t i = 0; i < pages_.size(); i++) { contentIds[i] = next++; pageIds[i] = next++; }
        size_t fontId = next++;
        size_t cidFontId = next++;
        size_t resourcesId = next++;
        size_t pagesId = next++;
        size_t catalogId = next++;
        std::vector<size_t> imageIds(images_.size());
        for (size_t i = 0; i < images_.size(); i++) imageIds[i] = next++;
        size_t maxId = next - 1;
        std::vector<size_t> offsets(maxId + 1, 0);

        out.insert(out.end(), {'%', 'P', 'D', 'F', '-', '1', '.', '7', '\n'});
        auto push = [&](const std::string& s) { out.insert(out.end(), s.begin(), s.end()); };
        auto objHeader = [&](size_t id) {
            offsets[id] = out.size();
            char buf[32];
            snprintf(buf, sizeof buf, "%zu 0 obj\n", id);
            push(buf);
        };
        char buf[256];
        // 内容流对象
        for (size_t i = 0; i < pages_.size(); i++) {
            objHeader(contentIds[i]);
            snprintf(buf, sizeof buf, "<< /Length %zu >>\nstream\n", pages_[i].content.size());
            push(buf);
            push(pages_[i].content);
            push("\nendstream\nendobj\n");
        }
        // 页面对象
        for (size_t i = 0; i < pages_.size(); i++) {
            objHeader(pageIds[i]);
            snprintf(buf, sizeof buf, "<< /Type /Page /Parent %zu 0 R /MediaBox [0 0 %.3f %.3f] /Contents %zu 0 R /Resources %zu 0 R >>\nendobj\n",
                     pagesId, w_, h_, contentIds[i], resourcesId);
            push(buf);
        }
        // 字体
        objHeader(fontId);
        snprintf(buf, sizeof buf, "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [%zu 0 R] >>\nendobj\n", cidFontId);
        push(buf);
        objHeader(cidFontId);
        push("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 5 >> /DW 1000 >>\nendobj\n");
        // 图片对象
        for (size_t i = 0; i < images_.size(); i++) {
            const ImageEntry& img = images_[i];
            int pw = img.pixW, ph = img.pixH;
            if (img.isJpeg && !jpegSize(img.data.data(), img.data.size(), pw, ph)) {
                if (error) *error = "JPEG 数据损坏，无法解析尺寸";
                return false;
            }
            objHeader(imageIds[i]);
            if (img.isJpeg) snprintf(buf, sizeof buf, "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %zu >>\nstream\n", pw, ph, img.data.size());
            else snprintf(buf, sizeof buf, "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length %zu >>\nstream\n", pw, ph, img.data.size());
            push(buf);
            out.insert(out.end(), img.data.begin(), img.data.end());
            push("\nendstream\nendobj\n");
        }
        // 资源字典：全部图片挂共享资源（未引用图片会被查看器忽略，无害）。
        objHeader(resourcesId);
        {
            std::string res = "<< /Font << /F1 ";
            snprintf(buf, sizeof buf, "%zu 0 R >>", fontId);
            res += buf;
            if (!images_.empty()) {
                res += " /XObject << ";
                for (size_t i = 0; i < images_.size(); i++) {
                    snprintf(buf, sizeof buf, "/Im%zu %zu 0 R ", i, imageIds[i]);
                    res += buf;
                }
                res += ">>";
            }
            res += " >>\nendobj\n";
            push(res);
        }
        objHeader(pagesId);
        {
            std::string kids;
            for (size_t i = 0; i < pageIds.size(); i++) {
                snprintf(buf, sizeof buf, "%zu 0 R ", pageIds[i]);
                kids += buf;
            }
            snprintf(buf, sizeof buf, "<< /Type /Pages /Kids [%s] /Count %zu >>\nendobj\n", kids.c_str(), pageIds.size());
            push(buf);
        }
        objHeader(catalogId);
        snprintf(buf, sizeof buf, "<< /Type /Catalog /Pages %zu 0 R >>\nendobj\n", pagesId);
        push(buf);
        size_t xrefPos = out.size();
        snprintf(buf, sizeof buf, "xref\n0 %zu\n0000000000 65535 f \n", maxId + 1);
        push(buf);
        for (size_t id = 1; id <= maxId; id++) {
            snprintf(buf, sizeof buf, "%010zu 00000 n \n", offsets[id]);
            push(buf);
        }
        snprintf(buf, sizeof buf, "trailer\n<< /Size %zu /Root %zu 0 R >>\nstartxref\n%zu\n%%%%EOF\n", maxId + 1, catalogId, xrefPos);
        push(buf);
        return true;
    }

private:
    struct Page { std::string content; };
    struct ImageEntry { std::vector<uint8_t> data; int pixW, pixH; bool isJpeg; };
    std::vector<Page> pages_;
    std::vector<ImageEntry> images_;
    double w_ = 595, h_ = 842, m_ = 56;

    static bool jpegSize(const uint8_t* data, size_t size, int& w, int& h) {
        size_t i = 2;
        while (i + 9 < size) {
            if (data[i] != 0xFF) { i++; continue; }
            uint8_t marker = data[i + 1];
            if (marker == 0xC0 || marker == 0xC1 || marker == 0xC2 || marker == 0xC3) {
                h = (data[i + 5] << 8) | data[i + 6];
                w = (data[i + 7] << 8) | data[i + 8];
                return w > 0 && h > 0;
            }
            if (marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD9)) { i += 2; continue; }
            size_t len = (size_t(data[i + 2]) << 8) | data[i + 3];
            i += 2 + len;
        }
        return false;
    }
};

// —— 简单流式排版器：换行、分页、表格（word/excel 导出共用）——
// 用法：文字与表格经 Layout 输出；图片先 addImageJpeg/addImageRgb 登记拿序号，再 drawImage 放置。
class Layout {
public:
    void begin(PdfWriter* pdf, double bodyWidthPt, double defaultFontPt = 11, double lineGap = 1.4) {
        pdf_ = pdf; bodyW_ = bodyWidthPt; font_ = defaultFontPt; gap_ = lineGap;
        y_ = pdf_->pageHeight() - pdf_->margin();
    }
    double fontPt() const { return font_; }
    void setFontPt(double size) { font_ = size; }
    double cursorY() const { return y_; }
    void setCursorY(double y) { y_ = y; }
    double lineHeight() const { return font_ * gap_; }
    double contentTop() const { return pdf_->pageHeight() - pdf_->margin(); }
    PdfWriter* writer() { return pdf_; }

    void ensureSpace(double needPt) {
        if (y_ - needPt < pdf_->margin()) { pdf_->nextPage(); y_ = contentTop(); }
    }

    void paragraph(const std::wstring& text, bool bold = false, double indentPt = 0, double fontPtOverride = 0) {
        double size = fontPtOverride > 0 ? fontPtOverride : font_;
        double avail = bodyW_ - indentPt;
        size_t start = 0;
        while (start < text.size()) {
            size_t take = fitChars(text.data() + start, text.size() - start, size, avail);
            if (take == 0) take = 1;
            ensureSpace(size * gap_);
            y_ -= size * gap_;
            pdf_->text(pdf_->margin() + indentPt, y_ + size * 0.22, wideToUtf8Str(text.substr(start, take)), size, bold);
            start += take;
        }
        y_ -= size * 0.3;
    }

    void spacer(double pt) { y_ -= pt; }

    // 表格：colWidths 列宽 pt；跨页时自动重复首行（boldHeader 控制首行加粗）。
    void table(const std::vector<std::vector<std::wstring>>& rows, const std::vector<double>& colWidths,
               bool boldHeader = true, bool repeatHeader = true) {
        if (rows.empty() || colWidths.empty()) return;
        double size = font_ * 0.92;
        for (size_t r = 0; r < rows.size(); r++) {
            const std::vector<std::wstring>* repeat = (repeatHeader && r > 0) ? &rows[0] : nullptr;
            drawRow(rows[r], colWidths, size, boldHeader && r == 0, repeat, boldHeader);
        }
    }

    void drawImage(size_t imageIndex, double x, double y, double wPt, double hPt) {
        pdf_->placeImage(imageIndex, x, y, wPt, hPt);
    }

    void horizontalRule(double indentPt = 0, uint32_t color = 0x999999) {
        ensureSpace(6);
        y_ -= 4;
        pdf_->line(pdf_->margin() + indentPt, y_, pdf_->margin() + bodyW_, y_, 0.6, color);
        y_ -= 4;
    }

private:
    void drawRow(const std::vector<std::wstring>& cells, const std::vector<double>& colWidths, double size, bool bold,
                 const std::vector<std::wstring>* repeatRow = nullptr, bool repeatBold = false) {
        std::vector<std::vector<std::wstring>> lines;
        size_t maxLines = 1;
        for (size_t c = 0; c < colWidths.size(); c++) {
            std::wstring cell = c < cells.size() ? cells[c] : std::wstring();
            std::vector<std::wstring> wrapped;
            size_t start = 0;
            double avail = colWidths[c] - 8;
            while (start < cell.size()) {
                size_t take = fitChars(cell.data() + start, cell.size() - start, size, avail);
                if (take == 0) take = 1;
                wrapped.push_back(cell.substr(start, take));
                start += take;
            }
            if (wrapped.empty()) wrapped.push_back(std::wstring());
            if (wrapped.size() > maxLines) maxLines = wrapped.size();
            lines.push_back(wrapped);
        }
        double rowH = maxLines * size * gap_ + 6;
        if (y_ - rowH < pdf_->margin()) {
            pdf_->nextPage();
            y_ = contentTop();
            if (repeatRow) drawRow(*repeatRow, colWidths, size, repeatBold);
        }
        double top = y_;
        double x = pdf_->margin();
        for (size_t c = 0; c < colWidths.size(); c++) {
            pdf_->rect(x, top - rowH, colWidths[c], rowH, false, true, 0x777777, 0.5);
            double ty = top - 4;
            for (size_t l = 0; l < lines[c].size(); l++) {
                pdf_->text(x + 4, ty - size * 0.22, wideToUtf8Str(lines[c][l]), size, bold);
                ty -= size * gap_;
            }
            x += colWidths[c];
        }
        y_ = top - rowH;
    }

    size_t fitChars(const wchar_t* text, size_t len, double fontPt, double availPt) {
        size_t n = 0;
        double w = 0;
        while (n < len) {
            double cw = measureTextWidth(text + n, 1, fontPt);
            if (w + cw > availPt && n > 0) break;
            w += cw;
            n++;
        }
        return n;
    }
    static std::string wideToUtf8Str(const std::wstring& text);

    PdfWriter* pdf_ = nullptr;
    double bodyW_ = 480, font_ = 11, gap_ = 1.4, y_ = 0;
};

#ifdef _WIN32
inline double measureTextWidth(const wchar_t* text, size_t len, double fontPt) {
    HDC dc = GetDC(nullptr);
    if (!dc) return fontPt * double(len);
    double dpi = GetDeviceCaps(dc, LOGPIXELSX);
    int px = -MulDiv(int(fontPt + 0.5), GetDeviceCaps(dc, LOGPIXELSY), 72);
    HFONT font = CreateFontW(px, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"SimSun");
    HFONT old = static_cast<HFONT>(SelectObject(dc, font));
    SIZE size = {0, 0};
    GetTextExtentPoint32W(dc, text, int(len), &size);
    SelectObject(dc, old);
    DeleteObject(font);
    ReleaseDC(nullptr, dc);
    return double(size.cx) * 72.0 / (dpi > 0 ? dpi : 96.0);
}

inline std::string Layout::wideToUtf8Str(const std::wstring& text) {
    if (text.empty()) return std::string();
    int bytes = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), nullptr, 0, nullptr, nullptr);
    std::string out(size_t(bytes > 0 ? bytes : 0), '\0');
    if (bytes > 0) WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), &out[0], bytes, nullptr, nullptr);
    return out;
}
#else
inline double measureTextWidth(const wchar_t*, size_t, double fontPt) { return fontPt; } // 非 Windows 兜底：按等宽估计
inline std::string Layout::wideToUtf8Str(const std::wstring& text) { return std::string(text.begin(), text.end()); }
#endif

} // namespace lbpdf
`;
