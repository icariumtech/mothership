/**
 * TravelRoute - Visual connection between star systems
 *
 * Renders a tube geometry with fade-at-ends shader between two points.
 * Routes fade near star positions to avoid visual overlap.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TravelRoute as TravelRouteData, StarSystem } from '@/types/starMap';

// Custom shader for fading tube ends
const routeVertexShader = `
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const routeFragmentShader = `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(color, vAlpha);
  }
`;

interface TravelRouteProps {
  /** Route data from API */
  route: TravelRouteData;
  /** Map of system names to their positions */
  systemPositions: Map<string, [number, number, number]>;
  /** Tube radius (default: 0.3) */
  radius?: number;
  /** Distance from endpoints to start fading (default: 15) */
  fadeDistance?: number;
}

export function TravelRoute({
  route,
  systemPositions,
  radius = 0.3,
  fadeDistance = 15,
}: TravelRouteProps) {
  const fromPos = systemPositions.get(route.from);
  const toPos = systemPositions.get(route.to);

  // Skip if positions not found
  if (!fromPos || !toPos) {
    return null;
  }

  const { geometry, material } = useMemo(() => {
    const start = new THREE.Vector3(fromPos[0], fromPos[1], fromPos[2]);
    const end = new THREE.Vector3(toPos[0], toPos[1], toPos[2]);

    const direction = end.clone().sub(start);
    const distance = direction.length();

    // Skip very short routes
    if (distance <= fadeDistance * 2) {
      return { geometry: null, material: null };
    }

    // Create tube along the path
    const curve = new THREE.LineCurve3(start, end);
    const segments = 64;
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);

    // Calculate alpha values for each vertex based on distance from endpoints
    const positions = tubeGeometry.attributes.position;
    const alphas: number[] = [];

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );

      const distFromStart = vertex.distanceTo(start);
      const distFromEnd = vertex.distanceTo(end);

      // Calculate alpha based on distance from both endpoints
      const alphaFromStart = distFromStart < fadeDistance
        ? distFromStart / fadeDistance
        : 1.0;
      const alphaFromEnd = distFromEnd < fadeDistance
        ? distFromEnd / fadeDistance
        : 1.0;

      alphas.push(Math.min(alphaFromStart, alphaFromEnd));
    }

    tubeGeometry.setAttribute(
      'alpha',
      new THREE.Float32BufferAttribute(alphas, 1)
    );

    // Create shader material with route color
    const routeColor = route.color ?? 0x5a7a9a;
    const tubeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(routeColor) },
      },
      vertexShader: routeVertexShader,
      fragmentShader: routeFragmentShader,
      transparent: true,
      depthWrite: false,
    });

    return { geometry: tubeGeometry, material: tubeMaterial };
  }, [fromPos, toPos, route.color, radius, fadeDistance]);

  if (!geometry || !material) {
    return null;
  }

  return <mesh geometry={geometry} material={material} />;
}

/**
 * TravelRoutes - Renders all routes from data
 *
 * Takes the full routes array and a position map built from systems.
 */
interface TravelRoutesProps {
  /** Array of route data */
  routes: TravelRouteData[];
  /** Array of star systems (used to build position map) */
  systems: StarSystem[];
}

export function TravelRoutes({ routes, systems }: TravelRoutesProps) {
  // Build position map from systems
  const systemPositions = useMemo(() => {
    const posMap = new Map<string, [number, number, number]>();
    systems.forEach((sys) => {
      posMap.set(sys.name, sys.position);
    });
    return posMap;
  }, [systems]);

  return (
    <group>
      {routes.map((route, index) => (
        <TravelRoute
          key={`${route.from}-${route.to}-${index}`}
          route={route}
          systemPositions={systemPositions}
        />
      ))}
    </group>
  );
}
