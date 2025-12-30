"""
CHARON Knowledge Loader
Loads knowledge from location.yaml files and linked Obsidian notes.
"""
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import yaml
from django.conf import settings


class CharonKnowledgeLoader:
    """Loads and assembles knowledge for a CHARON instance."""

    def __init__(self, location_path: str):
        """
        Initialize loader for a specific CHARON location.
        
        Args:
            location_path: Path to location directory relative to data/galaxy/locations/
                          e.g., "anchor-system/veil-station"
        """
        self.location_path = location_path
        self.base_path = Path(settings.BASE_DIR) / 'data' / 'galaxy'
        self.vault_path = Path(settings.OBSIDIAN_VAULT_PATH) if settings.OBSIDIAN_VAULT_PATH else None
        
    def load_knowledge(self) -> Dict[str, Any]:
        """
        Load all knowledge for this CHARON instance.
        
        Returns:
            Dict with 'location_data', 'lore_content', and 'instance_config'
        """
        knowledge = {
            'location_chain': [],  # Inherited location.yaml data
            'lore_content': '',    # Extracted Obsidian content
            'instance_config': {}, # CHARON instance configuration
        }
        
        # Load location chain (walk up the tree)
        knowledge['location_chain'] = self._load_location_chain()
        
        # Load lore from Obsidian if configured
        current_location = self._load_location_yaml(self.location_path)
        if current_location and 'lore' in current_location:
            knowledge['lore_content'] = self._load_obsidian_lore(current_location['lore'])
        
        # Load CHARON instance config if exists
        instance_path = self.base_path / self.location_path / 'charon' / 'instance.yaml'
        if instance_path.exists():
            with open(instance_path, 'r') as f:
                knowledge['instance_config'] = yaml.safe_load(f) or {}
        
        return knowledge
    
    def _load_location_chain(self) -> List[Dict[str, Any]]:
        """Load location.yaml from current location and all parents."""
        chain = []
        parts = Path(self.location_path).parts
        
        # Walk from root to current, building path incrementally
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
            with open(yaml_path, 'r') as f:
                return yaml.safe_load(f) or {}
        return None
    
    def _load_obsidian_lore(self, lore_config: Dict[str, Any]) -> str:
        """
        Load and filter content from an Obsidian note.
        
        Args:
            lore_config: Dict with 'note', 'charon_sections', 'exclude_patterns'
        """
        if not self.vault_path:
            return ""
        
        note_path = lore_config.get('note', '')
        if not note_path:
            return ""
        
        full_path = self.vault_path / note_path
        if not full_path.exists():
            return f"[LORE FILE NOT FOUND: {note_path}]"
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Get allowed and excluded sections
        allowed_sections = lore_config.get('charon_sections', [])
        exclude_patterns = lore_config.get('exclude_patterns', [
            r'^GM Notes',
            r'^Secrets',
            r'^Session',
            r'^Adventure Hooks',
            r'^Campaign',
        ])
        
        # Extract only allowed sections
        if allowed_sections:
            content = self._extract_sections(content, allowed_sections, exclude_patterns)
        else:
            # If no sections specified, just apply exclusions
            content = self._apply_exclusions(content, exclude_patterns)
        
        # Clean up wiki-links [[Link]] -> Link
        content = self._strip_wiki_links(content)
        
        return content.strip()
    
    def _extract_sections(
        self, 
        content: str, 
        allowed_sections: List[str],
        exclude_patterns: List[str]
    ) -> str:
        """Extract only specified sections from markdown content."""
        lines = content.split('\n')
        result = []
        current_section = None
        current_level = 0
        in_allowed_section = False
        
        for line in lines:
            # Check for header
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                level = len(header_match.group(1))
                section_name = header_match.group(2).strip()
                
                # Check if this section is excluded
                excluded = any(re.match(pattern, section_name, re.IGNORECASE) 
                             for pattern in exclude_patterns)
                
                if excluded:
                    in_allowed_section = False
                    continue
                
                # Check if this section is in allowed list
                # Support both exact match and prefix match (e.g., "Overview" matches "## Overview")
                is_allowed = any(
                    section_name.lower().startswith(allowed.lower()) or
                    allowed.lower() in section_name.lower()
                    for allowed in allowed_sections
                )
                
                if is_allowed:
                    in_allowed_section = True
                    current_level = level
                    result.append(line)
                elif in_allowed_section:
                    # Check if we're still in a subsection of an allowed section
                    if level > current_level:
                        result.append(line)
                    else:
                        in_allowed_section = False
            elif in_allowed_section:
                result.append(line)
        
        return '\n'.join(result)
    
    def _apply_exclusions(self, content: str, exclude_patterns: List[str]) -> str:
        """Remove excluded sections from content."""
        lines = content.split('\n')
        result = []
        skip_until_level = None
        
        for line in lines:
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                level = len(header_match.group(1))
                section_name = header_match.group(2).strip()
                
                # Check if this section should be excluded
                excluded = any(re.match(pattern, section_name, re.IGNORECASE) 
                             for pattern in exclude_patterns)
                
                if excluded:
                    skip_until_level = level
                    continue
                elif skip_until_level is not None:
                    if level <= skip_until_level:
                        skip_until_level = None
                    else:
                        continue
                        
                result.append(line)
            elif skip_until_level is None:
                result.append(line)
        
        return '\n'.join(result)
    
    def _strip_wiki_links(self, content: str) -> str:
        """Convert [[wiki-links]] to plain text."""
        # [[Link|Display]] -> Display
        content = re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]', r'\2', content)
        # [[Link]] -> Link
        content = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content)
        return content
    
    def build_context_string(self, knowledge: Dict[str, Any] = None) -> str:
        """
        Build a context string suitable for injecting into CHARON's prompt.
        
        Args:
            knowledge: Pre-loaded knowledge dict, or None to load fresh
        """
        if knowledge is None:
            knowledge = self.load_knowledge()
        
        sections = []
        
        # Add instance identity
        instance = knowledge.get('instance_config', {})
        if instance:
            sections.append(f"[SYSTEM IDENTITY]")
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
                    # Truncate long descriptions
                    desc = loc['description'][:200]
                    if len(loc['description']) > 200:
                        desc += "..."
                    sections.append(f"  Info: {desc}")
            sections.append("")
        
        # Add lore content
        lore = knowledge.get('lore_content', '')
        if lore:
            sections.append("[DATABANK RECORDS]")
            sections.append(lore)
            sections.append("")
        
        return '\n'.join(sections)


def load_charon_context(location_path: str) -> str:
    """
    Convenience function to load CHARON context for a location.
    
    Args:
        location_path: Path like "anchor-system/veil-station"
        
    Returns:
        Context string for CHARON prompt
    """
    loader = CharonKnowledgeLoader(location_path)
    return loader.build_context_string()
