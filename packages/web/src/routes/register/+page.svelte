<script lang="ts">
  import { api, ApiError } from '$lib/api';

  let email = $state('');
  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });
      window.location.href = '/boards';
    } catch (err) {
      if (err instanceof ApiError) {
        // Generic messages only — raw API errors could aid user enumeration
        if (err.status === 409) {
          error = 'That email or username is unavailable.';
        } else if (err.status === 429) {
          error = 'Too many attempts. Please wait a minute and try again.';
        } else {
          error = 'Registration failed. Please check your details and try again.';
        }
      } else {
        error = 'An unexpected error occurred';
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <h1>Create your account</h1>

    {#if error}
      <div class="error" role="alert">{error}</div>
    {/if}

    <form onsubmit={handleSubmit}>
      <label>
        Email
        <input type="email" bind:value={email} required autocomplete="email" />
      </label>

      <label>
        Username
        <input type="text" bind:value={username} required autocomplete="username" minlength="3" maxlength="30" />
      </label>

      <label>
        Password
        <input type="password" bind:value={password} required autocomplete="new-password" minlength="12" />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>

    <p class="auth-link">
      Already have an account? <a href="/login">Sign in</a>
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

  .auth-link {
    text-align: center;
    margin-top: 16px;
    font-size: 13px;
    color: var(--color-text-subtle);
  }
</style>
