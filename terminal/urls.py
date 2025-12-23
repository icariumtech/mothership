from django.urls import path
from . import views

urlpatterns = [
    path('terminal/', views.display_view_react, name='terminal'),  # Shared public display (React)
    path('messages/', views.terminal_view, name='messages'),  # Personal player messages (requires login)
    path('gmconsole/', views.gm_console_react, name='gm_console'),  # GM controls (React)
    path('logout/', views.logout_view, name='terminal_logout'),
    path('api/messages/', views.get_messages_json, name='messages_api'),
    path('api/active-view/', views.get_active_view_json, name='active_view_api'),
    path('api/star-map/', views.get_star_map_json, name='star_map_api'),
    path('api/system-map/<str:system_slug>/', views.get_system_map_json, name='system_map_api'),
    path('api/orbit-map/<str:system_slug>/<str:body_slug>/', views.get_orbit_map_json, name='orbit_map_api'),
    # GM Console React API endpoints
    path('api/gm/locations/', views.api_locations, name='api_locations'),
    path('api/gm/switch-view/', views.api_switch_view, name='api_switch_view'),
    path('api/gm/show-terminal/', views.api_show_terminal, name='api_show_terminal'),
    path('api/gm/broadcast/', views.api_broadcast, name='api_broadcast'),
]
