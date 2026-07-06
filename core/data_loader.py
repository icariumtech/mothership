"""
Data loader for campaign data from filesystem.

Loads locations, maps, comm terminals, and messages from the data/ directory.
"""
import logging
import os
import tempfile
import threading
import yaml
from pathlib import Path
from datetime import datetime
from typing import Callable, Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# Serializes read-modify-write cycles on ship.yaml across threads.
_ship_yaml_lock = threading.Lock()


class _TerminalReader:
    """Reads comm terminals and messages from the comms/ directory structure.

    All logic for parsing terminals, loading messages, and filtering by
    recipient/sender lives here. DataLoader holds an instance and delegates.
    """

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir

    def load_terminals(self, location_dir: Path) -> List[Dict[str, Any]]:
        """Load all comm terminals for a location."""
        terminals = []
        comms_dir = location_dir / "comms"
        if not comms_dir.exists():
            return terminals
        for terminal_dir in comms_dir.iterdir():
            if terminal_dir.is_dir() and terminal_dir.name != 'messages':
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
        comms_dir = terminal_dir.parent
        central_messages_dir = comms_dir / "messages"
        if central_messages_dir.exists() and central_messages_dir.is_dir():
            all_messages = self.load_central_messages(central_messages_dir)
            terminal_data['inbox'] = self.filter_messages_for_recipient(all_messages, owner)
            terminal_data['sent'] = self.filter_messages_for_sender(all_messages, owner)
        else:
            terminal_data['inbox'] = self.load_message_folder(terminal_dir / "inbox")
            terminal_data['sent'] = self.load_message_folder(terminal_dir / "sent")
        terminal_data['messages'] = terminal_data['inbox'] + terminal_data['sent']
        terminal_data['messages'].sort(key=lambda m: m.get('timestamp', ''))
        terminal_data['logs'] = self.load_logs_folder(terminal_dir / "logs")
        return terminal_data

    def load_central_messages(self, messages_dir: Path) -> List[Dict[str, Any]]:
        """Load all messages from a central messages directory."""
        messages = []
        if not messages_dir.exists():
            return messages
        for message_file in sorted(messages_dir.glob("*.md")):
            message_data = self.parse_message_file(message_file)
            if message_data:
                messages.append(message_data)
        messages.sort(key=lambda m: m.get('timestamp', ''))
        return messages

    def filter_messages_for_recipient(self, messages: List[Dict[str, Any]], owner: str) -> List[Dict[str, Any]]:
        """Filter messages where the owner is the recipient (inbox)."""
        owner_lower = owner.lower()
        inbox = []
        for msg in messages:
            if owner_lower in msg.get('to', '').lower():
                msg_copy = msg.copy()
                msg_copy['folder'] = 'inbox'
                msg_copy['contact'] = msg.get('from', 'Unknown')
                inbox.append(msg_copy)
        inbox.sort(key=lambda m: m.get('timestamp', ''))
        return inbox

    def filter_messages_for_sender(self, messages: List[Dict[str, Any]], owner: str) -> List[Dict[str, Any]]:
        """Filter messages where the owner is the sender (sent)."""
        owner_lower = owner.lower()
        sent = []
        for msg in messages:
            if owner_lower in msg.get('from', '').lower():
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
        for contact_dir in folder_dir.iterdir():
            if contact_dir.is_dir():
                contact_name = contact_dir.name
                for message_file in sorted(contact_dir.glob("*.md")):
                    message_data = self.parse_message_file(message_file)
                    if message_data:
                        message_data['folder'] = folder_dir.name
                        message_data['contact'] = contact_name
                        messages.append(message_data)
        messages.sort(key=lambda m: m.get('timestamp', ''))
        return messages

    def load_logs_folder(self, logs_dir: Path) -> List[Dict[str, Any]]:
        """Load all log entries from a terminal's logs/ folder."""
        logs = []
        if not logs_dir.exists():
            return logs
        for log_file in sorted(logs_dir.glob("*.md")):
            log_data = self.parse_message_file(log_file)
            if log_data:
                logs.append(log_data)
        logs.sort(key=lambda l: l.get('timestamp', ''))
        return logs

    def parse_message_file(self, message_file: Path) -> Dict[str, Any]:
        """Parse a message markdown file with YAML frontmatter."""
        with open(message_file, 'r') as f:
            content = f.read()
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
        message_data = {'content': message_content, 'filename': message_file.name, **frontmatter}
        if 'timestamp' in message_data and isinstance(message_data['timestamp'], str):
            try:
                message_data['timestamp'] = datetime.fromisoformat(
                    message_data['timestamp'].replace(' ', 'T')
                )
            except ValueError:
                pass
        return message_data


class _CampaignReader:
    """Reads campaign data: crew, NPCs, sessions, and docs from data/campaign/.

    All logic for loading campaign-level files lives here. DataLoader holds an
    instance and delegates. Callers that need only NPCs or crew can instantiate
    this class directly in tests without standing up the full DataLoader.
    """

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir

    def load_crew(self) -> List[Dict[str, Any]]:
        """Load crew from per-entity files in campaign/crew/."""
        crew_dir = self.data_dir / 'campaign' / 'crew'
        if not crew_dir.exists():
            return []
        crew = []
        seen_ids: set = set()
        for path in sorted(crew_dir.glob('*.yaml')):
            try:
                with open(path) as f:
                    character = yaml.safe_load(f)
            except (OSError, yaml.YAMLError) as e:
                logger.warning(f"Skipping crew file {path}: {e}")
                continue
            if character is None:
                continue
            char_id = character.get('id')
            if char_id is None:
                logger.warning(f"Crew file {path} has no 'id' field — skipping")
                continue
            if char_id in seen_ids:
                logger.warning(f"Duplicate crew id '{char_id}' in {path} — skipping")
                continue
            seen_ids.add(char_id)
            crew.append(character)
        return crew

    def load_npcs(self) -> List[Dict[str, Any]]:
        """Load NPCs from per-entity files in campaign/npcs/."""
        npcs_dir = self.data_dir / 'campaign' / 'npcs'
        if not npcs_dir.exists():
            return []
        npcs = []
        seen_ids: set = set()
        for path in sorted(npcs_dir.glob('*.yaml')):
            try:
                with open(path) as f:
                    npc = yaml.safe_load(f)
            except (OSError, yaml.YAMLError) as e:
                logger.warning(f"Skipping NPC file {path}: {e}")
                continue
            if npc is None:
                continue
            npc_id = npc.get('id')
            if npc_id is None:
                logger.warning(f"NPC file {path} has no 'id' field — skipping")
                continue
            if npc_id in seen_ids:
                logger.warning(f"Duplicate NPC id '{npc_id}' in {path} — skipping")
                continue
            seen_ids.add(npc_id)
            npcs.append(npc)
        return npcs

    def load_sessions(self) -> List[Dict[str, Any]]:
        """Load all session logs from data/campaign/sessions/ directory."""
        sessions_dir = self.data_dir / "campaign" / "sessions"
        if not sessions_dir.exists():
            return []
        sessions = []
        for session_file in sessions_dir.glob("*.md"):
            session_data = self.parse_session_file(session_file)
            if session_data:
                if 'npcs' in session_data:
                    if isinstance(session_data['npcs'], str):
                        session_data['npcs'] = [npc.strip() for npc in session_data['npcs'].split(',')]
                else:
                    session_data['npcs'] = []
                if 'date' in session_data:
                    session_data['date'] = str(session_data['date']).split()[0]
                sessions.append(session_data)
        sessions.sort(key=lambda s: s.get('session_number', 0), reverse=True)
        return sessions

    def parse_session_file(self, session_file: Path) -> Dict[str, Any]:
        """Parse a session markdown file with YAML frontmatter."""
        with open(session_file, 'r') as f:
            content = f.read()
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                body_content = parts[2].strip()
            else:
                frontmatter = {}
                body_content = content
        else:
            frontmatter = {}
            body_content = content
        return {'body': body_content, 'filename': session_file.name, **frontmatter}

    def load_campaign_docs(self) -> List[Dict[str, Any]]:
        """Load list of campaign docs — returns slug + title only."""
        docs_dir = self.data_dir / "campaign" / "docs"
        if not docs_dir.exists():
            return []
        docs = []
        for doc_file in sorted(docs_dir.glob("*.md")):
            slug = doc_file.stem
            title = slug.replace('-', ' ').replace('_', ' ').title()
            with open(doc_file, 'r') as f:
                content = f.read()
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    frontmatter = yaml.safe_load(parts[1]) or {}
                    title = frontmatter.get('title', title)
            docs.append({'slug': slug, 'title': title})
        return docs

    def load_campaign_doc(self, slug: str) -> Dict[str, Any]:
        """Load a single campaign doc by slug. Returns title + body (frontmatter stripped)."""
        docs_dir = self.data_dir / "campaign" / "docs"
        doc_file = docs_dir / f"{slug}.md"
        if not doc_file.exists():
            return None
        with open(doc_file, 'r') as f:
            content = f.read()
        title = slug.replace('-', ' ').replace('_', ' ').title()
        body = content
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1]) or {}
                title = frontmatter.get('title', title)
                body = parts[2].strip()
        return {'slug': slug, 'title': title, 'content': body}


class DataLoader:
    """Loads campaign data from the data/ directory structure."""

    SHIP_YAML_PATH = 'campaign/ship/ship.yaml'

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.galaxy_dir = self.data_dir / "galaxy"
        # Systems are directly under galaxy/ (no intermediate dirs)
        self.systems_dir = self.galaxy_dir
        self._terminals = _TerminalReader(self.data_dir)
        self._campaign = _CampaignReader(self.data_dir)

    def load_all_locations(self) -> List[Dict[str, Any]]:
        """Load all visitable locations, organized as a galaxy hierarchy.

        Builds the tree from the galaxy directory (systems → planets/bodies →
        nested permanent installations like bases and orbital stations), then
        injects mobile ships from data/ships/ and the campaign ship from
        data/campaign/ under their current parent body using system_slug +
        body_slug pointer fields.
        """
        # Build base galaxy tree — recursion picks up celestial bodies AND
        # any permanent installation directories nested under a body.
        galaxy_tree = []
        if self.systems_dir.exists():
            for system_dir in sorted(self.systems_dir.iterdir()):
                if system_dir.is_dir() and not system_dir.name.startswith(('.', '__')):
                    location_data = self.load_location_recursive(system_dir)
                    if location_data:
                        galaxy_tree.append(location_data)

        # Two-level index: system → body
        system_index = {node['slug']: node for node in galaxy_tree}
        body_index = {}
        for sys_node in galaxy_tree:
            for body_node in sys_node.get('children', []):
                body_index[body_node['slug']] = body_node

        def _inject_ship(ship_dir: Path, slug: str) -> None:
            """Load a ship directory and inject it into the galaxy tree."""
            location_yaml = ship_dir / 'location.yaml'
            loc = {}
            if location_yaml.exists():
                with open(location_yaml) as f:
                    loc = yaml.safe_load(f) or {}
            loc['slug'] = slug
            loc['directory'] = str(ship_dir)
            loc['has_map'] = len(self.load_deckplan(ship_dir)['decks']) > 0
            loc['terminals'] = self._terminals.load_terminals(ship_dir)
            loc['children'] = []
            system_slug = loc.get('system_slug')
            body_slug = loc.get('body_slug')
            if body_slug and body_slug in body_index:
                body_index[body_slug].setdefault('children', []).append(loc)
            elif system_slug and system_slug in system_index:
                system_index[system_slug].setdefault('children', []).append(loc)
            else:
                galaxy_tree.append(loc)

        # Load mobile ships from data/ships/
        ships_dir = self.data_dir / 'ships'
        if ships_dir.exists():
            for ship_dir in sorted(ships_dir.iterdir()):
                if not ship_dir.is_dir() or ship_dir.name.startswith(('.', '__')):
                    continue
                if not (ship_dir / 'location.yaml').exists():
                    continue
                _inject_ship(ship_dir, ship_dir.name)

        # Load the campaign ship from data/campaign/ — any subdirectory containing
        # ship.yaml is treated as the player's ship. Its slug comes from the slug
        # field inside ship.yaml (falling back to the directory name).
        campaign_dir = self.data_dir / 'campaign'
        if campaign_dir.exists():
            for subdir in sorted(campaign_dir.iterdir()):
                if not subdir.is_dir():
                    continue
                ship_yaml_path = subdir / 'ship.yaml'
                if not ship_yaml_path.exists():
                    continue
                with open(ship_yaml_path) as f:
                    ship_data = yaml.safe_load(f) or {}
                slug = ship_data.get('slug') or subdir.name
                _inject_ship(subdir, slug)

        return galaxy_tree

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

        # Set has_map flag for tree selection (sourced from deckplan)
        location_data['has_map'] = len(self.load_deckplan(location_dir)['decks']) > 0

        # Load comm terminals at this level
        location_data['terminals'] = self._terminals.load_terminals(location_dir)

        # Recursively load child locations (subdirectories that aren't 'comms' or 'map')
        location_data['children'] = []
        for subdir in location_dir.iterdir():
            if subdir.is_dir() and subdir.name not in ['comms', 'map', 'maps']:
                child_location = self.load_location_recursive(subdir)
                if child_location:
                    location_data['children'].append(child_location)

        return location_data

    def load_terminals(self, location_dir: Path) -> List[Dict[str, Any]]:
        """Load all comm terminals for a location."""
        return self._terminals.load_terminals(location_dir)

    def load_terminal(self, terminal_dir: Path) -> Dict[str, Any]:
        """Load a single terminal with all its messages (inbox and sent)."""
        return self._terminals.load_terminal(terminal_dir)

    def load_central_messages(self, messages_dir: Path) -> List[Dict[str, Any]]:
        """Load all messages from a central messages directory."""
        return self._terminals.load_central_messages(messages_dir)

    def filter_messages_for_recipient(self, messages: List[Dict[str, Any]], owner: str) -> List[Dict[str, Any]]:
        """Filter messages where the owner is the recipient (inbox)."""
        return self._terminals.filter_messages_for_recipient(messages, owner)

    def filter_messages_for_sender(self, messages: List[Dict[str, Any]], owner: str) -> List[Dict[str, Any]]:
        """Filter messages where the owner is the sender (sent)."""
        return self._terminals.filter_messages_for_sender(messages, owner)

    def load_message_folder(self, folder_dir: Path) -> List[Dict[str, Any]]:
        """Load all messages from a folder (inbox or sent), organized by contact."""
        return self._terminals.load_message_folder(folder_dir)

    def load_logs_folder(self, logs_dir: Path) -> List[Dict[str, Any]]:
        """Load all log entries from a terminal's logs/ folder."""
        return self._terminals.load_logs_folder(logs_dir)

    def parse_message_file(self, message_file: Path) -> Dict[str, Any]:
        """Parse a message markdown file with YAML frontmatter."""
        return self._terminals.parse_message_file(message_file)

    def find_location_by_slug(self, slug: str, locations: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Find a location by slug.

        Priority:
        1. data/ships/{slug}/ — mobile ships (O(1) path check)
        2. data/campaign/{slug}/ — campaign ship (ship.yaml)
        3. Galaxy tree traversal — celestial bodies and nested permanent
           installations (recursive)

        Slug disambiguation rule: ships/ wins over galaxy/ if the same slug
        appears in both. Collisions are avoided by convention — galaxy slugs use
        astronomical names, ship slugs use vessel names.
        """
        # 1. Check data/ships/ (mobile ships)
        loc_dir = self.data_dir / 'ships' / slug
        if loc_dir.exists() and (loc_dir / 'location.yaml').exists():
            return self.load_location_recursive(loc_dir)

        # Only do the remaining lookups at the top level (not during recursive child searches)
        is_top_level = locations is None
        if is_top_level:
            locations = self.load_all_locations()

            # 2. Check campaign directory for ship matching by slug field
            campaign_dir = self.data_dir / "campaign"
            if campaign_dir.exists():
                for subdir in sorted(campaign_dir.iterdir()):
                    if not subdir.is_dir():
                        continue
                    ship_yaml = subdir / "ship.yaml"
                    if ship_yaml.exists():
                        with open(ship_yaml) as f:
                            ship_data = yaml.safe_load(f) or {}
                        if ship_data.get('slug') == slug:
                            return self.load_location_recursive(subdir)

        # 3. Fall back to galaxy tree for celestial bodies
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
        """Get the full hierarchical path to a location as a list of slugs.

        For mobile ships (data/ships/): reconstructs [system_slug, body_slug, slug]
        from the ship's pointer fields — no filesystem traversal needed.

        For celestial bodies and permanent installations (data/galaxy/): uses
        recursive tree traversal.

        Returns: ['sol', 'earth', 'research_base_alpha'] for a base on Earth in Sol system.
        """
        # Check data/ships/ first (O(1) path check)
        loc_dir = self.data_dir / 'ships' / slug
        if loc_dir.exists() and (loc_dir / 'location.yaml').exists():
            with open(loc_dir / 'location.yaml') as f:
                loc = yaml.safe_load(f) or {}
            system_slug = loc.get('system_slug', '')
            body_slug = loc.get('body_slug', '')
            return [s for s in [system_slug, body_slug, slug] if s]

        # Fall back to galaxy tree traversal for celestial bodies
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
        """Get a location by path slug list.

        Example: ['sol', 'earth', 'research_base_alpha'] -> location data for Research Base Alpha

        Resolves via find_location_by_slug(path_slugs[-1]) so flat locations in
        data/locations/ are found correctly. The leading path elements provide
        disambiguation context but the final slug is the authoritative identifier.
        """
        if not path_slugs:
            return None

        # Resolve via slug lookup — works for both flat locations and galaxy tree
        return self.find_location_by_slug(path_slugs[-1])

    def load_star_map(self) -> Dict[str, Any]:
        """Load the star map visualization data (galaxy-level view)."""
        star_map_file = self.galaxy_dir / "star_map.yaml"

        if not star_map_file.exists():
            return {}

        with open(star_map_file, 'r') as f:
            star_map_data = yaml.safe_load(f)

        return star_map_data

    def load_crew(self) -> List[Dict[str, Any]]:
        """Load crew from per-entity files in campaign/crew/."""
        return self._campaign.load_crew()

    def load_npcs(self) -> List[Dict[str, Any]]:
        """Load NPCs from per-entity files in campaign/npcs/."""
        return self._campaign.load_npcs()

    def load_system_map(self, system_slug: str) -> Dict[str, Any]:
        """Load solar system visualization for a star system."""
        system_map_file = self.systems_dir / system_slug / "system_map.yaml"

        if not system_map_file.exists():
            return None

        with open(system_map_file, 'r') as f:
            return yaml.safe_load(f)

    def load_orbit_map(self, system_slug: str, body_slug: str) -> Dict[str, Any]:
        """Load orbital visualization for a planet/body.

        Loads base orbit_map.yaml then injects child locations of the body —
        permanent installations nested under data/galaxy/<system>/<body>/ and
        any mobile ships from data/ships/ currently pointing at this body.
        The injected entries replace any static orbital_stations/surface_markers
        in the YAML file.
        """
        orbit_map_file = self.systems_dir / system_slug / body_slug / "orbit_map.yaml"

        if not orbit_map_file.exists():
            return None

        with open(orbit_map_file, 'r') as f:
            orbit_data = yaml.safe_load(f) or {}

        # Look up the body node in the assembled tree and walk its children
        all_locations = self.load_all_locations()
        body_node = None
        for sys_node in all_locations:
            if sys_node.get('slug') == system_slug:
                for child in sys_node.get('children', []):
                    if child.get('slug') == body_slug:
                        body_node = child
                        break
                break

        orbital_stations = []
        surface_markers = []
        body_children = body_node.get('children', []) if body_node else []

        for loc in body_children:
            # Skip celestial children (moons) — they don't use parent_type
            if loc.get('type') in ('moon', 'planet', 'star'):
                continue
            parent_type = loc.get('parent_type', 'orbit')
            orbital_block = loc.get('orbital', {})
            base_entry = {
                'slug': loc['slug'],
                'name': loc.get('name', loc['slug']),
                'location_slug': loc['slug'],
            }
            if parent_type == 'orbit':
                if not orbital_block:
                    continue
                # Map compact orbital keys to the orbital_* names the frontend expects
                entry = {
                    **base_entry,
                    'orbital_radius': orbital_block.get('radius'),
                    'orbital_period': orbital_block.get('period'),
                    'orbital_angle': orbital_block.get('angle', 0),
                    'inclination': orbital_block.get('inclination', 0),
                    'size': orbital_block.get('size', 1.5),
                    'icon_type': orbital_block.get('icon_type', 'station'),
                }
                orbital_stations.append(entry)
            elif parent_type == 'surface':
                surface_block = loc.get('surface', {})
                entry = {
                    **base_entry,
                    'latitude': surface_block.get('latitude', loc.get('latitude')),
                    'longitude': surface_block.get('longitude', loc.get('longitude')),
                    'marker_type': surface_block.get('marker_type', orbital_block.get('icon_type', 'base')),
                }
                surface_markers.append(entry)

        orbit_data['orbital_stations'] = orbital_stations
        orbit_data['surface_markers'] = surface_markers

        return orbit_data

    def load_sessions(self) -> List[Dict[str, Any]]:
        """Load all session logs from data/campaign/sessions/ directory."""
        return self._campaign.load_sessions()

    def parse_session_file(self, session_file: Path) -> Dict[str, Any]:
        """Parse a session markdown file with YAML frontmatter."""
        return self._campaign.parse_session_file(session_file)

    def load_campaign_docs(self) -> List[Dict[str, Any]]:
        """Load list of campaign docs — returns slug + title only."""
        return self._campaign.load_campaign_docs()

    def load_campaign_doc(self, slug: str) -> Dict[str, Any]:
        """Load a single campaign doc by slug. Returns title + body (frontmatter stripped)."""
        return self._campaign.load_campaign_doc(slug)

    def load_deckplan(self, location_dir) -> Dict[str, Any]:
        """Load deckplan.yaml from a location directory.

        Returns dict with keys:
          - decks: list of deck dicts sorted by level (ascending)
          - hull: top-level hull dict (or None if not present)
          - total_decks: len(decks)

        Replaces load_encounter_manifest() for locations using the new deckplan format.
        """
        deckplan_path = Path(location_dir) / 'deckplan.yaml'
        if not deckplan_path.exists():
            return {'decks': [], 'hull': None, 'total_decks': 0}

        with open(deckplan_path) as f:
            data = yaml.safe_load(f)

        decks = data.get('decks', [])
        decks_sorted = sorted(decks, key=lambda d: d.get('level', 0))
        hull = data.get('hull', None)

        return {
            'decks': decks_sorted,
            'hull': hull,
            'total_decks': len(decks_sorted),
        }

    def load_ship_status(self) -> Dict[str, Any]:
        """Load ship status from data/campaign/ship/ship.yaml."""
        ship_file = self.data_dir / self.SHIP_YAML_PATH
        if not ship_file.exists():
            return None
        with open(ship_file, 'r') as f:
            ship_data = yaml.safe_load(f)
        return ship_data

    def _save_ship_yaml(self, ship_data: dict) -> None:
        """Write ship data back to data/campaign/ship/ship.yaml (atomic replace)."""
        ship_file = self.data_dir / self.SHIP_YAML_PATH
        fd, tmp_path = tempfile.mkstemp(
            prefix='.ship.', suffix='.yaml', dir=str(ship_file.parent)
        )
        try:
            with os.fdopen(fd, 'w') as f:
                yaml.dump(ship_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
            os.replace(tmp_path, ship_file)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def _mutate_ship_yaml(self, mutate: Callable[[dict], None]) -> None:
        """Read-modify-write ship.yaml under a lock so concurrent edits don't lose data."""
        ship_file = self.data_dir / self.SHIP_YAML_PATH
        with _ship_yaml_lock:
            with open(ship_file, 'r') as f:
                ship_data = yaml.safe_load(f) or {}
            mutate(ship_data)
            self._save_ship_yaml(ship_data)

    def save_ship_location(self, location_slug: str) -> None:
        """Write the galactic location_slug back to data/campaign/ship/ship.yaml."""
        def mutate(ship_data):
            ship_data['location_slug'] = location_slug
        self._mutate_ship_yaml(mutate)

    def save_ship_system(self, system_name: str, fields: dict) -> None:
        """Update a ship system's fields (status, condition, info) in ship.yaml."""
        def mutate(ship_data):
            systems = ship_data.setdefault('systems', {})
            systems.setdefault(system_name, {}).update(fields)
        self._mutate_ship_yaml(mutate)

    def save_ship_integrity(self, field: str, values: dict) -> None:
        """Update hull, armor, or other integrity fields (current, max) in ship.yaml."""
        def mutate(ship_data):
            ship_data.setdefault(field, {}).update(values)
        self._mutate_ship_yaml(mutate)

    def save_ship_resource(self, resource_name: str, values: dict) -> None:
        """Update a resource value (fuel, food, o2, cryopods, escape_pods) in ship.yaml."""
        def mutate(ship_data):
            resources = ship_data.setdefault('resources', {})
            resources.setdefault(resource_name, {}).update(values)
        self._mutate_ship_yaml(mutate)

    def save_ship_cargo(self, items: list) -> None:
        """Replace the cargo items list in ship.yaml."""
        def mutate(ship_data):
            ship_data.setdefault('cargo', {})['items'] = list(items)
        self._mutate_ship_yaml(mutate)

    def save_ship_stat(self, stat_name: str, value: int) -> None:
        """Update a ship stat (thrusters, battle, systems) in ship.yaml."""
        def mutate(ship_data):
            ship_data.setdefault('stats', {})[stat_name] = value
        self._mutate_ship_yaml(mutate)

    def save_system_power(self, system_name: str, allocated: int) -> None:
        """Update a system's power.allocated in ship.yaml."""
        def mutate(ship_data):
            systems = ship_data.setdefault('systems', {})
            systems.setdefault(system_name, {}).setdefault('power', {})['allocated'] = allocated
        self._mutate_ship_yaml(mutate)

    def save_system_fault_indicator(self, system_name: str, index: int, active: bool) -> None:
        """Toggle a fault indicator's active state for a system in ship.yaml."""
        def mutate(ship_data):
            systems = ship_data.setdefault('systems', {})
            faults_list = systems.setdefault(system_name, {}).get('faults', [])
            if 0 <= index < len(faults_list):
                faults_list[index]['active'] = active
        self._mutate_ship_yaml(mutate)


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
_loader: Optional[DataLoader] = None


def get_loader() -> DataLoader:
    global _loader
    if _loader is None:
        from django.conf import settings
        _loader = DataLoader(getattr(settings, 'DATA_DIR', 'data'))
    return _loader


def set_loader(loader: DataLoader) -> None:
    """Override the loader — use in tests to inject a fixture loader."""
    global _loader
    _loader = loader


def load_all_locations() -> List[Dict[str, Any]]:
    """Load all locations from data directory."""
    loader = get_loader()
    return loader.load_all_locations()
