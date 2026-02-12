/**
 * Local OAuth server to get a Facebook Page Access Token with correct permissions.
 * 
 * Usage: node get-token-server.js <APP_ID> <APP_SECRET>
 * Then visit http://localhost:3999 in your browser.
 */

const http = require('http');
const axios = require('axios');

const APP_ID = process.argv[2];
const APP_SECRET = process.argv[3];
const REDIRECT_URI = 'http://localhost:3999/callback';
const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const PERMISSIONS = 'pages_manage_posts,pages_show_list,pages_read_engagement,pages_read_user_content';

if (!APP_ID || !APP_SECRET) {
  console.error('\nUsage: node get-token-server.js <APP_ID> <APP_SECRET>\n');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3999');

  if (url.pathname === '/') {
    // Step 1: Redirect to Facebook OAuth
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${PERMISSIONS}&response_type=code`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;">
        <h2>Facebook Page Token Generator</h2>
        <p>Click below to authorize. <strong>Make sure to:</strong></p>
        <ol>
          <li>Select your <strong>Gold Touch List</strong> page when asked</li>
          <li>Grant <strong>all permissions</strong> requested</li>
        </ol>
        <a href="${authUrl}" style="display:inline-block;background:#1877F2;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          Connect with Facebook
        </a>
      </body></html>
    `);
  } else if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error || !code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>Error</h2><p>${error || 'No code received'}</p></body></html>`);
      return;
    }

    try {
      // Step 2: Exchange code for short-lived User token
      console.log('\n[Step 1] Exchanging code for User token...');
      const tokenRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
        params: {
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: REDIRECT_URI,
          code: code,
        },
      });
      const shortToken = tokenRes.data.access_token;
      console.log('  Short-lived User token obtained.');

      // Step 3: Exchange for long-lived User token
      console.log('[Step 2] Exchanging for long-lived User token...');
      const llRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: APP_ID,
          client_secret: APP_SECRET,
          fb_exchange_token: shortToken,
        },
      });
      const longToken = llRes.data.access_token;
      console.log('  Long-lived User token obtained.');

      // Step 4: Debug to confirm permissions
      const debugRes = await axios.get(`${GRAPH_URL}/debug_token`, {
        params: { input_token: longToken, access_token: longToken },
      });
      const debugData = debugRes.data.data;
      console.log('  Scopes:', debugData.scopes?.join(', '));

      // Step 5: Get Page tokens
      console.log('[Step 3] Fetching Page tokens...');
      const pagesRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
        params: { access_token: longToken },
      });
      const pages = pagesRes.data.data || [];

      if (pages.length === 0) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;">
            <h2 style="color:red;">No Pages Found</h2>
            <p>Your token has these scopes: <code>${debugData.scopes?.join(', ')}</code></p>
            <p>But no pages were returned. You may not have selected a page during authorization.</p>
            <p><a href="/">Try again</a> — make sure to select Gold Touch List when Facebook asks which pages to use.</p>
          </body></html>
        `);
        return;
      }

      // Success!
      let html = `
        <html><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;">
          <h2 style="color:green;">Success! Page Token(s) Generated</h2>
          <p>Scopes: <code>${debugData.scopes?.join(', ')}</code></p>
          <p>These tokens are <strong>long-lived (non-expiring)</strong>. Copy the one for your page and set it as <code>FB_PAGE_ACCESS_TOKEN</code> on Render.</p>
      `;

      for (const page of pages) {
        console.log(`\n  Page: ${page.name} (ID: ${page.id})`);
        console.log(`  TOKEN: ${page.access_token}`);
        html += `
          <div style="background:#f0f0f0;padding:16px;border-radius:8px;margin:16px 0;">
            <h3>${page.name} (ID: ${page.id})</h3>
            <p>Page Access Token:</p>
            <textarea readonly onclick="this.select()" style="width:100%;height:80px;font-family:monospace;font-size:12px;padding:8px;">${page.access_token}</textarea>
            <br><br>
            <button onclick="navigator.clipboard.writeText('${page.access_token}');this.textContent='Copied!'" style="background:#BE8A4D;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;">
              Copy Token
            </button>
          </div>
        `;
      }

      html += `<p style="margin-top:24px;color:#666;">You can close this page and stop the server (Ctrl+C in terminal).</p></body></html>`;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);

    } catch (err) {
      const fb = err.response?.data?.error || {};
      console.error('Error:', fb.message || err.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>Error</h2><p>${fb.message || err.message}</p></body></html>`);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3999, () => {
  console.log('\n===========================================');
  console.log('  Open http://localhost:3999 in your browser');
  console.log('===========================================\n');
});
