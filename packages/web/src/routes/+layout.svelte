<script lang="ts">
  import '../app.css';
  import { api } from '$lib/api';
  import ErrorIndicator from '$lib/components/ErrorIndicator.svelte';
  import Toaster from '$lib/components/Toaster.svelte';

  let { data, children } = $props();

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
</script>

{#if data.user}
  <nav class="nav">
    <a href="/boards" class="nav-brand">KanBang</a>
    <div class="nav-right">
      <ErrorIndicator />
      <span class="nav-user">{data.user.username}</span>
      <a href="/settings" class="nav-link">Settings</a>
      <button class="nav-logout" onclick={logout} aria-label="Log out">Log out</button>
    </div>
  </nav>
{/if}

<main class:has-nav={!!data.user}>
  {@render children()}
</main>

<Toaster />

<style>
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 48px;
    background-color: var(--color-primary);
    color: white;
  }

  .nav-brand {
    font-size: 18px;
    font-weight: 700;
    color: white;
    text-decoration: none;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-user {
    font-size: 14px;
    opacity: 0.9;
  }

  .nav-link {
    font-size: 13px;
    color: white;
    text-decoration: none;
    opacity: 0.9;
  }

  .nav-link:hover {
    opacity: 1;
  }

  .nav-logout {
    padding: 4px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    font-size: 13px;
  }

  .nav-logout:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  main {
    height: 100vh;
  }

  main.has-nav {
    height: calc(100vh - 48px);
  }
</style>
