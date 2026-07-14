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
