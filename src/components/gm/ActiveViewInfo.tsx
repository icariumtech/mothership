import { Card, Descriptions, Tag, Empty } from 'antd';
import { ActiveView, Location } from '@/types/gmConsole';

interface ActiveViewInfoProps {
  activeView: ActiveView | null;
  locations: Location[];
}

function findLocation(locations: Location[], slug: string): Location | null {
  for (const loc of locations) {
    if (loc.slug === slug) return loc;
    const found = findLocation(loc.children, slug);
    if (found) return found;
  }
  return null;
}

export function ActiveViewInfo({ activeView, locations }: ActiveViewInfoProps) {
  if (!activeView) {
    return (
      <Card title="ACTIVE VIEW" size="small">
        <Empty description="No active view" />
      </Card>
    );
  }

  const location = activeView.location_slug
    ? findLocation(locations, activeView.location_slug)
    : null;

  return (
    <Card title="ACTIVE VIEW" size="small">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Type">
          <Tag color="blue">{activeView.view_type}</Tag>
        </Descriptions.Item>

        {location && (
          <>
            <Descriptions.Item label="Location">
              {location.name}
            </Descriptions.Item>
            {location.status && (
              <Descriptions.Item label="Status">
                <Tag color="green">{location.status}</Tag>
              </Descriptions.Item>
            )}
            {location.description && (
              <Descriptions.Item label="Description">
                {location.description}
              </Descriptions.Item>
            )}
          </>
        )}

        {activeView.overlay_terminal_slug && (
          <Descriptions.Item label="Overlay Terminal">
            <Tag color="orange">{activeView.overlay_terminal_slug}</Tag>
          </Descriptions.Item>
        )}

        <Descriptions.Item label="Updated">
          {activeView.updated_at}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
