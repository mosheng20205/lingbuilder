cmake_minimum_required(VERSION 3.20)

project(LingBuilderCodexConfigurator LANGUAGES CXX)

set(LINGBUILDER_WORKSPACE_ROOT "${CMAKE_CURRENT_LIST_DIR}/../..")
set(NEW_EMOJI_ROOT "${LINGBUILDER_WORKSPACE_ROOT}/.lingbuilder/modules/lingbuilder.new_emoji.ui")
set(NEW_EMOJI_INCLUDE "${NEW_EMOJI_ROOT}/include")
set(NEW_EMOJI_LIB_DIR "${NEW_EMOJI_ROOT}/lib/x64")
set(NEW_EMOJI_DLL "${NEW_EMOJI_ROOT}/bin/x64/new_emoji.dll")

add_executable(LingBuilderCodexConfigurator WIN32
  main.cpp
  "${NEW_EMOJI_ROOT}/src/new_emoji_bridge.cpp"
)
target_compile_features(LingBuilderCodexConfigurator PRIVATE cxx_std_17)
target_compile_definitions(LingBuilderCodexConfigurator PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN LINGBUILDER_USE_NEW_EMOJI)
target_include_directories(LingBuilderCodexConfigurator PRIVATE "${NEW_EMOJI_INCLUDE}")
target_link_directories(LingBuilderCodexConfigurator PRIVATE "${NEW_EMOJI_LIB_DIR}")
target_link_libraries(LingBuilderCodexConfigurator PRIVATE new_emoji comdlg32 comctl32 gdi32 ole32 shell32 user32)

add_custom_command(TARGET LingBuilderCodexConfigurator POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${NEW_EMOJI_DLL}"
    "$<TARGET_FILE_DIR:LingBuilderCodexConfigurator>/new_emoji.dll"
)

if (MSVC)
  target_compile_options(LingBuilderCodexConfigurator PRIVATE /utf-8 /W4 /EHsc)
endif()
