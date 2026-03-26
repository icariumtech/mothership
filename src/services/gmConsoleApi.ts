import { api } from './api';
import { Location, ActiveView, BroadcastMessage } from '@/types/gmConsole';
import { ShipStatusData } from '@/types/shipStatus';

export interface CrewMember {
  id: string;
  name: string;
  role?: string;
  class?: string;
  callsign?: string;
  faction?: string;
  location?: string;  // present on NPCs, absent on crew
  status?: string;
  stress?: number;
  health?: { current: number; max: number };
  wounds?: number;
  armor?: number;
  stats?: { strength: number; speed: number; intellect: number; combat: number };
  saves?: { sanity: number; fear: number; body: number };
  description?: string;
  portrait?: string;
}

export interface SessionLog {
  filename: string;
  session_number?: number;
  title?: string;
  date?: string;
  location?: string;
  npcs?: string[];
  body?: string;
}

async function getLocations(): Promise<Location[]> {
  const response = await api.get<{ locations: Location[] }>('/gm/locations/');
  return response.data.locations;
}

async function getActiveView(): Promise<ActiveView> {
  const response = await api.get<ActiveView>('/active-view/');
  return response.data;
}

async function switchView(viewType: string, locationSlug?: string): Promise<void> {
  await api.post('/gm/switch-view/', { view_type: viewType, location_slug: locationSlug || '' });
}

async function showTerminal(locationSlug: string, terminalSlug: string): Promise<void> {
  await api.post('/gm/show-terminal/', { location_slug: locationSlug, terminal_slug: terminalSlug });
}

async function sendBroadcast(message: BroadcastMessage): Promise<void> {
  await api.post('/gm/broadcast/', message);
}

async function switchToStandby(): Promise<void> {
  await api.post('/gm/switch-view/', { view_type: 'STANDBY' });
}

async function switchToBridge(): Promise<void> {
  await api.post('/gm/switch-view/', { view_type: 'BRIDGE' });
}

async function getShipStatus(): Promise<ShipStatusData> {
  const response = await api.get<ShipStatusData>('/ship-status/');
  return response.data;
}

async function toggleShipSystem(system: string, status: string, condition?: number, info?: string): Promise<any> {
  const response = await api.post('/gm/ship-status/toggle/', { system, status, condition, info });
  return response.data;
}

async function updateShipIntegrity(field: 'hull' | 'armor', current?: number, max?: number, info?: string): Promise<any> {
  const response = await api.post('/gm/ship-status/integrity/', { field, current, max, info });
  return response.data;
}

async function getCrew(): Promise<{ crew: CrewMember[]; npcs: CrewMember[] }> {
  const response = await api.get<{ crew: CrewMember[]; npcs: CrewMember[] }>('/gm/crew/');
  return response.data;
}

async function getSessions(): Promise<SessionLog[]> {
  const response = await api.get<{ sessions: SessionLog[] }>('/gm/sessions/');
  return response.data.sessions;
}

async function setShipLocation(locationSlug: string): Promise<void> {
  await api.post('/gm/ship/set-location/', { location_slug: locationSlug });
}

export interface CampaignDocSummary {
  slug: string;
  title: string;
}

export interface CampaignDoc {
  slug: string;
  title: string;
  content: string;
}

async function getCampaignDocs(): Promise<CampaignDocSummary[]> {
  const response = await api.get<{ docs: CampaignDocSummary[] }>('/gm/campaign-docs/');
  return response.data.docs;
}

async function getCampaignDoc(slug: string): Promise<CampaignDoc> {
  const response = await api.get<CampaignDoc>(`/gm/campaign-docs/${slug}/`);
  return response.data;
}

export const gmConsoleApi = {
  getLocations,
  getActiveView,
  switchView,
  showTerminal,
  sendBroadcast,
  switchToStandby,
  switchToBridge,
  getShipStatus,
  toggleShipSystem,
  updateShipIntegrity,
  getCrew,
  getSessions,
  setShipLocation,
  getCampaignDocs,
  getCampaignDoc,
};
