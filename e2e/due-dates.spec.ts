import { test, expect } from '@playwright/test';
import { registerUser, createBoard } from './helpers';

test.describe('Due Dates', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Due Date Board');
    await page.getByText('Due Date Board').click();
    await page.waitForURL(/\/boards\//);

    // Create a list and a card
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('To Do');
    await page.getByRole('button', { name: 'Add List' }).click();
    await expect(page.locator('.list-name', { hasText: 'To Do' })).toBeVisible();

    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Test Card');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await expect(page.locator('.card-title', { hasText: 'Test Card' })).toBeVisible();
  });

  test('hover card shows calendar icon', async ({ page }) => {
    const card = page.locator('.card-item').first();
    const calendarBtn = card.getByLabel('Set due date');

    // Hidden by default (opacity: 0)
    await expect(calendarBtn).toHaveCSS('opacity', '0');

    // Visible on hover
    await card.hover();
    await expect(calendarBtn).toHaveCSS('opacity', '1');
  });

  test('click calendar icon opens date picker', async ({ page }) => {
    const card = page.locator('.card-item').first();
    await card.hover();
    await card.getByLabel('Set due date').click();

    await expect(page.locator('.date-picker')).toBeVisible();
    await expect(page.locator('.date-picker input[type="date"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove due date' })).toBeVisible();
  });

  test('set due date shows badge on card', async ({ page }) => {
    const card = page.locator('.card-item').first();
    await card.hover();
    await card.getByLabel('Set due date').click();

    // Set a date far in the future (neutral status)
    const dateInput = page.locator('.date-picker input[type="date"]');
    await dateInput.fill('2027-06-15');
    // The change event fires on fill, which closes the picker

    await expect(page.locator('.due-date-badge')).toBeVisible();
    await expect(page.locator('.due-date-badge')).toContainText('Jun 15');
  });

  test('overdue date shows red badge', async ({ page }) => {
    const card = page.locator('.card-item').first();
    await card.hover();
    await card.getByLabel('Set due date').click();

    // Set a date in the past
    const dateInput = page.locator('.date-picker input[type="date"]');
    await dateInput.fill('2024-01-01');

    const badge = page.locator('.due-date-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/due-date-overdue/);
  });

  test('marking card complete shows green badge', async ({ page }) => {
    const card = page.locator('.card-item').first();

    // Set a due date first
    await card.hover();
    await card.getByLabel('Set due date').click();
    await page.locator('.date-picker input[type="date"]').fill('2027-06-15');
    await expect(page.locator('.due-date-badge')).toBeVisible();

    // Mark as complete
    await card.hover();
    await card.getByLabel('Mark complete').click();

    const badge = page.locator('.due-date-badge');
    await expect(badge).toHaveClass(/due-date-complete/);
  });

  test('remove due date hides badge', async ({ page }) => {
    const card = page.locator('.card-item').first();

    // Set a due date
    await card.hover();
    await card.getByLabel('Set due date').click();
    await page.locator('.date-picker input[type="date"]').fill('2027-06-15');
    await expect(page.locator('.due-date-badge')).toBeVisible();

    // Remove it
    await card.hover();
    await card.getByLabel('Set due date').click();
    await page.getByRole('button', { name: 'Remove due date' }).click();

    await expect(page.locator('.due-date-badge')).not.toBeVisible();
  });

  test('due date persists after page reload', async ({ page }) => {
    const card = page.locator('.card-item').first();
    await card.hover();
    await card.getByLabel('Set due date').click();
    await page.locator('.date-picker input[type="date"]').fill('2027-06-15');
    await expect(page.locator('.due-date-badge')).toBeVisible();

    // Reload
    await page.reload();
    await expect(page.locator('.due-date-badge')).toBeVisible();
    await expect(page.locator('.due-date-badge')).toContainText('Jun 15');
  });
});
