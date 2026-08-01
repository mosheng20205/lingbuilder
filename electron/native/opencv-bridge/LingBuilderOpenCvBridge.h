#pragma once

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#  if defined(LINGBUILDER_OPENCV_BRIDGE_EXPORTS)
#    define LB_OCV_API __declspec(dllexport)
#  else
#    define LB_OCV_API __declspec(dllimport)
#  endif
#  define LB_OCV_CALL __cdecl
#else
#  define LB_OCV_API
#  define LB_OCV_CALL
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef int64_t LB_OCV_HANDLE;

LB_OCV_API int LB_OCV_CALL LB_OCV_GetVersion(wchar_t* buffer, int capacity);
LB_OCV_API int LB_OCV_CALL LB_OCV_GetLastError(wchar_t* buffer, int capacity);

LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_LoadImage(const wchar_t* path, const wchar_t* mode);
LB_OCV_API int LB_OCV_CALL LB_OCV_SaveImage(LB_OCV_HANDLE image, const wchar_t* path, int quality);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_CloneImage(LB_OCV_HANDLE image);
LB_OCV_API int LB_OCV_CALL LB_OCV_ReleaseImage(LB_OCV_HANDLE image);
LB_OCV_API void LB_OCV_CALL LB_OCV_ReleaseAll(void);
LB_OCV_API int LB_OCV_CALL LB_OCV_GetWidth(LB_OCV_HANDLE image);
LB_OCV_API int LB_OCV_CALL LB_OCV_GetHeight(LB_OCV_HANDLE image);
LB_OCV_API int LB_OCV_CALL LB_OCV_GetChannels(LB_OCV_HANDLE image);

LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_ToGray(LB_OCV_HANDLE image);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Resize(LB_OCV_HANDLE image, int width, int height);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Crop(LB_OCV_HANDLE image, int x, int y, int width, int height);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_GaussianBlur(LB_OCV_HANDLE image, int kernel, double sigma);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Threshold(LB_OCV_HANDLE image, double threshold, const wchar_t* mode);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_AdaptiveThreshold(LB_OCV_HANDLE image, int block_size, double constant_value, int inverse);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Canny(LB_OCV_HANDLE image, double low_threshold, double high_threshold);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_Morphology(LB_OCV_HANDLE image, const wchar_t* operation, int kernel, int iterations);

LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_TemplateMatch(LB_OCV_HANDLE image, LB_OCV_HANDLE pattern, const wchar_t* method, double minimum_score, int maximum_results);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_FindContours(LB_OCV_HANDLE image, double minimum_area, double maximum_area, int maximum_results);
LB_OCV_API LB_OCV_HANDLE LB_OCV_CALL LB_OCV_AnalyzeGap(LB_OCV_HANDLE background, LB_OCV_HANDLE piece, int candidate_count, const wchar_t* config_json);

LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetType(LB_OCV_HANDLE result, wchar_t* buffer, int capacity);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetCount(LB_OCV_HANDLE result);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetX(LB_OCV_HANDLE result, int index);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetY(LB_OCV_HANDLE result, int index);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetWidth(LB_OCV_HANDLE result, int index);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetHeight(LB_OCV_HANDLE result, int index);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetCenterX(LB_OCV_HANDLE result, int index);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetCenterY(LB_OCV_HANDLE result, int index);
LB_OCV_API double LB_OCV_CALL LB_OCV_ResultGetScore(LB_OCV_HANDLE result, int index);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultGetJson(LB_OCV_HANDLE result, wchar_t* buffer, int capacity);
LB_OCV_API int LB_OCV_CALL LB_OCV_ResultSaveAnnotated(LB_OCV_HANDLE result, const wchar_t* path, int quality);
LB_OCV_API int LB_OCV_CALL LB_OCV_ReleaseResult(LB_OCV_HANDLE result);

#ifdef __cplusplus
}
#endif

