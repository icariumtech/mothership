/**
 * Procedural Texture Generation Utilities for R3F
 *
 * These functions create canvas-based textures for 3D elements.
 * Ported from the legacy Three.js scene classes.
 */

import * as THREE from 'three';

/**
 * Draw a spike/ray emanating from a point
 * Used for star cross patterns
 */
function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);

  const gradient = ctx.createLinearGradient(0, 0, 0, length);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-width, length);
  ctx.lineTo(width, length);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Create a procedural star texture with 4-point cross pattern
 * Used for star system sprites in galaxy view
 */
export function createStarTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const centerX = size / 2;
  const centerY = size / 2;
  const coreRadius = size * 0.2; // 25 for 128px
  const spikeLength = size * 0.4; // 50 for 128px
  const spikeWidth = size * 0.024; // 3 for 128px

  // Draw bright center core with glow
  const coreGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, coreRadius
  );
  coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  coreGradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
  coreGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
  coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = coreGradient;
  ctx.fillRect(0, 0, size, size);

  // Draw 4-point cross (additive blending)
  ctx.globalCompositeOperation = 'lighter';
  drawSpike(ctx, centerX, centerY, 0, spikeLength, spikeWidth);
  drawSpike(ctx, centerX, centerY, 90, spikeLength, spikeWidth);
  drawSpike(ctx, centerX, centerY, 180, spikeLength, spikeWidth);
  drawSpike(ctx, centerX, centerY, 270, spikeLength, spikeWidth);

  // Apply subtle blur
  ctx.filter = 'blur(2px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a procedural selection reticle texture (legacy - combined)
 * Used for highlighting selected systems/planets/elements
 */
export function createReticleTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const centerX = size / 2;
  const centerY = size / 2;
  const amberColor = 'rgba(139, 115, 85, 1.0)'; // Theme amber color

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // Draw outer circle
  ctx.strokeStyle = amberColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.3125, 0, Math.PI * 2); // 80 for 256px
  ctx.stroke();

  // Draw inner circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.234, 0, Math.PI * 2); // 60 for 256px
  ctx.stroke();

  // Draw corner brackets
  const bracketSize = size * 0.07; // 18 for 256px
  const bracketDistance = size * 0.37; // 95 for 256px
  ctx.lineWidth = 3;

  // Top-left bracket
  ctx.beginPath();
  ctx.moveTo(centerX - bracketDistance, centerY - bracketDistance + bracketSize);
  ctx.lineTo(centerX - bracketDistance, centerY - bracketDistance);
  ctx.lineTo(centerX - bracketDistance + bracketSize, centerY - bracketDistance);
  ctx.stroke();

  // Top-right bracket
  ctx.beginPath();
  ctx.moveTo(centerX + bracketDistance - bracketSize, centerY - bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY - bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY - bracketDistance + bracketSize);
  ctx.stroke();

  // Bottom-left bracket
  ctx.beginPath();
  ctx.moveTo(centerX - bracketDistance, centerY + bracketDistance - bracketSize);
  ctx.lineTo(centerX - bracketDistance, centerY + bracketDistance);
  ctx.lineTo(centerX - bracketDistance + bracketSize, centerY + bracketDistance);
  ctx.stroke();

  // Bottom-right bracket
  ctx.beginPath();
  ctx.moveTo(centerX + bracketDistance - bracketSize, centerY + bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY + bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY + bracketDistance - bracketSize);
  ctx.stroke();

  // Cut out cross pattern for visual interest
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  const crossWidth = size * 0.04; // 10 for 256px
  const crossLength = size * 0.35; // 90 for 256px
  ctx.fillRect(centerX - crossLength, centerY - crossWidth / 2, crossLength * 2, crossWidth);
  ctx.fillRect(centerX - crossWidth / 2, centerY - crossLength, crossWidth, crossLength * 2);
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create reticle corner brackets texture (diamond orientation)
 * Just the four corner brackets without rings
 */
export function createReticleCornersTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const centerX = size / 2;
  const centerY = size / 2;
  const amberColor = 'rgba(139, 115, 85, 1.0)';

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // Draw corner brackets
  const bracketSize = size * 0.07; // 18 for 256px
  const bracketDistance = size * 0.37; // 95 for 256px
  ctx.strokeStyle = amberColor;
  ctx.lineWidth = 3;

  // Top-left bracket
  ctx.beginPath();
  ctx.moveTo(centerX - bracketDistance, centerY - bracketDistance + bracketSize);
  ctx.lineTo(centerX - bracketDistance, centerY - bracketDistance);
  ctx.lineTo(centerX - bracketDistance + bracketSize, centerY - bracketDistance);
  ctx.stroke();

  // Top-right bracket
  ctx.beginPath();
  ctx.moveTo(centerX + bracketDistance - bracketSize, centerY - bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY - bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY - bracketDistance + bracketSize);
  ctx.stroke();

  // Bottom-left bracket
  ctx.beginPath();
  ctx.moveTo(centerX - bracketDistance, centerY + bracketDistance - bracketSize);
  ctx.lineTo(centerX - bracketDistance, centerY + bracketDistance);
  ctx.lineTo(centerX - bracketDistance + bracketSize, centerY + bracketDistance);
  ctx.stroke();

  // Bottom-right bracket
  ctx.beginPath();
  ctx.moveTo(centerX + bracketDistance - bracketSize, centerY + bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY + bracketDistance);
  ctx.lineTo(centerX + bracketDistance, centerY + bracketDistance - bracketSize);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create reticle outer ring texture
 * Just the outer circle with cross cutout
 */
export function createReticleOuterRingTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const centerX = size / 2;
  const centerY = size / 2;
  const amberColor = 'rgba(139, 115, 85, 1.0)';

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // Draw outer circle
  ctx.strokeStyle = amberColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.3125, 0, Math.PI * 2); // 80 for 256px
  ctx.stroke();

  // Cut out cross pattern for visual interest
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  const crossWidth = size * 0.04; // 10 for 256px
  const crossLength = size * 0.35; // 90 for 256px
  ctx.fillRect(centerX - crossLength, centerY - crossWidth / 2, crossLength * 2, crossWidth);
  ctx.fillRect(centerX - crossWidth / 2, centerY - crossLength, crossWidth, crossLength * 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create reticle inner ring texture
 * Just the inner circle with cross cutout
 */
export function createReticleInnerRingTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const centerX = size / 2;
  const centerY = size / 2;
  const amberColor = 'rgba(139, 115, 85, 1.0)';

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // Draw inner circle
  ctx.strokeStyle = amberColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.234, 0, Math.PI * 2); // 60 for 256px
  ctx.stroke();

  // Cut out cross pattern for visual interest
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  const crossWidth = size * 0.04; // 10 for 256px
  const crossLength = size * 0.35; // 90 for 256px
  ctx.fillRect(centerX - crossLength, centerY - crossWidth / 2, crossLength * 2, crossWidth);
  ctx.fillRect(centerX - crossWidth / 2, centerY - crossLength, crossWidth, crossLength * 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a procedural nebula particle texture
 * Soft radial gradient for volumetric appearance
 */
export function createNebulaTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a simple glow/halo texture
 * Used for corona effects and highlights
 */
export function createGlowTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Convert spherical coordinates to Cartesian
 * Used for placing surface markers on planet spheres
 *
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param longitude - Longitude in degrees (-180 to 180)
 * @param radius - Sphere radius
 * @returns THREE.Vector3 position on the sphere surface
 */
export function sphericalToCartesian(
  latitude: number,
  longitude: number,
  radius: number
): THREE.Vector3 {
  // Convert degrees to radians
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;

  // Spherical to Cartesian conversion
  // Note: Three.js uses Y-up coordinate system
  const x = radius * Math.cos(latRad) * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.cos(lonRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Create a planet circle texture with solid black fill and teal outline
 * Used for planet sprites in system view
 */
export function createPlanetTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const radius = size * 0.44; // 28/64 = 0.4375 ≈ 0.44
  const borderWidth = size * 0.0625; // 4/64

  // Draw solid black circle background
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw teal circle outline
  ctx.strokeStyle = '#5a7a7a';
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Calculate orbital position at a given time
 * Used for animating planets, moons, and stations
 *
 * @param orbitalRadius - Distance from center
 * @param orbitalPeriod - Time for one complete orbit (in arbitrary units)
 * @param initialAngle - Starting angle in degrees
 * @param inclination - Orbital plane inclination in degrees
 * @param time - Current time value
 * @returns THREE.Vector3 position in orbit
 */
export function calculateOrbitalPosition(
  orbitalRadius: number,
  orbitalPeriod: number,
  initialAngle: number,
  inclination: number,
  time: number
): THREE.Vector3 {
  // Calculate current angle
  const angularVelocity = (2 * Math.PI) / orbitalPeriod;
  const initialAngleRad = (initialAngle * Math.PI) / 180;
  const currentAngle = initialAngleRad + angularVelocity * time;

  // Calculate position in orbital plane
  const x = orbitalRadius * Math.cos(currentAngle);
  const z = orbitalRadius * Math.sin(currentAngle);

  // Apply inclination
  const inclinationRad = (inclination * Math.PI) / 180;
  const y = z * Math.sin(inclinationRad);
  const adjustedZ = z * Math.cos(inclinationRad);

  return new THREE.Vector3(x, y, adjustedZ);
}
