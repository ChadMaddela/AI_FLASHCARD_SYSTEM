# core/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Material, Flashcard, StudentPerformance

class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('System Role', {'fields': ('role',)}),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(Material)
admin.site.register(Flashcard)
admin.site.register(StudentPerformance)