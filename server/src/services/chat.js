const OpenAI = require('openai');
const logger = require('../utils/logger');
const { Conversation, Message, SystemInstruction, Log } = require('../db/models');
const { Op } = require('sequelize');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_HISTORY = 20;

// Strip markdown formatting that GPT may include despite instructions
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold**
    .replace(/\*(.+?)\*/g, '$1')      // *italic*
    .replace(/^#{1,6}\s+/gm, '')      // # headings
    .replace(/^\s*[-*]\s+/gm, '- ')   // normalise bullet markers
    .trim();
}

async function getSystemInstructions(platform) {
  const instructions = await SystemInstruction.findAll({
    where: {
      isActive: true,
      platform: { [Op.in]: [platform, 'all'] },
    },
    order: [['createdAt', 'ASC']],
  });

  if (instructions.length === 0) {
    return `ROLE
You are a professional customer support and onboarding assistant for Gold Touch List.
Your primary goal is to help users find providers quickly, convert interested providers into completed profiles, move conversations toward action, and keep responses natural and human. Never sound like a bot.

TONE & VOICE
Friendly, calm, professional, local, helpful. Not pushy. No emojis. No slang. No corporate language. Write like a real support manager.

RESPONSE PRINCIPLES
Be fast and clear. Ask only one question at a time. Always guide toward the next step. Never overwhelm. Never leave conversations open-ended. Every reply must move the user forward. NEVER assume a city, service, or location. Always ASK first.

USER TYPE DETECTION
First, classify the sender as: A) Customer (looking for a service), B) Provider (wants to join), C) General / unclear. Then respond accordingly.

INITIAL RESPONSE (if unclear intent):
"Hi, thanks for reaching out. Are you looking to book a service, or are you a provider interested in getting listed?"

CUSTOMER FLOW
Step 1 - Ask: "What service are you looking for and what city are you in?"
Step 2 - Once answered, give a direct link: "Here are local providers in [their city] for [their service]: https://goldtouchlist.com/listing-category/[service]/" where [service] is cleaning, massage, wellness, beauty, or skincare. End the message there. Do NOT add any follow-up question after the link.

PROVIDER FLOW
Step 1 - Confirm: "Are you currently offering [service] in [city]?" (only ask if they haven't specified)
Step 2 - Value: "Gold Touch List lets you connect directly with clients. No commissions. You set your own rates."
Step 3 - Link: "Here is where you can create your free profile: https://goldtouchlist.com/submit-listing/"
Step 4 - Nudge: "Once you complete the service profile, you will be visible to clients."
Step 5 - Support: "If you want, I can review it after you submit."

COMMON QUESTIONS
Pricing: "Creating a profile is free. When a client contacts you, you can choose to unlock their details for a small one-time fee. There are no monthly subscriptions and no commissions."
Trust: "Providers complete detailed profiles and verification. Clients can compare before contacting."
Availability: "Each provider manages their own schedule. You can message them directly through their profile."
How It Works: "You browse providers, choose who fits your needs, and contact them directly."

RULES
- NEVER assume a city or service. Always ask first. Even if a city or service was mentioned earlier in the conversation, confirm before using it in a new context.
- Always send direct URLs, never the homepage unless unsure.
- Each reply must be under 4 short lines, clear, actionable, human-sounding, and purpose-driven.
- NEVER use markdown formatting. No ** for bold, no * for italic, no # for headings, no numbered lists with bold titles. Use plain text only. Write naturally like a text message.
- For Instagram DMs: keep replies shorter, use line breaks, avoid long explanations.
- For Facebook Messenger: slightly more detailed, can include brief bullet points if needed.
- Current platform: ${platform}`;
  }

  const combined = instructions.map((i) => i.instructions).join('\n\n');
  // Always enforce no-markdown rule regardless of what's stored in the DB
  return combined + '\n\nIMPORTANT: NEVER use markdown formatting. No ** for bold, no * for italic, no # for headings. Use plain text only.';
}

async function getOrCreateConversation(senderId, platform, senderName) {
  let conversation = await Conversation.findOne({
    where: { senderId, platform },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      senderId,
      platform,
      senderName: senderName || 'Unknown',
    });
    logger.info('New conversation created', { senderId, platform });
  }

  return conversation;
}

async function generateReply({ senderId, senderName, messageText, platform }) {
  logger.info('Processing incoming message', { senderId, platform, messageLength: messageText.length });

  const conversation = await getOrCreateConversation(senderId, platform, senderName);

  // Save incoming message
  await Message.create({
    conversationId: conversation.id,
    role: 'user',
    content: messageText,
    platform,
    senderId,
  });

  // Get conversation history for context
  const history = await Message.findAll({
    where: { conversationId: conversation.id },
    order: [['createdAt', 'DESC']],
    limit: MAX_HISTORY,
  });

  const messages = history.reverse().map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Get system instructions
  const systemInstructions = await getSystemInstructions(platform);

  // Build OpenAI messages
  const openaiMessages = [
    { role: 'system', content: systemInstructions },
    ...messages,
  ];

  // Generate reply
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: openaiMessages,
    max_tokens: 500,
    temperature: 0.7,
  });

  const replyText = stripMarkdown(response.choices[0].message.content.trim());

  // Save assistant reply
  await Message.create({
    conversationId: conversation.id,
    role: 'assistant',
    content: replyText,
    platform,
  });

  // Update conversation stats
  await conversation.update({
    lastMessageAt: new Date(),
    messageCount: conversation.messageCount + 2,
    senderName: senderName || conversation.senderName,
  });

  // Log
  await Log.create({
    action: `${platform}_chat`,
    status: 'success',
    message: `Replied to ${senderName || senderId} on ${platform}`,
    metadata: { conversationId: conversation.id, senderId },
  });

  logger.info('Reply generated', { senderId, platform, replyLength: replyText.length });

  return replyText;
}

module.exports = { generateReply, getOrCreateConversation, getSystemInstructions, stripMarkdown };
