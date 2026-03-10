# Deploying Draftly to Render

This guide walks you through deploying Draftly (FastAPI backend + React frontend) to [Render](https://render.com).

---

## Prerequisites

1. **GitHub Account** — Your code must be pushed to a GitHub repository
2. **Render Account** — Sign up at [render.com](https://render.com) (free tier available)
3. **Groq API Key** — Get one from [console.groq.com](https://console.groq.com)
4. **Google OAuth Credentials** — See `GOOGLE_OAUTH_SETUP.md` for setup instructions

---

## Step 1: Push Code to GitHub

```bash
# If not already done
git add -A
git commit -m "Prepare for Render deployment"
git push origin main
```

---

## Step 2: Create Backend Service (FastAPI API)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:

   | Setting            | Value                                                                                             |
   | ------------------ | ------------------------------------------------------------------------------------------------- |
   | **Name**           | `draftly-api`                                                                                     |
   | **Region**         | Oregon (or nearest)                                                                               |
   | **Branch**         | `main`                                                                                            |
   | **Root Directory** | `backend`                                                                                         |
   | **Runtime**        | Python 3                                                                                          |
   | **Build Command**  | `pip install -r requirements.txt`                                                                 |
   | **Start Command**  | `gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT` |
   | **Instance Type**  | Free                                                                                              |

5. Click **Advanced** and add **Environment Variables**:

   | Key                    | Value                                                  |
   | ---------------------- | ------------------------------------------------------ |
   | `PYTHON_VERSION`       | `3.11`                                                 |
   | `GROQ_API_KEY`         | Your Groq API key                                      |
   | `GOOGLE_CLIENT_ID`     | From Google Cloud Console                              |
   | `GOOGLE_CLIENT_SECRET` | From Google Cloud Console                              |
   | `GOOGLE_REDIRECT_URI`  | `https://draftly-api.onrender.com/auth/gmail/callback` |
   | `FRONTEND_URL`         | `https://draftly.onrender.com`                         |

   > ⚠️ Replace `draftly-api` and `draftly` with your actual service names if different

6. Click **Create Web Service**

7. Wait for deployment to complete. Note your API URL (e.g., `https://draftly-api.onrender.com`)

---

## Step 3: Create Frontend Service (React Static Site)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Static Site**
3. Connect the same GitHub repository
4. Configure the service:

   | Setting               | Value                          |
   | --------------------- | ------------------------------ |
   | **Name**              | `draftly`                      |
   | **Branch**            | `main`                         |
   | **Root Directory**    | `frontend`                     |
   | **Build Command**     | `npm install && npm run build` |
   | **Publish Directory** | `dist`                         |

5. Add **Environment Variables**:

   | Key            | Value                                                 |
   | -------------- | ----------------------------------------------------- |
   | `VITE_API_URL` | `https://draftly-api.onrender.com` (your backend URL) |

6. Click **Create Static Site**

7. Wait for deployment. Note your frontend URL (e.g., `https://draftly.onrender.com`)

---

## Step 4: Configure SPA Routing (Important!)

React Router needs all routes to serve `index.html`:

1. Go to your **Static Site** settings in Render
2. Navigate to **Redirects/Rewrites**
3. Add a rewrite rule:

   | Source | Destination   | Action  |
   | ------ | ------------- | ------- |
   | `/*`   | `/index.html` | Rewrite |

4. Click **Save Changes**

---

## Step 5: Update Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   ```
   https://draftly-api.onrender.com/auth/gmail/callback
   ```
5. Add to **Authorized JavaScript origins** (if needed):
   ```
   https://draftly.onrender.com
   ```
6. Click **Save**

---

## Step 6: Verify Deployment

1. Visit your frontend URL: `https://draftly.onrender.com`
2. You should see the landing page
3. Try connecting Gmail — it should redirect to Google OAuth
4. After authorization, you should return to the app

---

## Troubleshooting

### Backend not starting

- Check **Logs** in Render dashboard
- Verify all environment variables are set
- Ensure `requirements.txt` has all dependencies

### OAuth "redirect_uri_mismatch" error

- The `GOOGLE_REDIRECT_URI` must exactly match what's in Google Cloud Console
- Include the full URL with `https://`

### Frontend shows blank page or 404 on refresh

- Make sure you added the SPA rewrite rule (Step 4)

### CORS errors

- The backend allows all origins by default (`allow_origins=["*"]`)
- For production, update `main.py` to restrict to your frontend domain:
  ```python
  allow_origins=["https://draftly.onrender.com"]
  ```

### Free tier cold starts

- Render free tier spins down after 15 minutes of inactivity
- First request after idle may take 30-60 seconds

---

## Environment Variables Summary

### Backend (`draftly-api`)

| Variable               | Description                | Example                                                |
| ---------------------- | -------------------------- | ------------------------------------------------------ |
| `GROQ_API_KEY`         | Groq LLM API key           | `gsk_xxx...`                                           |
| `GOOGLE_CLIENT_ID`     | OAuth client ID            | `xxx.apps.googleusercontent.com`                       |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret        | `GOCSPX-xxx`                                           |
| `GOOGLE_REDIRECT_URI`  | OAuth callback URL         | `https://draftly-api.onrender.com/auth/gmail/callback` |
| `FRONTEND_URL`         | Frontend URL for redirects | `https://draftly.onrender.com`                         |

### Frontend (`draftly`)

| Variable       | Description     | Example                            |
| -------------- | --------------- | ---------------------------------- |
| `VITE_API_URL` | Backend API URL | `https://draftly-api.onrender.com` |

---

## Using render.yaml (Blueprint)

Alternatively, you can use the included `render.yaml` for automatic service creation:

1. Go to **Blueprints** in Render Dashboard
2. Click **New Blueprint Instance**
3. Select your repository
4. Render will detect `render.yaml` and create both services
5. You still need to manually set environment variables marked `sync: false`

---

## Production Checklist

- [ ] Backend deployed and healthy (`/health` returns `{"status": "ok"}`)
- [ ] Frontend deployed and accessible
- [ ] SPA rewrite rule configured
- [ ] All environment variables set
- [ ] Google OAuth redirect URI updated
- [ ] Test Gmail connect flow end-to-end
- [ ] Test email compose and send flow
