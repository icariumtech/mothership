/**
 * OrbitScene - Three.js orbit map visualization
 * Extracted from shared_console.html orbit map module
 *
 * Renders a detailed planet view with:
 * - Central textured planet with rotation
 * - Orbiting moons with textures and paths
 * - Orbital stations as sprites
 * - Surface markers at lat/lon positions
 * - Sun lighting with shadows
 * - Selection reticle and camera tracking
 */

import * as THREE from 'three';
import gsap from 'gsap';
import type {
  OrbitMapData,
  PlanetData,
  MoonData,
  StationData,
  SurfaceMarkerData,
  MoonRenderData,
  StationRenderData,
  SurfaceMarkerRenderData,
  PlanetRenderData,
  SelectedElement,
  OrbitSceneCallbacks,
} from '../types/orbitMap';

// Constants
const MIN_ZOOM = 20;
const MAX_ZOOM = 150;
const ZOOM_SPEED = 0.05;
const ROTATE_SPEED = 0.003;

export class OrbitScene {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Lighting
  private directionalLight: THREE.DirectionalLight | null = null;
  private sunGroup: THREE.Group | null = null;

  // Scene objects
  private planet: PlanetRenderData | null = null;
  private moons: MoonRenderData[] = [];
  private stations: StationRenderData[] = [];
  private markers: SurfaceMarkerRenderData[] = [];
  private orbits: THREE.Line[] = [];
  private selectionReticle: THREE.Sprite | null = null;
  private starfield: THREE.Points | null = null;

  // State
  private _currentSystem: string | null = null;
  private _currentBody: string | null = null;
  private orbitMapData: OrbitMapData | null = null;
  private selectedElement: SelectedElement | null = null;
  private isActive = false;
  private animationPaused = false;
  private pausedAt: number | null = null;

  // Animation
  private animationFrameId: number | null = null;
  private startTime = Date.now();

  // Camera state
  private defaultCameraPosition = { x: 0, y: 30, z: 50 };
  private cameraLookAt: { x: number; y: number; z: number } | null = { x: 0, y: 0, z: 0 };

  // Controls state
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private isTouching = false;
  private lastTouchDistance = 0;
  private controlsInitialized = false;

  // Callbacks
  private callbacks: OrbitSceneCallbacks = {};

  // Bound event handlers (for cleanup)
  private boundHandleWheel: (e: WheelEvent) => void;
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleMouseUp: () => void;
  private boundHandleTouchStart: (e: TouchEvent) => void;
  private boundHandleTouchMove: (e: TouchEvent) => void;
  private boundHandleTouchEnd: () => void;
  private boundHandleResize: () => void;

  constructor(canvas: HTMLCanvasElement, callbacks: OrbitSceneCallbacks = {}) {
    this.callbacks = callbacks;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 30, 50);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add lighting
    this.setupLighting();

    // Create starfield
    this.createStarfield();

    // Create selection reticle
    this.createSelectionReticle();

    // Bind event handlers
    this.boundHandleWheel = this.handleWheel.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    this.boundHandleResize = this.handleResize.bind(this);

    // Initialize controls
    this.initControls(canvas);

    console.log('OrbitScene initialized');
  }

  private setupLighting(): void {
    // Ambient fill light
    const ambientLight = new THREE.AmbientLight(0x778899, 1.1);
    this.scene.add(ambientLight);

    // Default sun position
    const sunDistance = 200;
    const sunPosition = new THREE.Vector3(-sunDistance, 0, 0);

    // Directional light for stark terminator line
    this.directionalLight = new THREE.DirectionalLight(0xFFFFF0, 4.0);
    this.directionalLight.position.copy(sunPosition);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 50;
    this.directionalLight.shadow.camera.far = 400;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.directionalLight.shadow.bias = -0.001;
    this.scene.add(this.directionalLight);

    // Create sun visual
    this.createSun(sunPosition);
  }

  private createSun(position: THREE.Vector3): void {
    this.sunGroup = new THREE.Group();
    this.sunGroup.position.copy(position);

    // Core sun sphere
    const sunCoreGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunCoreMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const sunCore = new THREE.Mesh(sunCoreGeometry, sunCoreMaterial);
    this.sunGroup.add(sunCore);

    // Inner glow layer
    const innerGlowGeometry = new THREE.SphereGeometry(8, 32, 32);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFDD,
      transparent: true,
      opacity: 0.7,
      side: THREE.BackSide,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    this.sunGroup.add(innerGlow);

    // Middle glow layer
    const middleGlowGeometry = new THREE.SphereGeometry(14, 32, 32);
    const middleGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFEE88,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide,
    });
    const middleGlow = new THREE.Mesh(middleGlowGeometry, middleGlowMaterial);
    this.sunGroup.add(middleGlow);

    // Outer glow layer (corona)
    const outerGlowGeometry = new THREE.SphereGeometry(22, 32, 32);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFCC44,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    this.sunGroup.add(outerGlow);

    // Sun flare sprite
    const flareCanvas = document.createElement('canvas');
    flareCanvas.width = 256;
    flareCanvas.height = 256;
    const flareCtx = flareCanvas.getContext('2d')!;
    const flareGradient = flareCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    flareGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    flareGradient.addColorStop(0.08, 'rgba(255, 255, 220, 0.9)');
    flareGradient.addColorStop(0.2, 'rgba(255, 238, 136, 0.5)');
    flareGradient.addColorStop(0.4, 'rgba(255, 200, 80, 0.2)');
    flareGradient.addColorStop(0.7, 'rgba(255, 170, 50, 0.05)');
    flareGradient.addColorStop(1, 'rgba(255, 150, 30, 0)');
    flareCtx.fillStyle = flareGradient;
    flareCtx.fillRect(0, 0, 256, 256);

    const flareTexture = new THREE.CanvasTexture(flareCanvas);
    const flareMaterial = new THREE.SpriteMaterial({
      map: flareTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 1.0,
    });
    const sunFlare = new THREE.Sprite(flareMaterial);
    sunFlare.scale.set(60, 60, 1);
    this.sunGroup.add(sunFlare);

    this.scene.add(this.sunGroup);
  }

  private createStarfield(): void {
    const starCount = 5000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 400 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i3 + 2] = radius * Math.cos(phi);
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 1.5,
      sizeAttenuation: true,
    });

    this.starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfield);
  }

  private createSelectionReticle(): void {
    const texture = this.createReticleTexture();
    this.selectionReticle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    }));
    this.selectionReticle.scale.set(10, 10, 1);
    this.selectionReticle.visible = false;
    this.scene.add(this.selectionReticle);
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

    // Outer circle
    ctx.strokeStyle = amberColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Corner brackets
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Load and display orbit map for a planet
   */
  async loadOrbitMap(systemSlug: string, bodySlug: string): Promise<void> {
    try {
      const response = await fetch(`/api/orbit-map/${systemSlug}/${bodySlug}/`);
      if (!response.ok) {
        throw new Error(`Failed to load orbit map: ${response.status}`);
      }

      const data: OrbitMapData = await response.json();
      console.log('Orbit map data loaded:', data);

      // Clear existing orbit map
      this.clear();

      // Store state
      this.orbitMapData = data;
      this._currentSystem = systemSlug;
      this._currentBody = bodySlug;
      this.startTime = Date.now();

      // Set camera position from config
      if (data.camera?.position) {
        const camPos = data.camera.position;
        this.camera.position.set(camPos[0], camPos[1], camPos[2]);
        this.camera.lookAt(0, 0, 0);
        this.defaultCameraPosition = { x: camPos[0], y: camPos[1], z: camPos[2] };
      } else {
        this.defaultCameraPosition = { x: 0, y: 30, z: 50 };
      }
      this.cameraLookAt = { x: 0, y: 0, z: 0 };

      // Update sun position
      this.updateSunPosition(data.planet);

      // Render the central planet
      this.renderCentralPlanet(data.planet);

      // Render moons
      if (data.moons) {
        data.moons.forEach(moon => this.renderMoon(moon));
      }

      // Render orbital stations
      if (data.orbital_stations) {
        data.orbital_stations.forEach(station => this.renderOrbitalStation(station));
      }

      // Render surface markers
      if (data.surface_markers) {
        data.surface_markers.forEach(marker => this.renderSurfaceMarker(marker));
      }

      // Notify callback
      this.callbacks.onOrbitMapLoaded?.(data);

      console.log('Orbit map rendered successfully');

    } catch (error) {
      console.error('Error loading orbit map:', error);
      this.callbacks.onOrbitMapLoaded?.(null);
    }
  }

  private updateSunPosition(planetData: PlanetData): void {
    const sunDistance = 200;
    let sunDirection = new THREE.Vector3(-1, 0, 0);

    // Apply sun declination if specified
    const sunDeclination = planetData.sun_declination || 0;
    if (sunDeclination !== 0) {
      const declinationRad = sunDeclination * (Math.PI / 180);
      sunDirection.y = Math.sin(declinationRad);
      const horizontalScale = Math.cos(declinationRad);
      sunDirection.x *= horizontalScale;
      sunDirection.z *= horizontalScale;
    }
    sunDirection.normalize();

    const sunPosition = sunDirection.clone().multiplyScalar(sunDistance);

    if (this.directionalLight) {
      this.directionalLight.position.copy(sunPosition);
    }
    if (this.sunGroup) {
      this.sunGroup.position.copy(sunPosition);
    }
  }

  private renderCentralPlanet(planetData: PlanetData): void {
    const size = planetData.size || 15.0;
    const geometry = new THREE.SphereGeometry(size, 64, 64);

    // Load texture
    const textureLoader = new THREE.TextureLoader();
    const texturePath = planetData.texture || '/textures/planet_default.png';
    const texture = textureLoader.load(texturePath);

    // Derive normal map path
    const normalMapPath = planetData.normal_map ||
      texturePath.replace(/\/[^\/]+-EQUIRECTANGULAR-/, '/Bump-EQUIRECTANGULAR-');

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.0,
    });

    // Load normal map
    if (normalMapPath && normalMapPath !== texturePath) {
      textureLoader.load(normalMapPath, (normalMap) => {
        material.normalMap = normalMap;
        material.normalScale = new THREE.Vector2(5.0, 5.0);
        material.needsUpdate = true;
      });
    }

    const planetMesh = new THREE.Mesh(geometry, material);
    planetMesh.rotation.y = 0;
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;

    // Apply axial tilt
    if (planetData.axial_tilt) {
      planetMesh.rotation.z = (planetData.axial_tilt * Math.PI) / 180;
    }

    this.scene.add(planetMesh);

    // Add lat/lon grid overlay
    const gridGeometry = new THREE.SphereGeometry(size * 1.02, 32, 32);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x5a7a7a,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const latLonGrid = new THREE.Mesh(gridGeometry, gridMaterial);

    if (planetData.axial_tilt) {
      latLonGrid.rotation.z = (planetData.axial_tilt * Math.PI) / 180;
    }

    this.scene.add(latLonGrid);

    this.planet = {
      mesh: planetMesh,
      rotationSpeed: planetData.rotation_speed || 0.002,
      latLonGrid,
    };
  }

  private renderMoon(moonData: MoonData): void {
    const size = moonData.size || 3.0;
    const geometry = new THREE.SphereGeometry(size, 32, 32);

    let material: THREE.MeshStandardMaterial;
    const textureLoader = new THREE.TextureLoader();

    if (moonData.texture) {
      const texture = textureLoader.load(moonData.texture);
      const normalMapPath = moonData.normal_map ||
        moonData.texture.replace(/\/[^\/]+-EQUIRECTANGULAR-/, '/Bump-EQUIRECTANGULAR-');

      material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.0,
      });

      if (normalMapPath && normalMapPath !== moonData.texture) {
        textureLoader.load(normalMapPath, (normalMap) => {
          material.normalMap = normalMap;
          material.normalScale = new THREE.Vector2(5.0, 5.0);
          material.needsUpdate = true;
        });
      }
    } else {
      material = new THREE.MeshStandardMaterial({
        color: moonData.color || 0xAAAAAA,
        roughness: 0.8,
        metalness: 0.0,
      });
    }

    const moon = new THREE.Mesh(geometry, material);
    moon.castShadow = true;
    moon.receiveShadow = true;
    this.scene.add(moon);

    // Render orbital path
    this.renderOrbitPath(moonData);

    // Store moon data
    this.moons.push({
      mesh: moon,
      name: moonData.name,
      orbitalRadius: moonData.orbital_radius,
      orbitalPeriod: moonData.orbital_period,
      initialAngle: (moonData.orbital_angle || 0) * (Math.PI / 180),
      inclination: moonData.inclination || 0,
      clickable: moonData.clickable || false,
      data: moonData,
    });
  }

  private renderOrbitalStation(stationData: StationData): void {
    // Create station sprite
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 24, 24);
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(8, 8, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(stationData.size || 1.5, stationData.size || 1.5, 1);

    this.scene.add(sprite);

    // Render orbital path
    this.renderOrbitPath(stationData);

    // Store station data
    this.stations.push({
      mesh: sprite,
      name: stationData.name,
      orbitalRadius: stationData.orbital_radius,
      orbitalPeriod: stationData.orbital_period,
      initialAngle: (stationData.orbital_angle || 0) * (Math.PI / 180),
      inclination: stationData.inclination || 0,
      data: stationData,
    });
  }

  private renderSurfaceMarker(markerData: SurfaceMarkerData): void {
    const planetRadius = this.orbitMapData?.planet.size || 15.0;

    // Create marker sprite
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5a7a7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#5a7a7a';
    ctx.fillRect(8, 8, 8, 8);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 2, 1);

    // Position on planet surface
    const position = this.latLonToVector3(
      markerData.latitude,
      markerData.longitude,
      planetRadius + 0.5
    );
    sprite.position.copy(position);

    this.scene.add(sprite);

    // Store marker data
    this.markers.push({
      mesh: sprite,
      name: markerData.name,
      latitude: markerData.latitude,
      longitude: markerData.longitude,
      radius: planetRadius,
      data: markerData,
    });
  }

  private renderOrbitPath(bodyData: MoonData | StationData): void {
    const radius = bodyData.orbital_radius;
    const inclination = bodyData.inclination || 0;

    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      points.push(new THREE.Vector3(x, 0, z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x5a7a7a,
      opacity: 0.3,
      transparent: true,
    });

    const orbitLine = new THREE.Line(geometry, material);
    orbitLine.rotation.x = (inclination * Math.PI) / 180;

    this.scene.add(orbitLine);
    this.orbits.push(orbitLine);
  }

  private latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  /**
   * Select an element (moon, station, or surface marker)
   */
  selectElement(elementType: 'moon' | 'station' | 'surface', elementName: string): void {
    let elementData: MoonData | StationData | SurfaceMarkerData | undefined;
    let mesh: THREE.Object3D | undefined;

    if (elementType === 'moon') {
      const moonRender = this.moons.find(m => m.name === elementName);
      if (moonRender) {
        mesh = moonRender.mesh;
        elementData = moonRender.data;
      }
    } else if (elementType === 'station') {
      const stationRender = this.stations.find(s => s.name === elementName);
      if (stationRender) {
        mesh = stationRender.mesh;
        elementData = stationRender.data;
      }
    } else if (elementType === 'surface') {
      const markerRender = this.markers.find(m => m.name === elementName);
      if (markerRender) {
        mesh = markerRender.mesh;
        elementData = markerRender.data;
      }
    }

    if (!mesh || !elementData) {
      console.warn(`Element not found: ${elementType} ${elementName}`);
      return;
    }

    this.selectedElement = { type: elementType, name: elementName, mesh };

    // Show and position reticle
    if (this.selectionReticle) {
      this.selectionReticle.visible = true;
      this.selectionReticle.position.copy(mesh.position);

      // Scale reticle based on element type
      if (elementType === 'moon') {
        const moonData = this.moons.find(m => m.name === elementName);
        const size = moonData?.data.size || 3.0;
        this.selectionReticle.scale.set(size * 4, size * 4, 1);
      } else if (elementType === 'station') {
        this.selectionReticle.scale.set(8, 8, 1);
      } else {
        this.selectionReticle.scale.set(6, 6, 1);
      }
    }

    // Animate camera to element
    this.animateCameraToElement(mesh.position, elementType);

    // Pause animation for surface markers
    if (elementType === 'surface') {
      this.animationPaused = true;
      this.pausedAt = Date.now();
    }

    // Set camera to track element (null = track selectedElement)
    this.cameraLookAt = null;

    // Notify callback
    this.callbacks.onElementSelect?.(elementType, elementData);
  }

  /**
   * Deselect current element
   */
  unselectElement(): void {
    if (!this.selectedElement) return;

    // Hide reticle
    if (this.selectionReticle) {
      this.selectionReticle.visible = false;
    }

    this.selectedElement = null;

    // Resume animation if paused
    if (this.animationPaused && this.pausedAt) {
      const pauseDuration = Date.now() - this.pausedAt;
      this.startTime += pauseDuration;
      this.animationPaused = false;
      this.pausedAt = null;
    }

    // Reset camera target
    this.cameraLookAt = { x: 0, y: 0, z: 0 };

    // Animate camera back to default
    this.animateCameraToDefault();

    // Notify callback
    this.callbacks.onElementSelect?.(null as any, null);
  }

  private animateCameraToElement(targetPosition: THREE.Vector3, elementType: string): void {
    const distance = elementType === 'surface' ? 25 : 35;
    const direction = targetPosition.clone().normalize();
    const cameraTarget = targetPosition.clone().add(direction.multiplyScalar(distance));

    gsap.to(this.camera.position, {
      x: cameraTarget.x,
      y: cameraTarget.y + 10,
      z: cameraTarget.z,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.lookAt(targetPosition);
      },
    });
  }

  private animateCameraToDefault(): void {
    const defaultPos = this.defaultCameraPosition;

    gsap.to(this.camera.position, {
      x: defaultPos.x,
      y: defaultPos.y,
      z: defaultPos.z,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.lookAt(0, 0, 0);
      },
    });
  }

  /**
   * Start rendering
   */
  show(): void {
    this.isActive = true;
    if (!this.animationFrameId) {
      this.animate();
    }
  }

  /**
   * Stop rendering
   */
  hide(): void {
    this.isActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animate = (): void => {
    if (!this.isActive) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - this.startTime) / 1000;
    const isPaused = this.animationPaused;

    // Rotate central planet
    if (this.planet && !isPaused) {
      this.planet.mesh.rotation.y += this.planet.rotationSpeed;

      // Rotate lat/lon grid with planet
      if (this.planet.latLonGrid) {
        this.planet.latLonGrid.rotation.y = this.planet.mesh.rotation.y;
      }

      // Update surface marker positions
      this.markers.forEach(markerData => {
        const basePosition = this.latLonToVector3(
          markerData.latitude,
          markerData.longitude,
          markerData.radius + 0.5
        );
        const rotationMatrix = new THREE.Matrix4().makeRotationY(this.planet!.mesh.rotation.y);
        const rotatedPosition = basePosition.clone().applyMatrix4(rotationMatrix);
        markerData.mesh.position.copy(rotatedPosition);
      });
    }

    // Animate moons
    if (!isPaused) {
      this.moons.forEach(moonData => {
        const orbitalSpeed = (2 * Math.PI) / moonData.orbitalPeriod;
        const currentAngle = moonData.initialAngle + (orbitalSpeed * elapsedSeconds);

        const x = moonData.orbitalRadius * Math.cos(currentAngle);
        const z = moonData.orbitalRadius * Math.sin(currentAngle);
        let y = 0;

        if (moonData.inclination) {
          const inclinationRad = (moonData.inclination * Math.PI) / 180;
          const yRotated = y * Math.cos(inclinationRad) - z * Math.sin(inclinationRad);
          const zRotated = y * Math.sin(inclinationRad) + z * Math.cos(inclinationRad);
          y = yRotated;
          moonData.mesh.position.set(x, y, zRotated);
        } else {
          moonData.mesh.position.set(x, y, z);
        }
      });
    }

    // Animate stations
    if (!isPaused) {
      this.stations.forEach(stationData => {
        const orbitalSpeed = (2 * Math.PI) / stationData.orbitalPeriod;
        const currentAngle = stationData.initialAngle + (orbitalSpeed * elapsedSeconds);

        const x = stationData.orbitalRadius * Math.cos(currentAngle);
        const z = stationData.orbitalRadius * Math.sin(currentAngle);
        let y = 0;

        if (stationData.inclination) {
          const inclinationRad = (stationData.inclination * Math.PI) / 180;
          const yRotated = y * Math.cos(inclinationRad) - z * Math.sin(inclinationRad);
          const zRotated = y * Math.sin(inclinationRad) + z * Math.cos(inclinationRad);
          y = yRotated;
          stationData.mesh.position.set(x, y, zRotated);
        } else {
          stationData.mesh.position.set(x, y, z);
        }
      });
    }

    // Update selection reticle position
    if (this.selectionReticle?.visible && this.selectedElement?.mesh) {
      this.selectionReticle.position.copy(this.selectedElement.mesh.position);
    }

    // Camera tracking for orbiting elements
    if (this.cameraLookAt === null && this.selectedElement?.mesh) {
      if (this.selectedElement.type !== 'surface') {
        this.camera.lookAt(this.selectedElement.mesh.position);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Clear the orbit map
   */
  clear(): void {
    // Remove planet
    if (this.planet) {
      this.scene.remove(this.planet.mesh);
      if (this.planet.latLonGrid) {
        this.scene.remove(this.planet.latLonGrid);
      }
      if (this.planet.clouds) {
        this.scene.remove(this.planet.clouds);
      }
      this.planet = null;
    }

    // Remove moons
    this.moons.forEach(m => this.scene.remove(m.mesh));
    this.moons = [];

    // Remove stations
    this.stations.forEach(s => this.scene.remove(s.mesh));
    this.stations = [];

    // Remove markers
    this.markers.forEach(m => this.scene.remove(m.mesh));
    this.markers = [];

    // Remove orbits
    this.orbits.forEach(o => this.scene.remove(o));
    this.orbits = [];

    // Hide reticle
    if (this.selectionReticle) {
      this.selectionReticle.visible = false;
    }

    // Reset state
    this.selectedElement = null;
    this.animationPaused = false;
    this.pausedAt = null;
  }

  // ============ Controls ============

  private initControls(_canvas: HTMLCanvasElement): void {
    if (this.controlsInitialized) return;

    window.addEventListener('wheel', this.boundHandleWheel, { passive: false });
    window.addEventListener('mousedown', this.boundHandleMouseDown);
    window.addEventListener('mousemove', this.boundHandleMouseMove);
    window.addEventListener('mouseup', this.boundHandleMouseUp);
    window.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundHandleTouchEnd);
    window.addEventListener('resize', this.boundHandleResize);

    this.controlsInitialized = true;
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.isActive) return;

    const target = event.target as HTMLElement;
    if (target.closest('.panel-base, .panel-wrapper, .panel-content')) return;

    event.preventDefault();

    const zoomDirection = event.deltaY > 0 ? 1 : -1;
    const currentDistance = this.camera.position.length();
    const newDistance = currentDistance * (1 + zoomDirection * ZOOM_SPEED);

    if (newDistance >= MIN_ZOOM && newDistance <= MAX_ZOOM) {
      const scale = newDistance / currentDistance;
      this.camera.position.multiplyScalar(scale);
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.isActive) return;

    const target = event.target as HTMLElement;
    if (target.closest('.panel-base, .panel-wrapper, .panel-content, .star-system-row, .system-info-panel, .dashboard-panel-content')) return;
    if (target.closest('button, .orbit-map-btn-container, .back-btn-container')) return;

    if (event.button === 0) {
      this.isDragging = true;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.isActive) return;

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    this.rotateCamera(deltaX, deltaY);

    this.previousMousePosition = { x: event.clientX, y: event.clientY };
  }

  private handleMouseUp(): void {
    this.isDragging = false;
  }

  private handleTouchStart(event: TouchEvent): void {
    if (!this.isActive) return;

    const target = event.touches[0]?.target as HTMLElement;
    if (target?.closest('.panel-base, .panel-wrapper, .panel-content, .star-system-row')) return;

    if (event.touches.length === 1) {
      this.isTouching = true;
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    } else if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isActive) return;

    const target = event.touches[0]?.target as HTMLElement;
    if (target?.closest('.panel-base, .panel-wrapper, .panel-content')) {
      this.isTouching = false;
      return;
    }

    if (this.isTouching && event.touches.length === 1) {
      event.preventDefault();

      const touch = event.touches[0];
      const deltaX = touch.clientX - this.previousMousePosition.x;
      const deltaY = touch.clientY - this.previousMousePosition.y;

      this.rotateCamera(deltaX, deltaY);

      this.previousMousePosition = { x: touch.clientX, y: touch.clientY };
    } else if (event.touches.length === 2) {
      event.preventDefault();

      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (this.lastTouchDistance > 0) {
        const delta = this.lastTouchDistance - distance;
        const currentDistance = this.camera.position.length();
        const newDistance = currentDistance * (1 + delta * 0.005);

        if (newDistance >= MIN_ZOOM && newDistance <= MAX_ZOOM) {
          const scale = newDistance / currentDistance;
          this.camera.position.multiplyScalar(scale);
        }
      }

      this.lastTouchDistance = distance;
    }
  }

  private handleTouchEnd(): void {
    this.isTouching = false;
    this.lastTouchDistance = 0;
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private rotateCamera(deltaX: number, deltaY: number): void {
    // Rotate around selected element or planet center
    const lookAtTarget = new THREE.Vector3(0, 0, 0);
    if (this.selectedElement?.mesh) {
      lookAtTarget.copy(this.selectedElement.mesh.position);
    }

    const offset = this.camera.position.clone().sub(lookAtTarget);
    const radius = offset.length();

    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(offset.y / radius);

    theta -= deltaX * ROTATE_SPEED;
    phi -= deltaY * ROTATE_SPEED;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.copy(lookAtTarget).add(offset);
    this.camera.lookAt(lookAtTarget);
  }

  // ============ Getters ============

  getOrbitMapData(): OrbitMapData | null {
    return this.orbitMapData;
  }

  getSelectedElement(): SelectedElement | null {
    return this.selectedElement;
  }

  getMoons(): MoonRenderData[] {
    return this.moons;
  }

  getStations(): StationRenderData[] {
    return this.stations;
  }

  getMarkers(): SurfaceMarkerRenderData[] {
    return this.markers;
  }

  isActiveView(): boolean {
    return this.isActive;
  }

  getCurrentLocation(): { system: string | null; body: string | null } {
    return { system: this._currentSystem, body: this._currentBody };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.hide();
    this.clear();

    // Remove event listeners
    window.removeEventListener('wheel', this.boundHandleWheel);
    window.removeEventListener('mousedown', this.boundHandleMouseDown);
    window.removeEventListener('mousemove', this.boundHandleMouseMove);
    window.removeEventListener('mouseup', this.boundHandleMouseUp);
    window.removeEventListener('touchstart', this.boundHandleTouchStart);
    window.removeEventListener('touchmove', this.boundHandleTouchMove);
    window.removeEventListener('touchend', this.boundHandleTouchEnd);
    window.removeEventListener('resize', this.boundHandleResize);

    // Dispose renderer
    this.renderer.dispose();

    console.log('OrbitScene disposed');
  }
}
