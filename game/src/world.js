import * as THREE from "three";
import { COLORS } from "./config.js?v=3.0.3";

function createGlowTexture(inner, outer = "rgba(255,255,255,0)") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPlanetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#7fe0d6");
  gradient.addColorStop(0.55, "#3fa8c9");
  gradient.addColorStop(1, "#2a5b9e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);

  let seed = 42;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  context.fillStyle = "rgba(60,200,150,.65)";
  for (let index = 0; index < 26; index += 1) {
    const x = random() * 512;
    const y = 40 + random() * 180;
    const radius = 12 + random() * 34;
    context.beginPath();
    context.ellipse(x, y, radius * 1.5, radius * 0.8, random() * 3, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(255,255,255,.34)";
  for (let index = 0; index < 16; index += 1) {
    const x = random() * 512;
    const y = random() * 256;
    const radius = 16 + random() * 40;
    context.beginPath();
    context.ellipse(x, y, radius * 1.8, radius * 0.5, 0, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMidCurve(from, to, lift, side) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const middle = start.clone().lerp(end, 0.5);
  const direction = end.clone().sub(start).normalize();
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
  middle.y += lift;
  middle.addScaledVector(perpendicular, side);
  return new THREE.CatmullRomCurve3([start, middle, end]);
}

export class GameWorld {
  constructor({ scene, level, visualContext, callbacks = {} }) {
    this.scene = scene;
    this.level = level;
    this.visualContext = visualContext;
    this.callbacks = callbacks;
    this.root = new THREE.Group();
    this.root.name = `ProceduralWorld_Stage_${level.stageNumber ?? 0}`;
    this.scene.add(this.root);
    this.colliders = [];
    this.islandGroups = [];
    this.rimMaterials = [];
    this.cordMaterials = [];
    this.phantoms = [];
    this.crystals = [];
    this.obstacles = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.ray.direction.set(0, -1, 0);
    this.portalHintTime = -Infinity;
    this.hazardCooldown = 0;
    this.zorg = null;
    this.waveTime = 99;
    this.shootingStar = { mesh: null, time: 99, next: 8 };

    this.textures = {
      glowCyan: createGlowTexture("rgba(140,235,255,1)", "rgba(140,235,255,0)"),
      glowPink: createGlowTexture("rgba(255,150,220,1)", "rgba(255,150,220,0)"),
      glowGold: createGlowTexture("rgba(255,224,140,1)", "rgba(255,214,102,0)"),
      nebula: createGlowTexture("rgba(120,90,220,.9)", "rgba(120,90,220,0)"),
    };

    this.build();
  }

  build() {
    this.sky = this.buildSky();
    this.buildIslands();

    const fragmentDefinitions = this.level.fragments.map((fragment) => ({
      position: [...fragment.position],
      hidden: Boolean(fragment.hidden),
    }));

    this.level.cords.forEach((cord, index) => {
      this.buildCord(cord, index, fragmentDefinitions);
    });

    this.buildMiniPhantom(fragmentDefinitions);
    this.buildPhantomPlatforms();
    fragmentDefinitions.forEach((definition, index) => this.buildCrystal(definition, index));
    this.buildObstacles();
    this.buildPortal();
    this.buildZorg();
    this.buildParticles();
    this.buildAttunementWave();
  }

  buildSky() {
    for (const [count, size, color] of [
      [1300, 0.55, 0xbfd6ff],
      [260, 1.15, 0xffffff],
    ]) {
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        const radius = 190 + Math.random() * 160;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[index * 3 + 1] = radius * Math.cos(phi) * 0.7;
        positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        size,
        color,
        transparent: true,
        opacity: 0.95,
        fog: false,
        depthWrite: false,
      });
      this.root.add(new THREE.Points(geometry, material));
    }

    const nebulaColors = [0x7a5be0, COLORS.cord, COLORS.tune, 0x9d7bff];
    for (let index = 0; index < 6; index += 1) {
      const nebula = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.textures.nebula,
          color: nebulaColors[index % nebulaColors.length],
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
          fog: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const angle = (index / 6) * Math.PI * 2;
      nebula.position.set(
        Math.cos(angle) * 150,
        20 + Math.sin(index * 2.3) * 40,
        Math.sin(angle) * 150,
      );
      nebula.scale.setScalar(120 + index * 22);
      this.root.add(nebula);
    }

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(46, 48, 32),
      new THREE.MeshStandardMaterial({
        map: createPlanetTexture(),
        roughness: 0.9,
        fog: false,
      }),
    );
    planet.position.set(-120, 42, -150);
    this.root.add(planet);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(72, 7, 2, 90),
      new THREE.MeshBasicMaterial({
        color: 0xffb0dd,
        transparent: true,
        opacity: 0.4,
        fog: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.copy(planet.position);
    ring.rotation.set(1.35, 0, 0.4);
    ring.scale.y = 0.22;
    this.root.add(ring);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.textures.glowCyan,
        color: 0x6fd8ff,
        transparent: true,
        opacity: 0.5,
        fog: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.copy(planet.position);
    glow.scale.setScalar(150);
    this.root.add(glow);

    const shootingGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(-7, 1.4, 0),
    ]);
    this.shootingStar.mesh = new THREE.Line(
      shootingGeometry,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        fog: false,
      }),
    );
    this.root.add(this.shootingStar.mesh);

    return { planet, ring, glow };
  }

  buildIslands() {
    const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4aa8,
      flatShading: true,
      roughness: 0.95,
    });

    this.level.islands.forEach((definition, index) => {
      const [x, y, z] = definition.position;
      const radius = definition.radius;
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.94, 0.65, 26),
        new THREE.MeshStandardMaterial({
          color: COLORS.isleTop,
          roughness: 0.85,
        }),
      );
      top.position.y = -0.325;
      top.userData.solid = true;
      top.userData.checkpoint = definition.checkpoint ?? null;
      top.userData.islandGroup = group;
      group.add(top);
      this.colliders.push(top);

      const underside = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.94, radius * 1.5, 10, 1),
        new THREE.MeshStandardMaterial({
          color: COLORS.isleRock,
          flatShading: true,
          roughness: 1,
        }),
      );
      underside.rotation.x = Math.PI;
      underside.position.y = -0.65 - radius * 0.75;
      group.add(underside);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.99, 0.05, 8, 44),
        new THREE.MeshBasicMaterial({
          color: COLORS.cord,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.02;
      group.add(rim);
      this.rimMaterials.push(rim.material);

      let seed = index * 7 + 3;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const decorationCount = 2 + ((index * 3) % 3);

      for (let decorationIndex = 0; decorationIndex < decorationCount; decorationIndex += 1) {
        const angle = random() * Math.PI * 2;
        const distance = radius * (0.35 + random() * 0.5);
        if (random() < 0.5) {
          const rock = new THREE.Mesh(rockGeometry, rockMaterial);
          rock.scale.setScalar(0.22 + random() * 0.3);
          rock.position.set(Math.cos(angle) * distance, 0.12, Math.sin(angle) * distance);
          rock.rotation.set(random() * 3, random() * 3, 0);
          group.add(rock);
        } else {
          const crystal = new THREE.Mesh(
            new THREE.ConeGeometry(0.11, 0.5, 5),
            new THREE.MeshStandardMaterial({
              color: 0x9adfff,
              emissive: 0x2a7fa8,
              emissiveIntensity: 1.4,
              roughness: 0.3,
            }),
          );
          crystal.position.set(Math.cos(angle) * distance, 0.25, Math.sin(angle) * distance);
          crystal.rotation.z = (random() - 0.5) * 0.5;
          group.add(crystal);
        }
      }

      group.userData.baseY = y;
      group.userData.bob = definition.bob || 0;
      group.userData.phase = index * 1.7;
      this.root.add(group);
      this.islandGroups.push(group);
    });
  }

  buildCord(definition, index, fragmentDefinitions) {
    const fromIsland = this.level.islands[definition.from];
    const toIsland = this.level.islands[definition.to];
    const from = new THREE.Vector3(...fromIsland.position);
    const to = new THREE.Vector3(...toIsland.position);
    const direction = to.clone().sub(from).setY(0).normalize();
    const start = from.clone().addScaledVector(direction, fromIsland.radius - 0.3);
    const end = to.clone().addScaledVector(direction, -(toIsland.radius - 0.3));
    start.y = fromIsland.position[1] + 0.35;
    end.y = toIsland.position[1] + 0.35;

    const distance = start.distanceTo(end);
    const curve = createMidCurve(
      start.toArray(),
      end.toArray(),
      0.5 + distance * 0.03,
      index % 2 ? 0.35 : -0.35,
    );

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.055, 6),
      new THREE.MeshBasicMaterial({
        color: COLORS.cord,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    tube.userData.phase = index * 1.3;
    this.root.add(tube);
    this.cordMaterials.push(tube.material);

    if (!definition.phantom) return;

    const stepCount = Math.max(5, Math.round(distance / 1.8) + 1);
    for (let step = 0; step < stepCount; step += 1) {
      const curveProgress = step / (stepCount - 1);
      const position = curve.getPoint(curveProgress);
      const tangent = curve.getTangent(curveProgress);
      tangent.y = 0;
      tangent.normalize();

      const bridgePart = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.26, 1.7),
        new THREE.MeshStandardMaterial({
          color: COLORS.tune,
          emissive: COLORS.tune,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.06,
          roughness: 0.4,
        }),
      );
      bridgePart.position.copy(position);
      bridgePart.position.y -= 0.15;
      bridgePart.rotation.y = Math.atan2(tangent.x, tangent.z);
      bridgePart.userData.solid = false;

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(bridgePart.geometry),
        new THREE.LineBasicMaterial({
          color: COLORS.tune,
          transparent: true,
          opacity: 0.16,
        }),
      );
      bridgePart.add(edge);

      this.root.add(bridgePart);
      this.colliders.push(bridgePart);
      this.phantoms.push({
        mesh: bridgePart,
        edge,
        material: bridgePart.material,
      });
    }

    if (definition.hiddenFragment) {
      const position = curve.getPoint(0.5);
      fragmentDefinitions.push({
        position: [position.x, position.y + 1.05, position.z],
        hidden: true,
      });
    }
  }

  buildMiniPhantom(fragmentDefinitions) {
    if (!this.level.miniPhantom) return;

    const bridgePart = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.26, 2.1),
      new THREE.MeshStandardMaterial({
        color: COLORS.tune,
        emissive: COLORS.tune,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.06,
        roughness: 0.4,
      }),
    );
    bridgePart.position.set(...this.level.miniPhantom.position);
    bridgePart.userData.solid = false;

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(bridgePart.geometry),
      new THREE.LineBasicMaterial({
        color: COLORS.tune,
        transparent: true,
        opacity: 0.16,
      }),
    );
    bridgePart.add(edge);
    this.root.add(bridgePart);
    this.colliders.push(bridgePart);
    this.phantoms.push({ mesh: bridgePart, edge, material: bridgePart.material });

    if (this.level.miniPhantom.hiddenFragment) {
      const [x, y, z] = this.level.miniPhantom.position;
      fragmentDefinitions.push({
        position: [x, y + 1.15, z],
        hidden: true,
      });
    }
  }

  buildPhantomPlatforms() {
    for (const definition of this.level.phantomPlatforms ?? []) {
      const size = definition.size ?? [3.4, 0.26, 3.4];
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        new THREE.MeshStandardMaterial({
          color: COLORS.tune,
          emissive: COLORS.tune,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.06,
          roughness: 0.4,
        }),
      );
      platform.position.set(...definition.position);
      platform.userData.solid = false;

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(platform.geometry),
        new THREE.LineBasicMaterial({
          color: COLORS.tune,
          transparent: true,
          opacity: 0.18,
        }),
      );
      platform.add(edge);
      this.root.add(platform);
      this.colliders.push(platform);
      this.phantoms.push({ mesh: platform, edge, material: platform.material });
    }
  }

  buildCrystal(definition, index) {
    const group = new THREE.Group();
    group.position.set(...definition.position);
    const color = definition.hidden ? COLORS.tune : COLORS.cord;

    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36, 0),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.2,
        roughness: 0.25,
        transparent: true,
        opacity: definition.hidden ? 0.16 : 1,
      }),
    );
    group.add(mesh);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: definition.hidden ? this.textures.glowPink : this.textures.glowCyan,
        transparent: true,
        opacity: definition.hidden ? 0.12 : 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(1.9);
    group.add(halo);

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.022, 6, 36),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: definition.hidden ? 0.15 : 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orbit.rotation.x = 1.2;
    group.add(orbit);

    this.root.add(group);
    this.crystals.push({
      id: `fragment-${index + 1}`,
      label: `Fragmento ${index + 1}`,
      group,
      mesh,
      halo,
      orbit,
      hidden: definition.hidden,
      collected: false,
      phase: index * 1.1,
      base: group.position.clone(),
    });
  }

  buildObstacles() {
    for (const definition of this.level.obstacles ?? []) {
      const material = new THREE.MeshStandardMaterial({
        color: COLORS.tune,
        emissive: COLORS.tune,
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.78,
        roughness: 0.3,
      });
      let mesh;

      if (definition.type === "energyOrb") {
        mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(definition.radius ?? 0.85, 1),
          material,
        );
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry((definition.radius ?? 1.15) * 2.5, 1.5, 0.28),
          material,
        );
      }

      mesh.position.set(...definition.position);
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.textures.glowPink,
          color: COLORS.tune,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      halo.scale.setScalar((definition.radius ?? 1) * 3.2);
      mesh.add(halo);
      this.root.add(mesh);
      this.obstacles.push({
        ...definition,
        mesh,
        material,
        halo,
      });
    }
  }

  buildPortal() {
    this.portal = {
      group: new THREE.Group(),
      active: false,
      disc: null,
      ringMaterial: null,
      particles: null,
    };

    const portalIsland = this.level.islands.find((island) => island.portal);
    this.portal.group.position.set(...portalIsland.position);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.22, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x8a86b8,
        emissive: 0x221d44,
        emissiveIntensity: 1,
        roughness: 0.5,
      }),
    );
    ring.position.y = 2.35;
    this.portal.group.add(ring);
    this.portal.ringMaterial = ring.material;

    if (this.level.portalFinal?.special) {
      const crownRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.07, 8, 56),
        new THREE.MeshBasicMaterial({
          color: COLORS.crystal,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
        }),
      );
      crownRing.position.y = 2.35;
      crownRing.rotation.z = Math.PI / 8;
      this.portal.group.add(crownRing);
      this.portal.crownRing = crownRing;
    }

    this.portal.disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.66, 40),
      new THREE.MeshBasicMaterial({
        color: COLORS.cord,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.portal.disc.position.y = 2.35;
    this.portal.group.add(this.portal.disc);

    [-1, 1].forEach((side) => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 2.5, 8),
        new THREE.MeshStandardMaterial({
          color: 0x4a3b8f,
          flatShading: true,
          roughness: 1,
        }),
      );
      pillar.position.set(side * 2.9, 1.25, 0);
      this.portal.group.add(pillar);

      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({
          color: COLORS.crystal,
          emissive: COLORS.crystal,
          emissiveIntensity: 1.6,
          roughness: 0.3,
        }),
      );
      gem.position.set(side * 2.9, 2.72, 0);
      this.portal.group.add(gem);
    });

    const particleCount = 42;
    const positions = new Float32Array(particleCount * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.portal.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.14,
        color: COLORS.tune,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.portal.particles.position.y = 2.35;
    this.portal.group.add(this.portal.particles);
    this.root.add(this.portal.group);
  }

  buildZorg() {
    const zorgIsland = this.level.islands.find((island) => island.zorg);
    if (!zorgIsland) return;

    const group = new THREE.Group();
    group.position.set(
      zorgIsland.position[0] + 1.6,
      zorgIsland.position[1],
      zorgIsland.position[2] + 1.4,
    );

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9bcc9,
      roughness: 0.6,
    });
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 0.4, 4, 10),
      skinMaterial,
    );
    body.position.y = 0.55;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 18, 14),
      skinMaterial,
    );
    head.scale.set(1, 1.15, 0.95);
    head.position.y = 1.22;
    group.add(head);

    const eyeGeometry = new THREE.SphereGeometry(0.11, 10, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0a14 });
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.scale.set(1, 0.62, 0.5);
      eye.rotation.z = side * 0.5;
      eye.position.set(side * 0.15, 1.26, 0.3);
      group.add(eye);
    });

    const hoodie = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.09, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.9 }),
    );
    hoodie.rotation.x = 1.35;
    hoodie.position.y = 0.95;
    group.add(hoodie);

    this.root.add(group);
    this.zorg = {
      group,
      baseY: zorgIsland.position[1],
      lineIndex: 0,
      cooldown: 0,
    };
  }

  buildParticles() {
    const poolSize = 140;
    const data = [];
    const positions = new Float32Array(poolSize * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.16,
      map: this.textures.glowGold,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffffff,
    });
    const points = new THREE.Points(geometry, material);
    this.root.add(points);

    for (let index = 0; index < poolSize; index += 1) {
      data.push({ life: 0, velocity: new THREE.Vector3() });
      positions[index * 3 + 1] = -999;
    }

    this.particlePool = { poolSize, data, positions, geometry, material, points };
  }

  buildAttunementWave() {
    this.wave = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.06, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS.tune,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.wave.rotation.x = -Math.PI / 2;
    this.root.add(this.wave);
  }

  burst(position, color = COLORS.crystal, amount = 22, speed = 4) {
    const pool = this.particlePool;
    pool.material.color.setHex(color);
    let placed = 0;

    for (let index = 0; index < pool.poolSize && placed < amount; index += 1) {
      if (pool.data[index].life > 0) continue;

      pool.data[index].life = 0.6 + Math.random() * 0.35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      pool.data[index].velocity
        .set(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi) * 1.2,
          Math.sin(phi) * Math.sin(theta),
        )
        .multiplyScalar(speed * (0.5 + Math.random() * 0.7));

      pool.positions[index * 3] = position.x;
      pool.positions[index * 3 + 1] = position.y;
      pool.positions[index * 3 + 2] = position.z;
      placed += 1;
    }
  }

  updateParticles(delta) {
    const pool = this.particlePool;
    for (let index = 0; index < pool.poolSize; index += 1) {
      const particle = pool.data[index];
      if (particle.life <= 0) continue;

      particle.life -= delta;
      particle.velocity.y -= delta * 6;
      pool.positions[index * 3] += particle.velocity.x * delta;
      pool.positions[index * 3 + 1] += particle.velocity.y * delta;
      pool.positions[index * 3 + 2] += particle.velocity.z * delta;
      if (particle.life <= 0) pool.positions[index * 3 + 1] = -999;
    }
    pool.geometry.attributes.position.needsUpdate = true;
  }

  startAttunementWave(position) {
    this.wave.position.copy(position).add(new THREE.Vector3(0, 0.15, 0));
    this.waveTime = 0;
  }

  updateAttunement(delta, state) {
    const config = this.visualContext.attunement;
    if (state.attuned) {
      state.energy -= config.drainPerSecond * delta;
      if (state.energy <= 0) {
        state.energy = 0;
        this.callbacks.onAttunementExhausted?.();
      }
    } else {
      state.energy = Math.min(1, state.energy + config.regenPerSecond * delta);
    }

    state.grace = Math.max(0, state.grace - delta);
    const solid = state.attuned || state.grace > 0;
    this.phantoms.forEach((phantom) => {
      phantom.mesh.userData.solid = solid;
    });

    state.attuneBlend += (state.attuned ? 1 : -1) * delta * 3.2;
    state.attuneBlend = THREE.MathUtils.clamp(state.attuneBlend, 0, 1);
    const smooth = state.attuneBlend ** 2 * (3 - 2 * state.attuneBlend);

    this.scene.fog.color
      .setHex(COLORS.fog)
      .lerp(new THREE.Color(COLORS.fogTuned), smooth);
    this.visualContext.hemisphere.intensity = 0.95 + smooth * 0.35;
    this.visualContext.bloom.strength =
      this.visualContext.baseBloom + smooth * 0.42;

    this.cordMaterials.forEach((material) => {
      material.color.setHex(COLORS.cord).lerp(new THREE.Color(COLORS.tune), smooth);
    });
    this.rimMaterials.forEach((material) => {
      material.opacity = 0.32 + smooth * 0.3;
    });

    const blink =
      state.grace > 0 && !state.attuned
        ? 0.5 + 0.5 * Math.sin(performance.now() * 0.03)
        : 0;

    this.phantoms.forEach((phantom) => {
      phantom.material.opacity = Math.max(0.06 + smooth * 0.82, blink * 0.7);
      phantom.edge.material.opacity = Math.max(0.16 + smooth * 0.6, blink * 0.8);
      phantom.mesh.scale.y =
        1 + Math.sin(Math.min(1, state.attuneBlend) * Math.PI) * 0.35;
    });

    this.obstacles.forEach((obstacle) => {
      const disabled =
        obstacle.disabledByAttunement && (state.attuned || state.grace > 0);
      obstacle.material.opacity = disabled ? 0.12 : 0.78;
      obstacle.halo.material.opacity = disabled ? 0.06 : 0.34;
      obstacle.mesh.scale.setScalar(disabled ? 0.72 : 1);
    });

    this.crystals.forEach((crystal) => {
      if (crystal.collected || !crystal.hidden) return;
      crystal.mesh.material.opacity = 0.16 + smooth * 0.84;
      crystal.halo.material.opacity = 0.12 + smooth * 0.6;
      crystal.orbit.material.opacity = 0.15 + smooth * 0.6;
    });

    this.obstacles.forEach((obstacle, index) => {
      obstacle.mesh.rotation.y +=
        delta * (obstacle.rotationSpeed ?? 0.8) * (index % 2 ? -1 : 1);
      obstacle.mesh.rotation.z += delta * 0.18;
    });

    if (this.waveTime < 1) {
      this.waveTime += delta * 1.7;
      this.wave.scale.setScalar(1 + this.waveTime * 26);
      this.wave.material.opacity = (1 - this.waveTime) * 0.7;
    } else {
      this.wave.material.opacity = 0;
    }
  }

  updateAmbient(delta, state) {
    const time = performance.now() * 0.001;
    this.sky.ring.rotation.z += delta * 0.02;
    this.updateShootingStar(delta);
    this.updateParticles(delta);

    this.islandGroups.forEach((group) => {
      if (group.userData.bob) {
        group.position.y =
          group.userData.baseY +
          Math.sin(time * 0.7 + group.userData.phase) * group.userData.bob;
      }
    });

    this.rimMaterials.forEach((material, index) => {
      if (!state.attuned) material.opacity = 0.26 + Math.sin(time * 2 + index) * 0.1;
    });
    this.cordMaterials.forEach((material, index) => {
      material.opacity =
        0.42 + Math.sin(time * 2.2 + index * 1.3) * 0.16 + state.attuneBlend * 0.4;
    });

    this.crystals.forEach((crystal) => {
      if (crystal.collected) return;
      crystal.mesh.rotation.y += delta * 1.6;
      crystal.orbit.rotation.z += delta * 0.9;
      crystal.group.position.y =
        crystal.base.y + Math.sin(time * 1.8 + crystal.phase) * 0.14;
    });

    if (this.zorg) {
      this.zorg.group.position.y =
        this.zorg.baseY + Math.sin(time * 1.5) * 0.08;
    }

    if (this.portal.active) {
      this.updatePortal(delta, time);
    }
  }

  updateShootingStar(delta) {
    const shootingStar = this.shootingStar;
    shootingStar.time += delta;
    if (shootingStar.time > shootingStar.next) {
      shootingStar.time = 0;
      shootingStar.next = 7 + Math.random() * 5;
      shootingStar.mesh.position.set(
        -60 + Math.random() * 120,
        50 + Math.random() * 30,
        -120,
      );
      shootingStar.mesh.material.opacity = 0.9;
    }

    if (shootingStar.mesh.material.opacity > 0) {
      shootingStar.mesh.position.x += delta * 60;
      shootingStar.mesh.position.y -= delta * 11;
      shootingStar.mesh.material.opacity = Math.max(
        0,
        shootingStar.mesh.material.opacity - delta * 0.7,
      );
    }
  }

  updatePortal(delta, time) {
    this.portal.disc.rotation.z += delta * 0.8;
    this.portal.disc.material.opacity = 0.55 + Math.sin(time * 3) * 0.15;
    if (this.portal.crownRing) {
      this.portal.crownRing.rotation.z -= delta * 0.45;
    }
    const positions = this.portal.particles.geometry.attributes.position.array;
    for (let index = 0; index < 42; index += 1) {
      const angle = time * 1.2 + (index / 42) * Math.PI * 2;
      const radius = 1.95 + Math.sin(time * 2 + index) * 0.15;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle * 1.7) * 0.4;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.25;
    }
    this.portal.particles.geometry.attributes.position.needsUpdate = true;
  }

  updateGameplay(delta, state, player, camera) {
    this.hazardCooldown = Math.max(0, this.hazardCooldown - delta);
    const playerCenter = player.position.clone().add(new THREE.Vector3(0, 0.8, 0));

    this.crystals.forEach((crystal) => {
      if (crystal.collected) return;
      const distance = crystal.group.position.distanceTo(playerCenter);
      if (distance < 1.25 && (!crystal.hidden || state.attuned)) {
        crystal.collected = true;
        crystal.group.visible = false;
        this.burst(
          crystal.group.position,
          crystal.hidden ? COLORS.tune : 0x9adfff,
          26,
          4.5,
        );
        this.callbacks.onCollect?.(crystal);
      }
    });

    if (this.hazardCooldown <= 0) {
      for (const obstacle of this.obstacles) {
        const disabled =
          obstacle.disabledByAttunement && (state.attuned || state.grace > 0);
        if (disabled) continue;

        const triggerRadius = (obstacle.radius ?? 1) + 0.42;
        if (obstacle.mesh.position.distanceTo(playerCenter) < triggerRadius) {
          this.hazardCooldown = 1.2;
          this.callbacks.onHazard?.(obstacle);
          break;
        }
      }
    }

    const portalPosition = this.portal.group.position
      .clone()
      .add(new THREE.Vector3(0, 1.5, 0));
    if (player.position.distanceTo(portalPosition) < 2) {
      if (this.portal.active) {
        this.callbacks.onWin?.();
      } else if (performance.now() * 0.001 - this.portalHintTime > 3) {
        this.portalHintTime = performance.now() * 0.001;
        this.callbacks.onPortalLocked?.();
      }
    }

    if (!state.tutorialFlags.has("attune")) {
      const firstPhantomEdge = new THREE.Vector3(16, 3, -2);
      if (player.position.distanceTo(firstPhantomEdge) < 3.4) {
        state.tutorialFlags.add("attune");
        this.callbacks.onTutorial?.("attune");
      }
    }

    this.updateZorg(delta, player, camera);
  }

  updateZorg(delta, player, camera) {
    if (!this.zorg) return;

    this.zorg.group.lookAt(
      player.position.x,
      this.zorg.group.position.y + 1,
      player.position.z,
    );
    const distance = this.zorg.group.position.distanceTo(player.position);
    this.zorg.cooldown -= delta;

    if (distance < 4.2) {
      if (this.zorg.cooldown <= 0) {
        this.zorg.lineIndex =
          (this.zorg.lineIndex + 1) % this.level.zorgLines.length;
        this.zorg.cooldown = 4;
      }

      const position = this.zorg.group.position
        .clone()
        .add(new THREE.Vector3(0, 1.9, 0));
      this.callbacks.onZorg?.(
        position,
        camera,
        this.level.zorgLines[this.zorg.lineIndex],
        true,
      );
    } else {
      this.callbacks.onZorg?.(null, camera, "", false);
    }
  }

  activatePortal() {
    if (this.portal.active) return;
    this.portal.active = true;
    const activeColor = this.level.portalFinal?.special
      ? COLORS.crystal
      : COLORS.cord;
    this.portal.ringMaterial.color.setHex(activeColor);
    this.portal.ringMaterial.emissive.setHex(activeColor);
    this.portal.ringMaterial.emissiveIntensity = 1.8;
    this.portal.disc.material.opacity = 0.6;
    this.portal.particles.material.opacity = 0.9;
    this.burst(
      this.portal.group.position.clone().add(new THREE.Vector3(0, 2.3, 0)),
      0x9adfff,
      36,
      5,
    );
  }

  groundCast(position, distance = 2.2) {
    this.scene.updateMatrixWorld(true);
    this.raycaster.ray.origin.copy(position).add(new THREE.Vector3(0, 1, 0));
    this.raycaster.ray.direction.set(0, -1, 0);
    this.raycaster.far = distance + 1;
    const hits = this.raycaster.intersectObjects(this.colliders, false);
    return hits.find((hit) => hit.object.userData.solid) ?? null;
  }

  getCheckpointFromHit(hit) {
    const checkpoint = hit?.object?.userData?.checkpoint;
    const islandGroup = hit?.object?.userData?.islandGroup;
    if (!checkpoint || !islandGroup) return null;

    const position = new THREE.Vector3();
    islandGroup.getWorldPosition(position);
    position.y += 0.35;
    return {
      id: checkpoint.id,
      label: checkpoint.label,
      position,
    };
  }

  reset() {
    this.crystals.forEach((crystal) => {
      crystal.collected = false;
      crystal.group.visible = true;
      if (crystal.hidden) {
        crystal.mesh.material.opacity = 0.16;
        crystal.halo.material.opacity = 0.12;
        crystal.orbit.material.opacity = 0.15;
      }
    });

    this.portal.active = false;
    this.portal.ringMaterial.color.setHex(0x8a86b8);
    this.portal.ringMaterial.emissive.setHex(0x221d44);
    this.portal.ringMaterial.emissiveIntensity = 1;
    this.portal.disc.material.opacity = 0;
    this.portal.particles.material.opacity = 0;
    this.portalHintTime = -Infinity;
    this.hazardCooldown = 0;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose?.());
      } else {
        object.material?.dispose?.();
      }
    });
    Object.values(this.textures).forEach((texture) => texture.dispose?.());
    this.colliders.length = 0;
    this.phantoms.length = 0;
    this.crystals.length = 0;
    this.obstacles.length = 0;
  }
}
