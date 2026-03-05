import { test, expect } from '@playwright/test';
import { registerUser, createBoard } from './helpers';

test.describe('Lists and Cards', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Test Board');
    await page.getByText('Test Board').click();
    await page.waitForURL(/\/boards\//);
  });

  test('add a list to a board', async ({ page }) => {
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('To Do');
    await page.getByRole('button', { name: 'Add List' }).click();

    await expect(page.locator('.list-name', { hasText: 'To Do' })).toBeVisible();
  });

  test('add multiple lists', async ({ page }) => {
    // Add first list
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('To Do');
    await page.getByRole('button', { name: 'Add List' }).click();
    await expect(page.locator('.list-name', { hasText: 'To Do' })).toBeVisible();

    // Form stays open after adding, just type the next name
    await page.getByPlaceholder('Enter list name...').fill('In Progress');
    await page.getByRole('button', { name: 'Add List' }).click();
    await expect(page.locator('.list-name', { hasText: 'In Progress' })).toBeVisible();

    await expect(page.locator('.list-column')).toHaveCount(2);
  });

  test('rename a list', async ({ page }) => {
    // Create list
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Old List');
    await page.getByRole('button', { name: 'Add List' }).click();

    // Double-click to edit
    await page.locator('.list-name', { hasText: 'Old List' }).dblclick();
    const input = page.locator('.list-name-input');
    await input.clear();
    await input.fill('Renamed List');
    await input.press('Enter');

    await expect(page.locator('.list-name', { hasText: 'Renamed List' })).toBeVisible();
  });

  test('delete a list', async ({ page }) => {
    // Create list
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Remove Me');
    await page.getByRole('button', { name: 'Add List' }).click();

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Delete list').click({ force: true });

    await expect(page.locator('.list-column')).toHaveCount(0);
  });

  test('add a card to a list', async ({ page }) => {
    // Create list
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('My List');
    await page.getByRole('button', { name: 'Add List' }).click();

    // Add card
    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('My First Card');
    await page.getByRole('button', { name: 'Add Card' }).click();

    await expect(page.locator('.card-title', { hasText: 'My First Card' })).toBeVisible();
  });

  test('add multiple cards to a list', async ({ page }) => {
    // Create list
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Tasks');
    await page.getByRole('button', { name: 'Add List' }).click();

    // Add cards
    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Card A');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await expect(page.locator('.card-title', { hasText: 'Card A' })).toBeVisible();

    // Form stays open after adding, just type the next title
    await page.getByPlaceholder('Enter a title for this card...').fill('Card B');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await expect(page.locator('.card-title', { hasText: 'Card B' })).toBeVisible();

    await expect(page.locator('.card-item')).toHaveCount(2);
  });

  test('edit a card title', async ({ page }) => {
    // Create list + card
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Tasks');
    await page.getByRole('button', { name: 'Add List' }).click();

    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Original Title');
    await page.getByRole('button', { name: 'Add Card' }).click();

    // Double-click to edit
    await page.locator('.card-title', { hasText: 'Original Title' }).dblclick();
    const input = page.locator('.card-title-input');
    await input.clear();
    await input.fill('Updated Title');
    await input.press('Enter');

    await expect(page.locator('.card-title', { hasText: 'Updated Title' })).toBeVisible();
  });

  test('delete a card', async ({ page }) => {
    // Create list + card
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Tasks');
    await page.getByRole('button', { name: 'Add List' }).click();

    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Delete Me');
    await page.getByRole('button', { name: 'Add Card' }).click();

    await page.locator('.card-item', { hasText: 'Delete Me' }).locator('.card-delete').click({
      force: true,
    });

    await expect(page.locator('.card-item')).toHaveCount(0);
  });

  test('toggle card completed checkbox', async ({ page }) => {
    // Create list + card
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Tasks');
    await page.getByRole('button', { name: 'Add List' }).click();

    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Checkable Card');
    await page.getByRole('button', { name: 'Add Card' }).click();

    const cardItem = page.locator('.card-item', { hasText: 'Checkable Card' });
    const checkbox = cardItem.locator('.card-checkbox');

    // Checkbox hidden by default
    await expect(checkbox).toHaveCSS('opacity', '0');

    // Checkbox visible on hover
    await cardItem.hover();
    await expect(checkbox).toHaveCSS('opacity', '1');

    // Click to mark complete
    await checkbox.click();
    await expect(checkbox).toHaveClass(/card-checkbox-checked/);
    await expect(cardItem.locator('.card-title')).toHaveClass(/card-title-completed/);

    // Checkbox stays visible when checked (even without hover)
    await page.locator('body').click();
    await expect(checkbox).toHaveCSS('opacity', '1');

    // Click again to uncheck
    await cardItem.hover();
    await checkbox.click();
    await expect(checkbox).not.toHaveClass(/card-checkbox-checked/);
    await expect(cardItem.locator('.card-title')).not.toHaveClass(/card-title-completed/);
  });

  test('completed status persists after reload', async ({ page }) => {
    // Create list + card
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Tasks');
    await page.getByRole('button', { name: 'Add List' }).click();

    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Persist Check');
    await page.getByRole('button', { name: 'Add Card' }).click();

    // Mark as completed
    const cardItem = page.locator('.card-item', { hasText: 'Persist Check' });
    await cardItem.hover();
    await cardItem.locator('.card-checkbox').click();

    // Reload and verify
    await page.reload();
    const reloadedCheckbox = page.locator('.card-item', { hasText: 'Persist Check' }).locator('.card-checkbox');
    await expect(reloadedCheckbox).toHaveClass(/card-checkbox-checked/);
  });

  test('data persists after page reload', async ({ page }) => {
    // Create list + card
    await page.getByText('+ Add another list').click();
    await page.getByPlaceholder('Enter list name...').fill('Persistent List');
    await page.getByRole('button', { name: 'Add List' }).click();

    await page.getByText('+ Add a card').click();
    await page.getByPlaceholder('Enter a title for this card...').fill('Persistent Card');
    await page.getByRole('button', { name: 'Add Card' }).click();

    // Reload and verify
    await page.reload();

    await expect(page.locator('.list-name', { hasText: 'Persistent List' })).toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'Persistent Card' })).toBeVisible();
  });
});
