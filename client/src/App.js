import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Send, Clock, FileText, Settings, Activity,
  CheckCircle, XCircle, AlertCircle, RefreshCw, Zap, Eye,
  Calendar, Hash, Smile, Image, Globe, MessageSquare,
  MessagesSquare, BookOpen, Plus, Trash2, Save, Edit3,
  User, Bot, Instagram, Facebook, ChevronLeft,
  Newspaper, ExternalLink, MapPin, Layers
} from 'lucide-react';
import * as api from './api';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState(null);
  const [posts, setPosts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [notification, setNotification] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [convoMessages, setConvoMessages] = useState([]);
  const [articles, setArticles] = useState([]);
  const [articleQueue, setArticleQueue] = useState(null);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [images, setImages] = useState([]);
  const [imageStats, setImageStats] = useState(null);
  const [postingIG, setPostingIG] = useState(false);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, statusData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getStatus().catch(() => null),
      ]);
      if (statsData) setStats(statsData);
      if (statusData) setStatus(statusData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const data = await api.getPosts();
      setPosts(data.posts || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const data = await api.getLogs();
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadInstructions = useCallback(async () => {
    try {
      const data = await api.getInstructions();
      setInstructions(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadArticles = useCallback(async () => {
    try {
      const [articlesData, queueData] = await Promise.all([
        api.getArticles(),
        api.getArticleQueue(),
      ]);
      setArticles(articlesData.articles || []);
      setArticleQueue(queueData);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadImages = useCallback(async () => {
    try {
      const [imgs, stats] = await Promise.all([
        api.getImages(),
        api.getImageStats(),
      ]);
      setImages(imgs || []);
      setImageStats(stats);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadMessages = useCallback(async (convoId) => {
    try {
      const data = await api.getMessages(convoId);
      setConvoMessages(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'posts') loadPosts();
    if (activeTab === 'schedules') loadSchedules();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'conversations') loadConversations();
    if (activeTab === 'instructions') loadInstructions();
    if (activeTab === 'articles') loadArticles();
    if (activeTab === 'images') loadImages();
  }, [activeTab, loadPosts, loadSchedules, loadLogs, loadConversations, loadInstructions, loadArticles, loadImages]);

  const handleGeneratePost = async () => {
    setGenerating(true);
    try {
      await api.generatePost();
      showNotification('Post generated and published!');
      loadPosts();
      loadDashboard();
    } catch (e) {
      showNotification(e.response?.data?.error || 'Failed to generate post', 'error');
    }
    setGenerating(false);
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const data = await api.previewPost({});
      setPreview(data);
    } catch (e) {
      showNotification('Failed to generate preview', 'error');
    }
    setGenerating(false);
  };

  const handleToggleSchedule = async (schedule) => {
    try {
      await api.updateSchedule(schedule.id, { isActive: !schedule.isActive });
      showNotification(`Schedule ${schedule.isActive ? 'paused' : 'activated'}`);
      loadSchedules();
    } catch (e) {
      showNotification('Failed to update schedule', 'error');
    }
  };

  const handleSelectConvo = async (convo) => {
    setSelectedConvo(convo);
    await loadMessages(convo.id);
  };

  const handleCreateInstruction = async (data) => {
    try {
      await api.createInstruction(data);
      showNotification('Instruction created');
      loadInstructions();
    } catch (e) {
      showNotification('Failed to create instruction', 'error');
    }
  };

  const handleUpdateInstruction = async (id, data) => {
    try {
      await api.updateInstruction(id, data);
      showNotification('Instruction updated');
      loadInstructions();
    } catch (e) {
      showNotification('Failed to update instruction', 'error');
    }
  };

  const handleDeleteInstruction = async (id) => {
    try {
      await api.deleteInstruction(id);
      showNotification('Instruction deleted');
      loadInstructions();
    } catch (e) {
      showNotification('Failed to delete instruction', 'error');
    }
  };

  const handleAddImage = async (data) => {
    try {
      const result = await api.addImage(data);
      showNotification(`Added ${result.created} image(s)`);
      loadImages();
    } catch (e) {
      showNotification('Failed to add image', 'error');
    }
  };

  const handleDeleteImage = async (id) => {
    try {
      await api.deleteImage(id);
      showNotification('Image deleted');
      loadImages();
    } catch (e) {
      showNotification('Failed to delete image', 'error');
    }
  };

  const handlePostToInstagram = async () => {
    setPostingIG(true);
    try {
      const result = await api.postToInstagram();
      showNotification('Posted to Instagram!');
      loadImages();
    } catch (e) {
      showNotification(e.response?.data?.error || 'Failed to post to Instagram', 'error');
    }
    setPostingIG(false);
  };

  const handleGenerateArticle = async () => {
    setGeneratingArticle(true);
    try {
      const result = await api.generateArticle();
      if (result.message) {
        showNotification(result.message, 'success');
      } else {
        showNotification('Article generated and published to WordPress!');
      }
      loadArticles();
    } catch (e) {
      showNotification(e.response?.data?.error || 'Failed to generate article', 'error');
    }
    setGeneratingArticle(false);
  };

  const handleDeleteArticle = async (id) => {
    try {
      await api.deleteArticle(id);
      showNotification('Article deleted');
      setSelectedArticle(null);
      loadArticles();
    } catch (e) {
      showNotification('Failed to delete article', 'error');
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'conversations', label: 'Conversations', icon: MessagesSquare },
    { id: 'instructions', label: 'Instructions', icon: BookOpen },
    { id: 'articles', label: 'Articles', icon: Newspaper },
    { id: 'images', label: 'Images', icon: Image },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'schedules', label: 'Schedules', icon: Clock },
    { id: 'logs', label: 'Activity Log', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {notification.message}
        </div>
      )}

      <aside className="sidebar">
        <div className="logo">
          <Zap size={24} className="logo-icon" />
          <div>
            <h1>Meta Bot</h1>
            <span className="logo-subtitle">Marketing Automation</span>
          </div>
        </div>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="generate-btn" onClick={handleGeneratePost} disabled={generating}>
            <Send size={18} />
            {generating ? 'Generating...' : 'Post Now'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            status={status}
            loading={loading}
            onRefresh={loadDashboard}
            onPreview={handlePreview}
            preview={preview}
            generating={generating}
          />
        )}
        {activeTab === 'conversations' && (
          <ConversationsView
            conversations={conversations}
            selectedConvo={selectedConvo}
            messages={convoMessages}
            onSelect={handleSelectConvo}
            onBack={() => { setSelectedConvo(null); setConvoMessages([]); }}
            onRefresh={loadConversations}
          />
        )}
        {activeTab === 'instructions' && (
          <InstructionsView
            instructions={instructions}
            onCreate={handleCreateInstruction}
            onUpdate={handleUpdateInstruction}
            onDelete={handleDeleteInstruction}
            onRefresh={loadInstructions}
          />
        )}
        {activeTab === 'articles' && (
          <ArticlesView
            articles={articles}
            queue={articleQueue}
            selectedArticle={selectedArticle}
            onSelect={setSelectedArticle}
            onBack={() => setSelectedArticle(null)}
            onGenerate={handleGenerateArticle}
            onDelete={handleDeleteArticle}
            onRefresh={loadArticles}
            generating={generatingArticle}
          />
        )}
        {activeTab === 'images' && (
          <ImagesView
            images={images}
            stats={imageStats}
            onAdd={handleAddImage}
            onDelete={handleDeleteImage}
            onPostIG={handlePostToInstagram}
            onRefresh={loadImages}
            postingIG={postingIG}
          />
        )}
        {activeTab === 'posts' && <PostsView posts={posts} onRefresh={loadPosts} />}
        {activeTab === 'schedules' && (
          <SchedulesView
            schedules={schedules}
            onToggle={handleToggleSchedule}
            onRefresh={loadSchedules}
          />
        )}
        {activeTab === 'logs' && <LogsView logs={logs} onRefresh={loadLogs} />}
        {activeTab === 'settings' && <SettingsView status={status} />}
      </main>
    </div>
  );
}

function DashboardView({ stats, status, loading, onRefresh, onPreview, preview, generating }) {
  return (
    <div className="view">
      <div className="view-header">
        <h2>Dashboard</h2>
        <button className="icon-btn" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Posts" value={stats?.totalPosts || 0} icon={FileText} color="#3b82f6" />
        <StatCard title="Published" value={stats?.publishedPosts || 0} icon={CheckCircle} color="#22c55e" />
        <StatCard title="Failed" value={stats?.failedPosts || 0} icon={XCircle} color="#ef4444" />
        <StatCard title="Active Schedules" value={stats?.activeSchedules || 0} icon={Clock} color="#a855f7" />
      </div>

      <div className="cards-row">
        <div className="card">
          <h3><Globe size={16} /> Service Status</h3>
          <div className="status-list">
            <StatusItem
              label="Facebook"
              ok={status?.facebook?.valid}
              detail={status?.facebook?.valid ? 'Connected' : 'Not connected'}
            />
            <StatusItem
              label="OpenAI"
              ok={status?.openai?.configured}
              detail={status?.openai?.configured ? 'API key set' : 'Missing API key'}
            />
            <StatusItem
              label="Instagram"
              ok={status?.instagram?.valid}
              detail={status?.instagram?.valid ? `@${status.instagram.username} (${status.instagram.imagesAvailable || 0} images ready)` : 'Not connected'}
            />
            <StatusItem
              label="WordPress"
              ok={status?.wordpress?.valid}
              detail={status?.wordpress?.valid ? `Connected: ${status.wordpress.url}` : 'Not connected'}
            />
            <StatusItem
              label="Messenger"
              ok={status?.messenger?.configured}
              detail={status?.messenger?.configured ? 'Webhook active' : 'Not configured'}
            />
          </div>
        </div>

        <div className="card">
          <h3><Eye size={16} /> Quick Preview</h3>
          <p className="card-desc">Generate a preview without publishing.</p>
          <button className="preview-btn" onClick={onPreview} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Preview'}
          </button>
          {preview && (
            <div className="preview-content">
              <p>{preview.content}</p>
              {preview.image && (
                <img src={preview.image.url} alt="Preview" className="preview-img" />
              )}
            </div>
          )}
        </div>
      </div>

      {stats?.facebookPage && (
        <div className="card">
          <h3><MessageSquare size={16} /> Facebook Page</h3>
          <div className="page-info">
            <span><strong>{stats.facebookPage.name}</strong></span>
            <span>{stats.facebookPage.followers_count?.toLocaleString() || '—'} followers</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-icon" style={{ color }}>
        <Icon size={22} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
    </div>
  );
}

function StatusItem({ label, ok, detail }) {
  return (
    <div className="status-item">
      <span className="status-dot-wrapper">
        {ok === undefined ? (
          <AlertCircle size={14} className="status-unknown" />
        ) : ok ? (
          <CheckCircle size={14} className="status-ok" />
        ) : (
          <XCircle size={14} className="status-err" />
        )}
        {label}
      </span>
      <span className="status-detail">{detail || 'Unknown'}</span>
    </div>
  );
}

function PostsView({ posts, onRefresh }) {
  return (
    <div className="view">
      <div className="view-header">
        <h2>Post History</h2>
        <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
      </div>
      {posts.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <p>No posts yet. Click "Post Now" to create your first post!</p>
        </div>
      ) : (
        <div className="posts-list">
          {posts.map((post) => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <span className={`badge ${post.status}`}>{post.status}</span>
                <span className="post-date">{new Date(post.createdAt).toLocaleString()}</span>
              </div>
              <p className="post-content">{post.content}</p>
              {post.imageUrl && <img src={post.imageUrl} alt="" className="post-img" />}
              {post.imageCredit && <span className="post-credit">{post.imageCredit}</span>}
              {post.facebookPostId && (
                <span className="post-fbid">FB ID: {post.facebookPostId}</span>
              )}
              {post.errorMessage && <span className="post-error">{post.errorMessage}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchedulesView({ schedules, onToggle, onRefresh }) {
  return (
    <div className="view">
      <div className="view-header">
        <h2>Schedules</h2>
        <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
      </div>
      {schedules.length === 0 ? (
        <div className="empty-state">
          <Clock size={48} />
          <p>No schedules configured. Start the server to auto-create a default schedule.</p>
        </div>
      ) : (
        <div className="schedules-list">
          {schedules.map((s) => (
            <div key={s.id} className="schedule-card">
              <div className="schedule-header">
                <span className="schedule-cron">
                  <Calendar size={14} /> {s.cronExpression}
                </span>
                <button
                  className={`toggle-btn ${s.isActive ? 'active' : ''}`}
                  onClick={() => onToggle(s)}
                >
                  {s.isActive ? 'Active' : 'Paused'}
                </button>
              </div>
              <div className="schedule-meta">
                <span><Hash size={12} /> {s.niche}</span>
                <span><MessageSquare size={12} /> {s.tone}</span>
                <span><Globe size={12} /> {s.language}</span>
                {s.includeImage && <span><Image size={12} /> Images</span>}
                {s.includeHashtags && <span><Hash size={12} /> Hashtags</span>}
                {s.includeEmojis && <span><Smile size={12} /> Emojis</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogsView({ logs, onRefresh }) {
  return (
    <div className="view">
      <div className="view-header">
        <h2>Activity Log</h2>
        <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
      </div>
      {logs.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} />
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="logs-list">
          {logs.map((log) => (
            <div key={log.id} className={`log-item log-${log.status}`}>
              <span className="log-time">{new Date(log.createdAt).toLocaleString()}</span>
              <span className="log-action">{log.action}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ status }) {
  return (
    <div className="view">
      <div className="view-header">
        <h2>Settings</h2>
      </div>
      <div className="card">
        <h3>Environment Variables</h3>
        <p className="card-desc">
          Configure these in your <code>.env</code> file or Render dashboard.
        </p>
        <div className="settings-list">
          <SettingRow label="OPENAI_API_KEY" set={status?.openai?.configured} />
          <SettingRow label="FB_PAGE_ACCESS_TOKEN" set={status?.facebook?.valid} />
          <SettingRow label="FB_PAGE_ID" set={status?.facebook?.valid} />
          <SettingRow label="UNSPLASH_ACCESS_KEY" set={status?.unsplash?.configured} />
          <SettingRow label="WEBHOOK_VERIFY_TOKEN" set={status?.messenger?.configured} />
          <SettingRow label="IG_PAGE_ACCESS_TOKEN" set={status?.instagram?.configured} />
          <SettingRow label="DATABASE_URL" set={true} />
          <SettingRow label="CRON_SCHEDULE" set={true} />
          <SettingRow label="WP_SITE_URL" set={status?.wordpress?.valid} />
          <SettingRow label="WP_USERNAME" set={status?.wordpress?.valid} />
          <SettingRow label="WP_APP_PASSWORD" set={status?.wordpress?.valid} />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, set }) {
  return (
    <div className="setting-row">
      <code>{label}</code>
      {set ? (
        <span className="setting-ok"><CheckCircle size={14} /> Set</span>
      ) : (
        <span className="setting-missing"><AlertCircle size={14} /> Missing</span>
      )}
    </div>
  );
}

function ConversationsView({ conversations, selectedConvo, messages, onSelect, onBack, onRefresh }) {
  if (selectedConvo) {
    return (
      <div className="view">
        <div className="view-header">
          <div className="convo-back-header">
            <button className="icon-btn" onClick={onBack}><ChevronLeft size={16} /></button>
            <div>
              <h2>{selectedConvo.senderName || 'Unknown User'}</h2>
              <span className="convo-platform-label">
                {selectedConvo.platform === 'messenger' ? <Facebook size={12} /> : <Instagram size={12} />}
                {selectedConvo.platform}
              </span>
            </div>
          </div>
        </div>
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble ${msg.role}`}>
              <div className="chat-bubble-icon">
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className="chat-bubble-content">
                <p>{msg.content}</p>
                <span className="chat-time">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="empty-state">
              <MessagesSquare size={48} />
              <p>No messages in this conversation.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Conversations</h2>
        <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
      </div>
      {conversations.length === 0 ? (
        <div className="empty-state">
          <MessagesSquare size={48} />
          <p>No conversations yet. Messages from Messenger and Instagram will appear here.</p>
        </div>
      ) : (
        <div className="convo-list">
          {conversations.map((c) => (
            <div key={c.id} className="convo-card" onClick={() => onSelect(c)}>
              <div className="convo-card-left">
                <div className={`convo-platform-icon ${c.platform}`}>
                  {c.platform === 'messenger' ? <Facebook size={16} /> : <Instagram size={16} />}
                </div>
                <div>
                  <div className="convo-name">{c.senderName || 'Unknown User'}</div>
                  <div className="convo-meta">
                    {c.messageCount} messages &middot; {c.platform}
                  </div>
                </div>
              </div>
              <span className="convo-time">{new Date(c.lastMessageAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InstructionsView({ instructions, onCreate, onUpdate, onDelete, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', platform: 'all', instructions: '' });

  const handleSubmit = () => {
    if (!formData.name || !formData.instructions) return;
    if (editingId) {
      onUpdate(editingId, formData);
      setEditingId(null);
    } else {
      onCreate(formData);
    }
    setFormData({ name: '', platform: 'all', instructions: '' });
    setShowForm(false);
  };

  const handleEdit = (inst) => {
    setEditingId(inst.id);
    setFormData({ name: inst.name, platform: inst.platform, instructions: inst.instructions });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', platform: 'all', instructions: '' });
    setShowForm(false);
  };

  return (
    <div className="view">
      <div className="view-header">
        <h2>System Instructions</h2>
        <div className="header-actions">
          <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
          <button className="add-btn" onClick={() => { handleCancel(); setShowForm(!showForm); }}>
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      <p className="view-desc">
        Define how the AI responds on each platform. Use "Facebook Posts" for post generation, "Messenger" or "Instagram" for chat, or "All" to apply everywhere.
      </p>

      {showForm && (
        <div className="card instruction-form">
          <h3>{editingId ? <><Edit3 size={16} /> Edit Instruction</> : <><Plus size={16} /> New Instruction</>}</h3>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Customer Support Bot"
            />
          </div>
          <div className="form-group">
            <label>Platform</label>
            <select
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
            >
              <option value="all">All Platforms</option>
              <option value="facebook">Facebook Posts</option>
              <option value="messenger">Messenger DMs</option>
              <option value="instagram">Instagram DMs</option>
              <option value="instagram_comment">Instagram Comments</option>
              <option value="facebook_comment">Facebook Comments</option>
            </select>
          </div>
          <div className="form-group">
            <label>Instructions</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="You are a friendly customer support agent for our business. Always greet the customer warmly..."
              rows={6}
            />
          </div>
          <div className="form-actions">
            <button className="save-btn" onClick={handleSubmit}>
              <Save size={14} /> {editingId ? 'Update' : 'Create'}
            </button>
            <button className="cancel-btn" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}

      {instructions.length === 0 && !showForm ? (
        <div className="empty-state">
          <BookOpen size={48} />
          <p>No system instructions yet. Create one to control how the AI responds in chat.</p>
        </div>
      ) : (
        <div className="instructions-list">
          {instructions.map((inst) => (
            <div key={inst.id} className="instruction-card">
              <div className="instruction-header">
                <div className="instruction-title">
                  <strong>{inst.name}</strong>
                  <span className={`platform-badge ${inst.platform}`}>
                    {inst.platform === 'messenger' && <Facebook size={10} />}
                    {inst.platform === 'instagram' && <Instagram size={10} />}
                    {inst.platform === 'instagram_comment' && <Instagram size={10} />}
                    {inst.platform === 'facebook' && <Facebook size={10} />}
                    {inst.platform === 'facebook_comment' && <Facebook size={10} />}
                    {inst.platform === 'all' && <Globe size={10} />}
                    {inst.platform.replace('_', ' ')}
                  </span>
                  <span className={`badge ${inst.isActive ? 'published' : 'draft'}`}>
                    {inst.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="instruction-actions">
                  <button className="icon-btn-sm" onClick={() => onUpdate(inst.id, { isActive: !inst.isActive })}>
                    {inst.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                  </button>
                  <button className="icon-btn-sm" onClick={() => handleEdit(inst)}>
                    <Edit3 size={14} />
                  </button>
                  <button className="icon-btn-sm danger" onClick={() => onDelete(inst.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <pre className="instruction-text">{inst.instructions}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArticlesView({ articles, queue, selectedArticle, onSelect, onBack, onGenerate, onDelete, onRefresh, generating }) {
  if (selectedArticle) {
    return (
      <div className="view">
        <div className="view-header">
          <div className="convo-back-header">
            <button className="icon-btn" onClick={onBack}><ChevronLeft size={16} /></button>
            <div>
              <h2>{selectedArticle.title}</h2>
              <span className="convo-platform-label">
                <MapPin size={12} /> {selectedArticle.city}, {selectedArticle.state} &middot; {selectedArticle.service}
              </span>
            </div>
          </div>
          <div className="header-actions">
            {selectedArticle.wpLink && (
              <a href={selectedArticle.wpLink} target="_blank" rel="noopener noreferrer" className="add-btn">
                <ExternalLink size={14} /> View on Site
              </a>
            )}
            <button className="icon-btn-sm danger" onClick={() => onDelete(selectedArticle.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="article-meta-bar">
          <span className={`badge ${selectedArticle.status}`}>{selectedArticle.status}</span>
          <span className="article-meta-item"><Layers size={12} /> {selectedArticle.templateType}</span>
          {selectedArticle.publishedAt && (
            <span className="article-meta-item"><Calendar size={12} /> {new Date(selectedArticle.publishedAt).toLocaleString()}</span>
          )}
          {selectedArticle.wpPostId && (
            <span className="article-meta-item">WP ID: {selectedArticle.wpPostId}</span>
          )}
        </div>
        <div className="article-content-view card">
          <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
        </div>
        {selectedArticle.listingUrl && (
          <div className="card">
            <h3><ExternalLink size={14} /> Listing URL</h3>
            <a href={selectedArticle.listingUrl} target="_blank" rel="noopener noreferrer" className="article-listing-link">
              {selectedArticle.listingUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>WordPress Articles</h2>
        <div className="header-actions">
          <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
          <button className="add-btn" onClick={onGenerate} disabled={generating}>
            <Newspaper size={16} /> {generating ? 'Generating...' : 'Generate Article'}
          </button>
        </div>
      </div>

      <p className="view-desc">
        AI-generated local SEO articles published to your WordPress site daily at 8:00 AM Eastern.
      </p>

      {queue && (
        <div className="article-queue-stats">
          <div className="stat-card" style={{ borderTopColor: '#3b82f6' }}>
            <div className="stat-icon" style={{ color: '#3b82f6' }}><Layers size={22} /></div>
            <div className="stat-value">{queue.totalInQueue}</div>
            <div className="stat-title">Total in Queue</div>
          </div>
          <div className="stat-card" style={{ borderTopColor: '#22c55e' }}>
            <div className="stat-icon" style={{ color: '#22c55e' }}><CheckCircle size={22} /></div>
            <div className="stat-value">{queue.published}</div>
            <div className="stat-title">Published</div>
          </div>
          <div className="stat-card" style={{ borderTopColor: '#a855f7' }}>
            <div className="stat-icon" style={{ color: '#a855f7' }}><Clock size={22} /></div>
            <div className="stat-value">{queue.remaining}</div>
            <div className="stat-title">Remaining</div>
          </div>
          {queue.nextArticle && (
            <div className="stat-card" style={{ borderTopColor: '#f59e0b' }}>
              <div className="stat-icon" style={{ color: '#f59e0b' }}><Newspaper size={22} /></div>
              <div className="stat-value" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>{queue.nextArticle.title}</div>
              <div className="stat-title">Next Article</div>
            </div>
          )}
        </div>
      )}

      {articles.length === 0 ? (
        <div className="empty-state">
          <Newspaper size={48} />
          <p>No articles yet. Click "Generate Article" to create your first one, or wait for the daily 8 AM schedule.</p>
        </div>
      ) : (
        <div className="articles-list">
          {articles.map((article) => (
            <div key={article.id} className="article-card" onClick={() => onSelect(article)}>
              <div className="article-card-header">
                <span className={`badge ${article.status}`}>{article.status}</span>
                <span className="article-card-date">{new Date(article.createdAt).toLocaleDateString()}</span>
              </div>
              <h3 className="article-card-title">{article.title}</h3>
              <div className="article-card-meta">
                <span><MapPin size={12} /> {article.city}, {article.state}</span>
                <span><Layers size={12} /> {article.service}</span>
                <span>{article.templateType}</span>
              </div>
              {article.wpLink && (
                <a
                  href={article.wpLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="article-card-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={12} /> View on site
                </a>
              )}
              {article.errorMessage && <span className="post-error">{article.errorMessage}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImagesView({ images, stats, onAdd, onDelete, onPostIG, onRefresh, postingIG }) {
  const [showForm, setShowForm] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = () => {
    const urls = urlInput.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return;
    onAdd({ urls, category: category || null });
    setUrlInput('');
    setCategory('');
    setShowForm(false);
  };

  return (
    <div className="view">
      <div className="view-header">
        <h2>Images & Instagram</h2>
        <div className="header-actions">
          <button className="icon-btn" onClick={onRefresh}><RefreshCw size={16} /></button>
          <button className="add-btn" onClick={onPostIG} disabled={postingIG}>
            <Instagram size={16} /> {postingIG ? 'Posting...' : 'Post to Instagram'}
          </button>
          <button className="add-btn" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> Add Images
          </button>
        </div>
      </div>

      <p className="view-desc">
        Add image URLs for Instagram posts. The scheduler picks one image per day and generates a caption automatically.
      </p>

      {stats && (
        <div className="article-queue-stats">
          <div className="stat-card" style={{ borderTopColor: '#3b82f6' }}>
            <div className="stat-icon" style={{ color: '#3b82f6' }}><Image size={22} /></div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-title">Total Images</div>
          </div>
          <div className="stat-card" style={{ borderTopColor: '#22c55e' }}>
            <div className="stat-icon" style={{ color: '#22c55e' }}><CheckCircle size={22} /></div>
            <div className="stat-value">{stats.unused}</div>
            <div className="stat-title">Ready to Post</div>
          </div>
          <div className="stat-card" style={{ borderTopColor: '#a855f7' }}>
            <div className="stat-icon" style={{ color: '#a855f7' }}><Instagram size={22} /></div>
            <div className="stat-value">{stats.used}</div>
            <div className="stat-title">Posted</div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card instruction-form">
          <h3><Plus size={16} /> Add Image URLs</h3>
          <div className="form-group">
            <label>Image URLs (one per line, must be publicly accessible)</label>
            <textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
              rows={4}
            />
          </div>
          <div className="form-group">
            <label>Category (optional)</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Auto-rotate</option>
              <option value="cleaning">Cleaning</option>
              <option value="massage">Massage</option>
              <option value="wellness">Wellness</option>
              <option value="beauty">Beauty</option>
              <option value="skincare">Skincare</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="save-btn" onClick={handleSubmit}><Save size={14} /> Add</button>
            <button className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {images.length === 0 && !showForm ? (
        <div className="empty-state">
          <Image size={48} />
          <p>No images yet. Click "Add Images" to upload image URLs for Instagram posts.</p>
        </div>
      ) : (
        <div className="images-grid">
          {images.map((img) => (
            <div key={img.id} className={`image-card ${img.used ? 'used' : ''}`}>
              <div className="image-card-img">
                <img src={img.url} alt={img.caption || 'Image'} loading="lazy" />
                {img.used && <div className="image-used-badge"><CheckCircle size={14} /> Posted</div>}
              </div>
              <div className="image-card-info">
                {img.category && <span className="badge published">{img.category}</span>}
                {img.instagramPostId && <span className="image-card-igid">IG: {img.instagramPostId.slice(-8)}</span>}
                <span className="image-card-date">{new Date(img.createdAt).toLocaleDateString()}</span>
                {!img.used && (
                  <button className="icon-btn-sm danger" onClick={() => onDelete(img.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              {img.caption && <p className="image-card-caption">{img.caption.slice(0, 100)}...</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
