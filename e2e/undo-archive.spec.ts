import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

test.describe('Undo archive', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Undo Board');
    await page.getByText('Undo Board').click();
    await page.waitForURL(/\/boards\//);
    await createList(page, 'To Do');
    await createCard(page, 'To Do', 'Precious card');
  });

  test('archiving a card shows a toast and Undo restores it', async ({ page }) => {
    const card = page.locator('.card-item', { hasText: 'Precious card' });
    await card.hover();
    await card.getByLabel('Archive card').click();

    await expect(card).not.toBeVisible();
    const toast = page.locator('.toast', { hasText: 'Card "Precious card" archived' });
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.card-item', { hasText: 'Precious card' })).toBeVisible();
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('archiving a list shows a toast and Undo restores it with its cards', async ({ page }) => {
    const list = page.locator('.list-column', { hasText: 'To Do' });
    await list.locator('.list-header').hover();
    await list.getByLabel('Archive list').click();

    await expect(list).not.toBeVisible();
    const toast = page.locator('.toast', { hasText: 'List "To Do" archived' });
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.list-column', { hasText: 'To Do' })).toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'Precious card' })).toBeVisible();
  });

  test('toast auto-dismisses without undoing', async ({ page }) => {
    const card = page.locator('.card-item', { hasText: 'Precious card' });
    await card.hover();
    await card.getByLabel('Archive card').click();

    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('.card-item', { hasText: 'Precious card' })).not.toBeVisible();
  });
});
