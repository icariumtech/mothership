from django.db import models
from django.contrib.auth.models import User


class ActiveView(models.Model):
    """
    Tracks what the shared terminal is currently displaying.
    Stores just the location slug, view type, and view slug to identify what to load from disk.
    Singleton model - only one record should exist.
    """
    VIEW_TYPE_CHOICES = [
        ('STANDBY', 'Standby Screen'),
        ('BRIDGE', 'Bridge'),
        ('ENCOUNTER', 'Encounter Display'),
        ('COMM_TERMINAL', 'Communications Terminal'),
        ('MESSAGES', 'Broadcast Messages'),
        ('SHIP_DASHBOARD', 'Ship Dashboard'),
        ('CHARON_TERMINAL', 'CHARON Interactive Terminal'),
    ]

    CHARON_MODE_CHOICES = [
        ('DISPLAY', 'Display Only'),
        ('QUERY', 'Query Mode'),
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
        default='STANDBY',
        help_text='Type of view to display'
    )
    view_slug = models.CharField(
        max_length=200,
        blank=True,
        help_text='Specific terminal/map slug (e.g., commanders_terminal)'
    )

    # Terminal overlay (shown on top of the main view)
    overlay_location_slug = models.CharField(
        max_length=200,
        blank=True,
        help_text='Location of terminal to overlay on main view'
    )
    overlay_terminal_slug = models.CharField(
        max_length=200,
        blank=True,
        help_text='Terminal slug to show as overlay'
    )

    # CHARON Terminal specific fields
    charon_mode = models.CharField(
        max_length=20,
        choices=CHARON_MODE_CHOICES,
        default='DISPLAY',
        help_text='CHARON terminal interaction mode'
    )
    charon_location_path = models.CharField(
        max_length=500,
        blank=True,
        help_text='Path to active CHARON instance (e.g., "tau-ceti/tau-ceti-f/verdant-base")'
    )
    charon_dialog_open = models.BooleanField(
        default=False,
        help_text='Whether the CHARON dialog overlay is visible to players'
    )
    charon_active_channel = models.CharField(
        max_length=200,
        default='story',
        help_text='Active CHARON channel (story, bridge, encounter-{slug})'
    )

    # Multi-level encounter map fields
    encounter_level = models.IntegerField(
        default=1,
        help_text='Current deck/level being displayed (1-indexed)'
    )
    encounter_deck_id = models.CharField(
        max_length=100,
        blank=True,
        help_text='ID of current deck (e.g., "deck_1")'
    )
    encounter_room_visibility = models.JSONField(
        default=dict,
        blank=True,
        help_text='Map of room_id -> visible (bool) for GM-controlled visibility'
    )
    encounter_door_status = models.JSONField(
        default=dict,
        blank=True,
        help_text='Map of connection_id -> door_status string (runtime override)'
    )

    # Ship status runtime overrides
    ship_system_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text='Runtime overrides for ship system states {system_name: {status, condition, info}}'
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
