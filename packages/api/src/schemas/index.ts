/**
 * Plain JSON Schema objects for Fastify's fast-json-stringify serialization.
 * These are registered globally in app.ts via app.addSchema() and referenced
 * in route handler schemas using $ref.
 *
 * Note: Drizzle maps SQLite integer(timestamp) columns to Date objects.
 * Fastify serializes Date objects as ISO strings, so timestamps are type: 'string'.
 * Nullable timestamps use type: ['string', 'null'].
 */

export const userSchema = {
  $id: 'user',
  type: 'object',
  properties: {
    id:       { type: 'string' },
    email:    { type: 'string' },
    username: { type: 'string' },
  },
} as const;

export const boardSchema = {
  $id: 'board',
  type: 'object',
  properties: {
    id:              { type: 'string' },
    name:            { type: 'string' },
    userId:          { type: 'string' },
    cardAgingDays:   { type: ['number', 'null'] },
    coversEnabled:   { type: 'boolean' },
    backgroundType:  { type: ['string', 'null'] },
    backgroundValue: { type: ['string', 'null'] },
    createdAt:       { type: 'string' },
    updatedAt:       { type: 'string' },
    archivedAt:      { type: ['string', 'null'] },
  },
} as const;

export const listSchema = {
  $id: 'list',
  type: 'object',
  properties: {
    id:         { type: 'string' },
    name:       { type: 'string' },
    boardId:    { type: 'string' },
    position:   { type: 'string' },
    isDone:     { type: 'boolean' },
    cardLimit:  { type: ['number', 'null'] },
    createdAt:  { type: 'string' },
    updatedAt:  { type: 'string' },
    archivedAt: { type: ['string', 'null'] },
  },
} as const;

export const cardSchema = {
  $id: 'card',
  type: 'object',
  properties: {
    id:          { type: 'string' },
    number:      { type: ['number', 'null'] },
    title:       { type: 'string' },
    description: { type: ['string', 'null'] },
    listId:      { type: 'string' },
    position:    { type: 'string' },
    completed:   { type: 'boolean' },
    isTemplate:  { type: 'boolean' },
    coverType:   { type: ['string', 'null'] },
    coverValue:  { type: ['string', 'null'] },
    completedAt: { type: ['string', 'null'] },
    dueDate:     { type: ['string', 'null'] },
    createdAt:   { type: 'string' },
    updatedAt:   { type: 'string' },
    archivedAt:  { type: ['string', 'null'] },
  },
} as const;

export const checklistSchema = {
  $id: 'checklist',
  type: 'object',
  properties: {
    id:        { type: 'string' },
    name:      { type: 'string' },
    cardId:    { type: 'string' },
    position:  { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

export const checklistItemSchema = {
  $id: 'checklistItem',
  type: 'object',
  properties: {
    id:          { type: 'string' },
    title:       { type: 'string' },
    checklistId: { type: 'string' },
    position:    { type: 'string' },
    completed:   { type: 'boolean' },
    createdAt:   { type: 'string' },
    updatedAt:   { type: 'string' },
  },
} as const;

export const labelSchema = {
  $id: 'label',
  type: 'object',
  properties: {
    id:        { type: 'string' },
    name:      { type: 'string' },
    color:     { type: 'string' },
    boardId:   { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

export const commentSchema = {
  $id: 'comment',
  type: 'object',
  properties: {
    id:        { type: 'string' },
    body:      { type: 'string' },
    cardId:    { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

export const allSchemas = [
  userSchema,
  boardSchema,
  listSchema,
  cardSchema,
  checklistSchema,
  checklistItemSchema,
  labelSchema,
  commentSchema,
] as const;
