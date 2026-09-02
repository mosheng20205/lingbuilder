// LingCpp (.lcpp) TextMate 语法：与 electron/src/services/lingCpp/parser.ts
// 的关键字表、LING_CPP_TYPES 和 controlFlow.ts 循环关键字保持一致。
// 修改中文关键字、类型或循环语法时必须同步更新本文件。

const keywords = [
  '如果真结束', '如果结束', '如果真', '否则如果', '如果', '否则',
  '选择结束', '选择', '分支', '默认',
  '判断循环首', '判断循环尾', '循环判断首', '循环判断尾',
  '计次循环首', '计次循环尾', '变量循环首', '变量循环尾',
  '枚举循环首', '枚举循环尾', '循环结束', '循环',
  '跳出循环', '到循环尾', '继续循环',
  '尝试结束', '尝试', '捕获', '最终', '抛出',
  '结束类', '结束', '返回', '构造', '析构', '事件'
].sort((a, b) => b.length - a.length).join('|');

const modifiers = [
  '结束数据类型', '数据类型', '结束功能库', '功能库',
  '局部常量', '局部', '常量', '全局',
  '公开', '私有', '保护', '静态', '使用', '包'
].sort((a, b) => b.length - a.length).join('|');

const types = [
  '双精度小数型', '长整数型', '整数型', '小数型', '逻辑型', '文本型',
  '字节集', '窗体', '窗口', '对象',
  '按钮', '编辑框', '标签', '复选框', '单选框', '进度条', '下拉框'
].sort((a, b) => b.length - a.length).join('|');

const commands = [
  '信息框', '调试输出', '格式化文本',
  '打开窗口', '载入新窗口', '载入窗口',
  '窗口_置标题', '窗口_取标题', '窗口_打开', '窗口_关闭'
].sort((a, b) => b.length - a.length).join('|');

const lcppGrammar = {
  id: 'lcpp',
  name: 'lcpp',
  displayName: 'LingCpp',
  scopeName: 'source.lcpp',
  patterns: [
    { include: '#comment' },
    { include: '#string' },
    { include: '#native-cpp' },
    { include: '#event' },
    { include: '#method' },
    { include: '#block-keyword' },
    { include: '#modifier' },
    { include: '#type' },
    { include: '#command' },
    { include: '#call' },
    { include: '#constant' },
    { include: '#number' },
    { include: '#operator' }
  ],
  repository: {
    comment: {
      patterns: [
        { match: '//.*$', name: 'comment.line.double-slash.lcpp' },
        { match: '^\\s*注释(\\s.*|$)', name: 'comment.line.note.lcpp' }
      ]
    },
    string: {
      patterns: [
        { match: '"(?:[^"\\\\]|\\\\.)*"', name: 'string.quoted.double.lcpp' },
        { match: '“[^”]*”', name: 'string.quoted.other.lcpp' }
      ]
    },
    'native-cpp': {
      match: '^\\s*(@)(.*)$',
      captures: {
        '1': { name: 'punctuation.definition.native.lcpp' },
        '2': { name: 'string.unquoted.native.lcpp' }
      }
    },
    event: {
      match: '^\\s*(事件)\\s+([\\p{Han}\\w_]+)\\s*(\\([^)]*\\))?',
      captures: {
        '1': { name: 'keyword.control.lcpp' },
        '2': { name: 'entity.name.function.lcpp' },
        '3': { name: 'punctuation.definition.parameters.lcpp' }
      }
    },
    method: {
      match: '^\\s*((?:(?:公开|私有|保护)\\s+)?(?:双精度小数型|长整数型|整数型|小数型|逻辑型|文本型|字节集|空|窗体))\\s+([\\p{Han}\\w_]+)\\s*(\\()',
      captures: {
        '1': { name: 'storage.type.lcpp' },
        '2': { name: 'entity.name.function.lcpp' },
        '3': { name: 'punctuation.definition.parameters.lcpp' }
      }
    },
    'block-keyword': {
      match: `(?<![\\p{Han}\\w])(${keywords})(?![\\p{Han}\\w])`,
      name: 'keyword.control.lcpp'
    },
    modifier: {
      match: `(?<![\\p{Han}\\w])(${modifiers})(?![\\p{Han}\\w])`,
      name: 'storage.modifier.lcpp'
    },
    type: {
      match: `(?<![\\p{Han}\\w])(${types})(?![\\p{Han}\\w])`,
      name: 'support.type.lcpp'
    },
    command: {
      match: `(?<![\\p{Han}\\w])(${commands})(?![\\p{Han}\\w])`,
      name: 'support.function.lcpp'
    },
    call: {
      match: '[\\p{Han}][\\p{Han}0-9a-zA-Z_]*(?=\\s*\\()',
      name: 'entity.name.function.call.lcpp'
    },
    constant: {
      match: '(?<![\\p{Han}\\w])(?:真|假)(?![\\p{Han}\\w])',
      name: 'constant.language.lcpp'
    },
    number: {
      match: '\\b\\d+(?:\\.\\d+)?\\b',
      name: 'constant.numeric.lcpp'
    },
    operator: {
      match: '[+\\-*/%<>=!|&]+',
      name: 'keyword.operator.lcpp'
    }
  }
}

export default lcppGrammar
