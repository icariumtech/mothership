from django.urls import path
from . import views

urlpatterns = [
    path('', views.terminal_view, name='terminal'),
    path('gm/', views.gm_console, name='gm_console'),
    path('logout/', views.logout_view, name='terminal_logout'),
    path('api/messages/', views.get_messages_json, name='messages_api'),
]
