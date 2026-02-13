const cron = require('node-cron');
const logger = require('../utils/logger');
const { Post, Schedule, Log, Article, ImageAsset } = require('../db/models');
const { generatePostContent } = require('../services/openai');
const { publishPost } = require('../services/facebook');
const instagram = require('../services/instagram');
const { generateArticle, getNextArticle, findTemplate, findService, findCity } = require('../services/articleGenerator');
const wordpress = require('../services/wordpress');
const cityPageGenerator = require('../services/cityPageGenerator');

// Categories to rotate through for posts
const POST_CATEGORIES = ['cleaning', 'massage', 'wellness', 'beauty', 'skincare'];
let fbPostIndex = 0;

let activeJobs = [];

async function executePost(schedule) {
  const startTime = Date.now();

  // Rotate category
  const category = POST_CATEGORIES[fbPostIndex % POST_CATEGORIES.length];
  fbPostIndex++;

  logger.info('Starting automated post execution', { scheduleId: schedule?.id || 'scheduled', category });

  try {
    // Generate content using the rotated category as niche
    const { content, promptUsed } = await generatePostContent({
      niche: category,
      tone: schedule?.tone || 'professional',
      language: schedule?.language || 'en',
      includeHashtags: false,
      includeEmojis: false,
      customPrompt: schedule?.customPrompt || null,
    });

    // Publish text-only to Facebook (no images)
    const { facebookPostId } = await publishPost({ content });

    // Save post record
    const post = await Post.create({
      content,
      facebookPostId,
      status: 'published',
      publishedAt: new Date(),
      promptUsed,
    });

    const duration = Date.now() - startTime;
    await Log.create({
      action: 'auto_post',
      status: 'success',
      message: `Post published (${category}) in ${duration}ms`,
      metadata: { postId: post.id, facebookPostId, category },
    });

    logger.info('Automated post completed successfully', {
      postId: post.id,
      facebookPostId,
      category,
      duration: `${duration}ms`,
    });

    return post;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Automated post failed', { error: error.message, category, duration: `${duration}ms` });

    await Post.create({
      content: 'Failed to generate',
      status: 'failed',
      errorMessage: error.message,
    });

    await Log.create({
      action: 'auto_post',
      status: 'error',
      message: error.message,
      metadata: { category },
    });

    throw error;
  }
}

// ============ INSTAGRAM POSTING ============

async function executeInstagramPost() {
  const startTime = Date.now();

  try {
    // Get next unused image
    const image = await ImageAsset.findOne({
      where: { used: false },
      order: [['createdAt', 'ASC']],
    });

    if (!image) {
      logger.info('No unused images for Instagram. Skipping.');
      await Log.create({
        action: 'instagram_post',
        status: 'info',
        message: 'No unused images available. Add more images to continue posting.',
      });
      return null;
    }

    // Rotate category for caption generation
    const category = image.category || POST_CATEGORIES[fbPostIndex % POST_CATEGORIES.length];

    // Generate caption
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

    const duration = Date.now() - startTime;
    await Log.create({
      action: 'instagram_post',
      status: 'success',
      message: `Instagram post published (${category}) in ${duration}ms`,
      metadata: { imageId: image.id, instagramPostId, category },
    });

    logger.info('Instagram post completed', {
      instagramPostId,
      category,
      imageId: image.id,
      duration: `${duration}ms`,
    });

    return { instagramPostId, imageId: image.id };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Instagram post failed', { error: error.message, duration: `${duration}ms` });

    await Log.create({
      action: 'instagram_post',
      status: 'error',
      message: error.message,
    });

    throw error;
  }
}

// ============ ARTICLE SCHEDULING ============

async function executeArticlePost() {
  const startTime = Date.now();
  logger.info('Starting automated article generation');

  try {
    // Get all published article titles to avoid duplicates
    const publishedArticles = await Article.findAll({
      where: { status: 'published' },
      attributes: ['title'],
    });
    const publishedTitles = publishedArticles.map((a) => a.title);

    // Get next article from queue
    const nextItem = getNextArticle(publishedTitles);
    if (!nextItem) {
      logger.info('All articles have been published. No new article to generate.');
      await Log.create({
        action: 'article_generate',
        status: 'info',
        message: 'All article combinations have been published',
      });
      return null;
    }

    const template = findTemplate(nextItem.templateType);
    const service = findService(nextItem.serviceSlug);
    const city = findCity(nextItem.citySlug);

    if (!template || !service || !city) {
      throw new Error(`Invalid article config: template=${nextItem.templateType}, service=${nextItem.serviceSlug}, city=${nextItem.citySlug}`);
    }

    // Create article record
    const article = await Article.create({
      title: nextItem.title,
      content: '',
      city: city.name,
      state: city.state,
      service: service.name,
      categoryId: service.categoryId,
      templateType: template.type,
      status: 'generating',
    });

    // Generate content with ChatGPT
    const generated = await generateArticle(template, service, city);
    await article.update({
      content: generated.content,
      listingUrl: generated.listingUrl,
      status: 'generated',
    });

    // Publish to WordPress
    await article.update({ status: 'publishing' });
    const wpResult = await wordpress.createPost({
      title: generated.title,
      content: generated.content,
      status: 'publish',
    });

    await article.update({
      wpPostId: wpResult.wpPostId,
      wpLink: wpResult.link,
      status: 'published',
      publishedAt: new Date(),
    });

    const duration = Date.now() - startTime;
    await Log.create({
      action: 'article_publish',
      status: 'success',
      message: `Article published: "${generated.title}" in ${duration}ms`,
      metadata: { articleId: article.id, wpPostId: wpResult.wpPostId, wpLink: wpResult.link },
    });

    logger.info('Article published successfully', {
      title: generated.title,
      wpPostId: wpResult.wpPostId,
      duration: `${duration}ms`,
    });

    return article;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Article generation/publish failed', { error: error.message, duration: `${duration}ms` });

    await Log.create({
      action: 'article_publish',
      status: 'error',
      message: error.message,
    });

    throw error;
  }
}

function start() {
  logger.info('Initializing scheduler...');

  // Facebook post scheduler: 1 post per day, rotating time each day
  // Day 1 = 8:00 AM ET, Day 2 = 12:00 PM ET, Day 3 = 7:00 PM ET, then repeat
  // Uses day-of-year mod 3 to determine which time slot fires today
  const fbTimeSlots = [
    { cron: '0 8 * * *', hour: 8, label: '8:00 AM ET' },
    { cron: '0 12 * * *', hour: 12, label: '12:00 PM ET' },
    { cron: '0 19 * * *', hour: 19, label: '7:00 PM ET' },
  ];

  fbTimeSlots.forEach(({ cron: cronExpr, hour, label }, slotIndex) => {
    const job = cron.schedule(cronExpr, () => {
      // Calculate which slot should fire today based on day-of-year
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
      const todaysSlot = dayOfYear % 3;

      if (todaysSlot === slotIndex) {
        logger.info('Facebook post firing for today', { time: label, dayOfYear, slot: slotIndex });
        executePost().catch((err) => {
          logger.error('Scheduled FB post failed', { error: err.message, time: label });
        });
      } else {
        logger.debug('Skipping FB post slot (not today)', { time: label, todaysSlot, slotIndex });
      }
    }, {
      timezone: 'America/New_York',
    });
    activeJobs.push({ id: `fb-post-${label}`, job });
  });
  logger.info('Facebook post scheduler registered: 1 post/day rotating 8AM, 12PM, 7PM ET');

  // Instagram post scheduler: 1 post per day, rotating time (offset by 1 day from FB)
  // So if FB posts at 8AM today, IG posts at 12PM today (next slot)
  const igTimeSlots = [
    { cron: '0 9 * * *', hour: 9, label: '9:00 AM ET' },
    { cron: '0 13 * * *', hour: 13, label: '1:00 PM ET' },
    { cron: '0 20 * * *', hour: 20, label: '8:00 PM ET' },
  ];

  igTimeSlots.forEach(({ cron: cronExpr, hour, label }, slotIndex) => {
    const job = cron.schedule(cronExpr, () => {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
      const todaysSlot = dayOfYear % 3;

      if (todaysSlot === slotIndex) {
        logger.info('Instagram post firing for today', { time: label, dayOfYear, slot: slotIndex });
        executeInstagramPost().catch((err) => {
          logger.error('Scheduled IG post failed', { error: err.message, time: label });
        });
      }
    }, {
      timezone: 'America/New_York',
    });
    activeJobs.push({ id: `ig-post-${label}`, job });
  });
  logger.info('Instagram post scheduler registered: 1 post/day rotating 9AM, 1PM, 8PM ET');

  // Article scheduler: 8:00 AM Eastern every day
  const articleCron = process.env.ARTICLE_CRON_SCHEDULE || '0 8 * * *';
  const articleJob = cron.schedule(articleCron, () => {
    executeArticlePost().catch((err) => {
      logger.error('Scheduled article job failed', { error: err.message });
    });
  }, {
    timezone: 'America/New_York',
  });

  activeJobs.push({ id: 'article-scheduler', job: articleJob });
  logger.info('Article scheduler registered', { cron: articleCron, timezone: 'America/New_York' });

  // City page scheduler: 9:00 AM Eastern every day
  // Picks the next city from the list and generates all 5 category pages with GPT-rewritten content
  const cityPageCron = process.env.CITY_PAGE_CRON_SCHEDULE || '0 9 * * *';
  const cityPageJob = cron.schedule(cityPageCron, () => {
    executeCityPageJob().catch((err) => {
      logger.error('Scheduled city page job failed', { error: err.message });
    });
  }, {
    timezone: 'America/New_York',
  });

  activeJobs.push({ id: 'city-page-scheduler', job: cityPageJob });
  logger.info('City page scheduler registered', { cron: cityPageCron, timezone: 'America/New_York' });
}

function stopAll() {
  activeJobs.forEach(({ job }) => job.stop());
  activeJobs = [];
  logger.info('All cron jobs stopped');
}

function reload() {
  stopAll();
  start();
}

// ============ CITY PAGE DAILY JOB ============

async function executeCityPageJob() {
  const startTime = Date.now();
  logger.info('Starting daily city page generation');

  try {
    // Find the next city that needs pages
    const next = await cityPageGenerator.getNextCity();

    if (!next) {
      logger.info('No more cities to process. All cities have been completed.');
      await Log.create({
        action: 'city_page_daily',
        status: 'info',
        message: 'All cities in the queue have been fully processed.',
      });
      return null;
    }

    logger.info('Processing city pages for next city', { city: next.city, state: next.state });

    // Generate all 5 category pages for this city
    const result = await cityPageGenerator.generateAllCategoriesForCity(next.city, next.state);

    const duration = Date.now() - startTime;
    await Log.create({
      action: 'city_page_daily',
      status: 'success',
      message: `City pages for ${next.city}, ${next.state}: ${result.succeeded} published, ${result.skipped} skipped, ${result.failed} failed (${duration}ms)`,
      metadata: { city: next.city, state: next.state, ...result },
    });

    logger.info('Daily city page job completed', {
      city: next.city,
      state: next.state,
      succeeded: result.succeeded,
      failed: result.failed,
      duration: `${duration}ms`,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Daily city page job failed', { error: error.message, duration: `${duration}ms` });

    await Log.create({
      action: 'city_page_daily',
      status: 'error',
      message: error.message,
    });

    throw error;
  }
}

module.exports = { start, stopAll, reload, executePost, executeArticlePost, executeInstagramPost, executeCityPageJob };
