import * as THREE from "three";
import { RoomEnvironment } from
  "three/addons/environments/RoomEnvironment.js";

/* =========================================
   YOUR MEMORIES

   Add a path to src, for example:
   src: "videos/memory-01.mp4"

   Empty src values show decorative placeholders.
   ========================================= */

const MEMORIES = [
  {
    title: "Where our story began",
    date: "Chapter one",
    caption: "The beginning of my favourite story.",
    src: ""
  },
  {
    title: "My favourite smile",
    date: "A day worth keeping",
    caption: "I still remember how happy you made me.",
    src: ""
  },
  {
    title: "Just us",
    date: "Our little world",
    caption: "The world felt quieter with your hand in mine.",
    src: ""
  },
  {
    title: "A little forever",
    date: "The heart of our collection",
    caption: "Some moments stay with you in every version of your life.",
    src: ""
  },
  {
    title: "Our ordinary magic",
    date: "One lovely little day",
    caption: "Nothing grand. Just you, me, and everything I wanted.",
    src: ""
  },
  {
    title: "Another adventure",
    date: "Somewhere with you",
    caption: "The best part of every place was being there together.",
    src: ""
  },
  {
    title: "Still choosing you",
    date: "To all our tomorrows",
    caption: "There is so much more of us still to come.",
    src: ""
  }
];

const $ = id => document.getElementById(id);

const canvas = $("museum");
const keys = new Set();
const touch = new Set();

const reducedMotion = matchMedia(
  "(prefers-reduced-motion: reduce)"
);

let renderer;

try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
} catch (error) {
  $("load-status").textContent =
    "The 3D gallery could not start. Try a browser with WebGL enabled.";
  throw error;
}

renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#161411");
scene.fog = new THREE.Fog("#161411", 18, 38);

const camera = new THREE.PerspectiveCamera(
  48,
  innerWidth / innerHeight,
  0.1,
  70
);

const player = {
  position: new THREE.Vector3(0, 2.7, 10.8),
  yaw: 0,
  pitch: -0.02
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

let entered = false;
let soundOn = false;
let selected = -1;
let tour = null;
let modalFocus = null;
let drag = null;
let playbackTimer = 0;

const exhibits = [];
const clickable = [];

/* =========================================
   MATERIALS AND GENERATED TEXTURES
   ========================================= */

function surfaceTexture(base, variation = 12) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;

  const context = c.getContext("2d");
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 14000; i++) {
    const light = Math.random() > 0.5;

    context.fillStyle = light
      ? `rgba(255,255,255,${variation / 255})`
      : `rgba(0,0,0,${variation / 255})`;

    context.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      1 + Math.random() * 2,
      1 + Math.random() * 2
    );
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

const plasterTexture = surfaceTexture("#e1d9c8", 25);
const stoneTexture = surfaceTexture("#7c776d", 20);
const woodTexture = surfaceTexture("#34251b", 22);

const plaster = new THREE.MeshStandardMaterial({
  map: plasterTexture,
  bumpMap: plasterTexture,
  bumpScale: 0.018,
  roughness: 0.94
});

const stone = new THREE.MeshStandardMaterial({
  map: stoneTexture,
  roughness: 0.84
});

const darkWall = new THREE.MeshStandardMaterial({
  color: "#24211c",
  roughness: 0.9
});

const gold = new THREE.MeshStandardMaterial({
  color: "#b88a35",
  metalness: 0.83,
  roughness: 0.3
});

const goldHighlight = new THREE.MeshStandardMaterial({
  color: "#d6ae58",
  metalness: 0.8,
  roughness: 0.24
});

const darkGold = new THREE.MeshStandardMaterial({
  color: "#695020",
  metalness: 0.8,
  roughness: 0.42
});

const wood = new THREE.MeshStandardMaterial({
  map: woodTexture,
  roughness: 0.6
});

const porcelain = new THREE.MeshStandardMaterial({
  color: "#dad0b9",
  roughness: 0.38
});

const foliage = new THREE.MeshStandardMaterial({
  color: "#263c28",
  roughness: 0.9
});

const lampGlow = new THREE.MeshStandardMaterial({
  color: "#fff0c6",
  emissive: "#ffe4aa",
  emissiveIntensity: 2
});

/* Environment reflections help metallic frames read as gold. */
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentScene = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(environmentScene, 0.04);

scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.32;

environmentScene.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight("#f4ead4", "#30261c", 0.55));

/* =========================================
   GEOMETRY HELPERS
   ========================================= */

function box(w, h, d, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function sphere(radius, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

function cylinder(
  top, bottom, height, material, x, y, z, parent = scene
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, 24),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function tube(points, radius, material, parent) {
  const curve = new THREE.CatmullRomCurve3(points);

  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, radius, 6, false),
    material
  );

  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

/* =========================================
   ROOM: RECESSED DISPLAY INSPIRED BY PHOTO
   ========================================= */

// Main room.
box(26, 0.25, 24, stone, 0, -0.14, 5);
box(26, 8, 0.3, darkWall, 0, 3.8, -2.25);
box(0.3, 8, 24, darkWall, -12, 3.8, 5);
box(0.3, 8, 24, darkWall, 12, 3.8, 5);
box(26, 0.25, 24, darkWall, 0, 7.7, 5);

// Recess interior.
box(9.5, 5.65, 0.2, plaster, 0, 3.08, -1.85);
box(0.18, 5.65, 1.8, plaster, -4.8, 3.08, -0.95);
box(0.18, 5.65, 1.8, plaster, 4.8, 3.08, -0.95);
box(9.8, 0.18, 1.9, plaster, 0, 5.96, -0.95);
box(9.8, 0.22, 1.9, plaster, 0, 0.3, -0.95);

// Thick dark architectural surround.
box(0.5, 6.3, 0.35, darkWall, -5.12, 3.08, 0.12);
box(0.5, 6.3, 0.35, darkWall, 5.12, 3.08, 0.12);
box(10.75, 0.4, 0.35, darkWall, 0, 6.18, 0.12);
box(10.75, 0.33, 0.35, darkWall, 0, 0.04, 0.12);

// Fine brass trim around the niche.
box(0.025, 5.9, 0.035, darkGold, -4.92, 3.08, 0.31);
box(0.025, 5.9, 0.035, darkGold, 4.92, 3.08, 0.31);
box(9.85, 0.025, 0.035, darkGold, 0, 6.02, 0.31);

// Stone floor joints.
const jointMaterial = new THREE.MeshStandardMaterial({
  color: "#57534d",
  roughness: 1
});

for (let x = -12; x <= 12; x += 2.4) {
  box(0.012, 0.003, 22, jointMaterial, x, -0.008, 5);
}

for (let z = -4; z <= 16; z += 2.4) {
  box(24, 0.003, 0.012, jointMaterial, 0, -0.007, z);
}

/* =========================================
   LIGHTING
   ========================================= */

function ceilingSpot(x) {
  cylinder(0.12, 0.12, 0.25, darkGold, x, 5.62, -0.8);
  cylinder(0.095, 0.095, 0.015, lampGlow, x, 5.48, -0.8);

  const light = new THREE.SpotLight(
    "#ffe9c2",
    85,
    12,
    Math.PI / 3.1,
    0.68,
    2
  );

  light.position.set(x, 5.45, -0.65);
  light.target.position.set(x * 0.72, 2.7, -1.75);

  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.025;

  scene.add(light, light.target);
}

ceilingSpot(-3);
ceilingSpot(0);
ceilingSpot(3);

const roomFill = new THREE.PointLight("#efd9b0", 35, 20, 2);
roomFill.position.set(0, 5, 6);
scene.add(roomFill);

function sconce(x) {
  const mount = cylinder(
    0.15, 0.15, 0.06,
    gold, x, 2.6, -1.66
  );

  mount.rotation.x = Math.PI / 2;

  tube([
    new THREE.Vector3(x, 2.6, -1.6),
    new THREE.Vector3(x, 2.58, -1.35),
    new THREE.Vector3(x, 2.83, -1.28)
  ], 0.025, gold, scene);

  sphere(0.075, lampGlow, x, 2.91, -1.28);

  const light = new THREE.PointLight("#ffe2aa", 2.7, 2.5, 2);
  light.position.set(x, 2.95, -1.14);
  scene.add(light);
}

sconce(-1.35);
sconce(1.35);

/* =========================================
   FRAME SHAPES AND ORNAMENTATION
   ========================================= */

function outline(type, width, height) {
  const points = [];
  const steps = type === "rectangle" ? 4 : 100;

  if (type === "rectangle") {
    points.push(
      new THREE.Vector2(-width / 2, -height / 2),
      new THREE.Vector2(width / 2, -height / 2),
      new THREE.Vector2(width / 2, height / 2),
      new THREE.Vector2(-width / 2, height / 2)
    );

    return points;
  }

  for (let i = 0; i < steps; i++) {
    const t = i / steps * Math.PI * 2;

    if (type === "heart") {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

      points.push(new THREE.Vector2(
        x / 32 * width,
        (y + 2.5) / 29 * height
      ));
    } else {
      points.push(new THREE.Vector2(
        Math.cos(t) * width / 2,
        Math.sin(t) * height / 2
      ));
    }
  }

  return points;
}

function shapeFromPoints(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }

  shape.closePath();
  return shape;
}

function frameRing(points, scale, thickness, depth, material, group, z) {
  const outer = points.map(p => p.clone().multiplyScalar(scale));
  const inner = points.map(p =>
    p.clone().multiplyScalar(scale - thickness)
  );

  const shape = shapeFromPoints(outer);
  const hole = new THREE.Path();

  const reversed = inner.slice().reverse();
  hole.moveTo(reversed[0].x, reversed[0].y);

  for (let i = 1; i < reversed.length; i++) {
    hole.lineTo(reversed[i].x, reversed[i].y);
  }

  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 32
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

const beadGeometry = new THREE.SphereGeometry(0.022, 8, 6);

function addScroll(group, x, y, angle, size = 0.1) {
  const points = [];

  for (let i = 0; i <= 28; i++) {
    const t = i / 28 * Math.PI * 3.2;
    const radius = size * (1 - i / 35);

    const sx = Math.cos(t) * radius;
    const sy = Math.sin(t) * radius;

    points.push(new THREE.Vector3(
      x + sx * Math.cos(angle) - sy * Math.sin(angle),
      y + sx * Math.sin(angle) + sy * Math.cos(angle),
      0.13 + Math.sin(i / 28 * Math.PI) * 0.025
    ));
  }

  tube(points, 0.017, goldHighlight, group);
}

function decorateFrame(group, points, width, height, type) {
  // Beaded inner border.
  const closed = points.concat([points[0]]);
  const path = new THREE.CurvePath();

  for (let i = 0; i < closed.length - 1; i++) {
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(closed[i].x * 1.07, closed[i].y * 1.07, 0.13),
      new THREE.Vector3(closed[i + 1].x * 1.07, closed[i + 1].y * 1.07, 0.13)
    ));
  }

  for (let i = 0; i < 65; i++) {
    const bead = new THREE.Mesh(beadGeometry, goldHighlight);
    bead.position.copy(path.getPoint(i / 65));
    group.add(bead);
  }

  // Decorative crests and side scrolls.
  const positions = type === "rectangle"
    ? [
        [-width * .57, height * .55],
        [width * .57, height * .55],
        [-width * .57, -height * .55],
        [width * .57, -height * .55],
        [0, height * .62],
        [0, -height * .62]
      ]
    : [
        [0, height * .63],
        [-width * .59, 0],
        [width * .59, 0],
        [0, -height * .62]
      ];

  positions.forEach(([x, y], i) => {
    addScroll(group, x, y, i * Math.PI / 2);

    const leaf = sphere(
      0.055, goldHighlight, x, y, 0.15, group
    );

    leaf.scale.set(0.65, 1.5, 0.5);
    leaf.rotation.z = i * 0.8;
  });
}

function placeholderTexture(index, title) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;

  const context = c.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 512, 512);

  gradient.addColorStop(0, "#50463b");
  gradient.addColorStop(1, "#171410");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);

  context.textAlign = "center";

  context.fillStyle = "#d7bc82";
  context.font = "italic 100px Georgia";
  context.fillText(String(index + 1).padStart(2, "0"), 256, 245);

  context.font = "20px Georgia";
  context.fillText("a little moment of us", 256, 300);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

/* Positions follow the mixed-frame arrangement in the reference. */
const LAYOUT = [
  { x: -2.85, y: 4.05, w: 1.18, h: 1.55, type: "oval" },
  { x: 0, y: 4.8, w: 1.48, h: 1.02, type: "rectangle" },
  { x: 2.85, y: 4.05, w: 1.18, h: 1.55, type: "oval" },
  { x: 0, y: 3.12, w: 1.15, h: 1.28, type: "heart" },
  { x: -2.85, y: 1.9, w: 1.5, h: 1.1, type: "rectangle" },
  { x: 0, y: 1.48, w: 1.0, h: 1.15, type: "heart" },
  { x: 2.85, y: 1.9, w: 1.5, h: 1.1, type: "rectangle" }
];

function createExhibit(memory, index) {
  const layout = LAYOUT[index];
  const group = new THREE.Group();
  group.position.set(layout.x, layout.y, -1.63);
  scene.add(group);

  const points = outline(layout.type, layout.w, layout.h);

  frameRing(points, 1.28, .12, .09, darkGold, group, 0);
  frameRing(points, 1.2, .12, .12, gold, group, .025);
  frameRing(points, 1.07, .075, .12, goldHighlight, group, .045);

  decorateFrame(group, points, layout.w, layout.h, layout.type);

  const geometry = new THREE.ShapeGeometry(shapeFromPoints(points));
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  // Normalize UV coordinates for the shaped video surface.
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  points.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });

  for (let i = 0; i < positions.count; i++) {
    uv.setXY(
      i,
      (positions.getX(i) - minX) / (maxX - minX),
      (positions.getY(i) - minY) / (maxY - minY)
    );
  }

  uv.needsUpdate = true;

  const placeholder = placeholderTexture(index, memory.title);

  const material = new THREE.MeshBasicMaterial({
    map: placeholder,
    toneMapped: false
  });

  const screen = new THREE.Mesh(geometry, material);
  screen.position.z = .145;
  screen.userData.memoryIndex = index;
  group.add(screen);
  clickable.push(screen);

  const video = document.createElement("video");
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.crossOrigin = "anonymous";

  const item = {
    group,
    screen,
    material,
    placeholder,
    video,
    texture: null,
    url: null,
    source: "",
    retryAt: 0,
    pending: false,
    layout
  };

  exhibits.push(item);

  video.addEventListener("loadeddata", () => {
    if (item.texture) item.texture.dispose();

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;

    // Fill the shape without stretching the video.
    const frameAspect = layout.w / layout.h;
    const videoAspect = video.videoWidth / video.videoHeight;

    if (videoAspect > frameAspect) {
      texture.repeat.x = frameAspect / videoAspect;
      texture.offset.x = (1 - texture.repeat.x) / 2;
    } else {
      texture.repeat.y = videoAspect / frameAspect;
      texture.offset.y = (1 - texture.repeat.y) / 2;
    }

    item.texture = texture;
    material.map = texture;
    material.needsUpdate = true;
  });

  video.addEventListener("error", () => {
    if (selected === index) {
      $("memory-caption").textContent =
        "This video could not load. Check its path or use Add videos.";
    }
  });

  if (memory.src) setSource(index, memory.src);
}

MEMORIES.forEach(createExhibit);

/* =========================================
   BENCH, PLANTS, AND SMALL COUPLE SCULPTURES
   ========================================= */

box(2.35, .12, .53, wood, .1, .79, -.35);
box(2.2, .12, .12, wood, .1, .55, -.35);
box(.18, .42, .36, wood, -.75, .54, -.35);
box(.18, .42, .36, wood, .95, .54, -.35);

function plant(x, z, flower = false) {
  cylinder(.21, .15, .27, porcelain, x, .55, z);
  cylinder(.23, .23, .05, porcelain, x, .69, z);

  for (let i = 0; i < 17; i++) {
    const a = i * 2.4;
    const r = .05 + (i % 4) * .035;

    const leaf = sphere(
      .105,
      foliage,
      x + Math.cos(a) * r,
      .82 + Math.sin(i * 2.1) * .07,
      z + Math.sin(a) * r
    );

    leaf.scale.set(1, .55, .8);

    if (flower && i % 3 === 0) {
      const petalMaterial = new THREE.MeshStandardMaterial({
        color: i % 2 ? "#b87373" : "#d2ae91",
        roughness: .85
      });

      sphere(.045, petalMaterial, leaf.position.x, .91, leaf.position.z);
    }
  }
}

// Small pedestal on the left.
cylinder(.43, .48, .1, porcelain, -4.05, .44, -.7);
cylinder(.29, .34, .6, porcelain, -4.05, .77, -.7);
cylinder(.47, .47, .1, porcelain, -4.05, 1.12, -.7);

plant(-4.05, -.7, true);

// Raise the plant onto the pedestal.
scene.children.slice(-30).forEach(() => {});
// Separate planter at floor level on the right.
plant(4.05, -.7);

function person(x, z, color, dress = false, height = .95) {
  const group = new THREE.Group();
  group.position.set(x, .42, z);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: .62
  });

  const headMaterial = new THREE.MeshStandardMaterial({
    color: "#514b40",
    roughness: .65
  });

  sphere(.075, headMaterial, 0, height - .075, 0, group);

  if (dress) {
    cylinder(.09, .16, .37, material, 0, .48, 0, group);
  } else {
    box(.2, .28, .12, material, 0, .53, 0, group);
  }

  const legHeight = .29;

  cylinder(.025, .026, legHeight, material, -.055, .16, 0, group);
  cylinder(.025, .026, legHeight, material, .055, .16, 0, group);

  const arm1 = cylinder(.025, .025, .3, material, -.125, .48, 0, group);
  const arm2 = cylinder(.025, .025, .3, material, .125, .48, 0, group);

  arm1.rotation.z = -.14;
  arm2.rotation.z = .14;

  group.scale.y = height / .95;
  scene.add(group);

  return group;
}

person(-3.05, -.25, "#665345", true);
person(-2.72, -.25, "#b3a28b", false, 1.02);

person(2.4, -.3, "#b6818a", true);
person(2.73, -.3, "#a6a99d", false, 1.05);

/* =========================================
   VIDEO SOURCES
   ========================================= */

function setSource(index, source, objectUrl = null) {
  const item = exhibits[index];

  item.video.pause();

  if (item.url) URL.revokeObjectURL(item.url);

  item.url = objectUrl;
  item.source = source;
  item.retryAt = 0;
  item.material.map = item.placeholder;
  item.material.needsUpdate = true;

  item.video.src = source;
  item.video.load();
}

function overlaysOpen() {
  return !$("welcome").hidden ||
         !$("upload").hidden ||
         !$("cinema").hidden;
}

function pauseAll() {
  exhibits.forEach(item => item.video.pause());
}

function selectMemory(index) {
  selected = index;

  $("memory-number").textContent =
    `MEMORY ${String(index + 1).padStart(2, "0")} · ${MEMORIES[index].date}`;

  $("memory-title").textContent = MEMORIES[index].title;
  $("memory-caption").textContent = MEMORIES[index].caption;
  $("counter").textContent = `${index + 1} / ${MEMORIES.length}`;
}

/* =========================================
   CAMERA MOVEMENT
   ========================================= */

function cameraQuaternion(position, target) {
  const dummy = new THREE.PerspectiveCamera();
  dummy.position.copy(position);
  dummy.lookAt(target);
  return dummy.quaternion.clone();
}

function syncPlayerAngles() {
  const euler = new THREE.Euler().setFromQuaternion(
    camera.quaternion,
    "YXZ"
  );

  player.yaw = euler.y;
  player.pitch = euler.x;
}

function moveCamera(position, target) {
  keys.clear();
  touch.clear();

  tour = {
    start: performance.now(),
    duration: reducedMotion.matches ? 0 : 1600,
    from: player.position.clone(),
    to: position,
    fromRotation: camera.quaternion.clone(),
    toRotation: cameraQuaternion(position, target)
  };
}

function visitMemory(index) {
  index = Math.max(0, Math.min(MEMORIES.length - 1, index));
  selectMemory(index);

  const { x, y } = exhibits[index].layout;

  moveCamera(
    new THREE.Vector3(x * .8, Math.max(1.7, y - .05), 2.3),
    new THREE.Vector3(x, y, -1.5)
  );
}

function overview() {
  moveCamera(
    new THREE.Vector3(0, 2.7, 10.8),
    new THREE.Vector3(0, 2.9, -1.5)
  );
}

function manualMove(delta) {
  const forward =
    Number(keys.has("w") || keys.has("arrowup") || touch.has("forward")) -
    Number(keys.has("s") || keys.has("arrowdown") || touch.has("back"));

  const sideways =
    Number(keys.has("d") || touch.has("right")) -
    Number(keys.has("a") || touch.has("left"));

  const turn =
    Number(keys.has("arrowleft")) -
    Number(keys.has("arrowright"));

  player.yaw += turn * delta * 1.2;

  const length = Math.hypot(forward, sideways) || 1;
  const speed = 2.3 * delta;

  player.position.x += (
    -Math.sin(player.yaw) * forward +
    Math.cos(player.yaw) * sideways
  ) / length * speed;

  player.position.z += (
    -Math.cos(player.yaw) * forward -
    Math.sin(player.yaw) * sideways
  ) / length * speed;

  // Keep visitors in front of the display.
  player.position.x = THREE.MathUtils.clamp(player.position.x, -9, 9);
  player.position.z = THREE.MathUtils.clamp(player.position.z, 1.5, 14);

  camera.position.copy(player.position);
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
}

/* =========================================
   CINEMA AND UPLOAD PANELS
   ========================================= */

function openUpload() {
  modalFocus = document.activeElement;
  keys.clear();
  touch.clear();
  pauseAll();

  $("upload").hidden = false;
  $("files").focus();
}

function openCinema(index) {
  const item = exhibits[index];

  if (!item.source) {
    openUpload();
    $("upload-status").textContent =
      "Add your videos to bring the framed memories to life.";
    return;
  }

  modalFocus = document.activeElement;
  keys.clear();
  touch.clear();
  pauseAll();

  const video = $("cinema-video");

  video.src = item.source;
  video.muted = !soundOn;

  const time = item.video.currentTime || 0;

  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration)) {
      video.currentTime = Math.min(
        time,
        Math.max(0, video.duration - .1)
      );
    }
  };

  $("cinema-title").textContent = MEMORIES[index].title;
  $("cinema-caption").textContent = MEMORIES[index].caption;
  $("cinema").hidden = false;

  video.load();
  video.play().catch(() => {});
  $("close-cinema").focus();
}

function closePanel(id) {
  if (id === "cinema") {
    $("cinema-video").pause();
    $("cinema-video").onloadedmetadata = null;
  }

  $(id).hidden = true;

  if (modalFocus?.isConnected) modalFocus.focus();
}

$("add-videos").onclick = openUpload;
$("close-upload").onclick = () => closePanel("upload");
$("close-cinema").onclick = () => closePanel("cinema");

$("enter").onclick = () => {
  entered = true;
  $("welcome").hidden = true;
  $("next").focus();
  overview();
};

$("next").onclick = () => visitMemory(selected < 0 ? 0 : selected + 1);
$("previous").onclick = () => visitMemory(selected < 0 ? 0 : selected - 1);
$("overview").onclick = overview;
$("watch").onclick = () => openCinema(Math.max(0, selected));

$("sound").onclick = () => {
  soundOn = !soundOn;

  $("sound").textContent = soundOn ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(soundOn));

  $("cinema-video").muted = !soundOn;

  if (selected >= 0 && !overlaysOpen()) {
    const item = exhibits[selected];

    item.video.muted = !soundOn;

    if (item.source) item.video.play().catch(() => {});
  }
};

$("files").onchange = event => {
  const files = [...event.target.files]
    .filter(file =>
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name)
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )
    .slice(0, MEMORIES.length);

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    setSource(index, url, url);
  });

  $("upload-status").textContent = files.length
    ? `${files.length} memories added. Return to the collection.`
    : "Please choose a video file.";
};

/* =========================================
   POINTER, KEYBOARD, TOUCH
   ========================================= */

canvas.addEventListener("pointerdown", event => {
  if (!entered || overlaysOpen()) return;

  tour = null;

  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    distance: 0
  };

  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", event => {
  if (!drag || drag.id !== event.pointerId) return;

  const dx = event.clientX - drag.lastX;
  const dy = event.clientY - drag.lastY;

  drag.distance += Math.abs(dx) + Math.abs(dy);

  player.yaw -= dx * .003;
  player.pitch = THREE.MathUtils.clamp(
    player.pitch - dy * .003,
    -.7,
    .7
  );

  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
});

canvas.addEventListener("pointerup", event => {
  if (!drag) return;

  const wasClick = drag.distance < 8;
  drag = null;

  if (!wasClick || overlaysOpen()) return;

  const bounds = canvas.getBoundingClientRect();

  pointer.set(
    (event.clientX - bounds.left) / bounds.width * 2 - 1,
    -(event.clientY - bounds.top) / bounds.height * 2 + 1
  );

  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(clickable);

  if (hits.length) {
    const index = hits[0].object.userData.memoryIndex;
    selectMemory(index);
    openCinema(index);
  }
});

canvas.addEventListener("pointercancel", () => {
  drag = null;
});

const movementKeys = new Set([
  "w", "a", "s", "d",
  "arrowup", "arrowdown", "arrowleft", "arrowright"
]);

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (key === "escape") {
    if (!$("cinema").hidden) closePanel("cinema");
    else if (!$("upload").hidden) closePanel("upload");
    return;
  }

  if (!entered || overlaysOpen()) return;

  if (movementKeys.has(key)) {
    event.preventDefault();
    tour = null;
    keys.add(key);
  }
});

window.addEventListener("keyup", event => {
  keys.delete(event.key.toLowerCase());
});

document.querySelectorAll("[data-move]").forEach(button => {
  const direction = button.dataset.move;

  button.addEventListener("pointerdown", event => {
    if (!entered || overlaysOpen()) return;

    event.preventDefault();
    tour = null;
    touch.add(direction);
    button.setPointerCapture(event.pointerId);
  });

  const release = () => touch.delete(direction);

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

window.addEventListener("blur", () => {
  keys.clear();
  touch.clear();
  drag = null;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    touch.clear();
    pauseAll();
    $("cinema-video").pause();
  }
});

// Trap keyboard focus in whichever dialog is open.
document.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;

  const panel = !$("cinema").hidden ? $("cinema")
    : !$("upload").hidden ? $("upload")
    : !$("welcome").hidden ? $("welcome")
    : null;

  if (!panel) return;

  const items = [...panel.querySelectorAll(
    'button:not(:disabled), input, video[controls]'
  )];

  if (!items.length) return;

  const first = items[0];
  const last = items[items.length - 1];

  if (!panel.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

/* =========================================
   PROXIMITY VIDEO PLAYBACK
   ========================================= */

function updatePlayback() {
  if (!entered || overlaysOpen() || document.hidden) {
    pauseAll();
    return;
  }

  let nearest = -1;
  let bestDistance = Infinity;

  exhibits.forEach((item, index) => {
    const distance = camera.position.distanceTo(
      item.group.position
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = index;
    }
  });

  // Close-range exploration selects the nearest frame.
  // Guided navigation keeps its selected memory.
  if (!tour && bestDistance < 5 && nearest !== selected) {
    selectMemory(nearest);
  }

  const now = performance.now();

  exhibits.forEach((item, index) => {
    const play =
      index === selected &&
      camera.position.distanceTo(item.group.position) < 7 &&
      Boolean(item.source);

    item.video.muted = !soundOn || !play;

    if (!play) {
      item.video.pause();
      return;
    }

    if (
      item.video.paused &&
      !item.pending &&
      now >= item.retryAt
    ) {
      item.pending = true;
      item.retryAt = now + 3000;

      item.video.play()
        .catch(() => {})
        .finally(() => {
          item.pending = false;
        });
    }
  });
}

/* =========================================
   RESIZE AND RENDER
   ========================================= */

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});

window.addEventListener("beforeunload", () => {
  exhibits.forEach(item => {
    if (item.url) URL.revokeObjectURL(item.url);
    if (item.texture) item.texture.dispose();
  });
});

camera.position.copy(player.position);
camera.lookAt(0, 2.9, -1.5);
syncPlayerAngles();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), .04);

  if (entered && !overlaysOpen()) {
    if (tour) {
      const progress = tour.duration === 0
        ? 1
        : Math.min(
            (performance.now() - tour.start) / tour.duration,
            1
          );

      const eased = progress * progress * (3 - 2 * progress);

      player.position.lerpVectors(tour.from, tour.to, eased);
      camera.position.copy(player.position);

      camera.quaternion.slerpQuaternions(
        tour.fromRotation,
        tour.toRotation,
        eased
      );

      if (progress === 1) {
        syncPlayerAngles();
        tour = null;
      }
    } else {
      manualMove(delta);
    }
  }

  playbackTimer += delta;

  if (playbackTimer > .4) {
    playbackTimer = 0;
    updatePlayback();
  }

  renderer.render(scene, camera);
}

$("enter").disabled = false;
$("enter").textContent = "Enter our museum →";
$("load-status").textContent =
  "Seven little frames. A lifetime of us.";

animate();
