cmake_minimum_required(VERSION 3.20)
project(LingBuilderFbroBridge LANGUAGES CXX)

if(NOT MSVC OR NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
  message(FATAL_ERROR "LingBuilderFbroBridge only supports MSVC x64")
endif()
if(NOT DEFINED FBRO_SDK_ROOT)
  message(FATAL_ERROR "Set FBRO_SDK_ROOT to the official FBrowser directory")
endif()

set(FBRO_INCLUDE "${FBRO_SDK_ROOT}/src/env/FBrowserCEF3lib")
set(FBRO_LIB_DIR "${FBRO_SDK_ROOT}/src/env/lib64")
add_library(LingBuilderFbroBridge SHARED LingBuilderFbroBridge.cpp)
target_compile_features(LingBuilderFbroBridge PRIVATE cxx_std_17)
target_compile_options(LingBuilderFbroBridge PRIVATE /utf-8)
target_compile_definitions(LingBuilderFbroBridge PRIVATE
  LINGBUILDER_FBRO_BRIDGE_EXPORTS WIN32 _WIN32 _WINDOWS UNICODE _UNICODE WIN64 _WIN64 NOMINMAX)
target_include_directories(LingBuilderFbroBridge PRIVATE "${FBRO_INCLUDE}")
target_link_libraries(LingBuilderFbroBridge PRIVATE
  "${FBRO_LIB_DIR}/release/libcef_dll_wrapper.lib"
  "${FBRO_LIB_DIR}/FBrowserCEF3lib.lib"
  "${FBRO_LIB_DIR}/FBrowserVIP.lib"
  "${FBRO_LIB_DIR}/libcef.lib"
  kernel32.lib user32.lib gdi32.lib advapi32.lib shell32.lib ole32.lib oleaut32.lib
  ws2_32.lib uuid.lib comctl32.lib)
set_property(TARGET LingBuilderFbroBridge PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
target_link_options(LingBuilderFbroBridge PRIVATE /ignore:4099)
