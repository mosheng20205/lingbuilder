import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDataTypeEditor from '../src/components/ProjectDataTypeEditor';
import { buildBeginnerTypeCompletionCatalog } from '../src/services/lingCpp/beginnerTypeCompletion';
import { SAFE_DATA_FIELD_TYPES } from '../src/services/lingCpp/projectDataTypeService';

test('新手项目数据类型编辑器提供类型卡片、字段表格、空状态和窄屏滚动', () => {
  const markup = renderToStaticMarkup(<ProjectDataTypeEditor
    sourceCode={'数据类型 用户信息\n    文本型 姓名 = ""\n    整数型 年龄 = 0\n结束数据类型\n'}
    filePath="src/demo/项目数据类型.lcpp"
    isDarkMode
    onChange={() => undefined}
  />);
  for (const label of ['项目自定义数据类型', '字段名', '类型', '数组', '默认值', '说明', '新增类型', '添加']) assert.match(markup, new RegExp(label, 'u'));
  const typeLabels = buildBeginnerTypeCompletionCatalog([...SAFE_DATA_FIELD_TYPES, '用户信息'])
    .filter(item => item.label !== '空')
    .map(item => item.label);
  assert.deepEqual(typeLabels, ['文本型', '整数型', '长整数型', '逻辑型', '小数型', '双精度小数型', '字节型', '字节集', '用户信息']);
  assert.equal((markup.match(/role="combobox"/gu) || []).length, 3);
  assert.match(markup, /aria-label="用户信息\.姓名 字段类型"/u);
  assert.match(markup, /aria-label="用户信息 新字段类型"/u);
  assert.doesNotMatch(markup, /<select/u);
  assert.doesNotMatch(markup, /<datalist/u);
  assert.match(markup, /overflow-x-auto/u);
  assert.match(markup, /min-w-\[780px\]/u);

  const emptyMarkup = renderToStaticMarkup(<ProjectDataTypeEditor
    sourceCode="// 空项目数据类型文件\n"
    filePath="src/demo/项目数据类型.lcpp"
    isDarkMode={false}
    onChange={() => undefined}
  />);
  assert.match(emptyMarkup, /暂无自定义数据类型/u);
});
