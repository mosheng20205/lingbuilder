// lb_minijson.h — LingBuilder 迷你 JSON 解析/序列化单头（word-bridge 批量占位符/报告生成、pdf-bridge 备用）。
// 约束：内容会被内联进生成器运行时（String.raw 注入），不得出现反引号与 ${ 序列。
#ifndef LB_MINIJSON_H
#define LB_MINIJSON_H

#include <cstdint>
#include <cstdlib>
#include <cmath>
#include <string>
#include <vector>
#include <memory>

namespace lbjson {

struct Value {
    enum class Kind { Null, Bool, Number, String, Array, Object };
    Kind kind = Kind::Null;
    bool boolValue = false;
    double number = 0;
    std::string text; // UTF-8
    std::vector<Value> items;
    std::vector<std::pair<std::string, Value>> members;

    bool isObject() const { return kind == Kind::Object; }
    bool isString() const { return kind == Kind::String; }
    const Value* find(const std::string& key) const {
        if (kind != Kind::Object) return nullptr;
        for (const auto& kv : members) if (kv.first == key) return &kv.second;
        return nullptr;
    }
    std::string asString(const std::string& fallback = std::string()) const {
        if (kind == Kind::String) return text;
        if (kind == Kind::Number) {
            char buf[32];
            if (number == std::floor(number) && std::fabs(number) < 1e15) { snprintf(buf, sizeof buf, "%lld", static_cast<long long>(number)); return buf; }
            snprintf(buf, sizeof buf, "%.10g", number);
            return buf;
        }
        if (kind == Kind::Bool) return boolValue ? "true" : "false";
        return fallback;
    }
};

struct Parser {
    const char* p = nullptr;
    const char* end = nullptr;
    std::string error;

    void skipWs() { while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) p++; }
    bool parse(const std::string& input, Value& out) {
        p = input.data(); end = input.data() + input.size(); error.clear();
        skipWs();
        if (!parseValue(out)) return false;
        skipWs();
        if (p != end) { error = "JSON 末尾存在多余内容"; return false; }
        return true;
    }
    bool parseValue(Value& out) {
        skipWs();
        if (p >= end) { error = "JSON 意外结束"; return false; }
        char c = *p;
        if (c == '{') return parseObject(out);
        if (c == '[') return parseArray(out);
        if (c == '"') { out.kind = Value::Kind::String; return parseString(out.text); }
        if (c == 't') { if (end - p >= 4 && !strncmp(p, "true", 4)) { out.kind = Value::Kind::Bool; out.boolValue = true; p += 4; return true; } error = "非法字面量"; return false; }
        if (c == 'f') { if (end - p >= 5 && !strncmp(p, "false", 5)) { out.kind = Value::Kind::Bool; out.boolValue = false; p += 5; return true; } error = "非法字面量"; return false; }
        if (c == 'n') { if (end - p >= 4 && !strncmp(p, "null", 4)) { out.kind = Value::Kind::Null; p += 4; return true; } error = "非法字面量"; return false; }
        return parseNumber(out);
    }
    bool parseNumber(Value& out) {
        char* stop = nullptr;
        double v = strtod(p, &stop);
        if (stop == p) { error = "非法数字"; return false; }
        out.kind = Value::Kind::Number; out.number = v; p = stop;
        return true;
    }
    bool parseHex4(unsigned& cp) {
        cp = 0;
        for (int i = 0; i < 4; i++) {
            if (p >= end) { error = "\\u 转义不完整"; return false; }
            char c = *p++;
            cp <<= 4;
            if (c >= '0' && c <= '9') cp |= unsigned(c - '0');
            else if (c >= 'a' && c <= 'f') cp |= unsigned(c - 'a' + 10);
            else if (c >= 'A' && c <= 'F') cp |= unsigned(c - 'A' + 10);
            else { error = "\\u 转义含非十六进制字符"; return false; }
        }
        return true;
    }
    void pushUtf8(std::string& out, unsigned cp) {
        if (cp < 0x80) out.push_back(char(cp));
        else if (cp < 0x800) { out.push_back(char(0xC0 | (cp >> 6))); out.push_back(char(0x80 | (cp & 0x3F))); }
        else if (cp < 0x10000) { out.push_back(char(0xE0 | (cp >> 12))); out.push_back(char(0x80 | ((cp >> 6) & 0x3F))); out.push_back(char(0x80 | (cp & 0x3F))); }
        else { out.push_back(char(0xF0 | (cp >> 18))); out.push_back(char(0x80 | ((cp >> 12) & 0x3F))); out.push_back(char(0x80 | ((cp >> 6) & 0x3F))); out.push_back(char(0x80 | (cp & 0x3F))); }
    }
    bool parseString(std::string& out) {
        out.clear();
        if (p >= end || *p != '"') { error = "期待字符串"; return false; }
        p++;
        while (p < end) {
            unsigned char c = static_cast<unsigned char>(*p);
            if (c == '"') { p++; return true; }
            if (c == '\\') {
                p++;
                if (p >= end) break;
                char e = *p++;
                switch (e) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    case 'u': {
                        unsigned cp = 0;
                        if (!parseHex4(cp)) return false;
                        if (cp >= 0xD800 && cp <= 0xDBFF && end - p >= 6 && p[0] == '\\' && p[1] == 'u') {
                            p += 2;
                            unsigned lo = 0;
                            if (!parseHex4(lo)) return false;
                            if (lo >= 0xDC00 && lo <= 0xDFFF) cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                        }
                        pushUtf8(out, cp);
                        break;
                    }
                    default: error = "非法转义字符"; return false;
                }
            } else {
                out.push_back(char(c));
                p++;
            }
        }
        error = "字符串未闭合";
        return false;
    }
    bool parseObject(Value& out) {
        p++; // {
        out.kind = Value::Kind::Object;
        skipWs();
        if (p < end && *p == '}') { p++; return true; }
        while (p < end) {
            skipWs();
            std::string key;
            if (!parseString(key)) return false;
            skipWs();
            if (p >= end || *p != ':') { error = "期待冒号"; return false; }
            p++;
            Value child;
            if (!parseValue(child)) return false;
            out.members.emplace_back(std::move(key), std::move(child));
            skipWs();
            if (p < end && *p == ',') { p++; continue; }
            if (p < end && *p == '}') { p++; return true; }
            error = "对象成员后期待逗号或右花括号";
            return false;
        }
        error = "对象未闭合";
        return false;
    }
    bool parseArray(Value& out) {
        p++; // [
        out.kind = Value::Kind::Array;
        skipWs();
        if (p < end && *p == ']') { p++; return true; }
        while (p < end) {
            Value child;
            if (!parseValue(child)) return false;
            out.items.push_back(std::move(child));
            skipWs();
            if (p < end && *p == ',') { p++; continue; }
            if (p < end && *p == ']') { p++; return true; }
            error = "数组元素后期待逗号或右方括号";
            return false;
        }
        error = "数组未闭合";
        return false;
    }
};

inline bool parse(const std::string& input, Value& out, std::string& error) {
    Parser parser;
    if (!parser.parse(input, out)) { error = parser.error; return false; }
    return true;
}

inline void escapeTo(const std::string& text, std::string& out) {
    for (unsigned char c : text) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) { char buf[8]; snprintf(buf, sizeof buf, "\\u%04X", c); out += buf; }
                else out.push_back(char(c));
        }
    }
}

} // namespace lbjson

#endif // LB_MINIJSON_H
