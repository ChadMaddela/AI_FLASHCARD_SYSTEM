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