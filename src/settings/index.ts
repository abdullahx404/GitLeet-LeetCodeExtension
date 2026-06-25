import { StorageService } from '../storage';
import { GitHubService } from '../github';
import { UserSettings } from '../types';

const formEl = document.getElementById('settings-form') as HTMLFormElement | null;
const tokenInput = document.getElementById('github-token') as HTMLInputElement | null;
const ownerInput = document.getElementById('repo-owner') as HTMLInputElement | null;
const repoInput = document.getElementById('repo-name') as HTMLInputElement | null;
const folderInput = document.getElementById('root-folder') as HTMLInputElement | null;
const autoSyncInput = document.getElementById('auto-sync') as HTMLInputElement | null;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement | null;
const statusBanner = document.getElementById('status-banner') as HTMLDivElement | null;

function showBanner(message: string, isSuccess: boolean): void {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.className = `alert ${isSuccess ? 'alert-success' : 'alert-error'}`;
  statusBanner.style.display = 'block';
}

function collectSettings(): UserSettings {
  return {
    githubToken: tokenInput?.value.trim() || '',
    repoOwner: ownerInput?.value.trim() || '',
    repoName: repoInput?.value.trim() || '',
    rootFolder: folderInput?.value.trim() || 'LeetCode',
    autoSyncEnabled: autoSyncInput?.checked ?? true,
  };
}

async function loadInitialSettings(): Promise<void> {
  const existing = await StorageService.getSettings();
  if (!existing) return;

  if (tokenInput) tokenInput.value = existing.githubToken;
  if (ownerInput) ownerInput.value = existing.repoOwner;
  if (repoInput) repoInput.value = existing.repoName;
  if (folderInput) folderInput.value = existing.rootFolder;
  if (autoSyncInput) autoSyncInput.checked = existing.autoSyncEnabled;
}

async function handleTestClick(): Promise<void> {
  if (!testBtn) return;
  const settings = collectSettings();
  if (!settings.githubToken) {
    showBanner('Please enter a GitHub Personal Access Token to test.', false);
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';

  const isValid = await GitHubService.verifyCredentials(settings);
  testBtn.disabled = false;
  testBtn.textContent = 'Test Connection';

  if (isValid) {
    showBanner('Connection verified. Token is valid.', true);
  } else {
    showBanner('Connection failed. Please check token permissions and validity.', false);
  }
}

async function handleFormSubmit(): Promise<void> {
  const settings = collectSettings();
  await StorageService.saveSettings(settings);
  showBanner('Settings saved successfully.', true);
}

if (testBtn) {
  testBtn.addEventListener('click', () => {
    void handleTestClick();
  });
}

if (formEl) {
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleFormSubmit();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void loadInitialSettings();
});
