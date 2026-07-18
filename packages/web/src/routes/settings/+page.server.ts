import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(302, '/login');

  const sessionCookie = cookies.get('kanbang_session');
  const headers = { cookie: `kanbang_session=${sessionCookie}` };

  const [passkeysRes, quickAddRes, boardsRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/passkeys`, { headers }),
    fetch(`${API_URL}/api/v1/quick-add/config`, { headers }),
    fetch(`${API_URL}/api/v1/boards`, { headers }),
  ]);

  const { passkeys } = await passkeysRes.json();
  const quickAdd = await quickAddRes.json();
  const { boards } = await boardsRes.json();

  return { passkeys, quickAdd, boards };
};
