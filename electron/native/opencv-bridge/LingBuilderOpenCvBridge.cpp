#include "LingBuilderOpenCvBridge.h"

#include <windows.h>
#include <opencv2/core.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <iomanip>
#include <limits>
#include <memory>
#include <mutex>
#include <set>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

constexpr size_t kMaximumObjects = 256;
constexpr int64_t kMaximumPixels = 100LL * 1000LL * 1000LL;
constexpr size_t kMaximumConfigCharacters = 16 * 1024;
constexpr int kMaximumCandidates = 100;
constexpr int64_t kMaximumEncodedBytes = 512LL * 1024LL * 1024LL;
constexpr uint64_t kImageKind = 1;
constexpr uint64_t kResultKind = 2;

thread_local std::wstring g_last_error;
std::mutex g_registry_mutex;
std::unordered_map<LB_OCV_HANDLE, std::shared_ptr<cv::Mat>> g_images;
std::atomic<uint64_t> g_next_handle{1};

struct Candidate {
  cv::Rect bounds;
  double score = 0.0;
};

struct AnalysisResult {
  std::wstring type;
  cv::Mat annotated_base;
  std::vector<Candidate> candidates;
  int image_width = 0;
  int image_height = 0;
};

std::unordered_map<LB_OCV_HANDLE, std::shared_ptr<AnalysisResult>> g_results;

struct GapConfig {
  std::string mode = "auto";
  int roi_x = 0;
  int roi_y = 0;
  int roi_width = 0;
  int roi_height = 0;
  int blur_kernel = 5;
  double canny_low = 50.0;
  double canny_high = 150.0;
  int morph_kernel = 3;
  int min_width = 10;
  int min_height = 10;
  int max_width = 0;
  int max_height = 0;
  double min_score = 0.45;
  int min_separation = 20;
  double nms_iou = 0.3;
};

void ClearError() { g_last_error.clear(); }
void SetError(const std::wstring& message) { g_last_error = message; }

std::wstring Utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) return L"UTF-8 文本转换失败。";
  std::wstring output(static_cast<size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), length);
  return output;
}

std::string WideToUtf8(const wchar_t* value) {
  if (!value || !value[0]) return {};
  const int source_length = static_cast<int>(wcslen(value));
  const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, source_length, nullptr, 0, nullptr, nullptr);
  if (length <= 0) return {};
  std::string output(static_cast<size_t>(length), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, source_length, output.data(), length, nullptr, nullptr);
  return output;
}

int CopyText(const std::wstring& value, wchar_t* buffer, int capacity) {
  const int required = static_cast<int>((std::min)(value.size(), static_cast<size_t>((std::numeric_limits<int>::max)() - 1)));
  if (!buffer || capacity <= 0) return required;
  const int copied = (std::min)(required, capacity - 1);
  if (copied > 0) wmemcpy(buffer, value.data(), static_cast<size_t>(copied));
  buffer[copied] = L'\0';
  return required;
}

bool ReadFileBytes(const wchar_t* path, std::vector<unsigned char>& bytes) {
  if (!path || !path[0]) { SetError(L"图像路径不能为空。"); return false; }
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) { SetError(L"无法打开图像文件，Windows 错误码：" + std::to_wstring(GetLastError())); return false; }
  LARGE_INTEGER size = {};
  if (!GetFileSizeEx(file, &size) || size.QuadPart <= 0 || size.QuadPart > kMaximumEncodedBytes) {
    CloseHandle(file); SetError(L"图像文件为空或超过 512MB 限制。"); return false;
  }
  bytes.resize(static_cast<size_t>(size.QuadPart));
  size_t offset = 0;
  while (offset < bytes.size()) {
    const DWORD chunk = static_cast<DWORD>((std::min)(bytes.size() - offset, static_cast<size_t>(16 * 1024 * 1024)));
    DWORD read = 0;
    if (!ReadFile(file, bytes.data() + offset, chunk, &read, nullptr) || read == 0) {
      CloseHandle(file); SetError(L"读取图像文件失败，Windows 错误码：" + std::to_wstring(GetLastError())); return false;
    }
    offset += read;
  }
  CloseHandle(file);
  return true;
}

bool WriteFileBytes(const wchar_t* path, const std::vector<unsigned char>& bytes) {
  if (!path || !path[0]) { SetError(L"输出路径不能为空。"); return false; }
  HANDLE file = CreateFileW(path, GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) { SetError(L"无法创建输出文件，Windows 错误码：" + std::to_wstring(GetLastError())); return false; }
  size_t offset = 0;
  while (offset < bytes.size()) {
    const DWORD chunk = static_cast<DWORD>((std::min)(bytes.size() - offset, static_cast<size_t>(16 * 1024 * 1024)));
    DWORD written = 0;
    if (!WriteFile(file, bytes.data() + offset, chunk, &written, nullptr) || written == 0) {
      CloseHandle(file); SetError(L"写入图像文件失败，Windows 错误码：" + std::to_wstring(GetLastError())); return false;
    }
    offset += written;
  }
  CloseHandle(file);
  return true;
}

std::wstring Lower(std::wstring value) {
  std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towlower(ch)); });
  return value;
}

std::wstring ExtensionOf(const wchar_t* path) {
  std::wstring value = path ? path : L"";
  const size_t slash = value.find_last_of(L"\\/");
  const size_t dot = value.find_last_of(L'.');
  if (dot == std::wstring::npos || (slash != std::wstring::npos && dot < slash)) return L".png";
  return Lower(value.substr(dot));
}

bool ValidateImage(const cv::Mat& image) {
  if (image.empty()) { SetError(L"图像为空。"); return false; }
  if (static_cast<int64_t>(image.cols) * static_cast<int64_t>(image.rows) > kMaximumPixels) {
    SetError(L"图像超过 100MP 限制。"); return false;
  }
  return true;
}

LB_OCV_HANDLE NewHandle(uint64_t kind) {
  const uint64_t sequence = g_next_handle.fetch_add(1, std::memory_order_relaxed);
  return static_cast<LB_OCV_HANDLE>((sequence << 3) | kind);
}

LB_OCV_HANDLE AddImage(cv::Mat image) {
  if (!ValidateImage(image)) return 0;
  std::lock_guard<std::mutex> lock(g_registry_mutex);
  if (g_images.size() + g_results.size() >= kMaximumObjects) { SetError(L"OpenCV 受管对象已达到 256 个上限，请释放不再使用的句柄。"); return 0; }
  const LB_OCV_HANDLE handle = NewHandle(kImageKind);
  g_images.emplace(handle, std::make_shared<cv::Mat>(std::move(image)));
  return handle;
}

LB_OCV_HANDLE AddResult(std::shared_ptr<AnalysisResult> result) {
  std::lock_guard<std::mutex> lock(g_registry_mutex);
  if (g_images.size() + g_results.size() >= kMaximumObjects) { SetError(L"OpenCV 受管对象已达到 256 个上限，请释放不再使用的句柄。"); return 0; }
  const LB_OCV_HANDLE handle = NewHandle(kResultKind);
  g_results.emplace(handle, std::move(result));
  return handle;
}

std::shared_ptr<cv::Mat> GetImage(LB_OCV_HANDLE handle) {
  if ((static_cast<uint64_t>(handle) & 7ULL) != kImageKind) { SetError(L"无效的 OpenCV 图像句柄。"); return {}; }
  std::lock_guard<std::mutex> lock(g_registry_mutex);
  const auto found = g_images.find(handle);
  if (found == g_images.end()) { SetError(L"OpenCV 图像句柄不存在或已经释放。"); return {}; }
  return found->second;
}

std::shared_ptr<AnalysisResult> GetResult(LB_OCV_HANDLE handle) {
  if ((static_cast<uint64_t>(handle) & 7ULL) != kResultKind) { SetError(L"无效的 OpenCV 结果句柄。"); return {}; }
  std::lock_guard<std::mutex> lock(g_registry_mutex);
  const auto found = g_results.find(handle);
  if (found == g_results.end()) { SetError(L"OpenCV 结果句柄不存在或已经释放。"); return {}; }
  return found->second;
}

bool GetCandidate(LB_OCV_HANDLE handle, int index, Candidate& candidate) {
  const auto result = GetResult(handle);
  if (!result) return false;
  if (index < 0 || static_cast<size_t>(index) >= result->candidates.size()) { SetError(L"OpenCV 结果候选索引超出范围。"); return false; }
  candidate = result->candidates[static_cast<size_t>(index)];
  return true;
}

cv::Mat ToGray(const cv::Mat& source) {
  if (source.channels() == 1) return source.clone();
  cv::Mat gray;
  if (source.channels() == 4) cv::cvtColor(source, gray, cv::COLOR_BGRA2GRAY);
  else cv::cvtColor(source, gray, cv::COLOR_BGR2GRAY);
  return gray;
}

cv::Mat ToColor(const cv::Mat& source) {
  if (source.channels() == 3) return source.clone();
  cv::Mat color;
  if (source.channels() == 4) cv::cvtColor(source, color, cv::COLOR_BGRA2BGR);
  else cv::cvtColor(source, color, cv::COLOR_GRAY2BGR);
  return color;
}

std::vector<int> EncodeParameters(const std::wstring& extension, int quality) {
  quality = (std::max)(0, (std::min)(quality, 100));
  if (extension == L".jpg" || extension == L".jpeg") return { cv::IMWRITE_JPEG_QUALITY, quality };
  if (extension == L".png") return { cv::IMWRITE_PNG_COMPRESSION, (std::max)(0, (std::min)(9, (100 - quality + 10) / 11)) };
  if (extension == L".webp") return { cv::IMWRITE_WEBP_QUALITY, quality };
  return {};
}

bool SaveMat(const cv::Mat& image, const wchar_t* path, int quality) {
  if (!ValidateImage(image)) return false;
  const std::wstring extension = ExtensionOf(path);
  const std::string utf8_extension = WideToUtf8(extension.c_str());
  std::vector<unsigned char> bytes;
  if (!cv::imencode(utf8_extension.empty() ? ".png" : utf8_extension, image, bytes, EncodeParameters(extension, quality))) {
    SetError(L"OpenCV 图像编码失败。"); return false;
  }
  return WriteFileBytes(path, bytes);
}

double IntersectionOverUnion(const cv::Rect& first, const cv::Rect& second) {
  const cv::Rect intersection = first & second;
  if (intersection.empty()) return 0.0;
  const double union_area = static_cast<double>(first.area()) + second.area() - intersection.area();
  return union_area > 0.0 ? intersection.area() / union_area : 0.0;
}

std::vector<Candidate> SuppressCandidates(std::vector<Candidate> candidates, int maximum, double iou, int separation) {
  std::stable_sort(candidates.begin(), candidates.end(), [](const Candidate& left, const Candidate& right) {
    if (std::abs(left.score - right.score) > 1e-9) return left.score > right.score;
    if (left.bounds.x != right.bounds.x) return left.bounds.x < right.bounds.x;
    return left.bounds.y < right.bounds.y;
  });
  std::vector<Candidate> selected;
  for (const auto& candidate : candidates) {
    bool suppressed = false;
    for (const auto& existing : selected) {
      const int dx = candidate.bounds.x + candidate.bounds.width / 2 - (existing.bounds.x + existing.bounds.width / 2);
      const int dy = candidate.bounds.y + candidate.bounds.height / 2 - (existing.bounds.y + existing.bounds.height / 2);
      const double distance = std::sqrt(static_cast<double>(dx * dx + dy * dy));
      if (IntersectionOverUnion(candidate.bounds, existing.bounds) > iou || distance < separation) { suppressed = true; break; }
    }
    if (!suppressed) selected.push_back(candidate);
    if (static_cast<int>(selected.size()) >= maximum) break;
  }
  return selected;
}

std::wstring EscapeJson(const std::wstring& value) {
  std::wostringstream output;
  for (wchar_t ch : value) {
    switch (ch) {
      case L'\\': output << L"\\\\"; break;
      case L'\"': output << L"\\\""; break;
      case L'\n': output << L"\\n"; break;
      case L'\r': output << L"\\r"; break;
      case L'\t': output << L"\\t"; break;
      default: output << ch; break;
    }
  }
  return output.str();
}

std::wstring ResultJson(const AnalysisResult& result) {
  std::wostringstream output;
  output << L"{\"schemaVersion\":1,\"ok\":true,\"type\":\"" << EscapeJson(result.type)
         << L"\",\"imageWidth\":" << result.image_width << L",\"imageHeight\":" << result.image_height << L",\"candidates\":[";
  output << std::fixed << std::setprecision(6);
  for (size_t index = 0; index < result.candidates.size(); ++index) {
    if (index) output << L',';
    const auto& item = result.candidates[index];
    output << L"{\"x\":" << item.bounds.x << L",\"y\":" << item.bounds.y
           << L",\"width\":" << item.bounds.width << L",\"height\":" << item.bounds.height
           << L",\"centerX\":" << item.bounds.x + item.bounds.width / 2
           << L",\"centerY\":" << item.bounds.y + item.bounds.height / 2
           << L",\"score\":" << item.score << L'}';
  }
  output << L"]}";
  return output.str();
}

void DrawCandidates(cv::Mat& image, const std::vector<Candidate>& candidates) {
  for (size_t index = 0; index < candidates.size(); ++index) {
    const auto& item = candidates[index];
    const cv::Scalar color = index == 0 ? cv::Scalar(40, 220, 40) : cv::Scalar(40, 160, 255);
    cv::rectangle(image, item.bounds, color, 2, cv::LINE_AA);
    std::ostringstream label;
    label << (index + 1) << ":" << std::fixed << std::setprecision(3) << item.score;
    cv::putText(image, label.str(), cv::Point(item.bounds.x, (std::max)(15, item.bounds.y - 4)), cv::FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv::LINE_AA);
  }
}

std::shared_ptr<AnalysisResult> MakeResult(const wchar_t* type, const cv::Mat& base, std::vector<Candidate> candidates) {
  auto result = std::make_shared<AnalysisResult>();
  result->type = type;
  result->image_width = base.cols;
  result->image_height = base.rows;
  result->annotated_base = ToColor(base);
  result->candidates = std::move(candidates);
  DrawCandidates(result->annotated_base, result->candidates);
  return result;
}

int ReadInteger(const cv::FileNode& root, const char* key, int fallback) {
  const cv::FileNode node = root[key];
  return node.empty() ? fallback : static_cast<int>(node);
}

double ReadDouble(const cv::FileNode& root, const char* key, double fallback) {
  const cv::FileNode node = root[key];
  return node.empty() ? fallback : static_cast<double>(node);
}

bool ParseGapConfig(const wchar_t* config_json, GapConfig& config) {
  const size_t length = config_json ? wcslen(config_json) : 0;
  if (length > kMaximumConfigCharacters) { SetError(L"OpenCV 缺口配置超过 16KB 限制。"); return false; }
  if (length == 0) return true;
  const std::string json = WideToUtf8(config_json);
  if (json.empty() && length > 0) { SetError(L"OpenCV 缺口配置不是有效 UTF-16 文本。"); return false; }
  cv::FileStorage storage;
  try {
    if (!storage.open(json, cv::FileStorage::READ | cv::FileStorage::MEMORY | cv::FileStorage::FORMAT_JSON)) {
      SetError(L"OpenCV 缺口配置不是有效 JSON。"); return false;
    }
    const cv::FileNode root = storage.root();
    if (!root.isMap()) { SetError(L"OpenCV 缺口配置根节点必须是 JSON 对象。"); return false; }
    const std::set<std::string> allowed = {"mode", "roiX", "roiY", "roiWidth", "roiHeight", "blurKernel", "cannyLow", "cannyHigh", "morphKernel", "minWidth", "minHeight", "maxWidth", "maxHeight", "minScore", "minSeparation", "nmsIou"};
    for (auto iterator = root.begin(); iterator != root.end(); ++iterator) {
      if (!allowed.count((*iterator).name())) { SetError(L"OpenCV 缺口配置包含未知字段：" + Utf8ToWide((*iterator).name())); return false; }
    }
    const cv::FileNode mode = root["mode"];
    if (!mode.empty()) {
      if (!mode.isString()) { SetError(L"OpenCV 缺口配置字段 mode 必须是文本。"); return false; }
      mode >> config.mode;
    }
    const std::set<std::string> integer_fields = {"roiX", "roiY", "roiWidth", "roiHeight", "blurKernel", "morphKernel", "minWidth", "minHeight", "maxWidth", "maxHeight", "minSeparation"};
    const std::set<std::string> number_fields = {"cannyLow", "cannyHigh", "minScore", "nmsIou"};
    for (const auto& field : integer_fields) {
      const cv::FileNode node = root[field];
      if (!node.empty() && !node.isInt()) { SetError(L"OpenCV 缺口配置字段 " + Utf8ToWide(field) + L" 必须是整数。"); return false; }
    }
    for (const auto& field : number_fields) {
      const cv::FileNode node = root[field];
      if (!node.empty() && !node.isInt() && !node.isReal()) { SetError(L"OpenCV 缺口配置字段 " + Utf8ToWide(field) + L" 必须是数值。"); return false; }
    }
    config.roi_x = ReadInteger(root, "roiX", config.roi_x);
    config.roi_y = ReadInteger(root, "roiY", config.roi_y);
    config.roi_width = ReadInteger(root, "roiWidth", config.roi_width);
    config.roi_height = ReadInteger(root, "roiHeight", config.roi_height);
    config.blur_kernel = ReadInteger(root, "blurKernel", config.blur_kernel);
    config.canny_low = ReadDouble(root, "cannyLow", config.canny_low);
    config.canny_high = ReadDouble(root, "cannyHigh", config.canny_high);
    config.morph_kernel = ReadInteger(root, "morphKernel", config.morph_kernel);
    config.min_width = ReadInteger(root, "minWidth", config.min_width);
    config.min_height = ReadInteger(root, "minHeight", config.min_height);
    config.max_width = ReadInteger(root, "maxWidth", config.max_width);
    config.max_height = ReadInteger(root, "maxHeight", config.max_height);
    config.min_score = ReadDouble(root, "minScore", config.min_score);
    config.min_separation = ReadInteger(root, "minSeparation", config.min_separation);
    config.nms_iou = ReadDouble(root, "nmsIou", config.nms_iou);
  } catch (const cv::Exception&) {
    SetError(L"OpenCV 缺口配置不是有效 JSON。"); return false;
  }
  if (config.mode != "auto" && config.mode != "template" && config.mode != "contour") { SetError(L"mode 只允许 auto、template 或 contour。"); return false; }
  if (config.roi_x < 0 || config.roi_y < 0 || config.roi_width < 0 || config.roi_height < 0) { SetError(L"ROI 坐标和尺寸不能为负数。"); return false; }
  if (config.blur_kernel < 1 || config.blur_kernel > 31 || config.blur_kernel % 2 == 0 || config.morph_kernel < 1 || config.morph_kernel > 31 || config.morph_kernel % 2 == 0) { SetError(L"模糊和形态学卷积核必须是 1～31 的正奇数。"); return false; }
  if (config.canny_low < 0 || config.canny_high <= config.canny_low) { SetError(L"Canny 高阈值必须大于低阈值，且阈值不能为负数。"); return false; }
  if (config.min_width < 1 || config.min_height < 1 || config.max_width < 0 || config.max_height < 0 || (config.max_width && config.max_width < config.min_width) || (config.max_height && config.max_height < config.min_height)) { SetError(L"缺口候选宽高范围无效。"); return false; }
  if (config.min_score < 0 || config.min_score > 1 || config.min_separation < 0 || config.nms_iou < 0 || config.nms_iou > 1) { SetError(L"缺口置信度、候选间距或 NMS 参数无效。"); return false; }
  return true;
}

cv::Rect ResolveRoi(const cv::Mat& image, const GapConfig& config) {
  if (config.roi_x > image.cols || config.roi_y > image.rows) return {};
  const int width = config.roi_width == 0 ? image.cols - config.roi_x : config.roi_width;
  const int height = config.roi_height == 0 ? image.rows - config.roi_y : config.roi_height;
  const cv::Rect roi(config.roi_x, config.roi_y, width, height);
  if (roi.x < 0 || roi.y < 0 || roi.width <= 0 || roi.height <= 0
      || static_cast<int64_t>(roi.x) + roi.width > image.cols
      || static_cast<int64_t>(roi.y) + roi.height > image.rows) return {};
  return roi;
}

std::vector<Candidate> BlendGapCandidates(std::vector<Candidate> templates, const std::vector<Candidate>& contours) {
  for (auto& candidate : templates) {
    double best_contour_score = 0.0;
    for (const auto& contour : contours) {
      const double overlap = IntersectionOverUnion(candidate.bounds, contour.bounds);
      const int template_center_x = candidate.bounds.x + candidate.bounds.width / 2;
      const int template_center_y = candidate.bounds.y + candidate.bounds.height / 2;
      const int contour_center_x = contour.bounds.x + contour.bounds.width / 2;
      const int contour_center_y = contour.bounds.y + contour.bounds.height / 2;
      const bool centers_overlap = std::abs(template_center_x - contour_center_x) <= (std::max)(candidate.bounds.width, contour.bounds.width) / 2
        && std::abs(template_center_y - contour_center_y) <= (std::max)(candidate.bounds.height, contour.bounds.height) / 2;
      if (overlap > 0.05 || centers_overlap) best_contour_score = (std::max)(best_contour_score, contour.score);
    }
    candidate.score = (std::min)(1.0, candidate.score * 0.8 + best_contour_score * 0.2);
  }
  for (const auto& contour : contours) {
    const bool represented = std::any_of(templates.begin(), templates.end(), [&](const Candidate& candidate) {
      return IntersectionOverUnion(candidate.bounds, contour.bounds) > 0.1;
    });
    if (!represented) templates.push_back({contour.bounds, contour.score * 0.65});
  }
  return templates;
}

std::vector<Candidate> ContourCandidates(const cv::Mat& background, const GapConfig& config, const cv::Rect& roi) {
  cv::Mat gray = ToGray(background(roi));
  if (config.blur_kernel > 1) cv::GaussianBlur(gray, gray, cv::Size(config.blur_kernel, config.blur_kernel), 0.0);
  cv::Mat edges;
  cv::Canny(gray, edges, config.canny_low, config.canny_high);
  if (config.morph_kernel > 1) {
    const cv::Mat kernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(config.morph_kernel, config.morph_kernel));
    cv::morphologyEx(edges, edges, cv::MORPH_CLOSE, kernel);
  }
  std::vector<std::vector<cv::Point>> contours;
  cv::findContours(edges, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);
  std::vector<Candidate> candidates;
  for (const auto& contour : contours) {
    cv::Rect bounds = cv::boundingRect(contour);
    if (bounds.width < config.min_width || bounds.height < config.min_height) continue;
    if (config.max_width && bounds.width > config.max_width) continue;
    if (config.max_height && bounds.height > config.max_height) continue;
    const double perimeter = cv::arcLength(contour, true);
    const double compactness = perimeter > 0.0 ? (4.0 * CV_PI * std::abs(cv::contourArea(contour))) / (perimeter * perimeter) : 0.0;
    const double density = bounds.area() > 0 ? (std::min)(1.0, std::abs(cv::contourArea(contour)) / bounds.area()) : 0.0;
    const double score = (std::min)(1.0, 0.35 + density * 0.4 + compactness * 0.25);
    if (score < config.min_score) continue;
    bounds.x += roi.x; bounds.y += roi.y;
    candidates.push_back({bounds, score});
  }
  return candidates;
}

std::vector<Candidate> TemplateCandidates(const cv::Mat& background, const cv::Mat& piece, const GapConfig& config, const cv::Rect& roi, int maximum) {
  cv::Mat background_edges, piece_edges;
  cv::Mat background_gray = ToGray(background(roi));
  cv::Mat piece_gray = ToGray(piece);
  if (config.blur_kernel > 1) { cv::GaussianBlur(background_gray, background_gray, cv::Size(config.blur_kernel, config.blur_kernel), 0.0); cv::GaussianBlur(piece_gray, piece_gray, cv::Size(config.blur_kernel, config.blur_kernel), 0.0); }
  cv::Canny(background_gray, background_edges, config.canny_low, config.canny_high);
  cv::Canny(piece_gray, piece_edges, config.canny_low, config.canny_high);
  if (piece_edges.cols > background_edges.cols || piece_edges.rows > background_edges.rows) { SetError(L"滑块图像尺寸大于检测区域。"); return {}; }
  cv::Mat scores;
  cv::matchTemplate(background_edges, piece_edges, scores, cv::TM_CCOEFF_NORMED);
  std::vector<Candidate> candidates;
  for (int index = 0; index < maximum * 8 && !scores.empty(); ++index) {
    double minimum = 0.0, maximum_score = 0.0;
    cv::Point minimum_location, maximum_location;
    cv::minMaxLoc(scores, &minimum, &maximum_score, &minimum_location, &maximum_location);
    if (!std::isfinite(maximum_score) || maximum_score < config.min_score) break;
    candidates.push_back({cv::Rect(maximum_location.x + roi.x, maximum_location.y + roi.y, piece.cols, piece.rows), (std::max)(0.0, (std::min)(1.0, maximum_score))});
    const int radius_x = (std::max)(config.min_separation, piece.cols / 2);
    const int radius_y = (std::max)(config.min_separation, piece.rows / 2);
    const cv::Rect suppress((std::max)(0, maximum_location.x - radius_x), (std::max)(0, maximum_location.y - radius_y), 0, 0);
    const int right = (std::min)(scores.cols, maximum_location.x + radius_x + 1);
    const int bottom = (std::min)(scores.rows, maximum_location.y + radius_y + 1);
    scores(cv::Rect(suppress.x, suppress.y, right - suppress.x, bottom - suppress.y)).setTo(-1.0f);
  }
  return candidates;
}

template <typename Callable, typename Fallback>
auto Guard(Callable&& callable, Fallback fallback) -> decltype(callable()) {
  ClearError();
  try { return callable(); }
  catch (const cv::Exception& error) { SetError(L"OpenCV 异常：" + Utf8ToWide(error.what())); }
  catch (const std::exception& error) { SetError(L"C++ 异常：" + Utf8ToWide(error.what())); }
  catch (...) { SetError(L"OpenCV Bridge 发生未知异常。"); }
  return fallback;
}

} // namespace

extern "C" {

int LB_OCV_CALL LB_OCV_GetVersion(wchar_t* buffer, int capacity) { ClearError(); return CopyText(L"OpenCV " + Utf8ToWide(CV_VERSION) + L" / LingBuilderOpenCvBridge ABI 1", buffer, capacity); }
int LB_OCV_CALL LB_OCV_GetLastError(wchar_t* buffer, int capacity) { return CopyText(g_last_error, buffer, capacity); }

LB_OCV_HANDLE LB_OCV_CALL LB_OCV_LoadImage(const wchar_t* path, const wchar_t* mode) {
  return Guard([&]() -> LB_OCV_HANDLE {
    std::vector<unsigned char> bytes; if (!ReadFileBytes(path, bytes)) return 0;
    const std::wstring value = mode ? mode : L"彩色";
    int flag = cv::IMREAD_COLOR;
    if (value == L"灰度") flag = cv::IMREAD_GRAYSCALE;
    else if (value == L"原样") flag = cv::IMREAD_UNCHANGED;
    else if (value != L"彩色") { SetError(L"读取模式只允许：彩色、灰度、原样。"); return 0; }
    cv::Mat image = cv::imdecode(bytes, flag);
    if (!ValidateImage(image)) return 0;
    return AddImage(std::move(image));
  }, static_cast<LB_OCV_HANDLE>(0));
}

int LB_OCV_CALL LB_OCV_SaveImage(LB_OCV_HANDLE image, const wchar_t* path, int quality) { return Guard([&]() { auto value = GetImage(image); return value && SaveMat(*value, path, quality) ? 1 : 0; }, 0); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_CloneImage(LB_OCV_HANDLE image) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); return value ? AddImage(value->clone()) : 0; }, static_cast<LB_OCV_HANDLE>(0)); }
int LB_OCV_CALL LB_OCV_ReleaseImage(LB_OCV_HANDLE image) { return Guard([&]() { std::lock_guard<std::mutex> lock(g_registry_mutex); return g_images.erase(image) == 1 ? 1 : (SetError(L"OpenCV 图像句柄不存在或已经释放。"), 0); }, 0); }
void LB_OCV_CALL LB_OCV_ReleaseAll(void) { ClearError(); std::lock_guard<std::mutex> lock(g_registry_mutex); g_images.clear(); g_results.clear(); }
int LB_OCV_CALL LB_OCV_GetWidth(LB_OCV_HANDLE image) { return Guard([&]() { auto value = GetImage(image); return value ? value->cols : 0; }, 0); }
int LB_OCV_CALL LB_OCV_GetHeight(LB_OCV_HANDLE image) { return Guard([&]() { auto value = GetImage(image); return value ? value->rows : 0; }, 0); }
int LB_OCV_CALL LB_OCV_GetChannels(LB_OCV_HANDLE image) { return Guard([&]() { auto value = GetImage(image); return value ? value->channels() : 0; }, 0); }

LB_OCV_HANDLE LB_OCV_CALL LB_OCV_ToGray(LB_OCV_HANDLE image) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); return value ? AddImage(ToGray(*value)) : 0; }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Resize(LB_OCV_HANDLE image, int width, int height) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; if (width <= 0 || height <= 0 || static_cast<int64_t>(width) * height > kMaximumPixels) { SetError(L"缩放目标尺寸无效或超过 100MP。"); return 0; } cv::Mat output; cv::resize(*value, output, cv::Size(width, height), 0, 0, width < value->cols || height < value->rows ? cv::INTER_AREA : cv::INTER_CUBIC); return AddImage(std::move(output)); }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Crop(LB_OCV_HANDLE image, int x, int y, int width, int height) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > value->cols || y + height > value->rows) { SetError(L"裁剪区域超出图像范围。"); return 0; } return AddImage((*value)(cv::Rect(x, y, width, height)).clone()); }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_GaussianBlur(LB_OCV_HANDLE image, int kernel, double sigma) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; if (kernel < 1 || kernel > 31 || kernel % 2 == 0 || sigma < 0) { SetError(L"高斯卷积核必须是 1～31 的正奇数，Sigma 不能为负数。"); return 0; } cv::Mat output; cv::GaussianBlur(*value, output, cv::Size(kernel, kernel), sigma); return AddImage(std::move(output)); }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Threshold(LB_OCV_HANDLE image, double threshold, const wchar_t* mode) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; cv::Mat gray = ToGray(*value), output; const std::wstring selected = mode ? mode : L"二值"; int type = cv::THRESH_BINARY; if (selected == L"反二值") type = cv::THRESH_BINARY_INV; else if (selected == L"大津") type = cv::THRESH_BINARY | cv::THRESH_OTSU; else if (selected == L"大津反向") type = cv::THRESH_BINARY_INV | cv::THRESH_OTSU; else if (selected != L"二值") { SetError(L"二值化模式只允许：二值、反二值、大津、大津反向。"); return 0; } cv::threshold(gray, output, threshold, 255.0, type); return AddImage(std::move(output)); }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_AdaptiveThreshold(LB_OCV_HANDLE image, int block_size, double constant_value, int inverse) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; if (block_size < 3 || block_size > 99 || block_size % 2 == 0) { SetError(L"自适应二值化块大小必须是 3～99 的正奇数。"); return 0; } cv::Mat output; cv::adaptiveThreshold(ToGray(*value), output, 255.0, cv::ADAPTIVE_THRESH_GAUSSIAN_C, inverse ? cv::THRESH_BINARY_INV : cv::THRESH_BINARY, block_size, constant_value); return AddImage(std::move(output)); }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Canny(LB_OCV_HANDLE image, double low_threshold, double high_threshold) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; if (low_threshold < 0 || high_threshold <= low_threshold) { SetError(L"Canny 高阈值必须大于低阈值。"); return 0; } cv::Mat output; cv::Canny(ToGray(*value), output, low_threshold, high_threshold); return AddImage(std::move(output)); }, static_cast<LB_OCV_HANDLE>(0)); }
LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Morphology(LB_OCV_HANDLE image, const wchar_t* operation, int kernel, int iterations) { return Guard([&]() -> LB_OCV_HANDLE { auto value = GetImage(image); if (!value) return 0; if (kernel < 1 || kernel > 31 || kernel % 2 == 0 || iterations < 1 || iterations > 100) { SetError(L"形态学卷积核必须是 1～31 的正奇数，次数必须为 1～100。"); return 0; } const std::wstring selected = operation ? operation : L"闭运算"; int code = cv::MORPH_CLOSE; if (selected == L"腐蚀") code = cv::MORPH_ERODE; else if (selected == L"膨胀") code = cv::MORPH_DILATE; else if (selected == L"开运算") code = cv::MORPH_OPEN; else if (selected == L"梯度") code = cv::MORPH_GRADIENT; else if (selected != L"闭运算") { SetError(L"形态学操作只允许：腐蚀、膨胀、开运算、闭运算、梯度。"); return 0; } cv::Mat output; cv::morphologyEx(*value, output, code, cv::getStructuringElement(cv::MORPH_RECT, cv::Size(kernel, kernel)), cv::Point(-1, -1), iterations); return AddImage(std::move(output)); }, static_cast<LB_OCV_HANDLE>(0)); }

LB_OCV_HANDLE LB_OCV_CALL LB_OCV_TemplateMatch(LB_OCV_HANDLE image, LB_OCV_HANDLE pattern, const wchar_t* method, double minimum_score, int maximum_results) {
  return Guard([&]() -> LB_OCV_HANDLE {
    auto source = GetImage(image), target = GetImage(pattern); if (!source || !target) return 0;
    if (target->cols > source->cols || target->rows > source->rows) { SetError(L"模板尺寸大于来源图像。"); return 0; }
    if (minimum_score < 0 || minimum_score > 1 || maximum_results < 1 || maximum_results > kMaximumCandidates) { SetError(L"模板匹配分数或结果数量无效。"); return 0; }
    const std::wstring selected = method ? method : L"相关系数";
    int code = cv::TM_CCOEFF_NORMED; bool lower_is_better = false;
    if (selected == L"平方差") { code = cv::TM_SQDIFF_NORMED; lower_is_better = true; }
    else if (selected == L"相关") code = cv::TM_CCORR_NORMED;
    else if (selected != L"相关系数") { SetError(L"模板匹配方法只允许：平方差、相关、相关系数。"); return 0; }
    cv::Mat source_gray = ToGray(*source), target_gray = ToGray(*target), scores;
    cv::matchTemplate(source_gray, target_gray, scores, code);
    std::vector<Candidate> candidates;
    for (int index = 0; index < maximum_results * 8; ++index) {
      double minimum = 0, maximum = 0; cv::Point minimum_location, maximum_location;
      cv::minMaxLoc(scores, &minimum, &maximum, &minimum_location, &maximum_location);
      const double score = lower_is_better ? 1.0 - minimum : maximum;
      const cv::Point location = lower_is_better ? minimum_location : maximum_location;
      if (!std::isfinite(score) || score < minimum_score) break;
      candidates.push_back({cv::Rect(location.x, location.y, target->cols, target->rows), (std::max)(0.0, (std::min)(1.0, score))});
      const cv::Rect area((std::max)(0, location.x - target->cols / 2), (std::max)(0, location.y - target->rows / 2), 0, 0);
      const int right = (std::min)(scores.cols, location.x + target->cols / 2 + 1), bottom = (std::min)(scores.rows, location.y + target->rows / 2 + 1);
      scores(cv::Rect(area.x, area.y, right - area.x, bottom - area.y)).setTo(lower_is_better ? 1.0f : -1.0f);
    }
    candidates = SuppressCandidates(std::move(candidates), maximum_results, 0.3, (std::max)(4, (std::min)(target->cols, target->rows) / 3));
    return AddResult(MakeResult(L"模板匹配", *source, std::move(candidates)));
  }, static_cast<LB_OCV_HANDLE>(0));
}

LB_OCV_HANDLE LB_OCV_CALL LB_OCV_FindContours(LB_OCV_HANDLE image, double minimum_area, double maximum_area, int maximum_results) {
  return Guard([&]() -> LB_OCV_HANDLE {
    auto source = GetImage(image); if (!source) return 0;
    if (minimum_area < 0 || maximum_area < 0 || (maximum_area > 0 && maximum_area < minimum_area) || maximum_results < 1 || maximum_results > kMaximumCandidates) { SetError(L"轮廓面积或结果数量无效。"); return 0; }
    cv::Mat gray = ToGray(*source), binary;
    cv::threshold(gray, binary, 0, 255, cv::THRESH_BINARY | cv::THRESH_OTSU);
    std::vector<std::vector<cv::Point>> contours; cv::findContours(binary, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);
    std::vector<Candidate> candidates;
    for (const auto& contour : contours) { const double area = std::abs(cv::contourArea(contour)); if (area < minimum_area || (maximum_area > 0 && area > maximum_area)) continue; const cv::Rect bounds = cv::boundingRect(contour); candidates.push_back({bounds, bounds.area() > 0 ? (std::min)(1.0, area / bounds.area()) : 0.0}); }
    candidates = SuppressCandidates(std::move(candidates), maximum_results, 0.3, 0);
    return AddResult(MakeResult(L"轮廓", *source, std::move(candidates)));
  }, static_cast<LB_OCV_HANDLE>(0));
}

LB_OCV_HANDLE LB_OCV_CALL LB_OCV_AnalyzeGap(LB_OCV_HANDLE background, LB_OCV_HANDLE piece, int candidate_count, const wchar_t* config_json) {
  return Guard([&]() -> LB_OCV_HANDLE {
    auto source = GetImage(background); if (!source) return 0;
    if (candidate_count < 1 || candidate_count > 8) { SetError(L"缺口候选数量必须为 1～8。"); return 0; }
    GapConfig config; if (!ParseGapConfig(config_json, config)) return 0;
    const cv::Rect roi = ResolveRoi(*source, config); if (roi.empty()) { SetError(L"缺口检测 ROI 超出背景图像范围。"); return 0; }
    std::vector<Candidate> candidates;
    const bool use_template = config.mode == "template" || (config.mode == "auto" && piece != 0);
    if (use_template) {
      auto pattern = GetImage(piece); if (!pattern) return 0;
      candidates = TemplateCandidates(*source, *pattern, config, roi, (std::min)(kMaximumCandidates, candidate_count * 4));
      if (!g_last_error.empty()) return 0;
      if (config.mode == "auto") candidates = BlendGapCandidates(std::move(candidates), ContourCandidates(*source, config, roi));
    } else {
      candidates = ContourCandidates(*source, config, roi);
    }
    candidates = SuppressCandidates(std::move(candidates), candidate_count, config.nms_iou, config.min_separation);
    return AddResult(MakeResult(L"缺口", *source, std::move(candidates)));
  }, static_cast<LB_OCV_HANDLE>(0));
}

int LB_OCV_CALL LB_OCV_ResultGetType(LB_OCV_HANDLE result, wchar_t* buffer, int capacity) { return Guard([&]() { auto value = GetResult(result); return value ? CopyText(value->type, buffer, capacity) : 0; }, 0); }
int LB_OCV_CALL LB_OCV_ResultGetCount(LB_OCV_HANDLE result) { return Guard([&]() { auto value = GetResult(result); return value ? static_cast<int>(value->candidates.size()) : -1; }, -1); }
int LB_OCV_CALL LB_OCV_ResultGetX(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.bounds.x : -1; }, -1); }
int LB_OCV_CALL LB_OCV_ResultGetY(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.bounds.y : -1; }, -1); }
int LB_OCV_CALL LB_OCV_ResultGetWidth(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.bounds.width : -1; }, -1); }
int LB_OCV_CALL LB_OCV_ResultGetHeight(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.bounds.height : -1; }, -1); }
int LB_OCV_CALL LB_OCV_ResultGetCenterX(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.bounds.x + value.bounds.width / 2 : -1; }, -1); }
int LB_OCV_CALL LB_OCV_ResultGetCenterY(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.bounds.y + value.bounds.height / 2 : -1; }, -1); }
double LB_OCV_CALL LB_OCV_ResultGetScore(LB_OCV_HANDLE result, int index) { return Guard([&]() { Candidate value; return GetCandidate(result, index, value) ? value.score : -1.0; }, -1.0); }
int LB_OCV_CALL LB_OCV_ResultGetJson(LB_OCV_HANDLE result, wchar_t* buffer, int capacity) { return Guard([&]() { auto value = GetResult(result); return value ? CopyText(ResultJson(*value), buffer, capacity) : 0; }, 0); }
int LB_OCV_CALL LB_OCV_ResultSaveAnnotated(LB_OCV_HANDLE result, const wchar_t* path, int quality) { return Guard([&]() { auto value = GetResult(result); return value && SaveMat(value->annotated_base, path, quality) ? 1 : 0; }, 0); }
int LB_OCV_CALL LB_OCV_ReleaseResult(LB_OCV_HANDLE result) { return Guard([&]() { std::lock_guard<std::mutex> lock(g_registry_mutex); return g_results.erase(result) == 1 ? 1 : (SetError(L"OpenCV 结果句柄不存在或已经释放。"), 0); }, 0); }

} // extern "C"
