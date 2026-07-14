import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

test.describe('Labels', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Label Board');
    await page.getByText('Label Board').click();
    await page.waitForURL(/\/boards\//);

    await createList(page, 'To Do');
    await createCard(page, 'To Do', 'Card A');
    // The add-card form stays open after submit — reuse it for the second card
    await page.getByPlaceholder('Enter a title for this card...').fill('Card B');
    await page.getByRole('button', { name: 'Add Card' }).click();
    await page.locator('.card-title', { hasText: 'Card B' }).waitFor();
  });

  async function openCardModal(page: import('@playwright/test').Page, title: string) {
    await page.locator('.card-title', { hasText: title }).click();
    await expect(page.locator('.modal')).toBeVisible();
  }

  async function createLabelOnCard(page: import('@playwright/test').Page, cardTitle: string, labelName: string) {
    await openCardModal(page, cardTitle);
    await page.getByText('+ Create a new label').click();
    await page.getByPlaceholder('Label name (optional)').fill(labelName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    // New label is auto-assigned: toggle row shows a checkmark
    await expect(page.locator('.label-toggle', { hasText: labelName })).toContainText('✓');
    await page.getByLabel('Close').click();
  }

  test('create a label from the card modal and see the chip on the card face', async ({ page }) => {
    await createLabelOnCard(page, 'Card A', 'Bug');

    const cardA = page.locator('.card-item', { hasText: 'Card A' });
    await expect(cardA.locator('.card-label-chip', { hasText: 'Bug' })).toBeVisible();

    const cardB = page.locator('.card-item', { hasText: 'Card B' });
    await expect(cardB.locator('.card-label-chip')).toHaveCount(0);
  });

  test('toggling a label off removes the chip', async ({ page }) => {
    await createLabelOnCard(page, 'Card A', 'Bug');

    await openCardModal(page, 'Card A');
    await page.locator('.label-toggle', { hasText: 'Bug' }).click();
    await expect(page.locator('.label-toggle', { hasText: 'Bug' })).not.toContainText('✓');
    await page.getByLabel('Close').click();

    const cardA = page.locator('.card-item', { hasText: 'Card A' });
    await expect(cardA.locator('.card-label-chip')).toHaveCount(0);
  });

  test('filtering by label dims non-matching cards', async ({ page }) => {
    await createLabelOnCard(page, 'Card A', 'Bug');

    await page.locator('.label-filter-chip', { hasText: 'Bug' }).click();

    const cardA = page.locator('.card-item', { hasText: 'Card A' });
    const cardB = page.locator('.card-item', { hasText: 'Card B' });
    await expect(cardB).toHaveClass(/card-item-dimmed/);
    await expect(cardA).not.toHaveClass(/card-item-dimmed/);

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(cardB).not.toHaveClass(/card-item-dimmed/);
  });

  test('label persists after reload', async ({ page }) => {
    await createLabelOnCard(page, 'Card A', 'Bug');

    await page.reload({ waitUntil: 'networkidle' });

    const cardA = page.locator('.card-item', { hasText: 'Card A' });
    await expect(cardA.locator('.card-label-chip', { hasText: 'Bug' })).toBeVisible();
  });
});
