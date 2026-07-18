<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    browserSupportsWebAuthn,
    startRegistration,
    type PublicKeyCredentialCreationOptionsJSON,
  } from '@simplewebauthn/browser';

  let { data } = $props();

  let passkeys = $state(data.passkeys as Array<{
    id: string;
    deviceType: string;
    backedUp: boolean;
    createdAt: string;
  }>);
  let error = $state('');
  let success = $state('');
  let registering = $state(false);
  let supportsPasskeys = $state(false);

  onMount(() => {
    supportsPasskeys = browserSupportsWebAuthn();
  });

  async function registerPasskey() {
    error = '';
    success = '';
    registering = true;

    try {
      const { options } = await api<{ options: PublicKeyCredentialCreationOptionsJSON }>('/passkeys/register/options', {
        method: 'POST',
      });

      const regResponse = await startRegistration({ optionsJSON: options });

      await api('/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify(regResponse),
      });

      success = 'Passkey registered successfully!';

      // Reload passkey list
      const { passkeys: updated } = await api<{ passkeys: typeof passkeys }>('/passkeys');
      passkeys = updated;
    } catch (err) {
      if (err instanceof ApiError) {
        error = err.message;
      } else if (err instanceof Error && err.name === 'NotAllowedError') {
        error = 'Passkey registration was cancelled';
      } else {
        error = 'Failed to register passkey';
      }
    } finally {
      registering = false;
    }
  }

  async function deletePasskey(id: string) {
    if (!confirm('Are you sure you want to delete this passkey?')) return;

    error = '';
    success = '';

    try {
      await api(`/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      passkeys = passkeys.filter((p) => p.id !== id);
      success = 'Passkey deleted';
    } catch (err) {
      if (err instanceof ApiError) {
        error = err.message;
      } else {
        error = 'Failed to delete passkey';
      }
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // --- Change password ---
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordError = $state('');
  let passwordSuccess = $state('');
  let changingPassword = $state(false);

  async function changePassword(e: Event) {
    e.preventDefault();
    passwordError = '';
    passwordSuccess = '';

    if (newPassword.length < 12) {
      passwordError = 'New password must be at least 12 characters';
      return;
    }
    if (newPassword !== confirmPassword) {
      passwordError = 'New passwords do not match';
      return;
    }

    changingPassword = true;
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      passwordSuccess = 'Password changed. Other sessions have been signed out.';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (err) {
      passwordError = err instanceof ApiError ? err.message : 'Failed to change password';
    } finally {
      changingPassword = false;
    }
  }

  // --- Quick add (Shortcuts / Apple Watch) ---
  interface QuickAddList {
    listId: string;
    listName: string;
    boardId: string;
    boardName: string;
  }
  interface QuickAddToken {
    createdAt: string;
    lastUsedAt: string | null;
  }

  let quickAddList = $state<QuickAddList | null>(data.quickAdd.list);
  let quickAddToken = $state<QuickAddToken | null>(data.quickAdd.token);
  let boards = $state(data.boards as Array<{ id: string; name: string }>);

  let selectedBoardId = $state<string>(data.quickAdd.list?.boardId ?? '');
  let selectedListId = $state<string>(data.quickAdd.list?.listId ?? '');
  let boardLists = $state<Array<{ id: string; name: string }>>([]);
  let quickAddError = $state('');
  let quickAddSuccess = $state('');
  let savingQuickAdd = $state(false);
  let newToken = $state('');
  let tokenCopied = $state(false);

  $effect(() => {
    if (selectedBoardId) void loadBoardLists(selectedBoardId);
  });

  async function loadBoardLists(boardId: string) {
    try {
      const { board } = await api<{ board: { lists: Array<{ id: string; name: string }> } }>(
        `/boards/${encodeURIComponent(boardId)}`,
      );
      boardLists = board.lists;
      if (!boardLists.some((l) => l.id === selectedListId)) {
        selectedListId = boardLists[0]?.id ?? '';
      }
    } catch {
      boardLists = [];
    }
  }

  async function saveQuickAddConfig() {
    quickAddError = '';
    quickAddSuccess = '';
    if (!selectedListId) {
      quickAddError = 'Choose a list first';
      return;
    }
    savingQuickAdd = true;
    try {
      await api('/quick-add/config', {
        method: 'PUT',
        body: JSON.stringify({ listId: selectedListId }),
      });
      const board = boards.find((b) => b.id === selectedBoardId);
      const list = boardLists.find((l) => l.id === selectedListId);
      quickAddList = {
        listId: selectedListId,
        listName: list?.name ?? '',
        boardId: selectedBoardId,
        boardName: board?.name ?? '',
      };
      quickAddSuccess = 'Default list saved';
    } catch (err) {
      quickAddError = err instanceof ApiError ? err.message : 'Failed to save quick-add settings';
    } finally {
      savingQuickAdd = false;
    }
  }

  async function generateToken() {
    quickAddError = '';
    quickAddSuccess = '';
    tokenCopied = false;
    try {
      const { token } = await api<{ token: string }>('/quick-add/token', { method: 'POST' });
      newToken = token;
      quickAddToken = { createdAt: new Date().toISOString(), lastUsedAt: null };
    } catch (err) {
      quickAddError = err instanceof ApiError ? err.message : 'Failed to generate token';
    }
  }

  async function revokeToken() {
    if (!confirm('Revoke the quick-add token? Shortcuts using it will stop working.')) return;
    quickAddError = '';
    quickAddSuccess = '';
    try {
      await api('/quick-add/token', { method: 'DELETE' });
      quickAddToken = null;
      newToken = '';
      quickAddSuccess = 'Token revoked';
    } catch (err) {
      quickAddError = err instanceof ApiError ? err.message : 'Failed to revoke token';
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(newToken);
      tokenCopied = true;
    } catch {
      tokenCopied = false;
    }
  }

  // --- Trello import ---
  interface ImportSummary {
    boardId: string;
    boardName: string;
    lists: number;
    cards: number;
    labels: number;
    checklists: number;
    checklistItems: number;
  }

  let importFile = $state<FileList | null>(null);
  let importing = $state(false);
  let importError = $state('');
  let importSummary = $state<ImportSummary | null>(null);

  async function importTrello() {
    const file = importFile?.[0];
    if (!file) return;

    importError = '';
    importSummary = null;
    importing = true;
    try {
      const text = await file.text();
      const { summary } = await api<{ summary: ImportSummary }>('/import/trello', {
        method: 'POST',
        body: text,
      });
      importSummary = summary;
      importFile = null;
    } catch (err) {
      importError = err instanceof ApiError ? err.message : 'Import failed — is this a Trello board JSON export?';
    } finally {
      importing = false;
    }
  }
</script>

<div class="settings-page">
  <h1>Settings</h1>

  <section class="section">
    <h2>Passkeys</h2>
    <p class="section-desc">
      Passkeys let you sign in without a password using your device's biometrics or security key.
    </p>

    {#if error}
      <div class="error" role="alert">{error}</div>
    {/if}

    {#if success}
      <div class="success" role="status" aria-live="polite">{success}</div>
    {/if}

    {#if passkeys.length > 0}
      <ul class="passkey-list">
        {#each passkeys as passkey (passkey.id)}
          <li class="passkey-item">
            <div class="passkey-info">
              <span class="passkey-type">
                {passkey.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device-bound passkey'}
              </span>
              <span class="passkey-meta">
                Added {formatDate(passkey.createdAt)}
                {#if passkey.backedUp}
                  &middot; Backed up
                {/if}
              </span>
            </div>
            <button class="delete-btn" onclick={() => deletePasskey(passkey.id)}>
              Delete
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No passkeys registered yet.</p>
    {/if}

    {#if supportsPasskeys}
      <button
        class="register-btn"
        onclick={registerPasskey}
        disabled={registering}
      >
        {registering ? 'Registering...' : '+ Register new passkey'}
      </button>
    {:else}
      <p class="unsupported">Your browser does not support passkeys.</p>
    {/if}
  </section>

  <section class="section">
    <h2>Change password</h2>
    <p class="section-desc">
      Changing your password signs you out everywhere else.
    </p>

    {#if passwordError}
      <div class="error" role="alert">{passwordError}</div>
    {/if}

    {#if passwordSuccess}
      <div class="success" role="status" aria-live="polite">{passwordSuccess}</div>
    {/if}

    <form class="password-form" onsubmit={changePassword}>
      <label>
        Current password
        <input type="password" bind:value={currentPassword} autocomplete="current-password" required />
      </label>
      <label>
        New password
        <input type="password" bind:value={newPassword} autocomplete="new-password" required minlength="12" />
      </label>
      <label>
        Confirm new password
        <input type="password" bind:value={confirmPassword} autocomplete="new-password" required minlength="12" />
      </label>
      <button type="submit" class="register-btn" disabled={changingPassword}>
        {changingPassword ? 'Changing...' : 'Change password'}
      </button>
    </form>
  </section>

  <section class="section">
    <h2>Quick add</h2>
    <p class="section-desc">
      Add cards from the iOS/watchOS Shortcuts app (e.g. by dictation). Pick a default list,
      generate a token, and have your Shortcut POST to
      <code>/api/v1/quick-add</code> with body <code>{'{'}"text": "…"{'}'}</code> and header
      <code>Authorization: Bearer &lt;token&gt;</code>. Prefix the text with a board name and a
      colon ("Groceries: buy milk") to target that board's first list instead.
    </p>

    {#if quickAddError}
      <div class="error" role="alert">{quickAddError}</div>
    {/if}

    {#if quickAddSuccess}
      <div class="success" role="status" aria-live="polite">{quickAddSuccess}</div>
    {/if}

    <div class="quick-add-config">
      <div class="quick-add-pickers">
        <label>
          Board
          <select bind:value={selectedBoardId}>
            <option value="" disabled>Select a board…</option>
            {#each boards as board (board.id)}
              <option value={board.id}>{board.name}</option>
            {/each}
          </select>
        </label>
        <label>
          Default list
          <select bind:value={selectedListId} disabled={!selectedBoardId}>
            {#each boardLists as list (list.id)}
              <option value={list.id}>{list.name}</option>
            {/each}
          </select>
        </label>
      </div>
      <button
        class="register-btn"
        onclick={saveQuickAddConfig}
        disabled={savingQuickAdd || !selectedListId}
      >
        {savingQuickAdd ? 'Saving...' : 'Save default list'}
      </button>
      {#if quickAddList}
        <p class="quick-add-current">
          Currently adding to <strong>{quickAddList.boardName}</strong> /
          <strong>{quickAddList.listName}</strong>
        </p>
      {:else}
        <p class="quick-add-current">No default list configured yet.</p>
      {/if}
    </div>

    <div class="quick-add-token">
      <h3>API token</h3>
      {#if newToken}
        <div class="token-reveal">
          <input type="text" readonly value={newToken} onfocus={(e) => (e.target as HTMLInputElement).select()} />
          <button class="copy-btn" onclick={copyToken}>{tokenCopied ? 'Copied!' : 'Copy'}</button>
        </div>
        <p class="token-warning">Copy this token now — it won't be shown again.</p>
      {:else if quickAddToken}
        <p class="quick-add-current">
          Token created {formatDate(quickAddToken.createdAt)}
          {#if quickAddToken.lastUsedAt}
            &middot; last used {formatDate(quickAddToken.lastUsedAt)}
          {:else}
            &middot; never used
          {/if}
        </p>
      {:else}
        <p class="quick-add-current">No token yet.</p>
      {/if}
      <div class="token-actions">
        <button class="register-btn token-btn" onclick={generateToken}>
          {quickAddToken || newToken ? 'Regenerate token' : 'Generate token'}
        </button>
        {#if quickAddToken || newToken}
          <button class="delete-btn" onclick={revokeToken}>Revoke</button>
        {/if}
      </div>
    </div>
  </section>

  <section class="section">
    <h2>Import from Trello</h2>
    <p class="section-desc">
      Import a Trello board as a new KanBang board. In Trello, open the board menu →
      "Print, export, and share" → "Export as JSON", save the file, and upload it here.
      Lists, cards, labels, due dates, checklists, and archived items are preserved.
      Repeat per board.
    </p>

    {#if importError}
      <div class="error" role="alert">{importError}</div>
    {/if}

    {#if importSummary}
      <div class="success" role="status" aria-live="polite">
        Imported <strong>{importSummary.boardName}</strong>: {importSummary.lists} lists,
        {importSummary.cards} cards, {importSummary.labels} labels,
        {importSummary.checklists} checklists ({importSummary.checklistItems} items).
        <a href={`/boards/${importSummary.boardId}`}>Open board</a>
      </div>
    {/if}

    <div class="import-controls">
      <input type="file" accept=".json,application/json" bind:files={importFile} />
      <button
        class="register-btn token-btn"
        onclick={importTrello}
        disabled={importing || !importFile?.length}
      >
        {importing ? 'Importing...' : 'Import board'}
      </button>
    </div>
  </section>

  <section class="section">
    <h2>Export data</h2>
    <p class="section-desc">
      Download all your boards, lists, cards, and checklists (including archived items) as a JSON file.
    </p>
    <a class="register-btn export-btn" href="/api/v1/export" download>
      Download export
    </a>
  </section>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  h1 {
    font-size: 20px;
    margin-bottom: 24px;
  }

  .section {
    background: var(--color-surface);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .section + .section {
    margin-top: 20px;
  }

  .password-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .password-form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--color-text-subtle);
  }

  .password-form input {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
  }

  .password-form input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .export-btn {
    display: block;
    text-align: center;
    text-decoration: none;
    box-sizing: border-box;
  }

  .section-desc code {
    font-size: 12px;
    background: var(--color-bg, #f4f5f7);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .quick-add-pickers {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .quick-add-pickers label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--color-text-subtle);
  }

  .quick-add-pickers select {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    background: white;
  }

  .quick-add-current {
    font-size: 13px;
    color: var(--color-text-subtle);
    margin-top: 12px;
  }

  .quick-add-token {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .quick-add-token h3 {
    font-size: 14px;
    margin-bottom: 8px;
  }

  .token-reveal {
    display: flex;
    gap: 8px;
  }

  .token-reveal input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-family: monospace;
  }

  .copy-btn {
    padding: 8px 14px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .token-warning {
    font-size: 12px;
    color: var(--color-danger);
    margin-top: 6px;
  }

  .token-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
  }

  .token-btn {
    width: auto;
    padding: 8px 14px;
  }

  .import-controls {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .import-controls input[type='file'] {
    flex: 1;
    font-size: 13px;
  }

  .success a {
    color: inherit;
    font-weight: 600;
  }

  h2 {
    font-size: 16px;
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 13px;
    color: var(--color-text-subtle);
    margin-bottom: 16px;
  }

  .error {
    padding: 8px 12px;
    margin-bottom: 12px;
    background: #fdf2f2;
    color: var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .success {
    padding: 8px 12px;
    margin-bottom: 12px;
    background: #f0fdf4;
    color: #166534;
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .passkey-list {
    list-style: none;
    padding: 0;
    margin: 0 0 16px 0;
  }

  .passkey-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .passkey-item:last-child {
    border-bottom: none;
  }

  .passkey-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .passkey-type {
    font-size: 14px;
    font-weight: 500;
  }

  .passkey-meta {
    font-size: 12px;
    color: var(--color-text-subtle);
  }

  .delete-btn {
    padding: 4px 12px;
    background: none;
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: 12px;
    cursor: pointer;
  }

  .delete-btn:hover {
    background: #fdf2f2;
  }

  .register-btn {
    width: 100%;
    padding: 10px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .register-btn:hover {
    background: var(--color-primary-hover);
  }

  .register-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .empty {
    font-size: 13px;
    color: var(--color-text-subtle);
    margin-bottom: 16px;
  }

  .unsupported {
    font-size: 13px;
    color: var(--color-text-subtle);
    font-style: italic;
  }
</style>
