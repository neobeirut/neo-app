import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request) {
  try {
    const path = join(process.cwd(), 'src/app/api/orders/admin/[id]/route.js');
    const content = readFileSync(path, 'utf8');
    return Response.json({ path, content });
  } catch (e) {
    return Response.json({ error: e.message });
  }
}
