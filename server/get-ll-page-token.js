const axios = require('axios');

const userToken = process.argv[2];
const appId = process.argv[3];
const appSecret = process.argv[4];
const pageId = process.argv[5] || '700660086459178';

if (!userToken || !appId || !appSecret) {
  console.error('Usage: node get-ll-page-token.js <USER_TOKEN> <APP_ID> <APP_SECRET> [PAGE_ID]');
  process.exit(1);
}

async function run() {
  try {
    // Step 1: Exchange for long-lived User token
    console.log('\n[Step 1] Exchanging for long-lived User token...');
    const llRes = await require('axios').get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userToken,
      },
    });
    const llUserToken = llRes.data.access_token;
    console.log('  Done. Length:', llUserToken.length);

    // Step 2: Get Page token using long-lived User token + page ID
    console.log(`\n[Step 2] Fetching Page token for ${pageId}...`);
    const pageRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: { fields: 'access_token,name', access_token: llUserToken },
    });

    const pageToken = pageRes.data.access_token;
    console.log(`  Page: ${pageRes.data.name}`);

    // Step 3: Verify the page token
    console.log('\n[Step 3] Verifying Page token...');
    const debugRes = await axios.get('https://graph.facebook.com/v21.0/debug_token', {
      params: { input_token: pageToken, access_token: pageToken },
    });
    const d = debugRes.data.data;
    console.log('  Type:', d.type);
    console.log('  Valid:', d.is_valid);
    console.log('  Scopes:', d.scopes?.join(', '));
    console.log('  Expires:', d.expires_at === 0 ? 'NEVER (permanent!)' : new Date(d.expires_at * 1000).toISOString());

    console.log('\n========================================');
    console.log('LONG-LIVED PAGE ACCESS TOKEN:');
    console.log('========================================\n');
    console.log(pageToken);
    console.log('\n========================================');
    console.log('Set this as FB_PAGE_ACCESS_TOKEN on Render.');
    console.log('Also update FB_PAGE_ID to:', pageId);
    console.log('========================================\n');

  } catch (error) {
    const fb = error.response?.data?.error || {};
    console.error('Error:', fb.message || error.message);
  }
}

run();
