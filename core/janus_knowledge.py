"""
JANUS Knowledge Loader
Loads knowledge from location.yaml files and AI-generated janus.yaml context files.

janus.yaml files are written by an external AI agent (via the MCP write_file tool)
and contain pre-processed lore context for each location.
"""
from pathlib import Path
from typing import Dict, Any, List, Optional
import yaml
from django.conf import settings


class JanusKnowledgeLoader:
    """Loads and assembles knowledge for a JANUS instance."""

    def __init__(self, location_path: str):
        """
        Args:
            location_path: Path to location directory relative to data/galaxy/
                           e.g., "anchor-system/veil-station"
        """
        self.location_path = location_path
        self.base_path = Path(settings.BASE_DIR) / 'data' / 'galaxy'

    def load_knowledge(self) -> Dict[str, Any]:
        """Load all knowledge for this JANUS instance."""
        knowledge = {
            'location_chain': [],
            'lore_content': '',
            'instance_config': {},
        }

        knowledge['location_chain'] = self._load_location_chain()

        # Load AI-generated context from janus.yaml if present
        janus_file = self.base_path / self.location_path / 'janus.yaml'
        if janus_file.exists():
            with open(janus_file) as f:
                janus_data = yaml.safe_load(f) or {}
            knowledge['lore_content'] = janus_data.get('context', '')

        # Load JANUS instance config if exists
        instance_path = self.base_path / self.location_path / 'janus' / 'instance.yaml'
        if instance_path.exists():
            with open(instance_path) as f:
                knowledge['instance_config'] = yaml.safe_load(f) or {}

        return knowledge

    def _load_location_chain(self) -> List[Dict[str, Any]]:
        """Load location.yaml from current location and all parents."""
        chain = []
        parts = Path(self.location_path).parts

        for i in range(1, len(parts) + 1):
            partial_path = Path(*parts[:i])
            location_data = self._load_location_yaml(str(partial_path))
            if location_data:
                location_data['_path'] = str(partial_path)
                chain.append(location_data)

        return chain

    def _load_location_yaml(self, rel_path: str) -> Optional[Dict[str, Any]]:
        """Load a single location.yaml file."""
        yaml_path = self.base_path / rel_path / 'location.yaml'
        if yaml_path.exists():
            with open(yaml_path) as f:
                return yaml.safe_load(f) or {}
        return None

    def build_context_string(self, knowledge: Dict[str, Any] = None) -> str:
        """Build a context string for injecting into JANUS's prompt."""
        if knowledge is None:
            knowledge = self.load_knowledge()

        sections = []

        # Add instance identity
        instance = knowledge.get('instance_config', {})
        if instance:
            sections.append("[SYSTEM IDENTITY]")
            sections.append(f"Instance ID: {instance.get('instance_id', 'UNKNOWN')}")
            sections.append(f"Clearance Level: {instance.get('clearance_level', 'PUBLIC')}")
            sections.append("")

        # Add location chain as hierarchical context
        location_chain = knowledge.get('location_chain', [])
        if location_chain:
            sections.append("[LOCATION HIERARCHY]")
            for loc in location_chain:
                loc_type = loc.get('type', 'unknown')
                loc_name = loc.get('name', 'Unknown')
                sections.append(f"- {loc_type.upper()}: {loc_name}")
                if 'status' in loc:
                    sections.append(f"  Status: {loc['status']}")
                if 'description' in loc:
                    desc = loc['description'][:200]
                    if len(loc['description']) > 200:
                        desc += "..."
                    sections.append(f"  Info: {desc}")
            sections.append("")

        # Add AI-generated lore context
        lore = knowledge.get('lore_content', '')
        if lore:
            sections.append("[DATABANK RECORDS]")
            sections.append(lore)
            sections.append("")

        return '\n'.join(sections)


def load_janus_context(location_path: str) -> str:
    """
    Convenience function to load JANUS context for a location.

    Args:
        location_path: Path like "anchor-system/veil-station"

    Returns:
        Context string for JANUS prompt
    """
    loader = JanusKnowledgeLoader(location_path)
    return loader.build_context_string()
