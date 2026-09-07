# CEF3 资源响应正文读取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a high-level CEF3 command that reads the current resource response body during the resource-response event lifecycle.

**Architecture:** Mark the active CEF request from `OnResourceResponse`, attach a bounded capture `CefResponseFilter`, and publish the completed snapshot from `OnResourceLoadComplete` through the existing LingBuilder event-field channel. The `.lcpp` command remains asynchronous and does not expose raw CEF pointers.

**Tech Stack:** TypeScript module catalogs and tests; C++ CEF bridge; generated CEF catalog/docs; LingCpp Win32 generator.

**Spec:** `docs/superpowers/specs/2026-09-07-cef3-resource-body-design.md`

## Global Constraints

- Read the same browser response; never silently issue a second request.
- Only allow reads from the active `资源响应到达` handler context.
- Enforce a maximum byte limit and expose truncation.
- Preserve existing metadata events and CEF3 API compatibility.
- Update CEF3 docs, `docs/FUTURE_OPTIMIZATIONS.md`, `electron/README.md`, and the daily update record.

---

### Task 1: Add failing contract tests

**Files:**
- Modify: `electron/tests/modules.test.ts`
- Modify: `electron/tests/cef3BridgeEventNames.test.ts`
- Test: `electron/tests/modules.test.ts`

- [ ] Add assertions that the CEF3 browser module exposes `CEF3_读资源响应正文` with `controlRef`, `longLong`, and `handler` parameters.
- [ ] Add assertions for the completion fields and the event-context error contract.
- [ ] Run the focused tests and confirm they fail because the command and contract are absent.

### Task 2: Add module command and generated metadata source

**Files:**
- Modify: `electron/src/services/modules/builtinModules.ts`
- Modify: `electron/src/services/modules/cef3BrowserEvents.ts`
- Modify: `electron/src/services/modules/types.ts` if the command metadata requires a new response field type.

- [ ] Register `CEF3_读资源响应正文(控件名, 最大字节数, 完成处理器)` in `lingbuilder.cef3.browser`.
- [ ] Document the event-only lifecycle, byte limit, text/Base64 fields, and failure semantics in the command description.
- [ ] Add the completion event fields to the shared CEF3 event contract.
- [ ] Run the focused TypeScript tests and confirm the catalog assertions pass.

### Task 3: Implement bounded native response capture

**Files:**
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridge.cpp`
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridge.h`
- Modify: `electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp`

- [ ] Add per-request capture state keyed by the registered request handle/identifier, including maximum bytes, captured prefix, total bytes, completion handler metadata, and failure state.
- [ ] Make `OnResourceResponse` recognize the new command request and reject calls outside the active callback context with a stable error field.
- [ ] Make `GetResourceResponseFilter` return a capture filter for marked requests while preserving configured replacement filters.
- [ ] Capture chunks without retaining CEF-owned buffer addresses; stop appending after the configured limit while continuing to count bytes.
- [ ] Finalize text, Base64, `receivedBytes`, and `truncated` fields in `OnResourceLoadComplete`, then dispatch the completion event.
- [ ] Add native tests for text bytes, binary bytes, truncation, failed load, and context rejection.
- [ ] Run the focused native bridge test/build and observe the new tests pass.

### Task 4: Wire generated catalog, docs, and tutorial contract

**Files:**
- Regenerate: `electron/src/services/modules/cef3SafeApiCatalog.generated.ts`
- Regenerate: `electron/src/services/modules/cef3ApiCoverage.generated.json`
- Regenerate: `electron/docs/modules/cef3/network.md`
- Modify: `electron/docs/modules/cef3/browser.md`
- Modify: `electron/README.md`
- Modify: `docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`
- Modify: `docs/模块开发手册.md`
- Modify: `docs/FUTURE_OPTIMIZATIONS.md`

- [ ] Run the repository CEF3 catalog and documentation generators.
- [ ] Verify the new command is marked implemented only when the wrapper and native tests exist.
- [ ] Add a concise `.lcpp` usage example and lifecycle warning to the CEF3 browser docs.
- [ ] Record any remaining limits or follow-up work in the future-optimization log.

### Task 5: Update example and verify the full workflow

**Files:**
- Modify: `AI 视频自主生产/CEF3 浏览器模块合集/06 获取网页资源响应/示例项目/cef3-ep06-resource-response/src/CEF3资源响应窗体.lcpp`
- Modify: `AI 视频自主生产/CEF3 浏览器模块合集/06 获取网页资源响应/示例项目/cef3-ep06-resource-response/README.md`
- Modify: `AI 视频自主生产/CEF3 浏览器模块合集/06 获取网页资源响应/验证记录.md`
- Create: `更新记录/2026-09-07.md`

- [ ] Call the new command from `资源响应到达` only for a bounded text fixture and display the completion fields.
- [ ] Keep metadata logging intact and add an explicit binary/truncation note.
- [ ] Run `npm run lint`, focused CEF3/module tests, `npm run tutorial:cef3:verify`, and the CEF3 tutorial build when the SDK is available.
- [ ] Record date, changed files, scope, and verification results in the daily update file.
