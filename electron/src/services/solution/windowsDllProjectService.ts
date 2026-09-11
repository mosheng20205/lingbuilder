import type { LingCppNativeProjectFile } from '../windowDesigner/lingCppWin32Project';
import { parseLingCpp } from '../lingCpp/parser';
import {
  createVisualStudioProjectExportContent,
  type VisualStudioProjectExportFile
} from '../windowDesigner/visualStudioProjectExporter';

export const WINDOWS_DLL_PROJECT_MANIFEST = 'lingbuilder.dll.json';

export interface WindowsDllProjectManifest {
  schemaVersion: 1;
  kind: 'windows-dll';
  projectId: string;
  outputName: string;
  publicHeaders: string[];
  sourceFiles: string[];
  lingCppFiles?: string[];
  definitionFile: string;
  abi: 'c';
  callingConvention: 'cdecl';
}

export interface WindowsDllProjectFile extends VisualStudioProjectExportFile {
  kind: 'source' | 'header' | 'definition' | 'project' | 'config';
}

export function createWindowsDllProjectFiles(
  projectId: string,
  projectName: string,
  options: { platformToolset?: string } = {}
): WindowsDllProjectFile[] {
  const outputName = sanitizeOutputName(projectId);
  const lingCppSource = createDllApiLingCppSource();
  const generatedFiles: LingCppNativeProjectFile[] = [
    {
      relativePath: 'DllMain.cpp',
      content: createDllSource(outputName)
    },
    {
      relativePath: 'include/DllExports.h',
      content: createDllHeader()
    },
    {
      relativePath: 'exports.def',
      content: createDefinitionFile(outputName)
    },
    {
      relativePath: 'DllApi.lcpp',
      content: lingCppSource
    }
  ];
  const manifest: WindowsDllProjectManifest = {
    schemaVersion: 1,
    kind: 'windows-dll',
    projectId,
    outputName,
    publicHeaders: ['include/DllExports.h'],
    sourceFiles: ['DllMain.cpp'],
    lingCppFiles: ['DllApi.lcpp'],
    definitionFile: 'exports.def',
    abi: 'c',
    callingConvention: 'cdecl'
  };
  const visualStudio = createVisualStudioProjectExportContent({
    projectDir: '.',
    projectId: outputName,
    generatedFiles,
    enabledModules: [],
    projectKind: 'dynamic-library',
    definitionFile: 'exports.def',
    platformToolset: options.platformToolset
  });
  return [
    ...generatedFiles.map(file => ({
      relativePath: file.relativePath,
      content: file.content,
      kind: file.relativePath.endsWith('.cpp') || file.relativePath.endsWith('.lcpp') ? 'source' as const
        : file.relativePath.endsWith('.h') ? 'header' as const
          : 'definition' as const
    })),
    { relativePath: WINDOWS_DLL_PROJECT_MANIFEST, content: `${JSON.stringify(manifest, null, 2)}\n`, kind: 'config' },
    { relativePath: `${outputName}.sln`, content: visualStudio.files.find(file => file.relativePath.endsWith('.sln'))?.content || '', kind: 'project' },
    { relativePath: `${outputName}.vcxproj`, content: visualStudio.files.find(file => file.relativePath.endsWith('.vcxproj'))?.content || '', kind: 'project' },
    { relativePath: `${outputName}.vcxproj.filters`, content: visualStudio.files.find(file => file.relativePath.endsWith('.vcxproj.filters'))?.content || '', kind: 'project' }
  ];
}

export function generateWindowsDllSourceFromLingCpp(outputName: string, sourceCode: string): string {
  const parsed = parseLingCpp(sourceCode);
  const methods = [
    ...parsed.program.classes.flatMap(item => item.methods),
    ...parsed.program.functionLibraries.flatMap(item => item.methods)
  ];
  const apiMethod = methods.find(method => method.name === '获取接口版本');
  const returnStatement = apiMethod?.statements
    .map(statement => statement.text.trim())
    .find(statement => /^返回\s*[（(]\s*-?\d+\s*[）)]\s*$/u.test(statement));
  const value = returnStatement?.match(/-?\d+/u)?.[0] || '1';
  return createDllSource(outputName, Number.parseInt(value, 10));
}

export function isWindowsDllProjectManifest(value: unknown): value is WindowsDllProjectManifest {
  const manifest = value as Partial<WindowsDllProjectManifest> | undefined;
  return Boolean(manifest
    && manifest.schemaVersion === 1
    && manifest.kind === 'windows-dll'
    && typeof manifest.projectId === 'string'
    && typeof manifest.outputName === 'string'
    && Array.isArray(manifest.sourceFiles)
    && typeof manifest.definitionFile === 'string');
}

function createDllHeader(): string {
  return `#pragma once

// LingBuilder DLL 的公开 C ABI。导出名由 exports.def 统一维护，调用方只依赖稳定的标量类型。
#if defined(_WINDLL)
#define LINGBUILDER_DLL_API
#else
#define LINGBUILDER_DLL_API __declspec(dllimport)
#endif

extern "C" LINGBUILDER_DLL_API int LingBuilder_GetApiVersion() noexcept;
`;
}

function createDllSource(outputName: string, apiVersion = 1): string {
  return `#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "include/DllExports.h"

// ${outputName} 的最小 DLL 入口。业务 API 应继续使用 C ABI 和调用方拥有的缓冲区。
BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  (void)module;
  (void)reason;
  (void)reserved;
  return TRUE;
}

extern "C" LINGBUILDER_DLL_API int LingBuilder_GetApiVersion() noexcept {
  // 该返回值由 DllApi.lcpp 中的“获取接口版本”过程确定性生成。
  return ${Number.isFinite(apiVersion) ? apiVersion : 1};
}
`;
}

function createDllApiLingCppSource(): string {
  return `包 Windows动态库示例

类 DllApi
公开
  整数型 获取接口版本()
    返回 (1)
  结束
结束类
`;
}

function createDefinitionFile(outputName: string): string {
  return `LIBRARY "${outputName}"
EXPORTS
  LingBuilder_GetApiVersion
`;
}

function sanitizeOutputName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/gu, '_').replace(/^\.+/u, '').slice(0, 80) || 'LingBuilderDll';
}
