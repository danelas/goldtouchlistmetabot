const axios = require('axios');

const token = process.argv[2];
const pageId = process.argv[3] || '61577586001759'; // Gold Touch List page ID

if (!token) { console.error('Usage: node get-page-token-direct.js <USER_TOKEN> [PAGE_ID]'); process.exit(1); }

async function run() {
  try {
    // Try getting page token directly by page ID
    console.log(`\nFetching page token for page ID: ${pageId}...`);
    const res = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: { fields: 'access_token,name', access_token: token },
    });

    if (res.data.access_token) {
      console.log(`\nPage: ${res.data.name}`);
      console.log(`\nPAGE ACCESS TOKEN:\n`);
      console.log(res.data.access_token);
      console.log(`\nSet this as FB_PAGE_ACCESS_TOKEN on Render.\n`);
    } else {
      console.log('No access_token returned. You may not be an admin of this page.');
    }
  } catch (error) {
    const fb = error.response?.data?.error || {};
    console.error('\nError:', fb.message || error.message);
    
    if (fb.code === 190) {
      console.error('Token is invalid or expired.');
    } else if (fb.code === 200) {
      console.error('You do not have permission for this page. Make sure you are a Page admin.');
    }
  }
}

run();
