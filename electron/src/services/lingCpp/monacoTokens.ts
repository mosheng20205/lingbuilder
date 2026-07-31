import { LING_CPP_COMMANDS, LING_CPP_KEYWORDS, LING_CPP_TYPES } from './parser';
import { LingCppModuleContext } from '../modules/types';

const LING_CPP_BOOLEANS = ['真', '假'];

export function getLingCppModuleCommandNames(moduleContext?: LingCppModuleContext): string[] {
  return [...new Set(
    (moduleContext?.enabledModules || [])
      .filter(module => module.diagnostics.length === 0)
      .flatMap(module => module.manifest.contributes?.commands || [])
      .flatMap(command => [command.name, ...(command.aliases || [])])
      .map(commandName => commandName.trim())
      .filter(Boolean)
  )];
}

/**
 * Monaco lexical rules for .lcpp source.
 *
 * Module commands come from the same enabled module context used by completion
 * and diagnostics. A line beginning with @ switches to Monaco's bundled C++
 * tokenizer for the remainder of that line, while keeping @ as a visible
 * LingBuilder boundary marker.
 */
export function createLingCppMonarchLanguage(moduleContext?: LingCppModuleContext) {
  return {
    defaultToken: '',
    tokenPostfix: '.ling',
    keywords: LING_CPP_KEYWORDS,
    commands: LING_CPP_COMMANDS,
    moduleCommands: getLingCppModuleCommandNames(moduleContext),
    types: LING_CPP_TYPES,
    booleans: LING_CPP_BOOLEANS,
    operators: [
      '=', '>', '<', '!', '~', '?', ':',
      '==', '<=', '>=', '!=', '&&', '||',
      '+', '-', '*', '/', '%', '^'
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
      root: [
        [/^(\s*)(@)/, ['white', {
          token: 'native.marker',
          next: '@nativeCpp',
          nextEmbedded: 'cpp'
        }]],
        [/[a-zA-Z\u4e00-\u9fa5_][a-zA-Z0-9\u4e00-\u9fa5_]*/, {
          cases: {
            '@keywords': 'keyword',
            '@commands': 'predefined',
            '@moduleCommands': 'module.command',
            '@types': 'type',
            '@booleans': 'keyword',
            '@default': 'identifier'
          }
        }],
        [/^\s*(包|使用|类|公开|私有|保护|构造|析构|事件|结束类)\b/, 'tag'],
        { include: '@whitespace' },
        [/[{}()\[\]]/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/“/, 'string', '@stringChinese']
      ],
      nativeCpp: [
        [/$/, { token: '', next: '@pop', nextEmbedded: '@pop' }]
      ],
      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/(?:\/\/|').*/, 'comment']
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ],
      stringChinese: [
        [/[^\\”]+/, 'string'],
        [/\\./, 'string.escape'],
        [/”/, 'string', '@pop']
      ]
    }
  };
}
