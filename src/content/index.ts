import { SubmissionMetadata } from '../types';
import { extractTitleSlug, normalizeDifficulty, getFileExtension } from './parser';
import { injectMainWorldInterceptor } from './injected';
import { ToastManager } from './toast';

let lastSyncedTimestamp = 0;
let lastSyncedHash = '';

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
    // Ignore Monaco extraction failure
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
 * Detects programming language directly from Monaco model language ID or DOM buttons.
 */
function detectLanguage(partialLang?: string): string {
  if (partialLang) {
    if (partialLang === 'cpp' || partialLang.toLowerCase() === 'c++') return 'C++';
    if (partialLang === 'python' || partialLang === 'python3') return 'python3';
    return partialLang;
  }

  try {
    const win = window as unknown as { monaco?: { editor?: { getModels?: () => Array<{ getLanguageId: () => string }> } } };
    if (win.monaco?.editor?.getModels) {
      const models = win.monaco.editor.getModels();
      if (models[0]) {
        const langId = models[0].getLanguageId();
        if (langId === 'cpp') return 'C++';
        if (langId === 'python') return 'python3';
        if (langId === 'java') return 'Java';
        if (langId === 'typescript') return 'TypeScript';
        if (langId === 'golang' || langId === 'go') return 'Go';
        if (langId === 'rust') return 'Rust';
        if (langId === 'csharp') return 'C#';
        return langId;
      }
    }
  } catch {
    // Ignore Monaco extraction failure
  }

  const langBtn = document.querySelector('[data-cy="lang-select"], [class*="lang-select"], button[id*="headlessui-listbox-button"], .text-label-2');
  if (langBtn && langBtn.textContent) {
    const txt = langBtn.textContent.trim();
    if (txt.toLowerCase().includes('c++')) return 'C++';
    if (txt.toLowerCase().includes('python')) return 'python3';
    return txt;
  }

  return 'python3';
}

/**
 * Extracts problem number, title, difficulty rating, language, runtime, and space from page DOM.
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

  const language = detectLanguage(partialLang);
  const code = partialCode || extractSourceCode();
  const extension = getFileExtension(language);

  // Extract runtime and space complexity metrics
  let runtime = '0 ms';
  let memory = '0 MB';

  const allTexts = document.querySelectorAll('.text-label-1, .text-s, span');
  allTexts.forEach((el) => {
    const t = el.textContent ? el.textContent.trim() : '';
    if (/^\d+\s*ms$/.test(t)) runtime = t;
    if (/^\d+(\.\d+)?\s*MB$/.test(t)) memory = t;
  });

  return {
    problemTitle: title,
    problemNumber: probNum || '0000',
    difficulty,
    language,
    extension,
    sourceCode: code,
    timestamp: Date.now(),
    runtime,
    memory,
  };
}

/**
 * Sends extracted submission metadata payload to background worker for GitHub upload.
 */
function triggerSync(meta: SubmissionMetadata): void {
  const now = Date.now();
  const codeHash = meta.sourceCode.slice(0, 100);

  if (now - lastSyncedTimestamp < 5000 && lastSyncedHash === codeHash) {
    return;
  }
  lastSyncedTimestamp = now;
  lastSyncedHash = codeHash;

  console.warn('Syncing accepted LeetCode submission to GitHub:', meta.problemTitle);
  ToastManager.showUploading(meta.problemTitle);

  chrome.runtime.sendMessage({
    type: 'SUBMISSION_ACCEPTED',
    payload: meta,
  }).catch(() => {
    ToastManager.showError('Extension background worker disconnected.');
  });
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message) {
    const msg = message as { type: string; payload?: { status?: string; title?: string; error?: string } };
    if (msg.type === 'GITLEET_SYNC_STATUS' && msg.payload) {
      if (msg.payload.status === 'SUCCESS') {
        ToastManager.showSuccess(msg.payload.title || 'Solution');
      } else if (msg.payload.status === 'ERROR') {
        ToastManager.showError(msg.payload.error || 'Upload failed');
      }
    }
  }
});

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
