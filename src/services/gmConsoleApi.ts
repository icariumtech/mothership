import { api } from './api';
import { Location, ActiveView, BroadcastMessage } from '@/types/gmConsole';

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

export const gmConsoleApi = {
  getLocations,
  getActiveView,
  switchView,
  showTerminal,
  sendBroadcast,
  switchToStandby,
  switchToBridge
};
