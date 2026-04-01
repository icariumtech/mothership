"""
Claude AI integration for JANUS terminal.
Handles API calls to Claude with JANUS personality.
"""
import os
import yaml
import random
from pathlib import Path
from typing import Optional, Dict, Any, List
from django.conf import settings
from .janus_knowledge import JanusKnowledgeLoader


# Module-level cache for JanusAI instances by location path
_janus_cache: Dict[str, 'JanusAI'] = {}


def get_janus_ai(location_path: str = None) -> 'JanusAI':
    """
    Get a cached JanusAI instance for the given location.

    Caches the instance to avoid reloading config and knowledge context
    on every API call. Invalidates cache when location changes.

    Note: The system prompt still gets sent with every Claude API call
    (that's how the API works), but this avoids repeated file I/O.
    """
    global _janus_cache

    cache_key = location_path or '__no_location__'

    # Check if we have a cached instance for this location
    if cache_key in _janus_cache:
        return _janus_cache[cache_key]

    # Create new instance and cache it
    instance = JanusAI(location_path=location_path)
    _janus_cache[cache_key] = instance

    return instance


def clear_janus_cache():
    """Clear all cached JanusAI instances."""
    global _janus_cache
    _janus_cache.clear()


class JanusAI:
    """Manages Claude API integration for JANUS responses."""

    def __init__(self, location_path: str = None):
        """
        Initialize JANUS AI.

        Args:
            location_path: Path to JANUS's location (e.g., "anchor-system/veil-station")
                          If None, JANUS has no location-specific knowledge.
        """
        self.client = None
        self.location_path = location_path
        self.config = self._load_config()
        self.knowledge_context = self._load_knowledge_context()
        self._init_client()

    def _load_config(self) -> Dict[str, Any]:
        """Load JANUS configuration from YAML."""
        config_path = Path(settings.BASE_DIR) / 'data' / 'janus' / 'context.yaml'
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        # Fallback config if file not found
        return {
            'name': 'JANUS',
            'system_prompt': 'You are JANUS, a ship AI. Be terse and technical.',
            'max_response_length': 500,
            'temperature': 0.7,
            'fallback_responses': [
                '[SYSTEM ERROR] Unable to process query at this time.',
            ],
        }

    def _load_knowledge_context(self) -> str:
        """Load location-specific knowledge context."""
        if not self.location_path:
            return ""
        try:
            loader = JanusKnowledgeLoader(self.location_path)
            return loader.build_context_string()
        except Exception:
            return ""

    def _init_client(self) -> None:
        """Initialize Anthropic client if API key available."""
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if api_key:
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=api_key)
            except ImportError:
                print("Warning: anthropic package not installed")
                self.client = None
            except Exception as e:
                print(f"Warning: Failed to initialize Anthropic client: {e}")
                self.client = None

    def is_available(self) -> bool:
        """Check if AI is available for generating responses."""
        return self.client is not None

    def _build_system_prompt(self) -> str:
        """Build full system prompt with knowledge context."""
        base_prompt = self.config.get('system_prompt', '')

        if self.knowledge_context:
            return f"{base_prompt}\n\n---\nYOUR DATABANKS CONTAIN:\n{self.knowledge_context}"
        return base_prompt

    def generate_response(
        self,
        query: str,
        conversation_history: List[Dict[str, Any]] = None
    ) -> str:
        """
        Generate JANUS response to player query.
        Returns AI-generated response or fallback if unavailable.
        """
        if not self.client:
            return self._get_fallback_response()

        try:
            # Build messages with conversation history
            messages = []
            if conversation_history:
                # Include last 10 messages for context
                for msg in conversation_history[-10:]:
                    role = 'assistant' if msg['role'] == 'janus' else 'user'
                    messages.append({'role': role, 'content': msg['content']})

            # Add the current query
            messages.append({'role': 'user', 'content': query})

            # Build system prompt with knowledge context
            system_prompt = self._build_system_prompt()

            # Call Claude API
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=self.config.get('max_response_length', 500),
                system=system_prompt,
                messages=messages,
            )

            return response.content[0].text

        except Exception as e:
            print(f"JANUS AI error: {e}")
            return self._get_fallback_response()

    def _get_fallback_response(self) -> str:
        """Return a fallback response when AI is unavailable."""
        fallbacks = self.config.get('fallback_responses', [
            '[SYSTEM ERROR] Unable to process query at this time.',
        ])
        return random.choice(fallbacks)

    def get_config(self) -> Dict[str, Any]:
        """Get the current JANUS configuration."""
        return {
            'name': self.config.get('name', 'JANUS'),
            'designation': self.config.get('designation', 'Unknown'),
            'version': self.config.get('version', '0.0.0'),
            'ai_available': self.is_available(),
        }
