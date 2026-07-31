const test = require('node:test');
const assert = require('node:assert/strict');
const { extractStructCallbacks, extractExports, classify } = require('./generate-cef3-api-coverage.cjs');

test('CEF3覆盖生成器解析结构方法与全局导出', () => {
  const source = `
    typedef struct _cef_demo_t {
      cef_base_ref_counted_t base;
      int(CEF_CALLBACK* can_run)(struct _cef_demo_t* self);
      void(CEF_CALLBACK* execute)(struct _cef_demo_t* self, const cef_string_t* value);
    } cef_demo_t;
    CEF_EXPORT int cef_demo_create(const cef_string_t* name);
  `;
  const methods = extractStructCallbacks(source, 'capi/cef_demo_capi.h');
  const exports = extractExports(source, 'capi/cef_demo_capi.h');
  assert.deepEqual(methods.map(item => item.officialName), ['can_run', 'execute']);
  assert.equal(exports[0].officialName, 'cef_demo_create');
  assert.equal(new Set([...methods, ...exports].map(item => item.functionId)).size, 3);
});

test('CEF3覆盖分类为每个待封装签名产生稳定Bridge符号', () => {
  const [entry] = extractStructCallbacks(`typedef struct _cef_cookie_manager_t {
    cef_base_ref_counted_t base;
    int(CEF_CALLBACK* delete_cookie_value)(struct _cef_cookie_manager_t* self, const cef_string_t* url);
  } cef_cookie_manager_t;`, 'capi/cef_cookie_capi.h');
  const result = classify(entry);
  assert.equal(result.moduleId, 'lingbuilder.cef3.session');
  assert.equal(result.implementationStatus, 'planned');
  assert.match(result.wrapperSymbol, /^LB_CEF3V3_[0-9a-f]{16}$/u);
  assert.equal(result.publicSurface, true);
  assert.equal(result.translationStatus, 'needsReview');
  assert.deepEqual(result.inputCodecs, ['typedHandle', 'utf16']);
  assert.equal(result.timeoutMs, 2000);
});

test('CEF3覆盖把上游测试签名逐项保留为不适用', () => {
  const [entry] = extractStructCallbacks(`typedef struct _cef_translator_test_t {
    cef_base_ref_counted_t base;
    int(CEF_CALLBACK* get_value)(struct _cef_translator_test_t* self);
  } cef_translator_test_t;`, 'capi/test/cef_translator_test_capi.h');
  const result = classify(entry);
  assert.equal(result.implementationStatus, 'notApplicable');
  assert.equal(result.publicSurface, false);
  assert.equal(result.excludedCategory, 'test');
  assert.equal(result.translationStatus, 'notRequired');
  assert.match(result.alternative, /正式CEF API/u);
});
