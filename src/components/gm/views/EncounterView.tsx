import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, Select, message } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  ApartmentOutlined,
  MessageOutlined,
  RobotOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { encounterApi, type DeckWithRooms } from '@/services/encounterApi';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import type { ActiveView, Location } from '@/types/gmConsole';
import type { ShipStatusData } from '@/types/shipStatus';
import type {
  EncounterManifest,
  HullDef,
  RoomVisibilityState,
  DoorStatusState,
  DoorStatus,
  EncounterMapData,
  GridEncounterMapData,
  GridRect,
  TokenState,
  TokenType,
  TokenStatus,
} from '@/types/encounterMap';
import { MapPreview } from '../MapPreview';
import { ToolRail, type ToolRailButton } from '../layout/ToolRail';
import { SlideOutPanel } from '../layout/SlideOutPanel';
import { TokenPalettePanel } from '../panels/TokenPalettePanel';
import { NpcPortraitsPanel } from '../panels/NpcPortraitsPanel';
import { LocationTreePanel } from '../panels/LocationTreePanel';
import { TerminalsPanel } from '../panels/TerminalsPanel';
import { CharonPanel } from '../CharonPanel';
import { DocumentsPanel } from '../panels/DocumentsPanel';
import './EncounterView.css';

// Room with deck info for display (supports both legacy and grid formats)
interface RoomWithDeck {
  id: string;
  name: string;
  deckId: string;
  deckName: string;
  deckLevel: number;
  rects?: GridRect[];
  type?: string;
  description?: string;
  status?: string;
}

interface EncounterViewProps {
  activeView: ActiveView | null;
  locations: Location[];
  expandedNodes: Set<string>;
  onToggleNode: (key: string) => void;
  onSelectLocation: (slug: string | null) => void;
  onShowTerminal: (locationSlug: string, terminalSlug: string) => void;
  charonChannel: string;
  charonDialogOpen: boolean;
  onDialogToggle: () => void;
  shipData?: ShipStatusData | null;
}

const ENCOUNTER_TOOLS: ToolRailButton[] = [
  { key: 'locations', icon: <ApartmentOutlined />, tooltip: 'Locations' },
  { key: 'tokens', icon: <TeamOutlined />, tooltip: 'Token Palette' },
  { key: 'portraits', icon: <UserOutlined />, tooltip: 'NPC Portraits' },
  { key: 'terminals', icon: <MessageOutlined />, tooltip: 'Terminals' },
  { key: 'documents', icon: <FileTextOutlined />, tooltip: 'Documents' },
  { key: 'charon', icon: <RobotOutlined />, tooltip: 'CHARON' },
];

export function EncounterView({
  activeView,
  locations,
  expandedNodes,
  onToggleNode,
  onSelectLocation,
  onShowTerminal,
  charonChannel,
  charonDialogOpen,
  onDialogToggle,
  shipData,
}: EncounterViewProps) {
  const [manifest, setManifest] = useState<EncounterManifest | null>(null);
  const [allDecks, setAllDecks] = useState<DeckWithRooms[]>([]);
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibilityState>({});
  const [doorStatus, setDoorStatus] = useState<DoorStatusState>({});
  const [currentDeckMapData, setCurrentDeckMapData] = useState<EncounterMapData | GridEncounterMapData | null>(null);
  const [encounterTokens, setEncounterTokens] = useState<TokenState>({});
  const tokenMoveInFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const locationSlug = activeView?.location_slug || '';
  const currentDeckId = activeView?.encounter_deck_id || '';
  const locationType = activeView?.location_type || '';

  // Location types that have encounter maps (2D tactical maps)
  const encounterMapTypes = ['station', 'ship', 'base', 'deck', 'room', 'level', 'section'];
  const hasEncounterMap = encounterMapTypes.includes(locationType.toLowerCase());

  // Auto-open locations panel when no location is selected
  useEffect(() => {
    if (!locationSlug) {
      setActivePanel('locations');
    }
  }, [locationSlug]);

  // Load all decks data when location changes
  useEffect(() => {
    if (!locationSlug || !hasEncounterMap) {
      setManifest(null);
      setAllDecks([]);
      setRoomVisibility({});
      return;
    }

    const loadAllDecks = async () => {
      setLoading(true);
      try {
        const data = await encounterApi.getAllDecks(locationSlug);
        setManifest(data.manifest || null);
        setAllDecks(data.decks || []);
        setRoomVisibility(data.room_visibility || {});
      } catch (err) {
        console.error('Error loading all decks:', err);
        if (hasEncounterMap) {
          messageApi.error('Failed to load map data');
        }
      } finally {
        setLoading(false);
      }
    };

    loadAllDecks();
  }, [locationSlug, hasEncounterMap, messageApi]);

  // Load current deck's full map data
  useEffect(() => {
    if (!locationSlug || !hasEncounterMap) {
      setCurrentDeckMapData(null);
      return;
    }

    const loadCurrentDeckMap = async () => {
      try {
        const data = await encounterApi.getMapData(locationSlug);
        if ('is_multi_deck' in data && data.is_multi_deck) {
          setCurrentDeckMapData(data.current_deck);
        } else {
          setCurrentDeckMapData(data as EncounterMapData);
        }
      } catch (err) {
        console.error('Error loading current deck map:', err);
        setCurrentDeckMapData(null);
      }
    };

    loadCurrentDeckMap();
  }, [locationSlug, hasEncounterMap, currentDeckId]);

  // Build flat list of all rooms with deck info
  const allRooms: RoomWithDeck[] = useMemo(() => {
    const rooms: RoomWithDeck[] = [];
    for (const deck of allDecks) {
      for (const room of deck.rooms) {
        rooms.push({
          ...room,
          deckId: deck.id,
          deckName: deck.name,
          deckLevel: deck.level,
        });
      }
    }
    rooms.sort((a, b) => {
      if (a.deckLevel !== b.deckLevel) return a.deckLevel - b.deckLevel;
      return a.name.localeCompare(b.name);
    });
    return rooms;
  }, [allDecks]);

  // Sync room visibility from activeView
  useEffect(() => {
    if (activeView?.encounter_room_visibility) {
      setRoomVisibility(activeView.encounter_room_visibility);
    }
  }, [activeView?.encounter_room_visibility]);

  // Sync door status from activeView
  useEffect(() => {
    if (activeView?.encounter_door_status) {
      setDoorStatus(activeView.encounter_door_status);
    }
  }, [activeView?.encounter_door_status]);

  // Sync token state from activeView (skip during in-flight moves)
  useEffect(() => {
    if (tokenMoveInFlight.current) return;
    if (activeView?.encounter_tokens) {
      setEncounterTokens(activeView.encounter_tokens);
    } else {
      setEncounterTokens({});
    }
  }, [activeView?.encounter_tokens]);

  // Deck select handler
  const handleDeckSelect = useCallback(async (deckId: string) => {
    if (deckId === currentDeckId) return;
    const deck = manifest?.decks.find(d => d.id === deckId);
    if (!deck) return;

    try {
      await encounterApi.switchLevel(deck.level, deck.id);
      messageApi.success(`Switched to ${deck.name}`);
    } catch (err) {
      console.error('Error switching deck:', err);
      messageApi.error('Failed to switch deck');
    }
  }, [currentDeckId, manifest, messageApi]);

  const handleRoomToggle = useCallback(async (roomId: string, visible: boolean) => {
    try {
      const result = await encounterApi.toggleRoom(roomId, visible);
      setRoomVisibility(result.room_visibility);
    } catch (err) {
      console.error('Error toggling room:', err);
      messageApi.error('Failed to toggle room visibility');
    }
  }, [messageApi]);

  const handleDoorStatusChange = useCallback(async (connectionId: string, status: DoorStatus) => {
    try {
      const result = await encounterApi.setDoorStatus(connectionId, status);
      setDoorStatus(result.all_door_status);
    } catch (err) {
      console.error('Error setting door status:', err);
      messageApi.error('Failed to set door status');
    }
  }, [messageApi]);

  const handleShowAll = useCallback(async () => {
    if (!allRooms.length) return;
    const roomIds = allRooms.map(r => r.id);
    try {
      const result = await encounterApi.showAllRooms(roomIds);
      setRoomVisibility(result);
      messageApi.success('All rooms visible');
    } catch (err) {
      console.error('Error showing all rooms:', err);
      messageApi.error('Failed to show all rooms');
    }
  }, [allRooms, messageApi]);

  const handleHideAll = useCallback(async () => {
    if (!allRooms.length) return;
    const roomIds = allRooms.map(r => r.id);
    try {
      const result = await encounterApi.hideAllRooms(roomIds);
      setRoomVisibility(result);
      messageApi.success('All rooms hidden');
    } catch (err) {
      console.error('Error hiding all rooms:', err);
      messageApi.error('Failed to hide all rooms');
    }
  }, [allRooms, messageApi]);

  // Token handlers
  const handleTokenPlace = useCallback(async (
    type: TokenType,
    name: string,
    x: number,
    y: number,
    imageUrl: string,
    roomId: string
  ) => {
    try {
      const result = await encounterApi.placeToken(type, name, x, y, imageUrl, roomId);
      setEncounterTokens(result.tokens);
      messageApi.success(`Placed token: ${name}`);
    } catch (err) {
      console.error('Error placing token:', err);
      messageApi.error('Failed to place token');
    }
  }, [messageApi]);

  const handleTokenMove = useCallback(async (id: string, x: number, y: number, roomId: string) => {
    setEncounterTokens(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], x, y, room_id: roomId } };
    });
    tokenMoveInFlight.current = true;
    try {
      const result = await encounterApi.moveToken(id, x, y, roomId);
      setEncounterTokens(result.tokens);
    } catch (err) {
      console.error('Error moving token:', err);
      messageApi.error('Failed to move token');
    } finally {
      tokenMoveInFlight.current = false;
    }
  }, [messageApi]);

  const handleTokenRemove = useCallback(async (id: string) => {
    try {
      const result = await encounterApi.removeToken(id);
      setEncounterTokens(result.tokens);
      messageApi.success('Token removed');
    } catch (err) {
      console.error('Error removing token:', err);
      messageApi.error('Failed to remove token');
    }
  }, [messageApi]);

  const handleTokenStatusToggle = useCallback(async (id: string, status: TokenStatus) => {
    const token = encounterTokens[id];
    if (!token) return;

    const newStatus = token.status.includes(status)
      ? token.status.filter(s => s !== status)
      : [...token.status, status];

    try {
      const result = await encounterApi.updateTokenStatus(id, newStatus);
      setEncounterTokens(result.tokens);
    } catch (err) {
      console.error('Error updating token status:', err);
      messageApi.error('Failed to update token status');
    }
  }, [encounterTokens, messageApi]);

  // NPC portrait toggle
  const handleTogglePortrait = useCallback(async (npcId: string) => {
    try {
      await encounterApi.togglePortrait(npcId);
    } catch (err) {
      console.error('Error toggling portrait:', err);
      messageApi.error('Failed to toggle portrait');
    }
  }, [messageApi]);

  // Panel toggle
  const handlePanelToggle = useCallback((key: string) => {
    setActivePanel(prev => (prev === key ? null : key));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const handleSetShipLocation = useCallback(async (slug: string) => {
    try {
      await gmConsoleApi.setShipLocation(slug);
      messageApi.success('Ship position updated');
    } catch (err) {
      console.error('Failed to set ship location:', err);
      messageApi.error('Failed to update ship location');
    }
  }, [messageApi]);

  // Derive NPC list and active portrait IDs
  const npcs = useMemo(
    () => Object.values(activeView?.encounter_npc_data || {}),
    [activeView?.encounter_npc_data]
  );
  // Deck dropdown options
  const deckOptions = useMemo(() => {
    if (!manifest) return [];
    return manifest.decks.map(d => ({ value: d.id, label: d.name }));
  }, [manifest]);

  const noLocationSelected = !locationSlug;

  // Find the current location node in the tree
  const currentLocation = useMemo(() => {
    function findLocation(locs: Location[], slug: string): Location | null {
      for (const loc of locs) {
        if (loc.slug === slug) return loc;
        const found = findLocation(loc.children, slug);
        if (found) return found;
      }
      return null;
    }
    return locationSlug ? findLocation(locations, locationSlug) : null;
  }, [locations, locationSlug]);

  return (
    <div className="gm-encounter-view">
      {contextHolder}

      {/* Full-screen map */}
      <div className="gm-encounter-view__map">
        {currentDeckMapData ? (
          <MapPreview
            mapData={currentDeckMapData}
            roomVisibility={roomVisibility}
            doorStatus={doorStatus}
            onDoorStatusChange={handleDoorStatusChange}
            showAllRooms={true}
            tokens={encounterTokens}
            isGM={true}
            fill={true}
            onTokenPlace={handleTokenPlace}
            onTokenMove={handleTokenMove}
            onTokenRemove={handleTokenRemove}
            onTokenStatusToggle={handleTokenStatusToggle}
            onRoomToggle={handleRoomToggle}
            hull={manifest?.hull as HullDef | undefined}
          />
        ) : noLocationSelected ? (
          <div className="gm-encounter-view__empty">
            Select a location to view the encounter map
            <Button onClick={() => setActivePanel('locations')}>Open Locations</Button>
          </div>
        ) : loading ? (
          <div className="gm-encounter-view__loading">Loading map data...</div>
        ) : !hasEncounterMap ? (
          <div className="gm-encounter-view__empty">
            {locationType === 'system' ? '3D system view' :
             locationType === 'planet' || locationType === 'moon' ? '3D orbit view' : '3D view'}
            {' '}for {activeView?.location_name || locationType}
          </div>
        ) : (
          <div className="gm-encounter-view__loading">Loading...</div>
        )}

        {/* Floating centered top controls (only when map is loaded) */}
        {currentDeckMapData && (
          <div className="gm-encounter-view__floating-controls">
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" onClick={handleShowAll} style={{ color: '#4a6b6b', borderColor: '#2a3a3a' }}>
                REVEAL ALL
              </Button>
              <Button size="small" onClick={handleHideAll} style={{ color: '#8b5555', borderColor: '#2a3a3a' }}>
                HIDE ALL
              </Button>
            </div>
            {manifest && manifest.decks.length > 1 && (
              <Select
                value={currentDeckId}
                onChange={handleDeckSelect}
                options={deckOptions}
                size="small"
                style={{ minWidth: 140 }}
              />
            )}
          </div>
        )}
      </div>

      {/* Right tool rail + slide-out panels */}
      <div className="gm-encounter-view__right">
        <ToolRail tools={ENCOUNTER_TOOLS} activePanel={activePanel} onToggle={handlePanelToggle} />

        <SlideOutPanel open={activePanel === 'tokens'} title="Token Palette" onClose={closePanel}>
          <TokenPalettePanel
            activeView={activeView}
            tokens={encounterTokens}
            onTokensChange={setEncounterTokens}
            mapData={currentDeckMapData}
            roomVisibility={roomVisibility}
          />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'portraits'} title="NPC Portraits" onClose={closePanel}>
          <NpcPortraitsPanel
            npcs={npcs}
            activePortraits={activeView?.encounter_active_portraits || []}
            onToggle={handleTogglePortrait}
          />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'locations'} title="Locations" onClose={closePanel}>
          <LocationTreePanel
            locations={locations}
            selectedLocationSlug={locationSlug || null}
            activeTerminalLocationSlug={activeView?.overlay_location_slug || null}
            activeTerminalSlug={activeView?.overlay_terminal_slug || null}
            expandedNodes={expandedNodes}
            onToggleNode={onToggleNode}
            onSelectLocation={onSelectLocation}
            onShowTerminal={onShowTerminal}
            onSetShipLocation={handleSetShipLocation}
            shipLocationSlug={shipData?.location_slug}
            shipName={shipData?.ship?.name}
            shipSlug={shipData?.slug}
          />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'terminals'} title="Terminals" onClose={closePanel}>
          <TerminalsPanel
            locations={currentLocation ? [currentLocation] : []}
            activeTerminalLocationSlug={activeView?.overlay_location_slug || null}
            activeTerminalSlug={activeView?.overlay_terminal_slug || null}
            onShowTerminal={onShowTerminal}
          />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'documents'} title="Documents" onClose={closePanel}>
          <DocumentsPanel activeDocSlug={activeView?.overlay_doc_slug || ''} />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'charon'} title="CHARON" onClose={closePanel}>
          <CharonPanel
            channel={charonChannel}
            currentViewType="ENCOUNTER"
            charonDialogOpen={charonDialogOpen}
            onDialogToggle={onDialogToggle}
          />
        </SlideOutPanel>
      </div>
    </div>
  );
}
