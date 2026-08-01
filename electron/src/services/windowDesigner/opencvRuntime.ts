export const OPENCV_RUNTIME = String.raw`
#if defined(LINGBUILDER_OPENCV_MODULE)
#if !defined(_WIN64)
#error "LingBuilder OpenCV 模块仅支持 Windows MSVC x64，请切换到 x64 构建目标。"
#endif
#include "LingBuilderOpenCvBridge.h"

static const wchar_t* LB_OpenCvReadText(int (*reader)(wchar_t*, int)) {
    const int required = reader(nullptr, 0);
    if (required <= 0) return LB_ReturnText(L"");
    std::vector<wchar_t> buffer(static_cast<size_t>(required) + 1, L'\0');
    reader(buffer.data(), static_cast<int>(buffer.size()));
    return LB_ReturnText(std::wstring(buffer.data()));
}

static const wchar_t* LB_OpenCvReadResultText(long long handle, int (*reader)(long long, wchar_t*, int)) {
    const int required = reader(handle, nullptr, 0);
    if (required <= 0) return LB_ReturnText(L"");
    std::vector<wchar_t> buffer(static_cast<size_t>(required) + 1, L'\0');
    reader(handle, buffer.data(), static_cast<int>(buffer.size()));
    return LB_ReturnText(std::wstring(buffer.data()));
}

const wchar_t* OpenCV_取版本() { return LB_OpenCvReadText(LB_OCV_GetVersion); }
const wchar_t* OpenCV_取错误() { return LB_OpenCvReadText(LB_OCV_GetLastError); }
long long OpenCV_加载图像(const wchar_t* path, const wchar_t* mode) { return LB_OCV_LoadImage(path, mode); }
bool OpenCV_保存图像(long long image, const wchar_t* path, int quality) { return LB_OCV_SaveImage(image, path, quality) != 0; }
long long OpenCV_克隆图像(long long image) { return LB_OCV_CloneImage(image); }
bool OpenCV_释放图像(long long image) { return LB_OCV_ReleaseImage(image) != 0; }
void OpenCV_释放全部() { LB_OCV_ReleaseAll(); }
int OpenCV_取宽度(long long image) { return LB_OCV_GetWidth(image); }
int OpenCV_取高度(long long image) { return LB_OCV_GetHeight(image); }
int OpenCV_取通道数(long long image) { return LB_OCV_GetChannels(image); }
long long OpenCV_灰度化(long long image) { return LB_OCV_ToGray(image); }
long long OpenCV_缩放(long long image, int width, int height) { return LB_OCV_Resize(image, width, height); }
long long OpenCV_裁剪(long long image, int x, int y, int width, int height) { return LB_OCV_Crop(image, x, y, width, height); }
long long OpenCV_高斯模糊(long long image, int kernel, double sigma) { return LB_OCV_GaussianBlur(image, kernel, sigma); }
long long OpenCV_二值化(long long image, double threshold, const wchar_t* mode) { return LB_OCV_Threshold(image, threshold, mode); }
long long OpenCV_自适应二值化(long long image, int blockSize, double constantValue, bool inverse) { return LB_OCV_AdaptiveThreshold(image, blockSize, constantValue, inverse ? 1 : 0); }
long long OpenCV_Canny边缘(long long image, double lowThreshold, double highThreshold) { return LB_OCV_Canny(image, lowThreshold, highThreshold); }
long long OpenCV_形态学(long long image, const wchar_t* operation, int kernel, int iterations) { return LB_OCV_Morphology(image, operation, kernel, iterations); }
long long OpenCV_模板匹配(long long image, long long pattern, const wchar_t* method, double minimumScore, int maximumResults) { return LB_OCV_TemplateMatch(image, pattern, method, minimumScore, maximumResults); }
long long OpenCV_查找轮廓(long long image, double minimumArea, double maximumArea, int maximumResults) { return LB_OCV_FindContours(image, minimumArea, maximumArea, maximumResults); }
long long OpenCV_分析缺口(long long background, long long piece, int candidateCount, const wchar_t* configJson) { return LB_OCV_AnalyzeGap(background, piece, candidateCount, configJson); }
const wchar_t* OpenCV结果_取类型(long long result) { return LB_OpenCvReadResultText(result, LB_OCV_ResultGetType); }
int OpenCV结果_取数量(long long result) { return LB_OCV_ResultGetCount(result); }
int OpenCV结果_取横坐标(long long result, int index) { return LB_OCV_ResultGetX(result, index); }
int OpenCV结果_取纵坐标(long long result, int index) { return LB_OCV_ResultGetY(result, index); }
int OpenCV结果_取宽度(long long result, int index) { return LB_OCV_ResultGetWidth(result, index); }
int OpenCV结果_取高度(long long result, int index) { return LB_OCV_ResultGetHeight(result, index); }
int OpenCV结果_取中心横坐标(long long result, int index) { return LB_OCV_ResultGetCenterX(result, index); }
int OpenCV结果_取中心纵坐标(long long result, int index) { return LB_OCV_ResultGetCenterY(result, index); }
double OpenCV结果_取置信度(long long result, int index) { return LB_OCV_ResultGetScore(result, index); }
const wchar_t* OpenCV结果_取JSON(long long result) { return LB_OpenCvReadResultText(result, LB_OCV_ResultGetJson); }
bool OpenCV结果_保存标注图(long long result, const wchar_t* path, int quality) { return LB_OCV_ResultSaveAnnotated(result, path, quality) != 0; }
bool OpenCV结果_释放(long long result) { return LB_OCV_ReleaseResult(result) != 0; }
#endif
`;

