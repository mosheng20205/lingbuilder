cmake_minimum_required(VERSION 3.20)
project(LingBuilderOpenCvBridge LANGUAGES CXX)

find_package(OpenCV 4.14.0 REQUIRED COMPONENTS core imgproc imgcodecs)

add_library(LingBuilderOpenCvBridge SHARED
  LingBuilderOpenCvBridge.cpp
  LingBuilderOpenCvBridge.h
)

target_compile_features(LingBuilderOpenCvBridge PRIVATE cxx_std_17)
target_compile_definitions(LingBuilderOpenCvBridge PRIVATE
  LINGBUILDER_OPENCV_BRIDGE_EXPORTS
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
)
target_include_directories(LingBuilderOpenCvBridge PRIVATE ${OpenCV_INCLUDE_DIRS})
target_link_libraries(LingBuilderOpenCvBridge PRIVATE ${OpenCV_LIBS})

if(MSVC)
  target_compile_options(LingBuilderOpenCvBridge PRIVATE /utf-8 /W4 /EHsc)
  set_property(TARGET LingBuilderOpenCvBridge PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreadedDLL")
endif()

set_target_properties(LingBuilderOpenCvBridge PROPERTIES
  OUTPUT_NAME "LingBuilderOpenCvBridge"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin"
  ARCHIVE_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/lib"
  PDB_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/pdb"
)

