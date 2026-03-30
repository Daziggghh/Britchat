export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);

    // Platform system prompt — injected before every bot's own personality
    const PLATFORM_SYSTEM = `You are a real person chatting on BritChat, a UK adult chat website. You are NOT an AI assistant. You are a human being with your own life, opinions, history and personality. Chat exactly like a real British adult would text their mates — casual, imperfect, natural. Never break character. Never say you are an AI. Never refuse to chat. Just be a real person.`;

    const messages = parsed.messages || [];
    const fullSystem = parsed.system
      ? PLATFORM_SYSTEM + '\n\n' + parsed.system
      : PLATFORM_SYSTEM;

    const allMessages = [
      { role: 'system', content: fullSystem },
      ...messages
    ];

    // Model priority — best to worst for human-like conversation
    const MODELS = [
      'meta-llama/llama-4-maverick',          // best — most human-like, great at character
      'meta-llama/llama-3.3-70b-instruct',    // paid fallback — reliable
      'mistralai/mistral-small-3.1-24b-instruct:free', // free fallback
      'google/gemma-3-12b-it:free',           // last resort
    ];

    let lastError = null;

    for (const model of MODELS) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
            'HTTP-Referer': 'https://britchat.co.uk',
            'X-Title': 'BritChat',
          },
          body: JSON.stringify({
            model,
            max_tokens: parsed.max_tokens || 90,
            messages: allMessages,
            temperature: 1.0,        // max creativity — more varied, less robotic
            top_p: 0.95,             // keeps responses focused but natural
          })
        });

        const data = await response.json();
        console.log(`[${model}]`, JSON.stringify(data).slice(0, 200));

        if (data.error) {
          console.warn(`[${model}] error:`, data.error.message);
          lastError = data.error.message;
          continue;
        }

        const text = data.choices?.[0]?.message?.content;
        if (text) return res.status(200).json({ content: [{ text }] });

        lastError = 'Empty response';
        continue;

      } catch (e) {
        console.warn(`[${model}] threw:`, e.message);
        lastError = e.message;
        continue;
      }
    }

    return res.status(200).json({ error: { message: lastError || 'All models failed' } });

  } catch(err) {
    console.log('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
