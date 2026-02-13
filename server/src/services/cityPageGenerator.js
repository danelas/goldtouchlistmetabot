const logger = require('../utils/logger');
const { CityPageTemplate, CityPage, Log } = require('../db/models');
const wordpress = require('./wordpress');

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

// Replace all placeholders in a template string
function replacePlaceholders(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// Build placeholder variables for a given city + service + template
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

// Replace placeholders inside Elementor JSON (works on the stringified JSON)
function replaceElementorPlaceholders(elementorJsonStr, vars) {
  let result = elementorJsonStr;
  for (const [key, value] of Object.entries(vars)) {
    // Replace {placeholder} patterns in the JSON string
    // Use a global regex that matches even inside JSON string values
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// Generate a single city page from a template and publish to WordPress
async function generateCityPage({ templateId, city, state, status = 'publish' }) {
  const template = await CityPageTemplate.findByPk(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const vars = buildVars(city, state, template.service, template.serviceSlug);

  // Build title and slug
  const title = replacePlaceholders(template.titleTemplate, vars);
  const slug = replacePlaceholders(template.slugTemplate, vars);

  // Build content based on template type
  let content = '';
  let elementorData = null;

  if (template.templateType === 'elementor' && template.elementorJson) {
    // Elementor JSON template: do placeholder replacement on the raw JSON string
    const rawJson = template.elementorJson;
    const processedJson = replaceElementorPlaceholders(rawJson, vars);
    elementorData = processedJson;

    // Also set a basic HTML fallback content for non-Elementor rendering
    content = template.htmlTemplate ? replacePlaceholders(template.htmlTemplate, vars) : '';

    logger.info('Processing Elementor template', { title, slug, jsonLength: processedJson.length });
  } else {
    // Plain HTML template
    content = template.htmlTemplate ? replacePlaceholders(template.htmlTemplate, vars) : '';
  }

  // Check if page already exists in our DB
  const existing = await CityPage.findOne({
    where: { templateId, city, state, serviceSlug: template.serviceSlug },
  });

  if (existing && existing.status === 'published') {
    logger.info('City page already exists, skipping', { city, service: template.service, slug });
    return { skipped: true, existing };
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
    // Check if WordPress page with this slug already exists
    const existingWpPage = await wordpress.getPageBySlug(slug);

    let wpResult;
    if (existingWpPage) {
      // Update existing WP page
      wpResult = await wordpress.updatePage(existingWpPage.id, { title, content, slug, status, elementorData });
      logger.info('Updated existing WordPress page', { slug, wpPageId: existingWpPage.id });
    } else {
      // Create new WP page
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

// Batch generate city pages for all cities using a template
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
  buildVars,
  replacePlaceholders,
  slugify,
  getStateAbbr,
  STATE_ABBR,
};
