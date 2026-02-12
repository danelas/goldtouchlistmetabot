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

module.exports = { createPost, getCategories, verifyConnection };
