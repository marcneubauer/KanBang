import { test, expect } from '@playwright/test';
import { registerUser, createBoard } from './helpers';

test.describe('Boards', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('create a new board', async ({ page }) => {
    await createBoard(page, 'My Project');
    await expect(page.locator('.board-card', { hasText: 'My Project' })).toBeVisible();
  });

  test('see board in board list', async ({ page }) => {
    await createBoard(page, 'Board Alpha');
    await createBoard(page, 'Board Beta');

    await expect(page.locator('.board-card')).toHaveCount(2);
    await expect(page.getByText('Board Alpha')).toBeVisible();
    await expect(page.getByText('Board Beta')).toBeVisible();
  });

  test('navigate to board detail', async ({ page }) => {
    await createBoard(page, 'Test Board');
    await page.getByText('Test Board').click();

    await expect(page.locator('.board-name')).toHaveText('Test Board');
    await expect(page.getByText('+ Add another list')).toBeVisible();
  });

  test('rename a board by double clicking', async ({ page }) => {
    await createBoard(page, 'Old Name');
    await page.getByText('Old Name').click();
    await page.waitForURL(/\/boards\//);

    // Double click board name to edit
    await page.locator('.board-name').dblclick();
    const input = page.locator('.board-name-input');
    await input.clear();
    await input.fill('New Name');
    await input.press('Enter');

    await expect(page.locator('.board-name')).toHaveText('New Name');
  });

  test('archive a board via settings', async ({ page }) => {
    await createBoard(page, 'To Archive');
    await page.getByText('To Archive').click();
    await page.waitForURL(/\/boards\//);

    // Open board settings
    await page.getByLabel('Board settings').click();
    await expect(page.getByText('Board Settings')).toBeVisible();

    // Click archive, then confirm
    await page.getByRole('button', { name: 'Archive this board' }).click();
    await page.getByRole('button', { name: 'Yes, archive board' }).click();

    // Should redirect to boards list without the archived board
    await page.waitForURL('/boards');
    await expect(page.locator('.board-card', { hasText: 'To Archive' })).toHaveCount(0);
  });

  test('empty state when no boards', async ({ page }) => {
    await expect(page.getByText('No boards yet')).toBeVisible();
  });
});
