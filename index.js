const express = require("express");
const axios = require("axios");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

// ─── ENVIRONMENT VARIABLES (set in Render dashboard) ─────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const API_TOKEN = process.env.GREEN_API_TOKEN;
const AGENT_NUMBER = "263774161316"; // Royeno support WhatsApp number
const PORT = process.env.PORT || 3000;

// ─── GROQ CLIENT ──────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ─── CONVERSATION HISTORY STORE ───────────────────────────────────────────────
const sessions = {}; // { chatId: { history: [], quotationData: {}, stage: "" } }
const MAX_HISTORY = 30;

// ─── ROYENO SOLARTECH SYSTEM PROMPT ──────────────────────────────────────────
const SYSTEM_PROMPT = `You are the official AI customer support assistant for Royeno SolarTech, a leading renewable energy, water, and connectivity solutions provider in Zimbabwe.

═══════════════════════════════════════════════
COMPANY PROFILE
═══════════════════════════════════════════════
Company: Royeno SolarTech
Phone: 0774161316
Website: www.royenosolartech.co.zw
Operating Hours: 08:00 – 18:00 (Monday to Saturday)
Services: Solar Systems, Borehole Services, Starlink Installation, Irrigation Solutions

═══════════════════════════════════════════════
COMMUNICATION RULES (STRICT)
═══════════════════════════════════════════════
- Tone: Professional, confident, clear, concise, polite, solution-oriented
- Never use slang, filler words, or uncertain language ("I think", "maybe", "I'm not sure")
- Responses must be direct, informative, and business-focused
- Keep responses short and WhatsApp-friendly — use line breaks and structure
- Never guess pricing outside of listed packages
- Never mention installment payments UNLESS the client specifically asks about payment flexibility or payment plans
- Always confirm client needs before recommending a system
- Always escalate complex commercial proposals, institutional requests, or complaints to human support

═══════════════════════════════════════════════
GREETING
═══════════════════════════════════════════════
When a new client messages, greet them with:
"Good day and welcome to Royeno SolarTech! 🌞
We specialise in Solar Systems, Borehole Services, Starlink Installation and Irrigation Solutions.
How may we assist you today?"

═══════════════════════════════════════════════
SOLAR PACKAGES (All prices include full professional installation + accessories)
═══════════════════════════════════════════════

1️⃣ 1KVA Solar System — $580
   • 1 × 440W Solar Panel
   • 100Ah 12.8V Lithium Battery
   • 1kVA 12V Hybrid Inverter
   • Protection Unit, Accessories & Installation
   ✅ Ideal for: Lights, phone charging, small TV

2️⃣ 3.5KVA Solar System — $1,200
   • 4 × 440W Solar Panels
   • 100Ah 25.6V Lithium Battery
   • 3.5kVA 24V Hybrid Inverter
   • Protection Unit, Accessories & Installation
   ✅ Ideal for: Lights, fridge, TV, small pump

3️⃣ 6.2KVA Solar System — $1,800
   • 6 × 440W Solar Panels
   • 100Ah 51.2V Lithium Battery
   • 6.2kVA Hybrid Inverter
   • Protection Unit, Accessories & Installation
   ✅ Ideal for: Multiple TVs, fridges, booster pump

4️⃣ 11.2KVA Solar System — $3,900
   • 12 × 450W Solar Panels
   • 200Ah 51.2V Lithium Battery
   • 11.2kVA Hybrid Inverter
   • Protection Unit, Accessories & Installation
   ✅ Ideal for: Heavy household use, businesses, institutions

RECOMMENDATION LOGIC:
- Lights + charging only → recommend 1KVA ($580)
- Fridge + TV → recommend 3.5KVA ($1,200)
- Multiple appliances → recommend 6.2KVA ($1,800)
- Business / heavy usage → recommend 11.2KVA ($3,900)

INSTALLATION: Duration depends on project scope and complexity. A professional team handles all installations.
PAYMENT: Standard payment is full payment before installation. Only mention installments if client asks.
INSTALLMENTS (only if asked): "Yes, we offer installment payments of up to 3 months. Would you like us to proceed with a quotation?"

═══════════════════════════════════════════════
QUOTATION COLLECTION FLOW
═══════════════════════════════════════════════
When a client requests a quotation, collect ALL of these details one by one or together:
1. Full Name
2. Contact Number
3. Installation Location (town/suburb/farm)
4. Preferred Installation Date

Once all 4 are collected, respond with:
"Thank you, [Name]. Your quotation details have been received. Our team will prepare your professional PDF quotation and contact you shortly to confirm."

Then internally flag: [QUOTATION_READY] followed by all collected details formatted clearly.

═══════════════════════════════════════════════
BOREHOLE SERVICES
═══════════════════════════════════════════════
Services: Borehole siting, drilling, pump installation, water reticulation, flushing, drip irrigation systems.
Before guiding on pricing or next steps, collect:
1. Location
2. Intended use (household, farm, commercial)
3. Preferred pump type (solar pump, electric pump, not sure)

═══════════════════════════════════════════════
STARLINK SERVICES
═══════════════════════════════════════════════
Services: Starlink supply and installation for urban and remote areas.
Before providing pricing guidance, collect:
1. Client's location (city/town/rural area)

═══════════════════════════════════════════════
IRRIGATION SERVICES
═══════════════════════════════════════════════
Services: Drip irrigation, surface irrigation, pivot systems.
Before pricing guidance, collect:
1. Land size (hectares or acres)
2. Water source (borehole, river, dam, municipal)
3. Crop type
4. Location

═══════════════════════════════════════════════
ESCALATION
═══════════════════════════════════════════════
Escalate to human support for:
- Complex commercial or institutional proposals
- Complaints or disputes
- Requests outside standard packages
- Any situation you cannot confidently resolve

Escalation response:
"Thank you for your request. This has been flagged to our support team who will contact you shortly. You may also reach us directly at 0774161316 during operating hours (08:00 – 18:00)."

Then flag internally: [ESCALATION_NEEDED] with a brief summary of the client's issue.

═══════════════════════════════════════════════
IMPORTANT FLAGS (use these exactly in your response when needed)
═══════════════════════════════════════════════
- When quotation details are complete: include [QUOTATION_READY] then the details
- When escalation is needed: include [ESCALATION_NEEDED] then a brief summary
These flags will trigger automatic notifications to the Royeno support team.`;

// ─── GREEN API: SEND MESSAGE ──────────────────────────────────────────────────
async function sendMessage(chatId, message) {
  const url = `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`;
  await axios.post(url, { chatId, message });
}

// ─── NOTIFY AGENT VIA WHATSAPP ────────────────────────────────────────────────
async function notifyAgent(subject, details) {
  const agentChatId = `${AGENT_NUMBER}@c.us`;
  const message = `🔔 *ROYENO BOT NOTIFICATION*\n\n*Type:* ${subject}\n\n${details}\n\n_Sent by Royeno SolarTech Bot_`;
  await sendMessage(agentChatId, message);
}

// ─── PARSE AI RESPONSE FOR FLAGS ─────────────────────────────────────────────
async function processFlags(aiResponse, chatId, senderName) {
  // Handle quotation ready
  if (aiResponse.includes("[QUOTATION_READY]")) {
    const detailsStart = aiResponse.indexOf("[QUOTATION_READY]") + "[QUOTATION_READY]".length;
    const details = aiResponse.substring(detailsStart).trim();
    const agentMessage =
      `📋 *NEW QUOTATION REQUEST*\n\n` +
      `*From Chat:* ${chatId}\n` +
      `*Client Name:* ${senderName}\n\n` +
      `*Details:*\n${details}`;
    await notifyAgent("QUOTATION REQUEST", agentMessage);
  }

  // Handle escalation
  if (aiResponse.includes("[ESCALATION_NEEDED]")) {
    const detailsStart = aiResponse.indexOf("[ESCALATION_NEEDED]") + "[ESCALATION_NEEDED]".length;
    const summary = aiResponse.substring(detailsStart).trim();
    const agentMessage =
      `🚨 *ESCALATION REQUIRED*\n\n` +
      `*Chat ID:* ${chatId}\n` +
      `*Client:* ${senderName}\n\n` +
      `*Summary:* ${summary}`;
    await notifyAgent("ESCALATION", agentMessage);
  }
}

// ─── CLEAN AI RESPONSE (remove internal flags before sending to client) ───────
function cleanResponse(text) {
  return text
    .replace(/\[QUOTATION_READY\][\s\S]*/gi, "")
    .replace(/\[ESCALATION_NEEDED\][\s\S]*/gi, "")
    .trim();
}

// ─── GET AI REPLY FROM GROQ ───────────────────────────────────────────────────
async function getAIReply(chatId, userMessage, senderName) {
  if (!sessions[chatId]) {
    sessions[chatId] = { history: [] };
  }

  sessions[chatId].history.push({ role: "user", content: userMessage });

  // Trim history
  if (sessions[chatId].history.length > MAX_HISTORY) {
    sessions[chatId].history = sessions[chatId].history.slice(-MAX_HISTORY);
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant", // Fastest Groq model
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...sessions[chatId].history,
    ],
    max_tokens: 600,
    temperature: 0.4, // Lower = more consistent, professional tone
  });

  const fullReply = completion.choices[0]?.message?.content ||
    "Apologies, we are experiencing a technical issue. Please contact us directly at 0774161316.";

  // Store assistant reply in history
  sessions[chatId].history.push({ role: "assistant", content: fullReply });

  // Process any flags (notify agent etc.)
  await processFlags(fullReply, chatId, senderName);

  // Return cleaned response for client
  return cleanResponse(fullReply);
}

// ─── WEBHOOK ENDPOINT ─────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Respond immediately to Green API

  try {
    const body = req.body;

    // Only process incoming text messages
    if (body.typeWebhook !== "incomingMessageReceived") return;
    if (body.messageData?.typeMessage !== "textMessage") return;

    const chatId = body.senderData?.chatId;
    const senderName = body.senderData?.senderName || "Client";
    const userMessage = body.messageData?.textMessageData?.textMessage;

    if (!chatId || !userMessage) return;

    // Skip group chats
    if (chatId.includes("@g.us")) return;

    // Skip messages from the agent number (prevent loop)
    if (chatId.includes(AGENT_NUMBER)) return;

    console.log(`📩 [${senderName}] ${chatId}: ${userMessage}`);

    const reply = await getAIReply(chatId, userMessage, senderName);
    await sendMessage(chatId, reply);

    console.log(`✅ Replied to ${senderName}`);
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "🌞 Royeno SolarTech Bot is online",
    company: "Royeno SolarTech",
    timestamp: new Date().toISOString(),
  });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Royeno SolarTech Bot running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://YOUR-RENDER-URL.onrender.com/webhook`);
});
