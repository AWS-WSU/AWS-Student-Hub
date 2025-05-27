<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/2560px-Amazon_Web_Services_Logo.svg.png" alt="AWS Logo" width="150"/>
</p>

<h1 align="center">Wayne State University - AWS Student Hub</h1>

<p align="center">
  <img src="https://github.com/user-attachments/assets/2057d3aa-a3e2-4566-b2f6-b89b0dd165f5" width="300" alt="Student Hub Banner"/>
</p>

### Project Leads
- **Natali Chaaban** - _Senior Cloud Architect_ |    nchaaban1@wayne.edu
- **Akshath Reddy** - _Senior Cloud Architect_ |    akshathreddy@wayne.edu 
- **Akrm Al-Hakimi** - _President_ |     gv7723@wayne.edu

## Development Setup

The app uses `concurrently` to run both the frontend and the backend together. 

### 1. Clone the repo
   ```bash
   git clone git@github.com:AWS-WSU/AWS-Student-Hub.git
   cd AWS-Student-Hub
   ```
### 2. Install dependencies in the backend...
   ```bash
   cd backend
   npm install
   ```
   The frontend...
   ```bash
   cd frontend
   npm install
   ```
   And the root...
   ```bash
   # From the root of the repository
   npm install
   ```

### 3. Start the app
```bash
npm run dev
```
- Concurrently simply runs the appropriate scripts for both the frontend and the backend in order to get the site running. Under the hood, this is what `npm run dev` is doing

  ```bash
  concurrently \"npm run dev --prefix frontend\" \"npm start --prefix backend\" 
  ```
  - This should give you an output in your terminal that looks something like this
    
  - <img width="824" alt="Screenshot 2025-05-23 at 12 20 32 PM" src="https://github.com/user-attachments/assets/9187283c-346b-4f8d-b75c-d0cab6e2b57e" />

### 4. Open the site
Navigate to `localhost:5173` on any browser, and you'll see the website. Any changes you make to either the frontend or backend should update automatically without you needing to refresh the page.

---

# Troubleshooting 🛠️

If you run into issues getting the app up and running, here are some common problems and how to solve them:

#### ❌ Problem: Permission denied (publickey) when cloning the repo

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
   pbcopy < ~/.ssh/id_ed25519.pub  # macOS
   # or
   cat ~/.ssh/id_ed25519.pub       # then manually copy for Windows/Linux
   ```

   Then go to [GitHub SSH Settings](https://github.com/settings/keys) and add your key.

---

#### ❌ Problem: `npm install` fails or throws errors (e.g., `ELIFECYCLE`, `node-gyp`, etc.)

**Common causes:**

* Using an outdated version of Node.js
* Missing build tools (especially on Windows)
* Cache issues

**Solutions:**

- Firstly, make sure you install [NodeJS from here](https://nodejs.org/en/download)
* **Check Node version:**
  Run `node -v`. Use **Node v18+** (or whatever version the project specifies). Consider using [nvm](https://github.com/nvm-sh/nvm) to switch versions easily:

  ```bash
  nvm install 18
  nvm use 18
  ```

* **Clear the npm cache:**

  ```bash
  npm cache clean --force
  ```

* **Remove `node_modules` and `package-lock.json`, then reinstall:**

  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

* **On Windows (for `node-gyp` errors):**
  Make sure you have build tools installed:

  ```bash
  npm install --global windows-build-tools
  ```

---

#### ❌ Problem: Port already in use (e.g., `EADDRINUSE :5173`)

**Solution:**
Kill the process using the port, or use a different port:

```bash
# On macOS/Linux:
lsof -i :5173
kill -9 <PID>

# On Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

#### ❌ Problem: Frontend not auto-refreshing on changes

**Solution:**

* Ensure you're running the app via `npm run dev` from the root.
* Try restarting the Vite server (`ctrl + c` and then `npm run dev` again).
* Make sure your file changes are inside the `frontend/src` directory and not outside the watched paths.

---

#### Still stuck?

Feel free to reach out to any of the project leads for help. 


