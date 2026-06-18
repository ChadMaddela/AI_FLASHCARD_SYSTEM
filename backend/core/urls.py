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

    # Flashcard management
    path('flashcards/', views.list_flashcards, name='list_flashcards'),
    path('flashcards/<int:flashcard_id>/update/', views.update_flashcard, name='update_flashcard'),
    path('flashcards/<int:flashcard_id>/delete/', views.delete_flashcard, name='delete_flashcard'),
    path('materials/<int:material_id>/flashcards/', views.material_flashcards, name='material_flashcards'),
    path('materials/<int:material_id>/flashcards/create/', views.create_flashcard, name='create_flashcard')
]