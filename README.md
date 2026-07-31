# AI-Driven Adaptive Flash Learning System

An AI-powered web platform for teachers and students.  
Teachers can upload study materials (PDF, DOCX, PPT, images), and the system generates adaptive flashcards.  
Students practice with flashcards, submit answers, and receive mastery analytics.

---

## 🚀 Project Structure

ai_flashcard_system/
│
├── backend/        # Django backend (REST API)
├── frontend/       # React frontend (Vite)
└── README.md


---

## ⚙️ Backend Setup (Django)

1. Navigate to backend folder:
   ```bash
   cd backend

2. Create virtual environment:
python -m venv venv
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate      # Windows

3. Install dependencies:
pip install -r requirements.txt

4. Run migrations:
python manage.py migrate

5. Start server:
python manage.py runserver

Backend runs at: http://127.0.0.1:8000/api/ (127.0.0.1 in Browser)

⚙️ Background Task Queue (Redis + Celery)

Flashcard generation (the Gemini AI call) runs as a background Celery task so
uploads return immediately instead of blocking for 15-30+ seconds. This needs
a Redis instance and a running Celery worker alongside the Django server.

1. Start Redis (via Docker Desktop):
docker run -d --name flashcard-redis -p 6379:6379 redis:7-alpine

2. Set the broker URL in backend/.env (defaults to this value if omitted):
CELERY_BROKER_URL=redis://localhost:6379/0

3. Start the Celery worker (in a separate terminal, venv activated):
cd backend
celery -A config worker -l info --pool=solo

`--pool=solo` is required on Windows — Celery's default prefork pool needs
`os.fork`, which Windows doesn't support.

Without a running worker, uploads will be accepted (`generation_status: PROCESSING`)
but flashcards will never actually generate until a worker picks up the task.
The test suite doesn't need Redis or a worker running — tasks execute
synchronously (eager mode) under pytest.



🎨 Frontend Setup (React + Vite)
1. Navigate to frontend folder:
cd frontend

2. Install dependencies:
npm install

3. Start development server:
npm run dev

Frontend runs at: http://localhost:3000


🔑 Authentication
Login via /login (JWT token issued by backend).

Token is stored in localStorage and automatically attached to API requests.

📊 Teacher Flow
/teacher → Upload materials + view list.

Upload endpoint: POST /api/teacher/upload/

Materials list: GET /api/materials/

🎓 Student Flow
/student/:materialId → Fetch flashcards + submit answers.

Flashcard queue: GET /api/materials/:id/queue/

Submit answers: POST /api/flashcards/submit/

Analytics displayed after each answer.

📄 Additional Documentation

- [PRIVACY_AND_ETHICS.md](PRIVACY_AND_ETHICS.md) — what data is collected, how Gemini/AI-generated content is handled, and known data-handling limitations.
- [SUSTAINABILITY.md](SUSTAINABILITY.md) — technical and content maintenance plan for keeping the system running and accurate over time.