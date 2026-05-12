from django.contrib import admin
from .models import Message


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
