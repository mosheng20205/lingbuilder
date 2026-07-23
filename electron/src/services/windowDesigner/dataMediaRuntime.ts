import { InstalledModule } from '../modules/types';

const CSV_RUNTIME = String.raw`
static std::wstring LB_CsvEscape(const std::wstring& field) { if (field.find_first_of(L",\"\r\n") == std::wstring::npos) return field; std::wstring escaped = field; LB_ReplaceAll(escaped, L"\"", L"\"\""); return L"\"" + escaped + L"\""; }
static std::vector<std::wstring> LB_CsvParse(const wchar_t* line) { std::vector<std::wstring> result; std::wstring current; bool quoted = false; const std::wstring value = LB_Wide(line); for (size_t index = 0; index < value.size(); ++index) { wchar_t ch = value[index]; if (quoted) { if (ch == L'\"' && index + 1 < value.size() && value[index + 1] == L'\"') { current.push_back(L'\"'); ++index; } else if (ch == L'\"') quoted = false; else current.push_back(ch); } else if (ch == L'\"' && current.empty()) quoted = true; else if (ch == L',') { result.push_back(current); current.clear(); } else current.push_back(ch); } result.push_back(current); return result; }
const wchar_t* CSV_转义字段(const wchar_t* field) { return LB_ReturnText(LB_CsvEscape(LB_Wide(field))); }
const wchar_t* CSV_生成两列(const wchar_t* first, const wchar_t* second) { return LB_ReturnText(LB_CsvEscape(LB_Wide(first)) + L"," + LB_CsvEscape(LB_Wide(second))); }
const wchar_t* CSV_生成三列(const wchar_t* first, const wchar_t* second, const wchar_t* third) { return LB_ReturnText(LB_CsvEscape(LB_Wide(first)) + L"," + LB_CsvEscape(LB_Wide(second)) + L"," + LB_CsvEscape(LB_Wide(third))); }
int CSV_字段数量(const wchar_t* line) { return static_cast<int>(LB_CsvParse(line).size()); }
const wchar_t* CSV_取字段(const wchar_t* line, int index) { auto fields = LB_CsvParse(line); return index >= 0 && static_cast<size_t>(index) < fields.size() ? LB_ReturnText(fields[static_cast<size_t>(index)]) : LB_ReturnText(L""); }
`;

const HASH_RUNTIME = String.raw`
static std::wstring LB_BytesToHex(const std::vector<unsigned char>& bytes) { static constexpr wchar_t digits[] = L"0123456789ABCDEF"; std::wstring result; result.reserve(bytes.size() * 2); for (unsigned char byte : bytes) { result.push_back(digits[byte >> 4]); result.push_back(digits[byte & 15]); } return result; }

static bool LB_HashBegin(const wchar_t* algorithm, BCRYPT_ALG_HANDLE& provider, BCRYPT_HASH_HANDLE& hash, std::vector<unsigned char>& object, DWORD& hashLength) {
    provider = nullptr; hash = nullptr; if (BCryptOpenAlgorithmProvider(&provider, algorithm, nullptr, 0) < 0) return false; DWORD objectLength = 0, size = 0;
    if (BCryptGetProperty(provider, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&objectLength), sizeof(objectLength), &size, 0) < 0 || BCryptGetProperty(provider, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hashLength), sizeof(hashLength), &size, 0) < 0) { BCryptCloseAlgorithmProvider(provider, 0); return false; }
    object.resize(objectLength); if (BCryptCreateHash(provider, &hash, object.data(), objectLength, nullptr, 0, 0) < 0) { BCryptCloseAlgorithmProvider(provider, 0); return false; } return true;
}

static std::wstring LB_HashBytes(const wchar_t* algorithm, const unsigned char* data, size_t length) { BCRYPT_ALG_HANDLE provider = nullptr; BCRYPT_HASH_HANDLE hash = nullptr; std::vector<unsigned char> object; DWORD hashLength = 0; if (!LB_HashBegin(algorithm, provider, hash, object, hashLength)) return {}; bool success = BCryptHashData(hash, const_cast<PUCHAR>(data), static_cast<ULONG>(length), 0) >= 0; std::vector<unsigned char> digest(hashLength); if (success) success = BCryptFinishHash(hash, digest.data(), hashLength, 0) >= 0; BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(provider, 0); return success ? LB_BytesToHex(digest) : L""; }

static std::wstring LB_HashFile(const wchar_t* algorithm, const wchar_t* path) { std::ifstream stream(std::filesystem::path(LB_Wide(path)), std::ios::binary); if (!stream) return {}; BCRYPT_ALG_HANDLE provider = nullptr; BCRYPT_HASH_HANDLE hash = nullptr; std::vector<unsigned char> object; DWORD hashLength = 0; if (!LB_HashBegin(algorithm, provider, hash, object, hashLength)) return {}; std::array<char, 64 * 1024> buffer = {}; bool success = true; while (stream) { stream.read(buffer.data(), buffer.size()); const std::streamsize count = stream.gcount(); if (count > 0 && BCryptHashData(hash, reinterpret_cast<PUCHAR>(buffer.data()), static_cast<ULONG>(count), 0) < 0) { success = false; break; } } std::vector<unsigned char> digest(hashLength); if (success) success = BCryptFinishHash(hash, digest.data(), hashLength, 0) >= 0; BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(provider, 0); return success ? LB_BytesToHex(digest) : L""; }

const wchar_t* 哈希_SHA256文本(const wchar_t* text) { const std::string bytes = LB_WideToUtf8(text); return LB_ReturnText(LB_HashBytes(BCRYPT_SHA256_ALGORITHM, reinterpret_cast<const unsigned char*>(bytes.data()), bytes.size())); }
const wchar_t* 哈希_MD5文本(const wchar_t* text) { const std::string bytes = LB_WideToUtf8(text); return LB_ReturnText(LB_HashBytes(BCRYPT_MD5_ALGORITHM, reinterpret_cast<const unsigned char*>(bytes.data()), bytes.size())); }
const wchar_t* 哈希_SHA256文件(const wchar_t* path) { return LB_ReturnText(LB_HashFile(BCRYPT_SHA256_ALGORITHM, path)); }
const wchar_t* 哈希_MD5文件(const wchar_t* path) { return LB_ReturnText(LB_HashFile(BCRYPT_MD5_ALGORITHM, path)); }
const wchar_t* 哈希_安全随机十六进制(int byteCount) { const size_t size = static_cast<size_t>((std::max)(0, (std::min)(byteCount, 1024 * 1024))); std::vector<unsigned char> bytes(size); return BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(bytes.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) >= 0 ? LB_ReturnText(LB_BytesToHex(bytes)) : LB_ReturnText(L""); }
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
`;

const ODBC_RUNTIME = String.raw`
static SQLHENV g_lbOdbcEnvironment = SQL_NULL_HENV; static SQLHDBC g_lbOdbcConnection = SQL_NULL_HDBC; static std::wstring g_lbOdbcError;
static void LB_OdbcCapture(SQLSMALLINT type, SQLHANDLE handle) { g_lbOdbcError.clear(); SQLWCHAR state[16] = {}, message[1024] = {}; SQLINTEGER native = 0; SQLSMALLINT length = 0; if (SQLGetDiagRecW(type, handle, 1, state, &native, message, _countof(message), &length) == SQL_SUCCESS) g_lbOdbcError.assign(reinterpret_cast<wchar_t*>(message), static_cast<size_t>(length)); }
void ODBC_关闭() { if (g_lbOdbcConnection != SQL_NULL_HDBC) { SQLDisconnect(g_lbOdbcConnection); SQLFreeHandle(SQL_HANDLE_DBC, g_lbOdbcConnection); } if (g_lbOdbcEnvironment != SQL_NULL_HENV) SQLFreeHandle(SQL_HANDLE_ENV, g_lbOdbcEnvironment); g_lbOdbcConnection = SQL_NULL_HDBC; g_lbOdbcEnvironment = SQL_NULL_HENV; }
const wchar_t* ODBC_取错误() { return LB_ReturnText(g_lbOdbcError); }
bool ODBC_连接(const wchar_t* connectionString) { ODBC_关闭(); if (SQLAllocHandle(SQL_HANDLE_ENV, SQL_NULL_HANDLE, &g_lbOdbcEnvironment) != SQL_SUCCESS || SQLSetEnvAttr(g_lbOdbcEnvironment, SQL_ATTR_ODBC_VERSION, reinterpret_cast<SQLPOINTER>(static_cast<UINT_PTR>(SQL_OV_ODBC3)), 0) != SQL_SUCCESS || SQLAllocHandle(SQL_HANDLE_DBC, g_lbOdbcEnvironment, &g_lbOdbcConnection) != SQL_SUCCESS) { g_lbOdbcError = L"ODBC 环境创建失败。"; ODBC_关闭(); return false; } SQLWCHAR output[2048] = {}; SQLSMALLINT length = 0; SQLRETURN result = SQLDriverConnectW(g_lbOdbcConnection, nullptr, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(connectionString)), SQL_NTS, output, _countof(output), &length, SQL_DRIVER_NOPROMPT); if (!SQL_SUCCEEDED(result)) { LB_OdbcCapture(SQL_HANDLE_DBC, g_lbOdbcConnection); ODBC_关闭(); return false; } return true; }
int ODBC_执行(const wchar_t* sql) { if (g_lbOdbcConnection == SQL_NULL_HDBC) return -1; SQLHSTMT statement = SQL_NULL_HSTMT; if (SQLAllocHandle(SQL_HANDLE_STMT, g_lbOdbcConnection, &statement) != SQL_SUCCESS) return -1; SQLRETURN result = SQLExecDirectW(statement, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(sql)), SQL_NTS); SQLLEN rows = -1; if (SQL_SUCCEEDED(result)) SQLRowCount(statement, &rows); else LB_OdbcCapture(SQL_HANDLE_STMT, statement); SQLFreeHandle(SQL_HANDLE_STMT, statement); return SQL_SUCCEEDED(result) ? static_cast<int>(rows) : -1; }
const wchar_t* ODBC_查询首值(const wchar_t* sql) { if (g_lbOdbcConnection == SQL_NULL_HDBC) return LB_ReturnText(L""); SQLHSTMT statement = SQL_NULL_HSTMT; if (SQLAllocHandle(SQL_HANDLE_STMT, g_lbOdbcConnection, &statement) != SQL_SUCCESS) return LB_ReturnText(L""); SQLRETURN result = SQLExecDirectW(statement, reinterpret_cast<SQLWCHAR*>(const_cast<wchar_t*>(sql)), SQL_NTS); std::wstring value; if (SQL_SUCCEEDED(result) && SQLFetch(statement) == SQL_SUCCESS) { std::array<wchar_t, 4096> buffer = {}; SQLLEN indicator = 0; if (SQL_SUCCEEDED(SQLGetData(statement, 1, SQL_C_WCHAR, buffer.data(), static_cast<SQLLEN>(buffer.size() * sizeof(wchar_t)), &indicator)) && indicator != SQL_NULL_DATA) value = buffer.data(); } else if (!SQL_SUCCEEDED(result)) LB_OdbcCapture(SQL_HANDLE_STMT, statement); SQLFreeHandle(SQL_HANDLE_STMT, statement); return LB_ReturnText(std::move(value)); }
bool ODBC_设置自动提交(bool enabled) { return g_lbOdbcConnection != SQL_NULL_HDBC && SQLSetConnectAttr(g_lbOdbcConnection, SQL_ATTR_AUTOCOMMIT, reinterpret_cast<SQLPOINTER>(static_cast<UINT_PTR>(enabled ? SQL_AUTOCOMMIT_ON : SQL_AUTOCOMMIT_OFF)), 0) == SQL_SUCCESS; }
bool ODBC_提交() { return g_lbOdbcConnection != SQL_NULL_HDBC && SQLEndTran(SQL_HANDLE_DBC, g_lbOdbcConnection, SQL_COMMIT) == SQL_SUCCESS; }
bool ODBC_回滚() { return g_lbOdbcConnection != SQL_NULL_HDBC && SQLEndTran(SQL_HANDLE_DBC, g_lbOdbcConnection, SQL_ROLLBACK) == SQL_SUCCESS; }
`;

const SQLITE_RUNTIME = String.raw`
struct sqlite3; struct sqlite3_stmt;
static HMODULE g_lbSqliteModule = nullptr; static sqlite3* g_lbSqliteDatabase = nullptr; static std::wstring g_lbSqliteError;
using LB_sqlite3_open = int(*)(const char*, sqlite3**); using LB_sqlite3_close = int(*)(sqlite3*); using LB_sqlite3_exec = int(*)(sqlite3*, const char*, void*, void*, char**); using LB_sqlite3_free = void(*)(void*); using LB_sqlite3_errmsg = const char*(*)(sqlite3*); using LB_sqlite3_changes = int(*)(sqlite3*); using LB_sqlite3_prepare_v2 = int(*)(sqlite3*, const char*, int, sqlite3_stmt**, const char**); using LB_sqlite3_step = int(*)(sqlite3_stmt*); using LB_sqlite3_column_text = const unsigned char*(*)(sqlite3_stmt*, int); using LB_sqlite3_finalize = int(*)(sqlite3_stmt*);
static LB_sqlite3_open lb_sqlite3_open = nullptr; static LB_sqlite3_close lb_sqlite3_close = nullptr; static LB_sqlite3_exec lb_sqlite3_exec = nullptr; static LB_sqlite3_free lb_sqlite3_free = nullptr; static LB_sqlite3_errmsg lb_sqlite3_errmsg = nullptr; static LB_sqlite3_changes lb_sqlite3_changes = nullptr; static LB_sqlite3_prepare_v2 lb_sqlite3_prepare_v2 = nullptr; static LB_sqlite3_step lb_sqlite3_step = nullptr; static LB_sqlite3_column_text lb_sqlite3_column_text = nullptr; static LB_sqlite3_finalize lb_sqlite3_finalize = nullptr;
void SQLite_关闭() { if (g_lbSqliteDatabase && lb_sqlite3_close) lb_sqlite3_close(g_lbSqliteDatabase); g_lbSqliteDatabase = nullptr; if (g_lbSqliteModule) FreeLibrary(g_lbSqliteModule); g_lbSqliteModule = nullptr; }
const wchar_t* SQLite_取错误() { return LB_ReturnText(g_lbSqliteError); }
bool SQLite_加载运行库(const wchar_t* path) { SQLite_关闭(); g_lbSqliteError.clear(); g_lbSqliteModule = LoadLibraryW(path && path[0] ? path : L"sqlite3.dll"); if (!g_lbSqliteModule) { g_lbSqliteError = L"无法加载 sqlite3.dll，请安装 SQLite 模块运行库或传入 DLL 路径。"; return false; } bool valid = true;
#define LB_SQLITE_LOAD(name) lb_##name = reinterpret_cast<LB_##name>(GetProcAddress(g_lbSqliteModule, #name)); valid = valid && lb_##name
    LB_SQLITE_LOAD(sqlite3_open); LB_SQLITE_LOAD(sqlite3_close); LB_SQLITE_LOAD(sqlite3_exec); LB_SQLITE_LOAD(sqlite3_free); LB_SQLITE_LOAD(sqlite3_errmsg); LB_SQLITE_LOAD(sqlite3_changes); LB_SQLITE_LOAD(sqlite3_prepare_v2); LB_SQLITE_LOAD(sqlite3_step); LB_SQLITE_LOAD(sqlite3_column_text); LB_SQLITE_LOAD(sqlite3_finalize);
#undef LB_SQLITE_LOAD
    if (!valid) { g_lbSqliteError = L"sqlite3.dll 缺少必要导出函数。"; SQLite_关闭(); return false; } return true; }
bool SQLite_打开(const wchar_t* path) { if (!g_lbSqliteModule && !SQLite_加载运行库(L"")) return false; if (g_lbSqliteDatabase) { lb_sqlite3_close(g_lbSqliteDatabase); g_lbSqliteDatabase = nullptr; } const std::string utf8Path = LB_WideToUtf8(path); if (lb_sqlite3_open(utf8Path.c_str(), &g_lbSqliteDatabase) != 0) { g_lbSqliteError = g_lbSqliteDatabase ? LB_Utf8ToWide(lb_sqlite3_errmsg(g_lbSqliteDatabase)) : L"SQLite 数据库打开失败。"; return false; } return true; }
bool SQLite_执行(const wchar_t* sql) { if (!g_lbSqliteDatabase) { g_lbSqliteError = L"SQLite 数据库尚未打开。"; return false; } const std::string query = LB_WideToUtf8(sql); char* error = nullptr; int result = lb_sqlite3_exec(g_lbSqliteDatabase, query.c_str(), nullptr, nullptr, &error); if (result != 0) { g_lbSqliteError = error ? LB_Utf8ToWide(error) : LB_Utf8ToWide(lb_sqlite3_errmsg(g_lbSqliteDatabase)); if (error) lb_sqlite3_free(error); return false; } return true; }
const wchar_t* SQLite_查询首值(const wchar_t* sql) { if (!g_lbSqliteDatabase) return LB_ReturnText(L""); const std::string query = LB_WideToUtf8(sql); sqlite3_stmt* statement = nullptr; if (lb_sqlite3_prepare_v2(g_lbSqliteDatabase, query.c_str(), -1, &statement, nullptr) != 0) { g_lbSqliteError = LB_Utf8ToWide(lb_sqlite3_errmsg(g_lbSqliteDatabase)); return LB_ReturnText(L""); } std::wstring value; if (lb_sqlite3_step(statement) == 100) { const unsigned char* text = lb_sqlite3_column_text(statement, 0); if (text) value = LB_Utf8ToWide(reinterpret_cast<const char*>(text)); } lb_sqlite3_finalize(statement); return LB_ReturnText(std::move(value)); }
int SQLite_取更改行数() { return g_lbSqliteDatabase && lb_sqlite3_changes ? lb_sqlite3_changes(g_lbSqliteDatabase) : 0; }
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
bool 截图_主屏到PNG(const wchar_t* target) { return LB_CaptureRect(target, 0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)); }
bool 截图_区域到PNG(const wchar_t* target, int x, int y, int width, int height) { return LB_CaptureRect(target, x, y, width, height); }
bool 截图_窗口到PNG(const wchar_t* target, long long handle) { RECT rect = {}; return GetWindowRect(reinterpret_cast<HWND>(handle), &rect) && LB_CaptureRect(target, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top); }
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
static int g_lbRecognitionX = -1, g_lbRecognitionY = -1;
int 识图_取结果横坐标() { return g_lbRecognitionX; } int 识图_取结果纵坐标() { return g_lbRecognitionY; }
int 识图_颜色相似度(long long first, long long second) { int red = std::abs(static_cast<int>((first >> 16) & 255) - static_cast<int>((second >> 16) & 255)); int green = std::abs(static_cast<int>((first >> 8) & 255) - static_cast<int>((second >> 8) & 255)); int blue = std::abs(static_cast<int>(first & 255) - static_cast<int>(second & 255)); return (std::max)(red, (std::max)(green, blue)); }
bool 识图_查找颜色(const wchar_t* path, long long argb, int tolerance) { g_lbRecognitionX = g_lbRecognitionY = -1; if (!LB_EnsureGdiPlus()) return false; Gdiplus::Bitmap image(path); if (image.GetLastStatus() != Gdiplus::Ok) return false; const int allowed = (std::max)(0, (std::min)(tolerance, 255)); for (UINT y = 0; y < image.GetHeight(); ++y) for (UINT x = 0; x < image.GetWidth(); ++x) { Gdiplus::Color color; if (image.GetPixel(x, y, &color) == Gdiplus::Ok && 识图_颜色相似度(color.GetValue(), argb) <= allowed) { g_lbRecognitionX = static_cast<int>(x); g_lbRecognitionY = static_cast<int>(y); return true; } } return false; }
bool 识图_模板匹配(const wchar_t* imagePath, const wchar_t* templatePath, int tolerance) { g_lbRecognitionX = g_lbRecognitionY = -1; if (!LB_EnsureGdiPlus()) return false; Gdiplus::Bitmap image(imagePath), pattern(templatePath); if (image.GetLastStatus() != Gdiplus::Ok || pattern.GetLastStatus() != Gdiplus::Ok || pattern.GetWidth() == 0 || pattern.GetHeight() == 0 || pattern.GetWidth() > image.GetWidth() || pattern.GetHeight() > image.GetHeight() || pattern.GetWidth() * pattern.GetHeight() > 512 * 512) return false; const int allowed = (std::max)(0, (std::min)(tolerance, 255)); for (UINT y = 0; y + pattern.GetHeight() <= image.GetHeight(); ++y) for (UINT x = 0; x + pattern.GetWidth() <= image.GetWidth(); ++x) { bool matches = true; for (UINT py = 0; py < pattern.GetHeight() && matches; ++py) for (UINT px = 0; px < pattern.GetWidth(); ++px) { Gdiplus::Color source, expected; image.GetPixel(x + px, y + py, &source); pattern.GetPixel(px, py, &expected); if (识图_颜色相似度(source.GetValue(), expected.GetValue()) > allowed) { matches = false; break; } } if (matches) { g_lbRecognitionX = static_cast<int>(x); g_lbRecognitionY = static_cast<int>(y); return true; } } return false; }
`;

const AUDIO_RUNTIME = String.raw`
bool 音频_播放WAV(const wchar_t* path, bool loop) { return PlaySoundW(path, nullptr, SND_FILENAME | SND_ASYNC | SND_NODEFAULT | (loop ? SND_LOOP : 0)) == TRUE; }
void 音频_停止() { PlaySoundW(nullptr, nullptr, 0); }
bool 音频_播放系统提示() { return PlaySoundW(L"SystemNotification", nullptr, SND_ALIAS | SND_ASYNC | SND_NODEFAULT) == TRUE; }
int 音频_取主音量() { DWORD volume = 0; if (waveOutGetVolume(nullptr, &volume) != MMSYSERR_NOERROR) return -1; return static_cast<int>((LOWORD(volume) * 100ULL) / 0xffff); }
bool 音频_设置主音量(int volume) { DWORD value = static_cast<DWORD>(((std::max)(0, (std::min)(volume, 100)) * 0xffff) / 100); return waveOutSetVolume(nullptr, MAKELONG(value, value)) == MMSYSERR_NOERROR; }
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.data.csv': CSV_RUNTIME,
  'lingbuilder.crypto.hash': HASH_RUNTIME,
  'lingbuilder.crypto.windows': CRYPTO_RUNTIME,
  'lingbuilder.database.odbc': ODBC_RUNTIME,
  'lingbuilder.database.sqlite': SQLITE_RUNTIME,
  'lingbuilder.image.core': IMAGE_CORE_RUNTIME,
  'lingbuilder.image.capture': CAPTURE_RUNTIME,
  'lingbuilder.image.bitmap': BITMAP_RUNTIME,
  'lingbuilder.image.icon': ICON_RUNTIME,
  'lingbuilder.image.recognition': RECOGNITION_RUNTIME,
  'lingbuilder.media.audio': AUDIO_RUNTIME
};

export function generateDataMediaRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  const fragments = Object.entries(RUNTIMES).filter(([moduleId]) => enabledIds.has(moduleId)).map(([, runtime]) => runtime);
  const needsImages = ['lingbuilder.image.core', 'lingbuilder.image.capture', 'lingbuilder.image.bitmap', 'lingbuilder.image.icon', 'lingbuilder.image.recognition'].some(moduleId => enabledIds.has(moduleId));
  return [needsImages ? IMAGE_SUPPORT : '', ...fragments].filter(Boolean).join('\n');
}
