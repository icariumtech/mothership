from django.contrib import admin
from .models import Message, ActiveView


@admin.register(ActiveView)
class ActiveViewAdmin(admin.ModelAdmin):
    list_display = ['view_type', 'location_slug', 'view_slug', 'updated_at', 'updated_by']
    readonly_fields = ['updated_at']

    def has_add_permission(self, request):
        # Only allow one ActiveView instance
        return not ActiveView.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion of the singleton
        return False


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'priority', 'content_preview', 'created_at', 'is_read']
    list_filter = ['priority', 'is_read', 'created_at']
    search_fields = ['sender', 'content']
    filter_horizontal = ['recipients']
    readonly_fields = ['created_at']

    def content_preview(self, obj):
        return obj.content[:75] + '...' if len(obj.content) > 75 else obj.content
    content_preview.short_description = 'Content'
