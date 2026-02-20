from django.urls import path
from . import views

urlpatterns = [
    path('terminal/', views.display_view_react, name='terminal'),  # Shared public display (React)
    path('messages/', views.terminal_view_react, name='messages'),  # Personal player messages (React)
    path('gmconsole/', views.gm_console_react, name='gm_console'),  # GM controls (React)
    path('logout/', views.logout_view, name='terminal_logout'),
    path('api/messages/', views.get_messages_json, name='messages_api'),
    path('api/active-view/', views.get_active_view_json, name='active_view_api'),
    path('api/star-map/', views.get_star_map_json, name='star_map_api'),
    path('api/system-map/<str:system_slug>/', views.get_system_map_json, name='system_map_api'),
    path('api/orbit-map/<str:system_slug>/<str:body_slug>/', views.get_orbit_map_json, name='orbit_map_api'),
    # Ship Status API endpoints
    path('api/ship-status/', views.api_ship_status, name='ship_status_api'),
    path('api/gm/ship-status/toggle/', views.api_ship_toggle_system, name='ship_toggle_system'),
    # GM Console React API endpoints
    path('api/gm/locations/', views.api_locations, name='api_locations'),
    path('api/gm/switch-view/', views.api_switch_view, name='api_switch_view'),
    path('api/gm/show-terminal/', views.api_show_terminal, name='api_show_terminal'),
    path('api/gm/broadcast/', views.api_broadcast, name='api_broadcast'),
    # CHARON Terminal API endpoints
    path('api/charon/conversation/', views.api_charon_conversation, name='charon_conversation'),
    path('api/charon/submit-query/', views.api_charon_submit_query, name='charon_submit_query'),
    path('api/gm/charon/mode/', views.api_charon_switch_mode, name='charon_switch_mode'),
    path('api/gm/charon/location/', views.api_charon_set_location, name='charon_set_location'),
    path('api/gm/charon/send/', views.api_charon_send_message, name='charon_send_message'),
    path('api/gm/charon/generate/', views.api_charon_generate, name='charon_generate'),
    path('api/gm/charon/pending/', views.api_charon_pending, name='charon_pending'),
    path('api/gm/charon/approve/', views.api_charon_approve, name='charon_approve'),
    path('api/gm/charon/reject/', views.api_charon_reject, name='charon_reject'),
    path('api/gm/charon/clear/', views.api_charon_clear, name='charon_clear'),
    path('api/gm/charon/toggle-dialog/', views.api_charon_toggle_dialog, name='charon_toggle_dialog'),
    # CHARON Channel Management API endpoints (multi-channel support)
    path('api/gm/charon/channels/', views.api_charon_channels, name='charon_channels'),
    path('api/charon/<str:channel>/conversation/', views.api_charon_channel_conversation, name='charon_channel_conversation'),
    path('api/charon/<str:channel>/submit/', views.api_charon_channel_submit, name='charon_channel_submit'),
    path('api/gm/charon/<str:channel>/send/', views.api_charon_channel_send, name='charon_channel_send'),
    path('api/gm/charon/<str:channel>/mark-read/', views.api_charon_channel_mark_read, name='charon_channel_mark_read'),
    path('api/gm/charon/<str:channel>/pending/', views.api_charon_channel_pending, name='charon_channel_pending'),
    path('api/gm/charon/<str:channel>/approve/', views.api_charon_channel_approve, name='charon_channel_approve'),
    path('api/gm/charon/<str:channel>/reject/', views.api_charon_channel_reject, name='charon_channel_reject'),
    path('api/gm/charon/<str:channel>/generate/', views.api_charon_channel_generate, name='charon_channel_generate'),
    path('api/gm/charon/<str:channel>/clear/', views.api_charon_channel_clear, name='charon_channel_clear'),
    # Encounter Map API endpoints
    path('api/gm/encounter/switch-level/', views.api_encounter_switch_level, name='encounter_switch_level'),
    path('api/gm/encounter/toggle-room/', views.api_encounter_toggle_room, name='encounter_toggle_room'),
    path('api/gm/encounter/room-visibility/', views.api_encounter_room_visibility, name='encounter_room_visibility'),
    path('api/gm/encounter/set-door-status/', views.api_encounter_set_door_status, name='encounter_set_door_status'),
    path('api/gm/encounter/place-token/', views.api_encounter_place_token, name='encounter_place_token'),
    path('api/gm/encounter/move-token/', views.api_encounter_move_token, name='encounter_move_token'),
    path('api/gm/encounter/remove-token/', views.api_encounter_remove_token, name='encounter_remove_token'),
    path('api/gm/encounter/update-token-status/', views.api_encounter_update_token_status, name='encounter_update_token_status'),
    path('api/gm/encounter/clear-tokens/', views.api_encounter_clear_tokens, name='encounter_clear_tokens'),
    path('api/gm/encounter/toggle-portrait/', views.api_encounter_toggle_portrait, name='encounter_toggle_portrait'),
    path('api/gm/encounter/token-images/', views.api_encounter_token_images, name='encounter_token_images'),
    path('api/encounter-map/<str:location_slug>/all-decks/', views.api_encounter_all_decks, name='encounter_all_decks'),
    path('api/encounter-map/<str:location_slug>/', views.api_encounter_map_data, name='encounter_map_data'),
    # Terminal API endpoints
    path('api/terminal/<str:location_slug>/<str:terminal_slug>/', views.api_terminal_data, name='terminal_data'),
    path('api/terminal/hide/', views.api_hide_terminal, name='api_hide_terminal'),
]
