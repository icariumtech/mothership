/**
 * TokenPalette - Token management palette for GM
 *
 * Features:
 * - Pre-configured templates from crew roster and NPCs
 * - Custom token creator with image gallery
 * - Clear All Tokens button with confirmation
 * - Drag-and-drop support for placing tokens
 * - Template persistence after placement (for duplicates)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Space, Typography, Modal, message as antdMessage } from 'antd';
import { DeleteOutlined, PlusOutlined, UserOutlined, TeamOutlined, BugOutlined, BoxPlotOutlined } from '@ant-design/icons';
import { encounterApi } from '@/services/encounterApi';
import type { ActiveView } from '@/types/gmConsole';
import type { TokenState, TokenType, TokenImage, EncounterMapData, RoomVisibilityState } from '@/types/encounterMap';
import { TokenImageGallery } from './TokenImageGallery';

const { Text } = Typography;

interface TokenTemplate {
  type: TokenType;
  name: string;
  imageUrl: string;
}

interface TokenPaletteProps {
  activeView: ActiveView | null;
  tokens: TokenState;
  onTokensChange: (tokens: TokenState) => void;
  onViewUpdate: () => void;
  mapData: EncounterMapData | null;
  roomVisibility: RoomVisibilityState;
}

// Type icons
const TYPE_ICONS = {
  player: <UserOutlined />,
  npc: <TeamOutlined />,
  creature: <BugOutlined />,
  object: <BoxPlotOutlined />,
};

// Type colors (matching token glow colors)
const TYPE_COLORS = {
  player: '#8b7355',
  npc: '#4a6b6b',
  creature: '#6b4a4a',
  object: '#5a5a5a',
};

export function TokenPalette({
  tokens,
  onTokensChange,
  onViewUpdate,
}: TokenPaletteProps) {
  const [templates, setTemplates] = useState<TokenTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TokenTemplate | null>(null);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<TokenType>('npc');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = antdMessage.useMessage();

  // Pre-loaded image cache for synchronous drag preview generation
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Pre-load an image into cache
  const preloadImage = useCallback((url: string) => {
    if (!url || imageCache.current.has(url)) return;
    const img = new Image();
    img.src = url;
    imageCache.current.set(url, img);
  }, []);

  // Load templates from campaign data on mount
  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const images = await encounterApi.getTokenImages();

        // Convert images to templates
        const templateList: TokenTemplate[] = images.map(img => ({
          type: img.type,
          name: img.name,
          imageUrl: img.url,
        }));

        setTemplates(templateList);

        // Pre-load all template images for synchronous drag preview
        templateList.forEach(t => { if (t.imageUrl) preloadImage(t.imageUrl); });
      } catch (err) {
        console.error('Error loading token templates:', err);
        messageApi.error('Failed to load token templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [messageApi, preloadImage]);

  // Handle template selection
  const handleTemplateClick = useCallback((template: TokenTemplate) => {
    setSelectedTemplate(template);
  }, []);

  // Handle custom token creation
  const handleCreateCustom = useCallback(() => {
    if (!customName.trim()) {
      messageApi.warning('Enter a name for the custom token');
      return;
    }

    const customTemplate: TokenTemplate = {
      type: customType,
      name: customName.trim(),
      imageUrl: customImageUrl,
    };

    // Add custom token to the templates grid so it can be dragged and reused
    setTemplates(prev => [...prev, customTemplate]);

    // Pre-load image for drag preview if provided
    if (customImageUrl) preloadImage(customImageUrl);

    // Auto-select the new template
    setSelectedTemplate(customTemplate);

    // Clear form fields so it's ready for another custom token
    setCustomName('');
    setCustomImageUrl('');

    messageApi.success(`Custom token "${customTemplate.name}" ready to place`);
  }, [customName, customType, customImageUrl, messageApi, preloadImage]);

  // Handle image selection from gallery
  const handleImageSelect = useCallback((image: TokenImage) => {
    setCustomImageUrl(image.url);
    setCustomName(image.name); // Pre-fill name with image name
    setCustomType(image.type); // Pre-fill type with image type
  }, []);

  // Handle drag start for templates - creates a 40x40 circular canvas drag preview
  const handleDragStart = useCallback((e: React.DragEvent, template: TokenTemplate) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(template));

    // Create a 40x40 canvas for the drag preview (matches rendered token size)
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cachedImg = template.imageUrl ? imageCache.current.get(template.imageUrl) : null;

    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      // Draw circular clipped image
      ctx.beginPath();
      ctx.arc(20, 20, 20, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(cachedImg, 0, 0, 40, 40);
    } else {
      // Fall back to a solid colored circle matching token type
      const color = TYPE_COLORS[template.type] || '#5a5a5a';
      ctx.beginPath();
      ctx.arc(20, 20, 20, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // Draw initial letter in center
      ctx.fillStyle = '#d0d0d0';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.name.charAt(0).toUpperCase(), 20, 20);
    }

    // Append off-screen, set as drag image with center hotspot, then remove
    canvas.style.position = 'fixed';
    canvas.style.top = '-100px';
    document.body.appendChild(canvas);
    e.dataTransfer.setDragImage(canvas, 20, 20);
    requestAnimationFrame(() => document.body.removeChild(canvas));
  }, [imageCache]);

  // Handle Clear All Tokens
  const handleClearAll = useCallback(() => {
    Modal.confirm({
      title: 'Clear All Tokens',
      content: 'Remove all tokens from the encounter map? This action cannot be undone.',
      okText: 'Clear All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const result = await encounterApi.clearAllTokens();
          onTokensChange(result.tokens);
          onViewUpdate();
          messageApi.success('All tokens cleared');
          setSelectedTemplate(null); // Deselect template after clearing
        } catch (err) {
          console.error('Error clearing tokens:', err);
          messageApi.error('Failed to clear tokens');
        }
      },
    });
  }, [onTokensChange, onViewUpdate, messageApi]);

  const tokenCount = Object.keys(tokens).length;

  return (
    <>
      {contextHolder}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Pre-configured Templates */}
        <div>
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
            TEMPLATES {templates.length > 0 && `(${templates.length})`}
          </Text>

          {loading ? (
            <Text type="secondary" style={{ fontSize: 11 }}>Loading templates...</Text>
          ) : templates.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 11 }}>No templates available</Text>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                gap: 6,
                maxHeight: 180,
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {templates.map((template, idx) => {
                const isSelected = selectedTemplate?.name === template.name && selectedTemplate?.type === template.type;
                return (
                  <div
                    key={`${template.type}-${template.name}-${idx}`}
                    draggable
                    onClick={() => handleTemplateClick(template)}
                    onDragStart={(e) => handleDragStart(e, template)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'grab',
                      padding: 6,
                      background: isSelected ? '#1a2020' : '#0f1515',
                      border: `1px solid ${isSelected ? '#8b7355' : '#303030'}`,
                      borderRadius: 4,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#4a6b6b';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#303030';
                      }
                    }}
                  >
                    {/* Circular thumbnail */}
                    {template.imageUrl ? (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: `1px solid ${TYPE_COLORS[template.type]}`,
                          marginBottom: 4,
                        }}
                      >
                        <img
                          src={template.imageUrl}
                          alt={template.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: TYPE_COLORS[template.type],
                          border: `1px solid ${TYPE_COLORS[template.type]}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ color: '#d0d0d0', fontSize: 14, fontWeight: 'bold' }}>
                          {template.name.charAt(0).toUpperCase()}
                        </Text>
                      </div>
                    )}

                    {/* Name and type badge */}
                    <Text
                      style={{
                        fontSize: 9,
                        color: '#8a8a8a',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        lineHeight: 1.2,
                      }}
                    >
                      {template.name.length > 12 ? template.name.substring(0, 10) + '...' : template.name}
                    </Text>
                    <div
                      style={{
                        fontSize: 8,
                        color: TYPE_COLORS[template.type],
                        marginTop: 2,
                      }}
                    >
                      {TYPE_ICONS[template.type]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Token Creator */}
        <div
          style={{
            padding: 8,
            background: '#0f1515',
            border: '1px solid #303030',
            borderRadius: 4,
          }}
        >
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
            CUSTOM TOKEN
          </Text>

          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {/* Name input */}
            <Input
              placeholder="Token name"
              size="small"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{ fontSize: 11 }}
            />

            {/* Type selector */}
            <Space wrap style={{ width: '100%' }}>
              {(['player', 'npc', 'creature', 'object'] as TokenType[]).map(type => (
                <Button
                  key={type}
                  size="small"
                  type={customType === type ? 'primary' : 'default'}
                  icon={TYPE_ICONS[type]}
                  onClick={() => setCustomType(type)}
                  style={{
                    fontSize: 10,
                    ...(customType === type ? {
                      background: TYPE_COLORS[type],
                      borderColor: TYPE_COLORS[type],
                    } : {}),
                  }}
                >
                  {type.toUpperCase()}
                </Button>
              ))}
            </Space>

            {/* Image selector */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setGalleryVisible(true)}
                style={{ fontSize: 10 }}
              >
                Select Image
              </Button>

              {customImageUrl && (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '1px solid #4a6b6b',
                  }}
                >
                  <img
                    src={customImageUrl}
                    alt="Selected"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Create button */}
            <Button
              size="small"
              type="primary"
              block
              onClick={handleCreateCustom}
              disabled={!customName.trim()}
              style={{
                fontSize: 10,
                background: '#8b7355',
                borderColor: '#8b7355',
              }}
            >
              CREATE
            </Button>
          </Space>
        </div>

        {/* Selected template indicator */}
        {selectedTemplate && (
          <div
            style={{
              padding: 6,
              background: '#1a2020',
              border: '1px solid #8b7355',
              borderRadius: 4,
              fontSize: 10,
            }}
          >
            <Text style={{ color: '#8b7355', fontSize: 10 }}>
              SELECTED: {selectedTemplate.name} ({selectedTemplate.type})
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 9 }}>
              Drag to map or click map cell to place
            </Text>
          </div>
        )}

        {/* Clear All Tokens */}
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={handleClearAll}
          disabled={tokenCount === 0}
          block
          style={{ fontSize: 10 }}
        >
          CLEAR ALL TOKENS ({tokenCount})
        </Button>
      </div>

      {/* Token Image Gallery Modal */}
      <TokenImageGallery
        visible={galleryVisible}
        onSelect={handleImageSelect}
        onClose={() => setGalleryVisible(false)}
      />
    </>
  );
}
