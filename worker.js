import { onRequestPost } from './functions/contact.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/contact' && request.method === 'POST') {
      return onRequestPost({ request, env, ctx });
    }

    // Everything else → serve static assets (your index.html etc.)
    return env.ASSETS.fetch(request);
  },
};
