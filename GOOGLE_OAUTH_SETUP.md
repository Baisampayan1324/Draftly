# Setting up Google OAuth for Draftly

To fetch and send emails using the Gmail API, you need to create a Google Cloud Project and generate OAuth 2.0 Credentials. Follow these steps exactly to connect your Google account to Draftly.

## Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your primary Gmail account.
3. Click the project dropdown arrow near the top-left (next to the Google Cloud logo) and select **New Project**.
4. Name your project (e.g., `Draftly App`) and click **Create**. Make sure it is selected after creation.

## Step 2: Enable the Gmail API
1. In the left sidebar, navigate to **APIs & Services** > **Library**.
2. Search for **"Gmail API"**.
3. Click on the **Gmail API** result and click the blue **Enable** button.

## Step 3: Configure the OAuth Consent Screen
Before you can generate credentials, Google requires you to configure the screen users see when they log in.

1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (if you're a standard `@gmail.com` user) and click **Create**.
3. Fill in the required app information:
   - **App name**: `Draftly`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes**. You need to search for and select the scopes that give Draftly permission to read/send emails (e.g., `https://mail.google.com/`). Select it and click **Update**, then **Save and Continue**.
6. **CRITICAL STEP**: On the **Test users** page, click **+ ADD USERS**. Type in the exact `@gmail.com` email address you plan to use with the app. If you don't add yourself here, Google will block the login attempt. Click **Save and Continue**.
7. Return to the dashboard.

## Step 4: Create OAuth Credentials
Now you will generate the exact keys the Draftly backend needs.

1. Go to **APIs & Services** > **Credentials**.
2. Click **+ CREATE CREDENTIALS** at the top of the screen and select **OAuth client ID**.
3. Set the **Application type** dropdown to **Web application**.
4. Set the **Name** to `Draftly Web`.
5. Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   - `http://localhost:8080`
   - `http://127.0.0.1:8080`
   - `http://localhost:8000`
   - `http://127.0.0.1:8000`
6. Under **Authorized redirect URIs**, click **+ ADD URI** and add the exact callback URL that the FastAPI backend expects:
   - `http://localhost:8000/auth/gmail/callback`
   - `http://127.0.0.1:8000/auth/gmail/callback`
7. Click **Create**.

## Step 5: Copy Keys to Draftly `.env`
1. A modal will pop up displaying your **Client ID** and **Client Secret**. Keep this modal open.
2. Open the `.env` file located in `P:\hitl3\backend\.env`.
3. Paste the values into their respective variables:

```env
GOOGLE_CLIENT_ID=your_long_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/gmail/callback
```
*(Make sure there are no spaces immediately after the equals `=` signs).*

## Step 6: Test Login
1. Make sure both `python main.py` (Backend) and `npm run dev` (Frontend) are running.
2. Open `http://localhost:8080` in your browser.
3. Try generating an email and clicking **Approve**. 
4. The "Send via Gmail" modal will pop up. Click **Connect with Google**.
5. Google will warn you that "Google hasn't verified this app." Because this is your own private app, this is expected. Click **Continue** (or click **Advanced** -> **Go to Draftly (unsafe)**).
6. Check the boxes to allow Draftly to read/send emails and click **Continue**. 
7. You should be redirected back to Draftly, and a toast message should appear saying "Gmail Connected & Email Sent!"
