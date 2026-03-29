import { test, expect } from '@playwright/test';
import { registerUser, createBoard, createList, createCard } from './helpers';

async function setDoneList(page: import('@playwright/test').Page, listName: string) {
  await page.getByLabel('Board settings').click();
  await expect(page.getByText('Board Settings')).toBeVisible();
  await page.locator('#done-list-select').selectOption({ label: listName });
  // The onupdated callback re-fetches board data which can re-render the modal.
  // Close by pressing Escape which is handled by the modal's keydown handler.
  await page.keyboard.press('Escape');
  // Wait for modal to disappear
  await expect(page.locator('.modal-backdrop')).toBeHidden();
}

async function expandDoneList(page: import('@playwright/test').Page) {
  const collapsed = page.locator('.list-collapsed-done');
  if (await collapsed.isVisible()) {
    await collapsed.click();
    await expect(page.locator('.list-column-done')).toBeVisible();
  }
}

test.describe('Done Column', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createBoard(page, 'Done Test Board');
    await page.getByText('Done Test Board').click();
    await page.waitForURL(/\/boards\//);
  });

  test('designate a list as done via board settings', async ({ page }) => {
    await createList(page, 'To Do');
    await createList(page, 'Done');

    await setDoneList(page, 'Done');
    await expandDoneList(page);

    await expect(page.locator('.list-column-done .done-check')).toBeVisible();
  });

  test('completing a card auto-moves it to the done list', async ({ page }) => {
    await createList(page, 'To Do');
    await createList(page, 'Done');
    await setDoneList(page, 'Done');

    await createCard(page, 'To Do', 'My Task');

    // Mark card complete
    const cardItem = page.locator('.card-item', { hasText: 'My Task' });
    await cardItem.hover();
    await cardItem.locator('.card-checkbox').click();

    // Card should move to done list
    await expandDoneList(page);

    const doneColumn = page.locator('.list-column-done');
    const movedCard = doneColumn.locator('.card-item', { hasText: 'My Task' });
    await expect(movedCard).toBeVisible();
    await expect(movedCard.locator('.card-checkbox-checked')).toBeVisible();
  });

  test('completed card has green checkbox indicator', async ({ page }) => {
    await createList(page, 'To Do');
    await createList(page, 'Done');
    await setDoneList(page, 'Done');

    await createCard(page, 'To Do', 'Green Check Task');

    // Mark complete
    const cardItem = page.locator('.card-item', { hasText: 'Green Check Task' });
    await cardItem.hover();
    await cardItem.locator('.card-checkbox').click();

    await expandDoneList(page);

    // The checked checkbox should contain the green SVG rect (fill="#22c55e")
    const doneColumn = page.locator('.list-column-done');
    const movedCard = doneColumn.locator('.card-item', { hasText: 'Green Check Task' });
    const greenRect = movedCard.locator('.card-checkbox svg rect[fill="#22c55e"]');
    await expect(greenRect).toBeVisible();
  });

  test('uncompleting a card in done list keeps it there', async ({ page }) => {
    await createList(page, 'To Do');
    await createList(page, 'Done');
    await setDoneList(page, 'Done');

    await createCard(page, 'To Do', 'Toggle Task');

    // Mark complete to move to done
    const cardItem = page.locator('.card-item', { hasText: 'Toggle Task' });
    await cardItem.hover();
    await cardItem.locator('.card-checkbox').click();

    await expandDoneList(page);

    // Uncheck the card in done list
    const doneColumn = page.locator('.list-column-done');
    const movedCard = doneColumn.locator('.card-item', { hasText: 'Toggle Task' });
    await movedCard.hover();
    await movedCard.locator('.card-checkbox').click();

    // Card should still be in done list but unchecked
    await expect(movedCard).toBeVisible();
    await expect(movedCard.locator('.card-checkbox')).not.toHaveClass(/card-checkbox-checked/);
  });

  test('done list shows green checkmark in header', async ({ page }) => {
    await createList(page, 'Done');
    await setDoneList(page, 'Done');
    await expandDoneList(page);

    await expect(page.locator('.list-column-done .done-check')).toHaveText('✓');
  });
});
