"""
CHARON Terminal session-based conversation manager.
Stores conversations in Django cache with TTL for session-only persistence.
"""
from django.core.cache import cache
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid


CACHE_PREFIX = "charon_"
CACHE_TTL = 3600 * 4  # 4 hour TTL for conversations


class CharonMessage:
    """Single message in CHARON conversation."""

    def __init__(
        self,
        role: str,
        content: str,
        timestamp: str = None,
        message_id: str = None,
        pending_approval: bool = False
    ):
        self.message_id = message_id or str(uuid.uuid4())
        self.role = role  # 'user', 'charon', 'pending'
        self.content = content
        self.timestamp = timestamp or datetime.now().isoformat()
        self.pending_approval = pending_approval

    def to_dict(self) -> Dict[str, Any]:
        return {
            'message_id': self.message_id,
            'role': self.role,
            'content': self.content,
            'timestamp': self.timestamp,
            'pending_approval': self.pending_approval,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CharonMessage':
        return cls(
            role=data['role'],
            content=data['content'],
            timestamp=data.get('timestamp'),
            message_id=data.get('message_id'),
            pending_approval=data.get('pending_approval', False),
        )


class CharonSessionManager:
    """Manages CHARON conversation state in cache."""

    @staticmethod
    def get_conversation(channel: str = "default") -> List[Dict[str, Any]]:
        """Get current conversation messages for a specific channel."""
        return cache.get(f"{CACHE_PREFIX}{channel}_conversation", [])

    @staticmethod
    def add_message(message: CharonMessage, channel: str = "default") -> None:
        """Add message to conversation for a specific channel."""
        conversation = CharonSessionManager.get_conversation(channel)
        conversation.append(message.to_dict())
        cache.set(f"{CACHE_PREFIX}{channel}_conversation", conversation, CACHE_TTL)
        # Auto-register channel when first message is added
        CharonSessionManager.register_channel(channel)

    @staticmethod
    def get_pending_responses(channel: str = "default") -> List[Dict[str, Any]]:
        """Get AI responses pending GM approval for a specific channel."""
        return cache.get(f"{CACHE_PREFIX}{channel}_pending", [])

    @staticmethod
    def add_pending_response(query: str, response: str, query_id: str, channel: str = "default") -> str:
        """
        Add AI response to pending queue for a specific channel.
        Returns pending_id.
        """
        pending = CharonSessionManager.get_pending_responses(channel)
        pending_id = str(uuid.uuid4())
        pending.append({
            'pending_id': pending_id,
            'query_id': query_id,
            'query': query,
            'response': response,
            'timestamp': datetime.now().isoformat(),
        })
        cache.set(f"{CACHE_PREFIX}{channel}_pending", pending, CACHE_TTL)
        return pending_id

    @staticmethod
    def get_pending_by_id(pending_id: str, channel: str = "default") -> Optional[Dict[str, Any]]:
        """Get a specific pending response by ID for a channel."""
        pending = CharonSessionManager.get_pending_responses(channel)
        for item in pending:
            if item['pending_id'] == pending_id:
                return item
        return None

    @staticmethod
    def approve_response(pending_id: str, modified_content: str = None, channel: str = "default") -> bool:
        """
        Approve pending response, optionally with modifications.
        Adds the approved message to the conversation.
        Returns True if successful.
        """
        pending = CharonSessionManager.get_pending_responses(channel)
        for item in pending:
            if item['pending_id'] == pending_id:
                # Add approved message to conversation
                content = modified_content if modified_content is not None else item['response']
                msg = CharonMessage(role='charon', content=content)
                CharonSessionManager.add_message(msg, channel)
                # Remove from pending
                pending.remove(item)
                cache.set(f"{CACHE_PREFIX}{channel}_pending", pending, CACHE_TTL)
                return True
        return False

    @staticmethod
    def reject_response(pending_id: str, channel: str = "default") -> bool:
        """
        Reject and remove pending response for a channel.
        Returns True if successful.
        """
        pending = CharonSessionManager.get_pending_responses(channel)
        for item in pending:
            if item['pending_id'] == pending_id:
                pending.remove(item)
                cache.set(f"{CACHE_PREFIX}{channel}_pending", pending, CACHE_TTL)
                return True
        return False

    @staticmethod
    def clear_conversation(channel: str = "default") -> None:
        """Clear all conversation data for a specific channel."""
        cache.delete(f"{CACHE_PREFIX}{channel}_conversation")
        cache.delete(f"{CACHE_PREFIX}{channel}_pending")

    @staticmethod
    def get_message_count(channel: str = "default") -> int:
        """Get the number of messages in the conversation for a channel."""
        return len(CharonSessionManager.get_conversation(channel))

    @staticmethod
    def get_pending_count(channel: str = "default") -> int:
        """Get the number of pending responses for a channel."""
        return len(CharonSessionManager.get_pending_responses(channel))

    @staticmethod
    def register_channel(channel: str) -> None:
        """Register a channel as active (adds to tracked list if not already present)."""
        channels = cache.get(f"{CACHE_PREFIX}active_channels", ["default", "bridge"])
        if channel not in channels:
            channels.append(channel)
            cache.set(f"{CACHE_PREFIX}active_channels", channels, CACHE_TTL)

    @staticmethod
    def get_all_channels() -> List[str]:
        """Get list of all active CHARON channels."""
        # Django cache doesn't have a native way to list keys by pattern
        # So we'll track channels in a separate cache key
        return cache.get(f"{CACHE_PREFIX}active_channels", ["default", "bridge"])

    @staticmethod
    def get_unread_count(channel: str, last_read_message_id: str = None) -> int:
        """
        Get count of unread messages in a channel.
        If last_read_message_id is provided, counts messages after that ID.
        Otherwise, counts all user messages without a charon response.
        """
        conversation = CharonSessionManager.get_conversation(channel)
        if not conversation:
            return 0

        if last_read_message_id:
            # Find index of last read message
            last_read_index = -1
            for i, msg in enumerate(conversation):
                if msg['message_id'] == last_read_message_id:
                    last_read_index = i
                    break
            # Count messages after last read
            return len(conversation) - (last_read_index + 1) if last_read_index >= 0 else 0
        else:
            # Count user queries without responses
            unread = 0
            for i, msg in enumerate(conversation):
                if msg['role'] == 'user':
                    # Check if next message is a charon response
                    if i + 1 >= len(conversation) or conversation[i + 1]['role'] != 'charon':
                        unread += 1
            return unread

    @staticmethod
    def mark_channel_read(channel: str, gm_user_id: int = None) -> None:
        """Mark all messages in a channel as read by GM."""
        key = f"{CACHE_PREFIX}{channel}_last_read"
        conversation = CharonSessionManager.get_conversation(channel)
        if conversation:
            last_message_id = conversation[-1]['message_id']
            cache.set(key, {
                'message_id': last_message_id,
                'timestamp': datetime.now().isoformat(),
                'user_id': gm_user_id,
            }, CACHE_TTL)

    @staticmethod
    def get_last_read(channel: str) -> Optional[Dict[str, Any]]:
        """Get last read marker for a channel."""
        return cache.get(f"{CACHE_PREFIX}{channel}_last_read")
