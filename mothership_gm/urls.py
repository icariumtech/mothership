"""
URL configuration for mothership_gm project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('terminal.urls')),  # Remove prefix so URLs are at root
    path('accounts/', include('django.contrib.auth.urls')),
]

# Serve campaign data files (maps, images) in development
if settings.DEBUG:
    from django.views.static import serve
    import os

    data_root = os.path.join(settings.BASE_DIR, 'data')
    urlpatterns += [
        path('data/<path:path>', serve, {'document_root': data_root}),
    ]
