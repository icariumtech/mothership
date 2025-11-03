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
        self.locations_dir = self.data_dir / "locations"

    def load_all_locations(self) -> List[Dict[str, Any]]:
        """Load all locations from the data directory."""
        locations = []

        if not self.locations_dir.exists():
            return locations

        for location_dir in self.locations_dir.iterdir():
            if location_dir.is_dir():
                location_data = self.load_location(location_dir.name)
                if location_data:
                    locations.append(location_data)

        return locations

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

    def load_maps(self, location_dir: Path) -> List[Dict[str, Any]]:
        """Load all maps for a location."""
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
        """Load a single terminal with all its messages (inbox and sent)."""
        terminal_file = terminal_dir / "terminal.yaml"

        if terminal_file.exists():
            with open(terminal_file, 'r') as f:
                terminal_data = yaml.safe_load(f)
        else:
            terminal_data = {"owner": terminal_dir.name}

        terminal_data['slug'] = terminal_dir.name

        # Load inbox messages
        terminal_data['inbox'] = self.load_message_folder(terminal_dir / "inbox")

        # Load sent messages
        terminal_data['sent'] = self.load_message_folder(terminal_dir / "sent")

        # Combine all messages for backwards compatibility
        terminal_data['messages'] = terminal_data['inbox'] + terminal_data['sent']

        # Sort combined messages by timestamp
        terminal_data['messages'].sort(key=lambda m: m.get('timestamp', ''))

        return terminal_data

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
