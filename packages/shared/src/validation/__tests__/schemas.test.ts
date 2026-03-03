import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../auth.js';
import { createBoardSchema, updateBoardSchema } from '../board.js';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from '../card.js';
import {
  createListSchema,
  updateListSchema,
  reorderListSchema,
} from '../list.js';

describe('registerSchema', () => {
  const valid = {
    email: 'user@example.com',
    username: 'testuser',
    password: 'password123',
  };

  it('accepts valid input', () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = registerSchema.safeParse({
      ...valid,
      email: 'User@Example.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('rejects email with leading/trailing spaces', () => {
    const result = registerSchema.safeParse({
      ...valid,
      email: '  user@example.com  ',
    });
    expect(result.success).toBe(false);
  });

  it('trims username', () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: '  testuser  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('testuser');
    }
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects short username', () => {
    const result = registerSchema.safeParse({ ...valid, username: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects long username', () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: 'a'.repeat(31),
    });
    expect(result.success).toBe(false);
  });

  it('rejects username with invalid characters', () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: 'user name!',
    });
    expect(result.success).toBe(false);
  });

  it('accepts username with hyphens and underscores', () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: 'test-user_1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects long password', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  const valid = { email: 'user@example.com', password: 'password123' };

  it('accepts valid input', () => {
    const result = loginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = loginSchema.safeParse({
      ...valid,
      email: 'User@Example.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ ...valid, email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ ...valid, password: '' });
    expect(result.success).toBe(false);
  });
});

describe('createBoardSchema', () => {
  it('accepts valid name', () => {
    const result = createBoardSchema.safeParse({ name: 'My Board' });
    expect(result.success).toBe(true);
  });

  it('trims name', () => {
    const result = createBoardSchema.safeParse({ name: '  My Board  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Board');
    }
  });

  it('rejects empty name', () => {
    const result = createBoardSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects over-length name', () => {
    const result = createBoardSchema.safeParse({ name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('updateBoardSchema', () => {
  it('accepts valid name', () => {
    const result = updateBoardSchema.safeParse({ name: 'Updated Board' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = updateBoardSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects over-length name', () => {
    const result = updateBoardSchema.safeParse({ name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('createCardSchema', () => {
  it('accepts valid title', () => {
    const result = createCardSchema.safeParse({ title: 'My Card' });
    expect(result.success).toBe(true);
  });

  it('accepts title with description', () => {
    const result = createCardSchema.safeParse({
      title: 'My Card',
      description: 'Some details',
    });
    expect(result.success).toBe(true);
  });

  it('trims title', () => {
    const result = createCardSchema.safeParse({ title: '  My Card  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Card');
    }
  });

  it('rejects empty title', () => {
    const result = createCardSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects over-length title', () => {
    const result = createCardSchema.safeParse({ title: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects over-length description', () => {
    const result = createCardSchema.safeParse({
      title: 'Card',
      description: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateCardSchema', () => {
  it('accepts partial update with title only', () => {
    const result = updateCardSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with description only', () => {
    const result = updateCardSchema.safeParse({ description: 'New desc' });
    expect(result.success).toBe(true);
  });

  it('accepts null description (clear)', () => {
    const result = updateCardSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateCardSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects over-length description', () => {
    const result = updateCardSchema.safeParse({
      description: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

describe('moveCardSchema', () => {
  it('accepts valid listId and position', () => {
    const result = moveCardSchema.safeParse({
      listId: 'list123',
      position: 'a0',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing listId', () => {
    const result = moveCardSchema.safeParse({ position: 'a0' });
    expect(result.success).toBe(false);
  });

  it('rejects missing position', () => {
    const result = moveCardSchema.safeParse({ listId: 'list123' });
    expect(result.success).toBe(false);
  });

  it('rejects empty listId', () => {
    const result = moveCardSchema.safeParse({ listId: '', position: 'a0' });
    expect(result.success).toBe(false);
  });

  it('rejects empty position', () => {
    const result = moveCardSchema.safeParse({ listId: 'list123', position: '' });
    expect(result.success).toBe(false);
  });
});

describe('createListSchema', () => {
  it('accepts valid name', () => {
    const result = createListSchema.safeParse({ name: 'To Do' });
    expect(result.success).toBe(true);
  });

  it('trims name', () => {
    const result = createListSchema.safeParse({ name: '  To Do  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('To Do');
    }
  });

  it('rejects empty name', () => {
    const result = createListSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects over-length name', () => {
    const result = createListSchema.safeParse({ name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('updateListSchema', () => {
  it('accepts valid name', () => {
    const result = updateListSchema.safeParse({ name: 'Done' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = updateListSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('reorderListSchema', () => {
  it('accepts valid position', () => {
    const result = reorderListSchema.safeParse({ position: 'a0V' });
    expect(result.success).toBe(true);
  });

  it('rejects missing position', () => {
    const result = reorderListSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty position', () => {
    const result = reorderListSchema.safeParse({ position: '' });
    expect(result.success).toBe(false);
  });
});
