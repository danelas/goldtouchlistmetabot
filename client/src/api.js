import axios from 'axios';

const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Dashboard stats
export const getStats = () => api.get('/stats').then((r) => r.data);
export const getStatus = () => api.get('/status').then((r) => r.data);

// Posts
export const getPosts = (page = 1, limit = 20) =>
  api.get('/posts', { params: { page, limit } }).then((r) => r.data);
export const generatePost = () => api.post('/posts/generate').then((r) => r.data);
export const previewPost = (options) => api.post('/posts/preview', options).then((r) => r.data);

// Schedules
export const getSchedules = () => api.get('/schedules').then((r) => r.data);
export const createSchedule = (data) => api.post('/schedules', data).then((r) => r.data);
export const updateSchedule = (id, data) => api.put(`/schedules/${id}`, data).then((r) => r.data);
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`).then((r) => r.data);

// Logs
export const getLogs = (page = 1, limit = 50) =>
  api.get('/logs', { params: { page, limit } }).then((r) => r.data);

// Conversations
export const getConversations = (page = 1, limit = 20, platform) =>
  api.get('/conversations', { params: { page, limit, platform } }).then((r) => r.data);
export const getMessages = (conversationId) =>
  api.get(`/conversations/${conversationId}/messages`).then((r) => r.data);

// System Instructions
export const getInstructions = () => api.get('/instructions').then((r) => r.data);
export const createInstruction = (data) => api.post('/instructions', data).then((r) => r.data);
export const updateInstruction = (id, data) => api.put(`/instructions/${id}`, data).then((r) => r.data);
export const deleteInstruction = (id) => api.delete(`/instructions/${id}`).then((r) => r.data);

// Images (for Instagram)
export const getImages = (used) =>
  api.get('/images', { params: used !== undefined ? { used } : {} }).then((r) => r.data);
export const getImageStats = () => api.get('/images/stats').then((r) => r.data);
export const addImage = (data) => api.post('/images', data).then((r) => r.data);
export const deleteImage = (id) => api.delete(`/images/${id}`).then((r) => r.data);

// Instagram
export const getInstagramStatus = () => api.get('/instagram/status').then((r) => r.data);
export const postToInstagram = () => api.post('/instagram/post').then((r) => r.data);

// Articles (WordPress)
export const getArticles = (page = 1, limit = 20, status) =>
  api.get('/articles', { params: { page, limit, status } }).then((r) => r.data);
export const getArticleQueue = () => api.get('/articles/queue').then((r) => r.data);
export const generateArticle = () => api.post('/articles/generate').then((r) => r.data);
export const getArticle = (id) => api.get(`/articles/${id}`).then((r) => r.data);
export const deleteArticle = (id) => api.delete(`/articles/${id}`).then((r) => r.data);
