import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { boardsResponseSchema } from '@kanbang/shared';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(302, '/login');

  const sessionCookie = cookies.get('kanbang_session');
  const res = await fetch(`${API_URL}/api/v1/boards`, {
    headers: { cookie: `kanbang_session=${sessionCookie}` },
  });
  const { boards } = boardsResponseSchema.parse(await res.json());
  return { boards };
};
