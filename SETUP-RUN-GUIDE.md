# Setup & Run Guide — Docker, Redis, Backend & Frontend

Follow these steps in order. Use **your actual paths**: your workspace is `c:\Users\ChaitanyaMalle\CF AI`.

---

## Part 1: Docker & Redis

### Step 1: Open Docker Desktop
- Open **Docker Desktop** from the Start menu.
- Wait until it says **“Docker Desktop is running”** (green icon in system tray).
- If the engine is not running, click **Start** or restart Docker Desktop.

### Step 2: Open Windows PowerShell
- Press `Win + X` → **Windows PowerShell** (or **Terminal**).
- Or search “PowerShell” in the Start menu.

### Step 3: Check Docker
Run:
```powershell
docker info
```
You should see a long list of Docker system info. If you get an error, Docker is not running — go back to Step 1.

### Step 4: Pull Redis image
```powershell
docker pull redis
```
Wait until the download finishes.

### Step 5: Run Redis container
```powershell
docker run -d -p 6379:6379 --name cloudfuze-redis redis
```
- `-d` = run in background  
- `-p 6379:6379` = host port 6379 → container 6379  
- `--name cloudfuze-redis` = container name  

Your app uses `REDIS_URL=redis://localhost:6379/0` in `.env`, so this matches.

### Step 6: Confirm Redis is running
```powershell
docker ps
```
You should see a row with **cloudfuze-redis**, image **redis**, ports **6379:6379**.

---

## Part 2: Backend (in IDE or a terminal)

### Step 7: Run the backend first
Open a terminal in your IDE (or use the same PowerShell).

### Step 8: Go to backend folder
```powershell
cd "c:\Users\ChaitanyaMalle\CF AI\cloudfuze-ai-agent"
```
*(If your project is under a different path like `C:\Ravi CF AI Agent\`, use that instead.)*

### Step 9: Start the backend
```powershell
python main.py
```
Leave this terminal open. You should see the server start (e.g. listening on a port like 8000).

---

## Part 3: Frontend (new terminal)

### Step 10: Open a new terminal
In your IDE: **Terminal → New Terminal** (or split terminal). Keep the backend terminal running.

### Step 11: Go to frontend folder
```powershell
cd "c:\Users\ChaitanyaMalle\CF AI\frontend"
```
*(If your frontend folder is named `cloudfuze-ai-frontend`, use:  
`cd "c:\Users\ChaitanyaMalle\CF AI\cloudfuze-ai-frontend"`)*

### Step 12: Install deps (first time only) and run dev server
```powershell
npm install
npm run dev
```
Leave this terminal open. Note the URL (usually **http://localhost:3000**).

---

## Part 4: Test in browser

### Step 13: Open the app
- Open **Edge** or **Chrome**.
- Go to **http://localhost:3000**.

### Step 14: You’re good to test
- Chat memory is stored in Redis (container **cloudfuze-redis** on port 6379).
- Backend talks to Redis using `REDIS_URL` from `.env`.

---

## Quick reference

| What        | Command / URL                                      |
|------------|-----------------------------------------------------|
| Redis      | `docker ps` → cloudfuze-redis, 6379:6379           |
| Backend    | `cd "...\cloudfuze-ai-agent"` → `python main.py`   |
| Frontend   | `cd "...\frontend"` → `npm run dev`                 |
| App        | http://localhost:3000                              |

## Optional: stop Redis when done
```powershell
docker stop cloudfuze-redis
```
To start it again later:
```powershell
docker start cloudfuze-redis
```
