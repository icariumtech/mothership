import { useEffect, useRef, useCallback } from 'react';
import './StandbyView.css';

interface StandbyViewProps {
  title?: string;
  subtitle?: string;
}

// Line snippets for random text blocks
const LINE_SNIPPETS = [
  'SYSTEM ONLINE', 'ALL SYSTEMS NOMINAL', 'STANDBY MODE', 'AWAITING ORDERS',
  'QUANTUM FLUX DETECTED', 'STABILIZING FIELD', 'NEURAL INTERFACE ACTIVE',
  'SYNAPTIC LINK STABLE', 'BIOMETRIC SCAN COMPLETE', 'IDENTITY CONFIRMED',
  'HULL INTEGRITY: 98%', 'MINOR BREACH SEALED', 'LIFE SUPPORT: NOMINAL',
  'O2 LEVELS: OPTIMAL', 'REACTOR CORE: STABLE', 'POWER OUTPUT: 100%',
  'NAVIGATION READY', 'COORDINATES LOCKED', 'COMMS ARRAY: ONLINE',
  'SIGNAL STRENGTH: FULL', 'SENSOR SWEEP: CLEAR', 'NO CONTACTS DETECTED',
  'ENGINES: IDLE', 'FUEL: 87%', 'CARGO BAY: SECURE', 'CONTAINMENT HOLDING',
  'ATMOSPHERIC PRESSURE: STABLE', 'GRAVITY: 1.0G', 'SCANNING...',
  'ANALYSIS IN PROGRESS', 'PROCESSING...', 'DECRYPTING DATA',
  'INITIALIZING...', 'BOOT SEQUENCE ACTIVE', 'CRYO BAY: EMPTY',
  'ALL PODS DORMANT', 'MEDICAL: STANDBY', 'AUTO-DOC READY',
  'WEAPONS: OFFLINE', 'SAFETY PROTOCOLS ENGAGED', 'SHIELDS: CHARGING',
  '42% CAPACITY', 'JUMP DRIVE: READY', 'FTL AVAILABLE',
  'RADIATION LEVELS: SAFE', 'DOSE: 0.3 mSv', 'TARGETING SYSTEMS: OFFLINE',
  'PEACE MODE ACTIVE', 'DRONE BAY: SEALED', '3 UNITS READY',
  'MINING LASER: STANDBY', 'CAPACITOR CHARGED', 'EMERGENCY BEACON: ACTIVE',
  'BROADCASTING SOS', 'WARP CORE: STABLE', 'CONTAINMENT AT 100%',
  'AIRLOCK STATUS: SECURE', 'PRESSURE NOMINAL', 'LABORATORY: SEALED',
  'QUARANTINE ACTIVE', 'BRIDGE ACCESS: GRANTED', 'WELCOME COMMANDER',
  'UNKNOWN SIGNAL DETECTED', 'TRACKING SOURCE', 'HEAT SIGNATURE: ANOMALOUS',
  'INVESTIGATING', 'PROXIMITY ALERT', 'OBJECT AT 200M',
  'SYSTEM DIAGNOSTICS COMPLETE', 'NO ERRORS FOUND', 'FIRMWARE UPDATE AVAILABLE',
  'VERSION 3.7.2', 'BACKUP POWER: 100%', 'BATTERIES FULL',
  'WASTE RECYCLING: ACTIVE', 'EFFICIENCY: 94%', 'FOOD STORES: ADEQUATE',
  '142 DAYS REMAINING', 'WATER PURIFICATION: ONLINE', 'RESERVES: 89%',
  'SUIT TELEMETRY: NOMINAL', 'ALL CREW ACCOUNTED FOR', 'BLACK BOX: RECORDING',
  'FLIGHT DATA LOGGED', 'AUTO-PILOT: ENGAGED', 'COURSE LOCKED',
  'STELLAR CARTOGRAPHY', 'MAP UPDATE: 99%', 'ANOMALY DETECTED',
  'CLASSIFICATION: UNKNOWN', 'TEMPORAL DRIFT: MINIMAL', 'CHRONOMETER SYNCED',
  'EXOTIC MATTER: DETECTED', 'ANALYSIS PENDING', 'VOID EXPOSURE: MINIMAL',
  'CREW SAFETY: GREEN', 'DARK MATTER READINGS', 'THRESHOLD EXCEEDED',
  'SUBSPACE INTERFERENCE', 'COMPENSATING', 'ALIEN ARTIFACT DETECTED',
  'ORIGIN: UNKNOWN', 'DISTRESS CALL RECEIVED', 'INVESTIGATING TRANSMISSION'
];

interface BlockData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function StandbyView({
  title = 'MOTHERSHIP',
  subtitle = 'The Outer Veil'
}: StandbyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainTextRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const activeBlocksRef = useRef<BlockData[]>([]);
  const spawnTimeoutRef = useRef<number | null>(null);

  // Randomize glitch direction
  const randomizeGlitchDirection = useCallback((element: HTMLElement) => {
    const x1 = (Math.random() * 70 - 35).toFixed(0);
    const y1 = (Math.random() * 40 - 20).toFixed(0);
    const x2 = (Math.random() * 60 - 30).toFixed(0);
    const y2 = (Math.random() * 40 - 20).toFixed(0);
    const x3 = (Math.random() * 40 - 20).toFixed(0);
    const y3 = (Math.random() * 30 - 15).toFixed(0);

    element.style.setProperty('--glitch-x1', `${x1}px`);
    element.style.setProperty('--glitch-y1', `${y1}px`);
    element.style.setProperty('--glitch-x2', `${x2}px`);
    element.style.setProperty('--glitch-y2', `${y2}px`);
    element.style.setProperty('--glitch-x3', `${x3}px`);
    element.style.setProperty('--glitch-y3', `${y3}px`);
  }, []);

  // Get random lines for text blocks
  const getRandomLines = useCallback(() => {
    const lineCount = Math.floor(Math.random() * 4) + 1;
    const selectedLines: string[] = [];
    const availableLines = [...LINE_SNIPPETS];

    for (let i = 0; i < lineCount; i++) {
      const randomIndex = Math.floor(Math.random() * availableLines.length);
      selectedLines.push('> ' + availableLines[randomIndex]);
      availableLines.splice(randomIndex, 1);
    }

    return selectedLines.join('\n');
  }, []);

  // Check collision with existing blocks
  const checkCollision = useCallback((x: number, y: number, width: number, height: number) => {
    for (const block of activeBlocksRef.current) {
      if (!(x + width < block.x ||
            x > block.x + block.width ||
            y + height < block.y ||
            y > block.y + block.height)) {
        return true;
      }
    }
    return false;
  }, []);

  // Find safe position for new block
  const findSafePosition = useCallback((width: number, height: number): { x: number; y: number } | null => {
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x = Math.random() * 80 + 10;
      let y = Math.random() * 80 + 10;

      // Avoid center area
      if (x > 30 && x < 70 && y > 30 && y < 70) {
        if (Math.random() > 0.5) {
          x = x < 50 ? x - 35 : x + 35;
        } else {
          y = y < 50 ? y - 35 : y + 35;
        }
      }

      if (!checkCollision(x, y, width, height)) {
        return { x, y };
      }
    }

    return null;
  }, [checkCollision]);

  // Create a text block
  const createTextBlock = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const text = getRandomLines();
    const lineCount = text.split('\n').length;
    const maxLineLength = Math.max(...text.split('\n').map(line => line.length));
    const estimatedWidth = maxLineLength * 0.6;
    const estimatedHeight = lineCount * 2;

    const position = findSafePosition(estimatedWidth, estimatedHeight);
    if (!position) return;

    const block = document.createElement('div');
    block.className = 'text-block';
    block.style.left = position.x + '%';
    block.style.top = position.y + '%';

    container.appendChild(block);

    const blockData: BlockData = {
      x: position.x,
      y: position.y,
      width: estimatedWidth,
      height: estimatedHeight
    };
    activeBlocksRef.current.push(blockData);

    // Typewriter effect
    let currentText = '';
    let charIndex = 0;

    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        currentText += text[charIndex];
        block.textContent = currentText;
        charIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 50);

    // Remove after animation
    setTimeout(() => {
      block.remove();
      const index = activeBlocksRef.current.indexOf(blockData);
      if (index > -1) {
        activeBlocksRef.current.splice(index, 1);
      }
    }, 6000);
  }, [getRandomLines, findSafePosition]);

  // Spawn text blocks continuously
  const spawnTextBlocks = useCallback(() => {
    createTextBlock();
    const nextDelay = Math.random() * 600 + 400;
    spawnTimeoutRef.current = window.setTimeout(spawnTextBlocks, nextDelay);
  }, [createTextBlock]);

  // Initialize glitch animations and text blocks
  useEffect(() => {
    const mainText = mainTextRef.current;
    const subtitleEl = subtitleRef.current;

    // Initial randomization
    if (mainText) randomizeGlitchDirection(mainText);
    if (subtitleEl) randomizeGlitchDirection(subtitleEl);

    // Randomize on animation iteration
    const handleMainIteration = () => {
      if (mainText) randomizeGlitchDirection(mainText);
    };
    const handleSubtitleIteration = () => {
      if (subtitleEl) randomizeGlitchDirection(subtitleEl);
    };

    mainText?.addEventListener('animationiteration', handleMainIteration);
    subtitleEl?.addEventListener('animationiteration', handleSubtitleIteration);

    // Start spawning text blocks
    const startTimeout = window.setTimeout(spawnTextBlocks, 500);

    return () => {
      mainText?.removeEventListener('animationiteration', handleMainIteration);
      subtitleEl?.removeEventListener('animationiteration', handleSubtitleIteration);
      clearTimeout(startTimeout);
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
      }
    };
  }, [randomizeGlitchDirection, spawnTextBlocks]);

  return (
    <div className="standby-view" ref={containerRef}>
      <div className="standby-logo">
        <div
          className="standby-text"
          ref={mainTextRef}
          data-text={title}
        >
          {title}
        </div>
        <div
          className="standby-subtitle"
          ref={subtitleRef}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
