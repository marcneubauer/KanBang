import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

test.describe('Card description markdown', () => {
  test('renders saved description as markdown', async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Desc Board');
    await page.getByText('Desc Board').click();
    await page.waitForURL(/\/boards\//);
    await createList(page, 'To Do');
    await createCard(page, 'To Do', 'Doc card');

    await page.locator('.card-title', { hasText: 'Doc card' }).click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('.description-display').click();
    await page.locator('.description-textarea').fill('**Important** steps:\n- first\n- second');
    await page.locator('.description-textarea').blur();

    const display = page.locator('.description-display');
    await expect(display.locator('strong', { hasText: 'Important' })).toBeVisible();
    await expect(display.locator('li')).toHaveCount(2);
  });
});
