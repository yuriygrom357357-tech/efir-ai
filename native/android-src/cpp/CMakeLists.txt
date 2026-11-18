cmake_minimum_required(VERSION 3.14)
# Нативний рушій розпізнавання: whisper.cpp + тонкий JNI-місток. Завжди з оптимізацією, навіть у debug-збірці APK.
set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
project(efirwhisper C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
add_compile_options(-O3)

set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_SERVER OFF CACHE BOOL "" FORCE)

if(NOT WHISPER_DIR)
  message(FATAL_ERROR "WHISPER_DIR is not set")
endif()
add_subdirectory(${WHISPER_DIR} whispercpp)

add_library(efirwhisper SHARED jni.c)
target_include_directories(efirwhisper PRIVATE ${WHISPER_DIR}/include)
find_library(LOG_LIB log)
target_link_libraries(efirwhisper whisper ${LOG_LIB})
