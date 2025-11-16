from django.urls import path
from . import views

urlpatterns = [
    path('terminal/', views.display_view, name='terminal'),  # Shared public display (no login)
    path('messages/', views.terminal_view, name='messages'),  # Personal player messages (requires login)
    path('gmconsole/', views.gm_console, name='gm_console'),  # GM controls (requires login)
    path('logout/', views.logout_view, name='terminal_logout'),
    path('api/messages/', views.get_messages_json, name='messages_api'),
    path('api/active-view/', views.get_active_view_json, name='active_view_api'),
    path('api/star-map/', views.get_star_map_json, name='star_map_api'),
    path('api/system-map/<str:system_slug>/', views.get_system_map_json, name='system_map_api'),
    path('api/orbit-map/<str:system_slug>/<str:body_slug>/', views.get_orbit_map_json, name='orbit_map_api'),
]
