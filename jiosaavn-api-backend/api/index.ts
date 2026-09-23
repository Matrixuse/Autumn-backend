import app from '../src/app';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  return app.handle(request);
}
