from django.urls import path
from core import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # Authentication (JWT)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Core API endpoints
    path('materials/', views.list_materials, name='list_materials'),
    path('materials/<int:material_id>/delete/', views.delete_material, name='delete_material'),
    path('materials/<int:material_id>/queue/', views.student_card_queue, name='student_card_queue'),
    path('flashcards/submit/', views.submit_answer, name='submit_answer'),
    path('teacher/upload/', views.teacher_upload_material, name='teacher_upload_material'),
    path('user/me/', views.user_me, name='user_me'),

    # Registration & user management (admin)
    path('register/', views.register_user, name='register_user'),
    path('users/', views.list_users, name='list_users'),
    path('users/<int:user_id>/update/', views.update_user, name='update_user'),

    # Learning analytics
    path('analytics/me/', views.my_analytics, name='my_analytics'),
    path('analytics/students/', views.students_analytics_summary, name='students_analytics_summary'),
    path('analytics/students/<int:user_id>/', views.student_analytics_detail, name='student_analytics_detail'),
    path('analytics/class/', views.class_analytics, name='class_analytics'),
    path('analytics/class/pdf/', views.class_analytics_pdf, name='class_analytics_pdf'),
    path('analytics/students/<int:user_id>/pdf/', views.student_analytics_pdf, name='student_analytics_pdf'),

    # Flashcard management
    path('flashcards/', views.list_flashcards, name='list_flashcards'),
    path('flashcards/<int:flashcard_id>/update/', views.update_flashcard, name='update_flashcard'),
    path('flashcards/<int:flashcard_id>/delete/', views.delete_flashcard, name='delete_flashcard'),
    path('materials/<int:material_id>/flashcards/', views.material_flashcards, name='material_flashcards'),
    path('materials/<int:material_id>/flashcards/create/', views.create_flashcard, name='create_flashcard'),

    # Quiz sessions (bounded pretest/posttest/quiz assessments)
    path('quizzes/create/', views.create_quiz_session, name='create_quiz_session'),
    path('materials/<int:material_id>/quizzes/', views.material_quiz_sessions, name='material_quiz_sessions'),
    path('materials/<int:material_id>/quiz-improvement/', views.material_quiz_improvement, name='material_quiz_improvement'),
    path('quizzes/<int:quiz_id>/toggle/', views.toggle_quiz_session, name='toggle_quiz_session'),
    path('quizzes/<int:quiz_id>/results/', views.quiz_session_results, name='quiz_session_results'),
    path('quizzes/available/', views.available_quiz_sessions, name='available_quiz_sessions'),
    path('quizzes/<int:quiz_id>/start/', views.start_quiz_session, name='start_quiz_session'),
    path('quizzes/<int:quiz_id>/submit/', views.submit_quiz_session, name='submit_quiz_session'),

    # Assessment reports (Philippine education standards)
    path('quizzes/<int:quiz_id>/item-analysis/', views.item_analysis_report, name='item_analysis_report'),
    path('quizzes/<int:quiz_id>/competency-mastery/', views.competency_mastery_report, name='competency_mastery_report'),
    path('quizzes/<int:quiz_id>/tos/', views.table_of_specifications_report, name='table_of_specifications_report'),

    # PDF exports
    path('quizzes/<int:quiz_id>/tos/pdf/', views.table_of_specifications_pdf, name='tos_pdf'),
    path('quizzes/<int:quiz_id>/item-analysis/pdf/', views.item_analysis_pdf, name='item_analysis_pdf'),
    path('quizzes/<int:quiz_id>/competency-mastery/pdf/', views.competency_mastery_pdf, name='competency_mastery_pdf'),
]