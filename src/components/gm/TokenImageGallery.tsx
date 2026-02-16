/**
 * TokenImageGallery - Modal for selecting token images from campaign data
 *
 * Displays available token images grouped by source (CREW, NPCs, OTHER IMAGES).
 * Fetches images from encounterApi.getTokenImages() and allows GM to select an image.
 */

import { useState, useEffect } from 'react';
import { Modal, Typography, Spin } from 'antd';
import { encounterApi } from '@/services/encounterApi';
import type { TokenImage } from '@/types/encounterMap';

const { Text } = Typography;

interface TokenImageGalleryProps {
  visible: boolean;
  onSelect: (image: TokenImage) => void;
  onClose: () => void;
}

export function TokenImageGallery({ visible, onSelect, onClose }: TokenImageGalleryProps) {
  const [images, setImages] = useState<TokenImage[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch images when modal opens
  useEffect(() => {
    if (!visible) return;

    const fetchImages = async () => {
      setLoading(true);
      try {
        const imageList = await encounterApi.getTokenImages();
        setImages(imageList);
      } catch (err) {
        console.error('Error fetching token images:', err);
        setImages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [visible]);

  // Group images by source
  const crewImages = images.filter(img => img.source === 'crew');
  const npcImages = images.filter(img => img.source === 'npc');
  const otherImages = images.filter(img => img.source === 'images');

  const handleImageClick = (image: TokenImage) => {
    onSelect(image);
    onClose();
  };

  return (
    <Modal
      open={visible}
      title={<Text style={{ color: '#5a7a7a' }}>SELECT TOKEN IMAGE</Text>}
      onCancel={onClose}
      footer={null}
      width={600}
      styles={{
        body: { background: '#0a0a0a', padding: 16 },
        header: { background: '#1a1a1a', borderBottom: '1px solid #303030' },
      }}
      style={{ background: '#1a1a1a' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Loading images...
          </Text>
        </div>
      ) : (
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {/* CREW section */}
          {crewImages.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Text
                style={{
                  display: 'block',
                  color: '#4a6b6b',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                CREW
              </Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: 12,
                }}
              >
                {crewImages.map(img => (
                  <div
                    key={img.id}
                    onClick={() => handleImageClick(img)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: 8,
                      background: '#0f1515',
                      border: '1px solid #303030',
                      borderRadius: 4,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#4a6b6b';
                      e.currentTarget.style.background = '#1a2020';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#303030';
                      e.currentTarget.style.background = '#0f1515';
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid #4a6b6b',
                        marginBottom: 4,
                      }}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#8a8a8a',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                      }}
                    >
                      {img.name}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NPCs section */}
          {npcImages.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Text
                style={{
                  display: 'block',
                  color: '#4a6b6b',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                NPCs
              </Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: 12,
                }}
              >
                {npcImages.map(img => (
                  <div
                    key={img.id}
                    onClick={() => handleImageClick(img)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: 8,
                      background: '#0f1515',
                      border: '1px solid #303030',
                      borderRadius: 4,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#4a6b6b';
                      e.currentTarget.style.background = '#1a2020';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#303030';
                      e.currentTarget.style.background = '#0f1515';
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid #4a6b6b',
                        marginBottom: 4,
                      }}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#8a8a8a',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                      }}
                    >
                      {img.name}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OTHER IMAGES section */}
          {otherImages.length > 0 && (
            <div>
              <Text
                style={{
                  display: 'block',
                  color: '#4a6b6b',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                OTHER IMAGES
              </Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: 12,
                }}
              >
                {otherImages.map(img => (
                  <div
                    key={img.id}
                    onClick={() => handleImageClick(img)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: 8,
                      background: '#0f1515',
                      border: '1px solid #303030',
                      borderRadius: 4,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#4a6b6b';
                      e.currentTarget.style.background = '#1a2020';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#303030';
                      e.currentTarget.style.background = '#0f1515';
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid #4a6b6b',
                        marginBottom: 4,
                      }}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#8a8a8a',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                      }}
                    >
                      {img.name}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {images.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">No token images available</Text>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
