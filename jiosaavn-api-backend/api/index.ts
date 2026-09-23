import { app } from '../src/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Directly passes the Vercel request object into Hono's native fetch handler
  return app.fetch(request);
}
