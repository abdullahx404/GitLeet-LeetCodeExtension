import { SyncQueue } from './syncQueue';
import { SubmissionMetadata } from '../types';

/**
 * Background Service Worker Entry Point.
 * Listens to submission events from content scripts and dispatches to SyncQueue.
 */

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (message && typeof message === 'object' && 'type' in message) {
    const msg = message as { type: string; payload?: SubmissionMetadata };
    
    if (msg.type === 'SUBMISSION_ACCEPTED' && msg.payload) {
      console.warn('Background received SUBMISSION_ACCEPTED event for:', msg.payload.problemTitle);
      SyncQueue.enqueue(msg.payload);
      sendResponse({ status: 'QUEUED' });
    } else {
      sendResponse({ status: 'ACK' });
    }
  }
  return true;
});
