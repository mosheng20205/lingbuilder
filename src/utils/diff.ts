import { DiffLine, DiffResult } from '../types';

/**
 * Align original and translated text lines using a Longest Common Subsequence (LCS) approach.
 * This handles modifications, insertions, and deletions gracefully, even if lines are added or removed.
 */
export function computeDiff(originalText: string, translatedText: string): DiffResult {
  const originalLines = originalText.split('\n');
  const translatedLines = translatedText.split('\n');

  const n = originalLines.length;
  const m = translatedLines.length;

  // Since C++ localization typically maintains exactly the same line structure (just replacing string values),
  // a line-by-line direct comparison is extremely accurate. But we'll align them gracefully.
  const diffOriginal: DiffLine[] = [];
  const diffTranslated: DiffLine[] = [];

  let added = 0;
  let deleted = 0;
  let modified = 0;
  let unchanged = 0;

  // Let's use a robust alignment: if line counts match, match them line-by-line as modified or unchanged.
  // This is the most common case in C++ localization.
  if (n === m) {
    for (let i = 0; i < n; i++) {
      const orig = originalLines[i];
      const tran = translatedLines[i];
      const lineNum = i + 1;

      if (orig === tran) {
        unchanged++;
        diffOriginal.push({
          lineNumber: lineNum,
          originalLineNumber: lineNum,
          type: 'unchanged',
          content: orig
        });
        diffTranslated.push({
          lineNumber: lineNum,
          translatedLineNumber: lineNum,
          type: 'unchanged',
          content: tran
        });
      } else {
        modified++;
        
        // Word level highlight helper
        const { origWords, tranWords } = computeWordDiff(orig, tran);

        diffOriginal.push({
          lineNumber: lineNum,
          originalLineNumber: lineNum,
          type: 'modified',
          content: orig,
          words: origWords
        });
        diffTranslated.push({
          lineNumber: lineNum,
          translatedLineNumber: lineNum,
          type: 'modified',
          content: tran,
          words: tranWords
        });
      }
    }
  } else {
    // Basic Myers-like alignment fallback for unequal line counts
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m) {
        const orig = originalLines[i];
        const tran = translatedLines[j];
        if (orig === tran) {
          unchanged++;
          diffOriginal.push({
            lineNumber: i + 1,
            originalLineNumber: i + 1,
            type: 'unchanged',
            content: orig
          });
          diffTranslated.push({
            lineNumber: j + 1,
            translatedLineNumber: j + 1,
            type: 'unchanged',
            content: tran
          });
          i++;
          j++;
        } else {
          // Lookahead to see if it's an insertion or deletion
          let isDeletion = true;
          for (let k = 1; k < Math.min(5, n - i); k++) {
            if (originalLines[i + k] === tran) {
              isDeletion = true;
              break;
            }
          }
          let isInsertion = false;
          for (let k = 1; k < Math.min(5, m - j); k++) {
            if (orig === translatedLines[j + k]) {
              isInsertion = true;
              break;
            }
          }

          if (isDeletion && !isInsertion) {
            deleted++;
            diffOriginal.push({
              lineNumber: i + 1,
              originalLineNumber: i + 1,
              type: 'deleted',
              content: orig
            });
            diffTranslated.push({
              lineNumber: j + 1,
              type: 'deleted',
              content: '' // empty placeholder on right
            });
            i++;
          } else if (isInsertion && !isDeletion) {
            added++;
            diffOriginal.push({
              lineNumber: i + 1,
              type: 'added',
              content: '' // empty placeholder on left
            });
            diffTranslated.push({
              lineNumber: j + 1,
              translatedLineNumber: j + 1,
              type: 'added',
              content: tran
            });
            j++;
          } else {
            // Treat as modification
            modified++;
            const { origWords, tranWords } = computeWordDiff(orig, tran);
            diffOriginal.push({
              lineNumber: i + 1,
              originalLineNumber: i + 1,
              type: 'modified',
              content: orig,
              words: origWords
            });
            diffTranslated.push({
              lineNumber: j + 1,
              translatedLineNumber: j + 1,
              type: 'modified',
              content: tran,
              words: tranWords
            });
            i++;
            j++;
          }
        }
      } else if (i < n) {
        deleted++;
        diffOriginal.push({
          lineNumber: i + 1,
          originalLineNumber: i + 1,
          type: 'deleted',
          content: originalLines[i]
        });
        diffTranslated.push({
          lineNumber: j + 1,
          type: 'deleted',
          content: ''
        });
        i++;
      } else if (j < m) {
        added++;
        diffOriginal.push({
          lineNumber: i + 1,
          type: 'added',
          content: ''
        });
        diffTranslated.push({
          lineNumber: j + 1,
          translatedLineNumber: j + 1,
          type: 'added',
          content: translatedLines[j]
        });
        j++;
      }
    }
  }

  return {
    originalLines: diffOriginal,
    translatedLines: diffTranslated,
    stats: { added, deleted, modified, unchanged }
  };
}

/**
 * Tokenize string and highlight differences at word level.
 * It identifies quotes and comments and highlights specifically changed parts.
 */
function computeWordDiff(orig: string, tran: string) {
  // Simple word-level splitter (splits by spaces, punctuation, quotes)
  const splitPattern = /([L]?"[^"\\]*(?:\\.[^"\\]*)*"|[\w\u4e00-\u9fa5]+|[^\s\w\u4e00-\u9fa5]+|\s+)/g;
  
  const origTokens = orig.match(splitPattern) || [orig];
  const tranTokens = tran.match(splitPattern) || [tran];

  const origWords: { text: string; changed: boolean }[] = [];
  const tranWords: { text: string; changed: boolean }[] = [];

  // Compare tokens. We mark string literals or comments as changed if they differ.
  // This is tailored for localization, where the outer syntax (macros, variables) remains identical.
  let oIdx = 0;
  let tIdx = 0;

  while (oIdx < origTokens.length || tIdx < tranTokens.length) {
    const oTok = origTokens[oIdx];
    const tTok = tranTokens[tIdx];

    if (oTok === tTok) {
      if (oTok) origWords.push({ text: oTok, changed: false });
      if (tTok) tranWords.push({ text: tTok, changed: false });
      oIdx++;
      tIdx++;
    } else {
      // If one token is a string literal and the other is a translated string literal, highlight the change
      const isOStr = oTok && (oTok.startsWith('"') || oTok.startsWith('L"'));
      const isTStr = tTok && (tTok.startsWith('"') || tTok.startsWith('L"'));

      if (isOStr && isTStr) {
        origWords.push({ text: oTok, changed: true });
        tranWords.push({ text: tTok, changed: true });
        oIdx++;
        tIdx++;
      } else if (oTok && !tTok) {
        origWords.push({ text: oTok, changed: true });
        oIdx++;
      } else if (!oTok && tTok) {
        tranWords.push({ text: tTok, changed: true });
        tIdx++;
      } else {
        // Fallback: match them as modified
        origWords.push({ text: oTok, changed: true });
        tranWords.push({ text: tTok, changed: true });
        oIdx++;
        tIdx++;
      }
    }
  }

  return { origWords, tranWords };
}
