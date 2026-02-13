const OpenAI = require('openai');
const logger = require('../utils/logger');
const { CityPageTemplate, CityPage, Log } = require('../db/models');
const wordpress = require('./wordpress');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// US state abbreviations
const STATE_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getStateAbbr(state) {
  return STATE_ABBR[state] || state;
}

function replacePlaceholders(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

function buildVars(city, state, service, serviceSlug) {
  const stateAbbr = getStateAbbr(state);
  const citySlug = slugify(city);

  return {
    city,
    city_slug: citySlug,
    state,
    state_abbr: stateAbbr,
    state_abbr_lower: stateAbbr.toLowerCase(),
    state_lower: state.toLowerCase(),
    service,
    service_slug: serviceSlug,
    service_lower: service.toLowerCase(),
    city_state: `${city}, ${state}`,
    city_state_abbr: `${city}, ${stateAbbr}`,
    listing_url: `https://goldtouchlist.com/listing-category/${serviceSlug}/`,
    provider_url: 'https://goldtouchlist.com/submit-listing/',
    site_url: 'https://goldtouchlist.com',
  };
}

// ============ ELEMENTOR JSON PARSING ============

// Unwrap Elementor export format: {content: [...], page_settings: {...}} -> [...]
function parseElementorExport(data) {
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  // If it's the Elementor export wrapper with a "content" key, extract the array
  if (data && !Array.isArray(data) && Array.isArray(data.content)) {
    return data.content;
  }
  // Already an array of elements
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error('Unrecognized Elementor JSON format');
}

// Widget types that contain text content we want to rewrite
const TEXT_WIDGET_TYPES = ['heading', 'text-editor', 'theme-post-content'];

// Recursively walk the Elementor JSON tree and extract text blocks with their paths
function extractTextBlocks(elements, path = []) {
  const blocks = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const currentPath = [...path, i];

    if (el.elType === 'widget' && TEXT_WIDGET_TYPES.includes(el.widgetType)) {
      const settings = el.settings || {};

      if (el.widgetType === 'heading' && settings.title) {
        blocks.push({
          path: currentPath,
          field: 'title',
          widgetType: 'heading',
          originalText: settings.title,
        });
      }

      if ((el.widgetType === 'text-editor' || el.widgetType === 'theme-post-content') && settings.editor) {
        blocks.push({
          path: currentPath,
          field: 'editor',
          widgetType: el.widgetType,
          originalText: settings.editor,
        });
      }
    }

    // Recurse into child elements (sections, columns, containers)
    if (el.elements && el.elements.length > 0) {
      blocks.push(...extractTextBlocks(el.elements, currentPath.concat('elements')));
    }
  }

  return blocks;
}

// Set a value deep in the Elementor JSON tree using a path array
function setNestedValue(obj, path, field, value) {
  let current = obj;
  for (const key of path) {
    current = current[key];
  }
  current.settings[field] = value;
}

// ============ GPT REWRITING ============

const REWRITE_SYSTEM_PROMPT = `You are a professional local SEO copywriter for Gold Touch List, a local services marketplace.

Your job: Rewrite text blocks for a city-specific service landing page. You will receive the original text blocks from a template page and must rewrite them for a NEW city.

RULES:
- Rewrite every text block with UNIQUE, ORIGINAL copy. Do NOT just swap city names.
- Keep the same general meaning and purpose of each block but use different words, phrasing, and angles.
- Make the content feel locally relevant to the target city.
- Keep the same approximate length for each block (do not make it significantly longer or shorter).
- Headings should stay punchy and short.
- Body text should be professional, clear, and trust-building.
- Preserve any HTML tags in body text (p, strong, em, br, ul, li, a, span, h2, h3, etc.) — rewrite the text inside the tags but keep the tag structure.
- Do NOT add markdown formatting. Output plain text for headings, HTML for body blocks.
- Do NOT invent fake statistics, reviews, or business names.
- Mention the city name naturally throughout.
- Keep links/URLs exactly as provided — do not change any URLs.
- No emojis, no hype language, no fluff.

RESPONSE FORMAT:
You must respond with ONLY a JSON array of objects, one per text block, in the same order as provided.
Each object must have: {"index": <number>, "rewrittenText": "<the rewritten text>"}
Do NOT wrap the response in markdown code fences. Output raw JSON only.`;

async function rewriteTextBlocks(blocks, city, state, service, serviceSlug) {
  if (blocks.length === 0) return [];

  const stateAbbr = getStateAbbr(state);

  const userPrompt = `Rewrite the following text blocks for a ${service} landing page targeting ${city}, ${stateAbbr}.

Service: ${service}
City: ${city}, ${state} (${stateAbbr})
Listing URL: https://goldtouchlist.com/listing-category/${serviceSlug}/
Provider signup URL: https://goldtouchlist.com/submit-listing/

TEXT BLOCKS TO REWRITE:
${blocks.map((b, i) => `[${i}] (${b.widgetType}): ${b.originalText}`).join('\n\n')}

Remember: Rewrite with UNIQUE copy. Different words and phrasing. Not just city-name swaps. Keep HTML tags intact in body text. Respond with ONLY a JSON array.`;

  logger.info('Sending text blocks to GPT for rewriting', {
    city,
    service,
    blockCount: blocks.length,
    totalChars: blocks.reduce((sum, b) => sum + b.originalText.length, 0),
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 8000,
    temperature: 0.8,
  });

  let rawOutput = response.choices[0].message.content.trim();
  // Strip markdown code fences if present
  rawOutput = rawOutput.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const rewritten = JSON.parse(rawOutput);
    logger.info('GPT rewrite complete', { city, service, rewrittenCount: rewritten.length });
    return rewritten;
  } catch (parseError) {
    logger.error('Failed to parse GPT rewrite response', { error: parseError.message, rawOutput: rawOutput.slice(0, 500) });
    throw new Error('GPT returned invalid JSON for rewritten text blocks');
  }
}

// ============ PAGE GENERATION ============

async function generateCityPage({ templateId, city, state, status = 'publish' }) {
  const template = await CityPageTemplate.findByPk(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const vars = buildVars(city, state, template.service, template.serviceSlug);
  const title = replacePlaceholders(template.titleTemplate, vars);
  const slug = replacePlaceholders(template.slugTemplate, vars);

  // Check if page already exists in our DB
  const existing = await CityPage.findOne({
    where: { templateId, city, state, serviceSlug: template.serviceSlug },
  });

  if (existing && existing.status === 'published') {
    logger.info('City page already exists, skipping', { city, service: template.service, slug });
    return { skipped: true, existing };
  }

  let content = '';
  let elementorData = null;

  if (template.templateType === 'elementor' && template.elementorJson) {
    // Parse the Elementor JSON (handles both raw array and {content:[...]} wrapper)
    let elements;
    try {
      elements = parseElementorExport(template.elementorJson);
    } catch (e) {
      throw new Error('Invalid Elementor JSON in template: ' + e.message);
    }

    // Extract all text blocks
    const textBlocks = extractTextBlocks(elements);
    logger.info('Extracted text blocks from Elementor template', {
      city, service: template.service, blockCount: textBlocks.length,
    });

    if (textBlocks.length > 0) {
      // Send to GPT for unique rewriting
      const rewritten = await rewriteTextBlocks(
        textBlocks, city, state, template.service, template.serviceSlug
      );

      // Inject rewritten text back into the Elementor JSON
      for (const item of rewritten) {
        const block = textBlocks[item.index];
        if (block) {
          setNestedValue(elements, block.path, block.field, item.rewrittenText);
        }
      }
    }

    elementorData = JSON.stringify(elements);
    logger.info('Elementor template rewritten for city', { city, slug, jsonLength: elementorData.length });

  } else if (template.htmlTemplate) {
    content = replacePlaceholders(template.htmlTemplate, vars);
  }

  // Create or update the CityPage record
  let cityPage = existing;
  if (!cityPage) {
    cityPage = await CityPage.create({
      templateId,
      service: template.service,
      serviceSlug: template.serviceSlug,
      city,
      citySlug: slugify(city),
      state,
      stateAbbr: getStateAbbr(state),
      title,
      slug,
      status: 'pending',
    });
  }

  try {
    const existingWpPage = await wordpress.getPageBySlug(slug);

    let wpResult;
    if (existingWpPage) {
      wpResult = await wordpress.updatePage(existingWpPage.id, { title, content, slug, status, elementorData });
      logger.info('Updated existing WordPress page', { slug, wpPageId: existingWpPage.id });
    } else {
      wpResult = await wordpress.createPage({ title, content, slug, status, elementorData });
    }

    await cityPage.update({
      wpPageId: wpResult.wpPageId,
      wpLink: wpResult.link,
      status: 'published',
      publishedAt: new Date(),
      errorMessage: null,
    });

    await Log.create({
      action: 'city_page_published',
      status: 'success',
      message: `City page published: ${title}`,
      metadata: { cityPageId: cityPage.id, wpPageId: wpResult.wpPageId, slug, link: wpResult.link },
    });

    logger.info('City page published', { title, slug, link: wpResult.link });
    return { success: true, cityPage, wpResult };

  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    await cityPage.update({ status: 'failed', errorMessage: errMsg });

    await Log.create({
      action: 'city_page_published',
      status: 'error',
      message: `Failed to publish city page: ${title}`,
      metadata: { cityPageId: cityPage.id, error: errMsg },
    });

    logger.error('Failed to publish city page', { title, slug, error: errMsg });
    throw error;
  }
}

async function batchGenerateCityPages({ templateId, cities, status = 'publish' }) {
  const results = [];

  for (const { city, state } of cities) {
    try {
      const result = await generateCityPage({ templateId, city, state, status });
      results.push({ city, state, ...result });
    } catch (error) {
      results.push({ city, state, success: false, error: error.message });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;

  logger.info('Batch city page generation complete', { total: results.length, succeeded, skipped, failed });

  return { total: results.length, succeeded, skipped, failed, results };
}

module.exports = {
  generateCityPage,
  batchGenerateCityPages,
  extractTextBlocks,
  rewriteTextBlocks,
  parseElementorExport,
  buildVars,
  replacePlaceholders,
  slugify,
  getStateAbbr,
  STATE_ABBR,
};
