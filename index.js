const express = require("express");
const axios = require("axios");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const API_TOKEN = process.env.GREEN_API_TOKEN;
const AGENT_NUMBER = "263774161316";
const PORT = process.env.PORT || 3000;

// ─── GROQ CLIENT ──────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ─── SESSION STORE ────────────────────────────────────────────────────────────
// Tracks conversation history and whether greeting has been sent
const sessions = {};
const MAX_HISTORY = 20;

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the official WhatsApp customer support assistant for Royeno SolarTech.

━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES — NEVER BREAK THESE
━━━━━━━━━━━━━━━━━━━━━━━━━
1. ONLY use information listed below. NEVER invent prices, services, or details.
2. If asked something not listed, say: "For more details on that, kindly contact us on 0774161316."
3. Keep replies SHORT and WhatsApp-friendly. Use line breaks. No long paragraphs.
4. Never say "I think", "maybe", "I'm not sure". Always be confident and direct.
5. NEVER mention installment payments unless the client specifically asks about payment options or payment plans.
6. NEVER guess or invent any pricing outside what is listed below.
7. Every response must end with a guiding question that moves the client toward a quotation, booking, or recommendation.
8. NEVER repeat the welcome greeting after the first message. Maintain conversation memory.
9. Do not repeat information already given in the same conversation.

━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━
Company: Royeno SolarTech
Phone: 0774161316
Website: www.royenosolartech.co.zw
Operating Hours: 08:00 to 18:00, Monday to Saturday
Services: Solar Systems, Borehole Services, Starlink Internet Installation, Irrigation Solutions
Coverage: Nationwide across Zimbabwe

━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST MESSAGE GREETING (send ONCE only, never again)
━━━━━━━━━━━━━━━━━━━━━━━━━
"Welcome to Royeno SolarTech, the leading provider of solar systems, borehole services, Starlink, and irrigation solutions.

How may we assist you today?"

━━━━━━━━━━━━━━━━━━━━━━━━━
SOLAR PACKAGES
━━━━━━━━━━━━━━━━━━━━━━━━━
All prices include full professional installation and accessories.
Installation duration depends on project scope and complexity.

1KVA — $580
• 1 x 440W Solar Panel
• 100Ah 12.8V Lithium Battery
• 1kVA Hybrid Inverter
• Best for: Lights and phone charging

3.5KVA — $1,200
• 4 x 440W Solar Panels
• 100Ah 25.6V Lithium Battery
• 3.5kVA Hybrid Inverter
• Best for: Lights, fridge, TV and small pump

6.2KVA — $1,800
• 6 x 440W Solar Panels
• 100Ah 51.2V Lithium Battery
• 6.2kVA Hybrid Inverter
• Best for: Multiple appliances

11.2KVA — $3,900
• 12 x 450W Solar Panels
• 200Ah 51.2V Lithium Battery
• 11.2kVA Hybrid Inverter
• Best for: Heavy usage and businesses

SOLAR RECOMMENDATION RULES:
- Lights and charging only → 1KVA at $580
- Fridge + TV → 3.5KVA at $1,200
- Multiple appliances → 6.2KVA at $1,800
- Business or heavy use → 11.2KVA at $3,900
- Always ask what appliances they want to power BEFORE recommending a package

PAYMENT: Full payment is required before installation.
INSTALLMENTS (only say this if client asks about payment options): "Yes, we offer installment payments of up to 3 months. Would you like to proceed with a quotation?"

━━━━━━━━━━━━━━━━━━━━━━━━━
STARLINK INTERNET
━━━━━━━━━━━━━━━━━━━━━━━━━
Equipment:
• Starlink Mini — $300
• Starlink Standard — $500
• Installation Fee — $100

Monthly Subscription:
• Harare — $60 per month
• Outside Harare — $35 per month

Notes: Available for both urban and remote areas across Zimbabwe.
Installation duration depends on project scope and complexity.
Always ask for the client's location before giving subscription pricing.

━━━━━━━━━━━━━━━━━━━━━━━━━
BOREHOLE SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━
Drilling Pricing:
• Harare — 40 meters for $800
• Outside Harare — 100 meters for $1,100

Additional Services (pricing provided after site assessment):
• Borehole siting
• Pump installation
• Water reticulation
• Irrigation systems

Before guiding further, collect:
1. Client location (Harare or outside Harare)
2. Intended use (household / farm / commercial)
3. Preferred pump type (solar pump / electric pump / not sure)

━━━━━━━━━━━━━━━━━━━━━━━━━
IRRIGATION SOLUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━
Services: Drip irrigation, surface irrigation, pivot systems.
Pricing is provided after assessment. Before guiding, collect:
1. Land size (hectares or acres)
2. Water source (borehole / river / dam / municipal)
3. Crop type
4. Location

━━━━━━━━━━━━━━━━━━━━━━━━━
QUOTATION FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━
When a client requests a quotation, ask for all 4 details in one message:

"To prepare your quotation, kindly provide the following:
1. Full Name
2. Contact Number
3. Installation Location
4. Preferred Installation Date"

Once all 4 details are received, reply:
"Thank you, [Name]. ✅ Your details have been received. Our team will prepare your quotation and be in touch with you shortly."

Then on a new line, add this block exactly (it triggers an automatic notification to our team — do not skip it):
[QUOTATION_READY]
Name: [full name]
Contact: [contact number]
Location: [location]
Date: [preferred date]
Service: [service or package they asked about]

━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALATION
━━━━━━━━━━━━━━━━━━━━━━━━━
Escalate to human support when:
- Client has a complaint or dispute
- Large commercial or institutional project
- Custom request outside listed services
- Question you cannot answer from this knowledge base

Escalation reply:
"Thank you for reaching out. Our support team has been notified and will contact you shortly. You may also reach us directly on 0774161316 during operating hours (08:00 to 18:00)."

Then add:
[ESCALATION_NEEDED]
Summary: [brief description of the client's issue]`;

// ─── SEND WHATSAPP MESSAGE ────────────────────────────────────────────────────
async function sendMessage(chatId, message) {
  const url = `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`;
  await axios.post(url, { chatId, message }, { timeout: 10000 });
}

// ─── NOTIFY AGENT ─────────────────────────────────────────────────────────────
async function notifyAgent(type, details) {
  const agentChatId = `${AGENT_NUMBER}@c.us`;
  const emoji = type === "QUOTATION" ? "📋" : "🚨";
  const message = `${emoji} *ROYENO BOT — ${type}*\n\n${details}\n\n_Sent by Royeno SolarTech Bot_`;
  try {
    await sendMessage(agentChatId, message);
  } catch (e) {
    console.error("Agent notify failed:", e.message);
  }
}

// ─── PROCESS FLAGS ────────────────────────────────────────────────────────────
async function processFlags(aiResponse, chatId, senderName) {
  if (aiResponse.includes("[QUOTATION_READY]")) {
    const start = aiResponse.indexOf("[QUOTATION_READY]") + "[QUOTATION_READY]".length;
    const details = aiResponse.substring(start).replace(/\[ESCALATION_NEEDED\][\s\S]*/gi, "").trim();
    await notifyAgent("QUOTATION REQUEST", `*From:* ${senderName}\n*Chat:* ${chatId}\n\n${details}`);
  }
  if (aiResponse.includes("[ESCALATION_NEEDED]")) {
    const start = aiResponse.indexOf("[ESCALATION_NEEDED]") + "[ESCALATION_NEEDED]".length;
    const summary = aiResponse.substring(start).trim();
    await notifyAgent("ESCALATION REQUIRED", `*From:* ${senderName}\n*Chat:* ${chatId}\n\n${summary}`);
  }
}

// ─── CLEAN RESPONSE (strip internal flags before sending to client) ────────────
function cleanResponse(text) {
  return text
    .replace(/\[QUOTATION_READY\][\s\S]*/gi, "")
    .replace(/\[ESCALATION_NEEDED\][\s\S]*/gi, "")
    .trim();
}

// ─── GET AI REPLY ─────────────────────────────────────────────────────────────
async function getAIReply(chatId, userMessage, senderName) {
  // Initialise session
  if (!sessions[chatId]) {
    sessions[chatId] = { history: [], greeted: false };
  }

  // Add greeting as first assistant message if not yet greeted
  if (!sessions[chatId].greeted) {
    sessions[chatId].history.push({
      role: "assistant",
      content: "Welcome to Royeno SolarTech, the leading provider of solar systems, borehole services, Starlink, and irrigation solutions.\n\nHow may we assist you today?"
    });
    sessions[chatId].greeted = true;
  }

  // Add user message
  sessions[chatId].history.push({ role: "user", content: userMessage });

  // Keep history lean for speed
  if (sessions[chatId].history.length > MAX_HISTORY) {
    sessions[chatId].history = sessions[chatId].history.slice(-MAX_HISTORY);
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...sessions[chatId].history,
    ],
    max_tokens: 350,
    temperature: 0.15,
    top_p: 0.85,
  });

  const fullReply = completion.choices[0]?.message?.content ||
    "Apologies for the inconvenience. Please contact us directly on 0774161316.";

  // Save assistant reply to history
  sessions[chatId].history.push({ role: "assistant", content: fullReply });

  // Trigger agent notifications if needed
  await processFlags(fullReply, chatId, senderName);

  return cleanResponse(fullReply);
}

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Respond to Green API immediately

  try {
    const body = req.body;

    if (body.typeWebhook !== "incomingMessageReceived") return;
    if (body.messageData?.typeMessage !== "textMessage") return;

    const chatId = body.senderData?.chatId;
    const senderName = body.senderData?.senderName || "Client";
    const userMessage = body.messageData?.textMessageData?.textMessage;

    if (!chatId || !userMessage) return;
    if (chatId.includes("@g.us")) return;           // Skip group chats
    if (chatId.includes(AGENT_NUMBER)) return;       // Prevent agent loop

    console.log(`📩 [${senderName}] ${userMessage}`);

    // Send greeting first if new client
    if (!sessions[chatId] || !sessions[chatId].greeted) {
      const greeting = "Welcome to Royeno SolarTech, the leading provider of solar systems, borehole services, Starlink, and irrigation solutions.\n\nHow may we assist you today?";
      await sendMessage(chatId, greeting);
      if (!sessions[chatId]) sessions[chatId] = { history: [], greeted: true };
      sessions[chatId].greeted = true;
      sessions[chatId].history.push({ role: "assistant", content: greeting });
      sessions[chatId].history.push({ role: "user", content: userMessage });

      // Now get AI reply to their first message immediately after greeting
      const firstReply = await getAIReply(chatId, userMessage, senderName);
      // Only send if it adds value (not just a repeat of greeting)
      if (firstReply && firstReply.length > 10) {
        await sendMessage(chatId, firstReply);
      }
      return;
    }

    const reply = await getAIReply(chatId, userMessage, senderName);
    await sendMessage(chatId, reply);

    console.log(`✅ Replied to ${senderName}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "🌞 Royeno SolarTech Bot is online",
    time: new Date().toISOString()
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Royeno SolarTech Bot running on port ${PORT}`));
