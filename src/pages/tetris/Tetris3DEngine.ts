import { Easing, Tween, Group as TweenGroup } from '@tweenjs/tween.js';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  COLS,
  getGhostY,
  getPieceCells,
  ROWS,
  type TetrisEvent,
  type TetrisSpecial,
  type TetrisState,
} from '@/lib/tetris';
import {
  createTetrisMaterialLibrary,
  disposeTetrisMaterialLibrary,
  type TetrisMaterialLibrary,
} from './tetrisMaterials';

export interface TetrisEngineController {
  dispose(): void;
  setTheme?(theme: 'glass' | 'neon'): void;
  sync(state: TetrisState, events?: TetrisEvent[]): void;
}

export interface TetrisEngineFactoryOptions {
  onReady?: () => void;
}

const CELL_STEP = 1.04;
const BLOCK_SIZE = 0.9;
const BLOCK_DEPTH = 0.74;
const BOARD_WIDTH = COLS * CELL_STEP;
const BOARD_HEIGHT = ROWS * CELL_STEP;
const BOARD_Z = 0;
const GHOST_Z = -0.08;
const ACTIVE_Z = 0.1;
const FRAME_THICKNESS = 0.34;

type BlockMesh = Mesh<RoundedBoxGeometry>;

export class Tetris3DEngine implements TetrisEngineController {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-8, 8, 12, -12, 0.1, 120);
  private readonly renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  private readonly tweens = new TweenGroup();
  private readonly blockGeometry = new RoundedBoxGeometry(
    BLOCK_SIZE,
    BLOCK_SIZE,
    BLOCK_DEPTH,
    4,
    0.075,
  );
  private readonly floorGeometry = new PlaneGeometry(
    BOARD_WIDTH + 2.8,
    BOARD_HEIGHT + 2.8,
  );
  private readonly frameGeometries = [
    new BoxGeometry(FRAME_THICKNESS, BOARD_HEIGHT + 0.9, 0.42),
    new BoxGeometry(BOARD_WIDTH + 1.0, FRAME_THICKNESS, 0.42),
  ];
  private readonly gridGeometry = this.createGridGeometry();
  private readonly gridMaterial = new LineBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.18,
    blending: AdditiveBlending,
  });
  private readonly backgroundParticles = this.createBackgroundParticles();
  private readonly materials: TetrisMaterialLibrary =
    createTetrisMaterialLibrary();
  private readonly boardGroup = new Group();
  private readonly activeGroup = new Group();
  private readonly ghostGroup = new Group();
  private readonly arenaGroup = new Group();
  private readonly effectsGroup = new Group();
  private readonly lineGlowMaterial = new MeshBasicMaterial({
    color: '#67e8f9',
    transparent: true,
    opacity: 0.58,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private lastState: TetrisState | null = null;
  private lastRenderTime = 0;
  private shake = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: TetrisEngineFactoryOptions = {},
  ) {
    this.configureRenderer();
    this.configureScene();
    this.buildArena();

    this.scene.add(
      this.arenaGroup,
      this.boardGroup,
      this.ghostGroup,
      this.activeGroup,
      this.effectsGroup,
    );

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.render);
    this.options.onReady?.();
  }

  sync(state: TetrisState, events: TetrisEvent[] = []): void {
    const previousState = this.lastState;
    this.lastState = state;
    this.rebuildBoard(state);
    this.rebuildGhost(state);
    this.rebuildActivePiece(state);
    this.animateStateChange(events, previousState, state);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.tweens.removeAll();
    this.resizeObserver.disconnect();
    this.clearGroup(this.boardGroup);
    this.clearGroup(this.activeGroup);
    this.clearGroup(this.ghostGroup);
    this.disposeEffects();
    this.clearGroup(this.arenaGroup);
    this.blockGeometry.dispose();
    this.floorGeometry.dispose();
    for (const geometry of this.frameGeometries) geometry.dispose();
    this.lineGlowMaterial.dispose();
    this.gridGeometry.dispose();
    this.gridMaterial.dispose();
    this.backgroundParticles.geometry.dispose();
    (this.backgroundParticles.material as PointsMaterial).dispose();
    disposeTetrisMaterialLibrary(this.materials);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private configureRenderer(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new Color('#020617'));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.className = 'tetris-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.renderer.domElement);
  }

  private configureScene(): void {
    this.scene.background = new Color('#020617');
    this.camera.position.set(0, -18, 18);
    this.camera.lookAt(0, 0, 0);

    const ambient = new AmbientLight('#dbeafe', 1.2);
    const keyLight = new DirectionalLight('#f8fafc', 2.15);
    keyLight.position.set(4.8, -8, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 13;
    keyLight.shadow.camera.bottom = -13;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 42;
    keyLight.shadow.bias = -0.00028;

    const fillLight = new DirectionalLight('#67e8f9', 0.95);
    fillLight.position.set(-7, 4, 9);
    const energyLight = new PointLight('#22d3ee', 1.4, 26, 2);
    energyLight.position.set(0, -3.5, 6);

    this.scene.add(ambient, keyLight, keyLight.target, fillLight, energyLight);
  }

  private buildArena(): void {
    const floor = new Mesh(this.floorGeometry, this.materials.floor);
    floor.position.z = -0.6;
    floor.receiveShadow = true;
    this.arenaGroup.add(floor);

    const [verticalGeometry, horizontalGeometry] = this.frameGeometries;
    const left = new Mesh(verticalGeometry, this.materials.glass);
    left.position.set(-BOARD_WIDTH / 2 - 0.34, 0, -0.25);
    const right = new Mesh(verticalGeometry, this.materials.glass);
    right.position.set(BOARD_WIDTH / 2 + 0.34, 0, -0.25);
    const top = new Mesh(horizontalGeometry, this.materials.glass);
    top.position.set(0, BOARD_HEIGHT / 2 + 0.34, -0.25);
    const bottom = new Mesh(horizontalGeometry, this.materials.glass);
    bottom.position.set(0, -BOARD_HEIGHT / 2 - 0.34, -0.25);

    for (const frame of [left, right, top, bottom]) {
      frame.castShadow = true;
      frame.receiveShadow = true;
      this.arenaGroup.add(frame);
    }

    const grid = new LineSegments(this.gridGeometry, this.gridMaterial);
    grid.position.z = -0.36;
    this.arenaGroup.add(grid, this.backgroundParticles);
  }

  private createGridGeometry(): BufferGeometry {
    const points: number[] = [];
    const left = -BOARD_WIDTH / 2;
    const right = BOARD_WIDTH / 2;
    const top = BOARD_HEIGHT / 2;
    const bottom = -BOARD_HEIGHT / 2;

    for (let col = 0; col <= COLS; col++) {
      const x = left + col * CELL_STEP;
      points.push(x, bottom, 0, x, top, 0);
    }
    for (let row = 0; row <= ROWS; row++) {
      const y = top - row * CELL_STEP;
      points.push(left, y, 0, right, y, 0);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
    return geometry;
  }

  private createBackgroundParticles(): Points {
    const count = 120;
    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
      positions.push(
        (Math.random() - 0.5) * (BOARD_WIDTH + 8),
        (Math.random() - 0.5) * (BOARD_HEIGHT + 8),
        -1.8 - Math.random() * 4,
      );
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return new Points(
      geometry,
      new PointsMaterial({
        color: '#38bdf8',
        size: 0.045,
        transparent: true,
        opacity: 0.38,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
  }

  private rebuildBoard(state: TetrisState): void {
    this.clearGroup(this.boardGroup);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const value = state.board[row][col];
        if (!value) continue;
        const block = this.createBlock(value, false, null);
        block.position.copy(gridToWorld(col, row, BOARD_Z));
        this.boardGroup.add(block);
      }
    }
  }

  private rebuildActivePiece(state: TetrisState): void {
    this.clearGroup(this.activeGroup);
    if (state.status === 'over') return;

    for (const { x, y } of getPieceCells(
      state.piece,
      state.rot,
      state.px,
      state.py,
    )) {
      if (y < 0) continue;
      const block = this.createBlock(
        state.piece + 1,
        false,
        state.activeSpecial,
      );
      block.position.copy(gridToWorld(x, y, ACTIVE_Z));
      this.activeGroup.add(block);
    }
  }

  private rebuildGhost(state: TetrisState): void {
    this.clearGroup(this.ghostGroup);
    if (state.status !== 'playing' && state.status !== 'paused') return;

    const ghostY = getGhostY(state);
    for (const { x, y } of getPieceCells(
      state.piece,
      state.rot,
      state.px,
      ghostY,
    )) {
      if (y < 0) continue;
      const block = this.createBlock(1, true, null);
      block.position.copy(gridToWorld(x, y, GHOST_Z));
      block.scale.setScalar(0.96);
      this.ghostGroup.add(block);
    }
  }

  setTheme(theme: 'glass' | 'neon'): void {
    const neon = theme === 'neon';
    this.scene.background = new Color(neon ? '#050314' : '#020617');
    this.gridMaterial.color.set(neon ? '#a78bfa' : '#38bdf8');
    this.gridMaterial.opacity = neon ? 0.26 : 0.18;
  }

  private createBlock(
    colorIndex: number,
    ghost: boolean,
    special: TetrisSpecial | null,
  ): BlockMesh {
    const material = ghost
      ? this.materials.ghost
      : special
        ? this.materials.specials[special]
        : (this.materials.blocks[colorIndex - 1] ?? this.materials.blocks[0]);
    const block = new Mesh(this.blockGeometry, material);
    block.castShadow = !ghost;
    block.receiveShadow = true;
    return block;
  }

  private animateStateChange(
    events: TetrisEvent[],
    previousState: TetrisState | null,
    state: TetrisState,
  ): void {
    const moveEvent = events.find((event) => event.type === 'piece_moved');
    const rotateEvent = events.find((event) => event.type === 'piece_rotated');
    const lockEvent = events.find((event) => event.type === 'piece_locked');
    const clearEvent = events.find((event) => event.type === 'lines_cleared');

    if (moveEvent?.type === 'piece_moved') {
      const from = gridToWorld(moveEvent.from.px, moveEvent.from.py, 0);
      const to = gridToWorld(moveEvent.to.px, moveEvent.to.py, 0);
      this.activeGroup.position.copy(from.sub(to));
      new Tween(this.activeGroup.position, this.tweens)
        .to({ x: 0, y: 0, z: 0 }, moveEvent.fast ? 80 : 115)
        .easing(Easing.Quadratic.Out)
        .start();
    } else {
      this.activeGroup.position.set(0, 0, 0);
    }

    if (rotateEvent?.type === 'piece_rotated') {
      this.activeGroup.scale.setScalar(0.92);
      new Tween(this.activeGroup.scale, this.tweens)
        .to({ x: 1, y: 1, z: 1 }, 125)
        .easing(Easing.Back.Out)
        .start();
    } else {
      this.activeGroup.scale.setScalar(1);
    }

    if (lockEvent?.type === 'piece_locked') {
      this.shake = Math.min(
        0.16,
        0.035 + (lockEvent.hardDropDistance ?? 0) * 0.006,
      );
      this.pulseLockedRows(lockEvent.rows);
    }

    if (moveEvent?.type === 'piece_moved' && moveEvent.fast) {
      this.spawnHardDropTrail(moveEvent);
    }

    if (clearEvent?.type === 'lines_cleared') {
      this.spawnLineClearEffect(clearEvent.rows);
    }

    if (!previousState || previousState.status !== state.status) {
      this.ghostGroup.visible =
        state.status === 'playing' || state.status === 'paused';
    }
  }

  private pulseLockedRows(rows: number[]): void {
    if (rows.length === 0) return;
    for (const child of this.boardGroup.children) {
      if (!(child instanceof Mesh)) continue;
      const row = worldToRow(child.position.y);
      if (!rows.includes(row)) continue;
      child.scale.setScalar(1.08);
      new Tween(child.scale, this.tweens)
        .to({ x: 1, y: 1, z: 1 }, 160)
        .easing(Easing.Quadratic.Out)
        .start();
    }
  }

  private spawnHardDropTrail(
    event: Extract<TetrisEvent, { type: 'piece_moved' }>,
  ): void {
    const distance = Math.max(1, event.to.py - event.from.py);
    for (const { x, y } of getPieceCells(
      event.to.piece,
      event.to.rot,
      event.to.px,
      event.to.py,
    )) {
      if (y < 0) continue;
      const material = new MeshBasicMaterial({
        color: '#bae6fd',
        transparent: true,
        opacity: 0.24,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const trail = new Mesh(
        new BoxGeometry(
          BLOCK_SIZE * 0.62,
          Math.min(distance * CELL_STEP, 6),
          0.08,
        ),
        material,
      );
      const from = gridToWorld(x, y - distance / 2, ACTIVE_Z - 0.22);
      trail.position.copy(from);
      this.effectsGroup.add(trail);
      new Tween(trail.scale, this.tweens)
        .to({ x: 0.55, y: 0.18, z: 0.55 }, 180)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => {
          trail.removeFromParent();
          trail.geometry.dispose();
          material.dispose();
        })
        .start();
    }
  }

  private spawnLineClearEffect(rows: number[]): void {
    for (const row of rows) {
      this.spawnLineFlash(row);
      this.spawnLineParticles(row);
    }
  }

  private spawnLineFlash(row: number): void {
    const center = (COLS - 1) / 2;
    for (let col = 0; col < COLS; col++) {
      const flash = new Mesh(this.blockGeometry, this.lineGlowMaterial);
      flash.position.copy(gridToWorld(col, row, ACTIVE_Z + 0.28));
      flash.scale.setScalar(0.55);
      this.effectsGroup.add(flash);

      const delay = Math.abs(col - center) * 24;
      new Tween(flash.scale, this.tweens)
        .delay(delay)
        .to({ x: 1.42, y: 1.42, z: 0.42 }, 170)
        .easing(Easing.Cubic.Out)
        .chain(
          new Tween(flash.scale, this.tweens)
            .to({ x: 0.06, y: 0.06, z: 0.06 }, 180)
            .easing(Easing.Quadratic.In)
            .onComplete(() => flash.removeFromParent()),
        )
        .start();
    }
  }

  private spawnLineParticles(row: number): void {
    const count = 80;
    const positions: number[] = [];
    const velocities: number[] = [];
    const originY = gridToWorld(0, row, 0).y;

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * BOARD_WIDTH;
      const direction = Math.sign(spread || Math.random() - 0.5);
      positions.push(
        spread * 0.18,
        originY + (Math.random() - 0.5) * 0.5,
        ACTIVE_Z + 0.58,
      );
      velocities.push(
        direction * (0.018 + Math.random() * 0.052),
        (Math.random() - 0.5) * 0.022,
        0.01 + Math.random() * 0.036,
      );
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: '#7dd3fc',
      size: 0.105,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const particles = new Points(geometry, material);
    particles.userData.velocities = velocities;
    particles.userData.life = 1;
    this.effectsGroup.add(particles);
  }

  private clearGroup(group: Group): void {
    for (const child of [...group.children]) {
      child.removeFromParent();
    }
  }

  private disposeEffects(): void {
    for (const child of [...this.effectsGroup.children]) {
      child.removeFromParent();
      if (child instanceof Mesh) {
        if (child.geometry !== this.blockGeometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const material of child.material) material.dispose();
        } else if (child.material !== this.lineGlowMaterial) {
          child.material.dispose();
        }
      }
      if (child instanceof Points) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const material of child.material) material.dispose();
        } else {
          child.material.dispose();
        }
      }
    }
  }

  private updateParticles(deltaMs: number): void {
    const delta = Math.min(32, deltaMs);
    for (const child of [...this.effectsGroup.children]) {
      if (!(child instanceof Points)) continue;
      const positions = child.geometry.getAttribute('position');
      const array = positions.array;
      const velocities = child.userData.velocities as number[];
      for (let i = 0; i < array.length; i += 3) {
        array[i] += velocities[i] * delta;
        array[i + 1] += velocities[i + 1] * delta;
        array[i + 2] += velocities[i + 2] * delta;
      }
      positions.needsUpdate = true;

      child.userData.life = Math.max(
        0,
        (child.userData.life as number) - delta / 520,
      );
      const material = child.material as PointsMaterial;
      material.opacity = child.userData.life as number;
      if (material.opacity <= 0.02) {
        child.removeFromParent();
        child.geometry.dispose();
        material.dispose();
      }
    }
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const aspect = width / height;
    const verticalSize = BOARD_HEIGHT + 4.2;
    const horizontalSize = verticalSize * aspect;
    this.camera.left = -horizontalSize / 2;
    this.camera.right = horizontalSize / 2;
    this.camera.top = verticalSize / 2;
    this.camera.bottom = -verticalSize / 2;
    this.camera.zoom = width < 720 ? 0.86 : 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly render = (time: number): void => {
    this.animationFrame = requestAnimationFrame(this.render);
    this.tweens.update(time);
    this.updateParticles(this.lastRenderTime ? time - this.lastRenderTime : 16);
    this.lastRenderTime = time;
    this.backgroundParticles.rotation.z = Math.sin(time * 0.00018) * 0.04;

    if (this.shake > 0.001) {
      this.camera.position.x = Math.sin(time * 0.05) * this.shake;
      this.camera.position.y = -18 + Math.cos(time * 0.045) * this.shake;
      this.shake *= 0.86;
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.x = 0;
      this.camera.position.y = -18;
      this.camera.lookAt(0, 0, 0);
    }

    this.renderer.render(this.scene, this.camera);
  };
}

function gridToWorld(col: number, row: number, z: number): Vector3 {
  return new Vector3(
    (col - COLS / 2 + 0.5) * CELL_STEP,
    (ROWS / 2 - row - 0.5) * CELL_STEP,
    z,
  );
}

function worldToRow(y: number): number {
  return Math.round(ROWS / 2 - 0.5 - y / CELL_STEP);
}
