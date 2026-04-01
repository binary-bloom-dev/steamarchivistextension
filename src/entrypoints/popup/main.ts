import { STORAGE_KEYS } from '@/lib/constants';

const rawStatusEl = document.getElementById('status');
if (!rawStatusEl) throw new Error('Popup HTML is missing #status element');
const statusEl: HTMLElement = rawStatusEl;

async function updateStatus(): Promise<void> {
  const stored = await browser.storage.session.get([
    STORAGE_KEYS.token,
    STORAGE_KEYS.acquiredAt,
    STORAGE_KEYS.expiresIn,
  ]);

  if (stored[STORAGE_KEYS.token]) {
    // Check if the token might be expired
    const acquiredAt = stored[STORAGE_KEYS.acquiredAt] as number | undefined;
    const expiresIn = (stored[STORAGE_KEYS.expiresIn] as number | undefined) ?? 600;

    if (acquiredAt && Date.now() - acquiredAt > expiresIn * 1000) {
      statusEl.className = 'status unlinked';
      statusEl.textContent = 'Token expired. Visit steamarchivist.com while logged in to refresh.';
      await browser.storage.session.remove([
        STORAGE_KEYS.token,
        STORAGE_KEYS.acquiredAt,
        STORAGE_KEYS.expiresIn,
      ]);
      return;
    }

    statusEl.className = 'status linked';
    statusEl.textContent = 'Linked. Visit your Steam purchase history page and click the export button.';
  } else {
    statusEl.className = 'status unlinked';
    statusEl.textContent = 'Not linked. Visit steamarchivist.com while logged in to connect.';
  }
}

updateStatus();
