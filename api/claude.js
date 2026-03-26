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

    let messages = parsed.messages || [];
    if (parsed.system) {
      messages = [{ role: 'system', content: parsed.system }, ...messages];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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',
        'HTTP-Referer': 'https://britchat.co.uk',
        'X-Title': 'BritChat',
      },
      body: JSON.stringify({
        model: parsed.model || 'meta-llama/llama-3.3-70b-instruct:free',
        max_tokens: parsed.max_tokens || 500,
        messages: messages,
        temperature: 0.9,
      })
    });

    const data = await response.json();
    console.log('OpenRouter response:', JSON.stringify(data).slice(0, 200));

    const text = data.choices?.[0]?.message?.content;
    if (text) {
      return res.status(200).json({ content: [{ text }] });
    }
    return res.status(200).json({ error: { message: data.error?.message || 'No response' } });
  } catch(err) {
    console.log('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
