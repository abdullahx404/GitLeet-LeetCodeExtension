import { SubmissionMetadata } from '../types';
import { extractTitleSlug, normalizeDifficulty, getFileExtension } from './parser';
import { injectMainWorldInterceptor } from './injected';

let lastSyncedTimestamp = 0;

/**
 * Extracts submitted code from LeetCode Monaco editor or page DOM elements.
 */
function extractSourceCode(): string {
  try {
    const win = window as unknown as { monaco?: { editor?: { getModels?: () => Array<{ getValue: () => string }> } } };
    if (win.monaco?.editor?.getModels) {
      const models = win.monaco.editor.getModels();
      const firstModel = models[0];
      if (firstModel) {
        return firstModel.getValue();
      }
    }
  } catch {
    // Fallback to DOM elements
  }

  const codeBlocks = document.querySelectorAll('pre, code, .monaco-editor');
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    if (block) {
      const text = block.textContent;
      if (text && text.length > 20) return text;
    }
  }

  return '// Source code extraction failed';
}

/**
 * Extracts problem number, title, difficulty rating, and language from page DOM.
 */
function extractPageMetadata(partialCode?: string, partialLang?: string): SubmissionMetadata {
  const pathname = window.location.pathname;
  const slug = extractTitleSlug(pathname);

  let title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  let probNum = '';

  const heading = document.querySelector('h1, [data-cy="question-title"], .text-title-large');
  if (heading && heading.textContent) {
    const fullText = heading.textContent.trim();
    const match = /^(\d+)\.\s*(.+)$/.exec(fullText);
    if (match) {
      const numPart = match[1];
      const titlePart = match[2];
      if (numPart && titlePart) {
        probNum = numPart;
        title = titlePart.trim();
      }
    } else {
      title = fullText;
    }
  }

  let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
  const diffBadge = document.querySelector('[class*="text-difficulty"], [data-difficulty], .text-olive, .text-yellow, .text-pink');
  if (diffBadge && diffBadge.textContent) {
    difficulty = normalizeDifficulty(diffBadge.textContent);
  }

  let language = partialLang || 'python';
  const langBtn = document.querySelector('[data-cy="lang-select"], [class*="lang-select"], button[id*="headlessui-listbox-button"]');
  if (langBtn && langBtn.textContent) {
    language = langBtn.textContent.trim();
  }

  const code = partialCode || extractSourceCode();
  const extension = getFileExtension(language);

  return {
    problemTitle: title,
    problemNumber: probNum || '0000',
    difficulty,
    language,
    extension,
    sourceCode: code,
    timestamp: Date.now(),
  };
}

/**
 * Sends extracted submission metadata payload to background worker for GitHub upload.
 */
function triggerSync(meta: SubmissionMetadata): void {
  const now = Date.now();
  if (now - lastSyncedTimestamp < 5000) return;
  lastSyncedTimestamp = now;

  console.warn('Syncing accepted LeetCode submission to GitHub:', meta.problemTitle);

  chrome.runtime.sendMessage({
    type: 'SUBMISSION_ACCEPTED',
    payload: meta,
  }).catch(() => {
    // Ignore runtime connection disconnected errors
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return;

  const data = event.data as { type?: string; payload?: { language?: string; code?: string } };
  if (data.type === 'GITLEET_SUBMISSION_ACCEPTED') {
    const meta = extractPageMetadata(data.payload?.code, data.payload?.language);
    triggerSync(meta);
  }
});

const observer = new MutationObserver(() => {
  const resultSpan = document.querySelector('[data-e2e-locator="submission-result"], [class*="status-accepted"], .text-green-s');
  if (resultSpan && resultSpan.textContent && resultSpan.textContent.includes('Accepted')) {
    const meta = extractPageMetadata();
    triggerSync(meta);
  }
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

injectMainWorldInterceptor();
