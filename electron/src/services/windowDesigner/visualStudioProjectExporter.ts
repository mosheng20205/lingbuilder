import fs from 'node:fs/promises';
import path from 'node:path';
import { InstalledModule } from '../modules/types';
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
  const noneFiles = getNoneFiles(options.generatedFiles);
  const includeDirs = getModuleIncludeDirs(options.enabledModules);
  const libFiles = getModuleLibFiles(options.enabledModules);
  const runtimeFiles = getModuleRuntimeFiles(options.enabledModules);

  await fs.mkdir(options.projectDir, { recursive: true });
  await Promise.all([
    fs.writeFile(solutionPath, generateSolution(projectName, projectGuid), 'utf8'),
    fs.writeFile(projectPath, generateVcxproj({
      projectGuid,
      projectName,
      sourceFiles,
      noneFiles,
      includeDirs,
      libFiles,
      runtimeFiles
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
      return (module.manifest.contributes?.cpp?.sources || [])
        .map(file => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
    })
  ]);
}

function getNoneFiles(generatedFiles: LingCppNativeProjectFile[]): string[] {
  return generatedFiles
    .map(file => normalizeSlash(file.relativePath))
    .filter(file => !/\.(c|cc|cpp|cxx)$/i.test(file));
}

function getModuleIncludeDirs(enabledModules: InstalledModule[]): string[] {
  return unique(enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    const cpp = module.manifest.contributes?.cpp;
    if (!cpp) return [];
    const explicitDirs = (cpp.includeDirs || []).map(dir => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(dir))));
    const headerDirs = (cpp.headers || []).map(header => {
      const firstSegment = normalizeSlash(header).split('/')[0];
      return firstSegment ? normalizeSlash(path.posix.join('modules', moduleId, firstSegment)) : '';
    }).filter(Boolean);
    return [...explicitDirs, ...headerDirs];
  }));
}

function getModuleLibFiles(enabledModules: InstalledModule[]): string[] {
  return unique(enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    return (module.manifest.contributes?.cpp?.libs || [])
      .map(file => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
  }));
}

function getModuleRuntimeFiles(enabledModules: InstalledModule[]): string[] {
  return unique(enabledModules.flatMap(module => {
    const moduleId = module.manifest.id;
    return (module.manifest.contributes?.cpp?.runtimeFiles || [])
      .map(file => normalizeSlash(path.posix.join('modules', moduleId, normalizeSlash(file))));
  }));
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
    '\tEndGlobalSection',
    '\tGlobalSection(ProjectConfigurationPlatforms) = postSolution',
    `\t\t{${projectGuid}}.Debug|Win32.ActiveCfg = Debug|Win32`,
    `\t\t{${projectGuid}}.Debug|Win32.Build.0 = Debug|Win32`,
    `\t\t{${projectGuid}}.Release|Win32.ActiveCfg = Release|Win32`,
    `\t\t{${projectGuid}}.Release|Win32.Build.0 = Release|Win32`,
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
  libFiles: string[];
  runtimeFiles: string[];
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
  const postBuild = generatePostBuildCommand(options.runtimeFiles);

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
    <UseDebugLibraries>true</UseDebugLibraries>
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
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.props" />
  <ImportGroup Label="ExtensionSettings" />
  <ImportGroup Label="Shared" />
  <ImportGroup Label="PropertySheets" Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'">
    <Import Project="$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props" Condition="exists('$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props')" Label="LocalAppDataPlatform" />
  </ImportGroup>
  <ImportGroup Label="PropertySheets" Condition="'$(Configuration)|$(Platform)'=='Release|Win32'">
    <Import Project="$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props" Condition="exists('$(UserRootDir)\\Microsoft.Cpp.$(Platform).user.props')" Label="LocalAppDataPlatform" />
  </ImportGroup>
  <PropertyGroup Label="UserMacros" />
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'">
    <ClCompile>
      <WarningLevel>Level3</WarningLevel>
      <SDLCheck>true</SDLCheck>
      <PreprocessorDefinitions>WIN32;_DEBUG;UNICODE;_UNICODE;%(PreprocessorDefinitions)</PreprocessorDefinitions>
      <ConformanceMode>true</ConformanceMode>
      <LanguageStandard>stdcpp17</LanguageStandard>
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
      <LanguageStandard>stdcpp17</LanguageStandard>
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

function generatePostBuildCommand(runtimeFiles: string[]): string {
  if (runtimeFiles.length === 0) return '';
  const commands = runtimeFiles
    .map(file => `if exist "$(ProjectDir)${toWindowsPath(file)}" copy /Y "$(ProjectDir)${toWindowsPath(file)}" "$(OutDir)"`)
    .join('\r\n');
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
