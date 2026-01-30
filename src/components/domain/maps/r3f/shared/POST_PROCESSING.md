# Post-Processing Effects Guide

## Overview

The Mothership GM Tool now includes a foundation for post-processing effects using `@react-three/postprocessing`. These effects can add visual polish like bloom, chromatic aberration, and other cinematic effects to the 3D map views.

**Current Status**: Post-processing is **disabled by default** for optimal performance. It can be easily enabled when needed for specific visual effects.

## Quick Start

### Enable Bloom Effect

To enable the bloom effect in any map component:

```tsx
// In GalaxyMap.tsx, SystemMap.tsx, or OrbitMap.tsx
<PostProcessing
  enabled={true}
  bloom={{
    intensity: 0.5,
    luminanceThreshold: 0.9
  }}
/>
```

### Disable All Effects (Default)

```tsx
<PostProcessing enabled={false} />
// or simply
<PostProcessing />
```

## Bloom Configuration

The bloom effect adds a glow to bright objects in the scene (stars, glowing planets, etc.).

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `intensity` | `number` | `0.5` | Bloom intensity (0-1). Higher = more glow. |
| `luminanceThreshold` | `number` | `0.9` | Luminance threshold (0-1). Only pixels brighter than this glow. |
| `luminanceSmoothing` | `number` | `0.025` | Smoothing for luminance threshold transition. |
| `blendFunction` | `BlendFunction` | `BlendFunction.ADD` | How bloom blends with scene. |

### Example Configurations

**Subtle sci-fi glow** (recommended for Mothership aesthetic):
```tsx
<PostProcessing
  enabled={true}
  bloom={{
    intensity: 0.3,
    luminanceThreshold: 0.95,
    luminanceSmoothing: 0.05
  }}
/>
```

**Strong holographic effect**:
```tsx
<PostProcessing
  enabled={true}
  bloom={{
    intensity: 0.8,
    luminanceThreshold: 0.7,
    luminanceSmoothing: 0.1
  }}
/>
```

**Star glow only** (very selective):
```tsx
<PostProcessing
  enabled={true}
  bloom={{
    intensity: 0.5,
    luminanceThreshold: 0.98,
    luminanceSmoothing: 0.01
  }}
/>
```

## Performance Considerations

### Performance Impact

Post-processing adds ~1-3ms per frame on modern GPUs. This is minimal but noticeable on lower-end hardware.

**Recommendations**:
- Keep effects **disabled** during development unless testing visual features
- Enable selectively for specific scenes (e.g., only galaxy view)
- Test on target hardware (tablets, lower-end laptops) before enabling in production
- Use `luminanceThreshold >= 0.9` to minimize pixel processing

### Memory Usage

Post-processing requires additional framebuffers:
- Bloom: +1 render target (~8MB for 1920x1080)
- Each additional effect adds more render targets

The impact is minimal for modern devices but consider disabling on mobile/tablet if performance degrades.

## Future Enhancements

The post-processing foundation supports adding more effects:

### Planned Effects

**Chromatic Aberration** - Color fringing for holographic aesthetic:
```tsx
// Future API (not yet implemented)
<PostProcessing
  enabled={true}
  chromaticAberration={{ offset: [0.002, 0.002] }}
/>
```

**Vignette** - Dark edges for cinematic framing:
```tsx
// Future API (not yet implemented)
<PostProcessing
  enabled={true}
  vignette={{ darkness: 0.3, offset: 0.2 }}
/>
```

**Scanlines** - Retro CRT effect:
```tsx
// Future API (not yet implemented)
<PostProcessing
  enabled={true}
  scanlines={{ density: 1.0, opacity: 0.05 }}
/>
```

### Visual Presets

Future versions may include presets for common visual styles:

```tsx
// Future API (not yet implemented)
<PostProcessing preset="holographic" />
<PostProcessing preset="retro-crt" />
<PostProcessing preset="cinematic" />
```

## Debugging

### Enable Effects for Testing

To test effects without modifying component props, you can temporarily enable them:

```tsx
// Quick test - enable bloom globally
const ENABLE_BLOOM_DEBUG = true;

<PostProcessing
  enabled={ENABLE_BLOOM_DEBUG}
  bloom={{ intensity: 0.5, luminanceThreshold: 0.9 }}
/>
```

### Performance Monitoring

Check frame rate impact using browser DevTools:

1. Open Chrome DevTools → Performance
2. Enable "Show frame rendering stats"
3. Compare FPS with effects on vs. off
4. Target: 60fps (16.6ms per frame)

### Visual Debugging

To see which pixels are affected by bloom:

1. Lower `luminanceThreshold` to 0.5
2. Increase `intensity` to 1.0
3. All bright objects will glow noticeably
4. Adjust threshold upward until only desired elements glow

## Implementation Details

### Architecture

The `PostProcessing` component wraps `@react-three/postprocessing`'s `EffectComposer`:

```tsx
<EffectComposer>
  <Bloom {...bloomConfig} />
  {/* Future effects go here */}
</EffectComposer>
```

When `enabled={false}`, the component renders `null` (zero performance impact).

### Integration Points

Post-processing is added to:
- ✅ `GalaxyMap.tsx` (disabled by default)
- ⬜ `SystemMap.tsx` (TODO: add for consistency)
- ⬜ `OrbitMap.tsx` (TODO: add for consistency)

### Dependencies

- `@react-three/postprocessing` - R3F wrapper for postprocessing
- `postprocessing` - Core postprocessing library by Vanruesc

## Best Practices

1. **Start Disabled**: Always start with `enabled={false}` for performance
2. **Test on Target Hardware**: Mobile/tablet performance varies significantly
3. **Use Selective Thresholds**: High `luminanceThreshold` (0.9+) for performance
4. **Document Changes**: Note why effects are enabled in comments
5. **Consider Accessibility**: Some players may find bloom distracting or hard to read

## Support

For issues or questions:
- Check `@react-three/postprocessing` docs: https://docs.pmnd.rs/react-postprocessing
- Review Three.js postprocessing examples
- File issue in Mothership GM Tool repository

---

**Last Updated**: 2026-01-29
**Status**: Foundation complete, bloom ready for use
**Next Steps**: Add more effects, create visual presets, enable selectively in production
