import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Space,
  List,
  Typography,
  Switch,
  message,
  Tooltip,
  Empty,
  Card,
} from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { encounterApi, type DeckWithRooms } from '@/services/encounterApi';
import type { ActiveView } from '@/types/gmConsole';
import type {
  EncounterManifest,
  RoomVisibilityState,
  DoorStatusState,
  DoorStatus,
  DeckInfo,
  RoomData,
  EncounterMapData,
} from '@/types/encounterMap';
import { MapPreview } from './MapPreview';

const { Text } = Typography;

// Room with deck info for display
interface RoomWithDeck extends RoomData {
  deckId: string;
  deckName: string;
  deckLevel: number;
}

interface EncounterPanelProps {
  activeView: ActiveView | null;
  onViewUpdate: () => void;
}

export function EncounterPanel({ activeView, onViewUpdate }: EncounterPanelProps) {
  const [manifest, setManifest] = useState<EncounterManifest | null>(null);
  const [allDecks, setAllDecks] = useState<DeckWithRooms[]>([]);
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibilityState>({});
  const [doorStatus, setDoorStatus] = useState<DoorStatusState>({});
  const [currentDeckMapData, setCurrentDeckMapData] = useState<EncounterMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const locationSlug = activeView?.location_slug || '';
  const currentDeckId = activeView?.encounter_deck_id || '';
  const locationType = activeView?.location_type || '';

  // Check if we're in encounter view with a valid location
  const isActive = activeView?.view_type === 'ENCOUNTER' && !!locationSlug;

  // Location types that have encounter maps (2D tactical maps)
  // Planets, moons, and systems use 3D visualizations instead
  const encounterMapTypes = ['station', 'ship', 'base', 'deck', 'room', 'level', 'section'];
  const hasEncounterMap = encounterMapTypes.includes(locationType.toLowerCase());

  // Load all decks data when location changes (only for locations with encounter maps)
  useEffect(() => {
    if (!isActive || !locationSlug || !hasEncounterMap) {
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
        // Only show error for locations that should have maps
        if (hasEncounterMap) {
          messageApi.error('Failed to load map data');
        }
      } finally {
        setLoading(false);
      }
    };

    loadAllDecks();
  }, [isActive, locationSlug, hasEncounterMap, messageApi]);

  // Load current deck's full map data for preview (includes grid, connections, etc.)
  useEffect(() => {
    if (!isActive || !locationSlug || !hasEncounterMap) {
      setCurrentDeckMapData(null);
      return;
    }

    const loadCurrentDeckMap = async () => {
      try {
        const data = await encounterApi.getMapData(locationSlug);
        // Handle both multi-deck and single-deck responses
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
  }, [isActive, locationSlug, hasEncounterMap, currentDeckId]);

  // Build flat list of all rooms with deck info, sorted by level
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
    // Sort by level, then by room name
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

  const handleDeckSelect = useCallback(async (deck: DeckInfo) => {
    if (deck.id === currentDeckId) return;

    try {
      await encounterApi.switchLevel(deck.level, deck.id);
      onViewUpdate();
      messageApi.success(`Switched to ${deck.name}`);
    } catch (err) {
      console.error('Error switching deck:', err);
      messageApi.error('Failed to switch deck');
    }
  }, [currentDeckId, onViewUpdate, messageApi]);

  const handleRoomToggle = useCallback(async (roomId: string, visible: boolean) => {
    try {
      const result = await encounterApi.toggleRoom(roomId, visible);
      setRoomVisibility(result.room_visibility);
      onViewUpdate();
    } catch (err) {
      console.error('Error toggling room:', err);
      messageApi.error('Failed to toggle room visibility');
    }
  }, [onViewUpdate, messageApi]);

  const handleDoorStatusChange = useCallback(async (connectionId: string, status: DoorStatus) => {
    try {
      const result = await encounterApi.setDoorStatus(connectionId, status);
      setDoorStatus(result.all_door_status);
      onViewUpdate();
    } catch (err) {
      console.error('Error setting door status:', err);
      messageApi.error('Failed to set door status');
    }
  }, [onViewUpdate, messageApi]);

  const handleShowAll = useCallback(async () => {
    if (!allRooms.length) return;
    const roomIds = allRooms.map(r => r.id);
    try {
      const result = await encounterApi.showAllRooms(roomIds);
      setRoomVisibility(result);
      onViewUpdate();
      messageApi.success('All rooms visible');
    } catch (err) {
      console.error('Error showing all rooms:', err);
      messageApi.error('Failed to show all rooms');
    }
  }, [allRooms, onViewUpdate, messageApi]);

  const handleHideAll = useCallback(async () => {
    if (!allRooms.length) return;
    const roomIds = allRooms.map(r => r.id);
    try {
      const result = await encounterApi.hideAllRooms(roomIds);
      setRoomVisibility(result);
      onViewUpdate();
      messageApi.success('All rooms hidden');
    } catch (err) {
      console.error('Error hiding all rooms:', err);
      messageApi.error('Failed to hide all rooms');
    }
  }, [allRooms, onViewUpdate, messageApi]);

  // Get room visibility (default to true if not set)
  const isRoomVisible = (roomId: string) => {
    return roomVisibility[roomId] !== false;
  };

  if (!isActive) {
    return (
      <>
        {contextHolder}
        <Empty
          description={
            <Text type="secondary">
              Select a location in ENCOUNTER view to control the map display
            </Text>
          }
          style={{ padding: 40 }}
        />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {contextHolder}
        <div style={{ padding: 20, textAlign: 'center' }}>
          <Text type="secondary">Loading map data...</Text>
        </div>
      </>
    );
  }

  // For planets, moons, and systems - they use 3D visualizations
  if (!hasEncounterMap) {
    const viewName = locationType === 'system' ? '3D system view' :
                     locationType === 'planet' ? '3D orbit view' :
                     locationType === 'moon' ? '3D orbit view' : '3D view';
    return (
      <>
        {contextHolder}
        <Empty
          description={
            <Text type="secondary">
              Displaying {viewName} for {activeView?.location_name || locationType}
              <br />
              <span style={{ fontSize: 11 }}>No room controls for this view</span>
            </Text>
          }
          style={{ padding: 40 }}
        />
      </>
    );
  }

  if (!allDecks.length) {
    return (
      <>
        {contextHolder}
        <Empty
          description={
            <Text type="secondary">
              No map data found for this location
            </Text>
          }
          style={{ padding: 40 }}
        />
      </>
    );
  }

  return (
    <>
      {contextHolder}

      {/* Level Selector Card */}
      <Card
        size="small"
        title={<Text style={{ color: '#5a7a7a' }}>DECK LEVEL</Text>}
        style={{ marginBottom: 16, background: '#1a1a1a' }}
        bodyStyle={{ padding: 12 }}
      >
        {manifest ? (
          <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
            {manifest.decks.map((deck) => (
              <Button
                key={deck.id}
                type={deck.id === currentDeckId ? 'primary' : 'default'}
                size="small"
                onClick={() => handleDeckSelect(deck)}
                style={{
                  minWidth: 100,
                  ...(deck.id === currentDeckId ? {
                    background: '#8b7355',
                    borderColor: '#8b7355',
                  } : {})
                }}
              >
                {deck.name}
              </Button>
            ))}
          </Space>
        ) : (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            Single deck map - no level switching available
          </Text>
        )}
      </Card>

      {/* Map Preview */}
      <Card
        size="small"
        title={<Text style={{ color: '#5a7a7a' }}>MAP PREVIEW</Text>}
        style={{ marginBottom: 16, background: '#1a1a1a' }}
        bodyStyle={{ padding: 8 }}
      >
        {currentDeckMapData ? (
          <MapPreview
            mapData={currentDeckMapData}
            roomVisibility={roomVisibility}
            doorStatus={doorStatus}
            onDoorStatusChange={handleDoorStatusChange}
            showAllRooms={true}
          />
        ) : (
          <div style={{
            aspectRatio: '16/9',
            background: '#0a0a0a',
            border: '1px solid #303030',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Loading preview...
            </Text>
          </div>
        )}
      </Card>

      {/* Room Visibility Card */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#5a7a7a' }}>ROOM VISIBILITY</Text>
            <Space size="small">
              <Tooltip title="Show all rooms">
                <Button
                  icon={<EyeOutlined />}
                  size="small"
                  onClick={handleShowAll}
                />
              </Tooltip>
              <Tooltip title="Hide all rooms">
                <Button
                  icon={<EyeInvisibleOutlined />}
                  size="small"
                  onClick={handleHideAll}
                />
              </Tooltip>
            </Space>
          </div>
        }
        style={{ background: '#1a1a1a' }}
        bodyStyle={{ padding: 0 }}
      >
        <List
          size="small"
          dataSource={allRooms}
          style={{ maxHeight: 300, overflow: 'auto' }}
          renderItem={(room: RoomWithDeck, index: number) => {
            // Check if this is the first room of a new deck level
            const prevRoom = index > 0 ? allRooms[index - 1] : null;
            const isNewLevel = !prevRoom || prevRoom.deckLevel !== room.deckLevel;

            return (
              <>
                {/* Deck level header */}
                {isNewLevel && (
                  <div
                    style={{
                      padding: '6px 12px',
                      background: '#0f1515',
                      borderBottom: '1px solid #303030',
                      color: '#8b7355',
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: 1,
                    }}
                  >
                    LEVEL {room.deckLevel} - {room.deckName.toUpperCase()}
                  </div>
                )}
                <List.Item
                  style={{
                    padding: '8px 12px 8px 20px',
                    borderBottom: '1px solid #303030',
                    opacity: isRoomVisible(room.id) ? 1 : 0.5,
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text style={{ fontSize: 12 }}>{room.name}</Text>
                      {room.status && (
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 10,
                            marginLeft: 8,
                            color: room.status === 'HAZARD' ? '#8b5555' :
                                   room.status === 'WARNING' ? '#8b7355' :
                                   room.status === 'OFFLINE' ? '#5a5a5a' : '#5a7a7a'
                          }}
                        >
                          [{room.status}]
                        </Text>
                      )}
                    </div>
                    <Switch
                      size="small"
                      checked={isRoomVisible(room.id)}
                      onChange={(checked) => handleRoomToggle(room.id, checked)}
                    />
                  </div>
                </List.Item>
              </>
            );
          }}
        />
      </Card>
    </>
  );
}
