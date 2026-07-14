import type { BoardService } from '../services/board.service.js';
import type { ListService } from '../services/list.service.js';
import type { CardService } from '../services/card.service.js';

function httpError(statusCode: number, message: string, code: string): Error {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Verify that a board exists and belongs to the given user.
 * Throws 404 if the board doesn't exist, 403 if the user doesn't own it.
 */
export async function verifyBoardOwnership(
  boardId: string,
  userId: string,
  boardService: BoardService,
): Promise<void> {
  const ownerId = await boardService.getOwnerId(boardId);
  if (!ownerId) throw httpError(404, 'Board not found', 'NOT_FOUND');
  if (ownerId !== userId) throw httpError(403, 'Forbidden', 'FORBIDDEN');
}

/**
 * Verify that a list exists and its board belongs to the given user.
 * Throws 404 if the list or its board doesn't exist, 403 if the user doesn't own the board.
 */
export async function verifyListOwnership(
  listId: string,
  userId: string,
  listService: ListService,
  boardService: BoardService,
): Promise<void> {
  const boardId = await listService.getBoardId(listId);
  if (!boardId) throw httpError(404, 'List not found', 'NOT_FOUND');
  const ownerId = await boardService.getOwnerId(boardId);
  if (!ownerId) throw httpError(404, 'List not found', 'NOT_FOUND');
  if (ownerId !== userId) throw httpError(403, 'Forbidden', 'FORBIDDEN');
}

/**
 * Verify that a card exists and its board belongs to the given user.
 * Throws 404 if the card, list, or board doesn't exist, 403 if the user doesn't own the board.
 */
export async function verifyCardOwnership(
  cardId: string,
  userId: string,
  cardService: CardService,
  listService: ListService,
  boardService: BoardService,
): Promise<void> {
  const listId = await cardService.getListId(cardId);
  if (!listId) throw httpError(404, 'Card not found', 'NOT_FOUND');
  const boardId = await listService.getBoardId(listId);
  if (!boardId) throw httpError(404, 'Card not found', 'NOT_FOUND');
  const ownerId = await boardService.getOwnerId(boardId);
  if (!ownerId) throw httpError(404, 'Card not found', 'NOT_FOUND');
  if (ownerId !== userId) throw httpError(403, 'Forbidden', 'FORBIDDEN');
}
