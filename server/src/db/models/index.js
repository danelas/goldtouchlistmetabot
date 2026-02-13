const { Sequelize } = require('sequelize');
const logger = require('../../utils/logger');

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is not set!');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: { require: true, rejectUnauthorized: false }
  } : {},
});

// Post model - stores all generated and published posts
const Post = sequelize.define('Post', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  content: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  imageUrl: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  imageCredit: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unsplashQuery: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  facebookPostId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  status: {
    type: Sequelize.ENUM('draft', 'published', 'failed'),
    defaultValue: 'draft',
  },
  publishedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  errorMessage: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  promptUsed: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

// Schedule model - stores posting schedules
const Schedule = sequelize.define('Schedule', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  cronExpression: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '0 10 * * *',
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
  niche: {
    type: Sequelize.STRING,
    defaultValue: 'marketing',
  },
  tone: {
    type: Sequelize.STRING,
    defaultValue: 'professional',
  },
  language: {
    type: Sequelize.STRING,
    defaultValue: 'en',
  },
  includeImage: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
  includeHashtags: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
  includeEmojis: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
  customPrompt: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

// Log model - stores activity logs
const Log = sequelize.define('Log', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  action: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  status: {
    type: Sequelize.ENUM('success', 'error', 'info'),
    defaultValue: 'info',
  },
  message: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  metadata: {
    type: Sequelize.JSONB,
    allowNull: true,
  },
});

// Conversation model - tracks Messenger & Instagram conversations
const Conversation = sequelize.define('Conversation', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  platform: {
    type: Sequelize.ENUM('messenger', 'instagram', 'instagram_comment', 'facebook_comment'),
    allowNull: false,
  },
  senderId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  senderName: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  lastMessageAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  messageCount: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
  },
});

// Message model - individual messages in a conversation
const Message = sequelize.define('Message', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  conversationId: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  role: {
    type: Sequelize.ENUM('user', 'assistant'),
    allowNull: false,
  },
  content: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  platform: {
    type: Sequelize.ENUM('messenger', 'instagram', 'instagram_comment', 'facebook_comment'),
    allowNull: false,
  },
  senderId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  metadata: {
    type: Sequelize.JSONB,
    allowNull: true,
  },
});

// SystemInstruction model - user-defined system prompts for chat
const SystemInstruction = sequelize.define('SystemInstruction', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  platform: {
    type: Sequelize.ENUM('messenger', 'instagram', 'instagram_comment', 'facebook_comment', 'facebook', 'all'),
    defaultValue: 'all',
  },
  instructions: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
});

// Article model - WordPress blog articles
const Article = sequelize.define('Article', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  content: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  city: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  state: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  service: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  categoryId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  templateType: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  listingUrl: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  wpPostId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  wpLink: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  status: {
    type: Sequelize.ENUM('queued', 'generating', 'generated', 'publishing', 'published', 'failed'),
    defaultValue: 'queued',
  },
  scheduledFor: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  publishedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  errorMessage: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

// ImageAsset model - uploaded images for Instagram posts
const ImageAsset = sequelize.define('ImageAsset', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  url: {
    type: Sequelize.STRING(1024),
    allowNull: false,
  },
  caption: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  category: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  used: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  usedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  instagramPostId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
});

// CityPageTemplate model - stores Elementor JSON or HTML templates per service category
const CityPageTemplate = sequelize.define('CityPageTemplate', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  service: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  serviceSlug: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  templateType: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'elementor',
  },
  elementorJson: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  htmlTemplate: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  titleTemplate: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{service} in {city}, {state_abbr}',
  },
  slugTemplate: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{service_slug}-{city_slug}-{state_abbr_lower}',
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
});

// CityPage model - tracks generated WordPress pages per city+service
const CityPage = sequelize.define('CityPage', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  templateId: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  service: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  serviceSlug: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  city: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  citySlug: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  state: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  stateAbbr: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  slug: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  wpPageId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  wpLink: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  status: {
    type: Sequelize.ENUM('pending', 'published', 'failed'),
    defaultValue: 'pending',
  },
  publishedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  errorMessage: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

// Relationships
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });
CityPageTemplate.hasMany(CityPage, { foreignKey: 'templateId', as: 'pages' });
CityPage.belongsTo(CityPageTemplate, { foreignKey: 'templateId', as: 'template' });

module.exports = { sequelize, Post, Schedule, Log, Conversation, Message, SystemInstruction, Article, ImageAsset, CityPageTemplate, CityPage };
