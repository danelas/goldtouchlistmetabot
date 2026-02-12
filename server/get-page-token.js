#!/usr/bin/env node
/**
 * Fetches a long-lived Page Access Token in 3 steps:
 * 1. Exchange short-lived User token for long-lived User token
 * 2. Get Page token from long-lived User token
 * 3. Output the long-lived Page token
 *
 * Usage:
 *   node get-page-token.js <USER_TOKEN> <APP_ID> <APP_SECRET>
 */

const axios = require('axios');

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

async function run() {
  const userToken = process.argv[2];
  const appId = process.argv[3];
  const appSecret = process.argv[4];

  if (!userToken || !appId || !appSecret) {
    console.error('\nUsage: node get-page-token.js <USER_TOKEN> <APP_ID> <APP_SECRET>\n');
    console.error('  USER_TOKEN  - Your short-lived User Access Token from Graph API Explorer');
    console.error('  APP_ID      - Your Facebook App ID (Settings > Basic)');
    console.error('  APP_SECRET  - Your Facebook App Secret (Settings > Basic)\n');
    process.exit(1);
  }

  try {
    // Step 1: Exchange for long-lived User token
    console.log('\n[Step 1] Exchanging for long-lived User token...');
    const llResponse = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userToken,
      },
    });
    const longLivedUserToken = llResponse.data.access_token;
    console.log('  Long-lived User token obtained. Length:', longLivedUserToken.length);

    // Step 2: Get Page tokens using the long-lived User token
    console.log('\n[Step 2] Fetching Page tokens...');
    const pagesResponse = await axios.get(`${GRAPH_URL}/me/accounts`, {
      params: { access_token: longLivedUserToken },
    });

    const pages = pagesResponse.data.data || [];
    if (pages.length === 0) {
      console.error('\n  No pages found! Make sure your token has pages_manage_posts and pages_show_list permissions.');
      process.exit(1);
    }

    // Step 3: Display results
    console.log(`\n  Found ${pages.length} page(s):\n`);
    console.log('='.repeat(80));

    pages.forEach((page, i) => {
      console.log(`\n  Page ${i + 1}: ${page.name}`);
      console.log(`  Page ID: ${page.id}`);
      console.log(`\n  LONG-LIVED PAGE TOKEN (copy this entire value):\n`);
      console.log(`  ${page.access_token}`);
      console.log('\n' + '='.repeat(80));
    });

    console.log('\n  Set this token as FB_PAGE_ACCESS_TOKEN on Render.');
    console.log('  This token does NOT expire.\n');

  } catch (error) {
    const fbError = error.response?.data?.error || {};
    console.error('\nError:', fbError.message || error.message);
    if (fbError.code === 190) {
      console.error('  Your User token is invalid or expired. Generate a new one in Graph API Explorer.');
    }
    process.exit(1);
  }
}

run();
