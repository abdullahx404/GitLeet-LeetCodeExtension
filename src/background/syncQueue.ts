import { SubmissionMetadata, CachedProblem, SyncStats } from '../types';
import { StorageService } from '../storage';
import { GitHubService } from '../github';
import { buildGitHubPath, extractTitleSlug } from '../content/parser';
import { utf8ToBase64 } from '../utils';
import { ReadmeGenerator } from './readmeGenerator';

/**
 * Computes a fast deterministic 32-bit integer hash of a string, formatted as hex.
 * Used for smart code deduplication.
 */
export function computeCodeHash(code: string): string {
  const norm = code.replace(/\s+/g, '').trim();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Orchestrator managing sequential asynchronous synchronization of accepted LeetCode solutions.
 */
export class SyncQueue {
  private static queue: SubmissionMetadata[] = [];
  private static isProcessing = false;

  /**
   * Pushes a new accepted submission item into the processing queue.
   */
  public static enqueue(meta: SubmissionMetadata): void {
    this.queue.push(meta);
    void this.processNext();
  }

  /**
   * Returns current pending queue size (useful for tests).
   */
  public static getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clears the pending queue.
   */
  public static clearQueue(): void {
    this.queue = [];
    this.isProcessing = false;
  }

  private static async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    if (!item) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.syncSubmission(item);
    } catch (err) {
      console.error('Error synchronizing submission to GitHub:', err);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        void this.processNext();
      }
    }
  }

  /**
   * Core synchronization logic executing deduplication check and GitHub REST upload.
   */
  public static async syncSubmission(meta: SubmissionMetadata): Promise<boolean> {
    const settings = await StorageService.getSettings();
    if (!settings || !settings.autoSyncEnabled || !settings.githubToken) {
      console.warn('Sync aborted: User settings unconfigured or auto-sync disabled.');
      return false;
    }

    const currentHash = computeCodeHash(meta.sourceCode);
    const cache = await StorageService.getCache();
    const existingCacheItem = cache[meta.problemNumber];

    if (existingCacheItem && existingCacheItem.codeHash === currentHash) {
      console.warn(`Problem ${meta.problemNumber} skipped: Identical solution hash already uploaded.`);
      return false;
    }

    const gitPath = buildGitHubPath(settings.rootFolder, meta);
    const base64Code = utf8ToBase64(meta.sourceCode);
    const commitMsg = `Sync LeetCode ${meta.problemNumber || '0000'} - ${meta.problemTitle} (${meta.language})`;

    const shaToPass = existingCacheItem ? existingCacheItem.fileSha : undefined;

    const res = await GitHubService.createOrUpdateFile(
      settings,
      gitPath,
      base64Code,
      commitMsg,
      shaToPass
    );

    const newSha = res.content ? res.content.sha : '';
    const titleSlug = extractTitleSlug(meta.problemTitle.toLowerCase().replace(/\s+/g, '-'));

    const updatedProblem: CachedProblem = {
      problemNumber: meta.problemNumber,
      titleSlug,
      difficulty: meta.difficulty,
      fileSha: newSha,
      codeHash: currentHash,
      lastUpdated: Date.now(),
    };

    await StorageService.updateCacheProblem(updatedProblem);
    await this.updateSyncStats(meta);

    // Trigger dynamic README generation and upload
    try {
      const latestStats = await StorageService.getStats();
      const latestCache = await StorageService.getCache();
      const mdContent = ReadmeGenerator.generate(latestStats, latestCache);
      const base64Md = utf8ToBase64(mdContent);
      const cleanRoot = settings.rootFolder.replace(/^\/+|\/+$/g, '').trim() || 'LeetCode';
      const readmePath = `${cleanRoot}/README.md`;

      await GitHubService.createOrUpdateFile(
        settings,
        readmePath,
        base64Md,
        'Update repository README index'
      );
      console.warn('Successfully refreshed repository README dashboard table.');
    } catch (readmeErr) {
      console.error('Failed to update repository README index:', readmeErr);
    }

    console.warn(`Successfully synchronized ${meta.problemTitle} to GitHub.`);
    return true;
  }

  private static async updateSyncStats(meta: SubmissionMetadata): Promise<void> {
    const stats: SyncStats = await StorageService.getStats();
    stats.totalSolved += 1;

    if (meta.difficulty === 'Easy') stats.easyCount += 1;
    else if (meta.difficulty === 'Hard') stats.hardCount += 1;
    else stats.mediumCount += 1;

    stats.lastSyncedProblem = {
      number: meta.problemNumber,
      title: meta.problemTitle,
      language: meta.language,
      timestamp: meta.timestamp,
    };

    await StorageService.saveStats(stats);
  }
}
