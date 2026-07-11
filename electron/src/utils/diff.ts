import { DiffLine, DiffResult } from '../types';

interface LineMatch {
  originalIndex: number;
  translatedIndex: number;
}

function splitTextLines(text: string): string[] {
  if (text === '') return [];
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function computeLcsLengthRow(originalLines: string[], translatedLines: string[]): Uint32Array {
  let previous = new Uint32Array(translatedLines.length + 1);

  for (const originalLine of originalLines) {
    const current = new Uint32Array(translatedLines.length + 1);
    for (let translatedIndex = 1; translatedIndex <= translatedLines.length; translatedIndex++) {
      current[translatedIndex] = originalLine === translatedLines[translatedIndex - 1]
        ? previous[translatedIndex - 1] + 1
        : Math.max(previous[translatedIndex], current[translatedIndex - 1]);
    }
    previous = current;
  }

  return previous;
}

/**
 * Hirschberg's LCS reconstruction keeps memory linear while still finding
 * stable anchors across insertions and deletions in the middle of a file.
 */
function collectLineMatches(
  originalLines: string[],
  translatedLines: string[],
  originalStart: number,
  originalEnd: number,
  translatedStart: number,
  translatedEnd: number,
  matches: LineMatch[]
): void {
  const originalLength = originalEnd - originalStart;
  const translatedLength = translatedEnd - translatedStart;

  if (originalLength === 0 || translatedLength === 0) return;

  if (originalLength === 1) {
    const originalLine = originalLines[originalStart];
    for (let translatedIndex = translatedStart; translatedIndex < translatedEnd; translatedIndex++) {
      if (originalLine === translatedLines[translatedIndex]) {
        matches.push({ originalIndex: originalStart, translatedIndex });
        break;
      }
    }
    return;
  }

  const originalMiddle = originalStart + Math.floor(originalLength / 2);
  const translatedRange = translatedLines.slice(translatedStart, translatedEnd);
  const leftLengths = computeLcsLengthRow(
    originalLines.slice(originalStart, originalMiddle),
    translatedRange
  );
  const rightLengths = computeLcsLengthRow(
    originalLines.slice(originalMiddle, originalEnd).reverse(),
    [...translatedRange].reverse()
  );

  let translatedSplitOffset = 0;
  let bestLength = -1;
  for (let offset = 0; offset <= translatedLength; offset++) {
    const candidateLength = leftLengths[offset] + rightLengths[translatedLength - offset];
    if (candidateLength > bestLength) {
      bestLength = candidateLength;
      translatedSplitOffset = offset;
    }
  }

  const translatedMiddle = translatedStart + translatedSplitOffset;
  collectLineMatches(
    originalLines,
    translatedLines,
    originalStart,
    originalMiddle,
    translatedStart,
    translatedMiddle,
    matches
  );
  collectLineMatches(
    originalLines,
    translatedLines,
    originalMiddle,
    originalEnd,
    translatedMiddle,
    translatedEnd,
    matches
  );
}

/**
 * Align original and translated text lines using a Longest Common Subsequence (LCS) approach.
 * This handles modifications, insertions, and deletions gracefully, even if lines are added or removed.
 */
export function computeDiff(originalText: string, translatedText: string): DiffResult {
  const originalLines = splitTextLines(originalText);
  const translatedLines = splitTextLines(translatedText);
  const diffOriginal: DiffLine[] = [];
  const diffTranslated: DiffLine[] = [];
  let added = 0;
  let deleted = 0;
  let modified = 0;
  let unchanged = 0;

  const appendUnchanged = (originalIndex: number, translatedIndex: number) => {
    const originalLineNumber = originalIndex + 1;
    const translatedLineNumber = translatedIndex + 1;
    unchanged++;
    diffOriginal.push({
      lineNumber: originalLineNumber,
      originalLineNumber,
      type: 'unchanged',
      content: originalLines[originalIndex]
    });
    diffTranslated.push({
      lineNumber: translatedLineNumber,
      translatedLineNumber,
      type: 'unchanged',
      content: translatedLines[translatedIndex]
    });
  };

  const appendModified = (originalIndex: number, translatedIndex: number) => {
    const originalLineNumber = originalIndex + 1;
    const translatedLineNumber = translatedIndex + 1;
    const { origWords, tranWords } = computeWordDiff(
      originalLines[originalIndex],
      translatedLines[translatedIndex]
    );
    modified++;
    diffOriginal.push({
      lineNumber: originalLineNumber,
      originalLineNumber,
      type: 'modified',
      content: originalLines[originalIndex],
      words: origWords
    });
    diffTranslated.push({
      lineNumber: translatedLineNumber,
      translatedLineNumber,
      type: 'modified',
      content: translatedLines[translatedIndex],
      words: tranWords
    });
  };

  const appendDeleted = (originalIndex: number) => {
    const originalLineNumber = originalIndex + 1;
    deleted++;
    diffOriginal.push({
      lineNumber: originalLineNumber,
      originalLineNumber,
      type: 'deleted',
      content: originalLines[originalIndex]
    });
    diffTranslated.push({
      lineNumber: 0,
      type: 'deleted',
      content: ''
    });
  };

  const appendAdded = (translatedIndex: number) => {
    const translatedLineNumber = translatedIndex + 1;
    added++;
    diffOriginal.push({
      lineNumber: 0,
      type: 'added',
      content: ''
    });
    diffTranslated.push({
      lineNumber: translatedLineNumber,
      translatedLineNumber,
      type: 'added',
      content: translatedLines[translatedIndex]
    });
  };

  const appendChangedRange = (
    originalStart: number,
    originalEnd: number,
    translatedStart: number,
    translatedEnd: number
  ) => {
    const pairedCount = Math.min(originalEnd - originalStart, translatedEnd - translatedStart);
    for (let offset = 0; offset < pairedCount; offset++) {
      appendModified(originalStart + offset, translatedStart + offset);
    }
    for (let originalIndex = originalStart + pairedCount; originalIndex < originalEnd; originalIndex++) {
      appendDeleted(originalIndex);
    }
    for (let translatedIndex = translatedStart + pairedCount; translatedIndex < translatedEnd; translatedIndex++) {
      appendAdded(translatedIndex);
    }
  };

  let commonPrefixLength = 0;
  const maximumPrefixLength = Math.min(originalLines.length, translatedLines.length);
  while (
    commonPrefixLength < maximumPrefixLength
    && originalLines[commonPrefixLength] === translatedLines[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  let commonSuffixLength = 0;
  while (
    commonSuffixLength < originalLines.length - commonPrefixLength
    && commonSuffixLength < translatedLines.length - commonPrefixLength
    && originalLines[originalLines.length - 1 - commonSuffixLength]
      === translatedLines[translatedLines.length - 1 - commonSuffixLength]
  ) {
    commonSuffixLength += 1;
  }

  for (let index = 0; index < commonPrefixLength; index += 1) {
    appendUnchanged(index, index);
  }

  const originalMiddleEnd = originalLines.length - commonSuffixLength;
  const translatedMiddleEnd = translatedLines.length - commonSuffixLength;
  const matches: LineMatch[] = [];
  collectLineMatches(
    originalLines,
    translatedLines,
    commonPrefixLength,
    originalMiddleEnd,
    commonPrefixLength,
    translatedMiddleEnd,
    matches
  );

  let originalIndex = commonPrefixLength;
  let translatedIndex = commonPrefixLength;
  for (const match of matches) {
    appendChangedRange(originalIndex, match.originalIndex, translatedIndex, match.translatedIndex);
    appendUnchanged(match.originalIndex, match.translatedIndex);
    originalIndex = match.originalIndex + 1;
    translatedIndex = match.translatedIndex + 1;
  }
  appendChangedRange(originalIndex, originalMiddleEnd, translatedIndex, translatedMiddleEnd);

  for (let offset = commonSuffixLength; offset > 0; offset -= 1) {
    appendUnchanged(originalLines.length - offset, translatedLines.length - offset);
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
