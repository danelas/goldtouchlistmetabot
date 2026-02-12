const axios = require('axios');

const token = process.argv[2];
if (!token) { console.error('Usage: node debug-token.js <TOKEN>'); process.exit(1); }

async function run() {
  try {
    // Check token info
    console.log('\n[1] Token debug info:');
    const debug = await axios.get('https://graph.facebook.com/v21.0/debug_token', {
      params: { input_token: token, access_token: token },
    });
    const d = debug.data.data;
    console.log('  Type:', d.type);
    console.log('  Valid:', d.is_valid);
    console.log('  Scopes:', d.scopes?.join(', '));
    console.log('  Expires:', d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never');

    // Check /me
    console.log('\n[2] Token identity (/me):');
    const me = await axios.get('https://graph.facebook.com/v21.0/me', {
      params: { access_token: token, fields: 'id,name' },
    });
    console.log('  ID:', me.data.id);
    console.log('  Name:', me.data.name);

    // Check pages
    console.log('\n[3] Pages (/me/accounts):');
    const pages = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
      params: { access_token: token },
    });
    if (pages.data.data.length === 0) {
      console.log('  NO PAGES FOUND.');
      console.log('  This means the token was NOT authorized for any page.');
      console.log('  When generating the token, Facebook asks "What pages do you want to use?"');
      console.log('  You MUST select your Gold Touch List page there.');
    } else {
      pages.data.data.forEach((p) => {
        console.log(`  Page: ${p.name} (ID: ${p.id})`);
        console.log(`  Tasks: ${p.tasks?.join(', ')}`);
      });
    }
  } catch (error) {
    const fb = error.response?.data?.error || {};
    console.error('Error:', fb.message || error.message);
  }
}

run();
