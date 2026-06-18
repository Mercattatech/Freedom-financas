const { OpenAI } = require('openai');
async function test() {
  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Respond in JSON with a single key "test".' },
        { role: 'user', content: [
            { type: 'text', text: 'Hello' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' } }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    });
    console.log(response.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI Error:", err.message);
  }
}
test();
