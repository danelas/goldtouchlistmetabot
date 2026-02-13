const axios = require('axios');
const logger = require('../utils/logger');

const WP_URL = process.env.WP_SITE_URL; // e.g. https://goldtouchlist.com
const WP_USER = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

function getAuthHeader() {
  const token = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

async function createPost({ title, content, status = 'draft', categories = [], tags = [], featuredMediaId = null, date = null }) {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error('WordPress credentials not configured. Set WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD.');
  }

  const payload = {
    title,
    content,
    status,
    categories,
    tags,
  };

  if (featuredMediaId) {
    payload.featured_media = featuredMediaId;
  }

  // Schedule for a future date
  if (date && status === 'future') {
    payload.date = date;
    payload.date_gmt = date;
  }

  logger.info('Publishing article to WordPress', { title, status });

  const response = await axios.post(`${WP_URL}/wp-json/wp/v2/posts`, payload, {
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  logger.info('Article published to WordPress', { wpPostId: response.data.id, link: response.data.link });

  return {
    wpPostId: response.data.id,
    link: response.data.link,
    status: response.data.status,
  };
}

async function getCategories() {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error('WordPress credentials not configured.');
  }

  const response = await axios.get(`${WP_URL}/wp-json/wp/v2/categories`, {
    headers: getAuthHeader(),
    params: { per_page: 100 },
  });

  return response.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
}

async function verifyConnection() {
  try {
    if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
      return { valid: false, error: 'Credentials not set' };
    }

    const response = await axios.get(`${WP_URL}/wp-json/wp/v2/users/me`, {
      headers: getAuthHeader(),
    });

    logger.info('WordPress connection verified', { user: response.data.name });
    return { valid: true, user: response.data.name, url: WP_URL };
  } catch (error) {
    const wpError = error.response?.data?.message || error.message;
    logger.error('WordPress connection failed', { error: wpError });
    return { valid: false, error: wpError };
  }
}

async function createPage({ title, content, slug, status = 'publish', parentId = null, elementorData = null }) {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error('WordPress credentials not configured. Set WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD.');
  }

  const payload = {
    title,
    content: content || '',
    slug,
    status,
  };

  if (parentId) {
    payload.parent = parentId;
  }

  // If Elementor data is provided, set meta fields so Elementor renders the page
  if (elementorData) {
    const elementorJson = typeof elementorData === 'string' ? elementorData : JSON.stringify(elementorData);
    payload.meta = {
      _elementor_data: elementorJson,
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
    };
  }

  logger.info('Creating WordPress page', { title, slug, status, hasElementor: !!elementorData });

  const response = await axios.post(`${WP_URL}/wp-json/wp/v2/pages`, payload, {
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  const wpPageId = response.data.id;

  // Fallback: if meta wasn't set via REST (Elementor meta not registered in REST),
  // try setting it via a direct meta update
  if (elementorData && !response.data.meta?._elementor_data) {
    try {
      await setPostMeta(wpPageId, elementorData);
    } catch (metaErr) {
      logger.warn('Could not set Elementor meta via fallback', { wpPageId, error: metaErr.message });
    }
  }

  logger.info('WordPress page created', { wpPageId, link: response.data.link, slug: response.data.slug });

  return {
    wpPageId,
    link: response.data.link,
    slug: response.data.slug,
    status: response.data.status,
  };
}

// Fallback: set Elementor post meta directly via the WP REST API post meta endpoint
async function setPostMeta(pageId, elementorData) {
  const elementorJson = typeof elementorData === 'string' ? elementorData : JSON.stringify(elementorData);
  const headers = { ...getAuthHeader(), 'Content-Type': 'application/json' };

  // Try updating the page with meta in a second call
  await axios.post(`${WP_URL}/wp-json/wp/v2/pages/${pageId}`, {
    meta: {
      _elementor_data: elementorJson,
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
    },
  }, { headers });

  logger.info('Elementor meta set via fallback', { pageId });
}

async function getPageBySlug(slug) {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error('WordPress credentials not configured.');
  }

  const response = await axios.get(`${WP_URL}/wp-json/wp/v2/pages`, {
    headers: getAuthHeader(),
    params: { slug, per_page: 1 },
  });

  return response.data.length > 0 ? response.data[0] : null;
}

async function updatePage(pageId, { title, content, slug, status, elementorData = null }) {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error('WordPress credentials not configured.');
  }

  const payload = {};
  if (title) payload.title = title;
  if (content) payload.content = content;
  if (slug) payload.slug = slug;
  if (status) payload.status = status;

  if (elementorData) {
    const elementorJson = typeof elementorData === 'string' ? elementorData : JSON.stringify(elementorData);
    payload.meta = {
      _elementor_data: elementorJson,
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
    };
  }

  logger.info('Updating WordPress page', { pageId, slug });

  const response = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/${pageId}`, payload, {
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  return {
    wpPageId: response.data.id,
    link: response.data.link,
    slug: response.data.slug,
    status: response.data.status,
  };
}

module.exports = { createPost, createPage, getPageBySlug, updatePage, setPostMeta, getCategories, verifyConnection };
