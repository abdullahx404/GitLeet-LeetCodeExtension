import { SyncQueue } from './syncQueue';
import { AlarmService } from './alarms';
import { SubmissionMetadata } from '../types';

/**
 * Background Service Worker Entry Point.
 * Listens to submission events from content scripts and dispatches to SyncQueue.
 */

AlarmService.setupAlarmListener();

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (message && typeof message === 'object' && 'type' in message) {
    const msg = message as { type: string; payload?: SubmissionMetadata };
    
    if (msg.type === 'SUBMISSION_ACCEPTED' && msg.payload) {
      console.warn('Background received SUBMISSION_ACCEPTED event for:', msg.payload.problemTitle);
      const tabId = sender.tab ? sender.tab.id : undefined;
      SyncQueue.enqueue(msg.payload, tabId);
      sendResponse({ status: 'QUEUED' });
    } else {
      sendResponse({ status: 'ACK' });
    }
  }
  return true;
});
