import fs from 'node:fs/promises';
import path from 'node:path';
import { InstalledModule } from '../modules/types';
import { getPreferredModuleTarget } from '../modules/targetResolver';
import { CRYPTO_SDK_MODULE_IDS } from '../modules/dataMediaModules';
import { OPENCV_MODULE_ID, OPENCV_SDK_MODULE_ID } from '../modules/opencvModules';
import { PROTOBUF_MODULE_ID } from '../modules/protobufModule';
import { LingCppNativeProjectFile } from './lingCppWin32Project';
import { createWindowsMsvcLinkLibraries } from './windowsSystemLibraries';
import {
  detectLatestMsvcPlatformToolset,
  FALLBACK_MSVC_PLATFORM_TOOLSET
} from './msvcPlatformToolset';

export interface VisualStudioProjectExportResult {
  projectName: string;
  solutionPath: string;
  projectPath: string;
  filtersPath: string;
  files: string[];
}

export interface VisualStudioProjectExportFile {
  relativePath: string;
  content: string;
}

export interface VisualStudioProjectExportContent {
  projectName: string;
  files: VisualStudioProjectExportFile[];
}

export interface VisualStudioProjectExportOptions {
  projectDir: string;
  projectId: string;
  generatedFiles: LingCppNativeProjectFile[];
  enabledModules: InstalledModule[];
  contentFiles?: string[];
  requiredCppStandard?: 17 | 20;
  requiresDynamicCrt?: boolean;
  /** 默认生成应用程序；DLL 项目使用 DynamicLibrary 和导出定义文件。 */
  projectKind?: 'application' | 'dynamic-library';
  definitionFile?: string;
  /** F5 中间工程从已经校验过的 bin 目录物化 FBro；可复制导出工程则使用模块自带 runtime。 */
  fbroRuntimeFromBuildBin?: boolean;
  /**
   * 显式钉入 vcxproj 的 MSVC 平台工具集（v145、v143 等）。
   * 缺省时 exportVisualStudioProject 会探测本机最新安装的工具集；探测失败回退 v143。
   */
  platformToolset?: string;
}

const WINDOWS_GUID = '8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942';

export async function exportVisualStudioProject(
  options: VisualStudioProjectExportOptions
): Promise<VisualStudioProjectExportResult> {
  const platformToolset = options.platformToolset
    ?? (await detectLatestMsvcPlatformToolset()).toolset;
  const content = createVisualStudioProjectExportContent({ ...options, platformToolset });
  const solutionPath = path.join(options.projectDir, `${content.projectName}.sln`);
  const projectPath = path.join(options.projectDir, `${content.projectName}.vcxproj`);
  const filtersPath = path.join(options.projectDir, `${content.projectName}.vcxproj.filters`);
  await fs.mkdir(options.projectDir, { recursive: true });
  await Promise.all(content.files.map(file => fs.writeFile(path.join(options.projectDir, file.relativePath), file.content, 'utf8')));

  return {
    projectName: content.projectName,
    solutionPath,
    projectPath,
    filtersPath,
    files: [solutionPath, projectPath, filtersPath]
  };
}

export function createVisualStudioProjectExportContent(
  options: VisualStudioProjectExportOptions
): VisualStudioProjectExportContent {
  const projectName = sanitizeVisualStudioName(options.projectId || 'LingBuilderProject');
  const platformToolset = options.platformToolset || FALLBACK_MSVC_PLATFORM_TOOLSET;
  const projectGuid = deterministicGuid(`lingbuilder:${projectName}`);
  const resourceFiles = getResourceFiles(options.generatedFiles);
  const contentFiles = unique((options.contentFiles || []).map(normalizeSlash));
  const noneFiles = unique([...getNoneFiles(options.generatedFiles), ...contentFiles]);
  const includeDirs = getModuleIncludeDirs(options.enabledModules, 'windows-msvc-win32');
  const includeDirsX64 = getModuleIncludeDirs(options.enabledModules, 'windows-msvc-x64');
  const libFiles = getModuleLibFiles(options.enabledModules, 'windows-msvc-win32');
  const libFilesX64 = getModuleLibFiles(options.enabledModules, 'windows-msvc-x64');
  const runtimeFiles = getModuleRuntimeFiles(options.enabledModules, 'windows-msvc-win32');
  const runtimeFilesX64 = getModuleRuntimeFiles(options.enabledModules, 'windows-msvc-x64');
  const hasFbro = options.enabledModules.some(module => module.manifest.id === 'lingbuilder.fbro.browser');
  const fbroHostOnly = hasFbro && options.enabledModules.some(module => module.manifest.id === 'lingbuilder.cef3.browser'
    || (module.manifest.id !== 'lingbuilder.fbro.browser' && (module.manifest.targets || []).some(target =>
      (target.runtimeFiles || []).some(file => path.basename(file).toLowerCase() === 'libcef.dll'))));
  const hasCryptoSdk = usesCryptoSdk(options.enabledModules);
  const hasOpenCv = usesOpenCvSdk(options.enabledModules);
  const x64Only = options.enabledModules.some(module => {
    const targets = module.manifest.targets || [];
    return targets.some(target => target.platform === 'windows' && target.toolchain === 'msvc' && target.arch === 'x64')
      && !targets.some(target => target.platform === 'windows' && target.toolchain === 'msvc' && target.arch === 'win32');
  });
  const projectFiles = options.generatedFiles;
  return {
    projectName,
    files: [
      { relativePath: `${projectName}.sln`, content: generateSolution(projectName, projectGuid, x64Only) },
      {
        relativePath: `${projectName}.vcxproj`,
        content: generateVcxproj({
          projectGuid,
          projectName,
          platformToolset,
          sourceFiles: getSourceFiles(projectFiles, options.enabledModules),
          resourceFiles,
          noneFiles,
          includeDirs,
          includeDirsX64,
          libFiles,
          libFilesX64,
          runtimeFiles,
          runtimeFilesX64,
          hasFbro,
          fbroHostOnly,
          fbroRuntimeFromBuildBin: options.fbroRuntimeFromBuildBin,
          contentFiles,
          requiredCppStandard: options.requiredCppStandard ?? (hasCryptoSdk ? 20 : undefined),
          requiresDynamicCrt: (options.requiresDynamicCrt ?? hasCryptoSdk) || hasOpenCv || options.projectKind === 'dynamic-library',
          projectKind: options.projectKind || 'application',
          definitionFile: options.definitionFile,
          x64Only
        })
      },
      { relativePath: `${projectName}.vcxproj.filters`, content: generateFilters(getSourceFiles(projectFiles, options.enabledModules), resourceFiles, noneFiles) }
    ]
  };
}

function getSourceFiles(generatedFiles: LingCppNativeProjectFile[], enabledModules: InstalledModule[]): string[] {
  return unique([
    ...generatedFiles
      .map(file => normalizeSlash(file.relativePath))
      .filter(file => /\.(c|cc|cpp|cxx)$/i.test(file)),
    ...enabledModules.flatMap(module => {
      const moduleId = module.manifest.id;
      return unique([
        ...(getPreferredModuleTarget(module, 'windows-msvc-win32')?.sources || []),
        ...(getPreferredModuleTarget(module, 'windows-msvc-x64')?.sources || [])
      ])
        .map(file => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
    }),
    ...(usesCryptoSdk(enabledModules) ? ['modules/lingbuilder.crypto.sdk/src/blake3_amalgamation.c'] : [])
  ]);
}

function getNoneFiles(generatedFiles: LingCppNativeProjectFile[]): string[] {
  return generatedFiles
    .map(file => normalizeSlash(file.relativePath))
    .filter(file => !/\.(c|cc|cpp|cxx|rc)$/i.test(file));
}

function getResourceFiles(generatedFiles: LingCppNativeProjectFile[]): string[] {
  return unique(generatedFiles
    .map(file => normalizeSlash(file.relativePath))
    .filter(file => /\.rc$/i.test(file)));
}

function getModuleIncludeDirs(enabledModules: InstalledModule[], targetId = 'windows-msvc-win32'): string[] {
  return unique([...enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    const target = getPreferredModuleTarget(module, targetId);
    if (!target) return [];
    const explicitDirs = (target.includeDirs || []).map(dir => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(dir))));
    const headerDirs = (target.headers || []).map(header => {
      const firstSegment = normalizeSlash(header).split('/')[0];
      return firstSegment ? normalizeSlash(path.posix.join('modules', moduleId, firstSegment)) : '';
    }).filter(Boolean);
    return [...explicitDirs, ...headerDirs];
  }),
  ...(usesCryptoSdk(enabledModules) ? ['modules/lingbuilder.crypto.sdk/include'] : []),
  ...(usesOpenCvSdk(enabledModules) ? [`modules/${OPENCV_SDK_MODULE_ID}/include`] : [])
  ]);
}

function getModuleLibFiles(enabledModules: InstalledModule[], targetId = 'windows-msvc-win32'): string[] {
  const architecture = targetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  return unique([...enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    return (getPreferredModuleTarget(module, targetId)?.libs || [])
      .map(file => isBuiltinModule(module)
        ? module.manifest.id === PROTOBUF_MODULE_ID
          ? normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file)))
          : normalizeSlash(file)
        : normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
  }),
  ...(usesCryptoSdk(enabledModules) ? [`modules/lingbuilder.crypto.sdk/lib/${architecture}/botan-3.lib`] : []),
  ...(usesOpenCvSdk(enabledModules) && architecture === 'x64' ? [`modules/${OPENCV_SDK_MODULE_ID}/lib/x64/LingBuilderOpenCvBridge.lib`] : [])
  ]);
}

function getModuleRuntimeFiles(enabledModules: InstalledModule[], targetId = 'windows-msvc-win32'): string[] {
  const architecture = targetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  return unique([...enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    return (getPreferredModuleTarget(module, targetId)?.runtimeFiles || [])
      .map(file => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
  }),
  ...(usesCryptoSdk(enabledModules) ? [`modules/lingbuilder.crypto.sdk/bin/${architecture}/botan-3.dll`] : []),
  ...(usesOpenCvSdk(enabledModules) && architecture === 'x64' ? [
    `modules/${OPENCV_SDK_MODULE_ID}/bin/x64/LingBuilderOpenCvBridge.dll`,
    `modules/${OPENCV_SDK_MODULE_ID}/bin/x64/opencv_core4140.dll`,
    `modules/${OPENCV_SDK_MODULE_ID}/bin/x64/opencv_imgproc4140.dll`,
    `modules/${OPENCV_SDK_MODULE_ID}/bin/x64/opencv_imgcodecs4140.dll`
  ] : [])
  ]);
}

function usesCryptoSdk(enabledModules: InstalledModule[]): boolean {
  return enabledModules.some(module => CRYPTO_SDK_MODULE_IDS.includes(module.manifest.id as typeof CRYPTO_SDK_MODULE_IDS[number]));
}

function usesOpenCvSdk(enabledModules: InstalledModule[]): boolean {
  return enabledModules.some(module => module.manifest.id === OPENCV_MODULE_ID);
}

function generateSolution(projectName: string, projectGuid: string, x64Only = false): string {
  if (x64Only) return [
    'Microsoft Visual Studio Solution File, Format Version 12.00',
    '# Visual Studio Version 17',
    'VisualStudioVersion = 17.0.31903.59',
    'MinimumVisualStudioVersion = 10.0.40219.1',
    `Project("{${WINDOWS_GUID}}") = "${projectName}", "${projectName}.vcxproj", "{${projectGuid}}"`,
    'EndProject',
    'Global',
    '\tGlobalSection(SolutionConfigurationPlatforms) = preSolution',
    '\t\tDebug|x64 = Debug|x64',
    '\t\tRelease|x64 = Release|x64',
    '\tEndGlobalSection',
    '\tGlobalSection(ProjectConfigurationPlatforms) = postSolution',
    `\t\t{${projectGuid}}.Debug|x64.ActiveCfg = Debug|x64`,
    `\t\t{${projectGuid}}.Debug|x64.Build.0 = Debug|x64`,
    `\t\t{${projectGuid}}.Release|x64.ActiveCfg = Release|x64`,
    `\t\t{${projectGuid}}.Release|x64.Build.0 = Release|x64`,
    '\tEndGlobalSection',
    '\tGlobalSection(SolutionProperties) = preSolution',
    '\t\tHideSolutionNode = FALSE',
    '\tEndGlobalSection',
    'EndGlobal',
    ''
  ].join('\r\n');
  return [
    'Microsoft Visual Studio Solution File, Format Version 12.00',
    '# Visual Studio Version 17',
    'VisualStudioVersion = 17.0.31903.59',
    'MinimumVisualStudioVersion = 10.0.40219.1',
    `Project("{${WINDOWS_GUID}}") = "${projectName}", "${projectName}.vcxproj", "{${projectGuid}}"`,
    'EndProject',
    'Global',
    '\tGlobalSection(SolutionConfigurationPlatforms) = preSolution',
    '\t\tDebug|Win32 = Debug|Win32',
    '\t\tRelease|Win32 = Release|Win32',
    '\t\tDebug|x64 = Debug|x64',
    '\t\tRelease|x64 = Release|x64',
    '\tEndGlobalSection',
    '\tGlobalSection(ProjectConfigurationPlatforms) = postSolution',
    `\t\t{${projectGuid}}.Debug|Win32.ActiveCfg = Debug|Win32`,
    `\t\t{${projectGuid}}.Debug|Win32.Build.0 = Debug|Win32`,
    `\t\t{${projectGuid}}.Release|Win32.ActiveCfg = Release|Win32`,
    `\t\t{${projectGuid}}.Release|Win32.Build.0 = Release|Win32`,
    `\t\t{${projectGuid}}.Debug|x64.ActiveCfg = Debug|x64`,
    `\t\t{${projectGuid}}.Debug|x64.Build.0 = Debug|x64`,
    `\t\t{${projectGuid}}.Release|x64.ActiveCfg = Release|x64`,
    `\t\t{${projectGuid}}.Release|x64.Build.0 = Release|x64`,
    '\tEndGlobalSection',
    '\tGlobalSection(SolutionProperties) = preSolution',
    '\t\tHideSolutionNode = FALSE',
    '\tEndGlobalSection',
    'EndGlobal',
    ''
  ].join('\r\n');
}

function generateVcxproj(options: {
  projectGuid: string;
  projectName: string;
  platformToolset: string;
  sourceFiles: string[];
  resourceFiles: string[];
  noneFiles: string[];
  includeDirs: string[];
  includeDirsX64: string[];
  libFiles: string[];
  libFilesX64: string[];
  runtimeFiles: string[];
  runtimeFilesX64: string[];
  hasFbro: boolean;
  fbroHostOnly?: boolean;
  fbroRuntimeFromBuildBin?: boolean;
  contentFiles: string[];
  requiredCppStandard?: 17 | 20;
  requiresDynamicCrt?: boolean;
  projectKind: 'application' | 'dynamic-library';
  definitionFile?: string;
  x64Only?: boolean;
}): string {
  const includeDirectories = options.includeDirs.map(toWindowsPath).join(';');
  const additionalIncludeDirectories = includeDirectories
    ? `${xmlEscape(includeDirectories)};%(AdditionalIncludeDirectories)`
    : '%(AdditionalIncludeDirectories)';
  const additionalDependencies = createWindowsMsvcLinkLibraries(options.libFiles.map(toWindowsPath)).join(';');
  const additionalIncludeDirectoriesX64 = options.includeDirsX64.length
    ? `${xmlEscape(options.includeDirsX64.map(toWindowsPath).join(';'))};%(AdditionalIncludeDirectories)`
    : '%(AdditionalIncludeDirectories)';
  const additionalDependenciesX64 = createWindowsMsvcLinkLibraries(options.libFilesX64.map(toWindowsPath)).join(';');
  const postBuild = generatePostBuildCommand(options.runtimeFiles, options.contentFiles);
  const postBuildX64 = generatePostBuildCommand(
    options.runtimeFilesX64,
    options.contentFiles,
    options.hasFbro,
    options.fbroRuntimeFromBuildBin,
    options.fbroHostOnly
  );
  const languageStandard = options.requiredCppStandard === 20 ? 'stdcpp20' : 'stdcpp17';
  const runtimeLibrary = options.requiresDynamicCrt
    ? '\n      <RuntimeLibrary>MultiThreadedDLL</RuntimeLibrary>'
    : '';
  const useDebugLibraries = options.requiresDynamicCrt ? 'false' : 'true';
  const debugPreprocessorDefinitions = options.requiresDynamicCrt
    ? 'WIN32;NDEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)'
    : 'WIN32;_DEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)';
  const debugPreprocessorDefinitionsX64 = options.requiresDynamicCrt
    ? 'NDEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)'
    : '_DEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)';
  const configurationType = options.projectKind === 'dynamic-library' ? 'DynamicLibrary' : 'Application';
  const definitionFile = options.definitionFile
    ? `\n      <ModuleDefinitionFile>${xmlEscape(toWindowsPath(options.definitionFile))}</ModuleDefinitionFile>`
    : '';

  const project = `<?xml version="1.0" encoding="utf-8"?>
<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <ItemGroup Label="ProjectConfigurations">
    <ProjectConfiguration Include="Debug|Win32">
      <Configuration>Debug</Configuration>
      <Platform>Win32</Platform>
    </ProjectConfiguration>
    <ProjectConfiguration Include="Release|Win32">
      <Configuration>Release</Configuration>
      <Platform>Win32</Platform>
    </ProjectConfiguration>
    <ProjectConfiguration Include="Debug|x64"><Configuration>Debug</Configuration><Platform>x64</Platform></ProjectConfiguration>
    <ProjectConfiguration Include="Release|x64"><Configuration>Release</Configuration><Platform>x64</Platform></ProjectConfiguration>
  </ItemGroup>
  <PropertyGroup Label="Globals">
    <VCProjectVersion>17.0</VCProjectVersion>
    <Keyword>Win32Proj</Keyword>
    <ProjectGuid>{${options.projectGuid}}</ProjectGuid>
    <RootNamespace>${xmlEscape(options.projectName)}</RootNamespace>
    <TargetName>${xmlEscape(options.projectName)}</TargetName>
    <WindowsTargetPlatformVersion>10.0</WindowsTargetPlatformVersion>
  </PropertyGroup>
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.Default.props" />
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'" Label="Configuration">
    <ConfigurationType>${configurationType}</ConfigurationType>
    <UseDebugLibraries>${useDebugLibraries}</UseDebugLibraries>
    <PlatformToolset>${options.platformToolset}</PlatformToolset>
    <CharacterSet>Unicode</CharacterSet>
  </PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|Win32'" Label="Configuration">
    <ConfigurationType>${configurationType}</ConfigurationType>
    <UseDebugLibraries>false</UseDebugLibraries>
    <PlatformToolset>${options.platformToolset}</PlatformToolset>
    <WholeProgramOptimization>true</WholeProgramOptimization>
    <CharacterSet>Unicode</CharacterSet>
  </PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'" Label="Configuration"><ConfigurationType>${configurationType}</ConfigurationType><UseDebugLibraries>${useDebugLibraries}</UseDebugLibraries><PlatformToolset>${options.platformToolset}</PlatformToolset><CharacterSet>Unicode</CharacterSet></PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'" Label="Configuration"><ConfigurationType>${configurationType}</ConfigurationType><UseDebugLibraries>false</UseDebugLibraries><PlatformToolset>${options.platformToolset}</PlatformToolset><WholeProgramOptimization>true</WholeProgramOptimization><CharacterSet>Unicode</CharacterSet></PropertyGroup>
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.props" />
  <ImportGroup Label="ExtensionSettings" />
  <ImportGroup Label="Shared" />
  <ImportGroup Label="PropertySheets" Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'">
    <Import Project="$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props" Condition="exists('$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props')" Label="LocalAppDataPlatform" />
  </ImportGroup>
  <ImportGroup Label="PropertySheets" Condition="'$(Configuration)|$(Platform)'=='Release|Win32'">
    <Import Project="$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props" Condition="exists('$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props')" Label="LocalAppDataPlatform" />
  </ImportGroup>
  <ImportGroup Label="PropertySheets" Condition="'$(Configuration)|$(Platform)'=='Debug|x64'"><Import Project="$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props" Condition="exists('$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props')" Label="LocalAppDataPlatform" /></ImportGroup>
  <ImportGroup Label="PropertySheets" Condition="'$(Configuration)|$(Platform)'=='Release|x64'"><Import Project="$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props" Condition="exists('$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props')" Label="LocalAppDataPlatform" /></ImportGroup>
  <PropertyGroup Label="UserMacros" />
  <PropertyGroup>
    <OutDir>$(ProjectDir)$(Platform)\\$(Configuration)\\bin\\</OutDir>
    <IntDir>$(ProjectDir)obj\\$(Platform)\\$(Configuration)\\</IntDir>
  </PropertyGroup>
${options.hasFbro ? `  <Target Name="ValidateFbroArchitecture" BeforeTargets="PrepareForBuild" Condition="'$(Platform)'!='x64'">
    <Error Text="FBro 浏览器仅支持 Windows MSVC x64，请切换到 x64 配置。" />
  </Target>` : ''}
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'">
    <ClCompile>
      <WarningLevel>Level3</WarningLevel>
      <SDLCheck>true</SDLCheck>
      <PreprocessorDefinitions>${debugPreprocessorDefinitions}</PreprocessorDefinitions>
      <ConformanceMode>true</ConformanceMode>
      <LanguageStandard>${languageStandard}</LanguageStandard>${runtimeLibrary}
      <AdditionalIncludeDirectories>${additionalIncludeDirectories}</AdditionalIncludeDirectories>
      <AdditionalOptions>/utf-8 %(AdditionalOptions)</AdditionalOptions>
    </ClCompile>
    <Link>
      <SubSystem>Windows</SubSystem>
      ${definitionFile}
      <AdditionalDependencies>${xmlEscape(additionalDependencies)};%(AdditionalDependencies)</AdditionalDependencies>
    </Link>${postBuild}
  </ItemDefinitionGroup>
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Release|Win32'">
    <ClCompile>
      <WarningLevel>Level3</WarningLevel>
      <FunctionLevelLinking>true</FunctionLevelLinking>
      <IntrinsicFunctions>true</IntrinsicFunctions>
      <SDLCheck>true</SDLCheck>
      <PreprocessorDefinitions>WIN32;NDEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)</PreprocessorDefinitions>
      <ConformanceMode>true</ConformanceMode>
      <LanguageStandard>${languageStandard}</LanguageStandard>${runtimeLibrary}
      <AdditionalIncludeDirectories>${additionalIncludeDirectories}</AdditionalIncludeDirectories>
      <AdditionalOptions>/utf-8 %(AdditionalOptions)</AdditionalOptions>
    </ClCompile>
    <Link>
      <SubSystem>Windows</SubSystem>
      ${definitionFile}
      <EnableCOMDATFolding>true</EnableCOMDATFolding>
      <OptimizeReferences>true</OptimizeReferences>
      <AdditionalDependencies>${xmlEscape(additionalDependencies)};%(AdditionalDependencies)</AdditionalDependencies>
    </Link>${postBuild}
  </ItemDefinitionGroup>
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'"><ClCompile><WarningLevel>Level3</WarningLevel><SDLCheck>true</SDLCheck><PreprocessorDefinitions>${debugPreprocessorDefinitionsX64}</PreprocessorDefinitions><ConformanceMode>true</ConformanceMode><LanguageStandard>${languageStandard}</LanguageStandard>${runtimeLibrary}<AdditionalIncludeDirectories>${additionalIncludeDirectoriesX64}</AdditionalIncludeDirectories><AdditionalOptions>/utf-8 %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Windows</SubSystem>${definitionFile}<AdditionalDependencies>${xmlEscape(additionalDependenciesX64)};%(AdditionalDependencies)</AdditionalDependencies></Link>${postBuildX64}</ItemDefinitionGroup>
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'"><ClCompile><WarningLevel>Level3</WarningLevel><FunctionLevelLinking>true</FunctionLevelLinking><IntrinsicFunctions>true</IntrinsicFunctions><SDLCheck>true</SDLCheck><PreprocessorDefinitions>NDEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)</PreprocessorDefinitions><ConformanceMode>true</ConformanceMode><LanguageStandard>${languageStandard}</LanguageStandard>${runtimeLibrary}<AdditionalIncludeDirectories>${additionalIncludeDirectoriesX64}</AdditionalIncludeDirectories><AdditionalOptions>/utf-8 %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Windows</SubSystem>${definitionFile}<EnableCOMDATFolding>true</EnableCOMDATFolding><OptimizeReferences>true</OptimizeReferences><AdditionalDependencies>${xmlEscape(additionalDependenciesX64)};%(AdditionalDependencies)</AdditionalDependencies></Link>${postBuildX64}</ItemDefinitionGroup>
${generateFileItems('ClCompile', options.sourceFiles)}${generateFileItems('ResourceCompile', options.resourceFiles)}${generateFileItems('None', options.noneFiles)}
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.targets" />
  <ImportGroup Label="ExtensionTargets" />
</Project>
`;
  return options.x64Only ? stripWin32Configurations(project) : project;
}

function stripWin32Configurations(project: string): string {
  return project
    .replace(/\s*<ProjectConfiguration Include="(?:Debug|Release)\|Win32">[\s\S]*?<\/ProjectConfiguration>/gu, '')
    .replace(/\s*<PropertyGroup Condition="'\$\(Configuration\)\|\$\(Platform\)'=='(?:Debug|Release)\|Win32'" Label="Configuration">[\s\S]*?<\/PropertyGroup>/gu, '')
    .replace(/\s*<ImportGroup Label="PropertySheets" Condition="'\$\(Configuration\)\|\$\(Platform\)'=='(?:Debug|Release)\|Win32'">[\s\S]*?<\/ImportGroup>/gu, '')
    .replace(/\s*<ItemDefinitionGroup Condition="'\$\(Configuration\)\|\$\(Platform\)'=='(?:Debug|Release)\|Win32'">[\s\S]*?<\/ItemDefinitionGroup>/gu, '');
}

function generateFilters(sourceFiles: string[], resourceFiles: string[], noneFiles: string[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <ItemGroup>
    <Filter Include="源文件">
      <UniqueIdentifier>{${deterministicGuid('filter:source')}}</UniqueIdentifier>
      <Extensions>cpp;c;cc;cxx</Extensions>
    </Filter>
    <Filter Include="生成资源">
      <UniqueIdentifier>{${deterministicGuid('filter:none')}}</UniqueIdentifier>
    </Filter>
    <Filter Include="资源文件">
      <UniqueIdentifier>{${deterministicGuid('filter:resource')}}</UniqueIdentifier>
      <Extensions>rc;ico;cur;bmp;dlg;rc2;rct;bin;rgs;gif;jpg;jpeg;jpe;resx;tiff;tif;png;wav;mfcribbon-ms</Extensions>
    </Filter>
  </ItemGroup>
${generateFilterItems('ClCompile', sourceFiles, '源文件')}${generateFilterItems('ResourceCompile', resourceFiles, '资源文件')}${generateFilterItems('None', noneFiles, '生成资源')}</Project>
`;
}

function generateFileItems(kind: 'ClCompile' | 'ResourceCompile' | 'None', files: string[]): string {
  if (files.length === 0) return '';
  const items = files
    .map(file => `    <${kind} Include="${xmlEscape(toWindowsPath(file))}" />`)
    .join('\n');
  return `  <ItemGroup>\n${items}\n  </ItemGroup>\n`;
}

function generateFilterItems(kind: 'ClCompile' | 'ResourceCompile' | 'None', files: string[], filter: string): string {
  if (files.length === 0) return '';
  const items = files
    .map(file => `    <${kind} Include="${xmlEscape(toWindowsPath(file))}">\n      <Filter>${xmlEscape(filter)}</Filter>\n    </${kind}>`)
    .join('\n');
  return `  <ItemGroup>\n${items}\n  </ItemGroup>\n`;
}

function generatePostBuildCommand(
  runtimeFiles: string[],
  contentFiles: string[],
  materializeFbro = false,
  fbroRuntimeFromBuildBin = false,
  fbroHostOnly = false
): string {
  const runtimeCommands = runtimeFiles.flatMap(file => {
    const windowsFile = toWindowsPath(file);
    const destination = toWindowsPath(getRuntimeOutputPath(file));
    const destinationDirectory = path.win32.dirname(destination);
    return [
      ...(destinationDirectory === '.' ? [] : [
        `if not exist "$(OutDir)${destinationDirectory}" mkdir "$(OutDir)${destinationDirectory}"`
      ]),
      `if exist "$(ProjectDir)${windowsFile}" copy /Y "$(ProjectDir)${windowsFile}" "$(OutDir)${destination}"`
    ];
  });
  const contentCommands = contentFiles.flatMap(file => {
    const windowsFile = toWindowsPath(file);
    const destinationDirectory = path.win32.dirname(windowsFile);
    return [
      `if not exist "$(OutDir)${destinationDirectory}" mkdir "$(OutDir)${destinationDirectory}"`,
      `if exist "$(ProjectDir)${windowsFile}" copy /Y "$(ProjectDir)${windowsFile}" "$(OutDir)${windowsFile}"`
    ];
  });
  const fbroCommands = materializeFbro
    ? [`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(ProjectDir)modules\\lingbuilder.fbro.browser\\materialize-fbro-runtime.ps1" -Destination "$(TargetDir)."${fbroRuntimeFromBuildBin ? ' -RuntimeRoot "$(ProjectDir)bin"' : ''}${fbroHostOnly ? ' -HostOnly' : ''}`]
    : [];
  // 防御性兜底：个别环境（.user 文件重定向等）下 OutDir 可能尚未创建，先建目录再复制。
  const commandLines = [...runtimeCommands, ...contentCommands, ...fbroCommands];
  if (commandLines.length === 0) return '';
  const commands = ['if not exist "$(OutDir)" mkdir "$(OutDir)"', ...commandLines].join('\r\n');
  return `
    <PostBuildEvent>
      <Command>${xmlEscapeMultilineText(commands)}</Command>
    </PostBuildEvent>`;
}

/**
 * XML 解析会把文本节点里的 CRLF 规范化为 LF，而 cmd 执行 LF-only 多行批处理时会按字节偏移
 * 错位读取后续行（表现为 MSB3073 退出码 3、「文件名、目录名或卷标语法不正确」）。
 * 因此 CR 必须写成字符引用 &#xD;，保证 MSBuild 读回的命令串仍是 CRLF——这也是 Visual Studio
 * 自己保存 vcxproj 时对多行生成事件的做法。
 */
function xmlEscapeMultilineText(value: string): string {
  return xmlEscape(value).replace(/\r/gu, '&#xD;');
}

function getRuntimeOutputPath(value: string): string {
  const normalized = normalizeSlash(value);
  const runtimeMarker = normalized.toLowerCase().lastIndexOf('/runtime/');
  return runtimeMarker >= 0
    ? normalized.slice(runtimeMarker + '/runtime/'.length)
    : path.posix.basename(normalized);
}

function deterministicGuid(seed: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x01000193;
  for (let index = 0; index < seed.length; index += 1) {
    const char = seed.charCodeAt(index);
    hash1 ^= char;
    hash1 = Math.imul(hash1, 0x01000193) >>> 0;
    hash2 = Math.imul(hash2 ^ char, 0x85ebca6b) >>> 0;
  }
  const hex = `${hash1.toString(16).padStart(8, '0')}${hash2.toString(16).padStart(8, '0')}4${((hash1 >>> 16) & 0xfff).toString(16).padStart(3, '0')}8${((hash2 >>> 16) & 0xfff).toString(16).padStart(3, '0')}${((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0')}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`.toUpperCase();
}

function sanitizeVisualStudioName(value: string): string {
  const safe = value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || 'LingBuilderProject';
}

function normalizeSlash(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function toWindowsPath(value: string): string {
  return normalizeSlash(value).replace(/\//g, '\\');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function isBuiltinModule(module: InstalledModule): boolean {
  return Boolean(module.isBuiltin || module.installPath?.startsWith('builtin://'));
}
