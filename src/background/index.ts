/**
 * Background Service Worker Entry Point.
 */

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (message && typeof message === 'object' && 'type' in message) {
    const msg = message as { type: string };
    console.warn('Received extension message:', msg.type);
    sendResponse({ status: 'ACK' });
  }
  return true;
});
