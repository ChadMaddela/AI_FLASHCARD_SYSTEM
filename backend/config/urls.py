from django.contrib import admin
from django.urls import path
from core import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # Admin panel
    path('admin/', admin.site.urls),

    # Authentication (JWT)
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Core API endpoints
    path('api/materials/', views.list_materials, name='list_materials'),
    path('api/materials/<int:material_id>/queue/', views.student_card_queue, name='student_card_queue'),
    path('api/flashcards/submit/', views.submit_answer, name='submit_answer'),
    path('api/teacher/upload/', views.teacher_upload_material, name='teacher_upload_material'),
    path('api/user/me/', views.user_me, name='user_me'),

    # Flashcard management
    path("api/flashcards/", views.list_flashcards, name="list_flashcards"),
    path("api/flashcards/<int:flashcard_id>/update/", views.update_flashcard, name="update_flashcard"),
    path("api/flashcards/<int:flashcard_id>/delete/", views.delete_flashcard, name="delete_flashcard"),
]
