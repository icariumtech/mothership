from django.db import models
from django.contrib.auth.models import User


class ActiveView(models.Model):
    """
    Tracks what the shared terminal is currently displaying.
    Stores just the location slug, view type, and view slug to identify what to load from disk.
    Singleton model - only one record should exist.
    """
    VIEW_TYPE_CHOICES = [
        ('MESSAGES', 'Broadcast Messages'),
        ('COMM_TERMINAL', 'Communications Terminal'),
        ('ENCOUNTER_MAP', 'Encounter Map'),
        ('SHIP_DASHBOARD', 'Ship Dashboard'),
    ]

    # Identifiers to locate the view data on disk
    location_slug = models.CharField(
        max_length=200,
        blank=True,
        help_text='Directory name under data/locations/'
    )
    view_type = models.CharField(
        max_length=50,
        choices=VIEW_TYPE_CHOICES,
        default='MESSAGES',
        help_text='Type of view to display'
    )
    view_slug = models.CharField(
        max_length=200,
        blank=True,
        help_text='Specific terminal/map slug (e.g., commanders_terminal)'
    )

    # Metadata
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Active Display View"
        verbose_name_plural = "Active Display View"

    def __str__(self):
        if self.view_type == 'MESSAGES':
            return "Displaying: Broadcast Messages"
        return f"Displaying: {self.location_slug}/{self.view_slug} ({self.get_view_type_display()})"

    def save(self, *args, **kwargs):
        # Ensure only one ActiveView instance exists
        if not self.pk and ActiveView.objects.exists():
            # Update the existing record instead of creating new
            existing = ActiveView.objects.first()
            self.pk = existing.pk
        return super().save(*args, **kwargs)

    @classmethod
    def get_current(cls):
        """Get or create the singleton ActiveView instance."""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class Message(models.Model):
    """
    Terminal messages sent from ship/station AI to crew members.
    CHARON system - ferryman between the living and the void.
    """
    PRIORITY_CHOICES = [
        ('LOW', 'Low Priority'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High Priority'),
        ('CRITICAL', 'Critical Alert'),
    ]

    sender = models.CharField(
        max_length=100,
        default='CHARON',
        help_text='Name of the ship/station AI system'
    )
    content = models.TextField(
        help_text='The message content'
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='NORMAL'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_messages',
        help_text='GM who sent the message'
    )
    recipients = models.ManyToManyField(
        User,
        related_name='received_messages',
        blank=True,
        help_text='Players who can see this message. Empty = all players'
    )
    is_read = models.BooleanField(
        default=False,
        help_text='Has this message been acknowledged by players'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.priority}] {self.sender}: {self.content[:50]}"
