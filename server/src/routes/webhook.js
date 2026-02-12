const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const { generateReply, stripMarkdown } = require('../services/chat');
const { Log } = require('../db/models');

const FB_GRAPH_URL = 'https://graph.facebook.com/v21.0';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============ CTA DETECTION ============
// Uses GPT to determine if a comment is someone responding to a call-to-action
// (e.g., "drop INTERESTED", "comment LINK", etc.)

async function classifyComment(commentText) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You analyze comments on business social media posts. Determine if the comment is someone responding to a call-to-action (CTA) in the post — for example, the post asked them to comment a specific word like "INTERESTED", "INFO", "LINK", "YES", "SEND", "ME", or any similar keyword to receive something (a link, more info, a DM, etc.).

Respond with ONLY a JSON object, no markdown:
{"isCTA": true/false, "confidence": 0.0-1.0}

Examples of CTA responses: "INTERESTED", "Info please", "Link", "Yes!", "Send it", "Me!", "I want in", "Interested!!", "SEND ME THE LINK"
Examples of regular comments: "Nice post", "How much does it cost?", "Where are you located?", "This looks great", "What services do you offer?"`
        },
        { role: 'user', content: commentText }
      ],
      max_tokens: 50,
      temperature: 0,
    });

    const raw = response.choices[0].message.content.trim();
    const parsed = JSON.parse(raw);
    logger.info('Comment classified', { text: commentText.slice(0, 50), isCTA: parsed.isCTA, confidence: parsed.confidence });
    return parsed;
  } catch (error) {
    logger.error('CTA classification failed, defaulting to non-CTA', { error: error.message });
    return { isCTA: false, confidence: 0 };
  }
}

// Generate a personalized DM for CTA responders
async function generateCTADirectMessage(senderName, commentText) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional assistant for Gold Touch List, a local services directory for cleaning, massage, wellness, beauty, and skincare. Someone commented on your post responding to a call-to-action. Write a short, warm, professional DM to send them. No emojis. Keep it under 4 lines. Include the relevant link.

Key links:
- Browse providers: https://goldtouchlist.com
- Cleaning: https://goldtouchlist.com/listing-category/cleaning/
- Massage: https://goldtouchlist.com/listing-category/massage/
- Wellness: https://goldtouchlist.com/listing-category/wellness/
- Beauty: https://goldtouchlist.com/listing-category/beauty/
- Skincare: https://goldtouchlist.com/listing-category/skincare/
- Join as provider: https://goldtouchlist.com/submit-listing/

If the post was about finding services, send the browse link. If about becoming a provider, send the join link. If unclear, send the main site link.

NEVER use markdown formatting. No ** for bold, no * for italic, no # for headings. Use plain text only.`
        },
        { role: 'user', content: `Person named "${senderName || 'there'}" commented: "${commentText}". Write the DM to send them.` }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return stripMarkdown(response.choices[0].message.content.trim());
  } catch (error) {
    logger.error('Failed to generate CTA DM', { error: error.message });
    return `Hi${senderName ? ' ' + senderName : ''}, thanks for your interest! Here's the link: https://goldtouchlist.com`;
  }
}

// ============ WEBHOOK VERIFICATION ============
// Meta sends a GET request to verify the webhook endpoint
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { mode, token });
  return res.sendStatus(403);
});

// ============ WEBHOOK EVENT HANDLER ============
// Meta sends POST requests with messaging events
router.post('/', async (req, res) => {
  const body = req.body;

  // Must respond 200 quickly to avoid retries
  res.sendStatus(200);

  try {
    if (body.object === 'page') {
      for (const entry of body.entry) {
        // Facebook Messenger events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              await handleMessengerMessage(event);
            }
          }
        }

        // Facebook Page comment events
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'feed' && change.value?.item === 'comment') {
              await handleFacebookComment(change);
            }
          }
        }
      }
    } else if (body.object === 'instagram') {
      for (const entry of body.entry) {
        // Instagram DM events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              await handleInstagramMessage(event);
            }
          }
        }

        // Instagram Comment events
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'comments' && change.value) {
              await handleInstagramComment(change.value);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Webhook processing error', { error: error.message });
    await Log.create({
      action: 'webhook_error',
      status: 'error',
      message: error.message,
      metadata: { body: JSON.stringify(body).slice(0, 500) },
    });
  }
});

// ============ FACEBOOK MESSENGER ============

async function handleMessengerMessage(event) {
  const senderId = event.sender.id;
  const messageText = event.message.text;

  if (!messageText) {
    logger.info('Non-text Messenger message received, skipping', { senderId });
    return;
  }

  logger.info('Messenger message received', { senderId, text: messageText.slice(0, 100) });

  // Get sender profile
  let senderName = null;
  try {
    const profile = await axios.get(`${FB_GRAPH_URL}/${senderId}`, {
      params: {
        fields: 'first_name,last_name',
        access_token: process.env.FB_PAGE_ACCESS_TOKEN,
      },
    });
    senderName = `${profile.data.first_name || ''} ${profile.data.last_name || ''}`.trim();
  } catch (e) {
    logger.warn('Could not fetch Messenger sender profile', { senderId });
  }

  // Generate AI reply
  const replyText = await generateReply({
    senderId,
    senderName,
    messageText,
    platform: 'messenger',
  });

  // Send reply via Messenger Send API
  await sendMessengerReply(senderId, replyText);
}

async function sendMessengerReply(recipientId, text) {
  text = stripMarkdown(text);
  try {
    await axios.post(`${FB_GRAPH_URL}/me/messages`, {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
      access_token: process.env.FB_PAGE_ACCESS_TOKEN,
    });
    logger.info('Messenger reply sent', { recipientId });
  } catch (error) {
    logger.error('Failed to send Messenger reply', {
      recipientId,
      error: error.response?.data || error.message,
    });
    throw error;
  }
}

// ============ INSTAGRAM MESSAGING ============

async function handleInstagramMessage(event) {
  const senderId = event.sender.id;
  const messageText = event.message.text;

  if (!messageText) {
    logger.info('Non-text Instagram message received, skipping', { senderId });
    return;
  }

  logger.info('Instagram message received', { senderId, text: messageText.slice(0, 100) });

  // Get sender profile
  let senderName = null;
  try {
    const profile = await axios.get(`${FB_GRAPH_URL}/${senderId}`, {
      params: {
        fields: 'name,username',
        access_token: process.env.IG_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN,
      },
    });
    senderName = profile.data.username || profile.data.name || null;
  } catch (e) {
    logger.warn('Could not fetch Instagram sender profile', { senderId });
  }

  // Generate AI reply
  const replyText = await generateReply({
    senderId,
    senderName,
    messageText,
    platform: 'instagram',
  });

  // Send reply via Instagram Send API
  await sendInstagramReply(senderId, replyText);
}

async function sendInstagramReply(recipientId, text) {
  const igAccessToken = process.env.IG_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
  text = stripMarkdown(text);

  try {
    await axios.post(`${FB_GRAPH_URL}/me/messages`, {
      recipient: { id: recipientId },
      message: { text },
      access_token: igAccessToken,
    });
    logger.info('Instagram reply sent', { recipientId });
  } catch (error) {
    logger.error('Failed to send Instagram reply', {
      recipientId,
      error: error.response?.data || error.message,
    });
    throw error;
  }
}

// ============ INSTAGRAM COMMENTS ============

async function handleInstagramComment(commentData) {
  const { id: commentId, text, from, media } = commentData;

  // Skip if no text or if it's our own reply
  if (!text || !from) {
    logger.info('Instagram comment without text or sender, skipping', { commentId });
    return;
  }

  const senderId = from.id;
  const senderName = from.username || from.name || null;

  logger.info('Instagram comment received', {
    commentId,
    senderId,
    senderName,
    text: text.slice(0, 100),
    mediaId: media?.id,
  });

  // Classify: is this a CTA response or a regular comment?
  const classification = await classifyComment(text);

  if (classification.isCTA && classification.confidence >= 0.7) {
    // CTA response → send private DM + public nudge
    logger.info('CTA detected on Instagram comment', { commentId, senderId, senderName, confidence: classification.confidence });

    // Generate personalized DM
    const dmText = await generateCTADirectMessage(senderName, text);

    // Send private reply (DM) via Instagram Private Replies API
    await sendInstagramPrivateReply(commentId, dmText);

    // Reply publicly with nudge
    await replyToInstagramComment(commentId, `Hey${senderName ? ' @' + senderName : ''}, just sent you a DM with all the details!`);

    await Log.create({
      action: 'instagram_cta_dm',
      status: 'success',
      message: `CTA DM sent to ${senderName || senderId} on Instagram`,
      metadata: { commentId, senderId, mediaId: media?.id },
    });
  } else {
    // Regular comment → normal AI reply
    const replyText = await generateReply({
      senderId,
      senderName,
      messageText: text,
      platform: 'instagram_comment',
    });

    await replyToInstagramComment(commentId, replyText);
  }
}

async function replyToInstagramComment(commentId, text) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  text = stripMarkdown(text);

  try {
    await axios.post(`${FB_GRAPH_URL}/${commentId}/replies`, {
      message: text,
      access_token: accessToken,
    });
    logger.info('Instagram comment reply sent', { commentId });
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Failed to reply to Instagram comment', {
      commentId,
      error: fbError.message || error.message,
      code: fbError.code,
    });
    throw error;
  }
}

async function sendInstagramPrivateReply(commentId, text) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  text = stripMarkdown(text);

  try {
    await axios.post(`${FB_GRAPH_URL}/${commentId}/private_replies`, {
      message: text,
      access_token: accessToken,
    });
    logger.info('Instagram private reply (DM) sent', { commentId });
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Failed to send Instagram private reply', {
      commentId,
      error: fbError.message || error.message,
      code: fbError.code,
    });
    // Don't throw — still send the public nudge even if DM fails
  }
}

// ============ FACEBOOK PAGE COMMENTS ============

async function handleFacebookComment(change) {
  const { value } = change;

  // Only reply to new comments (not edits/deletes) from other users
  if (!value || value.verb !== 'add' || value.from?.id === process.env.FB_PAGE_ID) {
    return;
  }

  const commentId = value.comment_id;
  const text = value.message;
  const senderId = value.from?.id;
  const senderName = value.from?.name;

  if (!text || !commentId) {
    logger.info('Facebook comment without text, skipping');
    return;
  }

  logger.info('Facebook comment received', {
    commentId,
    senderId,
    senderName,
    text: text.slice(0, 100),
    postId: value.post_id,
  });

  // Classify: is this a CTA response or a regular comment?
  const classification = await classifyComment(text);

  if (classification.isCTA && classification.confidence >= 0.7) {
    // CTA response → send private Messenger DM + public nudge
    logger.info('CTA detected on Facebook comment', { commentId, senderId, senderName, confidence: classification.confidence });

    // Generate personalized DM
    const dmText = await generateCTADirectMessage(senderName, text);

    // Send private reply (Messenger DM) via Facebook Private Replies API
    await sendFacebookPrivateReply(commentId, dmText);

    // Reply publicly with nudge
    await replyToFacebookComment(commentId, `Hey${senderName ? ' ' + senderName : ''}, just sent you a message with all the details!`);

    await Log.create({
      action: 'facebook_cta_dm',
      status: 'success',
      message: `CTA DM sent to ${senderName || senderId} on Facebook`,
      metadata: { commentId, senderId, postId: value.post_id },
    });
  } else {
    // Regular comment → normal AI reply
    const replyText = await generateReply({
      senderId,
      senderName,
      messageText: text,
      platform: 'facebook_comment',
    });

    await replyToFacebookComment(commentId, replyText);
  }
}

async function replyToFacebookComment(commentId, text) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  try {
    await axios.post(`${FB_GRAPH_URL}/${commentId}/comments`, {
      message: text,
      access_token: accessToken,
    });
    logger.info('Facebook comment reply sent', { commentId });
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Failed to reply to Facebook comment', {
      commentId,
      error: fbError.message || error.message,
      code: fbError.code,
    });
    throw error;
  }
}

async function sendFacebookPrivateReply(commentId, text) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  try {
    await axios.post(`${FB_GRAPH_URL}/${commentId}/private_replies`, {
      message: text,
      access_token: accessToken,
    });
    logger.info('Facebook private reply (Messenger DM) sent', { commentId });
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Failed to send Facebook private reply', {
      commentId,
      error: fbError.message || error.message,
      code: fbError.code,
    });
    // Don't throw — still send the public nudge even if DM fails
  }
}

module.exports = router;
