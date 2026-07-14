import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

test.describe('Move card via modal', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Move Board');
    await page.getByText('Move Board').click();
    await page.waitForURL(/\/boards\//);

    await createList(page, 'To Do');
    await createList(page, 'Doing');
    await createCard(page, 'To Do', 'Movable card');
  });

  test('moves a card to another list from the modal', async ({ page }) => {
    await page.locator('.card-title', { hasText: 'Movable card' }).click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.getByLabel('Target list').selectOption({ label: 'Doing' });
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await page.getByLabel('Close').click();

    const doing = page.locator('.list-column', { hasText: 'Doing' });
    await expect(doing.locator('.card-title', { hasText: 'Movable card' })).toBeVisible();
    const todo = page.locator('.list-column', { hasText: 'To Do' });
    await expect(todo.locator('.card-title')).toHaveCount(0);
  });

  test('moves a card to a specific position within a list', async ({ page }) => {
    // Two more cards in To Do (add-card form stays open after submit)
    const input = page.getByPlaceholder('Enter a title for this card...');
    await input.fill('Second card');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await page.locator('.card-title', { hasText: 'Second card' }).waitFor();
    await input.fill('Third card');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await page.locator('.card-title', { hasText: 'Third card' }).waitFor();

    // Move "Third card" to position 1 in the same list
    await page.locator('.card-title', { hasText: 'Third card' }).click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.getByLabel('Target position').selectOption('1');
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await page.getByLabel('Close').click();

    const titles = page.locator('.list-column .card-title');
    await expect(titles.nth(0)).toHaveText(/Third card/);
    await expect(titles.nth(1)).toHaveText(/Movable card/);
  });
});
