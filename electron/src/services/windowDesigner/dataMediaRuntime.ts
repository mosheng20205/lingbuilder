import { InstalledModule } from '../modules/types';
import { generateCryptoRuntime } from './cryptoRuntime';
import { OPENCV_RUNTIME } from './opencvRuntime';
import { SQLITE_RUNTIME } from './sqliteRuntime';
import { MYSQL_RUNTIME } from './mysqlRuntime';
import { EXCEL_RUNTIME } from './excelRuntime';
import { TABULAR_SNAPSHOT_COMMANDS } from './tabularSourceRuntime';

const CSV_RUNTIME = TABULAR_SNAPSHOT_COMMANDS + String.raw`
static std::wstring LB_CsvEscape(const std::wstring& field) { if (field.find_first_of(L",\"\r\n") == std::wstring::npos) return field; std::wstring escaped = field; LB_ReplaceAll(escaped, L"\"", L"\"\""); return L"\"" + escaped + L"\""; }
// 行级命令复用同一份记录扫描器；空文本按一个空字段返回，与历史行为一致。
static std::vector<std::wstring> LB_CsvParseLine(const std::wstring& line) { if (line.empty()) return { std::wstring() }; auto records = LB_CsvParseRecords(line, L','); return records.empty() ? std::vector<std::wstring>{ std::wstring() } : records.front(); }
const wchar_t* CSV_转义字段(const wchar_t* field) { return LB_ReturnText(LB_CsvEscape(LB_Wide(field))); }
const wchar_t* CSV_生成两列(const wchar_t* first, const wchar_t* second) { return LB_ReturnText(LB_CsvEscape(LB_Wide(first)) + L"," + LB_CsvEscape(LB_Wide(second))); }
const wchar_t* CSV_生成三列(const wchar_t* first, const wchar_t* second, const wchar_t* third) { return LB_ReturnText(LB_CsvEscape(LB_Wide(first)) + L"," + LB_CsvEscape(LB_Wide(second)) + L"," + LB_CsvEscape(LB_Wide(third))); }
int CSV_字段数量(const wchar_t* line) { return static_cast<int>(LB_CsvParseLine(LB_Wide(line)).size()); }
const wchar_t* CSV_取字段(const wchar_t* line, int index) { auto fields = LB_CsvParseLine(LB_Wide(line)); return index >= 0 && static_cast<size_t>(index) < fields.size() ? LB_ReturnText(fields[static_cast<size_t>(index)]) : LB_ReturnText(L""); }
`;

const CRYPTO_RUNTIME = String.raw`
static std::wstring g_lbProtectError;
const wchar_t* 数据保护_取错误() { return LB_ReturnText(g_lbProtectError); }
static std::string LB_Base64EncodeBytes(const unsigned char* data, size_t size) { static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; std::string output; for (size_t offset = 0; offset < size; offset += 3) { unsigned int block = static_cast<unsigned int>(data[offset]) << 16; if (offset + 1 < size) block |= static_cast<unsigned int>(data[offset + 1]) << 8; if (offset + 2 < size) block |= data[offset + 2]; output.push_back(alphabet[(block >> 18) & 63]); output.push_back(alphabet[(block >> 12) & 63]); output.push_back(offset + 1 < size ? alphabet[(block >> 6) & 63] : '='); output.push_back(offset + 2 < size ? alphabet[block & 63] : '='); } return output; }
static int LB_Base64Index(char value) { if (value >= 'A' && value <= 'Z') return value - 'A'; if (value >= 'a' && value <= 'z') return value - 'a' + 26; if (value >= '0' && value <= '9') return value - '0' + 52; if (value == '+') return 62; if (value == '/') return 63; return -1; }
static bool LB_Base64DecodeBytes(const std::string& input, std::vector<unsigned char>& output) { if (input.size() % 4) return false; for (size_t offset = 0; offset < input.size(); offset += 4) { int a = LB_Base64Index(input[offset]), b = LB_Base64Index(input[offset + 1]), c = input[offset + 2] == '=' ? -2 : LB_Base64Index(input[offset + 2]), d = input[offset + 3] == '=' ? -2 : LB_Base64Index(input[offset + 3]); if (a < 0 || b < 0 || c == -1 || d == -1 || (c == -2 && d != -2)) return false; unsigned int block = (static_cast<unsigned int>(a) << 18) | (static_cast<unsigned int>(b) << 12) | (static_cast<unsigned int>((std::max)(0, c)) << 6) | static_cast<unsigned int>((std::max)(0, d)); output.push_back((block >> 16) & 255); if (c >= 0) output.push_back((block >> 8) & 255); if (d >= 0) output.push_back(block & 255); } return true; }

static const wchar_t* LB_ProtectText(const wchar_t* text, DWORD flags) { g_lbProtectError.clear(); const std::string bytes = LB_WideToUtf8(text); DATA_BLOB input = { static_cast<DWORD>(bytes.size()), reinterpret_cast<BYTE*>(const_cast<char*>(bytes.data())) }, output = {}; if (!CryptProtectData(&input, L"LingBuilder", nullptr, nullptr, nullptr, flags, &output)) { g_lbProtectError = L"DPAPI 加密失败，错误码 " + std::to_wstring(GetLastError()); return LB_ReturnText(L""); } std::string encoded = LB_Base64EncodeBytes(output.pbData, output.cbData); LocalFree(output.pbData); return LB_ReturnText(LB_Utf8ToWide(encoded)); }
const wchar_t* 数据保护_加密文本(const wchar_t* text) { return LB_ProtectText(text, 0); }
const wchar_t* 数据保护_机器级加密文本(const wchar_t* text) { return LB_ProtectText(text, CRYPTPROTECT_LOCAL_MACHINE); }
const wchar_t* 数据保护_解密文本(const wchar_t* encoded) { g_lbProtectError.clear(); std::vector<unsigned char> bytes; if (!LB_Base64DecodeBytes(LB_WideToUtf8(encoded), bytes)) { g_lbProtectError = L"DPAPI 密文不是有效 Base64。"; return LB_ReturnText(L""); } DATA_BLOB input = { static_cast<DWORD>(bytes.size()), bytes.data() }, output = {}; if (!CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr, 0, &output)) { g_lbProtectError = L"DPAPI 解密失败，错误码 " + std::to_wstring(GetLastError()); return LB_ReturnText(L""); } std::string plain(reinterpret_cast<char*>(output.pbData), output.cbData); LocalFree(output.pbData); return LB_ReturnText(LB_Utf8ToWide(plain)); }

// 字节集形态：二进制密钥不是合法 UTF-8，绝不能走上面的文本通道，必须原样进出。
static std::vector<unsigned char> LB_ProtectBytes(const std::vector<unsigned char>& bytes, DWORD flags) {
    g_lbProtectError.clear();
    if (bytes.empty()) { g_lbProtectError = L"DPAPI 加密失败：输入字节集为空。"; return {}; }
    DATA_BLOB input = { static_cast<DWORD>(bytes.size()), reinterpret_cast<BYTE*>(const_cast<unsigned char*>(bytes.data())) }, output = {};
    if (!CryptProtectData(&input, L"LingBuilder", nullptr, nullptr, nullptr, flags, &output)) { g_lbProtectError = L"DPAPI 加密失败，错误码 " + std::to_wstring(GetLastError()); return {}; }
    std::vector<unsigned char> result(output.pbData, output.pbData + output.cbData);
    LocalFree(output.pbData);
    return result;
}
std::vector<unsigned char> 数据保护_加密字节集(const std::vector<unsigned char>& bytes) { return LB_ProtectBytes(bytes, 0); }
// Chromium 的 encrypted_key 去掉 Base64 后以 ASCII "DPAPI" 开头，该前缀不属于 DPAPI blob 本体，这里统一剥离。
static bool LB_IsDpapiPrefixed(const std::vector<unsigned char>& bytes) {
    const char marker[] = "DPAPI";
    return bytes.size() >= 5 && std::equal(std::begin(marker), std::end(marker) - 1, bytes.begin());
}
std::vector<unsigned char> 数据保护_解密字节集(const std::vector<unsigned char>& encoded) {
    g_lbProtectError.clear();
    if (encoded.empty()) { g_lbProtectError = L"DPAPI 解密失败：输入字节集为空。"; return {}; }
    const size_t offset = LB_IsDpapiPrefixed(encoded) ? 5 : 0;
    if (offset >= encoded.size()) { g_lbProtectError = L"DPAPI 密文只有 \"DPAPI\" 前缀，没有实际密文。"; return {}; }
    std::vector<unsigned char> blob(encoded.begin() + static_cast<std::ptrdiff_t>(offset), encoded.end());
    DATA_BLOB input = { static_cast<DWORD>(blob.size()), blob.data() }, output = {};
    if (!CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr, 0, &output)) { g_lbProtectError = L"DPAPI 解密失败，错误码 " + std::to_wstring(GetLastError()); return {}; }
    std::vector<unsigned char> plain(output.pbData, output.pbData + output.cbData);
    LocalFree(output.pbData);
    return plain;
}
`;

const ODBC_RUNTIME = String.raw`
static SQLHENV g_lbOdbcEnvironment = SQL_NULL_HENV; static SQLHDBC g_lbOdbcConnection = SQL_NULL_HDBC; static std::wstring g_lbOdbcError;
static std::map<long long, SQLHSTMT> g_lbOdbcQueries; static long long g_lbOdbcQueryNext = 1;
static void LB_OdbcCapture(SQLSMALLINT type, SQLHANDLE handle) { g_lbOdbcError.clear(); SQLWCHAR state[16] = {}, message[1024] = {}; SQLINTEGER native = 0; SQLSMALLINT length = 0; if (SQLGetDiagRecW(type, handle, 1, state, &native, message, _countof(message), &length) == SQL_SUCCESS) g_lbOdbcError.assign(reinterpret_cast<wchar_t*>(message), static_cast<size_t>(length)); }
static void LB_OdbcCloseAllQueries() { for (auto& entry : g_lbOdbcQueries) { if (entry.second != SQL_NULL_HSTMT) SQLFreeHandle(SQL_HANDLE_STMT, entry.second); } g_lbOdbcQueries.clear(); }
static SQLHSTMT LB_OdbcFindQuery(long long queryId) { auto found = g_lbOdbcQueries.find(queryId); if (found == g_lbOdbcQueries.end()) { g_lbOdbcError = L"结果集编号不存在或已关闭。"; return SQL_NULL_HSTMT; } return found->second; }
// 分段读取任意长度文本列：首段放不下时 SQLGetData 返回 SQL_SUCCESS_WITH_INFO（01004 截断），
// 循环续读直到 SQL_SUCCESS / SQL_NO_DATA，消灭固定 4096 缓冲的静默截断。
static bool LB_OdbcReadColumn(SQLHSTMT statement, SQLUSMALLINT column, std::wstring& value, bool& isNull) { value.clear(); isNull = false; std::array<wchar_t, 2048> buffer = {}; SQLLEN indicator = 0; for (;;) { SQLRETURN result = SQLGetData(statement, column, SQL_C_WCHAR, buffer.data(), static_cast<SQLLEN>(buffer.size() * sizeof(wchar_t)), &indicator); if (result == SQL_NO_DATA) break; if (!SQL_SUCCEEDED(result)) return false; if (indicator == SQL_NULL_DATA) { value.clear(); isNull = true; return true; } size_t chars = 0; const size_t maxChars = buffer.size() - 1; while (chars < maxChars && buffer.data()[chars] != L'\0') ++chars; value.append(buffer.data(), chars); if (result == SQL_SUCCESS) break; } return true; }
void ODBC_关闭() { LB_OdbcCloseAllQueries(); if (g_lbOdbcConnection != SQL_NULL_HDBC) { SQLDisconnect(g_lbOdbcConnection); SQLFreeHandle(SQL_HANDLE_DBC, g_lbOdbcConnection); } if (g_lbOdbcEnvironment != SQL_NULL_HENV) SQLFreeHandle(SQL_HANDLE_ENV, g_lbOdbcEnvironment); g_lbOdbcConnection = SQL_NULL_HDBC; g_lbOdbcEnvironment = SQL_NULL_HENV; }
const wchar_t* ODBC_取错误() { return LB_ReturnText(g_lbOdbcError); }
bool ODBC_连接(const wchar_t* connectionString) { ODBC_关闭(); if (SQLAllocHandle(SQL_HANDLE_ENV, SQL_NULL_HANDLE, &g_lbOdbcEnvironment) != SQL_SUCCESS || SQLSetEnvAttr(g_lbOdbcEnvironment, SQL_ATTR_ODBC_VERSION, reinterpret_cast<SQLPOINTER>(static_cast<UINT_PTR>(SQL_OV_ODBC3)), 0) != SQL_SUCCESS || SQLAllocHandle(SQL_HANDLE_DBC, g_lbOdbcEnvironment, &g_lbOdbcConnection) != SQL_SUCCESS) { g_lbOdbcError = L"ODBC 环境创建失败。"; ODBC_关闭(); return false; } SQLWCHAR output[2048] = {}; SQLSMALLINT length = 0; SQLRETURN result = SQLDriverConnectW(g_lbOdbcConnection, nullptr, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(connectionString)), SQL_NTS, output, _countof(output), &length, SQL_DRIVER_NOPROMPT); if (!SQL_SUCCEEDED(result)) { LB_OdbcCapture(SQL_HANDLE_DBC, g_lbOdbcConnection); ODBC_关闭(); return false; } return true; }
int ODBC_执行(const wchar_t* sql) { if (g_lbOdbcConnection == SQL_NULL_HDBC) return -1; SQLHSTMT statement = SQL_NULL_HSTMT; if (SQLAllocHandle(SQL_HANDLE_STMT, g_lbOdbcConnection, &statement) != SQL_SUCCESS) return -1; SQLRETURN result = SQLExecDirectW(statement, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(sql)), SQL_NTS); SQLLEN rows = -1; if (SQL_SUCCEEDED(result)) SQLRowCount(statement, &rows); else LB_OdbcCapture(SQL_HANDLE_STMT, statement); SQLFreeHandle(SQL_HANDLE_STMT, statement); return SQL_SUCCEEDED(result) ? static_cast<int>(rows) : -1; }
const wchar_t* ODBC_转义文本(const wchar_t* text) { std::wstring escaped; if (text) { escaped = text; LB_ReplaceAll(escaped, L"'", L"''"); } return LB_ReturnText(std::move(escaped)); }
const wchar_t* ODBC_查询首值(const wchar_t* sql) { if (g_lbOdbcConnection == SQL_NULL_HDBC) return LB_ReturnText(L""); SQLHSTMT statement = SQL_NULL_HSTMT; if (SQLAllocHandle(SQL_HANDLE_STMT, g_lbOdbcConnection, &statement) != SQL_SUCCESS) return LB_ReturnText(L""); SQLRETURN result = SQLExecDirectW(statement, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(sql)), SQL_NTS); std::wstring value; if (SQL_SUCCEEDED(result) && SQLFetch(statement) == SQL_SUCCESS) { bool isNull = false; if (!LB_OdbcReadColumn(statement, 1, value, isNull)) LB_OdbcCapture(SQL_HANDLE_STMT, statement); } else if (!SQL_SUCCEEDED(result)) LB_OdbcCapture(SQL_HANDLE_STMT, statement); SQLFreeHandle(SQL_HANDLE_STMT, statement); return LB_ReturnText(std::move(value)); }
long long ODBC_查询打开(const wchar_t* sql) { g_lbOdbcError.clear(); if (g_lbOdbcConnection == SQL_NULL_HDBC) { g_lbOdbcError = L"尚未连接数据库，请先调用 ODBC_连接。"; return 0; } SQLHSTMT statement = SQL_NULL_HSTMT; if (SQLAllocHandle(SQL_HANDLE_STMT, g_lbOdbcConnection, &statement) != SQL_SUCCESS) { g_lbOdbcError = L"查询句柄分配失败。"; return 0; } SQLRETURN result = SQLExecDirectW(statement, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(sql)), SQL_NTS); if (!SQL_SUCCEEDED(result)) { LB_OdbcCapture(SQL_HANDLE_STMT, statement); SQLFreeHandle(SQL_HANDLE_STMT, statement); return 0; } long long id = g_lbOdbcQueryNext++; g_lbOdbcQueries[id] = statement; return id; }
bool ODBC_取下一行(long long queryId) { g_lbOdbcError.clear(); SQLHSTMT statement = LB_OdbcFindQuery(queryId); if (statement == SQL_NULL_HSTMT) return false; SQLRETURN result = SQLFetch(statement); if (result == SQL_NO_DATA) return false; if (!SQL_SUCCEEDED(result)) { LB_OdbcCapture(SQL_HANDLE_STMT, statement); return false; } return true; }
const wchar_t* ODBC_取列文本(long long queryId, int column) { g_lbOdbcError.clear(); SQLHSTMT statement = LB_OdbcFindQuery(queryId); if (statement == SQL_NULL_HSTMT) return LB_ReturnText(L""); if (column < 1) { g_lbOdbcError = L"列序号从 1 开始。"; return LB_ReturnText(L""); } std::wstring value; bool isNull = false; if (!LB_OdbcReadColumn(statement, static_cast<SQLUSMALLINT>(column), value, isNull)) { LB_OdbcCapture(SQL_HANDLE_STMT, statement); return LB_ReturnText(L""); } return LB_ReturnText(std::move(value)); }
int ODBC_取列数(long long queryId) { g_lbOdbcError.clear(); SQLHSTMT statement = LB_OdbcFindQuery(queryId); if (statement == SQL_NULL_HSTMT) return 0; SQLSMALLINT count = 0; if (!SQL_SUCCEEDED(SQLNumResultCols(statement, &count))) { LB_OdbcCapture(SQL_HANDLE_STMT, statement); return 0; } return static_cast<int>(count); }
const wchar_t* ODBC_取列名(long long queryId, int column) { g_lbOdbcError.clear(); SQLHSTMT statement = LB_OdbcFindQuery(queryId); if (statement == SQL_NULL_HSTMT) return LB_ReturnText(L""); if (column < 1) { g_lbOdbcError = L"列序号从 1 开始。"; return LB_ReturnText(L""); } SQLWCHAR name[256] = {}; SQLSMALLINT length = 0; if (!SQL_SUCCEEDED(SQLDescribeColW(statement, static_cast<SQLUSMALLINT>(column), name, _countof(name), &length, nullptr, nullptr, nullptr, nullptr))) { LB_OdbcCapture(SQL_HANDLE_STMT, statement); return LB_ReturnText(L""); } return LB_ReturnText(std::wstring(reinterpret_cast<wchar_t*>(name), static_cast<size_t>(length))); }
bool ODBC_查询关闭(long long queryId) { g_lbOdbcError.clear(); auto found = g_lbOdbcQueries.find(queryId); if (found == g_lbOdbcQueries.end()) { g_lbOdbcError = L"结果集编号不存在或已关闭。"; return false; } SQLFreeHandle(SQL_HANDLE_STMT, found->second); g_lbOdbcQueries.erase(found); return true; }
bool ODBC_设置自动提交(bool enabled) { return g_lbOdbcConnection != SQL_NULL_HDBC && SQLSetConnectAttr(g_lbOdbcConnection, SQL_ATTR_AUTOCOMMIT, reinterpret_cast<SQLPOINTER>(static_cast<UINT_PTR>(enabled ? SQL_AUTOCOMMIT_ON : SQL_AUTOCOMMIT_OFF)), 0) == SQL_SUCCESS; }
bool ODBC_提交() { return g_lbOdbcConnection != SQL_NULL_HDBC && SQLEndTran(SQL_HANDLE_DBC, g_lbOdbcConnection, SQL_COMMIT) == SQL_SUCCESS; }
bool ODBC_回滚() { return g_lbOdbcConnection != SQL_NULL_HDBC && SQLEndTran(SQL_HANDLE_DBC, g_lbOdbcConnection, SQL_ROLLBACK) == SQL_SUCCESS; }
`;

const IMAGE_SUPPORT = String.raw`
static std::once_flag g_lbGdiPlusOnce; static ULONG_PTR g_lbGdiPlusToken = 0; static bool g_lbGdiPlusReady = false; static std::wstring g_lbImageError;
static bool LB_EnsureGdiPlus() { std::call_once(g_lbGdiPlusOnce, []() { Gdiplus::GdiplusStartupInput input; g_lbGdiPlusReady = Gdiplus::GdiplusStartup(&g_lbGdiPlusToken, &input, nullptr) == Gdiplus::Ok; }); return g_lbGdiPlusReady; }
static bool LB_ImageFail(const wchar_t* message) { g_lbImageError = message; return false; }
const wchar_t* 图像_取错误() { return LB_ReturnText(g_lbImageError); }
static bool LB_Encoder(const wchar_t* mime, CLSID& id) { UINT count = 0, size = 0; Gdiplus::GetImageEncodersSize(&count, &size); if (!size) return false; std::vector<unsigned char> bytes(size); auto codecs = reinterpret_cast<Gdiplus::ImageCodecInfo*>(bytes.data()); if (Gdiplus::GetImageEncoders(count, size, codecs) != Gdiplus::Ok) return false; for (UINT index = 0; index < count; ++index) if (_wcsicmp(codecs[index].MimeType, mime) == 0) { id = codecs[index].Clsid; return true; } return false; }
static const wchar_t* LB_MimeFor(const std::wstring& formatOrPath) { std::wstring value = formatOrPath; std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towlower(ch)); }); auto ends = [&](const wchar_t* suffix) { const size_t length = wcslen(suffix); return value.size() >= length && value.compare(value.size() - length, length, suffix) == 0; }; if (value == L"jpg" || value == L"jpeg" || ends(L".jpg") || ends(L".jpeg")) return L"image/jpeg"; if (value == L"bmp" || ends(L".bmp")) return L"image/bmp"; if (value == L"gif" || ends(L".gif")) return L"image/gif"; if (value == L"tif" || value == L"tiff" || ends(L".tif") || ends(L".tiff")) return L"image/tiff"; return L"image/png"; }
static bool LB_SaveImage(Gdiplus::Image& image, const wchar_t* target, const wchar_t* format = nullptr) { if (!LB_EnsureGdiPlus()) return LB_ImageFail(L"GDI+ 初始化失败。"); CLSID encoder = {}; if (!LB_Encoder(LB_MimeFor(format && format[0] ? format : LB_Wide(target)), encoder)) return LB_ImageFail(L"找不到图像编码器。"); if (image.Save(target, &encoder, nullptr) != Gdiplus::Ok) return LB_ImageFail(L"图像保存失败。"); g_lbImageError.clear(); return true; }
`;

const IMAGE_CORE_RUNTIME = String.raw`
int 图像_取宽度(const wchar_t* path) { if (!LB_EnsureGdiPlus()) return 0; Gdiplus::Bitmap image(path); return image.GetLastStatus() == Gdiplus::Ok ? static_cast<int>(image.GetWidth()) : 0; }
int 图像_取高度(const wchar_t* path) { if (!LB_EnsureGdiPlus()) return 0; Gdiplus::Bitmap image(path); return image.GetLastStatus() == Gdiplus::Ok ? static_cast<int>(image.GetHeight()) : 0; }
bool 图像_转换格式(const wchar_t* source, const wchar_t* target, const wchar_t* format) { if (!LB_EnsureGdiPlus()) return false; Gdiplus::Bitmap image(source); return image.GetLastStatus() == Gdiplus::Ok ? LB_SaveImage(image, target, format) : LB_ImageFail(L"源图像加载失败。"); }
bool 图像_缩放(const wchar_t* source, const wchar_t* target, int width, int height) { if (!LB_EnsureGdiPlus() || width <= 0 || height <= 0) return false; Gdiplus::Bitmap image(source); if (image.GetLastStatus() != Gdiplus::Ok) return LB_ImageFail(L"源图像加载失败。"); Gdiplus::Bitmap output(width, height, PixelFormat32bppARGB); Gdiplus::Graphics graphics(&output); graphics.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic); graphics.DrawImage(&image, 0, 0, width, height); return LB_SaveImage(output, target); }
bool 图像_裁剪(const wchar_t* source, const wchar_t* target, int x, int y, int width, int height) { if (!LB_EnsureGdiPlus() || width <= 0 || height <= 0) return false; Gdiplus::Bitmap image(source); if (image.GetLastStatus() != Gdiplus::Ok || x < 0 || y < 0 || x + width > static_cast<int>(image.GetWidth()) || y + height > static_cast<int>(image.GetHeight())) return LB_ImageFail(L"裁剪区域无效。"); Gdiplus::Bitmap output(width, height, PixelFormat32bppARGB); Gdiplus::Graphics graphics(&output); graphics.DrawImage(&image, Gdiplus::Rect(0, 0, width, height), x, y, width, height, Gdiplus::UnitPixel); return LB_SaveImage(output, target); }
bool 图像_旋转90度(const wchar_t* source, const wchar_t* target, bool clockwise) { if (!LB_EnsureGdiPlus()) return false; Gdiplus::Bitmap image(source); if (image.GetLastStatus() != Gdiplus::Ok) return LB_ImageFail(L"源图像加载失败。"); image.RotateFlip(clockwise ? Gdiplus::Rotate90FlipNone : Gdiplus::Rotate270FlipNone); return LB_SaveImage(image, target); }
`;

const CAPTURE_RUNTIME = String.raw`
static bool LB_CaptureRect(const wchar_t* target, int x, int y, int width, int height) { if (!LB_EnsureGdiPlus() || width <= 0 || height <= 0) return false; HDC screen = GetDC(nullptr), memory = CreateCompatibleDC(screen); HBITMAP bitmap = CreateCompatibleBitmap(screen, width, height); HGDIOBJ old = SelectObject(memory, bitmap); bool copied = BitBlt(memory, 0, 0, width, height, screen, x, y, SRCCOPY | CAPTUREBLT) == TRUE; SelectObject(memory, old); Gdiplus::Bitmap image(bitmap, nullptr); bool saved = copied && LB_SaveImage(image, target, L"png"); DeleteObject(bitmap); DeleteDC(memory); ReleaseDC(nullptr, screen); return saved; }
static std::vector<unsigned char> LB_EncodeImageBytes(Gdiplus::Bitmap& image, const wchar_t* mime) { CLSID encoder = {}; if (!LB_Encoder(mime, encoder)) return {}; IStream* stream = nullptr; if (CreateStreamOnHGlobal(nullptr, FALSE, &stream) != S_OK || !stream) return {}; std::vector<unsigned char> bytes; STATSTG info = {}; if (image.Save(stream, &encoder, nullptr) == Gdiplus::Ok && stream->Stat(&info, STATFLAG_NONAME) == S_OK && info.cbSize.QuadPart > 0) { HGLOBAL handle = nullptr; if (GetHGlobalFromStream(stream, &handle) == S_OK && handle) { void* raw = GlobalLock(handle); if (raw) { bytes.assign(static_cast<unsigned char*>(raw), static_cast<unsigned char*>(raw) + static_cast<size_t>(info.cbSize.QuadPart)); GlobalUnlock(handle); } } } stream->Release(); return bytes; }
static std::vector<unsigned char> LB_CaptureRectBytes(int x, int y, int width, int height) { if (!LB_EnsureGdiPlus() || width <= 0 || height <= 0) return {}; HDC screen = GetDC(nullptr), memory = CreateCompatibleDC(screen); HBITMAP bitmap = CreateCompatibleBitmap(screen, width, height); HGDIOBJ old = SelectObject(memory, bitmap); bool copied = BitBlt(memory, 0, 0, width, height, screen, x, y, SRCCOPY | CAPTUREBLT) == TRUE; SelectObject(memory, old); std::vector<unsigned char> bytes; if (copied) { Gdiplus::Bitmap image(bitmap, nullptr); if (image.GetLastStatus() == Gdiplus::Ok) bytes = LB_EncodeImageBytes(image, L"image/png"); } DeleteObject(bitmap); DeleteDC(memory); ReleaseDC(nullptr, screen); return bytes; }
bool 截图_主屏到PNG(const wchar_t* target) { return LB_CaptureRect(target, 0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)); }
bool 截图_区域到PNG(const wchar_t* target, int x, int y, int width, int height) { return LB_CaptureRect(target, x, y, width, height); }
bool 截图_窗口到PNG(const wchar_t* target, long long handle) { RECT rect = {}; return GetWindowRect(reinterpret_cast<HWND>(handle), &rect) && LB_CaptureRect(target, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top); }
std::vector<unsigned char> 截图_主屏到字节集() { return LB_CaptureRectBytes(0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)); }
std::vector<unsigned char> 截图_区域到字节集(int x, int y, int width, int height) { return LB_CaptureRectBytes(x, y, width, height); }
std::vector<unsigned char> 截图_窗口到字节集(long long handle) { RECT rect = {}; return GetWindowRect(reinterpret_cast<HWND>(handle), &rect) ? LB_CaptureRectBytes(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top) : std::vector<unsigned char>(); }
`;

const BITMAP_RUNTIME = String.raw`
long long 位图_取像素ARGB(const wchar_t* path, int x, int y) { if (!LB_EnsureGdiPlus()) return -1; Gdiplus::Bitmap image(path); if (image.GetLastStatus() != Gdiplus::Ok || x < 0 || y < 0 || x >= static_cast<int>(image.GetWidth()) || y >= static_cast<int>(image.GetHeight())) return -1; Gdiplus::Color color; return image.GetPixel(x, y, &color) == Gdiplus::Ok ? static_cast<long long>(color.GetValue()) : -1; }
bool 位图_置像素ARGB(const wchar_t* source, const wchar_t* target, int x, int y, long long argb) { if (!LB_EnsureGdiPlus()) return false; Gdiplus::Bitmap image(source); if (image.GetLastStatus() != Gdiplus::Ok || x < 0 || y < 0 || x >= static_cast<int>(image.GetWidth()) || y >= static_cast<int>(image.GetHeight()) || image.SetPixel(x, y, Gdiplus::Color(static_cast<Gdiplus::ARGB>(argb))) != Gdiplus::Ok) return false; return LB_SaveImage(image, target); }
int 位图_取像素红色(long long argb) { return static_cast<int>((argb >> 16) & 255); } int 位图_取像素绿色(long long argb) { return static_cast<int>((argb >> 8) & 255); } int 位图_取像素蓝色(long long argb) { return static_cast<int>(argb & 255); }
`;

const ICON_RUNTIME = String.raw`
int 图标_取数量(const wchar_t* path) { return static_cast<int>(ExtractIconExW(path, -1, nullptr, nullptr, 0)); }
static bool LB_ExtractIcon(const wchar_t* source, int index, const wchar_t* target, bool large) { HICON icon = nullptr; UINT count = large ? ExtractIconExW(source, index, &icon, nullptr, 1) : ExtractIconExW(source, index, nullptr, &icon, 1); if (!count || !icon) return false; Gdiplus::Bitmap image(icon); bool result = LB_SaveImage(image, target, L"png"); DestroyIcon(icon); return result; }
bool 图标_提取大图标到PNG(const wchar_t* source, int index, const wchar_t* target) { return LB_ExtractIcon(source, index, target, true); }
bool 图标_提取小图标到PNG(const wchar_t* source, int index, const wchar_t* target) { return LB_ExtractIcon(source, index, target, false); }
`;

const RECOGNITION_RUNTIME = String.raw`
// 识图结果为线程本地状态：单点查找写 (X,Y)，多处匹配写命中列表，跨线程互不串扰（threading 工作线程可安全调用）。
static thread_local int t_lbRecognitionX = -1;
static thread_local int t_lbRecognitionY = -1;
struct LB_RecHitPoint { int x; int y; };
static thread_local std::vector<LB_RecHitPoint> t_lbRecognitionMatches;
int 识图_取结果横坐标() { return t_lbRecognitionX; } int 识图_取结果纵坐标() { return t_lbRecognitionY; }
int 识图_颜色相似度(long long first, long long second) { int red = std::abs(static_cast<int>((first >> 16) & 255) - static_cast<int>((second >> 16) & 255)); int green = std::abs(static_cast<int>((first >> 8) & 255) - static_cast<int>((second >> 8) & 255)); int blue = std::abs(static_cast<int>(first & 255) - static_cast<int>(second & 255)); return (std::max)(red, (std::max)(green, blue)); }
namespace {
// LockBits 一次性锁出的 BGRA 像素缓冲，行内 4 字节一像素；替代逐像素取色的万倍级调用开销。
struct LB_RecPixels { int width = 0; int height = 0; std::vector<unsigned char> data; };
static void LB_RecResetResults() { t_lbRecognitionX = -1; t_lbRecognitionY = -1; t_lbRecognitionMatches.clear(); }
static int LB_RecAllowed(int tolerance) { return (std::max)(0, (std::min)(tolerance, 255)); }
static bool LB_RecLockPixels(Gdiplus::Bitmap& bitmap, LB_RecPixels& out) {
    out.width = static_cast<int>(bitmap.GetWidth()); out.height = static_cast<int>(bitmap.GetHeight());
    if (out.width <= 0 || out.height <= 0) return false;
    out.data.assign(static_cast<size_t>(out.width) * static_cast<size_t>(out.height) * 4, 0);
    Gdiplus::BitmapData locked;
    Gdiplus::Rect rect(0, 0, out.width, out.height);
    if (bitmap.LockBits(&rect, Gdiplus::ImageLockModeRead, PixelFormat32bppARGB, &locked) != Gdiplus::Ok) return false;
    for (int y = 0; y < out.height; ++y) memcpy(out.data.data() + static_cast<size_t>(y) * static_cast<size_t>(out.width) * 4, static_cast<const unsigned char*>(locked.Scan0) + static_cast<size_t>(y) * static_cast<size_t>(locked.Stride), static_cast<size_t>(out.width) * 4);
    bitmap.UnlockBits(&locked);
    return true;
}
static Gdiplus::Bitmap* LB_RecOpenImage(const wchar_t* path) { if (!LB_EnsureGdiPlus()) return nullptr; Gdiplus::Bitmap* bitmap = new Gdiplus::Bitmap(path); if (bitmap->GetLastStatus() != Gdiplus::Ok) { delete bitmap; return nullptr; } return bitmap; }
static int LB_RecChannelDiff(const unsigned char* pixel, int targetR, int targetG, int targetB) { const int red = pixel[2] > targetR ? pixel[2] - targetR : targetR - pixel[2]; const int green = pixel[1] > targetG ? pixel[1] - targetG : targetG - pixel[1]; const int blue = pixel[0] > targetB ? pixel[0] - targetB : targetB - pixel[0]; return (std::max)(red, (std::max)(green, blue)); }
static void LB_RecClampRegion(const LB_RecPixels& image, int& x, int& y, int& width, int& height) { if (x < 0) x = 0; if (y < 0) y = 0; if (width <= 0 || x + width > image.width) width = image.width - x; if (height <= 0 || y + height > image.height) height = image.height - y; }
static bool LB_RecFindColor(const LB_RecPixels& image, long long argb, int allowed, int regionX, int regionY, int regionWidth, int regionHeight) {
    LB_RecClampRegion(image, regionX, regionY, regionWidth, regionHeight);
    if (regionWidth <= 0 || regionHeight <= 0) return false;
    const int targetR = static_cast<int>((argb >> 16) & 255), targetG = static_cast<int>((argb >> 8) & 255), targetB = static_cast<int>(argb & 255);
    for (int y = regionY; y < regionY + regionHeight; ++y) {
        const unsigned char* row = image.data.data() + static_cast<size_t>(y) * static_cast<size_t>(image.width) * 4;
        for (int x = regionX; x < regionX + regionWidth; ++x) {
            if (LB_RecChannelDiff(row + static_cast<size_t>(x) * 4, targetR, targetG, targetB) <= allowed) { t_lbRecognitionX = x; t_lbRecognitionY = y; return true; }
        }
    }
    return false;
}
// 单点（collected == nullptr）命中即返回；多处按 从上到下、从左到右 收集，suppressionRadius 按左上角间距去重（同一模板左上角间距等于中心点间距）。
static bool LB_RecTemplateMatch(const LB_RecPixels& image, const LB_RecPixels& pattern, int allowed, int regionX, int regionY, int regionWidth, int regionHeight, std::vector<LB_RecHitPoint>* collected, int maximumResults, int suppressionRadius) {
    LB_RecClampRegion(image, regionX, regionY, regionWidth, regionHeight);
    if (regionWidth <= 0 || regionHeight <= 0 || pattern.width <= 0 || pattern.height <= 0 || pattern.width > regionWidth || pattern.height > regionHeight || static_cast<long long>(pattern.width) * static_cast<long long>(pattern.height) > 512LL * 512LL) return false;
    const int lastX = regionX + regionWidth - pattern.width, lastY = regionY + regionHeight - pattern.height;
    const unsigned char* anchor = pattern.data.data();
    const int anchorR = anchor[2], anchorG = anchor[1], anchorB = anchor[0];
    const long long radiusSquared = suppressionRadius > 0 ? static_cast<long long>(suppressionRadius) * suppressionRadius : 0;
    for (int y = regionY; y <= lastY; ++y) {
        for (int x = regionX; x <= lastX; ++x) {
            if (LB_RecChannelDiff(image.data.data() + (static_cast<size_t>(y) * static_cast<size_t>(image.width) + static_cast<size_t>(x)) * 4, anchorR, anchorG, anchorB) > allowed) continue;
            bool matches = true;
            for (int py = 0; py < pattern.height && matches; ++py) {
                const unsigned char* sourceRow = image.data.data() + (static_cast<size_t>(y + py) * static_cast<size_t>(image.width) + static_cast<size_t>(x)) * 4;
                const unsigned char* patternRow = pattern.data.data() + static_cast<size_t>(py) * static_cast<size_t>(pattern.width) * 4;
                for (int px = 0; px < pattern.width; ++px) {
                    const unsigned char* s = sourceRow + static_cast<size_t>(px) * 4;
                    const unsigned char* e = patternRow + static_cast<size_t>(px) * 4;
                    const int red = s[2] > e[2] ? s[2] - e[2] : e[2] - s[2];
                    const int green = s[1] > e[1] ? s[1] - e[1] : e[1] - s[1];
                    const int blue = s[0] > e[0] ? s[0] - e[0] : e[0] - s[0];
                    if ((std::max)(red, (std::max)(green, blue)) > allowed) { matches = false; break; }
                }
            }
            if (!matches) continue;
            if (!collected) { t_lbRecognitionX = x; t_lbRecognitionY = y; return true; }
            if (radiusSquared > 0) {
                bool suppressed = false;
                for (const LB_RecHitPoint& hit : *collected) { const long long dx = x - hit.x, dy = y - hit.y; if (dx * dx + dy * dy < radiusSquared) { suppressed = true; break; } }
                if (suppressed) continue;
            }
            collected->push_back({ x, y });
            if (maximumResults > 0 && static_cast<int>(collected->size()) >= maximumResults) return true;
        }
    }
    return false;
}
static bool LB_RecPatternReady(const LB_RecPixels& pattern) { return pattern.width > 0 && pattern.height > 0 && static_cast<long long>(pattern.width) * static_cast<long long>(pattern.height) <= 512LL * 512LL; }
static bool LB_RecLoadFilePixels(const wchar_t* path, LB_RecPixels& pixels) { Gdiplus::Bitmap* bitmap = LB_RecOpenImage(path); if (!bitmap) return false; const bool ok = LB_RecLockPixels(*bitmap, pixels); delete bitmap; return ok; }
// 等待族共用轮询骨架：openImage 每轮重新取图（文件版=重读文件，字节集版=重新解码），wantFound=true 等出现、false 等消失。
template <typename LB_OpenEachPoll>
static bool LB_RecWaitLoop(bool wantFound, const LB_RecPixels& pattern, int tolerance, int timeoutMs, int intervalMs, int regionX, int regionY, int regionWidth, int regionHeight, LB_OpenEachPoll openImage) {
    if (intervalMs < 10) intervalMs = 10;
    if (intervalMs > 60000) intervalMs = 60000;
    if (timeoutMs < 0) timeoutMs = 0;
    const int allowed = LB_RecAllowed(tolerance);
    const ULONGLONG start = GetTickCount64();
    for (;;) {
        t_lbRecognitionX = -1; t_lbRecognitionY = -1;
        Gdiplus::Bitmap* bitmap = openImage();
        bool found = false;
        if (bitmap) {
            LB_RecPixels image;
            if (LB_RecLockPixels(*bitmap, image)) found = LB_RecTemplateMatch(image, pattern, allowed, regionX, regionY, regionWidth, regionHeight, nullptr, 0, 0);
            delete bitmap;
        }
        if (found == wantFound) return true;
        const ULONGLONG elapsed = GetTickCount64() - start;
        if (elapsed >= static_cast<ULONGLONG>(timeoutMs)) return false;
        const ULONGLONG remain = static_cast<ULONGLONG>(timeoutMs) - elapsed;
        Sleep(static_cast<DWORD>(remain < static_cast<ULONGLONG>(intervalMs) ? remain : static_cast<ULONGLONG>(intervalMs)));
    }
}
} // namespace
bool 识图_查找颜色(const wchar_t* path, long long argb, int tolerance, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels image; if (!LB_RecLoadFilePixels(path, image)) return false; return LB_RecFindColor(image, argb, LB_RecAllowed(tolerance), regionX, regionY, regionWidth, regionHeight); }
bool 识图_模板匹配(const wchar_t* imagePath, const wchar_t* templatePath, int tolerance, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels image, pattern; if (!LB_RecLoadFilePixels(imagePath, image) || !LB_RecLoadFilePixels(templatePath, pattern) || !LB_RecPatternReady(pattern)) return false; return LB_RecTemplateMatch(image, pattern, LB_RecAllowed(tolerance), regionX, regionY, regionWidth, regionHeight, nullptr, 0, 0); }
static Gdiplus::Bitmap* LB_BitmapFromBytes(const std::vector<unsigned char>& data) { if (!LB_EnsureGdiPlus() || data.empty()) return nullptr; HGLOBAL mem = GlobalAlloc(GMEM_MOVEABLE, data.size()); if (!mem) return nullptr; void* raw = GlobalLock(mem); if (!raw) { GlobalFree(mem); return nullptr; } memcpy(raw, data.data(), data.size()); GlobalUnlock(mem); IStream* stream = nullptr; if (CreateStreamOnHGlobal(mem, TRUE, &stream) != S_OK || !stream) { GlobalFree(mem); return nullptr; } Gdiplus::Bitmap* bitmap = new Gdiplus::Bitmap(stream); stream->Release(); return bitmap->GetLastStatus() == Gdiplus::Ok ? bitmap : (delete bitmap, nullptr); }
static bool LB_RecLoadBytesPixels(const std::vector<unsigned char>& data, LB_RecPixels& pixels) { Gdiplus::Bitmap* bitmap = LB_BitmapFromBytes(data); if (!bitmap) return false; const bool ok = LB_RecLockPixels(*bitmap, pixels); delete bitmap; return ok; }
bool 识图_查找颜色字节集(const std::vector<unsigned char>& 图片数据, long long argb, int tolerance, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels image; if (!LB_RecLoadBytesPixels(图片数据, image)) return false; return LB_RecFindColor(image, argb, LB_RecAllowed(tolerance), regionX, regionY, regionWidth, regionHeight); }
bool 识图_模板匹配字节集(const std::vector<unsigned char>& 图片数据, const std::vector<unsigned char>& 模板数据, int tolerance, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels image, pattern; if (!LB_RecLoadBytesPixels(图片数据, image) || !LB_RecLoadBytesPixels(模板数据, pattern) || !LB_RecPatternReady(pattern)) return false; return LB_RecTemplateMatch(image, pattern, LB_RecAllowed(tolerance), regionX, regionY, regionWidth, regionHeight, nullptr, 0, 0); }
int 识图_模板匹配全部(const wchar_t* imagePath, const wchar_t* templatePath, int tolerance, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0, int maximumResults = 0, int suppressionRadius = 0) { LB_RecResetResults(); LB_RecPixels image, pattern; if (!LB_RecLoadFilePixels(imagePath, image) || !LB_RecLoadFilePixels(templatePath, pattern) || !LB_RecPatternReady(pattern)) return 0; LB_RecTemplateMatch(image, pattern, LB_RecAllowed(tolerance), regionX, regionY, regionWidth, regionHeight, &t_lbRecognitionMatches, maximumResults, suppressionRadius); return static_cast<int>(t_lbRecognitionMatches.size()); }
int 识图_模板匹配全部字节集(const std::vector<unsigned char>& 图片数据, const std::vector<unsigned char>& 模板数据, int tolerance, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0, int maximumResults = 0, int suppressionRadius = 0) { LB_RecResetResults(); LB_RecPixels image, pattern; if (!LB_RecLoadBytesPixels(图片数据, image) || !LB_RecLoadBytesPixels(模板数据, pattern) || !LB_RecPatternReady(pattern)) return 0; LB_RecTemplateMatch(image, pattern, LB_RecAllowed(tolerance), regionX, regionY, regionWidth, regionHeight, &t_lbRecognitionMatches, maximumResults, suppressionRadius); return static_cast<int>(t_lbRecognitionMatches.size()); }
int 识图_取匹配数量() { return static_cast<int>(t_lbRecognitionMatches.size()); }
int 识图_取第N横坐标(int index) { return index >= 1 && static_cast<size_t>(index) <= t_lbRecognitionMatches.size() ? t_lbRecognitionMatches[static_cast<size_t>(index) - 1].x : -1; }
int 识图_取第N纵坐标(int index) { return index >= 1 && static_cast<size_t>(index) <= t_lbRecognitionMatches.size() ? t_lbRecognitionMatches[static_cast<size_t>(index) - 1].y : -1; }
bool 识图_等待出现(const wchar_t* imagePath, const wchar_t* templatePath, int tolerance, int timeoutMs, int intervalMs = 200, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels pattern; if (!LB_RecLoadFilePixels(templatePath, pattern) || !LB_RecPatternReady(pattern)) return false; return LB_RecWaitLoop(true, pattern, tolerance, timeoutMs, intervalMs, regionX, regionY, regionWidth, regionHeight, [imagePath]() { return LB_RecOpenImage(imagePath); }); }
bool 识图_等待出现字节集(const std::vector<unsigned char>& 图片数据, const std::vector<unsigned char>& 模板数据, int tolerance, int timeoutMs, int intervalMs = 200, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels pattern; if (!LB_RecLoadBytesPixels(模板数据, pattern) || !LB_RecPatternReady(pattern)) return false; return LB_RecWaitLoop(true, pattern, tolerance, timeoutMs, intervalMs, regionX, regionY, regionWidth, regionHeight, [&图片数据]() { return LB_BitmapFromBytes(图片数据); }); }
bool 识图_等待消失(const wchar_t* imagePath, const wchar_t* templatePath, int tolerance, int timeoutMs, int intervalMs = 200, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels pattern; if (!LB_RecLoadFilePixels(templatePath, pattern) || !LB_RecPatternReady(pattern)) return false; return LB_RecWaitLoop(false, pattern, tolerance, timeoutMs, intervalMs, regionX, regionY, regionWidth, regionHeight, [imagePath]() { return LB_RecOpenImage(imagePath); }); }
bool 识图_等待消失字节集(const std::vector<unsigned char>& 图片数据, const std::vector<unsigned char>& 模板数据, int tolerance, int timeoutMs, int intervalMs = 200, int regionX = 0, int regionY = 0, int regionWidth = 0, int regionHeight = 0) { LB_RecResetResults(); LB_RecPixels pattern; if (!LB_RecLoadBytesPixels(模板数据, pattern) || !LB_RecPatternReady(pattern)) return false; return LB_RecWaitLoop(false, pattern, tolerance, timeoutMs, intervalMs, regionX, regionY, regionWidth, regionHeight, [&图片数据]() { return LB_BitmapFromBytes(图片数据); }); }

`;

const AUDIO_RUNTIME = String.raw`
bool 音频_播放WAV(const wchar_t* path, bool loop) { return PlaySoundW(path, nullptr, SND_FILENAME | SND_ASYNC | SND_NODEFAULT | (loop ? SND_LOOP : 0)) == TRUE; }
void 音频_停止() { PlaySoundW(nullptr, nullptr, 0); }
bool 音频_播放系统提示() { return PlaySoundW(L"SystemNotification", nullptr, SND_ALIAS | SND_ASYNC | SND_NODEFAULT) == TRUE; }
int 音频_取主音量() { DWORD volume = 0; if (waveOutGetVolume(nullptr, &volume) != MMSYSERR_NOERROR) return -1; return static_cast<int>((LOWORD(volume) * 100ULL) / 0xffff); }
bool 音频_设置主音量(int volume) { DWORD value = static_cast<DWORD>(((std::max)(0, (std::min)(volume, 100)) * 0xffff) / 100); return waveOutSetVolume(nullptr, MAKELONG(value, value)) == MMSYSERR_NOERROR; }

// 静音：WinMM Mixer API（操作默认波形输出的扬声器静音控制）
static bool LB_AudioGetSpeakerMuteControl(HMIXER* mixerHandle, MIXERCONTROL* control) {
    if (mixerOpen(mixerHandle, 0, 0, 0, 0) != MMSYSERR_NOERROR) return false;
    MIXERLINE line = {}; line.cbStruct = sizeof(line);
    line.dwComponentType = MIXERLINE_COMPONENTTYPE_DST_SPEAKERS;
    if (mixerGetLineInfo(reinterpret_cast<HMIXEROBJ>(*mixerHandle), &line, MIXER_GETLINEINFOF_COMPONENTTYPE) != MMSYSERR_NOERROR) { mixerClose(*mixerHandle); return false; }
    MIXERLINECONTROLS controls = {}; controls.cbStruct = sizeof(controls);
    controls.dwLineID = line.dwLineID;
    controls.dwControlType = MIXERCONTROL_CONTROLTYPE_MUTE;
    controls.cControls = 1;
    controls.cbmxctrl = sizeof(*control);
    controls.pamxctrl = control;
    if (mixerGetLineControls(reinterpret_cast<HMIXEROBJ>(*mixerHandle), &controls, MIXER_GETLINECONTROLSF_ONEBYTYPE) != MMSYSERR_NOERROR) { mixerClose(*mixerHandle); return false; }
    return true;
}

bool 音频_置静音(bool mute) {
    HMIXER mixer = nullptr;
    MIXERCONTROL control = {};
    if (!LB_AudioGetSpeakerMuteControl(&mixer, &control)) return false;
    MIXERCONTROLDETAILS details = {}; details.cbStruct = sizeof(details);
    details.dwControlID = control.dwControlID;
    details.cChannels = 1;
    details.cbDetails = sizeof(MIXERCONTROLDETAILS_BOOLEAN);
    MIXERCONTROLDETAILS_BOOLEAN value = {};
    value.fValue = mute ? 1 : 0;
    details.paDetails = &value;
    const bool ok = mixerSetControlDetails(reinterpret_cast<HMIXEROBJ>(mixer), &details, MIXER_SETCONTROLDETAILSF_VALUE) == MMSYSERR_NOERROR;
    mixerClose(mixer);
    return ok;
}

bool 音频_取静音() {
    HMIXER mixer = nullptr;
    MIXERCONTROL control = {};
    if (!LB_AudioGetSpeakerMuteControl(&mixer, &control)) return false;
    MIXERCONTROLDETAILS details = {}; details.cbStruct = sizeof(details);
    details.dwControlID = control.dwControlID;
    details.cChannels = 1;
    details.cbDetails = sizeof(MIXERCONTROLDETAILS_BOOLEAN);
    MIXERCONTROLDETAILS_BOOLEAN value = {};
    details.paDetails = &value;
    mixerGetControlDetails(reinterpret_cast<HMIXEROBJ>(mixer), &details, MIXER_GETCONTROLDETAILSF_VALUE);
    mixerClose(mixer);
    return value.fValue != 0;
}
// ===== MCI 播放控制族（mp3/midi 等，按扩展名自动选驱动） =====
static bool LB_Mci(const wchar_t* commandText) { return mciSendStringW(commandText, nullptr, 0, nullptr) == 0; }

static bool 音频_播放MP3(const wchar_t* path, bool loop) {
    const std::wstring file = LB_Wide(path);
    if (file.empty()) return false;
    mciSendStringW(L"close LB_MP3", nullptr, 0, nullptr);
    std::wstring open = L"open \"" + file + L"\" alias LB_MP3";
    if (!LB_Mci(open.c_str())) return false;
    LB_Mci(L"set LB_MP3 time format ms");
    std::wstring play = L"play LB_MP3";
    if (loop) play += L" repeat";
    return LB_Mci(play.c_str());
}

bool 音频_暂停MP3() { return LB_Mci(L"pause LB_MP3"); }
bool 音频_继续MP3() { return LB_Mci(L"resume LB_MP3"); }
bool 音频_停止MP3() { return LB_Mci(L"stop LB_MP3"); }

const wchar_t* 音频_取MP3状态() {
    wchar_t buffer[64] = {};
    if (mciSendStringW(L"status LB_MP3 mode", buffer, 64, nullptr) != 0) return LB_ReturnText(L"已停止");
    const std::wstring mode = buffer;
    if (mode == L"playing") return LB_ReturnText(L"播放中");
    if (mode == L"paused") return LB_ReturnText(L"已暂停");
    return LB_ReturnText(L"已停止");
}

int 音频_取MP3长度() {
    wchar_t buffer[64] = {};
    if (mciSendStringW(L"status LB_MP3 length", buffer, 64, nullptr) != 0) return 0;
    return _wtoi(buffer);
}

int 音频_取MP3位置() {
    wchar_t buffer[64] = {};
    if (mciSendStringW(L"status LB_MP3 position", buffer, 64, nullptr) != 0) return 0;
    return _wtoi(buffer);
}

bool 音频_跳转MP3(int positionMs) {
    std::wstring command = L"seek LB_MP3 to " + std::to_wstring((std::max)(0, positionMs));
    if (!LB_Mci(command.c_str())) return false;
    return LB_Mci(L"play LB_MP3");
}

bool 音频_播放MIDI(const wchar_t* path, bool loop) {
    const std::wstring file = LB_Wide(path);
    if (file.empty()) return false;
    mciSendStringW(L"close LB_MIDI", nullptr, 0, nullptr);
    std::wstring open = L"open \"" + file + L"\" type sequencer alias LB_MIDI";
    if (!LB_Mci(open.c_str())) return false;
    std::wstring play = L"play LB_MIDI";
    if (loop) play += L" repeat";
    return LB_Mci(play.c_str());
}

bool 音频_停止MIDI() { return LB_Mci(L"stop LB_MIDI"); }
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.data.csv': CSV_RUNTIME,
  'lingbuilder.crypto.windows': CRYPTO_RUNTIME,
  'lingbuilder.database.odbc': ODBC_RUNTIME,
  'lingbuilder.database.sqlite': SQLITE_RUNTIME,
  'lingbuilder.database.mysql': MYSQL_RUNTIME,
  'lingbuilder.data.excel': EXCEL_RUNTIME,
  'lingbuilder.image.core': IMAGE_CORE_RUNTIME,
  'lingbuilder.image.capture': CAPTURE_RUNTIME,
  'lingbuilder.image.bitmap': BITMAP_RUNTIME,
  'lingbuilder.image.icon': ICON_RUNTIME,
  'lingbuilder.image.recognition': RECOGNITION_RUNTIME,
  'lingbuilder.opencv': OPENCV_RUNTIME,
  'lingbuilder.media.audio': AUDIO_RUNTIME
};

export function generateDataMediaRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  const fragments = Object.entries(RUNTIMES).filter(([moduleId]) => enabledIds.has(moduleId)).map(([, runtime]) => runtime);
  const cryptoRuntime = generateCryptoRuntime(enabledIds);
  const needsImages = ['lingbuilder.image.core', 'lingbuilder.image.capture', 'lingbuilder.image.bitmap', 'lingbuilder.image.icon', 'lingbuilder.image.recognition'].some(moduleId => enabledIds.has(moduleId));
  return [needsImages ? IMAGE_SUPPORT : '', cryptoRuntime, ...fragments].filter(Boolean).join('\n');
}
