# Setup & Run Guide — Execute Project from Scratch

Use **your actual path**: `C:\Users\ChaitanyaMalle\CF AI`.

---

## Part 1: Prerequisites

- **Python 3.11+** (for backend)
- **Node.js 18+** and **npm** (for frontend)
- **Docker Desktop** (for Redis)

---

## Part 2: Redis (required for chat memory)

### Step 1: Start Docker Desktop
- Open **Docker Desktop**. Wait until it shows **“Docker Desktop is running”**.

### Step 2: Run Redis
In PowerShell (or Terminal):

```powershell
docker run -d -p 6379:6379 --name cloudfuze-redis redis
```

*(If the image isn’t present, run `docker pull redis` first.)*

### Step 3: Confirm Redis is running
```powershell
docker ps
```
You should see **cloudfuze-redis** with port **6379:6379**.

---

## Part 3: Backend (Python agent)

### Step 4: Go to backend folder
```powershell
cd "C:\Users\ChaitanyaMalle\CF AI\backend"
```

### Step 5: Create virtual environment (first time only)
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

*(If you get an execution policy error, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`)*

### Step 6: Install dependencies (first time only)
```powershell
pip install -r requirements.txt
```

### Step 7: Configure environment
- Copy `.env.example` to `.env` if you don’t have `.env` yet:
  ```powershell
  copy .env.example .env
  ```
- Edit `.env` and set:
  - **OPENAI_API_KEY** — your OpenAI API key
  - **CLOUDFUZE_TOKEN** — your CloudFuze bearer token  
  *(Other values have defaults; see `.env.example`.)*

### Step 8: Start the backend
```powershell
python main.py
```
Leave this terminal open. Backend will run at **http://localhost:8082** (API docs: http://localhost:8082/docs).

---

## Part 4: Frontend (Next.js)

### Step 9: Open a new terminal
Keep the backend terminal running. Open a second terminal.

### Step 10: Go to frontend folder
```powershell
cd "C:\Users\ChaitanyaMalle\CF AI\frontend"
```

### Step 11: Install dependencies (first time only)
```powershell
npm install
```

### Step 12: Start the frontend
```powershell
npm run dev
```
Leave this terminal open. Frontend will run at **http://localhost:3000**.

---

## Part 5: Use the app

### Step 13: Open in browser
- Open **http://localhost:3000** in Chrome or Edge.
- Chat is stored in Redis (cloudfuze-redis on port 6379).

---

## Quick reference

| Component | Command / URL |
|-----------|----------------|
| Redis     | `docker run -d -p 6379:6379 --name cloudfuze-redis redis` then `docker ps` |
| Backend   | `cd "...\backend"` → activate venv → `python main.py` |
| Frontend  | `cd "...\frontend"` → `npm run dev` |
| App       | http://localhost:3000 |
| API docs  | http://localhost:8082/docs |

## Optional: Stop Redis when done
```powershell
docker stop cloudfuze-redis
```
To start again later:
```powershell
docker start cloudfuze-redis
```
