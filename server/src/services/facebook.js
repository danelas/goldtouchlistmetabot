const axios = require('axios');
const logger = require('../utils/logger');

const FB_GRAPH_URL = 'https://graph.facebook.com/v21.0';

async function publishPost({ content, imageUrl }) {
  const pageId = process.env.FB_PAGE_ID;
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  logger.info('Publishing post to Facebook', { pageId, hasImage: !!imageUrl });

  try {
    let response;

    if (imageUrl) {
      // Post with image
      response = await axios.post(`${FB_GRAPH_URL}/${pageId}/photos`, {
        url: imageUrl,
        caption: content,
        access_token: accessToken,
      });
    } else {
      // Text-only post
      response = await axios.post(`${FB_GRAPH_URL}/${pageId}/feed`, {
        message: content,
        access_token: accessToken,
      });
    }

    const postId = response.data.id || response.data.post_id;
    logger.info('Post published successfully', { facebookPostId: postId });

    return { facebookPostId: postId };
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Facebook publish failed', {
      status: error.response?.status,
      fbMessage: fbError.message,
      fbType: fbError.type,
      fbCode: fbError.code,
      fbSubcode: fbError.error_subcode,
      tokenLength: accessToken?.length,
      tokenStart: accessToken?.substring(0, 10),
    });
    throw error;
  }
}

async function getPageInfo() {
  const pageId = process.env.FB_PAGE_ID;
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  logger.info('Fetching page info', { pageId, tokenLength: accessToken?.length, apiUrl: `${FB_GRAPH_URL}/${pageId}` });

  const response = await axios.get(`${FB_GRAPH_URL}/${pageId}`, {
    params: {
      fields: 'name,fan_count,followers_count',
      access_token: accessToken,
    },
  });

  return response.data;
}

async function verifyToken() {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  try {
    const response = await axios.get(`${FB_GRAPH_URL}/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,name',
      },
    });
    logger.info('Facebook token verified', { name: response.data.name });
    return { valid: true, data: response.data };
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    logger.error('Facebook token verification failed', {
      status: error.response?.status,
      fbMessage: fbError.message,
      fbType: fbError.type,
      fbCode: fbError.code,
      fbSubcode: fbError.error_subcode,
      tokenLength: accessToken?.length,
      tokenStart: accessToken?.substring(0, 10),
    });
    return { valid: false, error: error.message };
  }
}

module.exports = { publishPost, getPageInfo, verifyToken };
