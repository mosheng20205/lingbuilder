import fs from 'node:fs/promises';
import path from 'node:path';
import { InstalledModule } from '../modules/types';
import { getPreferredModuleTarget } from '../modules/targetResolver';
import { CRYPTO_SDK_MODULE_IDS } from '../modules/dataMediaModules';
import { LingCppNativeProjectFile } from './lingCppWin32Project';

export interface VisualStudioProjectExportResult {
  projectName: string;
  solutionPath: string;
  projectPath: string;
  filtersPath: string;
  files: string[];
}

export interface VisualStudioProjectExportOptions {
  projectDir: string;
  projectId: string;
  generatedFiles: LingCppNativeProjectFile[];
  enabledModules: InstalledModule[];
  contentFiles?: string[];
  requiredCppStandard?: 17 | 20;
  requiresDynamicCrt?: boolean;
  /** F5 中间工程从已经校验过的 bin 目录物化 FBro；可复制导出工程则使用模块自带 runtime。 */
  fbroRuntimeFromBuildBin?: boolean;
}

const WINDOWS_GUID = '8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942';

export async function exportVisualStudioProject(
  options: VisualStudioProjectExportOptions
): Promise<VisualStudioProjectExportResult> {
  const projectName = sanitizeVisualStudioName(options.projectId || 'LingBuilderProject');
  const projectGuid = deterministicGuid(`lingbuilder:${projectName}`);
  const solutionPath = path.join(options.projectDir, `${projectName}.sln`);
  const projectPath = path.join(options.projectDir, `${projectName}.vcxproj`);
  const filtersPath = path.join(options.projectDir, `${projectName}.vcxproj.filters`);
  const sourceFiles = getSourceFiles(options.generatedFiles, options.enabledModules);
  const contentFiles = unique((options.contentFiles || []).map(normalizeSlash));
  const noneFiles = unique([...getNoneFiles(options.generatedFiles), ...contentFiles]);
  const includeDirs = getModuleIncludeDirs(options.enabledModules, 'windows-msvc-win32');
  const includeDirsX64 = getModuleIncludeDirs(options.enabledModules, 'windows-msvc-x64');
  const libFiles = getModuleLibFiles(options.enabledModules, 'windows-msvc-win32');
  const libFilesX64 = getModuleLibFiles(options.enabledModules, 'windows-msvc-x64');
  const runtimeFiles = getModuleRuntimeFiles(options.enabledModules, 'windows-msvc-win32');
  const runtimeFilesX64 = getModuleRuntimeFiles(options.enabledModules, 'windows-msvc-x64');
  const hasFbro = options.enabledModules.some(module => module.manifest.id === 'lingbuilder.fbro.browser');
  const hasCryptoSdk = usesCryptoSdk(options.enabledModules);

  await fs.mkdir(options.projectDir, { recursive: true });
  await Promise.all([
    fs.writeFile(solutionPath, generateSolution(projectName, projectGuid), 'utf8'),
    fs.writeFile(projectPath, generateVcxproj({
      projectGuid,
      projectName,
      sourceFiles,
      noneFiles,
      includeDirs,
      includeDirsX64,
      libFiles,
      libFilesX64,
      runtimeFiles,
      runtimeFilesX64,
      hasFbro,
      fbroRuntimeFromBuildBin: options.fbroRuntimeFromBuildBin,
      contentFiles,
      requiredCppStandard: options.requiredCppStandard ?? (hasCryptoSdk ? 20 : undefined),
      requiresDynamicCrt: options.requiresDynamicCrt ?? hasCryptoSdk
    }), 'utf8'),
    fs.writeFile(filtersPath, generateFilters(sourceFiles, noneFiles), 'utf8')
  ]);

  return {
    projectName,
    solutionPath,
    projectPath,
    filtersPath,
    files: [solutionPath, projectPath, filtersPath]
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
    .filter(file => !/\.(c|cc|cpp|cxx)$/i.test(file));
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
  }), ...(usesCryptoSdk(enabledModules) ? ['modules/lingbuilder.crypto.sdk/include'] : [])]);
}

function getModuleLibFiles(enabledModules: InstalledModule[], targetId = 'windows-msvc-win32'): string[] {
  const architecture = targetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  return unique([...enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    return (getPreferredModuleTarget(module, targetId)?.libs || [])
      .map(file => isBuiltinModule(module)
        ? normalizeSlash(file)
        : normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
  }), ...(usesCryptoSdk(enabledModules) ? [`modules/lingbuilder.crypto.sdk/lib/${architecture}/botan-3.lib`] : [])]);
}

function getModuleRuntimeFiles(enabledModules: InstalledModule[], targetId = 'windows-msvc-win32'): string[] {
  const architecture = targetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
  return unique([...enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    return (getPreferredModuleTarget(module, targetId)?.runtimeFiles || [])
      .map(file => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
  }), ...(usesCryptoSdk(enabledModules) ? [`modules/lingbuilder.crypto.sdk/bin/${architecture}/botan-3.dll`] : [])]);
}

function usesCryptoSdk(enabledModules: InstalledModule[]): boolean {
  return enabledModules.some(module => CRYPTO_SDK_MODULE_IDS.includes(module.manifest.id as typeof CRYPTO_SDK_MODULE_IDS[number]));
}

function generateSolution(projectName: string, projectGuid: string): string {
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
  sourceFiles: string[];
  noneFiles: string[];
  includeDirs: string[];
  includeDirsX64: string[];
  libFiles: string[];
  libFilesX64: string[];
  runtimeFiles: string[];
  runtimeFilesX64: string[];
  hasFbro: boolean;
  fbroRuntimeFromBuildBin?: boolean;
  contentFiles: string[];
  requiredCppStandard?: 17 | 20;
  requiresDynamicCrt?: boolean;
}): string {
  const includeDirectories = options.includeDirs.map(toWindowsPath).join(';');
  const additionalIncludeDirectories = includeDirectories
    ? `${xmlEscape(includeDirectories)};%(AdditionalIncludeDirectories)`
    : '%(AdditionalIncludeDirectories)';
  const additionalDependencies = [
    'user32.lib',
    'gdi32.lib',
    'comctl32.lib',
    ...options.libFiles.map(toWindowsPath)
  ].join(';');
  const additionalIncludeDirectoriesX64 = options.includeDirsX64.length
    ? `${xmlEscape(options.includeDirsX64.map(toWindowsPath).join(';'))};%(AdditionalIncludeDirectories)`
    : '%(AdditionalIncludeDirectories)';
  const additionalDependenciesX64 = ['user32.lib', 'gdi32.lib', 'comctl32.lib', ...options.libFilesX64.map(toWindowsPath)].join(';');
  const postBuild = generatePostBuildCommand(options.runtimeFiles, options.contentFiles);
  const postBuildX64 = generatePostBuildCommand(
    options.runtimeFilesX64,
    options.contentFiles,
    options.hasFbro,
    options.fbroRuntimeFromBuildBin
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

  return `<?xml version="1.0" encoding="utf-8"?>
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
    <WindowsTargetPlatformVersion>10.0</WindowsTargetPlatformVersion>
  </PropertyGroup>
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.Default.props" />
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'" Label="Configuration">
    <ConfigurationType>Application</ConfigurationType>
    <UseDebugLibraries>${useDebugLibraries}</UseDebugLibraries>
    <PlatformToolset>v143</PlatformToolset>
    <CharacterSet>Unicode</CharacterSet>
  </PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|Win32'" Label="Configuration">
    <ConfigurationType>Application</ConfigurationType>
    <UseDebugLibraries>false</UseDebugLibraries>
    <PlatformToolset>v143</PlatformToolset>
    <WholeProgramOptimization>true</WholeProgramOptimization>
    <CharacterSet>Unicode</CharacterSet>
  </PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'" Label="Configuration"><ConfigurationType>Application</ConfigurationType><UseDebugLibraries>${useDebugLibraries}</UseDebugLibraries><PlatformToolset>v143</PlatformToolset><CharacterSet>Unicode</CharacterSet></PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'" Label="Configuration"><ConfigurationType>Application</ConfigurationType><UseDebugLibraries>false</UseDebugLibraries><PlatformToolset>v143</PlatformToolset><WholeProgramOptimization>true</WholeProgramOptimization><CharacterSet>Unicode</CharacterSet></PropertyGroup>
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
  ${options.hasFbro ? `<Target Name="ValidateFbroArchitecture" BeforeTargets="PrepareForBuild" Condition="'$(Platform)'!='x64'">
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
      <EnableCOMDATFolding>true</EnableCOMDATFolding>
      <OptimizeReferences>true</OptimizeReferences>
      <AdditionalDependencies>${xmlEscape(additionalDependencies)};%(AdditionalDependencies)</AdditionalDependencies>
    </Link>${postBuild}
  </ItemDefinitionGroup>
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'"><ClCompile><WarningLevel>Level3</WarningLevel><SDLCheck>true</SDLCheck><PreprocessorDefinitions>${debugPreprocessorDefinitionsX64}</PreprocessorDefinitions><ConformanceMode>true</ConformanceMode><LanguageStandard>${languageStandard}</LanguageStandard>${runtimeLibrary}<AdditionalIncludeDirectories>${additionalIncludeDirectoriesX64}</AdditionalIncludeDirectories><AdditionalOptions>/utf-8 %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Windows</SubSystem><AdditionalDependencies>${xmlEscape(additionalDependenciesX64)};%(AdditionalDependencies)</AdditionalDependencies></Link>${postBuildX64}</ItemDefinitionGroup>
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'"><ClCompile><WarningLevel>Level3</WarningLevel><FunctionLevelLinking>true</FunctionLevelLinking><IntrinsicFunctions>true</IntrinsicFunctions><SDLCheck>true</SDLCheck><PreprocessorDefinitions>NDEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)</PreprocessorDefinitions><ConformanceMode>true</ConformanceMode><LanguageStandard>${languageStandard}</LanguageStandard>${runtimeLibrary}<AdditionalIncludeDirectories>${additionalIncludeDirectoriesX64}</AdditionalIncludeDirectories><AdditionalOptions>/utf-8 %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Windows</SubSystem><EnableCOMDATFolding>true</EnableCOMDATFolding><OptimizeReferences>true</OptimizeReferences><AdditionalDependencies>${xmlEscape(additionalDependenciesX64)};%(AdditionalDependencies)</AdditionalDependencies></Link>${postBuildX64}</ItemDefinitionGroup>
${generateFileItems('ClCompile', options.sourceFiles)}${generateFileItems('None', options.noneFiles)}
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.targets" />
  <ImportGroup Label="ExtensionTargets" />
</Project>
`;
}

function generateFilters(sourceFiles: string[], noneFiles: string[]): string {
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
  </ItemGroup>
${generateFilterItems('ClCompile', sourceFiles, '源文件')}${generateFilterItems('None', noneFiles, '生成资源')}</Project>
`;
}

function generateFileItems(kind: 'ClCompile' | 'None', files: string[]): string {
  if (files.length === 0) return '';
  const items = files
    .map(file => `    <${kind} Include="${xmlEscape(toWindowsPath(file))}" />`)
    .join('\n');
  return `  <ItemGroup>\n${items}\n  </ItemGroup>\n`;
}

function generateFilterItems(kind: 'ClCompile' | 'None', files: string[], filter: string): string {
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
  fbroRuntimeFromBuildBin = false
): string {
  const runtimeCommands = runtimeFiles
    .map(file => `if exist "$(ProjectDir)${toWindowsPath(file)}" copy /Y "$(ProjectDir)${toWindowsPath(file)}" "$(OutDir)"`);
  const contentCommands = contentFiles.flatMap(file => {
    const windowsFile = toWindowsPath(file);
    const destinationDirectory = path.win32.dirname(windowsFile);
    return [
      `if not exist "$(OutDir)${destinationDirectory}" mkdir "$(OutDir)${destinationDirectory}"`,
      `if exist "$(ProjectDir)${windowsFile}" copy /Y "$(ProjectDir)${windowsFile}" "$(OutDir)${windowsFile}"`
    ];
  });
  const fbroCommands = materializeFbro
    ? [`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(ProjectDir)modules\\lingbuilder.fbro.browser\\materialize-fbro-runtime.ps1" -Destination "$(TargetDir)."${fbroRuntimeFromBuildBin ? ' -RuntimeRoot "$(ProjectDir)bin"' : ''}`]
    : [];
  const commands = [...runtimeCommands, ...contentCommands, ...fbroCommands].join('\r\n');
  if (!commands) return '';
  return `
    <PostBuildEvent>
      <Command>${xmlEscape(commands)}</Command>
    </PostBuildEvent>`;
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
