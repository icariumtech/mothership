import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import { Button, Tooltip } from 'antd';
import {
  SaveOutlined,
  FolderOpenOutlined,
  FileOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { DataFileTree } from '../DataFileTree';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import { DeckplanPreviewPane } from './deckplan/DeckplanPreviewPane';
import { buildIdRangeMap } from './deckplan/useDeckplanModel';
import { buildPoiRoomMoveEdit, buildAddPoiEdit, type TextEdit } from './deckplan/deckplanYamlEdits';
import './FileEditorView.css';

const MONOSPACE_FONT = "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace";
const BINARY_EXTENSIONS = ['.exe', '.bin', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.db', '.sqlite', '.pak'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];
const LS_KEY = 'janus_file_editor_last_path';
/** localStorage key for persisting the Monaco/preview split ratio (0.0–1.0). */
const LS_SPLIT_KEY = 'janus_file_editor_split_ratio';
const DEFAULT_SPLIT_RATIO = 0.6; // 60% Monaco / 40% preview (per D-07)

function getLanguage(path: string): 'yaml' | 'markdown' | 'plaintext' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'md') return 'markdown';
  return 'plaintext';
}

function isImage(path: string): boolean {
  return IMAGE_EXTENSIONS.some(e => path.toLowerCase().endsWith(e));
}

function isBinaryOrUnknown(path: string): boolean {
  return BINARY_EXTENSIONS.some(e => path.toLowerCase().endsWith(e));
}

/**
 * Returns true when the open file is a deckplan.yaml (by basename, per D-07).
 * Only the exact basename triggers the preview pane — not other YAML files.
 */
function isDeckplan(path: string): boolean {
  return path.split('/').pop() === 'deckplan.yaml';
}

export function FileEditorView() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Title shown in the error banner — changes between VALIDATION ERROR and MAP SYNC ERROR. */
  const [errorTitle, setErrorTitle] = useState<string>('VALIDATION ERROR');

  // Deckplan preview state
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  // Keep a ref in sync with selectedDeckId so stable callbacks always read the latest value
  // without being added to dependency arrays (same pattern as handleSaveRef).
  const selectedDeckIdRef = useRef<string | null>(selectedDeckId);
  selectedDeckIdRef.current = selectedDeckId;

  // Split ratio state: 0.0–1.0 = fraction of height given to Monaco
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const stored = localStorage.getItem(LS_SPLIT_KEY);
    if (stored) {
      const v = parseFloat(stored);
      if (!isNaN(v) && v >= 0.2 && v <= 0.85) return v;
    }
    return DEFAULT_SPLIT_RATIO;
  });
  const splitRatioRef = useRef(splitRatio);
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ y: 0, ratio: DEFAULT_SPLIT_RATIO });
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartRef.current = { y: e.clientY, ratio: splitRatioRef.current };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    const container = splitContainerRef.current;
    if (!container) return;
    const totalH = container.getBoundingClientRect().height;
    const dy = e.clientY - resizeStartRef.current.y;
    const newRatio = Math.min(0.85, Math.max(0.2, resizeStartRef.current.ratio + dy / totalH));
    splitRatioRef.current = newRatio;
    setSplitRatio(newRatio);
  }, []);

  const handleResizePointerUp = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    localStorage.setItem(LS_SPLIT_KEY, String(splitRatioRef.current));
  }, []);

  const errorDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  /** Stored monaco namespace (the second arg from onMount) for constructing Range objects. */
  const monacoRef = useRef<Monaco | null>(null);
  /** Decoration ids returned by the last deltaDecorations call; cleared on next jump or caret move. */
  const decorationIdsRef = useRef<string[]>([]);
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);

  const isDirty = content !== savedContent;

  const handleSave = useCallback(async () => {
    if (!selectedPath) return;
    if (getLanguage(selectedPath) === 'plaintext') return;
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    try {
      await gmConsoleApi.writeDataFile(selectedPath, content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
      setErrorMessage(null);
      setErrorTitle('VALIDATION ERROR');
      setSavedContent(content);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 150);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string; error?: string } } };
      const msg =
        axiosErr.response?.data?.detail ||
        axiosErr.response?.data?.error ||
        'Save failed';
      setErrorTitle('VALIDATION ERROR');
      setErrorMessage(msg);
      if (errorDismissTimer.current) clearTimeout(errorDismissTimer.current);
      errorDismissTimer.current = setTimeout(() => setErrorMessage(null), 8000);
    } finally {
      setIsSaving(false);
    }
  }, [selectedPath, content, isDirty, isSaving]);

  // Keep ref updated every render to avoid stale closure in Monaco addCommand
  handleSaveRef.current = handleSave;

  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedPath(path);
    localStorage.setItem(LS_KEY, path);
    setContent('');
    setSavedContent('');
    setErrorMessage(null);
    setErrorTitle('VALIDATION ERROR');

    if (isImage(path) || isBinaryOrUnknown(path)) {
      return;
    }

    try {
      const text = await gmConsoleApi.readDataFile(path);
      setContent(text);
      setSavedContent(text);
    } catch {
      setErrorMessage('Failed to load file');
    }
  }, []);

  // Restore last opened file from localStorage on mount
  useEffect(() => {
    const lastPath = localStorage.getItem(LS_KEY);
    if (lastPath) {
      handleSelectFile(lastPath);
    }
  }, [handleSelectFile]);

  // -----------------------------------------------------------------------
  // Click-to-jump: EDIT-04
  // Rebuilds the id→range map from the live Monaco model (Pitfall 4) and
  // reveals + amber-highlights the matching deck-scoped `id:` line.
  // -----------------------------------------------------------------------

  /**
   * Jump the Monaco editor to the line of the given element on the currently-selected deck.
   *
   * - Always rebuilds the id→range map from `editor.getModel().getValue()` at call time
   *   (not from debounced React content state — Pitfall 4).
   * - Lookup is deck-scoped: `${selectedDeckId}|${kind}|${id}` (Pitfall 3).
   * - On match: reveals the line and applies a whole-line amber decoration.
   * - On no-match: shows a transient MAP SYNC ERROR banner.
   */
  const jumpToElement = useCallback((kind: 'room' | 'poi' | 'door', id: string) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const deckId = selectedDeckIdRef.current;
    if (!editor || !monaco || !deckId) return;

    // Source of truth: live Monaco model value, NOT debounced React content state (Pitfall 4)
    const liveText = editor.getModel()?.getValue();
    if (!liveText) return;

    const rangeMap = buildIdRangeMap(liveText);
    const key = `${deckId}|${kind}|${id}`;
    const entry = rangeMap.get(key);

    if (!entry) {
      // MAP SYNC ERROR — element not found (YAML edited since last preview refresh)
      setErrorTitle('MAP SYNC ERROR');
      setErrorMessage(
        'Could not match this element to a line in the editor. The YAML may have been edited since the last preview refresh.',
      );
      if (errorDismissTimer.current) clearTimeout(errorDismissTimer.current);
      errorDismissTimer.current = setTimeout(() => setErrorMessage(null), 8000);
      return;
    }

    const line = entry.idLineStart;

    // Reveal without ScrollType to avoid const-enum runtime issues
    editor.revealRangeInCenter(new monaco.Range(line, 1, line, 1));

    // Apply whole-line amber highlight, clearing any previous decoration
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [
      {
        range: new monaco.Range(line, 1, line, Number.MAX_SAFE_INTEGER),
        options: { isWholeLine: true, className: 'deckplan-jump-highlight' },
      },
    ]);
  }, []); // all deps are refs — stable across renders

  const onEditorMount = useCallback<OnMount>((editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;
    // Force LF line endings — Monaco defaults to CRLF on Windows/WSL2, which
    // causes ^M on every line in git diff when saving. Numeric 0 = EndOfLineSequence.LF
    // (const enum avoided to prevent runtime lookup issues).
    editorInstance.getModel()?.setEOL(0);
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current?.();
    });
    // Clear the jump highlight whenever the user manually moves the caret (UI-SPEC)
    editorInstance.onDidChangeCursorPosition(() => {
      if (decorationIdsRef.current.length > 0) {
        decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, []);
      }
    });
  }, []);

  // -----------------------------------------------------------------------
  // Surgical text edits: EDIT-05 (POI drag-to-move) + EDIT-06 (add POI)
  // Both use editor.executeEdits() — never YAML.stringify / setValue (D-12).
  // -----------------------------------------------------------------------

  /**
   * Apply a TextEdit (1-based line/col) to the Monaco editor via executeEdits.
   *
   * This fires Monaco's onDidChangeModelContent → onChange prop → setContent(val)
   * → isDirty flips to true. The existing handleSave / writeDataFile / PUT path
   * persists the result (D-15). No new save code needed.
   */
  const applyDeckplanEdit = useCallback((textEdit: TextEdit | TextEdit[] | null) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!textEdit || !editor || !monaco) return;
    const edits = Array.isArray(textEdit) ? textEdit : [textEdit];
    if (edits.length === 0) return;
    editor.executeEdits('deckplan', edits.map(te => ({
      range: new monaco.Range(te.startLine, te.startCol, te.endLine, te.endCol),
      text: te.text,
    })));
  }, []);

  /**
   * POI drag-to-move (EDIT-05): surgically replace the POI's `position:` value.
   *
   * No confirmation dialog — Ctrl+Z undoes it (UI-SPEC).
   * Reads the live model at interaction time (Pitfall 4).
   */
  const onPoiMove = useCallback((poiId: string, x: number, y: number) => {
    const editor = editorRef.current;
    const deckId = selectedDeckIdRef.current;
    if (!editor || !deckId) return;
    const liveText = editor.getModel()?.getValue() ?? '';
    const edits = buildPoiRoomMoveEdit(liveText, deckId, poiId, x, y);
    if (edits.length > 0) applyDeckplanEdit(edits);
  }, [applyDeckplanEdit]);

  /**
   * Empty-cell click-to-add POI (EDIT-06): insert a POI stub into the deck's poi: list.
   *
   * Defaults: name "New POI", type/icon "marker" (UI-SPEC).
   * After inserting, highlights the new stub's line so the GM can immediately edit it.
   * Reads the live model at interaction time (Pitfall 4).
   */
  const onEmptyCellClick = useCallback((x: number, y: number) => {
    const editor = editorRef.current;
    const deckId = selectedDeckIdRef.current;
    if (!editor || !deckId) return;

    // Generate the id before building the edit so we can jump to it after insertion
    const poiId = `poi_${Date.now()}`;
    const liveText = editor.getModel()?.getValue() ?? '';
    const edit = buildAddPoiEdit(liveText, deckId, x, y, {
      id: poiId,
      name: 'New POI',
      type: 'marker',
      icon: 'marker',
    });

    applyDeckplanEdit(edit);

    if (edit) {
      // Let Monaco process the executeEdits before jumping; rAF ensures the model is settled
      requestAnimationFrame(() => {
        jumpToElement('poi', poiId);
      });
    }
  }, [applyDeckplanEdit, jumpToElement]);

  // Breadcrumb rendering
  function renderBreadcrumb() {
    if (!selectedPath) return null;
    const parts = selectedPath.split('/');
    const filename = parts[parts.length - 1];
    const directories = parts.slice(0, -1);

    return (
      <>
        {directories.map((seg, i) => (
          <span key={i}>
            <span style={{ color: '#4a7070' }}>{seg}</span>
            <span style={{ color: '#2a4a4a' }}> / </span>
          </span>
        ))}
        {isDirty ? (
          <span style={{ color: '#8b7355' }}>
            <span style={{ color: '#c9a050', fontSize: 8, marginRight: 4 }}>●</span>
            {filename}
          </span>
        ) : (
          <span style={{ color: '#7ab8b8' }}>{filename}</span>
        )}
      </>
    );
  }

  // Determine file state
  const fileLanguage = selectedPath ? getLanguage(selectedPath) : 'plaintext';
  const isReadOnly = fileLanguage === 'plaintext';
  const showSaveButton =
    selectedPath !== null &&
    !isReadOnly &&
    !isImage(selectedPath) &&
    !isBinaryOrUnknown(selectedPath);

  // Editor area content
  function renderEditorContent() {
    if (!selectedPath) {
      return (
        <div className="gm-file-editor-view__empty-state">
          <FolderOpenOutlined style={{ fontSize: 48, color: '#2a4a4a' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a4a4a', letterSpacing: '1px', fontFamily: MONOSPACE_FONT }}>
              SELECT A FILE
            </div>
            <div style={{ fontSize: 12, color: '#2a4a4a', fontFamily: MONOSPACE_FONT, marginTop: 8 }}>
              Browse the data directory and select a YAML or Markdown file to edit.
            </div>
          </div>
        </div>
      );
    }

    if (isImage(selectedPath)) {
      const filename = selectedPath.split('/').pop();
      return (
        <div className="gm-file-editor-view__image-preview">
          <img
            src={'/data/' + selectedPath}
            alt={filename}
            style={{ maxWidth: '100%', maxHeight: '80%', objectFit: 'contain' }}
          />
          <div style={{ fontSize: 12, color: '#4a7070', fontFamily: MONOSPACE_FONT }}>{filename}</div>
        </div>
      );
    }

    if (isBinaryOrUnknown(selectedPath)) {
      return (
        <div className="gm-file-editor-view__nonable-state">
          <FileOutlined style={{ fontSize: 48, color: '#2a4a4a' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a4a4a', letterSpacing: '1px', fontFamily: MONOSPACE_FONT }}>
              BINARY FILE — CANNOT EDIT
            </div>
            <div style={{ fontSize: 11, color: '#2a4a4a', fontFamily: MONOSPACE_FONT, marginTop: 8 }}>
              {selectedPath}
            </div>
          </div>
        </div>
      );
    }

    // Text file (editable or read-only plaintext)
    // For deckplan.yaml files: render Monaco (top) + DeckplanPreviewPane (bottom) as a resizable 60/40 split.
    // For all other text files: render Monaco in a single full-height pane (unchanged).
    if (isDeckplan(selectedPath) && fileLanguage === 'yaml') {
      return (
        <div
          ref={splitContainerRef}
          className="gm-file-editor-view__split-container"
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        >
          {/* Top pane: Monaco editor (flex: 0 0 splitRatio%) */}
          <div
            className="gm-file-editor-view__split-monaco"
            style={{ flex: `0 0 ${(splitRatio * 100).toFixed(1)}%` }}
          >
            <Editor
              theme="vs-dark"
              language={fileLanguage}
              value={content}
              onChange={(val) => { if (!isReadOnly) setContent(val ?? ''); }}
              onMount={onEditorMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                fontFamily: "'Cascadia Code', 'Courier New', monospace",
                fontSize: 14,
                readOnly: isReadOnly,
              }}
              height="100%"
              width="100%"
            />
          </div>

          {/* Resize handle: 4px visual / 44px hit target (per Spacing exceptions in UI-SPEC) */}
          <div
            className="gm-file-editor-view__resize-handle"
            onPointerDown={handleResizePointerDown}
            title="Drag to resize"
          />

          {/* Bottom pane: live deck preview wired to Monaco edit callbacks (EDIT-04..06) */}
          <div className="gm-file-editor-view__split-preview">
            <DeckplanPreviewPane
              yamlText={content}
              selectedDeckId={selectedDeckId}
              onDeckSelect={setSelectedDeckId}
              onRoomClick={(roomId) => jumpToElement('room', roomId)}
              onDoorClick={(doorId) => jumpToElement('door', doorId)}
              onPoiClick={(poiId) => jumpToElement('poi', poiId)}
              onPoiMove={onPoiMove}
              onEmptyCellClick={onEmptyCellClick}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="gm-file-editor-view__monaco">
        <Editor
          theme="vs-dark"
          language={fileLanguage}
          value={content}
          onChange={(val) => { if (!isReadOnly) setContent(val ?? ''); }}
          onMount={onEditorMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: fileLanguage === 'markdown' ? 'on' : 'off',
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
            fontSize: 14,
            readOnly: isReadOnly,
          }}
          height="100%"
          width="100%"
        />
      </div>
    );
  }

  return (
    <div className="gm-file-editor-view">
      {/* Left tree panel */}
      <div className="gm-file-editor-view__tree">
        <DataFileTree selectedPath={selectedPath} onSelectFile={handleSelectFile} />
      </div>

      {/* Right editor area */}
      <div className="gm-file-editor-view__editor-area">
        {/* Toolbar */}
        <div className="gm-file-editor-view__toolbar">
          <div className="gm-file-editor-view__breadcrumb">
            {renderBreadcrumb()}
          </div>
          {showSaveButton && (
            <Tooltip title="Save (Ctrl+S)" placement="left">
              <Button
                size="small"
                icon={<SaveOutlined />}
                loading={isSaving}
                disabled={!isDirty && !isSaving}
                onClick={handleSave}
                style={{
                  borderColor: saveFlash ? '#2a5a2a' : (isDirty ? '#c9a050' : '#4a8b8b'),
                  color: saveFlash ? '#2a5a2a' : (isDirty ? '#c9a050' : '#4a8b8b'),
                  background: saveFlash ? 'rgba(42,90,42,0.3)' : 'transparent',
                  opacity: isDirty ? 1 : 0.7,
                  letterSpacing: '1px',
                  fontFamily: MONOSPACE_FONT,
                }}
              >
                SAVE
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Error banner — title switches between VALIDATION ERROR and MAP SYNC ERROR */}
        {errorMessage && (
          <div className="gm-file-editor-view__error-banner">
            <ExclamationCircleOutlined style={{ fontSize: 16, color: '#c0392b', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#c0392b', letterSpacing: '1px', fontFamily: MONOSPACE_FONT }}>
                {errorTitle}
              </div>
              <div style={{ fontSize: 12, color: '#7ab8b8', fontFamily: MONOSPACE_FONT, marginTop: 2 }}>
                {errorMessage}
              </div>
            </div>
          </div>
        )}

        {/* Editor content */}
        {renderEditorContent()}
      </div>
    </div>
  );
}
