const axios = require('axios');
const logger = require('../utils/logger');

const FB_GRAPH_URL = 'https://graph.facebook.com/v21.0';

/**
 * Get the Instagram Business Account ID from the connected Facebook Page.
 */
async function getInstagramAccountId() {
  const igAccountId = process.env.IG_ACCOUNT_ID;
  if (igAccountId) return igAccountId;

  // Auto-discover from Facebook Page
  const pageId = process.env.FB_PAGE_ID;
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  const response = await axios.get(`${FB_GRAPH_URL}/${pageId}`, {
    params: {
      fields: 'instagram_business_account',
      access_token: accessToken,
    },
  });

  const igAccount = response.data.instagram_business_account;
  if (!igAccount || !igAccount.id) {
    throw new Error('No Instagram Business Account connected to this Facebook Page. Connect one in Page Settings > Linked Accounts.');
  }

  logger.info('Instagram Business Account discovered', { igAccountId: igAccount.id });
  return igAccount.id;
}

/**
 * Publish an image post to Instagram.
 * Instagram Content Publishing API uses a 2-step process:
 * 1. Create a media container
 * 2. Publish the container
 *
 * @param {string} imageUrl - Publicly accessible image URL
 * @param {string} caption - Post caption text
 */
async function publishPost({ imageUrl, caption }) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const igAccountId = await getInstagramAccountId();

  logger.info('Publishing to Instagram', { igAccountId, hasImage: !!imageUrl });

  try {
    // Step 1: Create media container
    const containerRes = await axios.post(`${FB_GRAPH_URL}/${igAccountId}/media`, {
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken,
    });

    const containerId = containerRes.data.id;
    logger.info('Instagram media container created', { containerId });

    // Step 2: Wait for container to be ready (Instagram processes the image)
    await waitForContainer(containerId, accessToken);

    // Step 3: Publish the container
    const publishRes = await axios.post(`${FB_GRAPH_URL}/${igAccountId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    });

    const postId = publishRes.data.id;
    logger.info('Instagram post published', { postId });

    return { instagramPostId: postId };
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Instagram publish failed', {
      status: error.response?.status,
      fbMessage: fbError.message,
      fbType: fbError.type,
      fbCode: fbError.code,
      fbSubcode: fbError.error_subcode,
    });
    throw error;
  }
}

/**
 * Wait for Instagram media container to finish processing.
 * Polls every 2 seconds, max 30 seconds.
 */
async function waitForContainer(containerId, accessToken) {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await axios.get(`${FB_GRAPH_URL}/${containerId}`, {
      params: {
        fields: 'status_code',
        access_token: accessToken,
      },
    });

    const status = statusRes.data.status_code;
    if (status === 'FINISHED') {
      return;
    }
    if (status === 'ERROR') {
      throw new Error('Instagram media container processing failed');
    }

    // Wait 2 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Instagram media container processing timed out');
}

/**
 * Verify Instagram connection by fetching account info.
 */
async function verifyConnection() {
  try {
    const igAccountId = await getInstagramAccountId();
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    // Try to get full account details (requires instagram_basic)
    try {
      const response = await axios.get(`${FB_GRAPH_URL}/${igAccountId}`, {
        params: {
          fields: 'username,name,profile_picture_url,followers_count,media_count',
          access_token: accessToken,
        },
      });

      return {
        valid: true,
        igAccountId,
        username: response.data.username,
        name: response.data.name,
        followers: response.data.followers_count,
        mediaCount: response.data.media_count,
      };
    } catch (detailErr) {
      // Account exists but we can't read details (missing instagram_basic)
      // Still report as connected since publishing can work
      logger.warn('Instagram account found but cannot read details (add instagram_basic permission for full info)', {
        igAccountId,
        error: detailErr.response?.data?.error?.message || detailErr.message,
      });
      return {
        valid: true,
        igAccountId,
        username: igAccountId,
        name: 'Instagram Business Account',
        note: 'Add instagram_basic permission for full account details',
      };
    }
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    return {
      valid: false,
      error: fbError.message || error.message,
    };
  }
}

module.exports = { publishPost, getInstagramAccountId, verifyConnection };
