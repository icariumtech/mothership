"""
Data loader for campaign data from filesystem.

Loads locations, maps, comm terminals, and messages from the data/ directory.
"""
import os
import yaml
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any


class DataLoader:
    """Loads campaign data from the data/ directory structure."""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.galaxy_dir = self.data_dir / "galaxy"
        # Systems are directly under galaxy/ (no intermediate dirs)
        self.systems_dir = self.galaxy_dir

    def load_all_locations(self) -> List[Dict[str, Any]]:
        """Load all locations from the data directory, building hierarchy from nested dirs."""
        locations = []

        if not self.systems_dir.exists():
            return locations

        # Load all systems (solar systems are top level)
        for system_dir in self.systems_dir.iterdir():
            if system_dir.is_dir() and system_dir.name != '__pycache__':
                location_data = self.load_location_recursive(system_dir)
                if location_data:
                    locations.append(location_data)

        return locations

    def load_location_recursive(self, location_dir: Path) -> Dict[str, Any]:
        """Recursively load a location and all nested child locations."""
        # Load location metadata
        location_file = location_dir / "location.yaml"
        if location_file.exists():
            with open(location_file, 'r') as f:
                location_data = yaml.safe_load(f)
        else:
            location_data = {"name": location_dir.name}

        location_data['slug'] = location_dir.name
        location_data['directory'] = str(location_dir)

        # Load map if exists (single map per location in map/ directory)
        location_data['map'] = self.load_map(location_dir)

        # Set has_map flag for tree selection
        location_data['has_map'] = location_data['map'] is not None

        # For backwards compatibility, also set 'maps' as a list
        location_data['maps'] = [location_data['map']] if location_data['map'] else []

        # Load comm terminals at this level
        location_data['terminals'] = self.load_terminals(location_dir)

        # Recursively load child locations (subdirectories that aren't 'comms' or 'map')
        location_data['children'] = []
        for subdir in location_dir.iterdir():
            if subdir.is_dir() and subdir.name not in ['comms', 'map', 'maps']:
                child_location = self.load_location_recursive(subdir)
                if child_location:
                    location_data['children'].append(child_location)

        return location_data

    def load_location(self, location_slug: str) -> Dict[str, Any]:
        """Load a single location with all its data."""
        location_dir = self.locations_dir / location_slug

        if not location_dir.exists():
            return None

        # Load location metadata
        location_file = location_dir / "location.yaml"
        if location_file.exists():
            with open(location_file, 'r') as f:
                location_data = yaml.safe_load(f)
        else:
            location_data = {"name": location_slug}

        location_data['slug'] = location_slug

        # Load maps
        location_data['maps'] = self.load_maps(location_dir)

        # Load comm terminals
        location_data['terminals'] = self.load_terminals(location_dir)

        return location_data

    def load_encounter_manifest(self, location_dir: Path) -> Dict[str, Any]:
        """Load the multi-deck manifest file if present."""
        manifest_file = location_dir / "map" / "manifest.yaml"
        if manifest_file.exists():
            with open(manifest_file, 'r') as f:
                return yaml.safe_load(f)
        return None

    def load_deck_map(self, location_dir: Path, deck_id: str) -> Dict[str, Any]:
        """Load a specific deck's map data by deck ID."""
        manifest = self.load_encounter_manifest(location_dir)
        if not manifest:
            return None

        # Find the deck in manifest
        for deck in manifest.get('decks', []):
            if deck['id'] == deck_id:
                deck_file = location_dir / "map" / deck['file']
                if deck_file.exists():
                    with open(deck_file, 'r') as f:
                        deck_data = yaml.safe_load(f)
                    deck_data['slug'] = deck_file.stem
                    deck_data['deck_id'] = deck_id

                    # Check for corresponding image file
                    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
                        img_file = deck_file.parent / f"{deck_file.stem}{ext}"
                        if img_file.exists():
                            deck_data['image_path'] = str(img_file.relative_to(self.data_dir))
                            break

                    return deck_data
        return None

    def load_map(self, location_dir: Path) -> Dict[str, Any]:
        """
        Load map(s) for a location from map/ directory.
        Supports both single-deck and multi-deck (manifest) formats.
        """
        map_dir = location_dir / "map"

        if not map_dir.exists():
            return None

        # Check for multi-deck manifest first
        manifest = self.load_encounter_manifest(location_dir)
        if manifest:
            # Find default deck or use first deck
            default_deck = next(
                (d for d in manifest.get('decks', []) if d.get('default')),
                manifest['decks'][0] if manifest.get('decks') else None
            )

            if default_deck:
                deck_data = self.load_deck_map(location_dir, default_deck['id'])
                if deck_data:
                    return {
                        'is_multi_deck': True,
                        'manifest': manifest,
                        'current_deck': deck_data,
                        'current_deck_id': default_deck['id'],
                        'slug': 'manifest',
                    }

        # Fall back to single-deck (look for any .yaml file that's not manifest)
        yaml_files = [f for f in map_dir.glob("*.yaml") if f.name != "manifest.yaml"]
        if not yaml_files:
            return None

        map_file = yaml_files[0]  # Use first yaml file found

        with open(map_file, 'r') as f:
            map_data = yaml.safe_load(f)

        map_slug = map_file.stem
        map_data['slug'] = map_slug

        # Check for corresponding image file
        for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
            img_file = map_dir / f"{map_slug}{ext}"
            if img_file.exists():
                map_data['image_path'] = str(img_file.relative_to(self.data_dir))
                break

        return map_data

    def load_maps(self, location_dir: Path) -> List[Dict[str, Any]]:
        """Load all maps for a location (legacy - supports maps/ directory)."""
        maps = []
        maps_dir = location_dir / "maps"

        if not maps_dir.exists():
            return maps

        # Find all .yaml files (map metadata)
        for map_file in maps_dir.glob("*.yaml"):
            with open(map_file, 'r') as f:
                map_data = yaml.safe_load(f)

            map_slug = map_file.stem
            map_data['slug'] = map_slug

            # Check for corresponding image file
            for ext in ['.png', '.jpg', '.jpeg', '.gif']:
                img_file = maps_dir / f"{map_slug}{ext}"
                if img_file.exists():
                    map_data['image_path'] = str(img_file.relative_to(self.data_dir))
                    break

            maps.append(map_data)

        return maps

    def load_terminals(self, location_dir: Path) -> List[Dict[str, Any]]:
        """Load all comm terminals for a location."""
        terminals = []
        comms_dir = location_dir / "comms"

        if not comms_dir.exists():
            return terminals

        for terminal_dir in comms_dir.iterdir():
            if terminal_dir.is_dir():
                terminal_data = self.load_terminal(terminal_dir)
                if terminal_data:
                    terminals.append(terminal_data)

        return terminals

    def load_terminal(self, terminal_dir: Path) -> Dict[str, Any]:
        """Load a single terminal with all its messages (inbox and sent).

        Supports two message storage modes:
        1. Central message store: All messages in comms/messages/ directory,
           filtered by terminal owner (inbox = to matches, sent = from matches)
        2. Legacy mode: Messages in terminal's inbox/ and sent/ subdirectories
        """
        terminal_file = terminal_dir / "terminal.yaml"

        if terminal_file.exists():
            with open(terminal_file, 'r') as f:
                terminal_data = yaml.safe_load(f)
        else:
            terminal_data = {"owner": terminal_dir.name}

        terminal_data['slug'] = terminal_dir.name
        owner = terminal_data.get('owner', '')

        # Check for central message store (comms/messages/ directory)
        comms_dir = terminal_dir.parent  # This is the comms/ directory
        central_messages_dir = comms_dir / "messages"

        if central_messages_dir.exists() and central_messages_dir.is_dir():
            # Use central message store
            all_messages = self.load_central_messages(central_messages_dir)
            terminal_data['inbox'] = self.filter_messages_for_recipient(all_messages, owner)
            terminal_data['sent'] = self.filter_messages_for_sender(all_messages, owner)
        else:
            # Fall back to legacy inbox/sent folders
            terminal_data['inbox'] = self.load_message_folder(terminal_dir / "inbox")
            terminal_data['sent'] = self.load_message_folder(terminal_dir / "sent")

        # Combine all messages for backwards compatibility
        terminal_data['messages'] = terminal_data['inbox'] + terminal_data['sent']

        # Sort combined messages by timestamp
        terminal_data['messages'].sort(key=lambda m: m.get('timestamp', ''))

        return terminal_data

    def load_central_messages(self, messages_dir: Path) -> List[Dict[str, Any]]:
        """Load all messages from a central messages directory."""
        messages = []

        if not messages_dir.exists():
            return messages

        # Load all .md files directly in the messages directory
        for message_file in sorted(messages_dir.glob("*.md")):
            message_data = self.parse_message_file(message_file)
            if message_data:
                messages.append(message_data)

        # Sort messages by timestamp
        messages.sort(key=lambda m: m.get('timestamp', ''))

        return messages

    def filter_messages_for_recipient(self, messages: List[Dict[str, Any]], owner: str) -> List[Dict[str, Any]]:
        """Filter messages where the owner is the recipient (inbox)."""
        inbox = []
        owner_lower = owner.lower()

        for msg in messages:
            to_field = msg.get('to', '')
            # Check if owner name appears in the 'to' field (case-insensitive)
            if owner_lower in to_field.lower():
                msg_copy = msg.copy()
                msg_copy['folder'] = 'inbox'
                msg_copy['contact'] = msg.get('from', 'Unknown')
                inbox.append(msg_copy)

        inbox.sort(key=lambda m: m.get('timestamp', ''))
        return inbox

    def filter_messages_for_sender(self, messages: List[Dict[str, Any]], owner: str) -> List[Dict[str, Any]]:
        """Filter messages where the owner is the sender (sent)."""
        sent = []
        owner_lower = owner.lower()

        for msg in messages:
            from_field = msg.get('from', '')
            # Check if owner name appears in the 'from' field (case-insensitive)
            if owner_lower in from_field.lower():
                msg_copy = msg.copy()
                msg_copy['folder'] = 'sent'
                msg_copy['contact'] = msg.get('to', 'Unknown')
                sent.append(msg_copy)

        sent.sort(key=lambda m: m.get('timestamp', ''))
        return sent

    def load_message_folder(self, folder_dir: Path) -> List[Dict[str, Any]]:
        """Load all messages from a folder (inbox or sent), organized by contact."""
        messages = []

        if not folder_dir.exists():
            return messages

        # Iterate through contact directories (e.g., dr_chen, commander_drake)
        for contact_dir in folder_dir.iterdir():
            if contact_dir.is_dir():
                contact_name = contact_dir.name

                # Load all .md files in contact directory
                for message_file in sorted(contact_dir.glob("*.md")):
                    message_data = self.parse_message_file(message_file)
                    if message_data:
                        # Add folder type (inbox/sent) to message data
                        message_data['folder'] = folder_dir.name
                        message_data['contact'] = contact_name
                        messages.append(message_data)

        # Sort messages by timestamp
        messages.sort(key=lambda m: m.get('timestamp', ''))

        return messages

    def parse_message_file(self, message_file: Path) -> Dict[str, Any]:
        """Parse a message markdown file with YAML frontmatter."""
        with open(message_file, 'r') as f:
            content = f.read()

        # Split frontmatter and content
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                message_content = parts[2].strip()
            else:
                frontmatter = {}
                message_content = content
        else:
            frontmatter = {}
            message_content = content

        message_data = {
            'content': message_content,
            'filename': message_file.name,
            **frontmatter
        }

        # Convert timestamp string to datetime if present
        if 'timestamp' in message_data and isinstance(message_data['timestamp'], str):
            try:
                message_data['timestamp'] = datetime.fromisoformat(
                    message_data['timestamp'].replace(' ', 'T')
                )
            except ValueError:
                pass

        return message_data

    def find_location_by_slug(self, slug: str, locations: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Find a location by slug anywhere in the hierarchy.
        Searches recursively through all locations and their children.
        """
        if locations is None:
            locations = self.load_all_locations()

        for location in locations:
            if location['slug'] == slug:
                return location

            # Search children recursively
            if location.get('children'):
                found = self.find_location_by_slug(slug, location['children'])
                if found:
                    return found

        return None

    def get_location_path(self, slug: str, locations: List[Dict[str, Any]] = None, path: List[str] = None) -> List[str]:
        """
        Get the full hierarchical path to a location as a list of slugs.
        Returns: ['sol', 'earth', 'research_base_alpha'] for a base on Earth in Sol system.
        """
        if locations is None:
            locations = self.load_all_locations()
        if path is None:
            path = []

        for location in locations:
            current_path = path + [location['slug']]

            if location['slug'] == slug:
                return current_path

            # Search children recursively
            if location.get('children'):
                found_path = self.get_location_path(slug, location['children'], current_path)
                if found_path:
                    return found_path

        return None

    def get_location_by_path(self, path_slugs: List[str]) -> Dict[str, Any]:
        """
        Get a location by following a path of slugs.
        Example: ['sol', 'earth', 'research_base_alpha'] -> location data for Research Base Alpha
        """
        if not path_slugs:
            return None

        # Start at systems level (universe dir)
        location_dir = self.systems_dir

        # Navigate through the path
        for slug in path_slugs:
            location_dir = location_dir / slug
            if not location_dir.exists():
                return None

        # Load the final location
        return self.load_location_recursive(location_dir)

    def load_star_map(self) -> Dict[str, Any]:
        """Load the star map visualization data (galaxy-level view)."""
        star_map_file = self.galaxy_dir / "star_map.yaml"

        if not star_map_file.exists():
            return {}

        with open(star_map_file, 'r') as f:
            star_map_data = yaml.safe_load(f)

        return star_map_data

    def load_system_map(self, system_slug: str) -> Dict[str, Any]:
        """Load solar system visualization for a star system."""
        system_map_file = self.systems_dir / system_slug / "system_map.yaml"

        if not system_map_file.exists():
            return None

        with open(system_map_file, 'r') as f:
            return yaml.safe_load(f)

    def load_orbit_map(self, system_slug: str, body_slug: str) -> Dict[str, Any]:
        """Load orbital visualization for a planet/body."""
        orbit_map_file = self.systems_dir / system_slug / body_slug / "orbit_map.yaml"

        if not orbit_map_file.exists():
            return None

        with open(orbit_map_file, 'r') as f:
            return yaml.safe_load(f)


def group_messages_by_conversation(messages: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group messages by conversation_id.
    Returns a dict mapping conversation_id to list of messages in that conversation.
    Messages without conversation_id are grouped under '__standalone__'.
    """
    conversations = {}

    for msg in messages:
        conv_id = msg.get('conversation_id', '__standalone__')
        if conv_id not in conversations:
            conversations[conv_id] = []
        conversations[conv_id].append(msg)

    # Sort messages within each conversation by timestamp
    for conv_id in conversations:
        conversations[conv_id].sort(key=lambda m: m.get('timestamp', ''))

    return conversations


def build_conversation_thread(messages: List[Dict[str, Any]], conversation_id: str) -> List[Dict[str, Any]]:
    """
    Build a conversation thread from messages with the given conversation_id.
    Orders messages chronologically and links replies.
    """
    thread = [msg for msg in messages if msg.get('conversation_id') == conversation_id]
    thread.sort(key=lambda m: m.get('timestamp', ''))
    return thread


def get_message_by_id(messages: List[Dict[str, Any]], message_id: str) -> Dict[str, Any]:
    """Find a message by its message_id."""
    for msg in messages:
        if msg.get('message_id') == message_id:
            return msg
    return None


# Convenience functions
def get_loader() -> DataLoader:
    """Get a DataLoader instance."""
    return DataLoader()


def load_all_locations() -> List[Dict[str, Any]]:
    """Load all locations from data directory."""
    loader = get_loader()
    return loader.load_all_locations()


def load_location(location_slug: str) -> Dict[str, Any]:
    """Load a specific location by slug."""
    loader = get_loader()
    return loader.load_location(location_slug)
