export function StandbyView() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <div style={{ color: '#555', fontSize: 24, letterSpacing: 4, fontWeight: 300 }}>
        STANDBY
      </div>
      <div style={{ color: '#333', fontSize: 12 }}>
        Select a view from the rail to begin
      </div>
    </div>
  );
}
