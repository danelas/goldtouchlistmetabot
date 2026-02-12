const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============ CITY & SERVICE DATA ============

const CITIES = [
  {
    name: 'Miami',
    state: 'Florida',
    slug: 'miami',
    latitude: 25.7616798,
    longitude: -80.1917902,
    region: 'ChIJEcHIDqKw2YgRZU-t3XHylv8',
    neighborhoods: ['Brickell', 'Wynwood', 'Coral Gables', 'South Beach', 'Downtown Miami', 'Coconut Grove'],
  },
  {
    name: 'Fort Lauderdale',
    state: 'Florida',
    slug: 'fort-lauderdale',
    latitude: 26.1224386,
    longitude: -80.13731740000001,
    region: 'ChIJ9cr6ICcB2YgRvo6_QHW-AnY',
    neighborhoods: ['Las Olas', 'Victoria Park', 'Flagler Village', 'Wilton Manors', 'Oakland Park'],
  },
  {
    name: 'Los Angeles',
    state: 'California',
    slug: 'los-angeles',
    latitude: 34.0549076,
    longitude: -118.242643,
    region: 'ChIJE9on3F3HwoAR9AhGJW_fL-I',
    neighborhoods: ['Beverly Hills', 'Santa Monica', 'West Hollywood', 'Silver Lake', 'Hollywood', 'Downtown LA'],
  },
  {
    name: 'New York',
    state: 'New York',
    slug: 'new-york',
    latitude: 40.7127753,
    longitude: -74.0059728,
    region: 'ChIJOwg_06VPwokRYv534QaPC8g',
    neighborhoods: ['Manhattan', 'Brooklyn', 'Upper East Side', 'Tribeca', 'SoHo', 'Midtown'],
  },
  {
    name: 'Hollywood',
    state: 'Florida',
    slug: 'hollywood-fl',
    latitude: 26.0112014,
    longitude: -80.1494901,
    region: '',
    neighborhoods: ['Hollywood Beach', 'Downtown Hollywood', 'Hallandale'],
  },
  {
    name: 'Broward County',
    state: 'Florida',
    slug: 'broward',
    latitude: 26.1224386,
    longitude: -80.13731740000001,
    region: 'ChIJ9cr6ICcB2YgRvo6_QHW-AnY',
    neighborhoods: ['Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Davie', 'Plantation'],
  },
];

const SERVICES = [
  { name: 'Massage', slug: 'massage', categoryId: 189, searchTerm: 'Mobile Massage' },
  { name: 'Cleaning', slug: 'cleaning', categoryId: 187, searchTerm: 'House Cleaners' },
  { name: 'Skincare', slug: 'skincare', categoryId: 272, searchTerm: 'Estheticians' },
  { name: 'Beauty', slug: 'beauty', categoryId: 213, searchTerm: 'Beauty Professionals' },
  { name: 'Wellness', slug: 'wellness', categoryId: 468, searchTerm: 'Wellness Practitioners' },
];

const ARTICLE_TEMPLATES = [
  {
    type: 'best-in-city',
    titleTemplate: 'Best {service} in {city}',
    description: 'Ranking/discovery page for top providers',
    ctaType: 'client',
  },
  {
    type: 'near-me',
    titleTemplate: '{service} Near Me in {city}',
    description: 'Local search intent page',
    ctaType: 'client',
  },
  {
    type: 'cost-guide',
    titleTemplate: 'How Much Does {service} Cost in {city}',
    description: 'Pricing and comparison guide',
    ctaType: 'client',
  },
  {
    type: 'how-to-choose',
    titleTemplate: 'How to Choose a {service} in {city}',
    description: 'Decision-making guide',
    ctaType: 'client',
  },
  {
    type: 'provider-guide',
    titleTemplate: 'How to Get More {service} Clients in {city}',
    description: 'Provider recruitment article',
    ctaType: 'provider',
  },
];

const PROVIDER_CTA_URL = 'https://goldtouchlist.com/account/login/';

// ============ URL BUILDERS ============

function buildListingUrl(city, service) {
  const location = encodeURIComponent(`${city.name}, ${city.state}`);
  return `https://goldtouchlist.com/?post_type=hp_listing&latitude=${city.latitude}&longitude=${city.longitude}&_region=${city.region}&_category=${service.categoryId}&s=&location=${location}&city=${encodeURIComponent(city.name)}`;
}

// ============ SYSTEM INSTRUCTIONS ============

const ARTICLE_SYSTEM_PROMPT = `ROLE

You are a professional local SEO content writer for a service marketplace focused on trust, clarity, and conversion.

Your job is to write high-quality, location-specific service articles that rank on Google and convert readers into clients and providers.

VOICE & TONE

Clear, confident, professional
Helpful and practical
Local and grounded (not generic)
Trust-building, not salesy
No hype language
No fluff
No emojis
Write as a knowledgeable local expert helping residents make good decisions.

LANGUAGE RULES

Use simple, direct sentences
Avoid buzzwords and cliches
Avoid exaggerated claims
Avoid AI-like phrasing
Do not repeat ideas
Do not pad length
Prefer clarity over cleverness.

STRUCTURE RULES

Every article must follow this structure:

Introduction (local relevance + user intent)
Main section answering the search intent
Practical guidance (tips, checklist, or comparison)
Local context (city, neighborhood, common needs)
Platform integration (Gold Touch List value)
Call to action (clear next step)

Use H2 and H3 headings. Output the article in valid HTML format suitable for WordPress publishing.

SEO RULES

Naturally include:
Primary keyword in title and first paragraph
City name throughout
Related keywords
Never keyword-stuff
Write for humans first

CONTENT REQUIREMENTS

Each article must include:
At least 3 actionable tips
One checklist or bullet list
One pricing or expectation section (when relevant)
One trust/verification section
One provider-facing paragraph (when appropriate)

LOCALIZATION

Reference real local context:
South Florida climate (for FL cities)
Urban vs suburban service needs
Common apartment/condo situations
Traffic, parking, building access
Mention neighborhoods when appropriate
Avoid generic "any city" language.

PLATFORM POSITIONING

Position Gold Touch List as:
A neutral marketplace
No commissions
Direct connection
Transparent profiles
Provider-controlled pricing
Never claim exclusivity or guaranteed results.
Subtly emphasize the benefit of completing a full service profile and using top placement features when discussing visibility, credibility, and client trust.

CALL TO ACTION RULES

Each article must end with a CTA block containing exactly two buttons and one small tagline.
Do NOT label them with headings like "Client Call to Action" or "Provider Call to Action".
Do NOT put any text on the same line as a button. Each button must be on its own line inside a div.
Do NOT wrap the buttons in a paragraph with other text.
Use the exact CTA block HTML provided in the user prompt.

No aggressive sales language.

FORMATTING

Use short paragraphs (2-4 lines max)
Use bullet points where helpful
No walls of text
No decorative symbols
Output as clean HTML with h2, h3, p, ul, li tags.
Do NOT wrap output in markdown code fences.\nOutput raw HTML only. No \`\`\` fences.

FACTUALITY

Do not invent statistics
Do not fabricate reviews
Do not name fake businesses
If uncertain, use ranges or general guidance

OUTPUT STANDARD

Each article must:
Be 800-1,200 words
Be ready for publishing
Require minimal editing
Be internally consistent
Be plagiarism-free`;

// ============ ARTICLE GENERATION ============

function buildArticlePrompt(template, service, city) {
  const listingUrl = buildListingUrl(city, service);
  const title = template.titleTemplate
    .replace('{service}', service.searchTerm || service.name)
    .replace('{city}', city.name);

  let prompt = `Write an article titled: "${title}"\n\n`;
  prompt += `Target city: ${city.name}, ${city.state}\n`;
  prompt += `Service category: ${service.name}\n`;
  prompt += `Article type: ${template.description}\n\n`;

  if (city.neighborhoods && city.neighborhoods.length > 0) {
    prompt += `Mention these neighborhoods where relevant: ${city.neighborhoods.join(', ')}\n\n`;
  }

  const btnStyle = 'display:block;background:#BE8A4D;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;text-align:center;margin:8px 0;width:fit-content;';

  const ctaBlock = `<div style="margin-top:32px;">
<a href="${listingUrl}" style="${btnStyle}">Browse ${service.name} Providers in ${city.name}</a>
<a href="${PROVIDER_CTA_URL}" style="${btnStyle}">Create Your Free Provider Profile</a>
<p style="font-size:13px;color:#888;margin-top:8px;">No commissions. No middlemen. Providers set their own rates.</p>
</div>`;

  prompt += `End the article with this EXACT CTA block. Copy it verbatim as the last element:\n${ctaBlock}\n\n`;
  prompt += `IMPORTANT: Do NOT add any text around or next to the buttons. Do NOT include headings like "Client Call to Action" or "Provider Call to Action". The CTA block above is the final section of the article - paste it exactly as given.\n`;
  prompt += `Output the full article as raw clean HTML (h2, h3, p, ul, li, a tags). Do NOT wrap in markdown code fences. Do not include the title in the HTML body - it will be set separately. Start directly with the introduction paragraph.`;

  return { title, prompt };
}

async function generateArticle(template, service, city) {
  const { title, prompt } = buildArticlePrompt(template, service, city);

  logger.info('Generating article', { title, city: city.name, service: service.name, type: template.type });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.7,
  });

  let content = response.choices[0].message.content.trim();

  // Strip markdown code fences if GPT wraps output in ```html ... ```
  content = content.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  logger.info('Article generated', { title, length: content.length });

  return {
    title,
    content,
    city: city.name,
    state: city.state,
    service: service.name,
    categoryId: service.categoryId,
    templateType: template.type,
    listingUrl: buildListingUrl(city, service),
  };
}

// ============ QUEUE MANAGEMENT ============

function generateArticleQueue() {
  const queue = [];

  for (const template of ARTICLE_TEMPLATES) {
    for (const service of SERVICES) {
      for (const city of CITIES) {
        queue.push({
          templateType: template.type,
          serviceSlug: service.slug,
          citySlug: city.slug,
          title: template.titleTemplate
            .replace('{service}', service.searchTerm || service.name)
            .replace('{city}', city.name),
        });
      }
    }
  }

  return queue;
}

function getNextArticle(publishedTitles = []) {
  const queue = generateArticleQueue();
  const remaining = queue.filter((item) => !publishedTitles.includes(item.title));

  if (remaining.length === 0) {
    logger.info('All article combinations have been published');
    return null;
  }

  return remaining[0];
}

function findTemplate(type) {
  return ARTICLE_TEMPLATES.find((t) => t.type === type);
}

function findService(slug) {
  return SERVICES.find((s) => s.slug === slug);
}

function findCity(slug) {
  return CITIES.find((c) => c.slug === slug);
}

module.exports = {
  generateArticle,
  generateArticleQueue,
  getNextArticle,
  findTemplate,
  findService,
  findCity,
  buildListingUrl,
  CITIES,
  SERVICES,
  ARTICLE_TEMPLATES,
};
