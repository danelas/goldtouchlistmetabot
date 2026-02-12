const axios = require('axios');
const logger = require('../utils/logger');

const UNSPLASH_API_URL = 'https://api.unsplash.com';

async function searchImage(query) {
  logger.info('Searching Unsplash for image', { query });

  const response = await axios.get(`${UNSPLASH_API_URL}/search/photos`, {
    params: {
      query,
      per_page: 5,
      orientation: 'landscape',
    },
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
    },
  });

  const results = response.data.results;

  if (!results || results.length === 0) {
    logger.warn('No images found on Unsplash', { query });
    return null;
  }

  // Pick a random image from top 5 results for variety
  const randomIndex = Math.floor(Math.random() * Math.min(results.length, 5));
  const photo = results[randomIndex];

  // Trigger download event per Unsplash API guidelines
  await triggerDownload(photo.links.download_location);

  const imageData = {
    url: photo.urls.regular,
    credit: `Photo by ${photo.user.name} on Unsplash`,
    creditLink: photo.user.links.html,
    downloadUrl: photo.urls.full,
  };

  logger.info('Image found', { url: imageData.url, credit: imageData.credit });
  return imageData;
}

async function triggerDownload(downloadLocation) {
  try {
    await axios.get(downloadLocation, {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    });
  } catch (error) {
    logger.warn('Failed to trigger Unsplash download event', { error: error.message });
  }
}

module.exports = { searchImage };
