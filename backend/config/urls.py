from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Admin panel
    path('admin/', admin.site.urls),

    # Delegate all API paths cleanly to the core application route layer
    path('api/', include('core.urls')),
]