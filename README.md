# Meta Marketing Bot

Fully automated Facebook marketing bot powered by ChatGPT, Unsplash, and the Facebook Graph API. Generates engaging content, pairs it with beautiful images, and publishes on a schedule. Also includes AI-powered auto-reply chatbots for **Facebook Messenger** and **Instagram DMs** with customizable system instructions.

## Features

- **AI Content Generation** — Uses GPT-4o to create engaging Facebook posts
- **Auto Image Selection** — Pulls relevant images from Unsplash based on post content
- **Scheduled Posting** — Cron-based scheduler for fully automated publishing
- **Dashboard UI** — React-based dashboard to monitor posts, schedules, and logs
- **Post History** — Full audit trail of all generated and published content
- **Service Health** — Real-time status of all connected APIs
- **Messenger Chatbot** — AI auto-replies to Facebook Messenger messages using GPT-4o
- **Instagram Chatbot** — AI auto-replies to Instagram DMs using GPT-4o
- **System Instructions** — Write custom instructions to control how the chatbot responds per platform
- **Conversation History** — Full chat logs stored in PostgreSQL, viewable in the dashboard

## Tech Stack

- **Backend**: Node.js, Express, Sequelize (PostgreSQL)
- **Frontend**: React, Lucide icons
- **APIs**: OpenAI (GPT-4o), Facebook Graph API, Meta Messenger Platform, Instagram Messaging API, Unsplash
- **Hosting**: Render (with `render.yaml` blueprint)

## Prerequisites

You need these API keys/tokens:

| Service | How to Get |
|---------|-----------|
| **OpenAI API Key** | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Facebook Page Access Token** | Long-lived token from [developers.facebook.com](https://developers.facebook.com/tools/explorer/) |
| **Facebook Page ID** | Found in your Page's About section or Graph API Explorer |
| **Unsplash Access Key** | [unsplash.com/developers](https://unsplash.com/developers) |
| **Webhook Verify Token** | Any random string you create (used to verify webhook with Meta) |
| **Instagram Token** *(optional)* | Uses FB token by default; set separately if your IG account has a different token |

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd meta-marketing-bot
npm run install:all
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your API keys:

```
DATABASE_URL=postgresql://user:password@localhost:5432/meta_marketing_bot
OPENAI_API_KEY=sk-...
FB_PAGE_ACCESS_TOKEN=your-token
FB_PAGE_ID=your-page-id
UNSPLASH_ACCESS_KEY=your-key
WEBHOOK_VERIFY_TOKEN=my-secret-verify-token
CRON_SCHEDULE=0 10 * * *
```

### 3. Set up PostgreSQL

Create a local database:

```bash
createdb meta_marketing_bot
```

### 4. Run in development

```bash
npm run dev
```

- Backend runs on `http://localhost:5000`
- Frontend runs on `http://localhost:3000`

## Deploy to Render

1. Push your code to a GitHub repo
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your repo — Render will auto-detect `render.yaml`
4. Add your environment variables (API keys) in the Render dashboard
5. Deploy!

The `render.yaml` creates:
- A **Web Service** (Node.js) for the backend + frontend
- A **PostgreSQL database** (free tier)

## Setting Up Messenger & Instagram Webhooks

After deploying to Render:

1. Go to [developers.facebook.com](https://developers.facebook.com) → your App → **Webhooks**
2. Click **Add Callback URL**
3. Set the URL to `https://your-app.onrender.com/webhook`
4. Set the Verify Token to the same value as your `WEBHOOK_VERIFY_TOKEN` env var
5. Subscribe to these fields:
   - For **Page**: `messages`, `messaging_postbacks`
   - For **Instagram**: `messages`
6. Under **Messenger** → **Settings**, subscribe your Page to the webhook
7. Under **Instagram** → **Settings**, connect your Instagram Business account

## System Instructions

System instructions control how the AI chatbot responds. You can:
- Create instructions that apply to **All** platforms, **Messenger only**, or **Instagram only**
- Have multiple active instructions (they get combined)
- Edit/toggle/delete instructions from the dashboard
- If no instructions exist, a sensible default is used

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/status` | Service health check |
| GET | `/api/posts` | List all posts (paginated) |
| POST | `/api/posts/generate` | Manually trigger a post |
| POST | `/api/posts/preview` | Generate preview without publishing |
| GET | `/api/schedules` | List schedules |
| POST | `/api/schedules` | Create a schedule |
| PUT | `/api/schedules/:id` | Update a schedule |
| DELETE | `/api/schedules/:id` | Delete a schedule |
| GET | `/api/conversations` | List chat conversations |
| GET | `/api/conversations/:id/messages` | Get messages for a conversation |
| GET | `/api/instructions` | List system instructions |
| POST | `/api/instructions` | Create a system instruction |
| PUT | `/api/instructions/:id` | Update a system instruction |
| DELETE | `/api/instructions/:id` | Delete a system instruction |
| GET | `/api/logs` | Activity logs |
| GET | `/webhook` | Meta webhook verification |
| POST | `/webhook` | Meta webhook event handler |
| GET | `/health` | Server health check |

## Cron Schedule Examples

| Expression | Frequency |
|-----------|-----------|
| `0 10 * * *` | Every day at 10:00 AM |
| `0 10,18 * * *` | Twice daily at 10 AM and 6 PM |
| `0 10 * * 1-5` | Weekdays at 10:00 AM |
| `0 */6 * * *` | Every 6 hours |

## License

MIT
