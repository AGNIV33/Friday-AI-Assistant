// Standalone connectivity check for the vision API.
//   Run with:  node scripts/test-vision.js
//
// Credentials come from .env — never hardcode them here. This file is not part
// of the build; it exists purely to confirm the vision endpoint responds.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const VISION_API_KEY = process.env.VITE_VISION_API_KEY || process.env.NVIDIA_API_KEY;
const VISION_MODEL = process.env.VITE_VISION_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
const VISION_BASE_URL = process.env.VITE_VISION_BASE_URL || "https://integrate.api.nvidia.com/v1";

if (!VISION_API_KEY) {
  console.error("No vision API key found. Set VITE_VISION_API_KEY (or NVIDIA_API_KEY) in your .env file.");
  process.exit(1);
}

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
