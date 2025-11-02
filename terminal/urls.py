from django.urls import path
from . import views

urlpatterns = [
    path('terminal/', views.display_view, name='terminal'),  # Shared public display (no login)
    path('messages/', views.terminal_view, name='messages'),  # Personal player messages (requires login)
    path('gmconsole/', views.gm_console, name='gm_console'),  # GM controls (requires login)
    path('logout/', views.logout_view, name='terminal_logout'),
    path('api/messages/', views.get_messages_json, name='messages_api'),
]
