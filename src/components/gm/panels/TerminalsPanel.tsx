import { Button, Typography } from 'antd';
import type { Location } from '@/types/gmConsole';

const { Text } = Typography;

interface TerminalsPanelProps {
  locations: Location[];
  activeTerminalLocationSlug: string | null;
  activeTerminalSlug: string | null;
  onShowTerminal: (locationSlug: string, terminalSlug: string) => void;
}

/**
 * Recursively collect all locations that have terminals
 */
function collectLocationsWithTerminals(locations: Location[]): Location[] {
  const result: Location[] = [];
  for (const loc of locations) {
    if (loc.terminals.length > 0) {
      result.push(loc);
    }
    result.push(...collectLocationsWithTerminals(loc.children));
  }
  return result;
}

export function TerminalsPanel({
  locations,
  activeTerminalLocationSlug,
  activeTerminalSlug,
  onShowTerminal,
}: TerminalsPanelProps) {
  const locsWithTerminals = collectLocationsWithTerminals(locations);

  if (locsWithTerminals.length === 0) {
    return <Text type="secondary" style={{ fontSize: 11 }}>No terminals found</Text>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {locsWithTerminals.map(loc => (
        <div key={loc.slug}>
          <Text
            style={{
              display: 'block',
              color: '#5a7a7a',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            {loc.name.toUpperCase()}
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loc.terminals.map(terminal => {
              const isActive = loc.slug === activeTerminalLocationSlug &&
                               terminal.slug === activeTerminalSlug;
              return (
                <div
                  key={terminal.slug}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <Text style={{ fontSize: 12 }}>{terminal.name}</Text>
                    {terminal.owner && (
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>
                        ({terminal.owner})
                      </Text>
                    )}
                  </div>
                  <Button
                    size="small"
                    type={isActive ? 'primary' : 'default'}
                    style={isActive ? { background: '#8b7355', borderColor: '#8b7355' } : {}}
                    onClick={() => onShowTerminal(loc.slug, terminal.slug)}
                  >
                    {isActive ? 'HIDE' : 'SHOW'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
