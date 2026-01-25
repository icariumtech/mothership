/**
 * SystemScene - Three.js system map visualization
 * Extracted from shared_console.html and converted to TypeScript
 *
 * Displays a solar system with:
 * - Central star with glow effect
 * - Orbiting planets with inclination
 * - Orbital path lines
 * - Background starfield
 * - Selection reticle for selected planets
 * - Camera controls (mouse/touch)
 */

import * as THREE from 'three';
import gsap from 'gsap';
import type {
  SystemMapData,
  BodyData,
  StarData,
  OrbitSettings,
  PlanetRenderData,
  SystemSceneCallbacks
} from '../types/systemMap';

// ==================== CONSTANTS ====================

// Star rendering
const STAR_DEFAULT_SIZE = 4;
const STAR_SPHERE_SEGMENTS = 32;
const STAR_DEFAULT_CORONA_INTENSITY = 1.5;
const STAR_LIGHT_DISTANCE = 500;
const STAR_GLOW_SIZE_MULTIPLIER = 1.5;
const STAR_GLOW_OPACITY = 0.3;

// Planet rendering
const PLANET_SPRITE_CANVAS_SIZE = 64;
const PLANET_SPRITE_CENTER = 32;
const PLANET_SPRITE_RADIUS = 28;
const PLANET_SPRITE_BORDER_WIDTH = 4;
const PLANET_SIZE_MULTIPLIER = 2;
const PLANET_ROTATION_SPEED = 0.01;

// Orbit rendering
const ORBIT_CURVE_POINTS = 128;
const ORBIT_DEFAULT_OPACITY = 0.45;
const ORBIT_DEFAULT_COLOR = 0x5a7a7a;

// Camera
const CAMERA_ANIMATION_DURATION = 1.5;
const CAMERA_ANIMATION_EASE = 'power2.inOut';
const PLANET_ZOOM_DISTANCE_RATIO = 0.3;
const MIN_PLANET_ZOOM_DISTANCE = 20;
const CAMERA_ANGLE_45_DEG = 0.7071;

// Controls
const SYSTEM_MAP_MIN_ZOOM = 60;
const SYSTEM_MAP_MAX_ZOOM = 300;
const SYSTEM_MAP_ZOOM_SPEED = 0.05;
const SYSTEM_MAP_ROTATE_SPEED = 0.003;

// Starfield
const STARFIELD_COUNT = 5000;

// Animation
const ORBITAL_PERIOD_TARGET_SECONDS = 10;

export class SystemScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  // Scene objects
  private star: { mesh: THREE.Mesh; glow: THREE.Mesh; light: THREE.PointLight } | null = null;
  private planets: PlanetRenderData[] = [];
  private orbits: THREE.Line[] = [];
  private backgroundStars: THREE.Sprite[] = [];
  private selectionReticle: THREE.Sprite | null = null;
  private starTexture: THREE.CanvasTexture | null = null;

  // State
  private currentSystem: SystemMapData | null = null;
  private currentSystemSlug: string | null = null;
  private selectedPlanet: BodyData | null = null;
  private isActive = false;
  private speedMultiplier = 10;
  private paused = false;

  // Animation
  private animationFrameId: number | null = null;
  private startTime = Date.now();

  // Camera tracking
  private cameraOffset: THREE.Vector3 | null = null;
  private lastPlanetAngle = 0;

  // Controls state
  private controlsInitialized = false;
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private isTouching = false;
  private lastTouchDistance = 0;

  // Event listeners (for cleanup)
  private boundHandlers: {
    wheel?: (e: WheelEvent) => void;
    mousedown?: (e: MouseEvent) => void;
    mousemove?: (e: MouseEvent) => void;
    mouseup?: () => void;
    mouseleave?: () => void;
    touchstart?: (e: TouchEvent) => void;
    touchmove?: (e: TouchEvent) => void;
    touchend?: () => void;
    resize?: () => void;
  } = {};

  // Callbacks
  private callbacks: SystemSceneCallbacks = {};

  constructor(canvas: HTMLCanvasElement, callbacks?: SystemSceneCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks || {};

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 180);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x222244, 0.2);
    this.scene.add(ambientLight);

    // Create star texture for background
    this.starTexture = this.createStarTexture();

    // Create background starfield
    this.createStarfield();

    // Create selection reticle
    this.createSelectionReticle();

    // Initialize controls
    this.initControls();

    // Handle window resize
    this.boundHandlers.resize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundHandlers.resize);

    console.log('SystemScene initialized');
  }

  // ==================== TEXTURE CREATION ====================

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

    // Draw simple 4-point cross
    ctx.globalCompositeOperation = 'lighter';
    this.drawSpike(ctx, centerX, centerY, 0, 50, 3);
    this.drawSpike(ctx, centerX, centerY, 90, 50, 3);
    this.drawSpike(ctx, centerX, centerY, 180, 50, 3);
    this.drawSpike(ctx, centerX, centerY, 270, 50, 3);

    // Apply blur for soft glow
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

    // Amber color
    const amberColor = 'rgba(139, 115, 85, 1.0)';

    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    // Draw outer circle
    ctx.strokeStyle = amberColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Draw inner circle
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

  // ==================== SCENE SETUP ====================

  private createStarfield(): void {
    if (!this.starTexture) return;

    for (let i = 0; i < STARFIELD_COUNT; i++) {
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

      this.scene.add(sprite);
      this.backgroundStars.push(sprite);
    }
  }

  private createSelectionReticle(): void {
    const reticleTexture = this.createReticleTexture();
    this.selectionReticle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: reticleTexture,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    }));
    this.selectionReticle.scale.set(10, 10, 1);
    this.selectionReticle.visible = false;
    this.scene.add(this.selectionReticle);
  }

  // ==================== RENDERING ====================

  private renderStar(starData: StarData): void {
    // Create star sphere
    const starGeometry = new THREE.SphereGeometry(
      starData.size || STAR_DEFAULT_SIZE,
      STAR_SPHERE_SEGMENTS,
      STAR_SPHERE_SEGMENTS
    );
    const starMaterial = new THREE.MeshBasicMaterial({
      color: starData.color || 0xFFFFAA
    });
    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    starMesh.position.set(0, 0, 0);
    this.scene.add(starMesh);

    // Add point light
    const starLight = new THREE.PointLight(
      starData.light_color || starData.color || 0xFFFFAA,
      starData.corona_intensity || STAR_DEFAULT_CORONA_INTENSITY,
      STAR_LIGHT_DISTANCE
    );
    starLight.position.set(0, 0, 0);
    this.scene.add(starLight);

    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(
      (starData.size || STAR_DEFAULT_SIZE) * STAR_GLOW_SIZE_MULTIPLIER,
      STAR_SPHERE_SEGMENTS,
      STAR_SPHERE_SEGMENTS
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: starData.color || 0xFFFFAA,
      transparent: true,
      opacity: STAR_GLOW_OPACITY
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0, 0);
    this.scene.add(glow);

    this.star = { mesh: starMesh, glow, light: starLight };
  }

  private renderPlanet(bodyData: BodyData): void {
    // Create circle texture for planet outline
    const canvas = document.createElement('canvas');
    canvas.width = PLANET_SPRITE_CANVAS_SIZE;
    canvas.height = PLANET_SPRITE_CANVAS_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Draw solid black circle background
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(PLANET_SPRITE_CENTER, PLANET_SPRITE_CENTER, PLANET_SPRITE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Draw teal circle outline
    ctx.strokeStyle = '#5a7a7a';
    ctx.lineWidth = PLANET_SPRITE_BORDER_WIDTH;
    ctx.beginPath();
    ctx.arc(PLANET_SPRITE_CENTER, PLANET_SPRITE_CENTER, PLANET_SPRITE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);

    // Create sprite
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: true,
      depthTest: true
    });

    const planet = new THREE.Sprite(spriteMaterial);
    const size = (bodyData.size || 1) * PLANET_SIZE_MULTIPLIER;
    planet.scale.set(size, size, 1);

    // Calculate initial position
    const angle = (bodyData.orbital_angle || 0) * (Math.PI / 180);
    const x = Math.cos(angle) * bodyData.orbital_radius;
    const z = Math.sin(angle) * bodyData.orbital_radius;

    // Apply orbital inclination
    const inclinationRad = (bodyData.inclination || 0) * (Math.PI / 180);
    planet.position.x = x * Math.cos(inclinationRad);
    planet.position.y = x * Math.sin(inclinationRad);
    planet.position.z = z;

    this.scene.add(planet);

    // Create ring if planet has rings (tube geometry for visible thickness)
    let ringMesh: THREE.Mesh | undefined;
    if (bodyData.has_rings) {
      const planetSize = (bodyData.size || 1) * PLANET_SIZE_MULTIPLIER;
      // Ring is 1.5x the planet's visual radius
      const ringRadius = (planetSize / 2) * 1.5;
      // Lighter teal shade (planet circles are #5a7a7a)
      const ringColor = 0x7a9a9a;
      const ringOpacity = 0.8;
      const tubeRadius = 0.15; // Thickness of the ring line

      // Create a circular path for the tube
      const curve = new THREE.EllipseCurve(0, 0, ringRadius, ringRadius, 0, 2 * Math.PI, false, 0);
      const points2D = curve.getPoints(64);
      const points3D = points2D.map(p => new THREE.Vector3(p.x, 0, p.y));

      // Create a CatmullRomCurve3 from the points (closed loop)
      const tubePath = new THREE.CatmullRomCurve3(points3D, true);

      const ringGeometry = new THREE.TubeGeometry(tubePath, 64, tubeRadius, 8, true);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: ringOpacity,
      });

      ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
      ringMesh.position.copy(planet.position);

      this.scene.add(ringMesh);
    }

    // Store planet data for animation
    this.planets.push({
      mesh: planet,
      orbitalRadius: bodyData.orbital_radius,
      orbitalPeriod: bodyData.orbital_period || 365,
      initialAngle: angle,
      inclination: bodyData.inclination || 0,
      name: bodyData.name,
      clickable: bodyData.clickable || false,
      locationSlug: bodyData.location_slug,
      ringMesh
    });
  }

  private renderOrbit(bodyData: BodyData, orbitSettings: OrbitSettings): void {
    const curve = new THREE.EllipseCurve(
      0, 0,
      bodyData.orbital_radius, bodyData.orbital_radius,
      0, 2 * Math.PI,
      false,
      0
    );

    const points = curve.getPoints(ORBIT_CURVE_POINTS);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: orbitSettings.color || ORBIT_DEFAULT_COLOR,
      transparent: true,
      opacity: orbitSettings.opacity || ORBIT_DEFAULT_OPACITY
    });

    const orbit = new THREE.Line(geometry, material);
    orbit.rotation.x = Math.PI / 2;
    orbit.rotation.y = (bodyData.inclination || 0) * (Math.PI / 180);

    this.scene.add(orbit);
    this.orbits.push(orbit);
  }

  // ==================== ANIMATION ====================

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Skip rendering if paused
    if (this.paused) return;

    if (!this.isActive) return;

    // Animate planets along their orbits
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - this.startTime) / 1000;

    this.planets.forEach(planetData => {
      const orbitalSpeed = (2 * Math.PI) / planetData.orbitalPeriod * this.speedMultiplier;
      const currentAngle = planetData.initialAngle + (orbitalSpeed * elapsedSeconds);

      const x = Math.cos(currentAngle) * planetData.orbitalRadius;
      const z = Math.sin(currentAngle) * planetData.orbitalRadius;

      const inclinationRad = planetData.inclination * (Math.PI / 180);
      planetData.mesh.position.x = x * Math.cos(inclinationRad);
      planetData.mesh.position.y = x * Math.sin(inclinationRad);
      planetData.mesh.position.z = z;

      // Update ring position to follow planet
      if (planetData.ringMesh) {
        planetData.ringMesh.position.copy(planetData.mesh.position);
      }

      planetData.mesh.rotation.y += PLANET_ROTATION_SPEED;
    });

    // Camera tracking for selected planet
    if (this.selectedPlanet && this.cameraOffset) {
      const selectedPlanetData = this.planets.find(p => p.name === this.selectedPlanet?.name);

      if (selectedPlanetData) {
        const planetPos = selectedPlanetData.mesh.position;
        const currentPlanetAngle = Math.atan2(planetPos.z, planetPos.x);
        const angleChange = currentPlanetAngle - this.lastPlanetAngle;

        // Rotate camera offset
        const cos = Math.cos(angleChange);
        const sin = Math.sin(angleChange);
        const rotatedOffsetX = this.cameraOffset.x * cos - this.cameraOffset.z * sin;
        const rotatedOffsetZ = this.cameraOffset.x * sin + this.cameraOffset.z * cos;

        this.cameraOffset.x = rotatedOffsetX;
        this.cameraOffset.z = rotatedOffsetZ;
        this.lastPlanetAngle = currentPlanetAngle;

        // Apply offset
        this.camera.position.x = planetPos.x + rotatedOffsetX;
        this.camera.position.y = planetPos.y + this.cameraOffset.y;
        this.camera.position.z = planetPos.z + rotatedOffsetZ;
        this.camera.lookAt(planetPos);

        // Update reticle position
        if (this.selectionReticle) {
          this.selectionReticle.position.copy(planetPos);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  // ==================== PUBLIC API ====================

  async loadSystem(systemSlug: string): Promise<SystemMapData | null> {
    try {
      const response = await fetch(`/api/system-map/${systemSlug}/`);
      if (!response.ok) {
        throw new Error(`Failed to load system map: ${response.statusText}`);
      }

      const data: SystemMapData = await response.json();
      console.log('System map data loaded:', data);

      // Store current system
      this.currentSystem = data;
      this.currentSystemSlug = systemSlug;

      // Clear existing objects
      this.clearSystem();

      // Render the star
      this.renderStar(data.star);

      // Render planets and orbits
      if (data.bodies) {
        data.bodies.forEach(body => {
          this.renderPlanet(body);
          if (!data.orbits || data.orbits.show !== false) {
            this.renderOrbit(body, data.orbits || {});
          }
        });
      }

      // Calculate speed multiplier
      if (this.planets.length > 0) {
        const minOrbitalPeriod = Math.min(...this.planets.map(p => p.orbitalPeriod));
        this.speedMultiplier = minOrbitalPeriod / ORBITAL_PERIOD_TARGET_SECONDS;
        console.log(`Speed multiplier: ${this.speedMultiplier.toFixed(2)}`);
      }

      // Apply camera settings
      if (data.camera) {
        this.camera.position.set(...data.camera.position);
        this.camera.lookAt(...data.camera.lookAt);
        if (data.camera.fov) {
          this.camera.fov = data.camera.fov;
          this.camera.updateProjectionMatrix();
        }
      }

      return data;
    } catch (error) {
      console.error('Error loading system map:', error);
      return null;
    }
  }

  clearSystem(): void {
    // Remove planets and their rings
    this.planets.forEach(p => {
      this.scene.remove(p.mesh);
      if (p.ringMesh) {
        this.scene.remove(p.ringMesh);
      }
    });
    this.planets = [];

    // Remove orbits
    this.orbits.forEach(o => this.scene.remove(o));
    this.orbits = [];

    // Remove star
    if (this.star) {
      this.scene.remove(this.star.mesh);
      this.scene.remove(this.star.glow);
      this.scene.remove(this.star.light);
      this.star = null;
    }

    // Hide reticle and clear selection
    if (this.selectionReticle) {
      this.selectionReticle.visible = false;
    }
    this.selectedPlanet = null;
    this.cameraOffset = null;
    this.lastPlanetAngle = 0;
  }

  show(): void {
    this.canvas.style.display = 'block';
    this.isActive = true;
    this.startTime = Date.now();

    if (!this.animationFrameId) {
      this.animate();
    }
  }

  hide(): void {
    this.isActive = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.canvas.style.display = 'none';
    this.selectedPlanet = null;
  }

  selectPlanet(planetData: BodyData): void {
    // Clear camera offset
    this.cameraOffset = null;
    this.lastPlanetAngle = 0;

    // Kill ongoing animations
    gsap.killTweensOf(this.camera.position);

    // Store selected planet
    this.selectedPlanet = planetData;

    // Find planet mesh
    const selectedPlanetMesh = this.planets.find(p => p.name === planetData.name);
    if (!selectedPlanetMesh) {
      console.error('Planet mesh not found');
      return;
    }

    // Calculate zoom distance
    const zoomDistance = selectedPlanetMesh.orbitalRadius * PLANET_ZOOM_DISTANCE_RATIO;
    const actualZoomDistance = Math.max(zoomDistance, MIN_PLANET_ZOOM_DISTANCE);

    const desiredOffset = new THREE.Vector3(
      actualZoomDistance * CAMERA_ANGLE_45_DEG,
      actualZoomDistance * CAMERA_ANGLE_45_DEG,
      actualZoomDistance * CAMERA_ANGLE_45_DEG
    );

    const startPos = this.camera.position.clone();
    const startLookAt = new THREE.Vector3(0, 0, 0);

    // Animate camera
    const animState = { progress: 0 };
    gsap.to(animState, {
      progress: 1,
      duration: CAMERA_ANIMATION_DURATION,
      ease: CAMERA_ANIMATION_EASE,
      onUpdate: () => {
        const currentPlanetPos = new THREE.Vector3();
        selectedPlanetMesh.mesh.getWorldPosition(currentPlanetPos);
        const targetPos = currentPlanetPos.clone().add(desiredOffset);

        this.camera.position.lerpVectors(startPos, targetPos, animState.progress);

        const currentLookAt = new THREE.Vector3();
        currentLookAt.lerpVectors(startLookAt, currentPlanetPos, animState.progress);
        this.camera.lookAt(currentLookAt);

        if (this.selectionReticle) {
          this.selectionReticle.position.copy(currentPlanetPos);
        }
      },
      onComplete: () => {
        const finalPlanetPos = new THREE.Vector3();
        selectedPlanetMesh.mesh.getWorldPosition(finalPlanetPos);

        this.cameraOffset = new THREE.Vector3(
          this.camera.position.x - finalPlanetPos.x,
          this.camera.position.y - finalPlanetPos.y,
          this.camera.position.z - finalPlanetPos.z
        );

        this.lastPlanetAngle = Math.atan2(finalPlanetPos.z, finalPlanetPos.x);
      }
    });

    // Show reticle (larger for ringed planets)
    if (this.selectionReticle) {
      const baseScale = (planetData.size || 1.0) * 6.0;
      const reticleScale = planetData.has_rings ? baseScale * 1.6 : baseScale;
      this.selectionReticle.scale.set(reticleScale, reticleScale, 1);
      this.selectionReticle.visible = true;
    }

    // Notify callback
    this.callbacks.onPlanetSelect?.(planetData);
  }

  /**
   * Select a planet and wait for the selection animation to complete
   * Returns a promise that resolves when the animation finishes
   */
  selectPlanetAndWait(planetData: BodyData): Promise<void> {
    return new Promise((resolve) => {
      // Clear camera offset
      this.cameraOffset = null;
      this.lastPlanetAngle = 0;

      // Kill ongoing animations
      gsap.killTweensOf(this.camera.position);

      // Store selected planet
      this.selectedPlanet = planetData;

      // Find planet mesh
      const selectedPlanetMesh = this.planets.find(p => p.name === planetData.name);
      if (!selectedPlanetMesh) {
        console.error('Planet mesh not found');
        resolve();
        return;
      }

      // Calculate zoom distance
      const zoomDistance = selectedPlanetMesh.orbitalRadius * PLANET_ZOOM_DISTANCE_RATIO;
      const actualZoomDistance = Math.max(zoomDistance, MIN_PLANET_ZOOM_DISTANCE);

      const desiredOffset = new THREE.Vector3(
        actualZoomDistance * CAMERA_ANGLE_45_DEG,
        actualZoomDistance * CAMERA_ANGLE_45_DEG,
        actualZoomDistance * CAMERA_ANGLE_45_DEG
      );

      const startPos = this.camera.position.clone();
      const startLookAt = new THREE.Vector3(0, 0, 0);

      // Animate camera
      const animState = { progress: 0 };
      gsap.to(animState, {
        progress: 1,
        duration: CAMERA_ANIMATION_DURATION,
        ease: CAMERA_ANIMATION_EASE,
        onUpdate: () => {
          const currentPlanetPos = new THREE.Vector3();
          selectedPlanetMesh.mesh.getWorldPosition(currentPlanetPos);
          const targetPos = currentPlanetPos.clone().add(desiredOffset);

          this.camera.position.lerpVectors(startPos, targetPos, animState.progress);

          const currentLookAt = new THREE.Vector3();
          currentLookAt.lerpVectors(startLookAt, currentPlanetPos, animState.progress);
          this.camera.lookAt(currentLookAt);

          if (this.selectionReticle) {
            this.selectionReticle.position.copy(currentPlanetPos);
          }
        },
        onComplete: () => {
          const finalPlanetPos = new THREE.Vector3();
          selectedPlanetMesh.mesh.getWorldPosition(finalPlanetPos);

          this.cameraOffset = new THREE.Vector3(
            this.camera.position.x - finalPlanetPos.x,
            this.camera.position.y - finalPlanetPos.y,
            this.camera.position.z - finalPlanetPos.z
          );

          this.lastPlanetAngle = Math.atan2(finalPlanetPos.z, finalPlanetPos.x);
          resolve();
        }
      });

      // Show reticle (larger for ringed planets)
      if (this.selectionReticle) {
        const baseScale = (planetData.size || 1.0) * 6.0;
        const reticleScale = planetData.has_rings ? baseScale * 1.6 : baseScale;
        this.selectionReticle.scale.set(reticleScale, reticleScale, 1);
        this.selectionReticle.visible = true;
      }

      // Notify callback
      this.callbacks.onPlanetSelect?.(planetData);
    });
  }

  /**
   * Position camera on a planet immediately without animation
   * Used when returning from orbit view to have camera already in position
   */
  positionCameraOnPlanet(planetName: string): void {
    // Find planet data
    const planetData = this.currentSystem?.bodies?.find(b => b.name === planetName);
    if (!planetData) return;

    // Find planet mesh
    const selectedPlanetMesh = this.planets.find(p => p.name === planetName);
    if (!selectedPlanetMesh) return;

    // Kill ongoing animations
    gsap.killTweensOf(this.camera.position);

    // Store selected planet
    this.selectedPlanet = planetData;

    // Calculate zoom distance (same as selectPlanet)
    const zoomDistance = selectedPlanetMesh.orbitalRadius * PLANET_ZOOM_DISTANCE_RATIO;
    const actualZoomDistance = Math.max(zoomDistance, MIN_PLANET_ZOOM_DISTANCE);

    const desiredOffset = new THREE.Vector3(
      actualZoomDistance * CAMERA_ANGLE_45_DEG,
      actualZoomDistance * CAMERA_ANGLE_45_DEG,
      actualZoomDistance * CAMERA_ANGLE_45_DEG
    );

    // Get current planet position and set camera immediately
    const planetPos = new THREE.Vector3();
    selectedPlanetMesh.mesh.getWorldPosition(planetPos);
    const targetPos = planetPos.clone().add(desiredOffset);

    this.camera.position.copy(targetPos);
    this.camera.lookAt(planetPos);

    // Set up camera offset for tracking
    this.cameraOffset = new THREE.Vector3(
      this.camera.position.x - planetPos.x,
      this.camera.position.y - planetPos.y,
      this.camera.position.z - planetPos.z
    );
    this.lastPlanetAngle = Math.atan2(planetPos.z, planetPos.x);

    // Show reticle (larger for ringed planets)
    if (this.selectionReticle) {
      this.selectionReticle.position.copy(planetPos);
      const baseScale = (planetData.size || 1.0) * 6.0;
      const reticleScale = planetData.has_rings ? baseScale * 1.6 : baseScale;
      this.selectionReticle.scale.set(reticleScale, reticleScale, 1);
      this.selectionReticle.visible = true;
    }
  }

  unselectPlanet(): void {
    if (!this.currentSystem) return;

    // Clear camera offset
    this.cameraOffset = null;
    this.lastPlanetAngle = 0;

    // Kill ongoing animations
    gsap.killTweensOf(this.camera.position);

    // Hide reticle
    if (this.selectionReticle) {
      this.selectionReticle.visible = false;
    }

    // Get start lookAt position
    const startLookAt = new THREE.Vector3();
    if (this.selectedPlanet) {
      const selectedPlanetData = this.planets.find(p => p.name === this.selectedPlanet?.name);
      if (selectedPlanetData) {
        selectedPlanetData.mesh.getWorldPosition(startLookAt);
      }
    }

    // Get target position from system data
    if (!this.currentSystem.camera) return;

    const targetPos = this.currentSystem.camera.position;
    const targetLookAt = new THREE.Vector3(...this.currentSystem.camera.lookAt);
    const startPos = this.camera.position.clone();

    // Animate camera back
    const animState = { progress: 0 };
    gsap.to(animState, {
      progress: 1,
      duration: CAMERA_ANIMATION_DURATION,
      ease: CAMERA_ANIMATION_EASE,
      onUpdate: () => {
        const targetPosition = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);
        this.camera.position.lerpVectors(startPos, targetPosition, animState.progress);

        const currentLookAt = new THREE.Vector3();
        currentLookAt.lerpVectors(startLookAt, targetLookAt, animState.progress);
        this.camera.lookAt(currentLookAt);
      },
      onComplete: () => {
        this.camera.position.set(targetPos[0], targetPos[1], targetPos[2]);
        this.camera.lookAt(targetLookAt);
        this.selectedPlanet = null;
      }
    });

    // Notify callback
    this.callbacks.onPlanetSelect?.(null);
  }

  /**
   * Animate camera diving into a planet (for transition to orbit view)
   * Returns a promise that resolves when the dive animation completes
   */
  diveToPlanet(planetName: string, duration = 800): Promise<void> {
    return new Promise((resolve) => {
      const planetData = this.planets.find(p => p.name === planetName);
      if (!planetData) {
        resolve();
        return;
      }

      // Kill ongoing animations
      gsap.killTweensOf(this.camera.position);
      this.cameraOffset = null;

      const startPosition = this.camera.position.clone();
      const startTime = Date.now();

      const updateCamera = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Get current planet position (it's moving)
        const planetPos = planetData.mesh.position.clone();

        // Dive very close to the planet
        const endPosition = planetPos.clone().add(new THREE.Vector3(0, 1, 3));

        // Ease-in for accelerating dive effect
        const eased = progress * progress * progress;

        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.camera.lookAt(planetPos);

        if (progress < 1) {
          requestAnimationFrame(updateCamera);
        } else {
          resolve();
        }
      };

      updateCamera();
    });
  }

  /**
   * Animate camera zooming out from close to a planet (for transition from orbit view)
   * Starts with camera very close to the planet and zooms out to normal selected view
   * Returns a promise that resolves when the zoom out animation completes
   */
  zoomOutFromPlanet(planetName: string, duration = 800): Promise<void> {
    return new Promise((resolve) => {
      const planetData = this.planets.find(p => p.name === planetName);
      if (!planetData) {
        resolve();
        return;
      }

      // Kill ongoing animations
      gsap.killTweensOf(this.camera.position);
      this.cameraOffset = null;

      // Calculate zoom distance (same as selectPlanet)
      const zoomDistance = planetData.orbitalRadius * PLANET_ZOOM_DISTANCE_RATIO;
      const actualZoomDistance = Math.max(zoomDistance, MIN_PLANET_ZOOM_DISTANCE);

      // Get current planet position
      const planetPos = planetData.mesh.position.clone();

      // Start camera very close to the planet
      const startPosition = planetPos.clone().add(new THREE.Vector3(0, 1, 3));
      this.camera.position.copy(startPosition);
      this.camera.lookAt(planetPos);

      const startTime = Date.now();

      const updateCamera = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Get current planet position (it's moving)
        const currentPlanetPos = planetData.mesh.position.clone();

        // Target position at normal selected view distance
        const endOffset = new THREE.Vector3(
          actualZoomDistance * CAMERA_ANGLE_45_DEG,
          actualZoomDistance * CAMERA_ANGLE_45_DEG,
          actualZoomDistance * CAMERA_ANGLE_45_DEG
        );
        const endPosition = currentPlanetPos.clone().add(endOffset);

        // Update start position relative to current planet position for smooth tracking
        const currentStartPosition = currentPlanetPos.clone().add(new THREE.Vector3(0, 1, 3));

        // Ease-out for decelerating zoom out effect
        const eased = 1 - Math.pow(1 - progress, 3);

        this.camera.position.lerpVectors(currentStartPosition, endPosition, eased);
        this.camera.lookAt(currentPlanetPos);

        // Update reticle position
        if (this.selectionReticle) {
          this.selectionReticle.position.copy(currentPlanetPos);
        }

        if (progress < 1) {
          requestAnimationFrame(updateCamera);
        } else {
          // Set up camera tracking for the selected planet
          const finalPlanetPos = planetData.mesh.position.clone();
          this.cameraOffset = new THREE.Vector3(
            this.camera.position.x - finalPlanetPos.x,
            this.camera.position.y - finalPlanetPos.y,
            this.camera.position.z - finalPlanetPos.z
          );
          this.lastPlanetAngle = Math.atan2(finalPlanetPos.z, finalPlanetPos.x);

          resolve();
        }
      };

      updateCamera();
    });
  }

  /**
   * Animate camera zooming out/away from current view (for transition to galaxy view)
   * Returns a promise that resolves when the zoom out animation completes
   */
  zoomOut(duration = 600): Promise<void> {
    return new Promise((resolve) => {
      // Kill ongoing animations
      gsap.killTweensOf(this.camera.position);
      this.cameraOffset = null;

      const startPosition = this.camera.position.clone();
      const startTime = Date.now();

      // Determine what we're looking at
      let lookAtTarget = new THREE.Vector3(0, 0, 0);
      if (this.selectedPlanet) {
        const planetData = this.planets.find(p => p.name === this.selectedPlanet?.name);
        if (planetData) {
          planetData.mesh.getWorldPosition(lookAtTarget);
        }
      }

      // Calculate end position - zoom out significantly
      const direction = startPosition.clone().sub(lookAtTarget).normalize();
      const zoomOutDistance = 200;
      const endPosition = lookAtTarget.clone().add(direction.multiplyScalar(zoomOutDistance));

      const updateCamera = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in for accelerating zoom effect
        const eased = progress * progress;

        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.camera.lookAt(lookAtTarget);

        if (progress < 1) {
          requestAnimationFrame(updateCamera);
        } else {
          resolve();
        }
      };

      updateCamera();
    });
  }

  /**
   * Animate camera zooming in from a distance (for transition from galaxy view)
   * Starts camera far away and zooms in to the default view position
   */
  zoomIn(duration = 1000): void {
    if (!this.currentSystem?.camera) {
      return;
    }

    // Kill ongoing animations
    gsap.killTweensOf(this.camera.position);
    this.cameraOffset = null;

    const startTime = Date.now();

    // Get target position from system data
    const targetPos = this.currentSystem.camera.position;
    const targetLookAt = new THREE.Vector3(...this.currentSystem.camera.lookAt);
    const endPosition = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);

    // Start from a distant position (zoomed out)
    const direction = endPosition.clone().sub(targetLookAt).normalize();
    const startPosition = targetLookAt.clone().add(direction.multiplyScalar(300));

    // Set camera to start position
    this.camera.position.copy(startPosition);
    this.camera.lookAt(targetLookAt);

    const updateCamera = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out for decelerating zoom in effect
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPosition, endPosition, eased);
      this.camera.lookAt(targetLookAt);

      if (progress < 1) {
        requestAnimationFrame(updateCamera);
      }
    };

    updateCamera();
  }

  // ==================== CONTROLS ====================

  private initControls(): void {
    if (this.controlsInitialized) return;

    const lookAtTarget = new THREE.Vector3(0, 0, 0);

    // Wheel zoom
    this.boundHandlers.wheel = (event: WheelEvent) => {
      if (!this.isActive) return;

      const target = event.target as HTMLElement;
      const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .system-info-panel');
      if (isPanel) return;

      event.preventDefault();

      let effectiveMinDistance = SYSTEM_MAP_MIN_ZOOM;
      let effectiveMaxDistance = SYSTEM_MAP_MAX_ZOOM;

      if (this.selectedPlanet) {
        const selectedPlanetMesh = this.planets.find(p => p.name === this.selectedPlanet?.name);
        if (selectedPlanetMesh) {
          selectedPlanetMesh.mesh.getWorldPosition(lookAtTarget);
          effectiveMinDistance = 5;
          effectiveMaxDistance = 100;
        }
      } else {
        lookAtTarget.set(0, 0, 0);
      }

      const delta = event.deltaY;
      const offset = this.camera.position.clone().sub(lookAtTarget);
      let distance = offset.length();

      if (delta > 0) {
        distance *= (1 + SYSTEM_MAP_ZOOM_SPEED);
      } else {
        distance *= (1 - SYSTEM_MAP_ZOOM_SPEED);
      }

      distance = Math.max(effectiveMinDistance, Math.min(effectiveMaxDistance, distance));
      offset.normalize().multiplyScalar(distance);
      this.camera.position.copy(lookAtTarget).add(offset);

      this.updateCameraOffsetIfFollowing();
    };
    window.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });

    // Mouse drag rotation
    this.boundHandlers.mousedown = (event: MouseEvent) => {
      if (!this.isActive) return;

      const target = event.target as HTMLElement;
      const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content, .star-system-row, .system-info-panel');
      const isButton = target.closest('button, .system-map-btn-container');
      if (isPanel || isButton) return;

      this.isDragging = true;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('mousedown', this.boundHandlers.mousedown);

    this.boundHandlers.mousemove = (event: MouseEvent) => {
      if (!this.isDragging || !this.isActive) return;

      if (this.selectedPlanet) {
        const selectedPlanetMesh = this.planets.find(p => p.name === this.selectedPlanet?.name);
        if (selectedPlanetMesh) {
          selectedPlanetMesh.mesh.getWorldPosition(lookAtTarget);
        }
      } else {
        lookAtTarget.set(0, 0, 0);
      }

      const deltaX = event.clientX - this.previousMousePosition.x;
      const deltaY = event.clientY - this.previousMousePosition.y;

      const offset = this.camera.position.clone().sub(lookAtTarget);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(offset.y / radius);

      theta -= deltaX * SYSTEM_MAP_ROTATE_SPEED;
      phi -= deltaY * SYSTEM_MAP_ROTATE_SPEED;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      this.camera.position.copy(lookAtTarget).add(offset);
      this.camera.lookAt(lookAtTarget);

      this.updateCameraOffsetIfFollowing();

      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('mousemove', this.boundHandlers.mousemove);

    this.boundHandlers.mouseup = () => { this.isDragging = false; };
    window.addEventListener('mouseup', this.boundHandlers.mouseup);

    this.boundHandlers.mouseleave = () => { this.isDragging = false; };
    window.addEventListener('mouseleave', this.boundHandlers.mouseleave);

    // Touch controls
    this.boundHandlers.touchstart = (event: TouchEvent) => {
      if (!this.isActive) return;

      if (event.touches.length === 1) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content');
        if (isPanel) return;

        this.isTouching = true;
        this.previousMousePosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        };
      }

      if (event.touches.length === 2) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content');
        if (isPanel) return;

        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };
    window.addEventListener('touchstart', this.boundHandlers.touchstart);

    this.boundHandlers.touchmove = (event: TouchEvent) => {
      if (!this.isActive) return;

      // Single finger rotation
      if (this.isTouching && event.touches.length === 1) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content');
        if (isPanel) {
          this.isTouching = false;
          return;
        }

        event.preventDefault();

        if (this.selectedPlanet) {
          const selectedPlanetMesh = this.planets.find(p => p.name === this.selectedPlanet?.name);
          if (selectedPlanetMesh) {
            selectedPlanetMesh.mesh.getWorldPosition(lookAtTarget);
          }
        } else {
          lookAtTarget.set(0, 0, 0);
        }

        const touch = event.touches[0];
        const deltaX = touch.clientX - this.previousMousePosition.x;
        const deltaY = touch.clientY - this.previousMousePosition.y;

        const offset = this.camera.position.clone().sub(lookAtTarget);
        const radius = offset.length();

        let theta = Math.atan2(offset.x, offset.z);
        let phi = Math.acos(offset.y / radius);

        theta -= deltaX * SYSTEM_MAP_ROTATE_SPEED;
        phi -= deltaY * SYSTEM_MAP_ROTATE_SPEED;
        phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        this.camera.position.copy(lookAtTarget).add(offset);
        this.camera.lookAt(lookAtTarget);

        this.updateCameraOffsetIfFollowing();

        this.previousMousePosition = { x: touch.clientX, y: touch.clientY };
      }

      // Two finger pinch zoom
      if (event.touches.length === 2) {
        const target = event.touches[0].target as HTMLElement;
        const isPanel = target.closest('.panel-base, .panel-wrapper, .panel-content');
        if (isPanel) return;

        event.preventDefault();

        let effectiveMinDistance = SYSTEM_MAP_MIN_ZOOM;
        let effectiveMaxDistance = SYSTEM_MAP_MAX_ZOOM;

        if (this.selectedPlanet) {
          const selectedPlanetMesh = this.planets.find(p => p.name === this.selectedPlanet?.name);
          if (selectedPlanetMesh) {
            selectedPlanetMesh.mesh.getWorldPosition(lookAtTarget);
            effectiveMinDistance = 5;
            effectiveMaxDistance = 100;
          }
        } else {
          lookAtTarget.set(0, 0, 0);
        }

        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const delta = distance - this.lastTouchDistance;
        const offset = this.camera.position.clone().sub(lookAtTarget);
        let dist = offset.length();

        if (delta < 0) {
          dist *= (1 + SYSTEM_MAP_ZOOM_SPEED);
        } else {
          dist *= (1 - SYSTEM_MAP_ZOOM_SPEED);
        }

        dist = Math.max(effectiveMinDistance, Math.min(effectiveMaxDistance, dist));
        offset.normalize().multiplyScalar(dist);
        this.camera.position.copy(lookAtTarget).add(offset);

        this.updateCameraOffsetIfFollowing();

        this.lastTouchDistance = distance;
      }
    };
    window.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false });

    this.boundHandlers.touchend = () => { this.isTouching = false; };
    window.addEventListener('touchend', this.boundHandlers.touchend);

    this.controlsInitialized = true;
    console.log('System map controls initialized');
  }

  private updateCameraOffsetIfFollowing(): void {
    if (this.selectedPlanet && this.cameraOffset) {
      const selectedPlanetMesh = this.planets.find(p => p.name === this.selectedPlanet?.name);

      if (selectedPlanetMesh) {
        const planetPos = selectedPlanetMesh.mesh.position;
        this.cameraOffset = new THREE.Vector3(
          this.camera.position.x - planetPos.x,
          this.camera.position.y - planetPos.y,
          this.camera.position.z - planetPos.z
        );
      }
    }
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ==================== GETTERS ====================

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getCurrentSystem(): SystemMapData | null {
    return this.currentSystem;
  }

  getCurrentSystemSlug(): string | null {
    return this.currentSystemSlug;
  }

  getSelectedPlanet(): BodyData | null {
    return this.selectedPlanet;
  }

  getPlanets(): PlanetRenderData[] {
    return this.planets;
  }

  isSystemActive(): boolean {
    return this.isActive;
  }

  /**
   * Pause/resume rendering updates
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // ==================== CLEANUP ====================

  dispose(): void {
    // Stop animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove event listeners
    if (this.boundHandlers.wheel) {
      window.removeEventListener('wheel', this.boundHandlers.wheel);
    }
    if (this.boundHandlers.mousedown) {
      window.removeEventListener('mousedown', this.boundHandlers.mousedown);
    }
    if (this.boundHandlers.mousemove) {
      window.removeEventListener('mousemove', this.boundHandlers.mousemove);
    }
    if (this.boundHandlers.mouseup) {
      window.removeEventListener('mouseup', this.boundHandlers.mouseup);
    }
    if (this.boundHandlers.mouseleave) {
      window.removeEventListener('mouseleave', this.boundHandlers.mouseleave);
    }
    if (this.boundHandlers.touchstart) {
      window.removeEventListener('touchstart', this.boundHandlers.touchstart);
    }
    if (this.boundHandlers.touchmove) {
      window.removeEventListener('touchmove', this.boundHandlers.touchmove);
    }
    if (this.boundHandlers.touchend) {
      window.removeEventListener('touchend', this.boundHandlers.touchend);
    }
    if (this.boundHandlers.resize) {
      window.removeEventListener('resize', this.boundHandlers.resize);
    }

    // Clear scene objects
    this.clearSystem();

    // Remove background stars
    this.backgroundStars.forEach(star => this.scene.remove(star));
    this.backgroundStars = [];

    // Remove reticle
    if (this.selectionReticle) {
      this.scene.remove(this.selectionReticle);
      this.selectionReticle = null;
    }

    // Dispose renderer
    this.renderer.dispose();

    console.log('SystemScene disposed');
  }
}
