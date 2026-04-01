const statusEl = document.getElementById('status')!;

async function updateStatus(): Promise<void> {
  const stored = await browser.storage.session.get(['token', 'acquired_at', 'expires_in']);

  if (stored.token) {
    // Check if the token might be expired
    const acquiredAt = stored.acquired_at as number | undefined;
    const expiresIn = (stored.expires_in as number | undefined) ?? 600;

    if (acquiredAt && Date.now() - acquiredAt > expiresIn * 1000) {
      statusEl.className = 'status unlinked';
      statusEl.textContent = 'Token expired. Visit steamarchivist.com while logged in to refresh.';
      await browser.storage.session.remove(['token', 'acquired_at', 'expires_in']);
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
