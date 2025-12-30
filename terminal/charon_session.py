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
    def get_conversation() -> List[Dict[str, Any]]:
        """Get current conversation messages."""
        return cache.get(f"{CACHE_PREFIX}conversation", [])

    @staticmethod
    def add_message(message: CharonMessage) -> None:
        """Add message to conversation."""
        conversation = CharonSessionManager.get_conversation()
        conversation.append(message.to_dict())
        cache.set(f"{CACHE_PREFIX}conversation", conversation, CACHE_TTL)

    @staticmethod
    def get_pending_responses() -> List[Dict[str, Any]]:
        """Get AI responses pending GM approval."""
        return cache.get(f"{CACHE_PREFIX}pending", [])

    @staticmethod
    def add_pending_response(query: str, response: str, query_id: str) -> str:
        """
        Add AI response to pending queue.
        Returns pending_id.
        """
        pending = CharonSessionManager.get_pending_responses()
        pending_id = str(uuid.uuid4())
        pending.append({
            'pending_id': pending_id,
            'query_id': query_id,
            'query': query,
            'response': response,
            'timestamp': datetime.now().isoformat(),
        })
        cache.set(f"{CACHE_PREFIX}pending", pending, CACHE_TTL)
        return pending_id

    @staticmethod
    def get_pending_by_id(pending_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific pending response by ID."""
        pending = CharonSessionManager.get_pending_responses()
        for item in pending:
            if item['pending_id'] == pending_id:
                return item
        return None

    @staticmethod
    def approve_response(pending_id: str, modified_content: str = None) -> bool:
        """
        Approve pending response, optionally with modifications.
        Adds the approved message to the conversation.
        Returns True if successful.
        """
        pending = CharonSessionManager.get_pending_responses()
        for item in pending:
            if item['pending_id'] == pending_id:
                # Add approved message to conversation
                content = modified_content if modified_content is not None else item['response']
                msg = CharonMessage(role='charon', content=content)
                CharonSessionManager.add_message(msg)
                # Remove from pending
                pending.remove(item)
                cache.set(f"{CACHE_PREFIX}pending", pending, CACHE_TTL)
                return True
        return False

    @staticmethod
    def reject_response(pending_id: str) -> bool:
        """
        Reject and remove pending response.
        Returns True if successful.
        """
        pending = CharonSessionManager.get_pending_responses()
        for item in pending:
            if item['pending_id'] == pending_id:
                pending.remove(item)
                cache.set(f"{CACHE_PREFIX}pending", pending, CACHE_TTL)
                return True
        return False

    @staticmethod
    def clear_conversation() -> None:
        """Clear all conversation data."""
        cache.delete(f"{CACHE_PREFIX}conversation")
        cache.delete(f"{CACHE_PREFIX}pending")

    @staticmethod
    def get_message_count() -> int:
        """Get the number of messages in the conversation."""
        return len(CharonSessionManager.get_conversation())

    @staticmethod
    def get_pending_count() -> int:
        """Get the number of pending responses."""
        return len(CharonSessionManager.get_pending_responses())
