require('dotenv').config();

async function main() {
  const phone = '5514991185157';
  console.log("Sending test to:", phone);
  
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "hello_world",
      language: { code: "en_US" }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log("Meta API Response:", data);
  } catch(err) {
    console.log("Fetch Error:", err);
  }
}
main();
