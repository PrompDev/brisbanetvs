/**
 * Brisbane TVs — AI Chat Backend
 * ------------------------------------------------------------------
 * Works as: Cloudflare Worker  (recommended — free, fast, global)
 *           Netlify Function   (drop into /netlify/functions/chat.js)
 *           Vercel Edge Route  (drop into /api/chat.js with export default)
 *
 * Sets up: POST /api/chat
 *   Body:  { system: string, messages: [{ role: 'user' | 'assistant', content }] }
 *   Reply: { reply: string }
 *
 * PICK YOUR PROVIDER
 * ------------------
 * Uncomment the block for whichever LLM you're using. You'll need an API key
 * set as an environment variable on your hosting provider:
 *   ANTHROPIC_API_KEY   (Claude — recommended)
 *   OPENAI_API_KEY      (GPT)
 *
 * DEPLOY (Cloudflare Workers — 5 mins)
 * ------------------------------------
 *   1. Sign up free at cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this file
 *   3. Settings → Variables → add ANTHROPIC_API_KEY (encrypted)
 *   4. Route: brisbanetvs.com.au/api/chat  (same-origin avoids CORS)
 *   5. In index.html set USE_REMOTE = true
 *
 * HOW SAME-ORIGIN ROUTING WORKS
 * -----------------------------
 * If /api/chat lives on the same domain as your site, the browser sends the
 * request directly — no CORS. If you host the worker on workers.dev, update
 * CHAT_ENDPOINT in index.html to the full URL and enable CORS below.
 * ============================================================================
 */

/* -----------------------------------------------------------------------------
 *  CLOUDFLARE WORKER VERSION
 * ---------------------------------------------------------------------------*/
export default {
  async fetch(request, env) {
    // Only accept POST
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (request.method !== 'POST')    return cors(new Response('Method Not Allowed', { status: 405 }));

    let body;
    try {
      body = await request.json();
    } catch {
      return cors(json({ error: 'Invalid JSON' }, 400));
    }

    const system   = body.system   || 'You are a helpful assistant for Brisbane TVs.';
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!messages.length) return cors(json({ error: 'No messages' }, 400));

    try {
      // ---------- CLAUDE (Anthropic) ----------------------------------------
      const reply = await callClaude(env.ANTHROPIC_API_KEY, system, messages);

      // ---------- OR — OpenAI -----------------------------------------------
      // const reply = await callOpenAI(env.OPENAI_API_KEY, system, messages);

      return cors(json({ reply }));
    } catch (err) {
      console.error('AI call failed:', err);
      return cors(json({ error: 'AI request failed', detail: String(err.message || err) }, 500));
    }
  }
};

/* -----------------------------------------------------------------------------
 *  PROVIDER CALLS
 * ---------------------------------------------------------------------------*/

async function callClaude(apiKey, system, messages) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.content || '').slice(0, 4000)
      }))
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const reply = (data.content || []).map(c => c.text || '').join('').trim();
  return reply || "Sorry — I couldn't put that together. Try asking another way, or call 1300 312 271.";
}

// eslint-disable-next-line no-unused-vars
async function callOpenAI(apiKey, system, messages) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 4000) }))
      ]
    })
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim()
    || "Sorry — I couldn't put that together. Try again or call 1300 312 271.";
}

/* -----------------------------------------------------------------------------
 *  HELPERS
 * ---------------------------------------------------------------------------*/

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function cors(res) {
  // Only needed if hosting the worker on a different origin than the site.
  // Same-origin (brisbanetvs.com.au/api/chat) doesn't need these.
  res.headers.set('access-control-allow-origin', '*');
  res.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  res.headers.set('access-control-allow-headers', 'content-type');
  return res;
}
