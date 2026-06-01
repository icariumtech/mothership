import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Button, Tooltip } from 'antd';
import {
  SaveOutlined,
  FolderOpenOutlined,
  FileOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { DataFileTree } from '../DataFileTree';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import './FileEditorView.css';

const MONOSPACE_FONT = "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace";
const BINARY_EXTENSIONS = ['.exe', '.bin', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.db', '.sqlite', '.pak'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];
const LS_KEY = 'janus_file_editor_last_path';

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

export function FileEditorView() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errorDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);

  const isDirty = content !== savedContent;

  const handleSave = useCallback(async () => {
    if (!selectedPath) return;
    if (getLanguage(selectedPath) === 'plaintext') return;
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    try {
      await gmConsoleApi.writeDataFile(selectedPath, content);
      setErrorMessage(null);
      setSavedContent(content);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 150);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string; error?: string } } };
      const msg =
        axiosErr.response?.data?.detail ||
        axiosErr.response?.data?.error ||
        'Save failed';
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

  const onEditorMount = useCallback<OnMount>((editorInstance, monaco) => {
    editorRef.current = editorInstance;
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current?.();
    });
  }, []);

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

        {/* Error banner */}
        {errorMessage && (
          <div className="gm-file-editor-view__error-banner">
            <ExclamationCircleOutlined style={{ fontSize: 16, color: '#c0392b', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#c0392b', letterSpacing: '1px', fontFamily: MONOSPACE_FONT }}>
                VALIDATION ERROR
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
