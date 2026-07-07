import 'dotenv/config';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('❌ Set the GROQ_API_KEY environment variable.');
  process.exit(1);
}

const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${GROQ_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",   // fastest quality model
    messages: [
      { role: "user", content: "Say hello world" }
    ],
    temperature: 0.2,
    max_tokens: 50
  })
});

const data = await response.json();

if (data.choices?.[0]?.message?.content) {
  console.log('✅ Groq is working! Response:', data.choices[0].message.content);
} else {
  console.error('❌ Unexpected response:', JSON.stringify(data, null, 2));
}