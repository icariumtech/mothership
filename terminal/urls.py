from django.urls import path
from . import views

urlpatterns = [
    path('terminal/', views.display_view_react, name='terminal'),  # Shared public display (React)
    path('messages/', views.terminal_view_react, name='messages'),  # Personal player messages (React)
    path('gmconsole/', views.gm_console_react, name='gm_console'),  # GM controls (React)
    path('logout/', views.logout_view, name='terminal_logout'),
    path('api/messages/', views.get_messages_json, name='messages_api'),
    path('api/corporation/', views.api_corporation, name='api_corporation'),
    path('api/active-view/stream/', views.api_active_view_stream, name='active_view_stream'),
    path('api/active-view/', views.get_active_view_json, name='active_view_api'),
    path('api/star-map/', views.get_star_map_json, name='star_map_api'),
    path('api/system-map/<str:system_slug>/', views.get_system_map_json, name='system_map_api'),
    path('api/orbit-map/<str:system_slug>/<str:body_slug>/', views.get_orbit_map_json, name='orbit_map_api'),
    # Ship Status API endpoints
    path('api/ship-status/', views.api_ship_status, name='ship_status_api'),
    path('api/gm/ship-status/toggle/', views.api_ship_toggle_system, name='ship_toggle_system'),
    path('api/gm/ship-status/integrity/', views.api_ship_update_integrity, name='ship_update_integrity'),
    # GM Console React API endpoints
    path('api/gm/locations/', views.api_locations, name='api_locations'),
    path('api/gm/crew/', views.api_crew, name='api_crew'),
    path('api/gm/sessions/', views.api_sessions, name='api_sessions'),
    path('api/gm/campaign-docs/', views.api_campaign_docs, name='api_campaign_docs'),
    path('api/gm/campaign-docs/<str:slug>/', views.api_campaign_doc, name='api_campaign_doc'),
    path('api/gm/switch-view/', views.api_switch_view, name='api_switch_view'),
    path('api/gm/show-terminal/', views.api_show_terminal, name='api_show_terminal'),
    path('api/gm/broadcast/', views.api_broadcast, name='api_broadcast'),
    # JANUS Terminal API endpoints
    path('api/janus/conversation/', views.api_janus_conversation, name='janus_conversation'),
    path('api/janus/submit-query/', views.api_janus_submit_query, name='janus_submit_query'),
    path('api/gm/janus/mode/', views.api_janus_switch_mode, name='janus_switch_mode'),
    path('api/gm/janus/location/', views.api_janus_set_location, name='janus_set_location'),
    path('api/gm/janus/send/', views.api_janus_send_message, name='janus_send_message'),
    path('api/gm/janus/generate/', views.api_janus_generate, name='janus_generate'),
    path('api/gm/janus/pending/', views.api_janus_pending, name='janus_pending'),
    path('api/gm/janus/approve/', views.api_janus_approve, name='janus_approve'),
    path('api/gm/janus/reject/', views.api_janus_reject, name='janus_reject'),
    path('api/gm/janus/clear/', views.api_janus_clear, name='janus_clear'),
    path('api/gm/janus/toggle-dialog/', views.api_janus_toggle_dialog, name='janus_toggle_dialog'),
    # JANUS Channel Management API endpoints (multi-channel support)
    path('api/gm/janus/channels/', views.api_janus_channels, name='janus_channels'),
    path('api/janus/<str:channel>/conversation/', views.api_janus_channel_conversation, name='janus_channel_conversation'),
    path('api/janus/<str:channel>/submit/', views.api_janus_channel_submit, name='janus_channel_submit'),
    path('api/gm/janus/<str:channel>/send/', views.api_janus_channel_send, name='janus_channel_send'),
    path('api/gm/janus/<str:channel>/mark-read/', views.api_janus_channel_mark_read, name='janus_channel_mark_read'),
    path('api/gm/janus/<str:channel>/pending/', views.api_janus_channel_pending, name='janus_channel_pending'),
    path('api/gm/janus/<str:channel>/approve/', views.api_janus_channel_approve, name='janus_channel_approve'),
    path('api/gm/janus/<str:channel>/reject/', views.api_janus_channel_reject, name='janus_channel_reject'),
    path('api/gm/janus/<str:channel>/generate/', views.api_janus_channel_generate, name='janus_channel_generate'),
    path('api/gm/janus/<str:channel>/clear/', views.api_janus_channel_clear, name='janus_channel_clear'),
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
    path('api/gm/show-doc/<str:slug>/', views.api_show_doc, name='api_show_doc'),
    path('api/doc/hide/', views.api_hide_doc, name='api_hide_doc'),
    path('api/bridge-selection/', views.api_bridge_selection, name='api_bridge_selection'),
    path('api/gm/ship/set-location/', views.api_set_ship_location, name='api_set_ship_location'),
]
