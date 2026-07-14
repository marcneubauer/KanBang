import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

test.describe('Board search and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Filter Board');
    await page.getByText('Filter Board').click();
    await page.waitForURL(/\/boards\//);

    await createList(page, 'To Do');
    await createCard(page, 'To Do', 'Fix login bug');
    // The add-card form stays open after submit — reuse it for the second card
    await page.getByPlaceholder('Enter a title for this card...').fill('Write docs');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await page.locator('.card-title', { hasText: 'Write docs' }).waitFor();
  });

  test('search dims non-matching cards in place', async ({ page }) => {
    await page.getByPlaceholder('Search cards...').fill('login');

    const matching = page.locator('.card-item', { hasText: 'Fix login bug' });
    const other = page.locator('.card-item', { hasText: 'Write docs' });
    await expect(other).toHaveClass(/card-item-dimmed/);
    await expect(matching).not.toHaveClass(/card-item-dimmed/);

    // Both cards remain visible — search does not navigate or hide
    await expect(matching).toBeVisible();
    await expect(other).toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(other).not.toHaveClass(/card-item-dimmed/);
    await expect(page.getByPlaceholder('Search cards...')).toHaveValue('');
  });

  test('search matches are case-insensitive', async ({ page }) => {
    await page.getByPlaceholder('Search cards...').fill('LOGIN');
    await expect(page.locator('.card-item', { hasText: 'Write docs' })).toHaveClass(/card-item-dimmed/);
    await expect(page.locator('.card-item', { hasText: 'Fix login bug' })).not.toHaveClass(/card-item-dimmed/);
  });

  test('due date filter dims cards without a matching due date', async ({ page }) => {
    // Give "Fix login bug" an overdue date
    const card = page.locator('.card-item', { hasText: 'Fix login bug' });
    await card.hover();
    await card.getByLabel('Set due date').click();
    await page.locator('.date-picker input[type="date"]').fill('2020-01-01');
    await expect(page.locator('.due-date-badge')).toBeVisible();

    await page.getByLabel('Filter by due date').selectOption('overdue');

    await expect(page.locator('.card-item', { hasText: 'Write docs' })).toHaveClass(/card-item-dimmed/);
    await expect(card).not.toHaveClass(/card-item-dimmed/);

    // "No due date" inverts the match
    await page.getByLabel('Filter by due date').selectOption('none');
    await expect(card).toHaveClass(/card-item-dimmed/);
    await expect(page.locator('.card-item', { hasText: 'Write docs' })).not.toHaveClass(/card-item-dimmed/);
  });
});
