const VISION_API_KEY = "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";
const VISION_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
const VISION_BASE_URL = "https://integrate.api.nvidia.com/v1";

async function test() {
  const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  const messages = [
    { role: 'user', content: [
      { type: 'image_url', image_url: { url: dummyBase64 } },
      { type: 'text', text: 'what is this' }
    ]}
  ];

  try {
    const response = await fetch(`${VISION_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VISION_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.6,
        stream: false,
      }),
    });

    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
