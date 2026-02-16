import { api } from './api';
import {
  MapDataResponse,
  RoomVisibilityState,
  DoorStatusState,
  DoorStatus,
  RoomData,
  EncounterManifest,
  TokenState,
  TokenType,
  TokenStatus,
  TokenImage,
} from '@/types/encounterMap';

interface SwitchLevelResponse {
  success: boolean;
  level: number;
  deck_id: string;
}

// Deck data with rooms for the all-decks endpoint
interface DeckWithRooms {
  id: string;
  name: string;
  level: number;
  rooms: RoomData[];
}

interface AllDecksResponse {
  is_multi_deck: boolean;
  manifest?: EncounterManifest;
  decks: DeckWithRooms[];
  room_visibility: RoomVisibilityState;
  current_deck_id?: string;
}

interface ToggleRoomResponse {
  success: boolean;
  room_id: string;
  visible: boolean;
  room_visibility: RoomVisibilityState;
}

interface RoomVisibilityResponse {
  room_visibility: RoomVisibilityState;
}

interface SetDoorStatusResponse {
  success: boolean;
  connection_id: string;
  door_status: DoorStatus;
  all_door_status: DoorStatusState;
}

interface TokenResponse {
  success: boolean;
  token_id?: string;
  tokens: TokenState;
}

interface TokenImagesResponse {
  images: TokenImage[];
}

/**
 * Get map data for a location (includes visibility state for players)
 */
async function getMapData(locationSlug: string): Promise<MapDataResponse> {
  const response = await api.get<MapDataResponse>(`/encounter-map/${locationSlug}/`);
  return response.data;
}

/**
 * Get all decks' data for a location (GM only - for room visibility panel)
 */
async function getAllDecks(locationSlug: string): Promise<AllDecksResponse> {
  const response = await api.get<AllDecksResponse>(`/encounter-map/${locationSlug}/all-decks/`);
  return response.data;
}

/**
 * Switch to a different deck level (GM only)
 */
async function switchLevel(level: number, deckId: string): Promise<SwitchLevelResponse> {
  const response = await api.post<SwitchLevelResponse>('/gm/encounter/switch-level/', {
    level,
    deck_id: deckId
  });
  return response.data;
}

/**
 * Toggle room visibility (GM only)
 * If visible is not provided, toggles the current state
 */
async function toggleRoom(roomId: string, visible?: boolean): Promise<ToggleRoomResponse> {
  const response = await api.post<ToggleRoomResponse>('/gm/encounter/toggle-room/', {
    room_id: roomId,
    visible
  });
  return response.data;
}

/**
 * Get current room visibility state (GM only)
 */
async function getRoomVisibility(): Promise<RoomVisibilityState> {
  const response = await api.get<RoomVisibilityResponse>('/gm/encounter/room-visibility/');
  return response.data.room_visibility;
}

/**
 * Set all room visibility at once (GM only)
 */
async function setRoomVisibility(roomVisibility: RoomVisibilityState): Promise<RoomVisibilityState> {
  const response = await api.post<RoomVisibilityResponse>('/gm/encounter/room-visibility/', {
    room_visibility: roomVisibility
  });
  return response.data.room_visibility;
}

/**
 * Show all rooms (set all visible)
 */
async function showAllRooms(roomIds: string[]): Promise<RoomVisibilityState> {
  const visibility: RoomVisibilityState = {};
  roomIds.forEach(id => { visibility[id] = true; });
  return setRoomVisibility(visibility);
}

/**
 * Hide all rooms (set all hidden)
 */
async function hideAllRooms(roomIds: string[]): Promise<RoomVisibilityState> {
  const visibility: RoomVisibilityState = {};
  roomIds.forEach(id => { visibility[id] = false; });
  return setRoomVisibility(visibility);
}

/**
 * Set door status for a connection (GM only)
 */
async function setDoorStatus(connectionId: string, doorStatus: DoorStatus): Promise<SetDoorStatusResponse> {
  const response = await api.post<SetDoorStatusResponse>('/gm/encounter/set-door-status/', {
    connection_id: connectionId,
    door_status: doorStatus
  });
  return response.data;
}

/**
 * Place a new token on the encounter map (GM only)
 */
async function placeToken(
  type: TokenType,
  name: string,
  x: number,
  y: number,
  imageUrl?: string,
  roomId?: string
): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/gm/encounter/place-token/', {
    type,
    name,
    x,
    y,
    image_url: imageUrl || '',
    room_id: roomId || '',
  });
  return response.data;
}

/**
 * Move an existing token to a new position (GM only)
 */
async function moveToken(tokenId: string, x: number, y: number, roomId?: string): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/gm/encounter/move-token/', {
    token_id: tokenId,
    x,
    y,
    room_id: roomId || '',
  });
  return response.data;
}

/**
 * Remove a token from the encounter map (GM only)
 */
async function removeToken(tokenId: string): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/gm/encounter/remove-token/', {
    token_id: tokenId,
  });
  return response.data;
}

/**
 * Update token status flags (GM only)
 */
async function updateTokenStatus(tokenId: string, status: TokenStatus[]): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/gm/encounter/update-token-status/', {
    token_id: tokenId,
    status,
  });
  return response.data;
}

/**
 * Clear all tokens from the encounter map (GM only)
 */
async function clearAllTokens(): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/gm/encounter/clear-tokens/', {});
  return response.data;
}

/**
 * Get list of available token images from campaign data (GM only)
 */
async function getTokenImages(): Promise<TokenImage[]> {
  const response = await api.get<TokenImagesResponse>('/gm/encounter/token-images/');
  return response.data.images;
}

export const encounterApi = {
  getMapData,
  getAllDecks,
  switchLevel,
  toggleRoom,
  getRoomVisibility,
  setRoomVisibility,
  showAllRooms,
  hideAllRooms,
  setDoorStatus,
  placeToken,
  moveToken,
  removeToken,
  updateTokenStatus,
  clearAllTokens,
  getTokenImages,
};

export type { DeckWithRooms, AllDecksResponse };
