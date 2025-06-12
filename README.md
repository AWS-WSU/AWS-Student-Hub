<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/2560px-Amazon_Web_Services_Logo.svg.png" alt="AWS Logo" width="150"/>
</p>

# Wayne State University - AWS Student Hub

<p align="center">
  <img src="https://github.com/user-attachments/assets/2057d3aa-a3e2-4566-b2f6-b89b0dd165f5" width="300" alt="Student Hub Banner"/>
</p>

## Project Leads

- **Natali Chaaban** - *Senior Cloud Architect* | nchaaban1@wayne.edu
- **Akshath Reddy** - *Senior Cloud Architect* | akshathreddy@wayne.edu 
- **Akrm Al-Hakimi** - *President* | gv7723@wayne.edu

---

## Development Setup

The app uses `concurrently` to run both the frontend and the backend together.

### 1. Clone the Repository

```bash
git clone git@github.com:AWS-WSU/AWS-Student-Hub.git
cd AWS-Student-Hub
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

**Root directory:**
```bash
# Navigate back to the root of the repository
cd ..
npm install
```

### 3. Environment Variables

### 🌐 Environment Variables Overview

| Variable Name              | Description                                                                 | Required? | Who Needs This |
|---------------------------|-----------------------------------------------------------------------------|-----------|----------------|
| `MONGODB_URI`             | MongoDB connection string for the primary database                          | Yes       | Backend        |
| `ADMIN_TOKEN`             | Token used for privileged admin actions                                     | Optional  | Backend        |
| `JWT_SECRET`              | Secret key for signing/verifying JWTs                                       | Yes       | Backend        |
| `PORT`                    | Port for backend server                                                     | Yes       | Backend        |
| `NODE_ENV`                | Application environment mode                                                | Yes       | Backend        |
| `CORS_ORIGIN`             | Allowed origins for CORS requests                                           | Yes       | Backend        |
| `AWS_ACCESS_KEY_ID`       | AWS credential for accessing services (e.g., S3)                            | Optional  | Backend        |
| `AWS_SECRET_ACCESS_KEY`   | Secret AWS key paired with access key ID                                    | Optional  | Backend        |
| `AWS_REGION`              | AWS region for services                                                     | Optional  | Backend        |
| `AWS_S3_BUCKET`           | S3 bucket name used for file uploads                                        | Optional  | Backend        |
| `SMTP_HOST`               | SMTP server address for sending emails                                      | Optional  | Backend        |
| `SMTP_PORT`               | SMTP port number                                                            | Optional  | Backend        |
| `SMTP_ENCRYPTION`         | Email encryption method (e.g., `STARTTLS`)                                  | Optional  | Backend        |
| `SMTP_USER`               | SMTP username or email                                                      | Optional  | Backend        |
| `SMTP_PASS`               | SMTP password or app-specific key                                           | Optional  | Backend        |
| `DISCORD_BOT_TOKEN`       | Invite bot token from Discord                                               | Yes       | Backend        |
| `DISCORD_GUILD_ID`        | Identifier for running commands through our bot                             | Yes       | Backend        |
| `DISCORD_CHANNEL_ID`      | AWS Club Discord channel ID                                                 | Yes       | Backend        |
| `VITE_AUTH0_DOMAIN`       | Auth0 domain for authentication                                             | Yes       | Frontend       |
| `VITE_AUTH0_CLIENT_ID`    | Public Auth0 client ID                                                      | Yes       | Frontend       |
| `VITE_AUTH0_AUDIENCE`     | Auth0 API audience identifier                                               | Yes       | Frontend       |
| `VITE_API_URL`            | Base URL for frontend to connect to backend                                 | Yes       | Frontend       |



**Frontend (.env):**
```env
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=your-auth0-api-audience
VITE_API_URL=http://localhost:5001/api
```

**Backend (.env):**
```env
# MongoDB connection string
MONGODB_URI=your-mongodb-uri

# Admin access token
ADMIN_TOKEN=your-admin-token

# Secret key for signing JWTs
JWT_SECRET=your-jwt-secret

# Backend port
PORT=5001

# Environment mode
NODE_ENV=development

# CORS configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=aws-student-hub

# SMTP configuration for email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_ENCRYPTION=STARTTLS
SMTP_USER=your-email
SMTP_PASS=your-email-password

# Discord bot configuration
DISCORD_BOT_TOKEN=<contact-@cachebag-for-this>
DISCORD_GUILD_ID=<contact-@cachebag-for-this>
DISCORD_CHANNEL_ID=<contact-@cachebag-for-this>

```

### 4. Start the Application

```bash
npm run dev
```

Concurrently runs the appropriate scripts for both the frontend and the backend to get the site running. Under the hood, this is what `npm run dev` is doing:

```bash
concurrently "npm run dev --prefix frontend" "npm start --prefix backend" 
```

This should give you an output in your terminal that looks something like this:

<img width="824" alt="Screenshot 2025-05-23 at 12 20 32 PM" src="https://github.com/user-attachments/assets/9187283c-346b-4f8d-b75c-d0cab6e2b57e" />

### 5. Open the Site

Navigate to `localhost:5173` in any browser, and you'll see the website. Any changes you make to either the frontend or backend should update automatically without you needing to refresh the page.

---

## Contributing to a Bug Fix or Feature

Beginning to contribute is simple. By default, you cannot push any changes to the `master` branch, so you must first start your own branch by doing the following:

### Option 1: Using VSCode or Similar IDE

#### Step 1: Create a New Branch
1. Open the project through VSCode or similar IDE
2. In the bottom left, click on the "master" branch symbol

   <img width="491" alt="Branch selection in VSCode" src="https://github.com/user-attachments/assets/5ffd0feb-37e8-4765-ab4f-891b9848b4dc" />

3. Select **"Create a new branch"**
4. Name your branch something descriptive like `feature/color-themes` or `fix/login-bug`

   <img width="595" alt="Create new branch dialog" src="https://github.com/user-attachments/assets/79669ab4-93ba-48e2-a0db-3787409827c5" />

#### Step 2: Develop Your Feature
1. Make your changes to the codebase
2. When ready to commit, click on the branch icon in your IDE

   <img width="217" alt="Branch icon in IDE" src="https://github.com/user-attachments/assets/5c409b6e-7348-47c6-87a9-65598d2d8c2e" />

#### Step 3: Commit Your Changes
1. Stage your changes by clicking the commit button

   <img width="216" alt="Commit changes button" src="https://github.com/user-attachments/assets/96970816-f5a2-43a0-b43e-2b252d312055" />

2. You will be asked if you want to stage all your changes - click **Yes**
3. Enter a descriptive commit message. For example:
   ```
   fix: refactored login component to accept saved login states
   ```

   <img width="592" alt="Commit message dialog" src="https://github.com/user-attachments/assets/ca35741a-8a9f-4f90-96e4-4d638207ed06" />

4. Click the checkmark on the top right (or similar in your IDE) to accept the commit message

#### Step 4: Push Your Changes
1. Click the "push changes" icon to upload your changes to GitHub

   <img width="218" alt="Push changes icon" src="https://github.com/user-attachments/assets/e00650af-e9ba-4afc-90e7-6b581ac552bd" />

#### Step 5: Create a Pull Request
1. Navigate to the GitHub repository
2. You should see a notification like this - click to open your pull request for review by one of the project leads

   <img width="960" alt="Pull request notification" src="https://github.com/user-attachments/assets/37e929ee-7430-4608-9001-8351b7d9678d" />

### Option 2: Using Terminal

If you are comfortable with the terminal, making changes and pushing them to git is straightforward:

#### Step 1: Make Your Changes
Simply make your changes using any IDE of your choice.

#### Step 2: Stage and Commit
Open a terminal window, navigate to the project directory, and execute the following commands in order:

1. **Stage your changes:**
   ```bash
   git add .
   # or for specific files:
   git add <the-file-you-want-to-commit>
   ```

2. **Commit with a descriptive message:**
   ```bash
   git commit -m "Your commit message goes here about what your changes do"
   ```

3. **Push your changes to your branch:**
   ```bash
   git push origin <your-branch-name>
   ```

#### Step 3: Create Pull Request
Repeat Step 5 from the VSCode instructions above.

---

## Troubleshooting 🛠️

If you run into issues getting the app up and running, here are some common problems and their solutions:

### ❌ Permission denied (publickey) when cloning the repo

**Cause:** You don't have your SSH key linked to your GitHub account, or no SSH key is set up on your device.

**Solution:**

1. **Check for existing SSH key:**
   ```bash
   ls -al ~/.ssh
   ```
   Look for files like `id_rsa.pub` or `id_ed25519.pub`.

2. **Generate a new SSH key (if none exists):**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

3. **Add your SSH key to the ssh-agent:**
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

4. **Copy and add the key to GitHub:**
   ```bash
   # macOS
   pbcopy < ~/.ssh/id_ed25519.pub
   
   # Windows/Linux - manually copy the output
   cat ~/.ssh/id_ed25519.pub
   ```
   
   Then go to [GitHub SSH Settings](https://github.com/settings/keys) and add your key.

### ❌ npm install fails or throws errors

**Common causes:**
- Using an outdated version of Node.js
- Missing build tools (especially on Windows)
- Cache issues

**Solutions:**

1. **Ensure Node.js is installed:**
   - Install [Node.js from the official website](https://nodejs.org/en/download)
   - Check your Node version: `node -v`
   - Use **Node v18+** (consider using [nvm](https://github.com/nvm-sh/nvm) to manage versions):
     ```bash
     nvm install 18
     nvm use 18
     ```

2. **Clear the npm cache:**
   ```bash
   npm cache clean --force
   ```

3. **Remove node_modules and package-lock.json, then reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **On Windows (for node-gyp errors):**
   ```bash
   npm install --global windows-build-tools
   ```

### ❌ Port already in use (e.g., EADDRINUSE :5173)

**Solution:**
Kill the process using the port, or use a different port:

```bash
# macOS/Linux:
lsof -i :5173
kill -9 <PID>

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### ❌ Frontend not auto-refreshing on changes

**Solutions:**
- Ensure you're running the app via `npm run dev` from the root directory
- Try restarting the Vite server (`Ctrl + C` and then `npm run dev` again)
- Make sure your file changes are inside the `frontend/src` directory and not outside the watched paths

---

## Need Help?

If you're still stuck after trying the troubleshooting steps above, feel free to reach out to any of the project leads for assistance.
