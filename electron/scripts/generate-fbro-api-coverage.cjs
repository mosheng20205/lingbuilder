const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_SOURCE = 'T:\\编程工具\\win_android\\plugins\\vprj_win\\classlib\\sys\\FBrowser';
const EXPECTED_HEADER_COUNT = 77;
const EXPECTED_SIGNATURE_COUNT = 1079;
const IMPLEMENTED_EVENT_NAMES = new Map([
  ['OnAfterCreated', 'Created'],
  ['OnLoadEnd', 'LoadEnd'],
  ['OnAddressChange', 'AddressChanged'],
  ['OnBeforePopup', 'BeforePopup'],
  ['OnTitleChange', 'TitleChanged'],
  ['OnBeforeClose', 'Closed'],
  ['OnLoadError', 'Error'],
  ['OnCertificateError', 'CertificateError'],
  ['OnDragEnter', 'DragEnter']
]);

const IMPLEMENTED_ADVANCED_EXPORTS = new Set([
  'FBroHsValue_Create', 'FBroHsValue_IsValid', 'FBroHsValue_IsOwned',
  'FBroHsValue_IsReadOnly', 'FBroHsValue_Copy', 'FBroHsValue_GetType',
  'FBroHsValue_GetBool', 'FBroHsValue_GetInt', 'FBroHsValue_GetDouble',
  'FBroHsValue_GetString', 'FBroHsValue_SetNull', 'FBroHsValue_SetBool',
  'FBroHsValue_SetInt', 'FBroHsValue_SetDouble', 'FBroHsValue_SetString',
  'FBroHsValue_IsSame', 'FBroHsValue_IsEqual', 'FBroHsValue_GetBinary',
  'FBroHsValue_SetBinary', 'FBroHsValue_GetDictionary', 'FBroHsValue_GetList',
  'FBroHsValue_SetDictionary', 'FBroHsValue_SetList',
  'FBroHsBinaryValue_Create', 'FBroHsBinaryValue_GetSize', 'FBroHsBinaryValue_GetData',
  'FBroHsDictionaryValue_Create', 'FBroHsDictionaryValue_IsValid',
  'FBroHsDictionaryValue_IsOwned', 'FBroHsDictionaryValue_IsReadOnly',
  'FBroHsDictionaryValue_Copy', 'FBroHsDictionaryValue_GetSize',
  'FBroHsDictionaryValue_Clear', 'FBroHsDictionaryValue_HasKey',
  'FBroHsDictionaryValue_Remove', 'FBroHsDictionaryValue_GetType',
  'FBroHsDictionaryValue_GetBool', 'FBroHsDictionaryValue_GetInt',
  'FBroHsDictionaryValue_GetDouble', 'FBroHsDictionaryValue_GetString',
  'FBroHsDictionaryValue_SetNull', 'FBroHsDictionaryValue_SetBool',
  'FBroHsDictionaryValue_SetInt', 'FBroHsDictionaryValue_SetDouble',
  'FBroHsDictionaryValue_SetString', 'FBroHsDictionaryValue_IsSame',
  'FBroHsDictionaryValue_IsEqual', 'FBroHsDictionaryValue_GetKeys',
  'FBroHsDictionaryValue_GetValue', 'FBroHsDictionaryValue_GetBinary',
  'FBroHsDictionaryValue_GetDictionary', 'FBroHsDictionaryValue_GetList',
  'FBroHsDictionaryValue_SetValue', 'FBroHsDictionaryValue_SetBinary',
  'FBroHsDictionaryValue_SetDictionary', 'FBroHsDictionaryValue_SetList',
  'FBroCefStringList_Size', 'FBroCefStringList_GetValue',
  'FBroHsListValue_Create', 'FBroHsListValue_IsValid', 'FBroHsListValue_IsOwned',
  'FBroHsListValue_IsReadOnly', 'FBroHsListValue_Copy', 'FBroHsListValue_SetSize',
  'FBroHsListValue_GetSize', 'FBroHsListValue_Clear', 'FBroHsListValue_Remove',
  'FBroHsListValue_GetType', 'FBroHsListValue_GetBool', 'FBroHsListValue_GetInt',
  'FBroHsListValue_GetDouble', 'FBroHsListValue_GetString',
  'FBroHsListValue_SetNull', 'FBroHsListValue_SetBool', 'FBroHsListValue_SetInt',
  'FBroHsListValue_SetDouble', 'FBroHsListValue_SetString', 'FBroHsListValue_IsSame',
  'FBroHsListValue_IsEqual', 'FBroHsListValue_GetValue', 'FBroHsListValue_GetBinary',
  'FBroHsListValue_GetDictionary', 'FBroHsListValue_GetList',
  'FBroHsListValue_SetValue', 'FBroHsListValue_SetBinary',
  'FBroHsListValue_SetDictionary', 'FBroHsListValue_SetList',
  'FBroStream_CreateForFile', 'FBroStream_CreateForData', 'FBroStream_Read',
  'FBroStream_Seek', 'FBroStream_Tell', 'FBroStream_Eof', 'FBroStream_MayBlock',
  'FBroHsBrowserHost_DownloadImage', 'FBroHsImage_IsEmpty', 'FBroHsImage_GetWidth',
  'FBroHsImage_GetHeight', 'FBroHsImage_GetRepresentationInfo', 'FBroHsImage_GetAsBitmap',
  'FBroHsImage_GetAsJPEG', 'FBroHsImage_GetAsPNG',
  'FBroHsSSLInfo_GetCertStatus', 'FBroHsSSLInfo_GetX509Certificate',
  'FBroHsX509Certificate_GetSubject', 'FBroHsX509Certificate_GetIssuer',
  'FBroHsX509Certificate_GetSerialNumber', 'FBroHsX509Certificate_GetDEREncoded',
  'FBroHsX509Certificate_GetPEMEncoded', 'FBroHsX509Certificate_GetValidStart',
  'FBroHsX509Certificate_GetValidExpiry', 'FBroHsX509Certificate_GetIssuerChainSize',
  'FBroHsX509Certificate_GetDEREncodedIssuerChain', 'FBroHsX509Certificate_GetPEMEncodedIssuerChain',
  'FBroHsX509CertPrincipal_GetDisplayName', 'FBroHsX509CertPrincipal_GetCommonName',
  'FBroHsX509CertPrincipal_GetLocalityName', 'FBroHsX509CertPrincipal_GetStateOrProvinceName',
  'FBroHsX509CertPrincipal_GetCountryName', 'FBroHsX509CertPrincipal_GetOrganizationNames',
  'FBroHsX509CertPrincipal_GetOrganizationUnitNames',
  'FBroBinaryValueList_Size', 'FBroBinaryValueList_GetValue',
  'FBroHsDragData_Clone', 'FBroHsDragData_HasImage', 'FBroHsDragData_GetImage',
  'FBroHsBrowserHost_GetRequestContext', 'FBroHsRequestContext_GetCookieManager',
  'FBroHsCookieManager_GetGlobalManager', 'FBroHsCookieManager_VisitAllCookies',
  'FBroHsCookieManager_VisitUrlCookies', 'FBroHsCookieManager_SetCookie',
  'FBroHsCookieManager_DeleteCookies', 'FBroHsCookieManager_FlushStore',
  'FBroHsBrowser_ClearCacheData', 'FBroHsBrowser_ClearGlobalCacheData',
  'FBroHsBrowserHost_StartDownload', 'FBroHsBrowserHost_Print',
  'FBroHsBrowserHost_PrintToPDF',
  'FBroHsVIPControl_PageCaptureScreenshot',
  'FBroHsBrowser_GetFocusedFrame', 'FBroHsBrowser_GetFrameById',
  'FBroHsBrowser_GetFrameByName', 'FBroHsBrowser_GetFrameIdentifiers',
  'FBroHsBrowser_GetFrameNames', 'FBroHsBrowserFrame_IsValid',
  'FBroHsBrowserFrame_GetURL', 'FBroHsBrowserFrame_Undo',
  'FBroHsBrowserFrame_Redo', 'FBroHsBrowserFrame_Cut',
  'FBroHsBrowserFrame_Copy', 'FBroHsBrowserFrame_Paste',
  'FBroHsBrowserFrame_Delete', 'FBroHsBrowserFrame_SelectAll',
  'FBroHsBrowserFrame_ViewSource', 'FBroHsBrowserFrame_IsMain',
  'FBroHsBrowserFrame_IsFocused', 'FBroHsBrowserFrame_GetName',
  'FBroHsBrowserFrame_GetIdentifier', 'FBroHsBrowserFrame_ExecuteJavaScript',
  'FBroHsBrowserFrame_GetParent', 'FBroHsBrowserFrame_GetBrowser'
]);

const IMPLEMENTED_VIP_EXPORT_PATTERNS = [
  /^FBroHsVIPControl_SetVir/u,
  /^FBroHsVIPUserAgentData_/u,
  /^FBroHsVIPControl_Set(?:Audio|Canvas|WebGL)FingerPrint_(?:constant|random)$/u,
  /^FBroHsVIPControl_SetDisable/u,
  /^FBroHsDevToolsDOM_/u,
  /^FBroHsVIPRequestContext_/u,
  /^FBroHsVIPResourceHandler_/u,
  /^FBroHsVIPResponseFilter_/u,
  /^FBroHsOnlineLicenseControl_GetShowLicense/u
];

const IMPLEMENTED_VIP_SUPPORT_EXPORTS = new Set([
  'FBroHsVIPControl_SetPlugins', 'FBroHsVIPControl_SetSSLCipher',
  'FBroHsVIPControl_SetTouchEventEmulationEnabled', 'FBroHsVIPControl_SetWebFeatureKernel',
  'FBroBrowser_IsLicenceKey', 'FBroHsBrowser_GetExpirationTime', 'FBroHsBrowser_GetFunctionStr',
  'FBroHsBrowser_GetMachineCode', 'FBroHsBrowser_GetRegistrationTime', 'FBroHsBrowser_GetVersionStr',
  'FBroHsBrowser_SetLicenceKey', 'FBroHsVIPControl_ClearAllData', 'FBroHsVIPControl_ClearS5Auth',
  'FBroHsVIPControl_EnableWebsocketClientHook', 'FBroHsVIPControl_GetBrowser',
  'FBroHsVIPControl_SetCSSKernel', 'FBroHsVIPControl_SetEmitTouchEventsForMouse',
  'FBroHsVIPControl_SetS5Auth', 'FBroHsVIPControl_SetV8Kernel', 'FBroHsVIPGlobal_SetS5Auth',
  'FBroHsVIPControl_AddResourceHandlerChangeData', 'FBroHsVIPControl_AddResourceHandlerChangeFile',
  'FBroHsVIPControl_DeleteResourceHandlerChangeData', 'FBroHsVIPControl_DeleteResourceHandlerAllData',
  'FBroHsVIPControl_AddResponseFilterChangeData', 'FBroHsVIPControl_DeletResponseFiltereChangeData',
  'FBroHsVIPControl_DeleteResponseFilterAllData',
  'FBroHsVIPControl_AddDevToolsMessageObserver', 'FBroHsVIPControl_DeleteDevToolsMessageObserver',
  'FBroHsVIPControl_AddTabAt', 'FBroHsVIPControl_DispatchKeyEvent',
  'FBroHsVIPControl_DispatchMouseEvent', 'FBroHsVIPControl_DispatchTouchEvent',
  'FBroHsVIPControl_ExecuteDevToolsMethod', 'FBroHsVIPControl_PageGetContextID',
  'FBroHsVIPControl_RuntimeEnable', 'FBroHsVIPControl_RuntimeEvaluate',
  'FBroHsVIPControl_RuntimeEvaluate_FrameID', 'FBroHsVIPControl_SendDevToolsMessage',
  'FBroSetVipEvent', 'FBroHsVIPCommandLine_SetProxy',
  'FBroCefStringList_Creat', 'FBroCefStringList_Add',
  'FBroDoubleString_Creat', 'FBroDoubleString_Add', 'FBroDoubleString_Size',
  'FBroDoubleString_ToBegin', 'FBroDoubleString_ToNext',
  'FBroDoubleString_GetCurrentData_Key', 'FBroDoubleString_GetCurrentData_Value'
]);

function isImplementedAdvancedExport(officialName) {
  return IMPLEMENTED_ADVANCED_EXPORTS.has(officialName)
    || IMPLEMENTED_VIP_SUPPORT_EXPORTS.has(officialName)
    || IMPLEMENTED_VIP_EXPORT_PATTERNS.some(pattern => pattern.test(officialName));
}

const NOT_APPLICABLE_EXPORTS = new Map([
  ['FBroHsBrowserHost_RunFileDialog', 'FBro 5.38.49 的辅助导出在 CEF UI 线程实测会阻塞且不创建对话框；Windows x64 高层命令改用独立 STA IFileDialog 和受管任务回调。']
]);

const HIGH_LEVEL_EXPORTS = new Set([
  'FBroHsBrowser_ClearProxy', 'FBroHsBrowser_GetMainFrame', 'FBroHsBrowser_GetVIPControl',
  'FBroHsBrowser_CanGoBack', 'FBroHsBrowser_CanGoForward', 'FBroHsBrowser_GoBack',
  'FBroHsBrowser_GetIdentifier', 'FBroHsBrowser_GoForward', 'FBroHsBrowser_HasDocument',
  'FBroHsBrowser_IsLoading', 'FBroHsBrowser_IsPopup', 'FBroHsBrowser_IsSame',
  'FBroHsBrowser_Reload', 'FBroHsBrowser_ReloadIgnoreCache',
  'FBroHsBrowser_SetProxy', 'FBroHsBrowser_StopLoad',
  'FBroHsBrowserFrame_ExecuteJavaScriptToHasReturn', 'FBroHsBrowserFrame_LoadURL',
  'FBroHsBrowserHost_CloseBrowser', 'FBroHsBrowserHost_CloseDevTools', 'FBroHsBrowserHost_Find',
  'FBroHsBrowserHost_GetZoomLevel', 'FBroHsBrowserHost_HasDevTools',
  'FBroHsBrowserHost_HasView', 'FBroHsBrowserHost_IsAudioMuted', 'FBroHsBrowserHost_SendFocusEvent',
  'FBroHsBrowserHost_SetAudioMuted', 'FBroHsBrowserHost_SetAutoResizeEnabled',
  'FBroHsBrowserHost_SetFocus', 'FBroHsBrowserHost_SetZoomLevel',
  'FBroHsBrowserHost_StopFinding', 'FBroHsBrowserHost_TryCloseBrowser', 'FBroHsCreate', 'FBroHsInitPro',
  'FBroHsOnlineLicenseControl_GetError', 'FBroHsOnlineLicenseControl_SetKey',
  'FBroHsRequestContext_SetPreference', 'FBroHsVIPControl_ClearFingerCount',
  'FBroHsVIPControl_GetFingerCount', 'FBroHsVIPControl_IsNULL',
  'FBroHsVIPControl_SetAudioFingerPrint_random', 'FBroHsVIPControl_SetCanvasFingerPrint_random',
  'FBroHsVIPControl_SetVirDeviceMemory', 'FBroHsVIPControl_SetVirDevicePixelRatio',
  'FBroHsVIPControl_SetVirHardwareConcurrency', 'FBroHsVIPControl_SetVirLanguages',
  'FBroHsVIPControl_SetVirPlatform', 'FBroHsVIPControl_SetVirScreenHeightAndWidth',
  'FBroHsVIPControl_SetVirWebglrenderer', 'FBroHsVIPControl_SetVirWebglvendor',
  'FBroHsVIPControl_SetWebGLFingerPrint_random', 'FBroSetV8DefaultsHeapSize', 'FBroShutdown',
  'FBroString_Creat', 'FBroString_GetWcharData', 'FBroString_WSize'
]);

const INTERNAL_NAME_PATTERNS = [
  /MallocManger_(?:New|Free)$/u,
  /(?:InitEvent|Event)Destroy$/u
];

const MODULE_RULES = [
  ['lingbuilder.fbro.vip', /VIP|Finger|UserAgentData/iu],
  ['lingbuilder.fbro.osr', /RenderHandler|SharedMemoryRegion|DragData|SendMouse|SendKey|Ime|ScreenInfo|Paint/iu],
  ['lingbuilder.fbro.network', /Request|Response|PostData|URLRequest|WebSocket|WSS|Server|Socket|Resource|Scheme|SSL/iu],
  ['lingbuilder.fbro.session', /RequestContext|Cookie|Extension|Proxy|Preference|Cache/iu],
  ['lingbuilder.fbro.transfer', /Download|Print|Pdf|Image|FileDialog|Screenshot/iu],
  ['lingbuilder.fbro.automation', /Frame|Dom|V8|ProcessMessage|Query|TaskRunner|DevTools|Command/iu],
  ['lingbuilder.fbro.events', /Event|Callback|Handler|Hook|Closure/iu],
  ['lingbuilder.fbro.objects', /Value|Dictionary|List|String|Stream|Certificate|Principal|MenuModel|MiddleData|ContextIdData/iu]
];

const MODULE_LABELS = {
  'lingbuilder.fbro.browser': '浏览器',
  'lingbuilder.fbro.events': '事件',
  'lingbuilder.fbro.session': '会话',
  'lingbuilder.fbro.transfer': '传输',
  'lingbuilder.fbro.automation': '自动化',
  'lingbuilder.fbro.vip': '指纹',
  'lingbuilder.fbro.network': '网络',
  'lingbuilder.fbro.osr': '离屏渲染',
  'lingbuilder.fbro.objects': '高级对象'
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.FBRO_OFFICIAL_ROOT || DEFAULT_SOURCE);
  const includeRoot = path.join(sourceRoot, 'src', 'env', 'FBrowserCEF3lib');
  const outputPath = path.resolve(args.output || path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'fbroApiCoverage.generated.json'));
  const markdownPath = path.resolve(args.markdown || path.join(repoRoot, 'FBRO_API_COVERAGE.md'));
  const bridgeSource = await fs.readFile(path.join(repoRoot, 'electron', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  for (const officialName of [...HIGH_LEVEL_EXPORTS, ...IMPLEMENTED_ADVANCED_EXPORTS, ...IMPLEMENTED_VIP_SUPPORT_EXPORTS]) {
    if (!bridgeSource.includes(officialName)) throw new Error(`已实现封装标记缺少真实 Bridge 调用：${officialName}`);
  }

  const headerNames = (await fs.readdir(includeRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.h'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (headerNames.length !== EXPECTED_HEADER_COUNT) {
    throw new Error(`FBro 公共头文件数量漂移：期望 ${EXPECTED_HEADER_COUNT}，实际 ${headerNames.length}。`);
  }

  const signatures = [];
  for (const header of headerNames) {
    const source = await fs.readFile(path.join(includeRoot, header), 'utf8');
    for (const declaration of extractExportDeclarations(source)) {
      const officialName = extractFunctionName(declaration);
      if (!officialName) throw new Error(`无法识别导出函数名：${header}: ${declaration}`);
      signatures.push({ header, officialName, officialSignature: declaration });
    }
  }

  const unique = new Map();
  for (const item of signatures) {
    const existing = unique.get(item.officialSignature);
    if (existing) existing.declaredInHeaders.push(item.header);
    else unique.set(item.officialSignature, { ...item, declaredInHeaders: [item.header] });
  }
  const sorted = [...unique.values()].sort((left, right) =>
    left.header.localeCompare(right.header, 'en')
      || left.officialName.localeCompare(right.officialName, 'en')
      || left.officialSignature.localeCompare(right.officialSignature, 'en'));
  for (const item of sorted) {
    if (isImplementedAdvancedExport(item.officialName) && !bridgeSource.includes(item.officialName)) {
      throw new Error(`已实现封装标记缺少真实 Bridge 调用：${item.officialName}`);
    }
  }
  const signatureGroups = new Map();
  for (const item of sorted) {
    const group = signatureGroups.get(item.officialName) || [];
    group.push(item);
    signatureGroups.set(item.officialName, group);
  }
  if (signatureGroups.size !== EXPECTED_SIGNATURE_COUNT) {
    throw new Error(`FBro 导出签名族数量漂移：期望 ${EXPECTED_SIGNATURE_COUNT}，实际 ${signatureGroups.size}（原始重载声明 ${sorted.length}）。`);
  }

  const entries = [...signatureGroups.values()].map(group => {
    const item = group[0];
    const officialSignatures = group.map(entry => entry.officialSignature);
    const signatureHash = sha256(officialSignatures.join('\n'));
    const moduleId = classifyModule(item.header, item.officialName);
    const classification = classifyCoverage(item.officialName);
    const overloads = group.map((entry, index) => createWrapperSignatureSpec(entry.officialSignature, signatureHash, index));
    const terminology = translateOperation(item.officialName.split('_').pop() || item.officialName);
    return {
      functionId: `fbro.${path.basename(item.header, '.h').toLowerCase()}.${item.officialName.toLowerCase()}.${signatureHash.slice(0, 12)}`,
      signatureHash,
      header: item.header,
      declaredInHeaders: [...new Set(group.flatMap(entry => entry.declaredInHeaders))],
      officialName: item.officialName,
      officialSignature: item.officialSignature,
      officialSignatures,
      overloadCount: officialSignatures.length,
      wrapperSymbol: `LB_FBroV2_${signatureHash.slice(0, 16)}`,
      overloads,
      moduleId,
      chineseName: createChineseCommandName(moduleId, terminology.text, signatureHash),
      terminologyStatus: terminology.untranslatedTokens.length === 0 ? 'translated' : 'needsReview',
      untranslatedTokens: terminology.untranslatedTokens,
      englishAliases: [item.officialName],
      classification: classification.kind,
      implementationStatus: classification.kind === 'highLevel' || isImplementedAdvancedExport(item.officialName)
        ? 'implemented'
        : NOT_APPLICABLE_EXPORTS.has(item.officialName) ? 'notApplicable'
        : classification.kind === 'internal' ? 'notApplicable' : 'planned',
      classificationReason: classification.reason,
      safetyBoundary: classification.kind === 'internal'
        ? '不进入 .lcpp；仅供桥接层内部实现。'
        : '仅允许 UTF-16 JSON、类型化不透明句柄和受管缓冲区；禁止裸指针、CefRefPtr、STL 与任意地址。'
    };
  });

  const duplicateNames = entries.filter(entry => entry.overloadCount > 1)
    .map(entry => ({ name: entry.officialName, count: entry.overloadCount }));
  const summary = entries.reduce((result, entry) => {
    result[entry.classification] += 1;
    result[entry.implementationStatus] += 1;
    result.modules[entry.moduleId] = (result.modules[entry.moduleId] || 0) + 1;
    return result;
  }, { highLevel: 0, advancedSafe: 0, internal: 0, implemented: 0, planned: 0, notApplicable: 0, modules: {} });
  const versionHeader = await fs.readFile(path.join(includeRoot, 'FBroVersion.h'), 'utf8');
  const cefVersionHeader = await fs.readFile(path.join(includeRoot, 'include', 'cef_version.h'), 'utf8');
  const eventHeader = await fs.readFile(path.join(includeRoot, 'FBroHsEvent.h'), 'utf8');
  const eventCatalog = createEventCatalog(eventHeader);
  const catalog = {
    schemaVersion: 1,
    baseline: {
      fbroVersion: readFbroVersion(versionHeader),
      cefVersion: readDefine(cefVersionHeader, 'CEF_VERSION').split('+')[0],
      platform: 'windows-msvc-x64'
    },
    headerCount: headerNames.length,
    signatureCount: entries.length,
    rawDeclarationCount: sorted.length,
    duplicateNames,
    summary,
    headers: headerNames.map(header => ({
      header,
      signatureCount: entries.filter(entry => entry.header === header).length
    })),
    eventCatalog,
    signatures: entries
  };

  validateCatalog(catalog);
  const json = `${JSON.stringify(catalog, null, 2)}\n`;
  if (args.check) {
    const existing = await fs.readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== json) throw new Error(`FBro 覆盖清单已漂移，请运行 npm run module:fbro-coverage。`);
  } else {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, json, 'utf8');
    await fs.writeFile(markdownPath, renderMarkdown(catalog), 'utf8');
  }
  console.log(`FBro coverage: ${catalog.headerCount} headers, ${catalog.signatureCount} signatures, `
    + `${summary.implemented} implemented, ${summary.planned} planned, ${summary.internal} internal.`);
}

function createWrapperSignatureSpec(signature, familyHash, index) {
  const officialName = extractFunctionName(signature);
  const open = signature.indexOf('(');
  const close = signature.lastIndexOf(')');
  const returnType = signature.slice(0, open)
    .replace(/^DLLEXPORT\s+/u, '')
    .replace(/\bTEXPORTS\b/gu, '')
    .replace(new RegExp(`${officialName}\\s*$`, 'u'), '')
    .replace(/\s+/gu, ' ')
    .trim();
  const parameters = splitCppParameters(signature.slice(open + 1, close)).map((parameter, parameterIndex) => {
    const parsed = parseCppParameter(parameter, parameterIndex);
    return { ...parsed, ...describeCodec(parsed.cppType, false, parsed.name) };
  });
  const returnCodec = describeCodec(returnType, true, 'return');
  return {
    overloadId: `${familyHash.slice(0, 12)}-${index + 1}`,
    returnType,
    returnCodec,
    parameters,
    thread: inferThread(officialName),
    execution: inferExecution(officialName, parameters),
    ownership: returnCodec.codec === 'objectHandle' ? 'bridgeOwned' : returnCodec.codec === 'bufferHandle' ? 'callerReleases' : 'value'
  };
}

function splitCppParameters(value) {
  if (!value.trim() || value.trim() === 'void') return [];
  const result = [];
  let start = 0;
  let angle = 0;
  let parentheses = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '<') angle += 1;
    else if (character === '>') angle = Math.max(0, angle - 1);
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === ',' && angle === 0 && parentheses === 0) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function parseCppParameter(parameter, index) {
  const withoutDefault = parameter.replace(/\s*=\s*[^,]+$/u, '').trim();
  const functionPointer = withoutDefault.match(/\(\s*[*&]\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/u);
  if (functionPointer) return { name: functionPointer[1], cppType: withoutDefault.replace(functionPointer[1], '').replace(/\s+/gu, ' ').trim() };
  const nameMatch = withoutDefault.match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?$/u);
  const name = nameMatch?.[1] || `arg${index + 1}`;
  const cppType = nameMatch ? withoutDefault.slice(0, nameMatch.index).trim() : withoutDefault;
  return { name, cppType: cppType.replace(/\s+/gu, ' ') };
}

function describeCodec(cppType, isReturn, name) {
  const normalized = cppType.replace(/\bconst\b/gu, '').replace(/[&]/gu, '').replace(/\s+/gu, ' ').trim();
  const refPtr = normalized.match(/CefRefPtr\s*<\s*([^>]+)>/u);
  if (normalized === 'void') return { codec: 'void' };
  if (refPtr) return { codec: 'objectHandle', objectType: refPtr[1].trim() };
  if (/\b(?:bool|BOOL)\b/u.test(normalized)) return { codec: 'bool' };
  if (/\b(?:double|float)\b/u.test(normalized)) return { codec: 'double' };
  if (/\b(?:u?int(?:8|16|32|64)?_t|int|long|unsigned|size_t|DWORD|COLORREF)\b/u.test(normalized)
      || /::[A-Za-z_][A-Za-z0-9_]*$/u.test(normalized)) return { codec: 'integer' };
  if (/\b(?:CefString|FBroString|wchar_t\s*\*|char\s*\*)\b/u.test(normalized)) return { codec: 'utf16' };
  if (/\bHWND\b/u.test(normalized)) return { codec: 'hostWindowRef', source: 'designerControlName' };
  if (/\b(?:HANDLE|M_POINTER)\b/u.test(normalized) || /void\s*\*/u.test(normalized)) {
    return { codec: isReturn || /data|buffer|bytes/iu.test(name) ? 'bufferHandle' : 'opaqueHandle' };
  }
  if (/[*]/u.test(normalized) || /\b(?:POINT_|FBro|Cef)[A-Za-z0-9_]+\b/u.test(normalized)) return { codec: 'jsonStruct', schema: normalized.replace(/[\s*]/gu, '') };
  return { codec: 'integer', enumType: normalized };
}

function inferThread(officialName) {
  if (/V8|DOM|Render|ProcessMessage/iu.test(officialName)) return 'renderer';
  if (/Resource|Request|Response|Cookie|URLRequest|WebSocket|Scheme|Server/iu.test(officialName)) return 'io';
  if (/Browser|Frame|DevTools|Download|Print|Dialog|VIP/iu.test(officialName)) return 'ui';
  return 'any';
}

function inferExecution(officialName, parameters) {
  if (/Callback|Visit|Download|PrintToPDF|RunFileDialog|ExecuteDevTools|URLRequest/iu.test(officialName)
      || parameters.some(parameter => /callback|handler|visitor/iu.test(parameter.name))) return 'task';
  return 'sync';
}

function parseArgs(values) {
  const result = { source: '', output: '', markdown: '', check: false };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--source') result.source = values[++index] || '';
    else if (values[index] === '--output') result.output = values[++index] || '';
    else if (values[index] === '--markdown') result.markdown = values[++index] || '';
    else if (values[index] === '--check') result.check = true;
  }
  return result;
}

function extractExportDeclarations(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/\/\/[^\r\n]*/gu, ' ')
    .replace(/^\s*#\s*define\s+DLLEXPORT\b[^\r\n]*/gmu, ' ');
  const declarations = [];
  const pattern = /\bDLLEXPORT\b([\s\S]*?);/gu;
  let match;
  while ((match = pattern.exec(withoutComments)) !== null) {
    const normalized = `DLLEXPORT ${match[1]}`.replace(/\s+/gu, ' ').trim();
    if (/\([^;]*\)$/u.test(normalized)) declarations.push(normalized);
  }
  return declarations;
}

function extractFunctionName(declaration) {
  const open = declaration.indexOf('(');
  if (open < 0) return '';
  const prefix = declaration.slice(0, open).replace(/\bTEXPORTS\b/gu, ' ').trim();
  return prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/u)?.[1] || '';
}

function createEventCatalog(source) {
  const declarations = extractVirtualDeclarations(source);
  const unique = new Map();
  for (const declaration of declarations) {
    const eventName = extractFunctionName(declaration);
    if (!eventName) continue;
    const signatureHash = sha256(declaration);
    const returnPrefix = declaration.slice('virtual'.length, declaration.indexOf(eventName)).trim();
    const synchronous = returnPrefix !== 'void';
    const implementedName = IMPLEMENTED_EVENT_NAMES.get(eventName);
    const highFrequency = /(?:Paint|Mouse|Scroll|Progress|AudioStreamPacket|Cursor|Drag|ImeComposition|TextSelection)/u.test(eventName);
    const item = {
      eventId: `fbro.event.${eventName.toLowerCase()}.${signatureHash.slice(0, 12)}`,
      officialName: eventName,
      lingBuilderName: implementedName || eventName.replace(/^On/u, ''),
      signatureHash,
      officialSignature: declaration,
      synchronous,
      defaultAction: eventName === 'OnBeforePopup' ? 'cancel' : synchronous ? 'continue' : 'notify',
      timeoutMilliseconds: synchronous ? 2000 : 0,
      maxHz: /(?:OnPaint|OnAcceleratedPaint)/u.test(eventName) ? 60 : highFrequency ? 10 : 0,
      bridgeStatus: implementedName ? 'implemented' : 'planned'
    };
    unique.set(`${eventName}:${signatureHash}`, item);
  }
  return [...unique.values()].sort((left, right) => left.officialName.localeCompare(right.officialName, 'en')
    || left.signatureHash.localeCompare(right.signatureHash, 'en'));
}

function extractVirtualDeclarations(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\/\/[^\r\n]*/gu, ' ');
  const declarations = [];
  const pattern = /\bvirtual\b/gu;
  let match;
  while ((match = pattern.exec(clean)) !== null) {
    let parentheses = 0;
    let sawParameters = false;
    let end = -1;
    for (let index = pattern.lastIndex; index < clean.length; index += 1) {
      const character = clean[index];
      if (character === '(') { parentheses += 1; sawParameters = true; }
      else if (character === ')') parentheses = Math.max(0, parentheses - 1);
      else if (sawParameters && parentheses === 0 && (character === '{' || character === ';')) { end = index; break; }
    }
    if (end < 0) continue;
    const declaration = clean.slice(match.index, end).replace(/\s+/gu, ' ').trim();
    if (/\([^)]*\)/u.test(declaration)) declarations.push(declaration);
    pattern.lastIndex = end + 1;
  }
  return declarations;
}

function classifyModule(header, officialName) {
  const source = `${header} ${officialName}`;
  return MODULE_RULES.find(([, pattern]) => pattern.test(source))?.[0] || 'lingbuilder.fbro.browser';
}

function classifyCoverage(officialName) {
  if (HIGH_LEVEL_EXPORTS.has(officialName)) {
    return { kind: 'highLevel', reason: '已由现有中文高层 API 或其 C ABI v1 兼容实现直接使用。' };
  }
  if (INTERNAL_NAME_PATTERNS.some(pattern => pattern.test(officialName))) {
    return { kind: 'internal', reason: '分配器或事件适配器生命周期入口，只能由桥接实现调用，向 .lcpp 暴露会破坏句柄所有权。' };
  }
  if (NOT_APPLICABLE_EXPORTS.has(officialName)) {
    return { kind: 'advancedSafe', reason: NOT_APPLICABLE_EXPORTS.get(officialName) };
  }
  if (isImplementedAdvancedExport(officialName)) {
    return { kind: 'advancedSafe', reason: '已通过 C ABI v2 类型化对象句柄完成安全高级封装，并具有 contribution、binding、真实 Bridge 调用和原生测试。' };
  }
  return { kind: 'advancedSafe', reason: '已归入安全高级封装目标；必须通过 C ABI v2 类型化对象句柄、UTF-16 JSON、任务或受管缓冲逐项实现，当前不可据此视为已有运行时 wrapper。' };
}

function createChineseCommandName(moduleId, translatedOperation, signatureHash) {
  return `FBro高级_${MODULE_LABELS[moduleId]}_${translatedOperation}_${signatureHash.slice(0, 6).toUpperCase()}`;
}

function translateOperation(operation) {
  const words = operation.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').replace(/[_-]+/gu, ' ').split(/\s+/u).filter(Boolean);
  const dictionary = {
    Get: '取', Set: '设置', Is: '是否', Has: '是否有', Can: '能否', Create: '创建', Creat: '创建', New: '新建',
    Delete: '删除', Remove: '移除', Clear: '清空', Add: '添加', Insert: '插入', Copy: '复制', Close: '关闭',
    Open: '打开', Start: '开始', Stop: '停止', Continue: '继续', Cancel: '取消', Pause: '暂停', Resume: '恢复',
    Execute: '执行', Load: '加载', Save: '保存', Read: '读取', Write: '写入', Send: '发送', Receive: '接收',
    Find: '查找', Select: '选择', Visit: '访问', Register: '注册', Unregister: '注销', Resolve: '解析',
    Browser: '浏览器', Frame: '框架', Value: '值', Data: '数据', String: '文本', List: '列表', Dictionary: '字典',
    Request: '请求', Response: '响应', Context: '上下文', Cookie: 'Cookie', Cache: '缓存', Proxy: '代理',
    Url: '地址', URL: '地址', Title: '标题', Error: '错误', Result: '结果', Count: '数量', Size: '大小', Index: '索引',
    Name: '名称', Id: '编号', ID: '编号', Status: '状态', Type: '类型', Path: '路径', File: '文件', Image: '图像',
    Event: '事件', Handler: '处理器', Callback: '回调', Task: '任务', Host: '宿主', Focus: '焦点', Zoom: '缩放',
    Back: '后退', Forward: '前进', Reload: '刷新', Print: '打印', Download: '下载', Upload: '上传',
    Key: '按键', Mouse: '鼠标', Audio: '音频', Video: '视频', Device: '设备', Memory: '内存', Process: '进程',
    Message: '消息', Extension: '扩展', Certificate: '证书', Principal: '主体', Global: '全局', Main: '主',
    Current: '当前', Last: '最近', Default: '默认', Preference: '偏好', Settings: '设置', Info: '信息',
    To: '转', From: '从', By: '按', With: '使用', Without: '不使用', As: '作为', All: '全部', Item: '项目',
    Valid: '有效', Empty: '空', Same: '相同', Popup: '弹窗', Document: '文档', Identifier: '标识', Identifiers: '标识列表',
    Names: '名称列表', Level: '级别', Window: '窗口', Handle: '句柄', Source: '来源', Code: '代码',
    Success: '成功', Failure: '失败', Auth: '认证', Permission: '权限', Resource: '资源', Scheme: '协议',
    random: '随机', Random: '随机', NULL: '空', Wchar: '宽字符', WSize: '宽字符大小'
  };
  const untranslatedTokens = words.filter(word => !dictionary[word] && !/^[A-Z]{2,}$/u.test(word));
  const translated = words.map(word => dictionary[word] || word);
  return { text: translated.join('') || '接口', untranslatedTokens };
}

function validateCatalog(catalog) {
  if (catalog.signatures.some(entry => !entry.classification || !entry.implementationStatus || !entry.classificationReason || !entry.chineseName
      || /功能[0-9A-F]{4}/u.test(entry.chineseName))) {
    throw new Error('FBro 覆盖清单存在未分类、无理由或无中文名称的签名。');
  }
  const ids = new Set(catalog.signatures.map(entry => entry.functionId));
  const hashes = new Set(catalog.signatures.map(entry => `${entry.header}:${entry.signatureHash}`));
  if (ids.size !== catalog.signatureCount || hashes.size !== catalog.signatureCount) {
    throw new Error('FBro 覆盖清单存在稳定 ID 或签名哈希冲突。');
  }
  const classified = catalog.summary.highLevel + catalog.summary.advancedSafe + catalog.summary.internal;
  if (classified !== catalog.signatureCount) throw new Error('FBro 覆盖清单存在未分类签名。');
  if (catalog.eventCatalog.length === 0 || catalog.eventCatalog.some(event => !event.defaultAction || !event.bridgeStatus)) {
    throw new Error('FBro 事件目录为空或存在未定义默认动作/桥接状态的事件。');
  }
  if (catalog.signatures.some(entry => !entry.wrapperSymbol || entry.overloads.length !== entry.overloadCount
      || entry.overloads.some(overload => !overload.returnCodec?.codec || overload.parameters.some(parameter => !parameter.codec)))) {
    throw new Error('FBro wrapper 规范存在缺失的导出符号、重载或参数 codec。');
  }
}

function readFbroVersion(source) {
  return ['MAIN', 'EDIT', 'DEBUG'].map(part => source.match(new RegExp(`#define\\s+VERSIONS_${part}\\s+(\\d+)`, 'u'))?.[1] || '0').join('.');
}

function readDefine(source, name) {
  return source.match(new RegExp(`#define\\s+${name}\\s+"([^"]+)"`, 'u'))?.[1] || '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function renderMarkdown(catalog) {
  const moduleRows = Object.entries(catalog.summary.modules)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([moduleId, count]) => `| \`${moduleId}\` | ${MODULE_LABELS[moduleId]} | ${count} |`)
    .join('\n');
  return `# FBro API 覆盖清单\n\n`
    + `确定性基线：FBro ${catalog.baseline.fbroVersion}、CEF ${catalog.baseline.cefVersion}、${catalog.baseline.platform}。`
    + `火山 \`.v\` 二进制工程只用于火山 IDE 抽样核对，不参与本清单生成。\n\n`
    + `- 公共头文件：${catalog.headerCount}\n- 导出签名：${catalog.signatureCount}\n`
    + `- 高层封装：${catalog.summary.highLevel}\n- 高级安全封装：${catalog.summary.advancedSafe}（已实现 ${catalog.summary.implemented - catalog.summary.highLevel}，待实现 ${catalog.summary.planned}）\n- 内部/生命周期项：${catalog.summary.internal}\n\n`
    + `- 官方事件签名：${catalog.eventCatalog.length}\n- 已接通 LingBuilder 事件：${catalog.eventCatalog.filter(event => event.bridgeStatus === 'implemented').length}\n\n`
    + `| 模块 ID | 中文能力域 | 签名数 |\n|---|---:|---:|\n${moduleRows}\n\n`
    + `逐签名稳定 ID、SHA-256、官方英文别名、中文主名称、分类、实现状态和理由位于 `
    + `\`electron/src/services/modules/fbroApiCoverage.generated.json\`。\n`;
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
