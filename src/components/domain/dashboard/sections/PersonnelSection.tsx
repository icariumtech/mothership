import { useState, useMemo } from 'react';
import { DashboardPanel } from '@components/ui/DashboardPanel';
import { buildInfoHTML } from '../InfoPanel';
import type { CrewMember, NPC } from '../BridgeView';
import './Section.css';
import './PersonnelSection.css';

type PersonType = 'crew' | 'npc';

interface SelectedPerson {
  type: PersonType;
  id: string;
}

// Read data from window.INITIAL_DATA (same pattern as initial data loading)
function getCrewData(): CrewMember[] {
  return window.INITIAL_DATA?.crew || [];
}

function getNpcData(): NPC[] {
  return window.INITIAL_DATA?.npcs || [];
}

function getStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'missing' || s === 'mia') return 'missing';
  if (s === 'deceased' || s === 'kia' || s === 'dead') return 'deceased';
  return 'active';
}

/** Key fields shown next to the portrait */
function buildCrewHeaderHTML(member: CrewMember): string {
  return buildInfoHTML([
    { label: 'NAME', value: member.name },
    { label: 'CALLSIGN', value: member.callsign },
    { label: 'CLASS', value: member.class?.toUpperCase() },
    { label: 'ROLE', value: member.role },
    { label: 'BACKGROUND', value: member.background },
    { label: 'STATUS', value: member.status?.toUpperCase() },
  ]);
}

/** Extended info shown below the portrait row */
function buildCrewBodyHTML(member: CrewMember): string {
  let html = '';

  // Stress
  html += `<p><span class="info-label">STRESS:</span> <span class="info-value">${member.stress}</span></p>`;

  html += `<p><span class="info-label">HEALTH:</span> <span class="info-value">${member.health.current}/${member.health.max}</span></p>`;

  html += buildInfoHTML([
    { label: 'WOUNDS', value: member.wounds },
    { label: 'ARMOR', value: member.armor },
  ]);

  // Stats grid
  html += '<div class="personnel-stats-grid">';
  html += `<p><span class="info-label">STR:</span> <span class="info-value">${member.stats.strength}</span></p>`;
  html += `<p><span class="info-label">SPD:</span> <span class="info-value">${member.stats.speed}</span></p>`;
  html += `<p><span class="info-label">INT:</span> <span class="info-value">${member.stats.intellect}</span></p>`;
  html += `<p><span class="info-label">CMB:</span> <span class="info-value">${member.stats.combat}</span></p>`;
  html += '</div>';

  // Saves grid
  html += '<div class="personnel-stats-grid">';
  html += `<p><span class="info-label">SAN:</span> <span class="info-value">${member.saves.sanity}%</span></p>`;
  html += `<p><span class="info-label">FEAR:</span> <span class="info-value">${member.saves.fear}%</span></p>`;
  html += `<p><span class="info-label">BODY:</span> <span class="info-value">${member.saves.body}%</span></p>`;
  html += '</div>';

  if (member.description) {
    html += `<p><span class="info-label">DESCRIPTION:</span> <span class="info-value">${member.description}</span></p>`;
  }

  return html;
}

function buildNpcHeaderHTML(npc: NPC): string {
  return buildInfoHTML([
    { label: 'NAME', value: npc.name },
    { label: 'ROLE', value: npc.role },
    { label: 'FACTION', value: npc.faction },
    { label: 'LOCATION', value: npc.location },
    { label: 'STATUS', value: npc.status?.toUpperCase() },
  ]);
}

function buildNpcBodyHTML(npc: NPC): string {
  if (!npc.description) return '';
  return buildInfoHTML([
    { label: 'DESCRIPTION', value: npc.description },
  ]);
}

export function PersonnelSection() {
  const [selected, setSelected] = useState<SelectedPerson | null>(null);

  const crew = useMemo(() => getCrewData(), []);
  const npcs = useMemo(() => getNpcData(), []);

  // Group NPCs by location, sorted alphabetically
  const npcGroups = useMemo(() => {
    const groups: Record<string, NPC[]> = {};
    for (const npc of npcs) {
      const loc = npc.location || 'UNKNOWN';
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(npc);
    }
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    for (const [, members] of sorted) {
      members.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [npcs]);

  // Find selected person data — split into header (beside portrait) and body (below)
  const selectedData = useMemo(() => {
    if (!selected) return null;
    if (selected.type === 'crew') {
      const member = crew.find(c => c.id === selected.id);
      if (!member) return null;
      return {
        name: member.name,
        portrait: member.portrait,
        headerHTML: buildCrewHeaderHTML(member),
        bodyHTML: buildCrewBodyHTML(member),
      };
    } else {
      const npc = npcs.find(n => n.id === selected.id);
      if (!npc) return null;
      return {
        name: npc.name,
        portrait: npc.portrait,
        headerHTML: buildNpcHeaderHTML(npc),
        bodyHTML: buildNpcBodyHTML(npc),
      };
    }
  }, [selected, crew, npcs]);

  const handleSelect = (type: PersonType, id: string) => {
    setSelected(prev =>
      prev?.type === type && prev?.id === id ? null : { type, id }
    );
  };

  return (
    <div className="section-personnel">
      <DashboardPanel title="PERSONNEL" chamferCorners={['tl', 'br']} padding={0}>
        <div className="personnel-split">
          {/* Left side - scrollable list */}
          <div className="personnel-list">
            {/* Crew group - always first */}
            {crew.length > 0 && (
              <>
                <div className="personnel-group-header">CREW</div>
                {crew.map(member => (
                  <div
                    key={member.id}
                    className={`personnel-row ${selected?.type === 'crew' && selected?.id === member.id ? 'selected' : ''}`}
                    onClick={() => handleSelect('crew', member.id)}
                  >
                    <div className="personnel-row-content">
                      <div className={`personnel-row-checkbox ${selected?.type === 'crew' && selected?.id === member.id ? 'checked' : ''}`} />
                      <div className="personnel-row-info">
                        <div className="personnel-row-name">{member.name}</div>
                        <div className="personnel-row-role">{member.role}</div>
                      </div>
                    </div>
                    <div className={`personnel-row-status ${getStatusClass(member.status)}`}>
                      {member.status}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* NPC groups - grouped by location */}
            {npcGroups.map(([location, members]) => (
              <div key={location}>
                <div className="personnel-group-header">{location.toUpperCase()}</div>
                {members.map(npc => (
                  <div
                    key={npc.id}
                    className={`personnel-row ${selected?.type === 'npc' && selected?.id === npc.id ? 'selected' : ''}`}
                    onClick={() => handleSelect('npc', npc.id)}
                  >
                    <div className="personnel-row-content">
                      <div className={`personnel-row-checkbox ${selected?.type === 'npc' && selected?.id === npc.id ? 'checked' : ''}`} />
                      <div className="personnel-row-info">
                        <div className="personnel-row-name">{npc.name}</div>
                        <div className="personnel-row-role">{npc.role}</div>
                      </div>
                    </div>
                    <div className={`personnel-row-status ${getStatusClass(npc.status)}`}>
                      {npc.status}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {crew.length === 0 && npcs.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>&gt; No personnel records found</p>
            )}
          </div>

          {/* Right side - detail view */}
          <div className="personnel-detail">
            {selectedData ? (
              <div className="personnel-detail-body visible">
                {/* Top row: portrait left, key fields right */}
                <div className="personnel-detail-header">
                  {selectedData.portrait && (
                    <img
                      src={selectedData.portrait}
                      alt={selectedData.name}
                      className="personnel-portrait"
                    />
                  )}
                  <div
                    className="personnel-detail-fields"
                    dangerouslySetInnerHTML={{ __html: selectedData.headerHTML }}
                  />
                </div>
                {/* Full-width body below */}
                {selectedData.bodyHTML && (
                  <div
                    className="personnel-detail-extended"
                    dangerouslySetInnerHTML={{ __html: selectedData.bodyHTML }}
                  />
                )}
              </div>
            ) : (
              <div className="personnel-detail-empty">
                &gt; SELECT PERSONNEL TO VIEW DETAILS
              </div>
            )}
          </div>
        </div>
      </DashboardPanel>
    </div>
  );
}
