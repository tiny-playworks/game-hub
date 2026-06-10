import { Easing, Tween, Group as TweenGroup } from '@tweenjs/tween.js';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCubieCoordinates, getCubieFaceColors } from './cubeModel';
import {
  belongsToLayer,
  type CubeAxis,
  chooseGestureAxis,
  getResponsiveCameraZoom,
  HALF_PI,
  snapAngle,
  snapCoordinate,
} from './gestureMath';
import { RUBIKS_LIGHTING } from './lighting';
import {
  createRubiksMaterialLibrary,
  disposeRubiksMaterialLibrary,
} from './stickerTexture';

const CUBIE_SIZE = 0.94;
const CUBIE_STEP = 1.04;
const LAYER_EPSILON = 0.12;
const DRAG_LOCK_DISTANCE = 6;
const SCRAMBLE_MOVES = 20;

type Cubie = Mesh<RoundedBoxGeometry>;

interface ActiveDrag {
  angle: number;
  cubie: Cubie;
  normal: Vector3;
  origin: Vector3;
  pointerId: number;
  start: Vector2;
  axis?: CubeAxis;
  pivot?: Object3D;
  screenDirection?: Vector2;
  selected?: Cubie[];
}

interface EngineOptions {
  onBusyChange?: (busy: boolean) => void;
  onStatusChange?: (status: string) => void;
}

export class RubiksCubeEngine {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.1, 100);
  private readonly renderer = new WebGLRenderer({
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly controls = new OrbitControls(
    this.camera,
    this.renderer.domElement,
  );
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly tweens = new TweenGroup();
  private readonly geometry = new RoundedBoxGeometry(
    CUBIE_SIZE,
    CUBIE_SIZE,
    CUBIE_SIZE,
    4,
    0.075,
  );
  private readonly materials = createRubiksMaterialLibrary(this.renderer);
  private readonly floorGeometry = new PlaneGeometry(80, 80);
  private readonly floorMaterial = new MeshStandardMaterial({
    color: '#111827',
    metalness: 0.05,
    roughness: 0.82,
  });
  private readonly resizeObserver: ResizeObserver;
  private cubies: Cubie[] = [];
  private activeDrag: ActiveDrag | null = null;
  private activePivot: Object3D | null = null;
  private animationFrame = 0;
  private busy = false;
  private operationToken = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: EngineOptions = {},
  ) {
    this.configureRenderer();
    this.configureScene();
    this.configureControls();
    this.buildCubies();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.render);
  }

  scramble = (): void => {
    if (this.busy) return;

    const token = ++this.operationToken;
    this.setBusy(true);
    this.options.onStatusChange?.('正在打乱');
    this.runScrambleMove(0, undefined, token);
  };

  reset = (): void => {
    this.operationToken++;
    this.tweens.removeAll();
    this.cancelPointerDrag();
    this.clearCubies();
    this.buildCubies();
    this.controls.reset();
    this.setBusy(false);
    this.options.onStatusChange?.('已复原');
  };

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.operationToken++;
    this.tweens.removeAll();
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.controls.dispose();
    this.clearCubies();
    this.geometry.dispose();
    this.floorGeometry.dispose();
    this.floorMaterial.dispose();
    disposeRubiksMaterialLibrary(this.materials);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private configureRenderer(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.className = 'rubiks-canvas';
    this.renderer.domElement.setAttribute('aria-label', '可交互的三阶 3D 魔方');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.style.touchAction = 'none';
    this.host.appendChild(this.renderer.domElement);
  }

  private configureScene(): void {
    this.scene.background = new Color('#090e18');

    this.camera.position.set(6.2, 5.1, 7.2);
    this.camera.lookAt(0, 0, 0);

    const ambient = new AmbientLight(
      RUBIKS_LIGHTING.ambient.color,
      RUBIKS_LIGHTING.ambient.intensity,
    );
    this.scene.add(ambient);

    const keyLight = new DirectionalLight(
      RUBIKS_LIGHTING.key.color,
      RUBIKS_LIGHTING.key.intensity,
    );
    keyLight.position.set(...RUBIKS_LIGHTING.key.position);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.bias = -0.00035;

    const fillLight = new DirectionalLight(
      RUBIKS_LIGHTING.fill.color,
      RUBIKS_LIGHTING.fill.intensity,
    );
    fillLight.position.set(...RUBIKS_LIGHTING.fill.position);
    fillLight.castShadow = false;
    this.scene.add(keyLight, keyLight.target, fillLight, fillLight.target);

    const floor = new Mesh(this.floorGeometry, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.72;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private configureControls(): void {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 12;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI - 0.25;
    this.controls.target.set(0, 0, 0);

    // 左键由魔方层拖拽独占；右键只负责 OrbitControls 视角旋转。
    this.controls.mouseButtons.LEFT = MOUSE.PAN;
    this.controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE;
    this.controls.touches.ONE = TOUCH.PAN;
    this.controls.touches.TWO = TOUCH.DOLLY_ROTATE;
    this.controls.update();
    this.controls.saveState();
  }

  private buildCubies(): void {
    for (const coordinate of createCubieCoordinates()) {
      const faceMaterials = getCubieFaceColors(coordinate).map((color) => {
        const material = this.materials.get(color);
        if (!material) throw new Error(`缺少魔方材质: ${color}`);
        return material;
      });
      const cubie = new Mesh(this.geometry, faceMaterials);
      cubie.position.set(
        coordinate.x * CUBIE_STEP,
        coordinate.y * CUBIE_STEP,
        coordinate.z * CUBIE_STEP,
      );
      cubie.castShadow = true;
      cubie.receiveShadow = true;
      cubie.userData.isCubie = true;
      this.cubies.push(cubie);
      this.scene.add(cubie);
    }
  }

  private clearCubies(): void {
    for (const cubie of this.cubies) {
      cubie.removeFromParent();
    }
    this.cubies = [];
    this.activePivot?.removeFromParent();
    this.activePivot = null;
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
  }

  private unbindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerUp);
    canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.busy || this.activeDrag) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.raycaster.intersectObjects(this.cubies, false)[0];
    if (!hit?.face || !(hit.object instanceof Mesh)) return;

    const normal = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld)
      .normalize();

    this.activeDrag = {
      angle: 0,
      cubie: hit.object as Cubie,
      normal,
      origin: hit.point.clone(),
      pointerId: event.pointerId,
      start: new Vector2(event.clientX, event.clientY),
    };
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const drag = this.activeDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const pointerDelta = new Vector2(
      event.clientX - drag.start.x,
      event.clientY - drag.start.y,
    );

    if (!drag.axis) {
      if (pointerDelta.length() < DRAG_LOCK_DISTANCE) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      const match = chooseGestureAxis({
        camera: this.camera,
        drag: pointerDelta,
        normal: drag.normal,
        origin: drag.origin,
        viewport: { height: rect.height, width: rect.width },
      });
      const cubieWorldPosition = drag.cubie.getWorldPosition(new Vector3());
      const layerCoordinate = snapCoordinate(
        cubieWorldPosition[match.axis],
        CUBIE_STEP,
      );
      const selected = this.selectLayer(match.axis, layerCoordinate);
      const pivot = this.attachLayerToPivot(selected);

      drag.axis = match.axis;
      drag.screenDirection = match.screenDirection;
      drag.selected = selected;
      drag.pivot = pivot;
      this.activePivot = pivot;
      this.options.onStatusChange?.('转动中');
    }

    if (!drag.axis || !drag.pivot || !drag.screenDirection) return;

    const quarterTurnPixels = MathUtils.clamp(
      Math.min(
        this.renderer.domElement.clientWidth,
        this.renderer.domElement.clientHeight,
      ) * 0.22,
      96,
      180,
    );
    drag.angle = MathUtils.clamp(
      pointerDelta.dot(drag.screenDirection) * (HALF_PI / quarterTurnPixels),
      -Math.PI * 2,
      Math.PI * 2,
    );
    drag.pivot.rotation[drag.axis] = drag.angle;
    event.preventDefault();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const drag = this.activeDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (!drag.axis || !drag.pivot || !drag.selected || !drag.screenDirection) {
      this.cancelPointerDrag();
      return;
    }

    const { axis, pivot, selected } = drag;
    const targetAngle = snapAngle(drag.angle);
    this.activeDrag = null;
    this.releasePointer(event.pointerId);
    this.setBusy(true);
    this.options.onStatusChange?.('自动对齐');

    this.animatePivot(
      pivot,
      selected,
      axis,
      drag.angle,
      targetAngle,
      190,
      () => {
        this.controls.enabled = true;
        this.setBusy(false);
        this.options.onStatusChange?.('可操作');
      },
    );
  };

  private selectLayer(axis: CubeAxis, layerCoordinate: number): Cubie[] {
    this.scene.updateMatrixWorld(true);

    // 不保存层索引：每次都从 Cubie 当前世界坐标动态筛选目标层。
    return this.cubies.filter((cubie) =>
      belongsToLayer(
        cubie.getWorldPosition(new Vector3()),
        axis,
        layerCoordinate,
        LAYER_EPSILON,
      ),
    );
  }

  private attachLayerToPivot(selected: Cubie[]): Object3D {
    const pivot = new Object3D();
    this.scene.add(pivot);
    pivot.updateMatrixWorld(true);

    // attach 会自动保留 Cubie 的世界矩阵，避免手工组合位置和四元数。
    for (const cubie of selected) {
      pivot.attach(cubie);
    }

    return pivot;
  }

  private animatePivot(
    pivot: Object3D,
    selected: Cubie[],
    axis: CubeAxis,
    from: number,
    to: number,
    duration: number,
    onComplete: () => void,
  ): void {
    const state = { angle: from };
    pivot.rotation[axis] = from;

    new Tween(state, this.tweens)
      .to({ angle: to }, duration)
      .easing(Easing.Cubic.Out)
      .onUpdate(() => {
        pivot.rotation[axis] = state.angle;
      })
      .onComplete(() => {
        this.detachLayerFromPivot(pivot, selected);
        onComplete();
      })
      .start();
  }

  private detachLayerFromPivot(pivot: Object3D, selected: Cubie[]): void {
    pivot.updateMatrixWorld(true);
    for (const cubie of selected) {
      this.scene.attach(cubie);
    }
    pivot.removeFromParent();
    if (this.activePivot === pivot) this.activePivot = null;

    for (const cubie of this.cubies) {
      cubie.position.set(
        snapCoordinate(cubie.position.x, CUBIE_STEP),
        snapCoordinate(cubie.position.y, CUBIE_STEP),
        snapCoordinate(cubie.position.z, CUBIE_STEP),
      );
      cubie.rotation.set(
        snapAngle(cubie.rotation.x),
        snapAngle(cubie.rotation.y),
        snapAngle(cubie.rotation.z),
      );
      cubie.updateMatrixWorld(true);
    }
  }

  private runScrambleMove(
    index: number,
    previousAxis: CubeAxis | undefined,
    token: number,
  ): void {
    if (token !== this.operationToken) return;
    if (index >= SCRAMBLE_MOVES) {
      this.setBusy(false);
      this.options.onStatusChange?.('打乱完成');
      return;
    }

    const axes: CubeAxis[] = ['x', 'y', 'z'];
    const availableAxes = axes.filter((axis) => axis !== previousAxis);
    const axis =
      availableAxes[Math.floor(Math.random() * availableAxes.length)];
    const sampleCubie =
      this.cubies[Math.floor(Math.random() * this.cubies.length)];
    if (!axis || !sampleCubie) return;

    const layerCoordinate = snapCoordinate(
      sampleCubie.getWorldPosition(new Vector3())[axis],
      CUBIE_STEP,
    );
    const selected = this.selectLayer(axis, layerCoordinate);
    const pivot = this.attachLayerToPivot(selected);
    this.activePivot = pivot;
    const direction = Math.random() < 0.5 ? -1 : 1;

    this.animatePivot(pivot, selected, axis, 0, direction * HALF_PI, 92, () =>
      this.runScrambleMove(index + 1, axis, token),
    );
  }

  private cancelPointerDrag(): void {
    const pointerId = this.activeDrag?.pointerId;
    this.activeDrag = null;
    this.controls.enabled = true;
    if (pointerId !== undefined) this.releasePointer(pointerId);
  }

  private releasePointer(pointerId: number): void {
    const canvas = this.renderer.domElement;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  }

  private setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    this.options.onBusyChange?.(busy);
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.zoom = getResponsiveCameraZoom(this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly render = (time: number): void => {
    this.animationFrame = requestAnimationFrame(this.render);
    this.tweens.update(time);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
