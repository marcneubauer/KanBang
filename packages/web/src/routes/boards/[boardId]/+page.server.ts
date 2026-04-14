import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { boardDetailResponseSchema } from '@kanbang/shared';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export const load: PageServerLoad = async ({ locals, cookies, params }) => {
  if (!locals.user) redirect(302, '/login');

  const sessionCookie = cookies.get('kanbang_session');
  const res = await fetch(`${API_URL}/api/v1/boards/${params.boardId}`, {
    headers: { cookie: `kanbang_session=${sessionCookie}` },
  });

  if (res.status === 404) error(404, 'Board not found');
  if (res.status === 403) error(403, 'Forbidden');
  if (!res.ok) error(500, 'Failed to load board');

  const { board } = boardDetailResponseSchema.parse(await res.json());
  return { board };
};
