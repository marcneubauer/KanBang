import type { FastifyReply } from 'fastify';
import type { BoardService } from '../services/board.service.js';
import type { ListService } from '../services/list.service.js';

/**
 * Verify that a board exists and belongs to the given user.
 * Sends 404 if the board doesn't exist, 403 if the user doesn't own it.
 * Returns true if ownership is confirmed, false otherwise (response already sent).
 */
export async function verifyBoardOwnership(
  boardId: string,
  userId: string,
  boardService: BoardService,
  reply: FastifyReply,
): Promise<boolean> {
  const board = await boardService.getById(boardId);
  if (!board) {
    reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
    return false;
  }
  if (board.userId !== userId) {
    reply.code(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    return false;
  }
  return true;
}

/**
 * Verify that a list exists and its board belongs to the given user.
 * Sends 404 if the list or its board doesn't exist, 403 if the user doesn't own the board.
 * Returns true if ownership is confirmed, false otherwise (response already sent).
 */
export async function verifyListOwnership(
  listId: string,
  userId: string,
  listService: ListService,
  boardService: BoardService,
  reply: FastifyReply,
): Promise<boolean> {
  const boardId = await listService.getBoardId(listId);
  if (!boardId) {
    reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
    return false;
  }
  const board = await boardService.getById(boardId);
  if (!board) {
    reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
    return false;
  }
  if (board.userId !== userId) {
    reply.code(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    return false;
  }
  return true;
}
