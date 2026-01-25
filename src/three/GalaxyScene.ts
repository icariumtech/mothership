/**
 * GalaxyScene - Three.js galaxy map visualization
 *
 * Extracted from shared_console.html lines 1703-2642
 * Handles: stars, nebulae, travel routes, camera controls, auto-rotation
 */

import * as THREE from 'three';
import type { StarMapData, Nebula } from '../types/starMap';

export class GalaxyScene {
  // Core Three.js objects
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Scene objects
  private stars: THREE.Sprite[] = [];
  private backgroundStars: THREE.Sprite[] = [];
  private nebulaParticles: THREE.Sprite[] = [];
  private selectionReticle: THREE.Sprite;

  // Textures
  private starTexture: THREE.CanvasTexture;
  private reticleTexture: THREE.CanvasTexture;
  private nebulaTexture: THREE.CanvasTexture;

  // State
  private starPositions: Map<string, THREE.Vector3> = new Map();
  private lookAtTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private animating = false;
  private animationFrameId: number | null = null;
  private renderAnimationId: number | null = null;
  private frameCount = 0;
  private paused = false;

  // Auto-rotation state
  private autoRotate = false;
  private autoRotateSpeed = 0.002;
  private lastUserInteractionTime: number | null = null;
  private autoRotateResumeDelay = 5000;

  // Controls state
  private isDragging = false;
  private isTouching = false;
  private previousPosition = { x: 0, y: 0 };
  private lastTouchDistance = 0;
  private rotateSpeed = 0.003;
  private zoomSpeed = 4;
  private minDistance = 20;
  private maxDistance = 300;

  // Callbacks
  public onSystemClick?: (systemName: string) => void;
  public onSystemHover?: (systemName: string | null) => void;

  // Bound event handlers (for cleanup)
  private boundHandlers: { [key: string]: EventListener } = {};

  constructor(container: HTMLElement, data?: StarMapData) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x222244, 0.3);
    this.scene.add(ambientLight);

    // Create textures
    this.starTexture = this.createStarTexture();
    this.reticleTexture = this.createReticleTexture();
    this.nebulaTexture = this.createNebulaTexture();

    // Create selection reticle
    this.selectionReticle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.reticleTexture,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    }));
    this.selectionReticle.scale.set(20, 20, 1);
    this.selectionReticle.visible = false;
    this.scene.add(this.selectionReticle);

    // Create background starfield
    this.createBackgroundStars();

    // Load data if provided
    if (data) {
      this.loadData(data);
    }

    // Set up controls
    this.setupControls(container);

    // Start animation loop
    this.animate();

    // Enable auto-rotation by default after a short delay
    setTimeout(() => {
      this.autoRotate = true;
    }, 500);
  }

  /**
   * Load star map data and create scene objects
   */
  public loadData(data: StarMapData): void {
    // Clear existing objects
    this.clearSceneObjects();

    // Create stars
    if (data.systems) {
      data.systems.forEach(system => {
        const position = new THREE.Vector3(
          system.position[0],
          system.position[1],
          system.position[2]
        );

        const star = this.createStar(system.size || 1, position);
        star.userData = {
          name: system.name,
          type: system.type,
          system: system
        };

        this.scene.add(star);
        this.stars.push(star);
        this.starPositions.set(system.name, position);

        // Add point light
        const starLight = new THREE.PointLight(0xFFFFFF, 0.3, 40);
        starLight.position.copy(position);
        this.scene.add(starLight);
      });
    }

    // Create travel routes
    if (data.routes) {
      const systemPositions: { [name: string]: [number, number, number] } = {};
      data.systems.forEach(sys => {
        systemPositions[sys.name] = sys.position;
      });

      data.routes.forEach(route => {
        const fromPos = systemPositions[route.from];
        const toPos = systemPositions[route.to];

        if (fromPos && toPos) {
          this.createTravelRoute(fromPos, toPos, route.color);
        }
      });
    }

    // Create nebulae
    if (data.nebulae) {
      data.nebulae.forEach(nebula => {
        this.createNebula(nebula);
      });
    }
  }

  /**
   * Select a system (show reticle, animate camera)
   */
  public selectSystem(systemName: string | null): void {
    if (!systemName) {
      this.selectionReticle.visible = false;
      // Animate camera back to origin when deselecting
      this.animateCameraToOrigin();
      return;
    }

    const position = this.starPositions.get(systemName);
    if (position) {
      this.selectionReticle.position.copy(position);
      this.selectionReticle.visible = true;
      this.animateCameraToTarget(position);
    }
  }

  /**
   * Select a system and wait for the selection animation to complete
   * Returns a promise that resolves when the animation finishes
   */
  public selectSystemAndWait(systemName: string, duration = 2000): Promise<void> {
    return new Promise((resolve) => {
      const position = this.starPositions.get(systemName);
      if (!position) {
        resolve();
        return;
      }

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.animating = true;
      this.autoRotate = false;

      // Show reticle
      this.selectionReticle.position.copy(position);
      this.selectionReticle.visible = true;

      const startPosition = this.camera.position.clone();
      const startLookAt = this.lookAtTarget.clone();
      const startTime = Date.now();

      // Calculate end position (same as animateCameraToTarget)
      const distance = 80;
      const angle = Math.atan2(startPosition.x - startLookAt.x, startPosition.z - startLookAt.z);
      const endPosition = new THREE.Vector3(
        position.x + Math.sin(angle) * distance,
        position.y + 30,
        position.z + Math.cos(angle) * distance
      );

      const updateCamera = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.lookAtTarget.lerpVectors(startLookAt, position, eased);
        this.camera.lookAt(this.lookAtTarget);

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(updateCamera);
        } else {
          this.animating = false;
          this.animationFrameId = null;
          resolve();
        }
      };

      updateCamera();
    });
  }

  /**
   * Set auto-rotation state
   */
  public setAutoRotate(enabled: boolean): void {
    this.autoRotate = enabled;
  }

  /**
   * Pause/resume rendering updates
   */
  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /**
   * Position camera on a system immediately without animation
   * Used when returning from system view to have camera already in position
   */
  public positionCameraOnSystem(systemName: string): void {
    const position = this.starPositions.get(systemName);
    if (!position) return;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.animating = false;
    this.autoRotate = false;

    // Show reticle
    this.selectionReticle.position.copy(position);
    this.selectionReticle.visible = true;

    // Calculate camera position (same as animateCameraToTarget end position)
    const currentAngle = Math.atan2(
      this.camera.position.x - this.lookAtTarget.x,
      this.camera.position.z - this.lookAtTarget.z
    );
    const distance = 80;
    const cameraPosition = new THREE.Vector3(
      position.x + Math.sin(currentAngle) * distance,
      position.y + 30,
      position.z + Math.cos(currentAngle) * distance
    );

    // Set camera position and lookAt immediately
    this.camera.position.copy(cameraPosition);
    this.lookAtTarget.copy(position);
    this.camera.lookAt(this.lookAtTarget);
  }

  /**
   * Animate camera diving into a system (for transition to system view)
   * Returns a promise that resolves when the dive animation completes
   */
  public diveToSystem(systemName: string, duration = 800): Promise<void> {
    return new Promise((resolve) => {
      const position = this.starPositions.get(systemName);
      if (!position) {
        resolve();
        return;
      }

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.animating = true;
      this.autoRotate = false;

      const startPosition = this.camera.position.clone();
      const startTime = Date.now();

      // Dive very close to the star
      const endPosition = position.clone().add(new THREE.Vector3(0, 2, 5));

      const updateCamera = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in for accelerating dive effect
        const eased = progress * progress * progress;

        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.camera.lookAt(position);

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(updateCamera);
        } else {
          this.animating = false;
          this.animationFrameId = null;
          resolve();
        }
      };

      updateCamera();
    });
  }

  /**
   * Get star positions map
   */
  public getStarPositions(): Map<string, THREE.Vector3> {
    return this.starPositions;
  }

  /**
   * Resize renderer to match container dimensions
   * Called when container visibility changes (e.g., after display: none is removed)
   */
  public resize(): void {
    const parent = this.renderer.domElement.parentElement;
    if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
      this.camera.aspect = parent.clientWidth / parent.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(parent.clientWidth, parent.clientHeight);
    }
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Stop animation
    if (this.renderAnimationId) {
      cancelAnimationFrame(this.renderAnimationId);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Remove event listeners
    this.removeControls();

    // Dispose textures
    this.starTexture.dispose();
    this.reticleTexture.dispose();
    this.nebulaTexture.dispose();

    // Dispose scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        object.geometry?.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        } else if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        }
      }
    });

    // Dispose renderer
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ========================================
  // Private Methods - Texture Creation
  // ========================================

  private createStarTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const centerX = 64;
    const centerY = 64;

    // Draw bright center core with glow
    const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 25);
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    coreGradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    coreGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = coreGradient;
    ctx.fillRect(0, 0, 128, 128);

    // Draw 4-point cross
    ctx.globalCompositeOperation = 'lighter';
    this.drawSpike(ctx, centerX, centerY, 0, 50, 3);
    this.drawSpike(ctx, centerX, centerY, 90, 50, 3);
    this.drawSpike(ctx, centerX, centerY, 180, 50, 3);
    this.drawSpike(ctx, centerX, centerY, 270, 50, 3);

    // Apply blur
    ctx.filter = 'blur(2px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';

    return new THREE.CanvasTexture(canvas);
  }

  private drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number): void {
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

  private createReticleTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const centerX = size / 2;
    const centerY = size / 2;
    const amberColor = 'rgba(139, 115, 85, 1.0)';

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    // Draw circles
    ctx.strokeStyle = amberColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Draw corner brackets
    const bracketSize = 18;
    const bracketDistance = 95;
    ctx.lineWidth = 3;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(centerX - bracketDistance, centerY - bracketDistance + bracketSize);
    ctx.lineTo(centerX - bracketDistance, centerY - bracketDistance);
    ctx.lineTo(centerX - bracketDistance + bracketSize, centerY - bracketDistance);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(centerX + bracketDistance - bracketSize, centerY - bracketDistance);
    ctx.lineTo(centerX + bracketDistance, centerY - bracketDistance);
    ctx.lineTo(centerX + bracketDistance, centerY - bracketDistance + bracketSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(centerX - bracketDistance, centerY + bracketDistance - bracketSize);
    ctx.lineTo(centerX - bracketDistance, centerY + bracketDistance);
    ctx.lineTo(centerX - bracketDistance + bracketSize, centerY + bracketDistance);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(centerX + bracketDistance - bracketSize, centerY + bracketDistance);
    ctx.lineTo(centerX + bracketDistance, centerY + bracketDistance);
    ctx.lineTo(centerX + bracketDistance, centerY + bracketDistance - bracketSize);
    ctx.stroke();

    // Cut out cross
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(centerX - 90, centerY - 5, 180, 10);
    ctx.fillRect(centerX - 5, centerY - 90, 10, 180);
    ctx.globalCompositeOperation = 'source-over';

    return new THREE.CanvasTexture(canvas);
  }

  private createNebulaTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  // ========================================
  // Private Methods - Scene Object Creation
  // ========================================

  private createBackgroundStars(): void {
    const starFieldCount = 5000;

    for (let i = 0; i < starFieldCount; i++) {
      const radius = 150 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      const spriteMaterial = new THREE.SpriteMaterial({
        map: this.starTexture,
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.4 + Math.random() * 0.4,
        blending: THREE.AdditiveBlending
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      const size = 0.5 + Math.random() * 1.5;
      sprite.scale.set(size, size, 1);
      sprite.position.copy(position);
      sprite.material.rotation = Math.random() * Math.PI * 2;

      sprite.userData.baseOpacity = sprite.material.opacity;
      sprite.userData.pulseOffset = Math.random() * Math.PI * 2;

      this.scene.add(sprite);
      this.backgroundStars.push(sprite);
    }
  }

  private createStar(size: number, position: THREE.Vector3): THREE.Sprite {
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.starTexture,
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size * 6, size * 6, 1);
    sprite.position.copy(position);
    sprite.material.rotation = Math.random() * Math.PI * 2;

    sprite.userData.baseOpacity = 0.9;
    sprite.userData.pulseOffset = Math.random() * Math.PI * 2;

    return sprite;
  }

  private createTravelRoute(fromPos: [number, number, number], toPos: [number, number, number], color?: number): void {
    const start = new THREE.Vector3(fromPos[0], fromPos[1], fromPos[2]);
    const end = new THREE.Vector3(toPos[0], toPos[1], toPos[2]);

    const direction = end.clone().sub(start);
    const distance = direction.length();

    if (distance <= 16) return; // Too short after shortening

    const curve = new THREE.LineCurve3(start, end);
    const segments = 64;
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.3, 8, false);

    // Add vertex alpha for fade effect
    const positions = tubeGeometry.attributes.position;
    const alphas: number[] = [];
    const fadeDistance = 15;

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );

      const distFromStart = vertex.distanceTo(start);
      const distFromEnd = vertex.distanceTo(end);

      let alphaFromStart = distFromStart < fadeDistance ? distFromStart / fadeDistance : 1.0;
      let alphaFromEnd = distFromEnd < fadeDistance ? distFromEnd / fadeDistance : 1.0;

      alphas.push(Math.min(alphaFromStart, alphaFromEnd));
    }

    tubeGeometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color || 0x5a7a9a) }
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(color, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    const tube = new THREE.Mesh(tubeGeometry, material);
    this.scene.add(tube);
  }

  private createNebula(nebula: Nebula): void {
    const position = new THREE.Vector3(
      nebula.position[0],
      nebula.position[1],
      nebula.position[2]
    );

    const targetRadius = nebula.size * 0.85;
    const shellThickness = nebula.size * 0.25;

    for (let i = 0; i < nebula.particle_count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const radiusOffset = (Math.random() - 0.5) * shellThickness;
      const radius = targetRadius + radiusOffset;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const particlePos = new THREE.Vector3(
        position.x + x,
        position.y + y,
        position.z + z
      );

      const distanceFromFront = Math.abs(radiusOffset);
      const brightnessFactor = 1.0 - (distanceFromFront / (shellThickness / 2));
      const particleOpacity = nebula.opacity * Math.max(0.3, brightnessFactor) * (0.6 + Math.random() * 0.4);

      const spriteMaterial = new THREE.SpriteMaterial({
        map: this.nebulaTexture,
        color: nebula.color,
        transparent: true,
        opacity: particleOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      const size = (nebula.size / 5) * (0.5 + Math.random() * 0.8);
      sprite.scale.set(size, size, 1);
      sprite.position.copy(particlePos);

      sprite.userData.nebulaType = nebula.type;
      sprite.userData.baseOpacity = particleOpacity;
      sprite.userData.pulseOffset = Math.random() * Math.PI * 2;
      sprite.userData.nebulaCenter = position.clone();
      sprite.userData.rotationSpeed = 0.01 + Math.random() * 0.02;

      this.scene.add(sprite);
      this.nebulaParticles.push(sprite);
    }
  }

  private clearSceneObjects(): void {
    // Remove stars
    this.stars.forEach(star => this.scene.remove(star));
    this.stars = [];

    // Remove nebula particles
    this.nebulaParticles.forEach(particle => this.scene.remove(particle));
    this.nebulaParticles = [];

    // Clear star positions
    this.starPositions.clear();
  }

  // ========================================
  // Private Methods - Animation
  // ========================================

  private animate = (): void => {
    this.renderAnimationId = requestAnimationFrame(this.animate);

    // Skip rendering if paused
    if (this.paused) return;

    this.frameCount++;

    // Update animations every 3rd frame for performance
    if (this.frameCount % 3 === 0) {
      const time = Date.now() * 0.001;

      // Animate nebula particles
      this.nebulaParticles.forEach(particle => {
        const type = particle.userData.nebulaType;

        if (type === 'emission') {
          const pulseSpeed = 0.5;
          const pulseAmount = 0.15;
          const pulse = Math.sin(time * pulseSpeed + particle.userData.pulseOffset) * pulseAmount;
          particle.material.opacity = particle.userData.baseOpacity * (1.0 + pulse);
        } else if (type === 'planetary' && particle.userData.nebulaCenter) {
          const angle = time * particle.userData.rotationSpeed;
          const center = particle.userData.nebulaCenter;

          const offsetX = particle.position.x - center.x;
          const offsetY = particle.position.y - center.y;
          const offsetZ = particle.position.z - center.z;

          const cosAngle = Math.cos(angle * 0.1);
          const sinAngle = Math.sin(angle * 0.1);
          const rotatedX = offsetX * cosAngle - offsetZ * sinAngle;
          const rotatedZ = offsetX * sinAngle + offsetZ * cosAngle;

          particle.position.set(
            center.x + rotatedX,
            center.y + offsetY,
            center.z + rotatedZ
          );
        } else if (type === 'reflection') {
          const pulseSpeed = 0.3;
          const pulseAmount = 0.08;
          const pulse = Math.sin(time * pulseSpeed + particle.userData.pulseOffset) * pulseAmount;
          particle.material.opacity = particle.userData.baseOpacity * (1.0 + pulse);
        }
      });
    }

    // Check auto-rotation resume
    if (!this.autoRotate && this.lastUserInteractionTime) {
      const timeSinceLastInteraction = Date.now() - this.lastUserInteractionTime;
      if (timeSinceLastInteraction >= this.autoRotateResumeDelay) {
        this.autoRotate = true;
      }
    }

    // Auto-rotate camera
    if (this.autoRotate && !this.animating) {
      const offsetX = this.camera.position.x - this.lookAtTarget.x;
      const offsetY = this.camera.position.y - this.lookAtTarget.y;
      const offsetZ = this.camera.position.z - this.lookAtTarget.z;
      const radius = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);

      let theta = Math.atan2(offsetX, offsetZ);
      theta += this.autoRotateSpeed;

      const phi = Math.acos(offsetY / radius);
      const sinPhi = Math.sin(phi);

      this.camera.position.x = this.lookAtTarget.x + radius * sinPhi * Math.sin(theta);
      this.camera.position.y = this.lookAtTarget.y + radius * Math.cos(phi);
      this.camera.position.z = this.lookAtTarget.z + radius * sinPhi * Math.cos(theta);

      this.camera.lookAt(this.lookAtTarget);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private animateCameraToTarget(targetPosition: THREE.Vector3, duration = 2000): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.animating = true;

    const startPosition = this.camera.position.clone();
    const startLookAt = this.lookAtTarget.clone();
    const startTime = Date.now();

    const distance = 80;
    const angle = Math.atan2(startPosition.x - startLookAt.x, startPosition.z - startLookAt.z);
    const endPosition = new THREE.Vector3(
      targetPosition.x + Math.sin(angle) * distance,
      targetPosition.y + 30,
      targetPosition.z + Math.cos(angle) * distance
    );

    const updateCamera = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.camera.position.lerpVectors(startPosition, endPosition, eased);
      this.lookAtTarget.lerpVectors(startLookAt, targetPosition, eased);
      this.camera.lookAt(this.lookAtTarget);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(updateCamera);
      } else {
        this.animating = false;
        this.animationFrameId = null;
      }
    };

    updateCamera();
  }

  /**
   * Animate camera back to origin (0,0,0) when deselecting
   */
  private animateCameraToOrigin(duration = 1500): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.animating = true;

    const startPosition = this.camera.position.clone();
    const startLookAt = this.lookAtTarget.clone();
    const startTime = Date.now();

    // Default camera position: (0, 0, 100) looking at origin
    const endPosition = new THREE.Vector3(0, 0, 100);
    const endLookAt = new THREE.Vector3(0, 0, 0);

    const updateCamera = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease in-out quad
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.camera.position.lerpVectors(startPosition, endPosition, eased);
      this.lookAtTarget.lerpVectors(startLookAt, endLookAt, eased);
      this.camera.lookAt(this.lookAtTarget);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(updateCamera);
      } else {
        this.animating = false;
        this.animationFrameId = null;
        // Enable auto-rotation after animation completes
        this.autoRotate = true;
      }
    };

    updateCamera();
  }

  // ========================================
  // Private Methods - Controls
  // ========================================

  private setupControls(_container: HTMLElement): void {
    // Wheel zoom
    this.boundHandlers['wheel'] = ((event: WheelEvent) => {
      const target = event.target as HTMLElement;
      const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .info-panel');
      if (isPanel) return;

      event.preventDefault();
      this.autoRotate = false;
      this.lastUserInteractionTime = Date.now();

      const direction = this.lookAtTarget.clone().sub(this.camera.position).normalize();
      const currentDistance = this.camera.position.distanceTo(this.lookAtTarget);

      if (event.deltaY < 0) {
        if (currentDistance - this.zoomSpeed >= this.minDistance) {
          this.camera.position.add(direction.multiplyScalar(this.zoomSpeed));
        }
      } else {
        if (currentDistance + this.zoomSpeed <= this.maxDistance) {
          this.camera.position.add(direction.multiplyScalar(-this.zoomSpeed));
        }
      }
    }) as EventListener;

    // Mouse rotation
    this.boundHandlers['mousedown'] = ((event: MouseEvent) => {
      if (event.button === 0) {
        this.isDragging = true;
        this.autoRotate = false;
        this.lastUserInteractionTime = Date.now();
        this.previousPosition = { x: event.clientX, y: event.clientY };
      }
    }) as EventListener;

    this.boundHandlers['mousemove'] = ((event: MouseEvent) => {
      if (!this.isDragging) return;

      const deltaX = event.clientX - this.previousPosition.x;
      const deltaY = event.clientY - this.previousPosition.y;

      this.rotateCamera(deltaX, deltaY);

      this.previousPosition = { x: event.clientX, y: event.clientY };
    }) as EventListener;

    this.boundHandlers['mouseup'] = (() => {
      this.isDragging = false;
    }) as EventListener;

    this.boundHandlers['mouseleave'] = (() => {
      this.isDragging = false;
    }) as EventListener;

    // Touch controls
    this.boundHandlers['touchstart'] = ((event: TouchEvent) => {
      if (event.touches.length === 1) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .info-panel, .star-system-row');
        const isButton = target.closest('button, .system-map-btn-container');
        if (isPanel || isButton) return;

        this.isTouching = true;
        this.autoRotate = false;
        this.lastUserInteractionTime = Date.now();
        this.previousPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      } else if (event.touches.length === 2) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .info-panel');
        if (isPanel) return;

        this.lastTouchDistance = Math.hypot(
          event.touches[1].clientX - event.touches[0].clientX,
          event.touches[1].clientY - event.touches[0].clientY
        );
      }
    }) as EventListener;

    this.boundHandlers['touchmove'] = ((event: TouchEvent) => {
      if (this.isTouching && event.touches.length === 1) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .info-panel');
        if (isPanel) {
          this.isTouching = false;
          return;
        }

        event.preventDefault();

        const touch = event.touches[0];
        const deltaX = touch.clientX - this.previousPosition.x;
        const deltaY = touch.clientY - this.previousPosition.y;

        this.rotateCamera(deltaX, deltaY);

        this.previousPosition = { x: touch.clientX, y: touch.clientY };
      } else if (event.touches.length === 2) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .info-panel');
        if (isPanel) return;

        event.preventDefault();
        this.autoRotate = false;
        this.lastUserInteractionTime = Date.now();

        const distance = Math.hypot(
          event.touches[1].clientX - event.touches[0].clientX,
          event.touches[1].clientY - event.touches[0].clientY
        );

        const delta = this.lastTouchDistance - distance;
        this.lastTouchDistance = distance;

        const direction = this.lookAtTarget.clone().sub(this.camera.position).normalize();
        const currentDistance = this.camera.position.distanceTo(this.lookAtTarget);

        if (delta > 0 && currentDistance + this.zoomSpeed <= this.maxDistance) {
          this.camera.position.add(direction.multiplyScalar(-this.zoomSpeed));
        } else if (delta < 0 && currentDistance - this.zoomSpeed >= this.minDistance) {
          this.camera.position.add(direction.multiplyScalar(this.zoomSpeed));
        }
      }
    }) as EventListener;

    this.boundHandlers['touchend'] = (() => {
      this.isTouching = false;
    }) as EventListener;

    // Resize handler
    this.boundHandlers['resize'] = (() => {
      const parent = this.renderer.domElement.parentElement;
      if (parent) {
        this.camera.aspect = parent.clientWidth / parent.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(parent.clientWidth, parent.clientHeight);
      }
    }) as EventListener;

    // Add event listeners
    window.addEventListener('wheel', this.boundHandlers['wheel'], { passive: false });
    window.addEventListener('mousedown', this.boundHandlers['mousedown']);
    window.addEventListener('mousemove', this.boundHandlers['mousemove']);
    window.addEventListener('mouseup', this.boundHandlers['mouseup']);
    window.addEventListener('mouseleave', this.boundHandlers['mouseleave']);
    window.addEventListener('touchstart', this.boundHandlers['touchstart']);
    window.addEventListener('touchmove', this.boundHandlers['touchmove'], { passive: false });
    window.addEventListener('touchend', this.boundHandlers['touchend']);
    window.addEventListener('resize', this.boundHandlers['resize']);
  }

  private removeControls(): void {
    window.removeEventListener('wheel', this.boundHandlers['wheel']);
    window.removeEventListener('mousedown', this.boundHandlers['mousedown']);
    window.removeEventListener('mousemove', this.boundHandlers['mousemove']);
    window.removeEventListener('mouseup', this.boundHandlers['mouseup']);
    window.removeEventListener('mouseleave', this.boundHandlers['mouseleave']);
    window.removeEventListener('touchstart', this.boundHandlers['touchstart']);
    window.removeEventListener('touchmove', this.boundHandlers['touchmove']);
    window.removeEventListener('touchend', this.boundHandlers['touchend']);
    window.removeEventListener('resize', this.boundHandlers['resize']);
  }

  private rotateCamera(deltaX: number, deltaY: number): void {
    const offset = this.camera.position.clone().sub(this.lookAtTarget);
    const radius = offset.length();

    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(offset.y / radius);

    theta -= deltaX * this.rotateSpeed;
    phi -= deltaY * this.rotateSpeed;

    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.copy(this.lookAtTarget).add(offset);
    this.camera.lookAt(this.lookAtTarget);
  }
}
