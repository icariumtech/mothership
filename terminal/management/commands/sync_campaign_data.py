"""
Management command to sync campaign data from filesystem to database.

Usage:
    python manage.py sync_campaign_data
    python manage.py sync_campaign_data --location research_base_alpha
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from terminal.models import (
    Location, ViewInstance, ViewMode, EncounterMap,
    CommTerminal, TerminalMessage
)
from terminal.data_loader import get_loader


class Command(BaseCommand):
    help = 'Sync campaign data from filesystem to database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--location',
            type=str,
            help='Sync only a specific location (slug)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing campaign data before syncing',
        )

    def handle(self, *args, **options):
        loader = get_loader()

        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing campaign data...'))
            TerminalMessage.objects.all().delete()
            CommTerminal.objects.all().delete()
            EncounterMap.objects.all().delete()
            ViewInstance.objects.all().delete()
            Location.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Cleared!'))

        # Load locations
        if options['location']:
            self.stdout.write(f"Loading location: {options['location']}")
            locations_data = [loader.load_location(options['location'])]
        else:
            self.stdout.write('Loading all locations...')
            locations_data = loader.load_all_locations()

        if not locations_data or not locations_data[0]:
            self.stdout.write(self.style.ERROR('No locations found in data/locations/'))
            return

        # Sync each location
        for location_data in locations_data:
            if not location_data:
                continue
            self.sync_location(location_data)

        self.stdout.write(self.style.SUCCESS('Campaign data sync complete!'))

    @transaction.atomic
    def sync_location(self, location_data):
        """Sync a single location and all its data."""
        slug = location_data['slug']

        # Create or update location
        location, created = Location.objects.update_or_create(
            slug=slug,
            defaults={
                'name': location_data.get('name', slug),
                'location_type': location_data.get('type', 'STATION').upper(),
                'description': location_data.get('description', ''),
                'coordinates': location_data.get('coordinates', ''),
                'status': location_data.get('status', 'OPERATIONAL'),
            }
        )

        action = 'Created' if created else 'Updated'
        self.stdout.write(f"  {action} location: {location.name}")

        # Sync maps
        maps_count = self.sync_maps(location, location_data.get('maps', []))

        # Sync terminals
        terminals_count = self.sync_terminals(location, location_data.get('terminals', []))

        self.stdout.write(
            f"    └─ {maps_count} maps, {terminals_count} terminals"
        )

    def sync_maps(self, location, maps_data):
        """Sync encounter maps for a location."""
        count = 0

        for map_data in maps_data:
            slug = map_data['slug']

            # Create or update ViewInstance
            view_instance, created = ViewInstance.objects.update_or_create(
                location=location,
                slug=slug,
                defaults={
                    'name': map_data.get('name', slug),
                    'view_type': 'ENCOUNTER_MAP',
                    'description': map_data.get('description', ''),
                }
            )

            # Create or update EncounterMap
            EncounterMap.objects.update_or_create(
                view_instance=view_instance,
                defaults={
                    'location_name': map_data.get('location_name', location.name),
                    'map_image': map_data.get('image_path', ''),
                    'grid_size_x': map_data.get('grid_size_x', 20),
                    'grid_size_y': map_data.get('grid_size_y', 20),
                    'notes': map_data.get('notes', ''),
                }
            )

            count += 1

        return count

    def sync_terminals(self, location, terminals_data):
        """Sync comm terminals for a location."""
        count = 0

        for terminal_data in terminals_data:
            slug = terminal_data['slug']

            # Create or update ViewInstance
            view_instance, created = ViewInstance.objects.update_or_create(
                location=location,
                slug=slug,
                defaults={
                    'name': terminal_data.get('owner', slug),
                    'view_type': 'COMM_TERMINAL',
                    'description': terminal_data.get('description', ''),
                }
            )

            # Create or update CommTerminal
            comm_terminal, _ = CommTerminal.objects.update_or_create(
                view_instance=view_instance,
                defaults={
                    'terminal_owner': terminal_data.get('owner', 'Unknown'),
                    'terminal_id': terminal_data.get('terminal_id', slug),
                    'access_level': terminal_data.get('access_level', 'PUBLIC'),
                }
            )

            # Sync messages for this terminal
            messages_count = self.sync_terminal_messages(
                comm_terminal,
                terminal_data.get('messages', [])
            )

            self.stdout.write(
                f"    ├─ Terminal: {comm_terminal.terminal_id} "
                f"({messages_count} messages)"
            )

            count += 1

        return count

    def sync_terminal_messages(self, terminal, messages_data):
        """Sync messages for a terminal."""
        count = 0

        # Get existing messages by filename to avoid duplicates
        existing_filenames = set(
            terminal.messages.values_list('filename', flat=True)
        )

        for msg_data in messages_data:
            filename = msg_data.get('filename', '')

            # Skip if already exists
            if filename in existing_filenames:
                continue

            TerminalMessage.objects.create(
                terminal=terminal,
                sender=msg_data.get('sender', 'Unknown'),
                subject=msg_data.get('subject', ''),
                content=msg_data.get('content', ''),
                timestamp=msg_data.get('timestamp'),
                priority=msg_data.get('priority', 'NORMAL'),
                is_read=msg_data.get('read', False),
                is_deleted=msg_data.get('deleted', False),
                filename=filename,
            )

            count += 1

        return count
