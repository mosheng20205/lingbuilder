cmake_minimum_required(VERSION 3.20)
project(LingBuilderCefBridge LANGUAGES CXX)

if(NOT MSVC OR NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
  message(FATAL_ERROR "LingBuilderCefBridge only supports MSVC x64")
endif()
if(NOT DEFINED CEF_SDK_ROOT)
  message(FATAL_ERROR "Set CEF_SDK_ROOT to the frozen CEF 150 Windows x64 SDK")
endif()
if(NOT EXISTS "${CEF_SDK_ROOT}/include/cef_version.h")
  message(FATAL_ERROR "CEF_SDK_ROOT does not contain include/cef_version.h")
endif()
set(CEF_LIB "${CEF_SDK_ROOT}/Release/libcef.lib")
set(CEF_WRAPPER_LIB "${CEF_SDK_ROOT}/build_wrapper_x64_md/libcef_dll_wrapper/Release/libcef_dll_wrapper.lib")
if(NOT EXISTS "${CEF_LIB}" OR NOT EXISTS "${CEF_WRAPPER_LIB}")
  message(FATAL_ERROR "Frozen CEF 150 x64 import library or /MD wrapper is missing")
endif()

add_library(LingBuilderCefBridge SHARED LingBuilderCefBridge.cpp)
target_compile_features(LingBuilderCefBridge PRIVATE cxx_std_20)
target_compile_options(LingBuilderCefBridge PRIVATE /utf-8 /bigobj)
target_compile_definitions(LingBuilderCefBridge PRIVATE LINGBUILDER_CEF3_BRIDGE_EXPORTS UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN NDEBUG)
target_include_directories(LingBuilderCefBridge PRIVATE "${CEF_SDK_ROOT}")
target_link_libraries(LingBuilderCefBridge PRIVATE "${CEF_LIB}" "${CEF_WRAPPER_LIB}" user32.lib)
set_property(TARGET LingBuilderCefBridge PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
add_custom_command(TARGET LingBuilderCefBridge POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${CEF_SDK_ROOT}/Release/libcef.dll"
    "$<TARGET_FILE_DIR:LingBuilderCefBridge>/libcef.dll"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${CEF_SDK_ROOT}/Release/chrome_elf.dll"
    "$<TARGET_FILE_DIR:LingBuilderCefBridge>/chrome_elf.dll")

add_executable(LingBuilderCefBridgeTests LingBuilderCefBridgeTests.cpp)
target_compile_features(LingBuilderCefBridgeTests PRIVATE cxx_std_17)
target_compile_options(LingBuilderCefBridgeTests PRIVATE /utf-8 /UNDEBUG)
target_compile_definitions(LingBuilderCefBridgeTests PRIVATE UNICODE _UNICODE NOMINMAX)
target_link_libraries(LingBuilderCefBridgeTests PRIVATE LingBuilderCefBridge ws2_32.lib)
set_property(TARGET LingBuilderCefBridgeTests PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
