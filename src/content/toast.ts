/**
 * Floating Toast notification UI injected into LeetCode DOM.
 * Provides non-intrusive feedback during GitHub synchronization.
 */
export class ToastManager {
  private static container: HTMLElement | null = null;

  private static initContainer(): HTMLElement {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    const div = document.createElement('div');
    div.id = 'gitleet-toast-container';
    div.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(div);
    this.container = div;
    return div;
  }

  private static createToast(text: string, color: string, durationMs = 4000): void {
    const parent = this.initContainer();
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: #161b22;
      color: #e6edf3;
      padding: 14px 20px;
      border-radius: 8px;
      border-left: 4px solid ${color};
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      font-size: 14px;
      font-weight: 500;
      pointer-events: auto;
      transition: opacity 0.3s ease, transform 0.3s ease;
      opacity: 0;
      transform: translateY(10px);
    `;
    toast.textContent = text;
    parent.appendChild(toast);

    // Trigger appear animation
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    if (durationMs > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }, durationMs);
    }
  }

  /**
   * Displays upload in progress indicator.
   */
  public static showUploading(problemTitle: string): void {
    this.createToast(`GitLeet: Syncing "${problemTitle}" to GitHub...`, '#58a6ff', 3000);
  }

  /**
   * Displays sync completion confirmation.
   */
  public static showSuccess(problemTitle: string): void {
    this.createToast(`GitLeet: Successfully committed "${problemTitle}"`, '#3fb950', 5000);
  }

  /**
   * Displays sync error notice.
   */
  public static showError(message: string): void {
    this.createToast(`GitLeet Error: ${message}`, '#f85149', 6000);
  }
}
