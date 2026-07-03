import * as THREE from "three";
import { COLORS } from "./config.js?v=3.0.3";

export class PlayerController {
  constructor({ scene, config, audio }) {
    this.scene = scene;
    this.config = config;
    this.audio = audio;
    this.group = new THREE.Group();
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.squash = 1;
    this.lastCheckpointId = null;
    this.lastGroundObject = null;
    this.buildModel();
  }

  buildModel() {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.5, 6, 14),
      new THREE.MeshStandardMaterial({
        color: 0xf4efe6,
        roughness: 0.55,
      }),
    );
    body.position.y = 0.62;
    this.group.add(body);
    this.body = body;

    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0x14243d,
        roughness: 0.15,
        metalness: 0.1,
        emissive: 0x1a3a66,
        emissiveIntensity: 0.6,
      }),
    );
    visor.scale.set(1, 0.8, 0.7);
    visor.position.set(0, 0.92, 0.22);
    this.group.add(visor);
    this.visor = visor;

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.42, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x35e0c0,
        roughness: 0.6,
      }),
    );
    backpack.position.set(0, 0.7, -0.3);
    this.group.add(backpack);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5),
      new THREE.MeshStandardMaterial({ color: 0xcccccc }),
    );
    antenna.position.set(0.1, 1.05, -0.3);
    this.group.add(antenna);

    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({
        color: COLORS.tune,
        emissive: COLORS.tune,
        emissiveIntensity: 2.5,
      }),
    );
    antennaTip.position.set(0.1, 1.24, -0.3);
    this.group.add(antennaTip);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;

    this.scene.add(this.group, this.shadow);
  }

  reset(position) {
    this.position.fromArray(position);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.squash = 1;
    this.group.rotation.y = Math.PI;
    this.group.position.copy(this.position);
  }

  setAttuned(attuned) {
    this.visor.material.emissive.setHex(attuned ? COLORS.tune : 0x1a3a66);
    this.visor.material.emissiveIntensity = attuned ? 1.5 : 0.6;
  }

  update(delta, input, camera, world, callbacks = {}) {
    if (input.consumeJump()) {
      this.jumpBufferTimer = this.config.physics.jumpBuffer;
    }

    const axes = input.getMoveAxes();
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();
    const cameraRight = new THREE.Vector3(-cameraForward.z, 0, cameraForward.x);
    const desiredDirection = cameraForward
      .multiplyScalar(axes.y)
      .addScaledVector(cameraRight, axes.x);

    if (desiredDirection.lengthSq() > 1) desiredDirection.normalize();
    const hasInput = desiredDirection.lengthSq() > 0.001;
    const targetVelocity = desiredDirection.multiplyScalar(
      this.config.physics.moveSpeed,
    );

    const substepCount = Math.max(
      1,
      Math.ceil(delta / this.config.physics.physicsStep),
    );
    const step = delta / substepCount;

    for (let index = 0; index < substepCount; index += 1) {
      this.simulateStep(step, targetVelocity, hasInput, world, callbacks);
    }

    this.updateVisual(delta);
    this.updateShadow(world);
  }

  simulateStep(delta, targetVelocity, hasInput, world, callbacks) {
    const rate = hasInput
      ? this.config.physics.acceleration
      : this.config.physics.friction;

    this.velocity.x = THREE.MathUtils.damp(
      this.velocity.x,
      targetVelocity.x,
      rate / 6,
      delta * 6,
    );
    this.velocity.z = THREE.MathUtils.damp(
      this.velocity.z,
      targetVelocity.z,
      rate / 6,
      delta * 6,
    );

    this.velocity.y -= this.config.physics.gravity * delta;
    this.coyoteTimer -= delta;
    this.jumpBufferTimer -= delta;

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = this.config.physics.jumpVelocity;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.grounded = false;
      this.squash = 1.28;
      this.audio.jump();
      callbacks.onJump?.();
    }

    this.position.addScaledVector(this.velocity, delta);
    const groundHit = world.groundCast(
      this.position,
      1.4 + Math.max(0, -this.velocity.y) * delta,
    );
    const groundDelta = groundHit ? this.position.y - groundHit.point.y : Infinity;
    const landingTolerance =
      0.12 + Math.max(0, -this.velocity.y) * delta + 0.05;

    if (
      groundHit &&
      this.velocity.y <= 0 &&
      groundDelta >= -0.08 &&
      groundDelta <= landingTolerance
    ) {
      const wasGrounded = this.grounded;
      this.grounded = true;
      this.coyoteTimer = this.config.physics.coyoteTime;
      this.position.y = groundHit.point.y;
      this.velocity.y = 0;
      this.lastGroundObject = groundHit.object;

      if (!wasGrounded) {
        this.squash = 0.68;
        this.audio.land();
        world.burst(this.position.clone(), 0x9adfff, 8, 2.2);
        const checkpoint = world.getCheckpointFromHit(groundHit);
        if (checkpoint && checkpoint.id !== this.lastCheckpointId) {
          this.lastCheckpointId = checkpoint.id;
          callbacks.onCheckpoint?.(checkpoint);
        }
      }
    } else {
      if (this.grounded) this.coyoteTimer = this.config.physics.coyoteTime;
      this.grounded = false;
      this.lastGroundObject = null;
    }
  }

  updateVisual(delta) {
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > 0.6) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      const current = this.group.rotation.y;
      const difference =
        ((yaw - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) %
          (Math.PI * 2) -
        Math.PI;
      this.group.rotation.y =
        current + difference * Math.min(1, delta * 9);
    }

    this.squash = THREE.MathUtils.damp(this.squash, 1, 10, delta);
    const bob = this.grounded
      ? Math.sin(performance.now() * 0.012) *
        Math.min(1, horizontalSpeed / this.config.physics.moveSpeed) *
        0.05
      : 0;

    this.group.scale.set(2 - this.squash, this.squash, 2 - this.squash);
    this.group.position.copy(this.position);
    this.group.position.y += bob;
  }

  updateShadow(world) {
    const hit = world.groundCast(this.position, 24);
    if (!hit) {
      this.shadow.visible = false;
      return;
    }

    this.shadow.visible = true;
    this.shadow.position.set(this.position.x, hit.point.y + 0.03, this.position.z);
    const scale = Math.max(0.2, 1 - (this.position.y - hit.point.y) / 9);
    this.shadow.scale.setScalar(scale);
    this.shadow.material.opacity = 0.35 * scale;
  }

  updateCamera(delta, camera, cameraConfig, instant = false) {
    const offset = new THREE.Vector3(...cameraConfig.offset);
    const desiredPosition = this.position.clone().add(offset);

    if (instant) {
      camera.position.copy(desiredPosition);
    } else {
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredPosition.x,
        cameraConfig.damping,
        delta,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredPosition.y,
        cameraConfig.damping,
        delta,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredPosition.z,
        cameraConfig.damping,
        delta,
      );
    }

    const target = this.position
      .clone()
      .add(new THREE.Vector3(0, cameraConfig.targetHeight, 0));
    camera.lookAt(target);
  }
}
