<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    browserSupportsWebAuthn,
    startAuthentication,
    type PublicKeyCredentialRequestOptionsJSON,
  } from '@simplewebauthn/browser';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let passkeyLoading = $state(false);
  let supportsPasskeys = $state(false);

  onMount(() => {
    supportsPasskeys = browserSupportsWebAuthn();
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await invalidateAll();
      window.location.href = '/boards';
    } catch (err) {
      if (err instanceof ApiError) {
        error = err.message;
      } else {
        error = 'An unexpected error occurred';
      }
    } finally {
      loading = false;
    }
  }

  async function handlePasskeyLogin() {
    error = '';
    passkeyLoading = true;

    try {
      const { options } = await api<{ options: PublicKeyCredentialRequestOptionsJSON }>('/passkeys/login/options', {
        method: 'POST',
      });

      const authResponse = await startAuthentication({ optionsJSON: options });

      await api('/passkeys/login/verify', {
        method: 'POST',
        body: JSON.stringify(authResponse),
      });

      await invalidateAll();
      window.location.href = '/boards';
    } catch (err) {
      if (err instanceof ApiError) {
        error = err.message;
      } else if (err instanceof Error && err.name === 'NotAllowedError') {
        error = 'Passkey authentication was cancelled';
      } else {
        error = 'Passkey authentication failed';
      }
    } finally {
      passkeyLoading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <h1>Sign in to KanBang</h1>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onsubmit={handleSubmit}>
      <label>
        Email
        <input type="email" bind:value={email} required autocomplete="email" />
      </label>

      <label>
        Password
        <input type="password" bind:value={password} required autocomplete="current-password" />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>

    {#if supportsPasskeys}
      <div class="divider">
        <span>or</span>
      </div>

      <button
        class="passkey-btn"
        onclick={handlePasskeyLogin}
        disabled={passkeyLoading}
      >
        {passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey'}
      </button>
    {/if}

    <p class="auth-link">
      Don't have an account? <a href="/register">Create one</a>
    </p>
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: var(--color-bg);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    padding: 32px;
    background: var(--color-surface);
    border-radius: var(--radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  h1 {
    text-align: center;
    margin-bottom: 24px;
    font-size: 20px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-subtle);
  }

  input {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
  }

  input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  button[type='submit'] {
    padding: 10px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  button[type='submit']:hover {
    background: var(--color-primary-hover);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    padding: 8px 12px;
    margin-bottom: 16px;
    background: #fdf2f2;
    color: var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    color: var(--color-text-subtle);
    font-size: 13px;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--color-border);
  }

  .passkey-btn {
    width: 100%;
    padding: 10px;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .passkey-btn:hover {
    background: var(--color-bg);
  }

  .auth-link {
    text-align: center;
    margin-top: 16px;
    font-size: 13px;
    color: var(--color-text-subtle);
  }
</style>
