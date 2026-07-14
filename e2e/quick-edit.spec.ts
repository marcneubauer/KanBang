import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

test.describe('Card quick-edit', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Quick Board');
    await page.getByText('Quick Board').click();
    await page.waitForURL(/\/boards\//);
    await createList(page, 'To Do');
    await createCard(page, 'To Do', 'Original title');
  });

  async function openQuickEdit(page: import('@playwright/test').Page, cardTitle: string) {
    const card = page.locator('.card-item', { hasText: cardTitle });
    await card.hover();
    await card.getByLabel('Quick edit card').click();
    await expect(page.locator('.quick-edit')).toBeVisible();
    return card;
  }

  test('pencil icon appears on hover and opens the popover', async ({ page }) => {
    const card = page.locator('.card-item', { hasText: 'Original title' });
    const pencil = card.getByLabel('Quick edit card');

    await expect(pencil).toHaveCSS('opacity', '0');
    await card.hover();
    await expect(pencil).toHaveCSS('opacity', '1');

    await pencil.click();
    await expect(page.locator('.quick-edit')).toBeVisible();
  });

  test('edits the title without opening the modal', async ({ page }) => {
    await openQuickEdit(page, 'Original title');

    await page.locator('.quick-edit-title').fill('Renamed via quick edit');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('.quick-edit')).not.toBeVisible();
    await expect(page.locator('.modal')).not.toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'Renamed via quick edit' })).toBeVisible();

    // Persists after reload
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.card-title', { hasText: 'Renamed via quick edit' })).toBeVisible();
  });

  test('toggles a label from the popover', async ({ page }) => {
    // Create a label via the card modal first
    await page.locator('.card-title', { hasText: 'Original title' }).click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.getByText('+ Create a new label').click();
    await page.getByPlaceholder('Label name (optional)').fill('Bug');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('.label-toggle', { hasText: 'Bug' })).toContainText('✓');
    // Remove it so the quick-edit toggle starts unassigned
    await page.locator('.label-toggle', { hasText: 'Bug' }).click();
    await expect(page.locator('.label-toggle', { hasText: 'Bug' })).not.toContainText('✓');
    await page.getByLabel('Close').click();

    const card = await openQuickEdit(page, 'Original title');
    await page.locator('.quick-edit-label', { hasText: 'Bug' }).click();
    await expect(page.locator('.quick-edit-label', { hasText: 'Bug' })).toContainText('✓');
    await page.keyboard.press('Escape');

    await expect(card.locator('.card-label-chip', { hasText: 'Bug' })).toBeVisible();
  });

  test('sets a due date from the popover', async ({ page }) => {
    const card = await openQuickEdit(page, 'Original title');

    await page.locator('.quick-edit input[type="date"]').fill('2027-06-15');
    await page.keyboard.press('Escape');

    await expect(card.locator('.due-date-badge')).toContainText('Jun 15');
  });
});
