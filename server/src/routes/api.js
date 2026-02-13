const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { Post, Schedule, Log, Conversation, Message, SystemInstruction, Article, ImageAsset, CityPageTemplate, CityPage } = require('../db/models');
const { generatePostContent } = require('../services/openai');
const { publishPost, getPageInfo, verifyToken } = require('../services/facebook');
const instagram = require('../services/instagram');
const wordpress = require('../services/wordpress');
const { generateArticleQueue, CITIES, SERVICES, ARTICLE_TEMPLATES } = require('../services/articleGenerator');
const cityPageGenerator = require('../services/cityPageGenerator');
const scheduler = require('../scheduler');

// ============ POSTS ============

// Get all posts (paginated)
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Post.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      posts: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    logger.error('Failed to fetch posts', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger a post
router.post('/posts/generate', async (req, res) => {
  try {
    const schedules = await Schedule.findAll({ where: { isActive: true } });
    const schedule = schedules[0];

    if (!schedule) {
      return res.status(400).json({ error: 'No active schedule found. Create one first.' });
    }

    const post = await scheduler.executePost(schedule);
    res.json({ success: true, post });
  } catch (error) {
    logger.error('Manual post generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Preview a post (generate without publishing)
router.post('/posts/preview', async (req, res) => {
  try {
    const { niche, tone, language, includeHashtags, includeEmojis, includeImage, customPrompt } = req.body;

    const { content, promptUsed } = await generatePostContent({
      niche: niche || 'marketing',
      tone: tone || 'professional',
      language: language || 'en',
      includeHashtags: includeHashtags !== false,
      includeEmojis: includeEmojis !== false,
      customPrompt,
    });

    let imageData = null;
    if (includeImage !== false) {
      const query = await generateImageQuery({ content, niche: niche || 'marketing' });
      imageData = await searchImage(query);
    }

    res.json({
      content,
      promptUsed,
      image: imageData,
    });
  } catch (error) {
    logger.error('Preview generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ SCHEDULES ============

// Get all schedules
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.findAll({ order: [['createdAt', 'DESC']] });
    res.json(schedules);
  } catch (error) {
    logger.error('Failed to fetch schedules', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create a schedule
router.post('/schedules', async (req, res) => {
  try {
    const schedule = await Schedule.create(req.body);
    scheduler.reload();
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to create schedule', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update a schedule
router.put('/schedules/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    await schedule.update(req.body);
    scheduler.reload();
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to update schedule', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete a schedule
router.delete('/schedules/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    await schedule.destroy();
    scheduler.reload();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete schedule', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ LOGS ============

// Get activity logs
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await Log.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      logs: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    logger.error('Failed to fetch logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATS ============

router.get('/stats', async (req, res) => {
  try {
    const totalPosts = await Post.count();
    const publishedPosts = await Post.count({ where: { status: 'published' } });
    const failedPosts = await Post.count({ where: { status: 'failed' } });
    const activeSchedules = await Schedule.count({ where: { isActive: true } });

    let pageInfo = null;
    try {
      pageInfo = await getPageInfo();
    } catch (e) {
      logger.warn('Could not fetch Facebook page info', { error: e.message });
    }

    res.json({
      totalPosts,
      publishedPosts,
      failedPosts,
      activeSchedules,
      facebookPage: pageInfo,
    });
  } catch (error) {
    logger.error('Failed to fetch stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ CONVERSATIONS ============

// Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const platform = req.query.platform; // optional filter

    const where = platform ? { platform } : {};

    const { count, rows } = await Conversation.findAndCountAll({
      where,
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      conversations: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    logger.error('Failed to fetch conversations', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { conversationId: req.params.id },
      order: [['createdAt', 'ASC']],
      limit: 100,
    });
    res.json(messages);
  } catch (error) {
    logger.error('Failed to fetch messages', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ SYSTEM INSTRUCTIONS ============

// Get all system instructions
router.get('/instructions', async (req, res) => {
  try {
    const instructions = await SystemInstruction.findAll({ order: [['createdAt', 'DESC']] });
    res.json(instructions);
  } catch (error) {
    logger.error('Failed to fetch instructions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create a system instruction
router.post('/instructions', async (req, res) => {
  try {
    const { name, platform, instructions } = req.body;
    if (!name || !instructions) {
      return res.status(400).json({ error: 'Name and instructions are required' });
    }
    const instruction = await SystemInstruction.create({
      name,
      platform: platform || 'all',
      instructions,
    });
    res.json(instruction);
  } catch (error) {
    logger.error('Failed to create instruction', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update a system instruction
router.put('/instructions/:id', async (req, res) => {
  try {
    const instruction = await SystemInstruction.findByPk(req.params.id);
    if (!instruction) return res.status(404).json({ error: 'Instruction not found' });

    await instruction.update(req.body);
    res.json(instruction);
  } catch (error) {
    logger.error('Failed to update instruction', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete a system instruction
router.delete('/instructions/:id', async (req, res) => {
  try {
    const instruction = await SystemInstruction.findByPk(req.params.id);
    if (!instruction) return res.status(404).json({ error: 'Instruction not found' });

    await instruction.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete instruction', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ ARTICLES (WordPress) ============

// Get all articles (paginated)
router.get('/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const where = status ? { status } : {};

    const { count, rows } = await Article.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      articles: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    logger.error('Failed to fetch articles', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get article queue info
router.get('/articles/queue', async (req, res) => {
  try {
    const publishedArticles = await Article.findAll({
      where: { status: 'published' },
      attributes: ['title'],
    });
    const publishedTitles = publishedArticles.map((a) => a.title);
    const fullQueue = generateArticleQueue();
    const remaining = fullQueue.filter((item) => !publishedTitles.includes(item.title));

    res.json({
      totalInQueue: fullQueue.length,
      published: publishedTitles.length,
      remaining: remaining.length,
      nextArticle: remaining[0] || null,
      cities: CITIES.map((c) => ({ name: c.name, state: c.state, slug: c.slug })),
      services: SERVICES.map((s) => ({ name: s.name, slug: s.slug, categoryId: s.categoryId })),
      templates: ARTICLE_TEMPLATES.map((t) => ({ type: t.type, titleTemplate: t.titleTemplate })),
    });
  } catch (error) {
    logger.error('Failed to fetch article queue', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger article generation and publish
router.post('/articles/generate', async (req, res) => {
  try {
    const article = await scheduler.executeArticlePost();
    if (!article) {
      return res.json({ success: true, message: 'All articles have been published. Queue is empty.' });
    }
    res.json({ success: true, article });
  } catch (error) {
    logger.error('Manual article generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get single article
router.get('/articles/:id', async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (error) {
    logger.error('Failed to fetch article', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete an article
router.delete('/articles/:id', async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    await article.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete article', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ TOKEN UTILITY ============

// Fetch Page Access Token from current User token
router.get('/facebook/page-token', async (req, res) => {
  try {
    const userToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!userToken) {
      return res.status(400).json({ error: 'FB_PAGE_ACCESS_TOKEN not set' });
    }

    const response = await require('axios').get('https://graph.facebook.com/v21.0/me/accounts', {
      params: { access_token: userToken },
    });

    const pages = response.data.data || [];
    if (pages.length === 0) {
      return res.json({ error: 'No pages found. Make sure your token has pages_manage_posts permission.' });
    }

    res.json({
      message: 'Copy the access_token for your page and set it as FB_PAGE_ACCESS_TOKEN on Render.',
      pages: pages.map((p) => ({
        name: p.name,
        id: p.id,
        access_token: p.access_token,
      })),
    });
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    res.status(500).json({
      error: 'Failed to fetch page token',
      fbMessage: fbError.message || error.message,
    });
  }
});

// Debug current token - shows type, permissions, expiry
router.get('/facebook/debug-token', async (req, res) => {
  try {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'FB_PAGE_ACCESS_TOKEN not set' });
    }

    const axios = require('axios');

    // Use the token to debug itself
    const response = await axios.get('https://graph.facebook.com/v21.0/debug_token', {
      params: { input_token: token, access_token: token },
    });

    const data = response.data.data || {};
    res.json({
      tokenType: data.type,
      appId: data.app_id,
      userId: data.user_id,
      profileId: data.profile_id,
      isValid: data.is_valid,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : 'never',
      scopes: data.scopes,
      granularScopes: data.granular_scopes,
      note: data.type === 'PAGE' 
        ? 'Token is a Page token. Check if pages_manage_posts is in scopes.' 
        : 'Token is NOT a Page token. You need a Page Access Token, not a User token.',
    });
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    res.status(500).json({
      error: 'Failed to debug token',
      fbMessage: fbError.message || error.message,
    });
  }
});

// ============ IMAGE ASSETS (for Instagram) ============

// List all images
router.get('/images', async (req, res) => {
  try {
    const { used } = req.query;
    const where = {};
    if (used === 'true') where.used = true;
    if (used === 'false') where.used = false;

    const images = await ImageAsset.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    res.json(images);
  } catch (error) {
    logger.error('Failed to fetch images', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Add image(s) by URL
router.post('/images', async (req, res) => {
  try {
    const { url, urls, caption, category } = req.body;

    // Support single or batch
    const imageUrls = urls || (url ? [url] : []);
    if (imageUrls.length === 0) {
      return res.status(400).json({ error: 'url or urls[] is required' });
    }

    const created = [];
    for (const imgUrl of imageUrls) {
      const image = await ImageAsset.create({
        url: imgUrl.trim(),
        caption: caption || null,
        category: category || null,
      });
      created.push(image);
    }

    res.json({ created: created.length, images: created });
  } catch (error) {
    logger.error('Failed to add image', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete an image
router.delete('/images/:id', async (req, res) => {
  try {
    const image = await ImageAsset.findByPk(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });
    await image.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete image', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get image stats
router.get('/images/stats', async (req, res) => {
  try {
    const total = await ImageAsset.count();
    const unused = await ImageAsset.count({ where: { used: false } });
    const used = await ImageAsset.count({ where: { used: true } });
    res.json({ total, unused, used });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ INSTAGRAM ============

// Verify Instagram connection
router.get('/instagram/status', async (req, res) => {
  try {
    const igStatus = await instagram.verifyConnection();
    res.json(igStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Instagram post (pick next unused image, generate caption)
router.post('/instagram/post', async (req, res) => {
  try {
    // Get next unused image
    const image = await ImageAsset.findOne({
      where: { used: false },
      order: [['createdAt', 'ASC']],
    });

    if (!image) {
      return res.status(400).json({ error: 'No unused images available. Add more images first.' });
    }

    // Generate caption
    const category = image.category || 'services';
    const { content } = await generatePostContent({
      niche: category,
      tone: 'professional',
      language: 'en',
      includeHashtags: false,
      includeEmojis: false,
    });

    // Publish to Instagram
    const { instagramPostId } = await instagram.publishPost({
      imageUrl: image.url,
      caption: content,
    });

    // Mark image as used
    await image.update({
      used: true,
      usedAt: new Date(),
      instagramPostId,
      caption: content,
    });

    await Log.create({
      action: 'instagram_post',
      status: 'success',
      message: `Instagram post published (${category})`,
      metadata: { imageId: image.id, instagramPostId },
    });

    res.json({ success: true, instagramPostId, imageId: image.id, caption: content });
  } catch (error) {
    logger.error('Manual Instagram post failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Debug Instagram connection in detail
router.get('/instagram/debug', async (req, res) => {
  const results = {};

  // Check env vars
  results.envVars = {
    FB_PAGE_ACCESS_TOKEN: process.env.FB_PAGE_ACCESS_TOKEN ? `set (${process.env.FB_PAGE_ACCESS_TOKEN.length} chars)` : 'NOT SET',
    FB_PAGE_ID: process.env.FB_PAGE_ID || 'NOT SET',
    IG_ACCOUNT_ID: process.env.IG_ACCOUNT_ID || 'NOT SET (will auto-discover)',
  };

  // Try to get IG account from FB Page
  try {
    const axios = require('axios');
    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.FB_PAGE_ACCESS_TOKEN;

    const pageRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: { fields: 'instagram_business_account,name', access_token: token },
    });
    results.facebookPage = { name: pageRes.data.name, id: pageId };
    results.instagramBusinessAccount = pageRes.data.instagram_business_account || 'NOT LINKED - Go to Facebook Page Settings > Linked Accounts > Instagram';

    if (pageRes.data.instagram_business_account?.id) {
      const igId = pageRes.data.instagram_business_account.id;
      const igRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}`, {
        params: { fields: 'username,name,profile_picture_url,followers_count', access_token: token },
      });
      results.instagramAccount = igRes.data;
    }
  } catch (error) {
    const fbError = error.response?.data?.error || {};
    results.error = {
      message: fbError.message || error.message,
      type: fbError.type,
      code: fbError.code,
      subcode: fbError.error_subcode,
    };
  }

  res.json(results);
});

// ============ STATUS CHECK ============

router.get('/status', async (req, res) => {
  try {
    const fbStatus = await verifyToken();
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    const hasWebhook = !!process.env.WEBHOOK_VERIFY_TOKEN;

    let wpStatus = { configured: false };
    try {
      wpStatus = await wordpress.verifyConnection();
    } catch (e) {
      wpStatus = { valid: false, error: e.message };
    }

    let igStatus = { configured: false, valid: false };
    try {
      igStatus = await instagram.verifyConnection();
      logger.info('Instagram status check result', igStatus);
    } catch (e) {
      logger.error('Instagram status check failed', { error: e.message, stack: e.stack });
      igStatus = { valid: false, error: e.message };
    }

    let unusedImages = 0;
    try {
      unusedImages = await ImageAsset.count({ where: { used: false } });
    } catch (e) {
      logger.error('ImageAsset count failed', { error: e.message });
    }

    res.json({
      facebook: fbStatus,
      openai: { configured: hasOpenAI },
      messenger: { configured: fbStatus.valid && hasWebhook },
      instagram: { ...igStatus, imagesAvailable: unusedImages },
      wordpress: wpStatus,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CITY PAGE TEMPLATES ============

// Seed all built-in Elementor templates from server/templates/ directory
const TEMPLATE_DEFINITIONS = [
  { file: 'cleaning.json', service: 'Cleaning', serviceSlug: 'cleaning', name: 'Cleaning Services City Page' },
  { file: 'beauty.json', service: 'Beauty', serviceSlug: 'beauty', name: 'Beauty Services City Page' },
  { file: 'massage.json', service: 'Massage', serviceSlug: 'massage', name: 'Massage Services City Page' },
  { file: 'skincare.json', service: 'Skincare', serviceSlug: 'skincare', name: 'Skincare Services City Page' },
  { file: 'wellness.json', service: 'Wellness', serviceSlug: 'wellness', name: 'Wellness Services City Page' },
];

// Reusable function to seed templates from disk
async function seedTemplatesIfNeeded() {
  const templatesDir = path.join(__dirname, '../../templates');
  const results = [];

  for (const def of TEMPLATE_DEFINITIONS) {
    const existing = await CityPageTemplate.findOne({ where: { serviceSlug: def.serviceSlug } });
    if (existing) {
      results.push({ service: def.service, status: 'already_exists', id: existing.id });
      continue;
    }

    const filePath = path.join(templatesDir, def.file);
    if (!fs.existsSync(filePath)) {
      results.push({ service: def.service, status: 'file_not_found', file: def.file });
      continue;
    }

    const rawJson = fs.readFileSync(filePath, 'utf-8');

    const template = await CityPageTemplate.create({
      service: def.service,
      serviceSlug: def.serviceSlug,
      name: def.name,
      templateType: 'elementor',
      elementorJson: rawJson,
      htmlTemplate: null,
      titleTemplate: '{service} Services in {city}, {state_abbr}',
      slugTemplate: '{service_slug}-{city_slug}-{state_abbr_lower}',
    });

    results.push({ service: def.service, status: 'created', id: template.id });
  }

  const created = results.filter(r => r.status === 'created').length;
  if (created > 0) {
    await Log.create({
      action: 'city_templates_seeded',
      status: 'success',
      message: `Seeded ${created} city page templates`,
      metadata: { results },
    });
    logger.info(`Auto-seeded ${created} city page templates`);
  }

  return results;
}

router.post('/city-templates/seed', async (req, res) => {
  try {
    const results = await seedTemplatesIfNeeded();
    res.json({ results });
  } catch (error) {
    logger.error('Failed to seed city templates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Force-reseed: reload all templates from disk, overwriting DB copies
// Use after editing template JSON files to update future page generations
const forceReseedHandler = async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, '../../templates');
    const results = [];

    for (const def of TEMPLATE_DEFINITIONS) {
      const filePath = path.join(templatesDir, def.file);
      if (!fs.existsSync(filePath)) {
        results.push({ service: def.service, status: 'file_not_found', file: def.file });
        continue;
      }

      const rawJson = fs.readFileSync(filePath, 'utf-8');
      const existing = await CityPageTemplate.findOne({ where: { serviceSlug: def.serviceSlug } });

      if (existing) {
        await existing.update({ elementorJson: rawJson, name: def.name });
        results.push({ service: def.service, status: 'updated', id: existing.id });
      } else {
        const template = await CityPageTemplate.create({
          service: def.service,
          serviceSlug: def.serviceSlug,
          name: def.name,
          templateType: 'elementor',
          elementorJson: rawJson,
          htmlTemplate: null,
          titleTemplate: '{service} Services in {city}, {state_abbr}',
          slugTemplate: '{service_slug}-{city_slug}-{state_abbr_lower}',
        });
        results.push({ service: def.service, status: 'created', id: template.id });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const created = results.filter(r => r.status === 'created').length;

    await Log.create({
      action: 'city_templates_reseeded',
      status: 'success',
      message: `Force-reseeded templates: ${updated} updated, ${created} created`,
      metadata: { results },
    });

    logger.info(`Force-reseeded templates: ${updated} updated, ${created} created`);
    res.json({ updated, created, results });
  } catch (error) {
    logger.error('Failed to force-reseed city templates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};
router.get('/city-templates/reseed', forceReseedHandler);
router.post('/city-templates/reseed', forceReseedHandler);

// List all templates
router.get('/city-templates', async (req, res) => {
  try {
    const templates = await CityPageTemplate.findAll({
      order: [['createdAt', 'DESC']],
      include: [{ model: CityPage, as: 'pages', attributes: ['id', 'city', 'state', 'status', 'slug', 'wpLink'] }],
    });
    res.json(templates);
  } catch (error) {
    logger.error('Failed to fetch city templates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get single template
router.get('/city-templates/:id', async (req, res) => {
  try {
    const template = await CityPageTemplate.findByPk(req.params.id, {
      include: [{ model: CityPage, as: 'pages' }],
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error) {
    logger.error('Failed to fetch city template', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Upload a new template (Elementor JSON or HTML)
// Body: { service, serviceSlug, name, elementorJson OR htmlTemplate, titleTemplate?, slugTemplate? }
router.post('/city-templates', async (req, res) => {
  try {
    const { service, serviceSlug, name, elementorJson, htmlTemplate, titleTemplate, slugTemplate } = req.body;

    if (!service || !serviceSlug || !name) {
      return res.status(400).json({
        error: 'Required fields: service, serviceSlug, name, and either elementorJson or htmlTemplate',
        placeholders: '{city}, {city_slug}, {state}, {state_abbr}, {state_abbr_lower}, {service}, {service_slug}, {service_lower}, {city_state}, {city_state_abbr}, {listing_url}, {provider_url}, {site_url}',
        example: 'For Elementor: paste the exported JSON as elementorJson. Replace city-specific text with {city}, state with {state_abbr}, etc.',
      });
    }

    if (!elementorJson && !htmlTemplate) {
      return res.status(400).json({ error: 'Either elementorJson or htmlTemplate is required' });
    }

    // If elementorJson is an object/array, stringify it for storage
    const elementorStr = elementorJson
      ? (typeof elementorJson === 'string' ? elementorJson : JSON.stringify(elementorJson))
      : null;

    const templateType = elementorStr ? 'elementor' : 'html';

    const template = await CityPageTemplate.create({
      service,
      serviceSlug: serviceSlug.toLowerCase(),
      name,
      templateType,
      elementorJson: elementorStr,
      htmlTemplate: htmlTemplate || null,
      titleTemplate: titleTemplate || '{service} in {city}, {state_abbr}',
      slugTemplate: slugTemplate || '{service_slug}-{city_slug}-{state_abbr_lower}',
    });

    await Log.create({
      action: 'city_template_created',
      status: 'success',
      message: `City page template created: ${name} (${service}, ${templateType})`,
      metadata: { templateId: template.id, templateType },
    });

    res.json(template);
  } catch (error) {
    logger.error('Failed to create city template', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update a template
router.put('/city-templates/:id', async (req, res) => {
  try {
    const template = await CityPageTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    await template.update(req.body);
    res.json(template);
  } catch (error) {
    logger.error('Failed to update city template', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete a template
router.delete('/city-templates/:id', async (req, res) => {
  try {
    const template = await CityPageTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    await template.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete city template', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Preview a template — shows extracted text blocks and optionally rewrites them via GPT
// Body: { city, state, rewrite?: boolean }
router.post('/city-templates/:id/preview', async (req, res) => {
  try {
    const template = await CityPageTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const { city, state, rewrite } = req.body;
    if (!city || !state) {
      return res.status(400).json({ error: 'city and state are required. Add rewrite: true to see GPT-rewritten text.' });
    }

    const vars = cityPageGenerator.buildVars(city, state, template.service, template.serviceSlug);
    const title = cityPageGenerator.replacePlaceholders(template.titleTemplate, vars);
    const slug = cityPageGenerator.replacePlaceholders(template.slugTemplate, vars);

    const result = { title, slug, templateType: template.templateType };

    if (template.templateType === 'elementor' && template.elementorJson) {
      // Parse and extract text blocks so user can see what will be rewritten
      const elements = cityPageGenerator.parseElementorExport(template.elementorJson);
      const textBlocks = cityPageGenerator.extractTextBlocks(elements);

      result.textBlocks = textBlocks.map((b, i) => ({
        index: i,
        widgetType: b.widgetType,
        field: b.field,
        originalText: b.originalText,
      }));

      // If rewrite requested, actually call GPT to show rewritten versions
      if (rewrite) {
        const rewritten = await cityPageGenerator.rewriteTextBlocks(
          textBlocks, city, state, template.service, template.serviceSlug
        );
        result.rewrittenBlocks = rewritten;
      }
    }

    if (template.htmlTemplate) {
      result.htmlContent = cityPageGenerator.replacePlaceholders(template.htmlTemplate, vars);
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to preview city template', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============ CITY PAGES ============

// List all generated city pages
router.get('/city-pages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const service = req.query.service;
    const status = req.query.status;

    const where = {};
    if (service) where.serviceSlug = service;
    if (status) where.status = status;

    const { count, rows } = await CityPage.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{ model: CityPageTemplate, as: 'template', attributes: ['id', 'name', 'service'] }],
    });

    res.json({
      cityPages: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    logger.error('Failed to fetch city pages', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Trigger the daily city page job manually (generates all categories for the next city)
// Supports both GET (browser) and POST (API)
const runDailyHandler = async (req, res) => {
  logger.info('=== RUN-DAILY ENDPOINT HIT ===', { method: req.method });
  try {
    // Auto-seed templates if none exist
    const templateCount = await CityPageTemplate.count();
    logger.info('Template count in DB:', { templateCount });

    if (templateCount === 0) {
      logger.info('No templates found, auto-seeding before running daily job...');
      const seedResults = await seedTemplatesIfNeeded();
      const created = seedResults.filter(r => r.status === 'created').length;
      logger.info('Seed results:', { created, seedResults });
      if (created === 0) {
        return res.status(400).json({ error: 'No templates could be seeded. Check that template files exist in server/templates/' });
      }
    }

    const { executeCityPageJob } = require('../scheduler');
    const result = await executeCityPageJob();
    if (!result) {
      const activeTemplates = await CityPageTemplate.count({ where: { isActive: true } });
      if (activeTemplates === 0) {
        return res.json({ message: 'No active templates found. Seed templates first.', activeTemplates: 0 });
      }
      return res.json({ message: 'All 50 cities have been fully processed. No more cities in the queue.' });
    }
    res.json(result);
  } catch (error) {
    logger.error('Manual city page job failed', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};
router.get('/city-pages/run-daily', runDailyHandler);
router.post('/city-pages/run-daily', runDailyHandler);

// Mark cities as already done (for cities that already have WP pages created outside this system)
// GET: /api/city-pages/mark-done?city=Fort+Lauderdale&state=Florida
// POST: { cities: [{ city: "Fort Lauderdale", state: "Florida" }, ...] }
router.get('/city-pages/mark-done', async (req, res) => {
  try {
    const { city, state } = req.query;
    if (!city || !state) {
      return res.status(400).json({ error: 'city and state query params are required' });
    }

    const allTemplates = await CityPageTemplate.findAll({ where: { isActive: true } });
    const results = [];

    for (const template of allTemplates) {
      const existing = await CityPage.findOne({
        where: { city, state, templateId: template.id },
      });
      if (existing) {
        results.push({ service: template.service, status: 'already_exists' });
        continue;
      }

      const stateAbbr = cityPageGenerator.getStateAbbr(state) || state.substring(0, 2).toUpperCase();
      const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await CityPage.create({
        templateId: template.id,
        service: template.service,
        serviceSlug: template.serviceSlug,
        city,
        citySlug,
        state,
        stateAbbr,
        title: `${template.service} Services in ${city}, ${stateAbbr}`,
        slug: `${template.serviceSlug}-${citySlug}-${stateAbbr.toLowerCase()}`,
        status: 'published',
        wpPageId: null,
        wpLink: null,
        publishedAt: new Date(),
      });
      results.push({ service: template.service, status: 'marked_done' });
    }

    logger.info(`Marked city as done: ${city}, ${state}`, { results });
    res.json({ city, state, results });
  } catch (error) {
    logger.error('Failed to mark city as done', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/city-pages/mark-done', async (req, res) => {
  try {
    const { cities } = req.body;
    if (!cities || !Array.isArray(cities)) {
      return res.status(400).json({ error: 'cities array is required in body' });
    }

    const allTemplates = await CityPageTemplate.findAll({ where: { isActive: true } });
    const allResults = [];

    for (const { city, state } of cities) {
      const cityResults = [];
      for (const template of allTemplates) {
        const existing = await CityPage.findOne({
          where: { city, state, templateId: template.id },
        });
        if (existing) {
          cityResults.push({ service: template.service, status: 'already_exists' });
          continue;
        }

        const stateAbbr = cityPageGenerator.getStateAbbr(state) || state.substring(0, 2).toUpperCase();
        const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        await CityPage.create({
          templateId: template.id,
          service: template.service,
          serviceSlug: template.serviceSlug,
          city,
          citySlug,
          state,
          stateAbbr,
          title: `${template.service} Services in ${city}, ${stateAbbr}`,
          slug: `${template.serviceSlug}-${citySlug}-${stateAbbr.toLowerCase()}`,
          status: 'published',
          wpPageId: null,
          wpLink: null,
          publishedAt: new Date(),
        });
        cityResults.push({ service: template.service, status: 'marked_done' });
      }
      allResults.push({ city, state, results: cityResults });
    }

    logger.info(`Marked ${cities.length} cities as done`);
    res.json({ marked: allResults });
  } catch (error) {
    logger.error('Failed to mark cities as done', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// See what city is next in the queue
router.get('/city-pages/next', async (req, res) => {
  try {
    const next = await cityPageGenerator.getNextCity();
    if (!next) {
      return res.json({ message: 'All cities have been fully processed', remaining: 0 });
    }

    const allTemplates = await CityPageTemplate.findAll({ where: { isActive: true } });
    const templateCount = allTemplates.length;
    let remaining = 0;
    for (const entry of cityPageGenerator.CITY_PAGE_CITIES) {
      const published = await CityPage.count({
        where: { city: entry.city, state: entry.state, status: 'published' },
      });
      if (published < templateCount) remaining++;
    }

    res.json({
      nextCity: next.city,
      nextState: next.state,
      templateCount,
      remaining,
      totalCities: cityPageGenerator.CITY_PAGE_CITIES.length,
    });
  } catch (error) {
    logger.error('Failed to get next city', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get available cities (built-in list)
router.get('/city-pages/cities', async (req, res) => {
  res.json({
    cities: CITIES.map((c) => ({
      name: c.name,
      state: c.state,
      slug: c.slug,
      stateAbbr: cityPageGenerator.getStateAbbr(c.state),
    })),
    placeholders: [
      '{city}', '{city_slug}', '{state}', '{state_abbr}', '{state_abbr_lower}',
      '{service}', '{service_slug}', '{service_lower}',
      '{city_state}', '{city_state_abbr}',
      '{listing_url}', '{provider_url}', '{site_url}',
    ],
  });
});

// Generate a single city page
router.post('/city-pages/generate', async (req, res) => {
  try {
    const { templateId, city, state, status } = req.body;

    if (!templateId || !city || !state) {
      return res.status(400).json({ error: 'templateId, city, and state are required' });
    }

    const result = await cityPageGenerator.generateCityPage({
      templateId,
      city,
      state,
      status: status || 'publish',
    });

    res.json(result);
  } catch (error) {
    logger.error('City page generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Batch generate city pages for multiple cities
router.post('/city-pages/batch', async (req, res) => {
  try {
    const { templateId, cities, status } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    const cityList = cities || CITIES.map((c) => ({ city: c.name, state: c.state }));

    const result = await cityPageGenerator.batchGenerateCityPages({
      templateId,
      cities: cityList,
      status: status || 'publish',
    });

    res.json(result);
  } catch (error) {
    logger.error('Batch city page generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete a city page record (MUST be last — :id is a catch-all param)
router.delete('/city-pages/:id', async (req, res) => {
  try {
    const cityPage = await CityPage.findByPk(req.params.id);
    if (!cityPage) return res.status(404).json({ error: 'City page not found' });
    await cityPage.destroy();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete city page', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
