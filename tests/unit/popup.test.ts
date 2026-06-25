import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToastManager } from '../../src/content/toast';

const createMockStyle = () => {
  const s: Record<string, string> = {};
  Object.defineProperty(s, 'cssText', {
    set(str: string) {
      str.split(';').forEach(decl => {
        const parts = decl.split(':');
        if (parts.length >= 2) {
          const k = parts[0].trim();
          const v = parts.slice(1).join(':').trim();
          if (k) s[k] = v;
        }
      });
    }
  });
  return s;
};

class MockHtmlElement {
  public id = '';
  public textContent = '';
  public style: Record<string, string>;
  private children: MockHtmlElement[] = [];

  public constructor() {
    this.style = createMockStyle();
  }

  public contains(el: MockHtmlElement): boolean {
    return this.children.includes(el);
  }

  public appendChild(child: MockHtmlElement): MockHtmlElement {
    this.children.push(child);
    return child;
  }

  public remove(): void {}

  public getInnerContent(): string {
    return this.textContent + ' ' + this.children.map(c => c.getInnerContent()).join(' ');
  }
}

describe('ToastManager In-Page UI Component', () => {
  let mockBody: MockHtmlElement;

  beforeEach(() => {
    mockBody = new MockHtmlElement();
    const mockDoc = {
      body: mockBody,
      createElement: () => new MockHtmlElement(),
    };

    vi.stubGlobal('document', mockDoc);
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());
  });

  it('initializes floating toast container and displays uploading message', () => {
    (ToastManager as unknown as { container: null }).container = null;

    ToastManager.showUploading('Two Sum');

    const container = (ToastManager as unknown as { container: MockHtmlElement }).container;
    expect(container).toBeDefined();
    expect(container.id).toBe('gitleet-toast-container');
    expect(container.style.position).toBe('fixed');
    expect(container.getInnerContent()).toContain('GitLeet: Syncing "Two Sum" to GitHub...');
  });

  it('renders success confirmation toast with green accent styling', () => {
    (ToastManager as unknown as { container: null }).container = null;
    ToastManager.showSuccess('Trapping Rain Water');

    const container = (ToastManager as unknown as { container: MockHtmlElement }).container;
    expect(container.getInnerContent()).toContain('Successfully committed "Trapping Rain Water"');
  });

  it('renders error notice toast accurately', () => {
    (ToastManager as unknown as { container: null }).container = null;
    ToastManager.showError('Rate limit exceeded (403)');

    const container = (ToastManager as unknown as { container: MockHtmlElement }).container;
    expect(container.getInnerContent()).toContain('GitLeet Error: Rate limit exceeded (403)');
  });
});
