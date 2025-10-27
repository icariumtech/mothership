from django.db import models
from django.contrib.auth.models import User


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
