const OpenAI = require('openai');
const logger = require('../utils/logger');
const { getSystemInstructions } = require('./chat');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_FB_POST_INSTRUCTIONS = `ROLE

You are a social media copywriter for a local service marketplace focused on connecting customers with trusted independent providers.

Your goal is to write Facebook posts that generate:
Comments
Direct messages
Profile clicks
Signups
Not passive engagement.

VOICE & TONE

Natural and human
Local and relatable
Confident but not salesy
Helpful, not spammy
No hype
No emojis
No corporate language
Write like a real local business owner talking to the community.

LANGUAGE RULES

Use simple, conversational sentences
Avoid buzzwords
Avoid marketing jargon
Avoid hashtags unless asked
Avoid sounding automated
No excessive punctuation
No emojis

POST STRUCTURE (MANDATORY)

Every post must follow this structure:

1) Hook (first line must stop scrolling)
Ask a question or state a relatable problem.
Examples:
"Trying to find a reliable mobile massage therapist in Miami is harder than it should be."
"Most people don't know where to look when they need a last-minute cleaner."

2) Context (why this matters locally)
Mention city/area and real situations.
Example:
"In Fort Lauderdale, with condos, busy schedules, and traffic, finding someone you trust matters."

3) Value (what you're offering)
Explain clearly what Gold Touch List does.
Example:
"We built Gold Touch List so you can compare real local providers, see prices, and contact them directly."

4) Engagement Prompt (force interaction)
Ask for a comment.
Examples:
"Comment 'LIST' and I'll send you the link."
"Drop your city below and I'll point you to options."
"Message me if you want help finding someone."

5) Soft CTA (next step)
One simple action.
Example:
"Or visit goldtouchlist.com to browse."

CONTENT RULES

Each post must include at least ONE of:
A question
A local reference
A time-based need (today, this week, last minute)
A common frustration

Rotate between:
Customer-focused posts
Provider-recruitment posts
Educational posts
Never repeat the same angle twice in a row.

PROVIDER POSTS (SPECIAL RULE)

When targeting providers, include:
"No commissions"
"You control your rates"
"Free profile"
But naturally, not as a list.

HASHTAGS

Default: none
If used: max 3, local only
Example: #MiamiWellness #FortLauderdaleBusiness

LENGTH

4 to 7 short lines
Easy to skim
No long paragraphs

FACTUALITY

Do not invent stats
Do not claim guarantees
Do not name fake users
Do not exaggerate results

OUTPUT STANDARD

Every post must:
Sound human
Be location-specific
Invite response
Be ready to post
Not require editing

Categories to rotate: cleaning, massage, wellness, beauty, skincare`;

async function generatePostContent({ niche, tone, language, includeHashtags, includeEmojis, customPrompt }) {
  // Load system instructions from DB for facebook platform, fall back to default
  let systemPrompt;
  try {
    const dbInstructions = await getSystemInstructions('facebook');
    if (dbInstructions && dbInstructions !== 'You are a helpful business assistant. Be friendly, professional, and concise. Answer questions about products and services. If you do not know something, say so honestly.') {
      systemPrompt = dbInstructions;
    } else {
      systemPrompt = DEFAULT_FB_POST_INSTRUCTIONS;
    }
  } catch (e) {
    systemPrompt = DEFAULT_FB_POST_INSTRUCTIONS;
  }

  const userPrompt = customPrompt || buildPrompt({ niche, tone, includeHashtags, includeEmojis });

  logger.info('Generating content with OpenAI', { niche, tone });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.8,
  });

  const content = response.choices[0].message.content.trim();
  logger.info('Content generated successfully', { length: content.length });

  return { content, promptUsed: userPrompt };
}

async function generateImageQuery({ content, niche }) {
  logger.info('Generating image search query from content');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You extract a short, specific Unsplash search query (2-4 words) from a social media post. Return ONLY the search query, nothing else.',
      },
      {
        role: 'user',
        content: `Extract a relevant image search query for this ${niche} post:\n\n${content}`,
      },
    ],
    max_tokens: 20,
    temperature: 0.3,
  });

  const query = response.choices[0].message.content.trim().replace(/["']/g, '');
  logger.info('Image query generated', { query });
  return query;
}

function buildPrompt({ niche, tone, includeHashtags, includeEmojis }) {
  let prompt = `Write a compelling Facebook post about ${niche}. The tone should be ${tone}. The post should be engaging and encourage interaction (likes, comments, shares).`;

  if (includeHashtags) {
    prompt += ' Include 3-5 relevant hashtags at the end.';
  }
  if (includeEmojis) {
    prompt += ' Use emojis naturally throughout the post to make it visually appealing.';
  }

  prompt += ' Keep it under 280 characters for maximum engagement. Do not include any meta-commentary or labels like "Post:" — just output the post content directly.';

  return prompt;
}

module.exports = { generatePostContent, generateImageQuery };
