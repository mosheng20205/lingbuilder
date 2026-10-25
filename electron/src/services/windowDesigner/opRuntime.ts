/**
 * OP 后台图色模块（lingbuilder.op）生成器注入运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/op/lb_op_runtime_core.cpp + op_c_api.h（上游 0.4.8.3 钉版）
 * 再生命令：npm run op:runtime（--check 模式供门禁）
 * 注入点：lingCppWin32Project.ts 中 generateOpRuntime(enabledModules)，
 * 模块启用时拼进生成的 C++ 工程（Win32 与 new_emoji 双后端一致）。
 * 运行库 op_c_api_x64.dll / op_c_api_x86.dll 由 materializeOpRuntime 按架构复制到 exe 同目录。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const OP_RUNTIME_MODULE_ID = 'lingbuilder.op';

export const OP_RUNTIME = String.raw`// ============================================================================
// lb_op_runtime_core.cpp — LingBuilder OP 后台图色模块核心（lingbuilder.op 1.0.0）
//
// 事实来源：随包内置运行库 op_c_api_x64.dll / op_c_api_x86.dll
//   （上游 WallBreaker2/op 0.4.8.3，MIT，SHA-256 基线见 third_party/op/NOTICE.md）。
// 经 LoadLibrary/GetProcAddress 懒加载（自包含 DLL，无导入库依赖），
// 函数指针 boilerplate 由 scripts/generate-op-runtime.ts 从
// native/op/op_c_api.h（钉版）解析生成，替换下方标记行注入。
//
// 红线：
//   * 生成器注入运行时，函数名即命令名（bindings.runtimeName = 后台_*），
//     函数签名必须与 opModules.ts 的 binding 参数一一对应，不得擅改。
//   * 本文件同时用于：1) 生成器注入（generate-op-runtime.ts 转 TS String.raw
//     拼进生成的 C++ 工程，Win32 与 new_emoji 双后端一致）；
//     2) 独立编译验收（scripts/smoke-op-native.ts 的探针直接 include）。
//   * 内容不得出现反引号与美元符号花括号序列（String.raw 注入安全）。
//   * 上游 FindPic 系列返回值是模板编号（首个=0，失败=-1）：后台_找图 已在
//     本层翻译为 真/假；后台_找图全部/编号 的字符串结果判空使用。
//   * 上游 OpGetLastError 返回 Win32 GetLastError 原始码，后台_取错误码 原样
//     透出，后台_取错误 返回本层中文错误（加载失败/句柄无效等）。
// ============================================================================

#ifndef LB_OP_RUNTIME_INCLUDED
#define LB_OP_RUNTIME_INCLUDED

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace lbop {

inline std::once_flag g_loadOnce;
inline bool g_ready = false;
inline std::wstring g_loadError;
inline thread_local std::wstring g_lastError;

inline void setError(const std::wstring& message) { g_lastError = message; }
inline void clearError() { g_lastError.clear(); }

namespace impl { inline bool loadAll(); }

inline bool ready();

// 句柄空检 + 运行库就绪二合一；每个包装函数的第一步。
inline bool prepare(long long handleValue, void*& handle) {
    if (!ready()) return false;
    if (handleValue == 0) {
        setError(L"OP句柄无效：请先用 后台_创建 创建句柄。");
        return false;
    }
    handle = reinterpret_cast<void*>(static_cast<intptr_t>(handleValue));
    return true;
}

inline std::wstring toW(const wchar_t* text) { return text ? std::wstring(text) : std::wstring(); }

// ============================================================================
// 以下互操作层（函数指针 typedef + 指针表 + 加载器）由 scripts/generate-op-runtime.ts
// 从 native/op/op_c_api.h（上游 0.4.8.3 钉版）自动生成，禁止手改。
// 升级上游版本必须重跑 M0/M3 全套回归并同步 third_party/op/NOTICE.md 基线。
// ============================================================================

typedef void* (__stdcall *fn_OpCreate)();
typedef void (__stdcall *fn_OpDestroy)(void* handle);
typedef const wchar_t* (__stdcall *fn_OpVer)();
typedef int (__stdcall *fn_OpSetPath)(void* handle, const wchar_t*path);
typedef const wchar_t* (__stdcall *fn_OpGetPath)(void* handle);
typedef const wchar_t* (__stdcall *fn_OpGetBasePath)(void* handle);
typedef int (__stdcall *fn_OpGetID)(void* handle);
typedef int (__stdcall *fn_OpGetLastError)(void* handle);
typedef int (__stdcall *fn_OpSetShowErrorMsg)(void* handle, int show_type);
typedef int (__stdcall *fn_OpSleep)(void* handle, int millseconds);
typedef int (__stdcall *fn_OpInjectDll)(void* handle, const wchar_t*process_name, const wchar_t*dll_name);
typedef int (__stdcall *fn_OpEnablePicCache)(void* handle, int enable);
typedef int (__stdcall *fn_OpCapturePre)(void* handle, const wchar_t*file_name);
typedef int (__stdcall *fn_OpSetScreenDataMode)(void* handle, int mode);
typedef const wchar_t* (__stdcall *fn_OpAStarFindPath)(void* handle, int map_width, int map_height, const wchar_t*disable_points, int begin_x, int begin_y, int end_x, int end_y);
typedef const wchar_t* (__stdcall *fn_OpFindNearestPos)(void* handle, const wchar_t*all_pos, int type, int x, int y);
typedef const wchar_t* (__stdcall *fn_OpEnumWindow)(void* handle, intptr_t parent, const wchar_t*title, const wchar_t*class_name, int filter);
typedef const wchar_t* (__stdcall *fn_OpEnumWindowByProcess)(void* handle, const wchar_t*process_name, const wchar_t*title, const wchar_t*class_name, int filter);
typedef const wchar_t* (__stdcall *fn_OpEnumProcess)(void* handle, const wchar_t*name);
typedef int (__stdcall *fn_OpClientToScreen)(void* handle, intptr_t hwnd, int*x, int*y);
typedef intptr_t (__stdcall *fn_OpFindWindow)(void* handle, const wchar_t*class_name, const wchar_t*title);
typedef intptr_t (__stdcall *fn_OpFindWindowByProcess)(void* handle, const wchar_t*process_name, const wchar_t*class_name, const wchar_t*title);
typedef intptr_t (__stdcall *fn_OpFindWindowByProcessId)(void* handle, int process_id, const wchar_t*class_name, const wchar_t*title);
typedef intptr_t (__stdcall *fn_OpFindWindowEx)(void* handle, intptr_t parent, const wchar_t*class_name, const wchar_t*title);
typedef int (__stdcall *fn_OpGetClientRect)(void* handle, intptr_t hwnd, int*x1, int*y1, int*x2, int*y2);
typedef int (__stdcall *fn_OpGetClientSize)(void* handle, intptr_t hwnd, int*width, int*height);
typedef intptr_t (__stdcall *fn_OpGetForegroundFocus)(void* handle);
typedef intptr_t (__stdcall *fn_OpGetForegroundWindow)(void* handle);
typedef intptr_t (__stdcall *fn_OpGetMousePointWindow)(void* handle);
typedef intptr_t (__stdcall *fn_OpGetPointWindow)(void* handle, int x, int y);
typedef const wchar_t* (__stdcall *fn_OpGetProcessInfo)(void* handle, int pid);
typedef intptr_t (__stdcall *fn_OpGetSpecialWindow)(void* handle, int flag);
typedef intptr_t (__stdcall *fn_OpGetWindow)(void* handle, intptr_t hwnd, int flag);
typedef const wchar_t* (__stdcall *fn_OpGetWindowClass)(void* handle, intptr_t hwnd);
typedef int (__stdcall *fn_OpGetWindowProcessId)(void* handle, intptr_t hwnd);
typedef const wchar_t* (__stdcall *fn_OpGetWindowProcessPath)(void* handle, intptr_t hwnd);
typedef int (__stdcall *fn_OpGetWindowRect)(void* handle, intptr_t hwnd, int*x1, int*y1, int*x2, int*y2);
typedef int (__stdcall *fn_OpGetWindowState)(void* handle, intptr_t hwnd, int flag);
typedef const wchar_t* (__stdcall *fn_OpGetWindowTitle)(void* handle, intptr_t hwnd);
typedef int (__stdcall *fn_OpMoveWindow)(void* handle, intptr_t hwnd, int x, int y);
typedef int (__stdcall *fn_OpScreenToClient)(void* handle, intptr_t hwnd, int*x, int*y);
typedef int (__stdcall *fn_OpSendPaste)(void* handle, intptr_t hwnd);
typedef int (__stdcall *fn_OpSetClientSize)(void* handle, intptr_t hwnd, int width, int height);
typedef int (__stdcall *fn_OpSetWindowState)(void* handle, intptr_t hwnd, int flag);
typedef int (__stdcall *fn_OpSetWindowSize)(void* handle, intptr_t hwnd, int width, int height);
typedef int (__stdcall *fn_OpLayoutWindows)(void* handle, const wchar_t*hwnds, int layout_type, int columns, int start_x, int start_y, int gap_x, int gap_y, int size_mode, int window_width, int window_height, int anchor_mode);
typedef int (__stdcall *fn_OpSetWindowText)(void* handle, intptr_t hwnd, const wchar_t*title);
typedef int (__stdcall *fn_OpSetWindowTransparent)(void* handle, intptr_t hwnd, int trans);
typedef int (__stdcall *fn_OpSendString)(void* handle, intptr_t hwnd, const wchar_t*str);
typedef int (__stdcall *fn_OpSendStringIme)(void* handle, intptr_t hwnd, const wchar_t*str);
typedef int (__stdcall *fn_OpRunApp)(void* handle, const wchar_t*cmdline, int mode, uint32_t*pid);
typedef int (__stdcall *fn_OpWinExec)(void* handle, const wchar_t*cmdline, int cmdshow);
typedef const wchar_t* (__stdcall *fn_OpGetCmdStr)(void* handle, const wchar_t*cmd, int millseconds);
typedef int (__stdcall *fn_OpSetClipboard)(void* handle, const wchar_t*str);
typedef const wchar_t* (__stdcall *fn_OpGetClipboard)(void* handle);
typedef int (__stdcall *fn_OpDelay)(void* handle, int mis);
typedef int (__stdcall *fn_OpDelays)(void* handle, int mis_min, int mis_max);
typedef int (__stdcall *fn_OpBindWindow)(void* handle, intptr_t hwnd, const wchar_t*display, const wchar_t*mouse, const wchar_t*keypad, int mode);
typedef int (__stdcall *fn_OpBindWindowEx)(void* handle, intptr_t display_hwnd, intptr_t input_hwnd, const wchar_t*display, const wchar_t*mouse, const wchar_t*keypad, int mode);
typedef int (__stdcall *fn_OpUnBindWindow)(void* handle);
typedef int (__stdcall *fn_OpLockInput)(void* handle, int lock);
typedef intptr_t (__stdcall *fn_OpGetBindWindow)(void* handle);
typedef int (__stdcall *fn_OpIsBind)(void* handle);
typedef int (__stdcall *fn_OpGetCursorPos)(void* handle, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpGetCursorShape)(void* handle);
typedef int (__stdcall *fn_OpMoveR)(void* handle, int x, int y);
typedef int (__stdcall *fn_OpMoveTo)(void* handle, int x, int y);
typedef const wchar_t* (__stdcall *fn_OpMoveToEx)(void* handle, int x, int y, int w, int h);
typedef int (__stdcall *fn_OpMoveToSmooth)(void* handle, int x, int y, int duration);
typedef const wchar_t* (__stdcall *fn_OpMoveToExSmooth)(void* handle, int x, int y, int w, int h, int duration);
typedef int (__stdcall *fn_OpMovePath)(void* handle, const wchar_t*path, int duration);
typedef int (__stdcall *fn_OpDragPath)(void* handle, const wchar_t*path, int duration);
typedef int (__stdcall *fn_OpSetMouseTrajectory)(void* handle, int mode, int min_duration, int max_duration, int jitter, int start_delay, int end_delay);
typedef int (__stdcall *fn_OpLeftClick)(void* handle);
typedef int (__stdcall *fn_OpLeftDoubleClick)(void* handle);
typedef int (__stdcall *fn_OpLeftDown)(void* handle);
typedef int (__stdcall *fn_OpLeftUp)(void* handle);
typedef int (__stdcall *fn_OpMiddleClick)(void* handle);
typedef int (__stdcall *fn_OpMiddleDoubleClick)(void* handle);
typedef int (__stdcall *fn_OpMiddleDown)(void* handle);
typedef int (__stdcall *fn_OpMiddleUp)(void* handle);
typedef int (__stdcall *fn_OpRightClick)(void* handle);
typedef int (__stdcall *fn_OpRightDoubleClick)(void* handle);
typedef int (__stdcall *fn_OpRightDown)(void* handle);
typedef int (__stdcall *fn_OpRightUp)(void* handle);
typedef int (__stdcall *fn_OpXButton1Click)(void* handle);
typedef int (__stdcall *fn_OpXButton1DoubleClick)(void* handle);
typedef int (__stdcall *fn_OpXButton1Down)(void* handle);
typedef int (__stdcall *fn_OpXButton1Up)(void* handle);
typedef int (__stdcall *fn_OpXButton2Click)(void* handle);
typedef int (__stdcall *fn_OpXButton2DoubleClick)(void* handle);
typedef int (__stdcall *fn_OpXButton2Down)(void* handle);
typedef int (__stdcall *fn_OpXButton2Up)(void* handle);
typedef int (__stdcall *fn_OpWheel)(void* handle, int delta);
typedef int (__stdcall *fn_OpHWheel)(void* handle, int delta);
typedef int (__stdcall *fn_OpWheelDown)(void* handle);
typedef int (__stdcall *fn_OpWheelUp)(void* handle);
typedef int (__stdcall *fn_OpSetMouseDelay)(void* handle, const wchar_t*type, int delay);
typedef int (__stdcall *fn_OpGetKeyState)(void* handle, int vk_code);
typedef int (__stdcall *fn_OpKeyDown)(void* handle, int vk_code);
typedef int (__stdcall *fn_OpKeyDownChar)(void* handle, const wchar_t*vk_code);
typedef int (__stdcall *fn_OpKeyUp)(void* handle, int vk_code);
typedef int (__stdcall *fn_OpKeyUpChar)(void* handle, const wchar_t*vk_code);
typedef int (__stdcall *fn_OpWaitKey)(void* handle, int vk_code, int time_out);
typedef int (__stdcall *fn_OpKeyPress)(void* handle, int vk_code);
typedef int (__stdcall *fn_OpKeyPressChar)(void* handle, const wchar_t*vk_code);
typedef int (__stdcall *fn_OpSetKeypadDelay)(void* handle, const wchar_t*type, int delay);
typedef int (__stdcall *fn_OpKeyPressStr)(void* handle, const wchar_t*key_str, int delay);
typedef int (__stdcall *fn_OpCapture)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*file_name);
typedef int (__stdcall *fn_OpCmpColor)(void* handle, int x, int y, const wchar_t*color, double sim);
typedef int (__stdcall *fn_OpFindColor)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int dir, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpFindColorEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int dir);
typedef int (__stdcall *fn_OpFindMultiColor)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*first_color, const wchar_t*offset_color, double sim, int dir, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpFindMultiColorEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*first_color, const wchar_t*offset_color, double sim, int dir);
typedef int (__stdcall *fn_OpFindPic)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*files, const wchar_t*delta_color, double sim, int dir, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpFindPicEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*files, const wchar_t*delta_color, double sim, int dir);
typedef const wchar_t* (__stdcall *fn_OpFindPicExS)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*files, const wchar_t*delta_color, double sim, int dir);
typedef int (__stdcall *fn_OpFindColorBlock)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int count, int height, int width, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpFindColorBlockEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int count, int height, int width);
typedef const wchar_t* (__stdcall *fn_OpGetColor)(void* handle, int x, int y);
typedef int (__stdcall *fn_OpGetColorNum)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim);
typedef int (__stdcall *fn_OpSetDisplayInput)(void* handle, const wchar_t*mode);
typedef int (__stdcall *fn_OpLoadPic)(void* handle, const wchar_t*file_name);
typedef int (__stdcall *fn_OpFreePic)(void* handle, const wchar_t*file_name);
typedef int (__stdcall *fn_OpLoadMemPic)(void* handle, const wchar_t*file_name, void*data, int size);
typedef int (__stdcall *fn_OpGetPicSize)(void* handle, const wchar_t*pic_name, int*width, int*height);
typedef uintptr_t (__stdcall *fn_OpGetScreenData)(void* handle, int x1, int y1, int x2, int y2, int*ret);
typedef uintptr_t (__stdcall *fn_OpGetScreenDataBmp)(void* handle, int x1, int y1, int x2, int y2, int*size, int*ret);
typedef void (__stdcall *fn_OpGetScreenFrameInfo)(void* handle, int*frame_id, int*time);
typedef const wchar_t* (__stdcall *fn_OpMatchPicName)(void* handle, const wchar_t*pic_name);
typedef int (__stdcall *fn_OpCvLoadTemplate)(void* handle, const wchar_t*name, const wchar_t*file_path);
typedef int (__stdcall *fn_OpCvLoadMaskedTemplate)(void* handle, const wchar_t*name, const wchar_t*template_path, const wchar_t*mask_path);
typedef int (__stdcall *fn_OpCvRemoveTemplate)(void* handle, const wchar_t*name);
typedef int (__stdcall *fn_OpCvRemoveAllTemplates)(void* handle);
typedef int (__stdcall *fn_OpCvHasTemplate)(void* handle, const wchar_t*name);
typedef int (__stdcall *fn_OpCvGetTemplateCount)(void* handle);
typedef const wchar_t* (__stdcall *fn_OpCvGetAllTemplateNames)(void* handle);
typedef const wchar_t* (__stdcall *fn_OpCvGetOpenCvVersion)(void* handle);
typedef int (__stdcall *fn_OpCvLoadTemplateList)(void* handle, const wchar_t*template_list);
typedef int (__stdcall *fn_OpCvToGray)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvToBinary)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvToEdge)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvToOutline)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvDenoise)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvEqualize)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvCLAHE)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, double clip_limit, int tile_grid_size);
typedef int (__stdcall *fn_OpCvBlur)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, const wchar_t*mode, int kernel_size);
typedef int (__stdcall *fn_OpCvSharpen)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, double strength);
typedef int (__stdcall *fn_OpCvCropValid)(void* handle, const wchar_t*src_file, const wchar_t*dst_file);
typedef const wchar_t* (__stdcall *fn_OpCvConnectedComponents)(void* handle, const wchar_t*src_file, double min_area);
typedef const wchar_t* (__stdcall *fn_OpCvFindContours)(void* handle, const wchar_t*src_file, double min_area);
typedef int (__stdcall *fn_OpCvPreprocessPipeline)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, const wchar_t*pipeline);
typedef int (__stdcall *fn_OpCvCrop)(void* handle, const wchar_t*src_file, int x, int y, int width, int height, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvResize)(void* handle, const wchar_t*src_file, int width, int height, const wchar_t*dst_file);
typedef int (__stdcall *fn_OpCvThreshold)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, double threshold, double max_value, const wchar_t*mode);
typedef int (__stdcall *fn_OpCvInRange)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, const wchar_t*color_space, const wchar_t*lower, const wchar_t*upper);
typedef int (__stdcall *fn_OpCvMorphology)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, const wchar_t*mode, int kernel_size, int iterations);
typedef int (__stdcall *fn_OpCvThin)(void* handle, const wchar_t*src_file, const wchar_t*dst_file, const wchar_t*mode);
typedef const wchar_t* (__stdcall *fn_OpCvMatchTemplate)(void* handle, int x, int y, int width, int height, const wchar_t*template_name, double threshold, int dir, int strip_mode, int method, int color_mode);
typedef const wchar_t* (__stdcall *fn_OpCvMatchTemplateScale)(void* handle, int x, int y, int width, int height, const wchar_t*template_name, const wchar_t*scales, double threshold, int method, int color_mode);
typedef const wchar_t* (__stdcall *fn_OpCvMatchAnyTemplate)(void* handle, int x, int y, int width, int height, const wchar_t*template_names, double threshold, int dir, int strip_mode, int method, int color_mode);
typedef const wchar_t* (__stdcall *fn_OpCvMatchAllTemplates)(void* handle, int x, int y, int width, int height, const wchar_t*template_names, double threshold, int dir, int strip_mode, int method, int color_mode);
typedef const wchar_t* (__stdcall *fn_OpCvFeatureMatchTemplate)(void* handle, int x, int y, int width, int height, const wchar_t*template_name, double threshold);
typedef const wchar_t* (__stdcall *fn_OpCvEdgeMatchTemplate)(void* handle, int x, int y, int width, int height, const wchar_t*template_name, double threshold);
typedef const wchar_t* (__stdcall *fn_OpCvShapeMatchTemplate)(void* handle, int x, int y, int width, int height, const wchar_t*template_name, double threshold);
typedef int (__stdcall *fn_OpSetOcrEngine)(void* handle, const wchar_t*path_of_engine, const wchar_t*dll_name, const wchar_t*argv);
typedef int (__stdcall *fn_OpSetYoloEngine)(void* handle, const wchar_t*path_of_engine, const wchar_t*dll_name, const wchar_t*argv);
typedef const wchar_t* (__stdcall *fn_OpYoloDetect)(void* handle, int x1, int y1, int x2, int y2, double conf, double iou);
typedef const wchar_t* (__stdcall *fn_OpYoloDetectFromFile)(void* handle, const wchar_t*file_name, double conf, double iou);
typedef int (__stdcall *fn_OpSetDict)(void* handle, int idx, const wchar_t*file_name);
typedef const wchar_t* (__stdcall *fn_OpGetDict)(void* handle, int idx, int font_index);
typedef int (__stdcall *fn_OpSetMemDict)(void* handle, int idx, const void*data, int size);
typedef int (__stdcall *fn_OpUseDict)(void* handle, int idx);
typedef int (__stdcall *fn_OpAddDict)(void* handle, int idx, const wchar_t*dict_info);
typedef int (__stdcall *fn_OpSaveDict)(void* handle, int idx, const wchar_t*file_name);
typedef int (__stdcall *fn_OpClearDict)(void* handle, int idx);
typedef int (__stdcall *fn_OpGetDictCount)(void* handle, int idx);
typedef int (__stdcall *fn_OpGetNowDict)(void* handle);
typedef int (__stdcall *fn_OpSetBinaryPreprocess)(void* handle, int mode, int isolated_threshold, int min_component_area, int bridge_gap);
typedef int (__stdcall *fn_OpGetBinaryPreprocess)(void* handle, int*mode, int*isolated_threshold, int*min_component_area, int*bridge_gap);
typedef const wchar_t* (__stdcall *fn_OpFetchWord)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, const wchar_t*word);
typedef const wchar_t* (__stdcall *fn_OpFetchWordEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, const wchar_t*word);
typedef const wchar_t* (__stdcall *fn_OpExtractWordRects)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int min_word_h);
typedef const wchar_t* (__stdcall *fn_OpExtractWordRectsEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int min_word_w, int min_word_h, int padding);
typedef const wchar_t* (__stdcall *fn_OpFetchWords)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, const wchar_t*words, int min_word_h);
typedef const wchar_t* (__stdcall *fn_OpFetchWordsEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, const wchar_t*words, int min_word_w, int min_word_h, int padding);
typedef const wchar_t* (__stdcall *fn_OpFetchWordsByRects)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, const wchar_t*words, const wchar_t*rects);
typedef const wchar_t* (__stdcall *fn_OpGetBinaryPreview)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim, int*ret);
typedef const wchar_t* (__stdcall *fn_OpGetWordPreview)(void* handle, const wchar_t*dict_info, int*ret);
typedef const wchar_t* (__stdcall *fn_OpCheckWordDict)(void* handle, const wchar_t*dict_info, int*ret);
typedef const wchar_t* (__stdcall *fn_OpNormalizeWordDict)(void* handle, const wchar_t*dict_info, int*ret);
typedef const wchar_t* (__stdcall *fn_OpRenameWordDict)(void* handle, const wchar_t*dict_info, const wchar_t*words, int*ret);
typedef const wchar_t* (__stdcall *fn_OpGetWordsNoDict)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color);
typedef int (__stdcall *fn_OpGetWordResultCount)(void* handle, const wchar_t*result);
typedef int (__stdcall *fn_OpGetWordResultPos)(void* handle, const wchar_t*result, int index, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpGetWordResultStr)(void* handle, const wchar_t*result, int index);
typedef const wchar_t* (__stdcall *fn_OpOcr)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim);
typedef const wchar_t* (__stdcall *fn_OpOcrEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim);
typedef int (__stdcall *fn_OpFindStr)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*strs, const wchar_t*color, double sim, int*x, int*y);
typedef const wchar_t* (__stdcall *fn_OpFindStrEx)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*strs, const wchar_t*color, double sim);
typedef const wchar_t* (__stdcall *fn_OpOcrAuto)(void* handle, int x1, int y1, int x2, int y2, double sim);
typedef const wchar_t* (__stdcall *fn_OpOcrFromFile)(void* handle, const wchar_t*file_name, const wchar_t*color_format, double sim);
typedef const wchar_t* (__stdcall *fn_OpOcrAutoFromFile)(void* handle, const wchar_t*file_name, double sim);
typedef const wchar_t* (__stdcall *fn_OpFindLine)(void* handle, int x1, int y1, int x2, int y2, const wchar_t*color, double sim);
typedef int (__stdcall *fn_OpWriteData)(void* handle, intptr_t hwnd, const wchar_t*address, const wchar_t*data, int size);
typedef const wchar_t* (__stdcall *fn_OpReadData)(void* handle, intptr_t hwnd, const wchar_t*address, int size);
typedef int (__stdcall *fn_OpReadInt)(void* handle, intptr_t hwnd, const wchar_t*address, int type, int64_t*value);
typedef int (__stdcall *fn_OpWriteInt)(void* handle, intptr_t hwnd, const wchar_t*address, int type, int64_t value);
typedef int (__stdcall *fn_OpReadFloat)(void* handle, intptr_t hwnd, const wchar_t*address, float*value);
typedef int (__stdcall *fn_OpWriteFloat)(void* handle, intptr_t hwnd, const wchar_t*address, float value);
typedef int (__stdcall *fn_OpReadDouble)(void* handle, intptr_t hwnd, const wchar_t*address, double*value);
typedef int (__stdcall *fn_OpWriteDouble)(void* handle, intptr_t hwnd, const wchar_t*address, double value);
typedef const wchar_t* (__stdcall *fn_OpReadString)(void* handle, intptr_t hwnd, const wchar_t*address, int type, int len);
typedef int (__stdcall *fn_OpWriteString)(void* handle, intptr_t hwnd, const wchar_t*address, int type, const wchar_t*value);

inline fn_OpCreate p_OpCreate = nullptr;
inline fn_OpDestroy p_OpDestroy = nullptr;
inline fn_OpVer p_OpVer = nullptr;
inline fn_OpSetPath p_OpSetPath = nullptr;
inline fn_OpGetPath p_OpGetPath = nullptr;
inline fn_OpGetBasePath p_OpGetBasePath = nullptr;
inline fn_OpGetID p_OpGetID = nullptr;
inline fn_OpGetLastError p_OpGetLastError = nullptr;
inline fn_OpSetShowErrorMsg p_OpSetShowErrorMsg = nullptr;
inline fn_OpSleep p_OpSleep = nullptr;
inline fn_OpInjectDll p_OpInjectDll = nullptr;
inline fn_OpEnablePicCache p_OpEnablePicCache = nullptr;
inline fn_OpCapturePre p_OpCapturePre = nullptr;
inline fn_OpSetScreenDataMode p_OpSetScreenDataMode = nullptr;
inline fn_OpAStarFindPath p_OpAStarFindPath = nullptr;
inline fn_OpFindNearestPos p_OpFindNearestPos = nullptr;
inline fn_OpEnumWindow p_OpEnumWindow = nullptr;
inline fn_OpEnumWindowByProcess p_OpEnumWindowByProcess = nullptr;
inline fn_OpEnumProcess p_OpEnumProcess = nullptr;
inline fn_OpClientToScreen p_OpClientToScreen = nullptr;
inline fn_OpFindWindow p_OpFindWindow = nullptr;
inline fn_OpFindWindowByProcess p_OpFindWindowByProcess = nullptr;
inline fn_OpFindWindowByProcessId p_OpFindWindowByProcessId = nullptr;
inline fn_OpFindWindowEx p_OpFindWindowEx = nullptr;
inline fn_OpGetClientRect p_OpGetClientRect = nullptr;
inline fn_OpGetClientSize p_OpGetClientSize = nullptr;
inline fn_OpGetForegroundFocus p_OpGetForegroundFocus = nullptr;
inline fn_OpGetForegroundWindow p_OpGetForegroundWindow = nullptr;
inline fn_OpGetMousePointWindow p_OpGetMousePointWindow = nullptr;
inline fn_OpGetPointWindow p_OpGetPointWindow = nullptr;
inline fn_OpGetProcessInfo p_OpGetProcessInfo = nullptr;
inline fn_OpGetSpecialWindow p_OpGetSpecialWindow = nullptr;
inline fn_OpGetWindow p_OpGetWindow = nullptr;
inline fn_OpGetWindowClass p_OpGetWindowClass = nullptr;
inline fn_OpGetWindowProcessId p_OpGetWindowProcessId = nullptr;
inline fn_OpGetWindowProcessPath p_OpGetWindowProcessPath = nullptr;
inline fn_OpGetWindowRect p_OpGetWindowRect = nullptr;
inline fn_OpGetWindowState p_OpGetWindowState = nullptr;
inline fn_OpGetWindowTitle p_OpGetWindowTitle = nullptr;
inline fn_OpMoveWindow p_OpMoveWindow = nullptr;
inline fn_OpScreenToClient p_OpScreenToClient = nullptr;
inline fn_OpSendPaste p_OpSendPaste = nullptr;
inline fn_OpSetClientSize p_OpSetClientSize = nullptr;
inline fn_OpSetWindowState p_OpSetWindowState = nullptr;
inline fn_OpSetWindowSize p_OpSetWindowSize = nullptr;
inline fn_OpLayoutWindows p_OpLayoutWindows = nullptr;
inline fn_OpSetWindowText p_OpSetWindowText = nullptr;
inline fn_OpSetWindowTransparent p_OpSetWindowTransparent = nullptr;
inline fn_OpSendString p_OpSendString = nullptr;
inline fn_OpSendStringIme p_OpSendStringIme = nullptr;
inline fn_OpRunApp p_OpRunApp = nullptr;
inline fn_OpWinExec p_OpWinExec = nullptr;
inline fn_OpGetCmdStr p_OpGetCmdStr = nullptr;
inline fn_OpSetClipboard p_OpSetClipboard = nullptr;
inline fn_OpGetClipboard p_OpGetClipboard = nullptr;
inline fn_OpDelay p_OpDelay = nullptr;
inline fn_OpDelays p_OpDelays = nullptr;
inline fn_OpBindWindow p_OpBindWindow = nullptr;
inline fn_OpBindWindowEx p_OpBindWindowEx = nullptr;
inline fn_OpUnBindWindow p_OpUnBindWindow = nullptr;
inline fn_OpLockInput p_OpLockInput = nullptr;
inline fn_OpGetBindWindow p_OpGetBindWindow = nullptr;
inline fn_OpIsBind p_OpIsBind = nullptr;
inline fn_OpGetCursorPos p_OpGetCursorPos = nullptr;
inline fn_OpGetCursorShape p_OpGetCursorShape = nullptr;
inline fn_OpMoveR p_OpMoveR = nullptr;
inline fn_OpMoveTo p_OpMoveTo = nullptr;
inline fn_OpMoveToEx p_OpMoveToEx = nullptr;
inline fn_OpMoveToSmooth p_OpMoveToSmooth = nullptr;
inline fn_OpMoveToExSmooth p_OpMoveToExSmooth = nullptr;
inline fn_OpMovePath p_OpMovePath = nullptr;
inline fn_OpDragPath p_OpDragPath = nullptr;
inline fn_OpSetMouseTrajectory p_OpSetMouseTrajectory = nullptr;
inline fn_OpLeftClick p_OpLeftClick = nullptr;
inline fn_OpLeftDoubleClick p_OpLeftDoubleClick = nullptr;
inline fn_OpLeftDown p_OpLeftDown = nullptr;
inline fn_OpLeftUp p_OpLeftUp = nullptr;
inline fn_OpMiddleClick p_OpMiddleClick = nullptr;
inline fn_OpMiddleDoubleClick p_OpMiddleDoubleClick = nullptr;
inline fn_OpMiddleDown p_OpMiddleDown = nullptr;
inline fn_OpMiddleUp p_OpMiddleUp = nullptr;
inline fn_OpRightClick p_OpRightClick = nullptr;
inline fn_OpRightDoubleClick p_OpRightDoubleClick = nullptr;
inline fn_OpRightDown p_OpRightDown = nullptr;
inline fn_OpRightUp p_OpRightUp = nullptr;
inline fn_OpXButton1Click p_OpXButton1Click = nullptr;
inline fn_OpXButton1DoubleClick p_OpXButton1DoubleClick = nullptr;
inline fn_OpXButton1Down p_OpXButton1Down = nullptr;
inline fn_OpXButton1Up p_OpXButton1Up = nullptr;
inline fn_OpXButton2Click p_OpXButton2Click = nullptr;
inline fn_OpXButton2DoubleClick p_OpXButton2DoubleClick = nullptr;
inline fn_OpXButton2Down p_OpXButton2Down = nullptr;
inline fn_OpXButton2Up p_OpXButton2Up = nullptr;
inline fn_OpWheel p_OpWheel = nullptr;
inline fn_OpHWheel p_OpHWheel = nullptr;
inline fn_OpWheelDown p_OpWheelDown = nullptr;
inline fn_OpWheelUp p_OpWheelUp = nullptr;
inline fn_OpSetMouseDelay p_OpSetMouseDelay = nullptr;
inline fn_OpGetKeyState p_OpGetKeyState = nullptr;
inline fn_OpKeyDown p_OpKeyDown = nullptr;
inline fn_OpKeyDownChar p_OpKeyDownChar = nullptr;
inline fn_OpKeyUp p_OpKeyUp = nullptr;
inline fn_OpKeyUpChar p_OpKeyUpChar = nullptr;
inline fn_OpWaitKey p_OpWaitKey = nullptr;
inline fn_OpKeyPress p_OpKeyPress = nullptr;
inline fn_OpKeyPressChar p_OpKeyPressChar = nullptr;
inline fn_OpSetKeypadDelay p_OpSetKeypadDelay = nullptr;
inline fn_OpKeyPressStr p_OpKeyPressStr = nullptr;
inline fn_OpCapture p_OpCapture = nullptr;
inline fn_OpCmpColor p_OpCmpColor = nullptr;
inline fn_OpFindColor p_OpFindColor = nullptr;
inline fn_OpFindColorEx p_OpFindColorEx = nullptr;
inline fn_OpFindMultiColor p_OpFindMultiColor = nullptr;
inline fn_OpFindMultiColorEx p_OpFindMultiColorEx = nullptr;
inline fn_OpFindPic p_OpFindPic = nullptr;
inline fn_OpFindPicEx p_OpFindPicEx = nullptr;
inline fn_OpFindPicExS p_OpFindPicExS = nullptr;
inline fn_OpFindColorBlock p_OpFindColorBlock = nullptr;
inline fn_OpFindColorBlockEx p_OpFindColorBlockEx = nullptr;
inline fn_OpGetColor p_OpGetColor = nullptr;
inline fn_OpGetColorNum p_OpGetColorNum = nullptr;
inline fn_OpSetDisplayInput p_OpSetDisplayInput = nullptr;
inline fn_OpLoadPic p_OpLoadPic = nullptr;
inline fn_OpFreePic p_OpFreePic = nullptr;
inline fn_OpLoadMemPic p_OpLoadMemPic = nullptr;
inline fn_OpGetPicSize p_OpGetPicSize = nullptr;
inline fn_OpGetScreenData p_OpGetScreenData = nullptr;
inline fn_OpGetScreenDataBmp p_OpGetScreenDataBmp = nullptr;
inline fn_OpGetScreenFrameInfo p_OpGetScreenFrameInfo = nullptr;
inline fn_OpMatchPicName p_OpMatchPicName = nullptr;
inline fn_OpCvLoadTemplate p_OpCvLoadTemplate = nullptr;
inline fn_OpCvLoadMaskedTemplate p_OpCvLoadMaskedTemplate = nullptr;
inline fn_OpCvRemoveTemplate p_OpCvRemoveTemplate = nullptr;
inline fn_OpCvRemoveAllTemplates p_OpCvRemoveAllTemplates = nullptr;
inline fn_OpCvHasTemplate p_OpCvHasTemplate = nullptr;
inline fn_OpCvGetTemplateCount p_OpCvGetTemplateCount = nullptr;
inline fn_OpCvGetAllTemplateNames p_OpCvGetAllTemplateNames = nullptr;
inline fn_OpCvGetOpenCvVersion p_OpCvGetOpenCvVersion = nullptr;
inline fn_OpCvLoadTemplateList p_OpCvLoadTemplateList = nullptr;
inline fn_OpCvToGray p_OpCvToGray = nullptr;
inline fn_OpCvToBinary p_OpCvToBinary = nullptr;
inline fn_OpCvToEdge p_OpCvToEdge = nullptr;
inline fn_OpCvToOutline p_OpCvToOutline = nullptr;
inline fn_OpCvDenoise p_OpCvDenoise = nullptr;
inline fn_OpCvEqualize p_OpCvEqualize = nullptr;
inline fn_OpCvCLAHE p_OpCvCLAHE = nullptr;
inline fn_OpCvBlur p_OpCvBlur = nullptr;
inline fn_OpCvSharpen p_OpCvSharpen = nullptr;
inline fn_OpCvCropValid p_OpCvCropValid = nullptr;
inline fn_OpCvConnectedComponents p_OpCvConnectedComponents = nullptr;
inline fn_OpCvFindContours p_OpCvFindContours = nullptr;
inline fn_OpCvPreprocessPipeline p_OpCvPreprocessPipeline = nullptr;
inline fn_OpCvCrop p_OpCvCrop = nullptr;
inline fn_OpCvResize p_OpCvResize = nullptr;
inline fn_OpCvThreshold p_OpCvThreshold = nullptr;
inline fn_OpCvInRange p_OpCvInRange = nullptr;
inline fn_OpCvMorphology p_OpCvMorphology = nullptr;
inline fn_OpCvThin p_OpCvThin = nullptr;
inline fn_OpCvMatchTemplate p_OpCvMatchTemplate = nullptr;
inline fn_OpCvMatchTemplateScale p_OpCvMatchTemplateScale = nullptr;
inline fn_OpCvMatchAnyTemplate p_OpCvMatchAnyTemplate = nullptr;
inline fn_OpCvMatchAllTemplates p_OpCvMatchAllTemplates = nullptr;
inline fn_OpCvFeatureMatchTemplate p_OpCvFeatureMatchTemplate = nullptr;
inline fn_OpCvEdgeMatchTemplate p_OpCvEdgeMatchTemplate = nullptr;
inline fn_OpCvShapeMatchTemplate p_OpCvShapeMatchTemplate = nullptr;
inline fn_OpSetOcrEngine p_OpSetOcrEngine = nullptr;
inline fn_OpSetYoloEngine p_OpSetYoloEngine = nullptr;
inline fn_OpYoloDetect p_OpYoloDetect = nullptr;
inline fn_OpYoloDetectFromFile p_OpYoloDetectFromFile = nullptr;
inline fn_OpSetDict p_OpSetDict = nullptr;
inline fn_OpGetDict p_OpGetDict = nullptr;
inline fn_OpSetMemDict p_OpSetMemDict = nullptr;
inline fn_OpUseDict p_OpUseDict = nullptr;
inline fn_OpAddDict p_OpAddDict = nullptr;
inline fn_OpSaveDict p_OpSaveDict = nullptr;
inline fn_OpClearDict p_OpClearDict = nullptr;
inline fn_OpGetDictCount p_OpGetDictCount = nullptr;
inline fn_OpGetNowDict p_OpGetNowDict = nullptr;
inline fn_OpSetBinaryPreprocess p_OpSetBinaryPreprocess = nullptr;
inline fn_OpGetBinaryPreprocess p_OpGetBinaryPreprocess = nullptr;
inline fn_OpFetchWord p_OpFetchWord = nullptr;
inline fn_OpFetchWordEx p_OpFetchWordEx = nullptr;
inline fn_OpExtractWordRects p_OpExtractWordRects = nullptr;
inline fn_OpExtractWordRectsEx p_OpExtractWordRectsEx = nullptr;
inline fn_OpFetchWords p_OpFetchWords = nullptr;
inline fn_OpFetchWordsEx p_OpFetchWordsEx = nullptr;
inline fn_OpFetchWordsByRects p_OpFetchWordsByRects = nullptr;
inline fn_OpGetBinaryPreview p_OpGetBinaryPreview = nullptr;
inline fn_OpGetWordPreview p_OpGetWordPreview = nullptr;
inline fn_OpCheckWordDict p_OpCheckWordDict = nullptr;
inline fn_OpNormalizeWordDict p_OpNormalizeWordDict = nullptr;
inline fn_OpRenameWordDict p_OpRenameWordDict = nullptr;
inline fn_OpGetWordsNoDict p_OpGetWordsNoDict = nullptr;
inline fn_OpGetWordResultCount p_OpGetWordResultCount = nullptr;
inline fn_OpGetWordResultPos p_OpGetWordResultPos = nullptr;
inline fn_OpGetWordResultStr p_OpGetWordResultStr = nullptr;
inline fn_OpOcr p_OpOcr = nullptr;
inline fn_OpOcrEx p_OpOcrEx = nullptr;
inline fn_OpFindStr p_OpFindStr = nullptr;
inline fn_OpFindStrEx p_OpFindStrEx = nullptr;
inline fn_OpOcrAuto p_OpOcrAuto = nullptr;
inline fn_OpOcrFromFile p_OpOcrFromFile = nullptr;
inline fn_OpOcrAutoFromFile p_OpOcrAutoFromFile = nullptr;
inline fn_OpFindLine p_OpFindLine = nullptr;
inline fn_OpWriteData p_OpWriteData = nullptr;
inline fn_OpReadData p_OpReadData = nullptr;
inline fn_OpReadInt p_OpReadInt = nullptr;
inline fn_OpWriteInt p_OpWriteInt = nullptr;
inline fn_OpReadFloat p_OpReadFloat = nullptr;
inline fn_OpWriteFloat p_OpWriteFloat = nullptr;
inline fn_OpReadDouble p_OpReadDouble = nullptr;
inline fn_OpWriteDouble p_OpWriteDouble = nullptr;
inline fn_OpReadString p_OpReadString = nullptr;
inline fn_OpWriteString p_OpWriteString = nullptr;

namespace impl {

inline bool loadAll() {
#ifdef _WIN64
    const wchar_t* dllName = L"op_c_api_x64.dll";
#else
    const wchar_t* dllName = L"op_c_api_x86.dll";
#endif
    wchar_t exePath[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::wstring exeDir(exePath);
    const size_t lastSlash = exeDir.find_last_of(L'\\');
    if (lastSlash != std::wstring::npos) exeDir.resize(lastSlash);
    const std::wstring fullPath = exeDir + L"\\" + dllName;
    HMODULE module = LoadLibraryW(fullPath.c_str());
    if (!module) module = LoadLibraryW(dllName);
    if (!module) {
        g_loadError = std::wstring(L"无法加载随包运行库 ") + dllName + L"（应与 exe 同目录，构建时会自动复制）。";
        return false;
    }
    // 运行库常驻不卸载：内部工作线程无法安全停止，卸载必然崩溃。
    // x86 stdcall 导出是 _Name@N 装饰名（dumpbin 实证），x64 是裸名；两个都试。
    auto lbopGetProc = [](HMODULE m, const char* plain, const char* decorated) -> FARPROC {
        FARPROC proc = ::GetProcAddress(m, plain);
        return proc ? proc : ::GetProcAddress(m, decorated);
    };
#define LBOP_LOAD(fn, deco) p_##fn = reinterpret_cast<fn_##fn>(reinterpret_cast<void*>(lbopGetProc(module, #fn, deco)));
LBOP_LOAD(OpCreate, "_OpCreate@0")
LBOP_LOAD(OpDestroy, "_OpDestroy@4")
LBOP_LOAD(OpVer, "_OpVer@0")
LBOP_LOAD(OpSetPath, "_OpSetPath@8")
LBOP_LOAD(OpGetPath, "_OpGetPath@4")
LBOP_LOAD(OpGetBasePath, "_OpGetBasePath@4")
LBOP_LOAD(OpGetID, "_OpGetID@4")
LBOP_LOAD(OpGetLastError, "_OpGetLastError@4")
LBOP_LOAD(OpSetShowErrorMsg, "_OpSetShowErrorMsg@8")
LBOP_LOAD(OpSleep, "_OpSleep@8")
LBOP_LOAD(OpInjectDll, "_OpInjectDll@12")
LBOP_LOAD(OpEnablePicCache, "_OpEnablePicCache@8")
LBOP_LOAD(OpCapturePre, "_OpCapturePre@8")
LBOP_LOAD(OpSetScreenDataMode, "_OpSetScreenDataMode@8")
LBOP_LOAD(OpAStarFindPath, "_OpAStarFindPath@32")
LBOP_LOAD(OpFindNearestPos, "_OpFindNearestPos@20")
LBOP_LOAD(OpEnumWindow, "_OpEnumWindow@20")
LBOP_LOAD(OpEnumWindowByProcess, "_OpEnumWindowByProcess@20")
LBOP_LOAD(OpEnumProcess, "_OpEnumProcess@8")
LBOP_LOAD(OpClientToScreen, "_OpClientToScreen@16")
LBOP_LOAD(OpFindWindow, "_OpFindWindow@12")
LBOP_LOAD(OpFindWindowByProcess, "_OpFindWindowByProcess@16")
LBOP_LOAD(OpFindWindowByProcessId, "_OpFindWindowByProcessId@16")
LBOP_LOAD(OpFindWindowEx, "_OpFindWindowEx@16")
LBOP_LOAD(OpGetClientRect, "_OpGetClientRect@24")
LBOP_LOAD(OpGetClientSize, "_OpGetClientSize@16")
LBOP_LOAD(OpGetForegroundFocus, "_OpGetForegroundFocus@4")
LBOP_LOAD(OpGetForegroundWindow, "_OpGetForegroundWindow@4")
LBOP_LOAD(OpGetMousePointWindow, "_OpGetMousePointWindow@4")
LBOP_LOAD(OpGetPointWindow, "_OpGetPointWindow@12")
LBOP_LOAD(OpGetProcessInfo, "_OpGetProcessInfo@8")
LBOP_LOAD(OpGetSpecialWindow, "_OpGetSpecialWindow@8")
LBOP_LOAD(OpGetWindow, "_OpGetWindow@12")
LBOP_LOAD(OpGetWindowClass, "_OpGetWindowClass@8")
LBOP_LOAD(OpGetWindowProcessId, "_OpGetWindowProcessId@8")
LBOP_LOAD(OpGetWindowProcessPath, "_OpGetWindowProcessPath@8")
LBOP_LOAD(OpGetWindowRect, "_OpGetWindowRect@24")
LBOP_LOAD(OpGetWindowState, "_OpGetWindowState@12")
LBOP_LOAD(OpGetWindowTitle, "_OpGetWindowTitle@8")
LBOP_LOAD(OpMoveWindow, "_OpMoveWindow@16")
LBOP_LOAD(OpScreenToClient, "_OpScreenToClient@16")
LBOP_LOAD(OpSendPaste, "_OpSendPaste@8")
LBOP_LOAD(OpSetClientSize, "_OpSetClientSize@16")
LBOP_LOAD(OpSetWindowState, "_OpSetWindowState@12")
LBOP_LOAD(OpSetWindowSize, "_OpSetWindowSize@16")
LBOP_LOAD(OpLayoutWindows, "_OpLayoutWindows@48")
LBOP_LOAD(OpSetWindowText, "_OpSetWindowText@12")
LBOP_LOAD(OpSetWindowTransparent, "_OpSetWindowTransparent@12")
LBOP_LOAD(OpSendString, "_OpSendString@12")
LBOP_LOAD(OpSendStringIme, "_OpSendStringIme@12")
LBOP_LOAD(OpRunApp, "_OpRunApp@16")
LBOP_LOAD(OpWinExec, "_OpWinExec@12")
LBOP_LOAD(OpGetCmdStr, "_OpGetCmdStr@12")
LBOP_LOAD(OpSetClipboard, "_OpSetClipboard@8")
LBOP_LOAD(OpGetClipboard, "_OpGetClipboard@4")
LBOP_LOAD(OpDelay, "_OpDelay@8")
LBOP_LOAD(OpDelays, "_OpDelays@12")
LBOP_LOAD(OpBindWindow, "_OpBindWindow@24")
LBOP_LOAD(OpBindWindowEx, "_OpBindWindowEx@28")
LBOP_LOAD(OpUnBindWindow, "_OpUnBindWindow@4")
LBOP_LOAD(OpLockInput, "_OpLockInput@8")
LBOP_LOAD(OpGetBindWindow, "_OpGetBindWindow@4")
LBOP_LOAD(OpIsBind, "_OpIsBind@4")
LBOP_LOAD(OpGetCursorPos, "_OpGetCursorPos@12")
LBOP_LOAD(OpGetCursorShape, "_OpGetCursorShape@4")
LBOP_LOAD(OpMoveR, "_OpMoveR@12")
LBOP_LOAD(OpMoveTo, "_OpMoveTo@12")
LBOP_LOAD(OpMoveToEx, "_OpMoveToEx@20")
LBOP_LOAD(OpMoveToSmooth, "_OpMoveToSmooth@16")
LBOP_LOAD(OpMoveToExSmooth, "_OpMoveToExSmooth@24")
LBOP_LOAD(OpMovePath, "_OpMovePath@12")
LBOP_LOAD(OpDragPath, "_OpDragPath@12")
LBOP_LOAD(OpSetMouseTrajectory, "_OpSetMouseTrajectory@28")
LBOP_LOAD(OpLeftClick, "_OpLeftClick@4")
LBOP_LOAD(OpLeftDoubleClick, "_OpLeftDoubleClick@4")
LBOP_LOAD(OpLeftDown, "_OpLeftDown@4")
LBOP_LOAD(OpLeftUp, "_OpLeftUp@4")
LBOP_LOAD(OpMiddleClick, "_OpMiddleClick@4")
LBOP_LOAD(OpMiddleDoubleClick, "_OpMiddleDoubleClick@4")
LBOP_LOAD(OpMiddleDown, "_OpMiddleDown@4")
LBOP_LOAD(OpMiddleUp, "_OpMiddleUp@4")
LBOP_LOAD(OpRightClick, "_OpRightClick@4")
LBOP_LOAD(OpRightDoubleClick, "_OpRightDoubleClick@4")
LBOP_LOAD(OpRightDown, "_OpRightDown@4")
LBOP_LOAD(OpRightUp, "_OpRightUp@4")
LBOP_LOAD(OpXButton1Click, "_OpXButton1Click@4")
LBOP_LOAD(OpXButton1DoubleClick, "_OpXButton1DoubleClick@4")
LBOP_LOAD(OpXButton1Down, "_OpXButton1Down@4")
LBOP_LOAD(OpXButton1Up, "_OpXButton1Up@4")
LBOP_LOAD(OpXButton2Click, "_OpXButton2Click@4")
LBOP_LOAD(OpXButton2DoubleClick, "_OpXButton2DoubleClick@4")
LBOP_LOAD(OpXButton2Down, "_OpXButton2Down@4")
LBOP_LOAD(OpXButton2Up, "_OpXButton2Up@4")
LBOP_LOAD(OpWheel, "_OpWheel@8")
LBOP_LOAD(OpHWheel, "_OpHWheel@8")
LBOP_LOAD(OpWheelDown, "_OpWheelDown@4")
LBOP_LOAD(OpWheelUp, "_OpWheelUp@4")
LBOP_LOAD(OpSetMouseDelay, "_OpSetMouseDelay@12")
LBOP_LOAD(OpGetKeyState, "_OpGetKeyState@8")
LBOP_LOAD(OpKeyDown, "_OpKeyDown@8")
LBOP_LOAD(OpKeyDownChar, "_OpKeyDownChar@8")
LBOP_LOAD(OpKeyUp, "_OpKeyUp@8")
LBOP_LOAD(OpKeyUpChar, "_OpKeyUpChar@8")
LBOP_LOAD(OpWaitKey, "_OpWaitKey@12")
LBOP_LOAD(OpKeyPress, "_OpKeyPress@8")
LBOP_LOAD(OpKeyPressChar, "_OpKeyPressChar@8")
LBOP_LOAD(OpSetKeypadDelay, "_OpSetKeypadDelay@12")
LBOP_LOAD(OpKeyPressStr, "_OpKeyPressStr@12")
LBOP_LOAD(OpCapture, "_OpCapture@24")
LBOP_LOAD(OpCmpColor, "_OpCmpColor@24")
LBOP_LOAD(OpFindColor, "_OpFindColor@44")
LBOP_LOAD(OpFindColorEx, "_OpFindColorEx@36")
LBOP_LOAD(OpFindMultiColor, "_OpFindMultiColor@48")
LBOP_LOAD(OpFindMultiColorEx, "_OpFindMultiColorEx@40")
LBOP_LOAD(OpFindPic, "_OpFindPic@48")
LBOP_LOAD(OpFindPicEx, "_OpFindPicEx@40")
LBOP_LOAD(OpFindPicExS, "_OpFindPicExS@40")
LBOP_LOAD(OpFindColorBlock, "_OpFindColorBlock@52")
LBOP_LOAD(OpFindColorBlockEx, "_OpFindColorBlockEx@44")
LBOP_LOAD(OpGetColor, "_OpGetColor@12")
LBOP_LOAD(OpGetColorNum, "_OpGetColorNum@32")
LBOP_LOAD(OpSetDisplayInput, "_OpSetDisplayInput@8")
LBOP_LOAD(OpLoadPic, "_OpLoadPic@8")
LBOP_LOAD(OpFreePic, "_OpFreePic@8")
LBOP_LOAD(OpLoadMemPic, "_OpLoadMemPic@16")
LBOP_LOAD(OpGetPicSize, "_OpGetPicSize@16")
LBOP_LOAD(OpGetScreenData, "_OpGetScreenData@24")
LBOP_LOAD(OpGetScreenDataBmp, "_OpGetScreenDataBmp@28")
LBOP_LOAD(OpGetScreenFrameInfo, "_OpGetScreenFrameInfo@12")
LBOP_LOAD(OpMatchPicName, "_OpMatchPicName@8")
LBOP_LOAD(OpCvLoadTemplate, "_OpCvLoadTemplate@12")
LBOP_LOAD(OpCvLoadMaskedTemplate, "_OpCvLoadMaskedTemplate@16")
LBOP_LOAD(OpCvRemoveTemplate, "_OpCvRemoveTemplate@8")
LBOP_LOAD(OpCvRemoveAllTemplates, "_OpCvRemoveAllTemplates@4")
LBOP_LOAD(OpCvHasTemplate, "_OpCvHasTemplate@8")
LBOP_LOAD(OpCvGetTemplateCount, "_OpCvGetTemplateCount@4")
LBOP_LOAD(OpCvGetAllTemplateNames, "_OpCvGetAllTemplateNames@4")
LBOP_LOAD(OpCvGetOpenCvVersion, "_OpCvGetOpenCvVersion@4")
LBOP_LOAD(OpCvLoadTemplateList, "_OpCvLoadTemplateList@8")
LBOP_LOAD(OpCvToGray, "_OpCvToGray@12")
LBOP_LOAD(OpCvToBinary, "_OpCvToBinary@12")
LBOP_LOAD(OpCvToEdge, "_OpCvToEdge@12")
LBOP_LOAD(OpCvToOutline, "_OpCvToOutline@12")
LBOP_LOAD(OpCvDenoise, "_OpCvDenoise@12")
LBOP_LOAD(OpCvEqualize, "_OpCvEqualize@12")
LBOP_LOAD(OpCvCLAHE, "_OpCvCLAHE@24")
LBOP_LOAD(OpCvBlur, "_OpCvBlur@20")
LBOP_LOAD(OpCvSharpen, "_OpCvSharpen@20")
LBOP_LOAD(OpCvCropValid, "_OpCvCropValid@12")
LBOP_LOAD(OpCvConnectedComponents, "_OpCvConnectedComponents@16")
LBOP_LOAD(OpCvFindContours, "_OpCvFindContours@16")
LBOP_LOAD(OpCvPreprocessPipeline, "_OpCvPreprocessPipeline@16")
LBOP_LOAD(OpCvCrop, "_OpCvCrop@28")
LBOP_LOAD(OpCvResize, "_OpCvResize@20")
LBOP_LOAD(OpCvThreshold, "_OpCvThreshold@32")
LBOP_LOAD(OpCvInRange, "_OpCvInRange@24")
LBOP_LOAD(OpCvMorphology, "_OpCvMorphology@24")
LBOP_LOAD(OpCvThin, "_OpCvThin@16")
LBOP_LOAD(OpCvMatchTemplate, "_OpCvMatchTemplate@48")
LBOP_LOAD(OpCvMatchTemplateScale, "_OpCvMatchTemplateScale@44")
LBOP_LOAD(OpCvMatchAnyTemplate, "_OpCvMatchAnyTemplate@48")
LBOP_LOAD(OpCvMatchAllTemplates, "_OpCvMatchAllTemplates@48")
LBOP_LOAD(OpCvFeatureMatchTemplate, "_OpCvFeatureMatchTemplate@32")
LBOP_LOAD(OpCvEdgeMatchTemplate, "_OpCvEdgeMatchTemplate@32")
LBOP_LOAD(OpCvShapeMatchTemplate, "_OpCvShapeMatchTemplate@32")
LBOP_LOAD(OpSetOcrEngine, "_OpSetOcrEngine@16")
LBOP_LOAD(OpSetYoloEngine, "_OpSetYoloEngine@16")
LBOP_LOAD(OpYoloDetect, "_OpYoloDetect@36")
LBOP_LOAD(OpYoloDetectFromFile, "_OpYoloDetectFromFile@24")
LBOP_LOAD(OpSetDict, "_OpSetDict@12")
LBOP_LOAD(OpGetDict, "_OpGetDict@12")
LBOP_LOAD(OpSetMemDict, "_OpSetMemDict@16")
LBOP_LOAD(OpUseDict, "_OpUseDict@8")
LBOP_LOAD(OpAddDict, "_OpAddDict@12")
LBOP_LOAD(OpSaveDict, "_OpSaveDict@12")
LBOP_LOAD(OpClearDict, "_OpClearDict@8")
LBOP_LOAD(OpGetDictCount, "_OpGetDictCount@8")
LBOP_LOAD(OpGetNowDict, "_OpGetNowDict@4")
LBOP_LOAD(OpSetBinaryPreprocess, "_OpSetBinaryPreprocess@20")
LBOP_LOAD(OpGetBinaryPreprocess, "_OpGetBinaryPreprocess@20")
LBOP_LOAD(OpFetchWord, "_OpFetchWord@28")
LBOP_LOAD(OpFetchWordEx, "_OpFetchWordEx@36")
LBOP_LOAD(OpExtractWordRects, "_OpExtractWordRects@36")
LBOP_LOAD(OpExtractWordRectsEx, "_OpExtractWordRectsEx@44")
LBOP_LOAD(OpFetchWords, "_OpFetchWords@40")
LBOP_LOAD(OpFetchWordsEx, "_OpFetchWordsEx@48")
LBOP_LOAD(OpFetchWordsByRects, "_OpFetchWordsByRects@40")
LBOP_LOAD(OpGetBinaryPreview, "_OpGetBinaryPreview@36")
LBOP_LOAD(OpGetWordPreview, "_OpGetWordPreview@12")
LBOP_LOAD(OpCheckWordDict, "_OpCheckWordDict@12")
LBOP_LOAD(OpNormalizeWordDict, "_OpNormalizeWordDict@12")
LBOP_LOAD(OpRenameWordDict, "_OpRenameWordDict@16")
LBOP_LOAD(OpGetWordsNoDict, "_OpGetWordsNoDict@24")
LBOP_LOAD(OpGetWordResultCount, "_OpGetWordResultCount@8")
LBOP_LOAD(OpGetWordResultPos, "_OpGetWordResultPos@20")
LBOP_LOAD(OpGetWordResultStr, "_OpGetWordResultStr@12")
LBOP_LOAD(OpOcr, "_OpOcr@32")
LBOP_LOAD(OpOcrEx, "_OpOcrEx@32")
LBOP_LOAD(OpFindStr, "_OpFindStr@44")
LBOP_LOAD(OpFindStrEx, "_OpFindStrEx@36")
LBOP_LOAD(OpOcrAuto, "_OpOcrAuto@28")
LBOP_LOAD(OpOcrFromFile, "_OpOcrFromFile@20")
LBOP_LOAD(OpOcrAutoFromFile, "_OpOcrAutoFromFile@16")
LBOP_LOAD(OpFindLine, "_OpFindLine@32")
LBOP_LOAD(OpWriteData, "_OpWriteData@20")
LBOP_LOAD(OpReadData, "_OpReadData@16")
LBOP_LOAD(OpReadInt, "_OpReadInt@20")
LBOP_LOAD(OpWriteInt, "_OpWriteInt@24")
LBOP_LOAD(OpReadFloat, "_OpReadFloat@16")
LBOP_LOAD(OpWriteFloat, "_OpWriteFloat@16")
LBOP_LOAD(OpReadDouble, "_OpReadDouble@16")
LBOP_LOAD(OpWriteDouble, "_OpWriteDouble@20")
LBOP_LOAD(OpReadString, "_OpReadString@20")
LBOP_LOAD(OpWriteString, "_OpWriteString@20")
#undef LBOP_LOAD
    std::wstring missing;
#define WIDEN2(x) L##x
#define WIDEN(x) WIDEN2(x)
#define LBOP_CHECK(fn) if (!p_##fn) { if (!missing.empty()) missing += L", "; missing += WIDEN(#fn); }
LBOP_CHECK(OpCreate)
LBOP_CHECK(OpDestroy)
LBOP_CHECK(OpVer)
LBOP_CHECK(OpSetPath)
LBOP_CHECK(OpGetPath)
LBOP_CHECK(OpGetBasePath)
LBOP_CHECK(OpGetID)
LBOP_CHECK(OpGetLastError)
LBOP_CHECK(OpSetShowErrorMsg)
LBOP_CHECK(OpSleep)
LBOP_CHECK(OpInjectDll)
LBOP_CHECK(OpEnablePicCache)
LBOP_CHECK(OpCapturePre)
LBOP_CHECK(OpSetScreenDataMode)
LBOP_CHECK(OpAStarFindPath)
LBOP_CHECK(OpFindNearestPos)
LBOP_CHECK(OpEnumWindow)
LBOP_CHECK(OpEnumWindowByProcess)
LBOP_CHECK(OpEnumProcess)
LBOP_CHECK(OpClientToScreen)
LBOP_CHECK(OpFindWindow)
LBOP_CHECK(OpFindWindowByProcess)
LBOP_CHECK(OpFindWindowByProcessId)
LBOP_CHECK(OpFindWindowEx)
LBOP_CHECK(OpGetClientRect)
LBOP_CHECK(OpGetClientSize)
LBOP_CHECK(OpGetForegroundFocus)
LBOP_CHECK(OpGetForegroundWindow)
LBOP_CHECK(OpGetMousePointWindow)
LBOP_CHECK(OpGetPointWindow)
LBOP_CHECK(OpGetProcessInfo)
LBOP_CHECK(OpGetSpecialWindow)
LBOP_CHECK(OpGetWindow)
LBOP_CHECK(OpGetWindowClass)
LBOP_CHECK(OpGetWindowProcessId)
LBOP_CHECK(OpGetWindowProcessPath)
LBOP_CHECK(OpGetWindowRect)
LBOP_CHECK(OpGetWindowState)
LBOP_CHECK(OpGetWindowTitle)
LBOP_CHECK(OpMoveWindow)
LBOP_CHECK(OpScreenToClient)
LBOP_CHECK(OpSendPaste)
LBOP_CHECK(OpSetClientSize)
LBOP_CHECK(OpSetWindowState)
LBOP_CHECK(OpSetWindowSize)
LBOP_CHECK(OpLayoutWindows)
LBOP_CHECK(OpSetWindowText)
LBOP_CHECK(OpSetWindowTransparent)
LBOP_CHECK(OpSendString)
LBOP_CHECK(OpSendStringIme)
LBOP_CHECK(OpRunApp)
LBOP_CHECK(OpWinExec)
LBOP_CHECK(OpGetCmdStr)
LBOP_CHECK(OpSetClipboard)
LBOP_CHECK(OpGetClipboard)
LBOP_CHECK(OpDelay)
LBOP_CHECK(OpDelays)
LBOP_CHECK(OpBindWindow)
LBOP_CHECK(OpBindWindowEx)
LBOP_CHECK(OpUnBindWindow)
LBOP_CHECK(OpLockInput)
LBOP_CHECK(OpGetBindWindow)
LBOP_CHECK(OpIsBind)
LBOP_CHECK(OpGetCursorPos)
LBOP_CHECK(OpGetCursorShape)
LBOP_CHECK(OpMoveR)
LBOP_CHECK(OpMoveTo)
LBOP_CHECK(OpMoveToEx)
LBOP_CHECK(OpMoveToSmooth)
LBOP_CHECK(OpMoveToExSmooth)
LBOP_CHECK(OpMovePath)
LBOP_CHECK(OpDragPath)
LBOP_CHECK(OpSetMouseTrajectory)
LBOP_CHECK(OpLeftClick)
LBOP_CHECK(OpLeftDoubleClick)
LBOP_CHECK(OpLeftDown)
LBOP_CHECK(OpLeftUp)
LBOP_CHECK(OpMiddleClick)
LBOP_CHECK(OpMiddleDoubleClick)
LBOP_CHECK(OpMiddleDown)
LBOP_CHECK(OpMiddleUp)
LBOP_CHECK(OpRightClick)
LBOP_CHECK(OpRightDoubleClick)
LBOP_CHECK(OpRightDown)
LBOP_CHECK(OpRightUp)
LBOP_CHECK(OpXButton1Click)
LBOP_CHECK(OpXButton1DoubleClick)
LBOP_CHECK(OpXButton1Down)
LBOP_CHECK(OpXButton1Up)
LBOP_CHECK(OpXButton2Click)
LBOP_CHECK(OpXButton2DoubleClick)
LBOP_CHECK(OpXButton2Down)
LBOP_CHECK(OpXButton2Up)
LBOP_CHECK(OpWheel)
LBOP_CHECK(OpHWheel)
LBOP_CHECK(OpWheelDown)
LBOP_CHECK(OpWheelUp)
LBOP_CHECK(OpSetMouseDelay)
LBOP_CHECK(OpGetKeyState)
LBOP_CHECK(OpKeyDown)
LBOP_CHECK(OpKeyDownChar)
LBOP_CHECK(OpKeyUp)
LBOP_CHECK(OpKeyUpChar)
LBOP_CHECK(OpWaitKey)
LBOP_CHECK(OpKeyPress)
LBOP_CHECK(OpKeyPressChar)
LBOP_CHECK(OpSetKeypadDelay)
LBOP_CHECK(OpKeyPressStr)
LBOP_CHECK(OpCapture)
LBOP_CHECK(OpCmpColor)
LBOP_CHECK(OpFindColor)
LBOP_CHECK(OpFindColorEx)
LBOP_CHECK(OpFindMultiColor)
LBOP_CHECK(OpFindMultiColorEx)
LBOP_CHECK(OpFindPic)
LBOP_CHECK(OpFindPicEx)
LBOP_CHECK(OpFindPicExS)
LBOP_CHECK(OpFindColorBlock)
LBOP_CHECK(OpFindColorBlockEx)
LBOP_CHECK(OpGetColor)
LBOP_CHECK(OpGetColorNum)
LBOP_CHECK(OpSetDisplayInput)
LBOP_CHECK(OpLoadPic)
LBOP_CHECK(OpFreePic)
LBOP_CHECK(OpLoadMemPic)
LBOP_CHECK(OpGetPicSize)
LBOP_CHECK(OpGetScreenData)
LBOP_CHECK(OpGetScreenDataBmp)
LBOP_CHECK(OpGetScreenFrameInfo)
LBOP_CHECK(OpMatchPicName)
LBOP_CHECK(OpCvLoadTemplate)
LBOP_CHECK(OpCvLoadMaskedTemplate)
LBOP_CHECK(OpCvRemoveTemplate)
LBOP_CHECK(OpCvRemoveAllTemplates)
LBOP_CHECK(OpCvHasTemplate)
LBOP_CHECK(OpCvGetTemplateCount)
LBOP_CHECK(OpCvGetAllTemplateNames)
LBOP_CHECK(OpCvGetOpenCvVersion)
LBOP_CHECK(OpCvLoadTemplateList)
LBOP_CHECK(OpCvToGray)
LBOP_CHECK(OpCvToBinary)
LBOP_CHECK(OpCvToEdge)
LBOP_CHECK(OpCvToOutline)
LBOP_CHECK(OpCvDenoise)
LBOP_CHECK(OpCvEqualize)
LBOP_CHECK(OpCvCLAHE)
LBOP_CHECK(OpCvBlur)
LBOP_CHECK(OpCvSharpen)
LBOP_CHECK(OpCvCropValid)
LBOP_CHECK(OpCvConnectedComponents)
LBOP_CHECK(OpCvFindContours)
LBOP_CHECK(OpCvPreprocessPipeline)
LBOP_CHECK(OpCvCrop)
LBOP_CHECK(OpCvResize)
LBOP_CHECK(OpCvThreshold)
LBOP_CHECK(OpCvInRange)
LBOP_CHECK(OpCvMorphology)
LBOP_CHECK(OpCvThin)
LBOP_CHECK(OpCvMatchTemplate)
LBOP_CHECK(OpCvMatchTemplateScale)
LBOP_CHECK(OpCvMatchAnyTemplate)
LBOP_CHECK(OpCvMatchAllTemplates)
LBOP_CHECK(OpCvFeatureMatchTemplate)
LBOP_CHECK(OpCvEdgeMatchTemplate)
LBOP_CHECK(OpCvShapeMatchTemplate)
LBOP_CHECK(OpSetOcrEngine)
LBOP_CHECK(OpSetYoloEngine)
LBOP_CHECK(OpYoloDetect)
LBOP_CHECK(OpYoloDetectFromFile)
LBOP_CHECK(OpSetDict)
LBOP_CHECK(OpGetDict)
LBOP_CHECK(OpSetMemDict)
LBOP_CHECK(OpUseDict)
LBOP_CHECK(OpAddDict)
LBOP_CHECK(OpSaveDict)
LBOP_CHECK(OpClearDict)
LBOP_CHECK(OpGetDictCount)
LBOP_CHECK(OpGetNowDict)
LBOP_CHECK(OpSetBinaryPreprocess)
LBOP_CHECK(OpGetBinaryPreprocess)
LBOP_CHECK(OpFetchWord)
LBOP_CHECK(OpFetchWordEx)
LBOP_CHECK(OpExtractWordRects)
LBOP_CHECK(OpExtractWordRectsEx)
LBOP_CHECK(OpFetchWords)
LBOP_CHECK(OpFetchWordsEx)
LBOP_CHECK(OpFetchWordsByRects)
LBOP_CHECK(OpGetBinaryPreview)
LBOP_CHECK(OpGetWordPreview)
LBOP_CHECK(OpCheckWordDict)
LBOP_CHECK(OpNormalizeWordDict)
LBOP_CHECK(OpRenameWordDict)
LBOP_CHECK(OpGetWordsNoDict)
LBOP_CHECK(OpGetWordResultCount)
LBOP_CHECK(OpGetWordResultPos)
LBOP_CHECK(OpGetWordResultStr)
LBOP_CHECK(OpOcr)
LBOP_CHECK(OpOcrEx)
LBOP_CHECK(OpFindStr)
LBOP_CHECK(OpFindStrEx)
LBOP_CHECK(OpOcrAuto)
LBOP_CHECK(OpOcrFromFile)
LBOP_CHECK(OpOcrAutoFromFile)
LBOP_CHECK(OpFindLine)
LBOP_CHECK(OpWriteData)
LBOP_CHECK(OpReadData)
LBOP_CHECK(OpReadInt)
LBOP_CHECK(OpWriteInt)
LBOP_CHECK(OpReadFloat)
LBOP_CHECK(OpWriteFloat)
LBOP_CHECK(OpReadDouble)
LBOP_CHECK(OpWriteDouble)
LBOP_CHECK(OpReadString)
LBOP_CHECK(OpWriteString)
#undef LBOP_CHECK
#undef WIDEN
#undef WIDEN2
    if (!missing.empty()) {
        g_loadError = L"随包运行库版本不匹配，缺少导出：" + missing + L"。请重新安装 LingBuilder 或反馈客服。";
        return false;
    }
    return true;
}

} // namespace impl


inline bool ready() {
    std::call_once(g_loadOnce, [] { g_ready = impl::loadAll(); });
    if (!g_ready) {
        setError(g_loadError.empty() ? std::wstring(L"op 运行库不可用。") : g_loadError);
        return false;
    }
    return true;
}

} // namespace lbop

// ============================================================================
// 中文命令包装层（214 条 = 上游 213 条一一映射 + 模块级 后台_取错误；函数名 = 命令名，签名 = binding ABI）
// ============================================================================

// ---------------------------- 基础与生命周期（15 = 上游 14 + 后台_取错误） ----------------------------
inline long long 后台_创建() {
    if (!lbop::ready()) return 0;
    lbop::clearError();
    return reinterpret_cast<long long>(lbop::p_OpCreate());
}

inline std::wstring 后台_取错误() {
    return lbop::g_lastError;
}

inline void 后台_销毁(long long 句柄) {
    if (句柄 == 0 || !lbop::ready()) return;
    lbop::p_OpDestroy(reinterpret_cast<void*>(static_cast<intptr_t>(句柄)));
}

inline std::wstring 后台_取版本() {
    if (!lbop::ready()) return std::wstring();
    return lbop::toW(lbop::p_OpVer());
}

inline bool 后台_置全局路径(long long 句柄, const wchar_t* 路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetPath(h, 路径) == 1;
}

inline std::wstring 后台_取全局路径(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetPath(h));
}

inline std::wstring 后台_取基础路径(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetBasePath(h));
}

inline int 后台_取引擎编号(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetID(h);
}

inline int 后台_取错误码(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetLastError(h);
}

inline bool 后台_置错误弹窗(long long 句柄, int 显示方式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetShowErrorMsg(h, 显示方式) == 1;
}

inline bool 后台_休眠(long long 句柄, int 毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSleep(h, 毫秒) == 1;
}

inline bool 后台_注入DLL(long long 句柄, const wchar_t* 进程名, const wchar_t* DLL路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpInjectDll(h, 进程名, DLL路径) == 1;
}

inline bool 后台_置图片缓存(long long 句柄, int 启用) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpEnablePicCache(h, 启用) == 1;
}

inline bool 后台_截屏预处理(long long 句柄, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCapturePre(h, 文件名) == 1;
}

inline bool 后台_置屏幕数据模式(long long 句柄, int 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetScreenDataMode(h, 模式) == 1;
}

// ---------------------------- 算法（2） ----------------------------
inline std::wstring 后台_A星寻路(long long 句柄, int 地图宽度, int 地图高度, const wchar_t* 禁用点,
                                 int 起点横坐标, int 起点纵坐标, int 终点横坐标, int 终点纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpAStarFindPath(h, 地图宽度, 地图高度, 禁用点, 起点横坐标, 起点纵坐标, 终点横坐标, 终点纵坐标));
}

inline std::wstring 后台_取最近位置(long long 句柄, const wchar_t* 位置集, int 类型, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindNearestPos(h, 位置集, 类型, 横坐标, 纵坐标));
}

// ---------------------------- 窗口与进程（41） ----------------------------
inline std::wstring 后台_枚举窗口(long long 句柄, long long 父窗口, const wchar_t* 标题, const wchar_t* 类名, int 过滤) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpEnumWindow(h, static_cast<intptr_t>(父窗口), 标题, 类名, 过滤));
}

inline std::wstring 后台_按进程枚举窗口(long long 句柄, const wchar_t* 进程名, const wchar_t* 标题, const wchar_t* 类名, int 过滤) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpEnumWindowByProcess(h, 进程名, 标题, 类名, 过滤));
}

inline std::wstring 后台_枚举进程(long long 句柄, const wchar_t* 进程名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpEnumProcess(h, 进程名));
}

inline bool 后台_客户区转屏幕(long long 句柄, long long 窗口句柄, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpClientToScreen(h, static_cast<intptr_t>(窗口句柄), 横坐标, 纵坐标) == 1;
}

inline long long 后台_找窗口(long long 句柄, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindow(h, 类名, 标题));
}

inline long long 后台_按进程找窗口(long long 句柄, const wchar_t* 进程名, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindowByProcess(h, 进程名, 类名, 标题));
}

inline long long 后台_按进程ID找窗口(long long 句柄, int 进程ID, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindowByProcessId(h, 进程ID, 类名, 标题));
}

inline long long 后台_找子窗口(long long 句柄, long long 父窗口, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindowEx(h, static_cast<intptr_t>(父窗口), 类名, 标题));
}

inline bool 后台_取窗口客户区(long long 句柄, long long 窗口句柄, int* 左, int* 上, int* 右, int* 下) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetClientRect(h, static_cast<intptr_t>(窗口句柄), 左, 上, 右, 下) == 1;
}

inline bool 后台_取客户区尺寸(long long 句柄, long long 窗口句柄, int* 宽度, int* 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetClientSize(h, static_cast<intptr_t>(窗口句柄), 宽度, 高度) == 1;
}

inline long long 后台_取前台焦点(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetForegroundFocus(h));
}

inline long long 后台_取前台窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetForegroundWindow(h));
}

inline long long 后台_取鼠标所在窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetMousePointWindow(h));
}

inline long long 后台_取坐标处窗口(long long 句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetPointWindow(h, 横坐标, 纵坐标));
}

inline std::wstring 后台_取进程信息(long long 句柄, int 进程ID) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetProcessInfo(h, 进程ID));
}

inline long long 后台_取特殊窗口(long long 句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetSpecialWindow(h, 标志));
}

inline long long 后台_取关联窗口(long long 句柄, long long 窗口句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetWindow(h, static_cast<intptr_t>(窗口句柄), 标志));
}

inline std::wstring 后台_取窗口类名(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWindowClass(h, static_cast<intptr_t>(窗口句柄)));
}

inline int 后台_取窗口进程ID(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetWindowProcessId(h, static_cast<intptr_t>(窗口句柄));
}

inline std::wstring 后台_取窗口进程路径(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWindowProcessPath(h, static_cast<intptr_t>(窗口句柄)));
}

inline bool 后台_取窗口矩形(long long 句柄, long long 窗口句柄, int* 左, int* 上, int* 右, int* 下) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetWindowRect(h, static_cast<intptr_t>(窗口句柄), 左, 上, 右, 下) == 1;
}

inline bool 后台_取窗口状态(long long 句柄, long long 窗口句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetWindowState(h, static_cast<intptr_t>(窗口句柄), 标志) == 1;
}

inline std::wstring 后台_取窗口标题(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWindowTitle(h, static_cast<intptr_t>(窗口句柄)));
}

inline bool 后台_移动窗口(long long 句柄, long long 窗口句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveWindow(h, static_cast<intptr_t>(窗口句柄), 横坐标, 纵坐标) == 1;
}

inline bool 后台_屏幕转客户区(long long 句柄, long long 窗口句柄, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpScreenToClient(h, static_cast<intptr_t>(窗口句柄), 横坐标, 纵坐标) == 1;
}

inline bool 后台_发送粘贴(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSendPaste(h, static_cast<intptr_t>(窗口句柄)) == 1;
}

inline bool 后台_置客户区尺寸(long long 句柄, long long 窗口句柄, int 宽度, int 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetClientSize(h, static_cast<intptr_t>(窗口句柄), 宽度, 高度) == 1;
}

inline bool 后台_置窗口状态(long long 句柄, long long 窗口句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowState(h, static_cast<intptr_t>(窗口句柄), 标志) == 1;
}

inline bool 后台_置窗口尺寸(long long 句柄, long long 窗口句柄, int 宽度, int 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowSize(h, static_cast<intptr_t>(窗口句柄), 宽度, 高度) == 1;
}

inline bool 后台_排列窗口(long long 句柄, const wchar_t* 窗口句柄集, int 布局方式, int 列数, int 起始横坐标, int 起始纵坐标,
                          int 间距横, int 间距纵, int 尺寸模式, int 窗口宽度, int 窗口高度, int 锚点模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLayoutWindows(h, 窗口句柄集, 布局方式, 列数, 起始横坐标, 起始纵坐标, 间距横, 间距纵,
                                   尺寸模式, 窗口宽度, 窗口高度, 锚点模式) == 1;
}

inline bool 后台_置窗口标题(long long 句柄, long long 窗口句柄, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowText(h, static_cast<intptr_t>(窗口句柄), 标题) == 1;
}

inline bool 后台_置窗口透明(long long 句柄, long long 窗口句柄, int 透明度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowTransparent(h, static_cast<intptr_t>(窗口句柄), 透明度) == 1;
}

inline bool 后台_发文本(long long 句柄, long long 窗口句柄, const wchar_t* 文本) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSendString(h, static_cast<intptr_t>(窗口句柄), 文本) == 1;
}

inline bool 后台_发文本输入法(long long 句柄, long long 窗口句柄, const wchar_t* 文本) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSendStringIme(h, static_cast<intptr_t>(窗口句柄), 文本) == 1;
}

inline bool 后台_运行程序(long long 句柄, const wchar_t* 命令行, int 显示模式, long long* 进程ID) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    uint32_t pid = 0;
    const bool ok = lbop::p_OpRunApp(h, 命令行, 显示模式, &pid) == 1;
    if (进程ID) *进程ID = static_cast<long long>(pid);
    return ok;
}

inline bool 后台_执行命令(long long 句柄, const wchar_t* 命令行, int 显示方式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWinExec(h, 命令行, 显示方式) == 1;
}

inline std::wstring 后台_取命令输出(long long 句柄, const wchar_t* 命令, int 超时毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetCmdStr(h, 命令, 超时毫秒));
}

inline bool 后台_置剪贴板(long long 句柄, const wchar_t* 文本) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetClipboard(h, 文本) == 1;
}

inline std::wstring 后台_取剪贴板(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetClipboard(h));
}

inline bool 后台_延迟(long long 句柄, int 毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpDelay(h, 毫秒) == 1;
}

inline bool 后台_随机延迟(long long 句柄, int 最小毫秒, int 最大毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpDelays(h, 最小毫秒, 最大毫秒) == 1;
}

// ---------------------------- 后台绑定（6） ----------------------------
inline bool 后台_绑定窗口(long long 句柄, long long 窗口句柄, const wchar_t* 显示后端, const wchar_t* 鼠标模式,
                          const wchar_t* 键盘模式, int 绑定模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpBindWindow(h, static_cast<intptr_t>(窗口句柄), 显示后端, 鼠标模式, 键盘模式, 绑定模式) == 1;
}

inline bool 后台_绑定窗口扩展(long long 句柄, long long 显示窗口句柄, long long 输入窗口句柄, const wchar_t* 显示后端,
                              const wchar_t* 鼠标模式, const wchar_t* 键盘模式, int 绑定模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpBindWindowEx(h, static_cast<intptr_t>(显示窗口句柄), static_cast<intptr_t>(输入窗口句柄),
                                  显示后端, 鼠标模式, 键盘模式, 绑定模式) == 1;
}

inline bool 后台_解绑窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpUnBindWindow(h) == 1;
}

inline bool 后台_锁定输入(long long 句柄, int 锁定方式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLockInput(h, 锁定方式) == 1;
}

inline long long 后台_取绑定窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetBindWindow(h));
}

inline bool 后台_是否已绑定(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpIsBind(h) == 1;
}

// ---------------------------- 鼠标（35） ----------------------------
inline bool 后台_取鼠标位置(long long 句柄, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetCursorPos(h, 横坐标, 纵坐标) == 1;
}

inline std::wstring 后台_取鼠标形状(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetCursorShape(h));
}

inline bool 后台_相对移动(long long 句柄, int 横偏移, int 纵偏移) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveR(h, 横偏移, 纵偏移) == 1;
}

inline bool 后台_移动到(long long 句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveTo(h, 横坐标, 纵坐标) == 1;
}

inline std::wstring 后台_区域随机移动(long long 句柄, int 横坐标, int 纵坐标, int 宽度, int 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpMoveToEx(h, 横坐标, 纵坐标, 宽度, 高度));
}

inline bool 后台_平滑移动(long long 句柄, int 横坐标, int 纵坐标, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveToSmooth(h, 横坐标, 纵坐标, 时长毫秒) == 1;
}

inline std::wstring 后台_区域随机平滑移动(long long 句柄, int 横坐标, int 纵坐标, int 宽度, int 高度, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpMoveToExSmooth(h, 横坐标, 纵坐标, 宽度, 高度, 时长毫秒));
}

inline bool 后台_轨迹移动(long long 句柄, const wchar_t* 路径点, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMovePath(h, 路径点, 时长毫秒) == 1;
}

inline bool 后台_拖拽路径(long long 句柄, const wchar_t* 路径点, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpDragPath(h, 路径点, 时长毫秒) == 1;
}

inline bool 后台_置鼠标轨迹(long long 句柄, int 模式, int 最小时长, int 最大时长, int 抖动, int 起始延迟, int 结束延迟) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetMouseTrajectory(h, 模式, 最小时长, 最大时长, 抖动, 起始延迟, 结束延迟) == 1;
}

inline bool 后台_左键单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftClick(h) == 1;
}
inline bool 后台_左键双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftDoubleClick(h) == 1;
}
inline bool 后台_左键按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftDown(h) == 1;
}
inline bool 后台_左键弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftUp(h) == 1;
}
inline bool 后台_中键单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleClick(h) == 1;
}
inline bool 后台_中键双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleDoubleClick(h) == 1;
}
inline bool 后台_中键按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleDown(h) == 1;
}
inline bool 后台_中键弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleUp(h) == 1;
}
inline bool 后台_右键单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightClick(h) == 1;
}
inline bool 后台_右键双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightDoubleClick(h) == 1;
}
inline bool 后台_右键按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightDown(h) == 1;
}
inline bool 后台_右键弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightUp(h) == 1;
}
inline bool 后台_侧键1单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1Click(h) == 1;
}
inline bool 后台_侧键1双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1DoubleClick(h) == 1;
}
inline bool 后台_侧键1按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1Down(h) == 1;
}
inline bool 后台_侧键1弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1Up(h) == 1;
}
inline bool 后台_侧键2单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2Click(h) == 1;
}
inline bool 后台_侧键2双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2DoubleClick(h) == 1;
}
inline bool 后台_侧键2按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2Down(h) == 1;
}
inline bool 后台_侧键2弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2Up(h) == 1;
}

inline bool 后台_滚轮滚动(long long 句柄, int 增量) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWheel(h, 增量) == 1;
}

inline bool 后台_水平滚轮滚动(long long 句柄, int 增量) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpHWheel(h, 增量) == 1;
}

inline bool 后台_滚轮向下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWheelDown(h) == 1;
}

inline bool 后台_滚轮向上(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWheelUp(h) == 1;
}

inline bool 后台_置鼠标延迟(long long 句柄, const wchar_t* 类型, int 延迟毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetMouseDelay(h, 类型, 延迟毫秒) == 1;
}

// ---------------------------- 键盘（10） ----------------------------
inline bool 后台_取按键状态(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetKeyState(h, 虚拟键码) == 1;
}

inline bool 后台_按下按键(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyDown(h, 虚拟键码) == 1;
}

inline bool 后台_按字符按下(long long 句柄, const wchar_t* 字符) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyDownChar(h, 字符) == 1;
}

inline bool 后台_弹起按键(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyUp(h, 虚拟键码) == 1;
}

inline bool 后台_按字符弹起(long long 句柄, const wchar_t* 字符) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyUpChar(h, 字符) == 1;
}

inline bool 后台_等待按键(long long 句柄, int 虚拟键码, int 超时毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWaitKey(h, 虚拟键码, 超时毫秒) == 1;
}

inline bool 后台_敲击按键(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyPress(h, 虚拟键码) == 1;
}

inline bool 后台_按字符敲击(long long 句柄, const wchar_t* 字符) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyPressChar(h, 字符) == 1;
}

inline bool 后台_置键盘延迟(long long 句柄, const wchar_t* 类型, int 延迟毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetKeypadDelay(h, 类型, 延迟毫秒) == 1;
}

inline bool 后台_连发按键串(long long 句柄, const wchar_t* 按键串, int 间隔毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyPressStr(h, 按键串, 间隔毫秒) == 1;
}

// ---------------------------- 图色（22） ----------------------------
inline bool 后台_截图(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCapture(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 文件名) == 1;
}

inline bool 后台_比色(long long 句柄, int 横坐标, int 纵坐标, const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCmpColor(h, 横坐标, 纵坐标, 颜色, 相似度) == 1;
}

inline bool 后台_找色(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                      const wchar_t* 颜色, double 相似度, int 方向, int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    // 上游返回命中颜色序号（首个=0，失败 -1），与找图的模板编号同语义；本层翻译为 真/假。
    return lbop::p_OpFindColor(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 方向,
                               结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_找色全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 颜色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindColorEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 方向));
}

inline bool 后台_多点找色(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                          const wchar_t* 首色, const wchar_t* 偏移色, double 相似度, int 方向,
                          int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFindMultiColor(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 首色, 偏移色, 相似度, 方向,
                                    结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_多点找色全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 首色, const wchar_t* 偏移色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindMultiColorEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 首色, 偏移色, 相似度, 方向));
}

inline bool 后台_找图(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                      const wchar_t* 图片集, const wchar_t* 偏差色, double 相似度, int 方向,
                      int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    // 上游返回命中模板编号（首个=0），失败 -1；本层翻译为 真/假。
    return lbop::p_OpFindPic(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 图片集, 偏差色, 相似度, 方向,
                             结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_找图全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 图片集, const wchar_t* 偏差色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindPicEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 图片集, 偏差色, 相似度, 方向));
}

inline std::wstring 后台_找图全部编号(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 图片集, const wchar_t* 偏差色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindPicExS(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 图片集, 偏差色, 相似度, 方向));
}

inline bool 后台_色块找色(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                          const wchar_t* 颜色, double 相似度, int 最少像素数, int 最小高度, int 最小宽度,
                          int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFindColorBlock(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度,
                                    最少像素数, 最小高度, 最小宽度, 结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_色块找色全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 颜色, double 相似度, int 最少像素数, int 最小高度, int 最小宽度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindColorBlockEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度,
                                                最少像素数, 最小高度, 最小宽度));
}

inline std::wstring 后台_取颜色(long long 句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetColor(h, 横坐标, 纵坐标));
}

inline int 后台_颜色计数(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                         const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetColorNum(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度);
}

inline bool 后台_置显示输入模式(long long 句柄, const wchar_t* 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetDisplayInput(h, 模式) == 1;
}

inline bool 后台_加载图片(long long 句柄, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLoadPic(h, 文件名) == 1;
}

inline bool 后台_释放图片(long long 句柄, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFreePic(h, 文件名) == 1;
}

inline bool 后台_加载内存图片(long long 句柄, const wchar_t* 名称, const std::vector<unsigned char>& 图片数据) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLoadMemPic(h, 名称, const_cast<void*>(static_cast<const void*>(图片数据.data())),
                                static_cast<int>(图片数据.size())) == 1;
}

inline bool 后台_取图片尺寸(long long 句柄, const wchar_t* 图片名, int* 宽度, int* 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetPicSize(h, 图片名, 宽度, 高度) == 1;
}

inline long long 后台_取屏幕数据(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                 int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetScreenData(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 成功标记));
}

inline long long 后台_取屏幕数据BMP(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    int* 数据大小, int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetScreenDataBmp(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标,
                                                             数据大小, 成功标记));
}

inline void 后台_取屏幕帧信息(long long 句柄, int* 帧号, int* 时间) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return;
    lbop::p_OpGetScreenFrameInfo(h, 帧号, 时间);
}

inline std::wstring 后台_匹配图片名(long long 句柄, const wchar_t* 图片名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpMatchPicName(h, 图片名));
}

// ---------------------------- OpenCV（35） ----------------------------
inline bool 后台_CV加载模板(long long 句柄, const wchar_t* 模板名, const wchar_t* 文件路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvLoadTemplate(h, 模板名, 文件路径) == 1;
}

inline bool 后台_CV加载掩码模板(long long 句柄, const wchar_t* 模板名, const wchar_t* 模板路径, const wchar_t* 掩码路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvLoadMaskedTemplate(h, 模板名, 模板路径, 掩码路径) == 1;
}

inline bool 后台_CV移除模板(long long 句柄, const wchar_t* 模板名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvRemoveTemplate(h, 模板名) == 1;
}

inline bool 后台_CV移除全部模板(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvRemoveAllTemplates(h) == 1;
}

inline bool 后台_CV存在模板(long long 句柄, const wchar_t* 模板名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvHasTemplate(h, 模板名) == 1;
}

inline int 后台_CV取模板数量(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpCvGetTemplateCount(h);
}

inline std::wstring 后台_CV取全部模板名(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvGetAllTemplateNames(h));
}

inline std::wstring 后台_CV取OpenCV版本(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvGetOpenCvVersion(h));
}

inline bool 后台_CV加载模板列表(long long 句柄, const wchar_t* 模板列表) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvLoadTemplateList(h, 模板列表) == 1;
}

inline bool 后台_CV转灰度(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToGray(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV转二值(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToBinary(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV转边缘(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToEdge(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV转轮廓(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToOutline(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV去噪(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvDenoise(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV直方图均衡(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvEqualize(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV限制对比度均衡(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, double 裁剪限制, int 网格尺寸) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvCLAHE(h, 源文件, 目标文件, 裁剪限制, 网格尺寸) == 1;
}

inline bool 后台_CV模糊(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 模式, int 核尺寸) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvBlur(h, 源文件, 目标文件, 模式, 核尺寸) == 1;
}

inline bool 后台_CV锐化(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, double 强度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvSharpen(h, 源文件, 目标文件, 强度) == 1;
}

inline bool 后台_CV裁有效区域(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvCropValid(h, 源文件, 目标文件) == 1;
}

inline std::wstring 后台_CV连通域分析(long long 句柄, const wchar_t* 源文件, double 最小面积) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvConnectedComponents(h, 源文件, 最小面积));
}

inline std::wstring 后台_CV找轮廓(long long 句柄, const wchar_t* 源文件, double 最小面积) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvFindContours(h, 源文件, 最小面积));
}

inline bool 后台_CV预处理管线(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 管线) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvPreprocessPipeline(h, 源文件, 目标文件, 管线) == 1;
}

inline bool 后台_CV裁剪(long long 句柄, const wchar_t* 源文件, int 横坐标, int 纵坐标, int 宽度, int 高度, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvCrop(h, 源文件, 横坐标, 纵坐标, 宽度, 高度, 目标文件) == 1;
}

inline bool 后台_CV缩放(long long 句柄, const wchar_t* 源文件, int 宽度, int 高度, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvResize(h, 源文件, 宽度, 高度, 目标文件) == 1;
}

inline bool 后台_CV阈值化(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, double 阈值, double 最大值, const wchar_t* 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvThreshold(h, 源文件, 目标文件, 阈值, 最大值, 模式) == 1;
}

inline bool 后台_CV通道范围(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 颜色空间, const wchar_t* 下界, const wchar_t* 上界) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvInRange(h, 源文件, 目标文件, 颜色空间, 下界, 上界) == 1;
}

inline bool 后台_CV形态学(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 模式, int 核尺寸, int 迭代次数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvMorphology(h, 源文件, 目标文件, 模式, 核尺寸, 迭代次数) == 1;
}

inline bool 后台_CV细化(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvThin(h, 源文件, 目标文件, 模式) == 1;
}

inline std::wstring 后台_CV模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                    const wchar_t* 模板名, double 阈值, int 方向, int 去重模式, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值,
                                               方向, 去重模式, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV缩放模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                        const wchar_t* 模板名, const wchar_t* 缩放集, double 阈值, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchTemplateScale(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 缩放集,
                                                    阈值, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV任一模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                        const wchar_t* 模板名集, double 阈值, int 方向, int 去重模式, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchAnyTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名集, 阈值,
                                                  方向, 去重模式, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV全部模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                        const wchar_t* 模板名集, double 阈值, int 方向, int 去重模式, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchAllTemplates(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名集, 阈值,
                                                   方向, 去重模式, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV特征点匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                      const wchar_t* 模板名, double 阈值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvFeatureMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值));
}

inline std::wstring 后台_CV边缘匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                    const wchar_t* 模板名, double 阈值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvEdgeMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值));
}

inline std::wstring 后台_CV形状匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                    const wchar_t* 模板名, double 阈值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvShapeMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值));
}

// ---------------------------- YOLO 检测（3） ----------------------------
inline bool 后台_置YOLO引擎(long long 句柄, const wchar_t* 引擎路径, const wchar_t* 服务DLL, const wchar_t* 启动参数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetYoloEngine(h, 引擎路径, 服务DLL, 启动参数) == 1;
}

inline std::wstring 后台_YOLO检测(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  double 置信度, double 交并比) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpYoloDetect(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 置信度, 交并比));
}

inline std::wstring 后台_YOLO检测文件(long long 句柄, const wchar_t* 文件名, double 置信度, double 交并比) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpYoloDetectFromFile(h, 文件名, 置信度, 交并比));
}

// ---------------------------- 点阵字库识字（35） ----------------------------
inline bool 后台_加载字库(long long 句柄, int 字库序号, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetDict(h, 字库序号, 文件名) == 1;
}

inline std::wstring 后台_取字库条目(long long 句柄, int 字库序号, int 字体索引) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetDict(h, 字库序号, 字体索引));
}

inline bool 后台_加载内存字库(long long 句柄, int 字库序号, const std::vector<unsigned char>& 字库数据) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetMemDict(h, 字库序号, const_cast<void*>(static_cast<const void*>(字库数据.data())),
                                static_cast<int>(字库数据.size())) == 1;
}

inline bool 后台_切换字库(long long 句柄, int 字库序号) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpUseDict(h, 字库序号) == 1;
}

inline bool 后台_追加字库(long long 句柄, int 字库序号, const wchar_t* 字库信息) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpAddDict(h, 字库序号, 字库信息) == 1;
}

inline bool 后台_保存字库(long long 句柄, int 字库序号, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSaveDict(h, 字库序号, 文件名) == 1;
}

inline bool 后台_清空字库(long long 句柄, int 字库序号) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpClearDict(h, 字库序号) == 1;
}

inline int 后台_取字库条数(long long 句柄, int 字库序号) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetDictCount(h, 字库序号);
}

inline int 后台_取当前字库序号(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetNowDict(h);
}

inline bool 后台_置二值化预处理(long long 句柄, int 模式, int 孤点阈值, int 最小连通面积, int 桥接间距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetBinaryPreprocess(h, 模式, 孤点阈值, 最小连通面积, 桥接间距) == 1;
}

inline bool 后台_取二值化预处理(long long 句柄, int* 模式, int* 孤点阈值, int* 最小连通面积, int* 桥接间距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetBinaryPreprocess(h, 模式, 孤点阈值, 最小连通面积, 桥接间距) == 1;
}

inline std::wstring 后台_取词(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                              const wchar_t* 颜色, const wchar_t* 词) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWord(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 词));
}

inline std::wstring 后台_取词相似(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 颜色, double 相似度, const wchar_t* 词) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWordEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词));
}

inline std::wstring 后台_提取词框(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 颜色, double 相似度, int 最小词高) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpExtractWordRects(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 最小词高));
}

inline std::wstring 后台_提取词框相似(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 颜色, double 相似度, int 最小词宽, int 最小词高, int 边距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpExtractWordRectsEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度,
                                                  最小词宽, 最小词高, 边距));
}

inline std::wstring 后台_取词组(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                const wchar_t* 颜色, double 相似度, const wchar_t* 词集, int 最小词高) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWords(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词集, 最小词高));
}

inline std::wstring 后台_取词组相似(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度, const wchar_t* 词集, int 最小词宽, int 最小词高, int 边距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWordsEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词集,
                                            最小词宽, 最小词高, 边距));
}

inline std::wstring 后台_按框取词组(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度, const wchar_t* 词集, const wchar_t* 矩形集) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWordsByRects(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词集, 矩形集));
}

inline std::wstring 后台_二值化预览(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度, int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetBinaryPreview(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 成功标记));
}

inline std::wstring 后台_单字预览(long long 句柄, const wchar_t* 字库信息, int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWordPreview(h, 字库信息, 成功标记));
}

inline std::wstring 后台_校验字库(long long 句柄, const wchar_t* 字库信息, int* 结果标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCheckWordDict(h, 字库信息, 结果标记));
}

inline std::wstring 后台_规范化字库(long long 句柄, const wchar_t* 字库信息, int* 结果标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpNormalizeWordDict(h, 字库信息, 结果标记));
}

inline std::wstring 后台_字库改名(long long 句柄, const wchar_t* 字库信息, const wchar_t* 新词, int* 结果标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpRenameWordDict(h, 字库信息, 新词, 结果标记));
}

inline std::wstring 后台_无字库取词(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWordsNoDict(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色));
}

inline int 后台_取词结果数量(long long 句柄, const wchar_t* 结果) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetWordResultCount(h, 结果);
}

inline bool 后台_取词结果坐标(long long 句柄, const wchar_t* 结果, int 索引, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetWordResultPos(h, 结果, 索引, 横坐标, 纵坐标) == 1;
}

inline std::wstring 后台_取词结果文本(long long 句柄, const wchar_t* 结果, int 索引) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWordResultStr(h, 结果, 索引));
}

inline std::wstring 后台_识字(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                              const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcr(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度));
}

inline std::wstring 后台_识字带坐标(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度));
}

inline bool 后台_找字(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                      const wchar_t* 字串集, const wchar_t* 颜色, double 相似度, int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFindStr(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 字串集, 颜色, 相似度,
                             结果横坐标, 结果纵坐标) == 1;
}

inline std::wstring 后台_找字全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 字串集, const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindStrEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 字串集, 颜色, 相似度));
}

inline std::wstring 后台_自动识字(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrAuto(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 相似度));
}

inline std::wstring 后台_文件识字(long long 句柄, const wchar_t* 文件名, const wchar_t* 颜色格式, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrFromFile(h, 文件名, 颜色格式, 相似度));
}

inline std::wstring 后台_文件自动识字(long long 句柄, const wchar_t* 文件名, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrAutoFromFile(h, 文件名, 相似度));
}

inline std::wstring 后台_找直线(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindLine(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度));
}

// ---------------------------- 内存读写（10） ----------------------------
inline bool 后台_写内存数据(long long 句柄, long long 窗口句柄, const wchar_t* 地址, const wchar_t* 十六进制数据, int 字节数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteData(h, static_cast<intptr_t>(窗口句柄), 地址, 十六进制数据, 字节数) == 1;
}

inline std::wstring 后台_读内存数据(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 字节数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpReadData(h, static_cast<intptr_t>(窗口句柄), 地址, 字节数));
}

inline bool 后台_读内存整数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 类型, long long* 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    int64_t value = 0;
    const bool ok = lbop::p_OpReadInt(h, static_cast<intptr_t>(窗口句柄), 地址, 类型, &value) == 1;
    if (数值) *数值 = static_cast<long long>(value);
    return ok;
}

inline bool 后台_写内存整数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 类型, long long 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteInt(h, static_cast<intptr_t>(窗口句柄), 地址, 类型, static_cast<int64_t>(数值)) == 1;
}

inline bool 后台_读内存单精度(long long 句柄, long long 窗口句柄, const wchar_t* 地址, float* 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpReadFloat(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline bool 后台_写内存单精度(long long 句柄, long long 窗口句柄, const wchar_t* 地址, float 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteFloat(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline bool 后台_读内存小数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, double* 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpReadDouble(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline bool 后台_写内存小数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, double 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteDouble(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline std::wstring 后台_读内存文本(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 编码, int 长度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpReadString(h, static_cast<intptr_t>(窗口句柄), 地址, 编码, 长度));
}

inline bool 后台_写内存文本(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 编码, const wchar_t* 内容) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteString(h, static_cast<intptr_t>(窗口句柄), 地址, 编码, 内容) == 1;
}

#endif // LB_OP_RUNTIME_INCLUDED
`;

/** 模块启用时返回运行时源码，未启用返回空串。 */
export function generateOpRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === OP_RUNTIME_MODULE_ID) ? OP_RUNTIME : '';
}
