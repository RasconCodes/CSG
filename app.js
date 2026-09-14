import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/TextGeometry.js";
import { STLExporter } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/STLExporter.js";
import { Brush, Evaluator, ADDITION, SUBTRACTION } from "https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.17/+esm";
import opentype from "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm";

const viewer = document.querySelector("#viewer");
const status = document.querySelector("#status");
const fontFile = document.querySelector("#fontFile");
const letterInput = document.querySelector("#letter");
const stampSizeInput = document.querySelector("#stampSize");
const letterDepthInput = document.querySelector("#letterDepth");
const handleHeightInput = document.querySelector("#handleHeight");
const engravingDepthInput = document.querySelector("#engravingDepth");
const fontName = document.querySelector("#fontName");
const generateButton = document.querySelector("#generate");

let currentFont = null;
let currentSceneGroup = null;

const evaluator = new Evaluator();
evaluator.useGroups = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e6df);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
camera.position.set(55, 48, 65);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 10, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(40, 70, 50);
scene.add(keyLight);

function resize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

fontFile.addEventListener("change", async () => {
  const file = fontFile.files[0];
  if (!file) return;

  status.textContent = "Reading font…";
  try {
    const buffer = await file.arrayBuffer();
    currentFont = opentype.parse(buffer);
    fontName.textContent = file.name;
    status.textContent = "Font loaded. Pick a letter and generate.";
    buildPreview();
  } catch (err) {
    console.error(err);
    currentFont = null;
    status.textContent = "Could not read that font. Please choose a valid TTF or OTF.";
  }
});

letterInput.addEventListener("input", () => {
  letterInput.value = [...letterInput.value].slice(0, 1).join("");
  if (currentFont) buildPreview();
});

for (const el of [stampSizeInput, letterDepthInput, handleHeightInput, engravingDepthInput]) {
  el.addEventListener("input", () => {
    if (currentFont) buildPreview();
  });
}

generateButton.addEventListener("click", () => {
  if (!currentFont) {
    status.textContent = "Choose a TTF or OTF font first.";
    return;
  }
  try {
    const group = createStamp();
    const exporter = new STLExporter();
    const stl = exporter.parse(group, { binary: false });
    const blob = new Blob([stl], { type: "model/stl" });
    const url = URL.createObjectURL(blob);
    const letter = letterInput.value || "stamp";
    const safeFont = (fontFile.files[0]?.name || "font")
      .replace(/\.(ttf|otf)$/i, "")
      .replace(/[^a-z0-9_-]+/gi, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFont}_${letter}_clay_stamp.stl`;
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = "STL generated.";
  } catch (err) {
    console.error(err);
    status.textContent = "Something went wrong while generating the STL.";
  }
});

function createStamp() {
  const size = Number(stampSizeInput.value);
  const depth = Number(letterDepthInput.value);
  const handleHeight = Number(handleHeightInput.value);
  const engravingDepth = Number(engravingDepthInput.value);
  const char = letterInput.value || "A";

  const bodyRadius = size / 2;
  const bodyHeight = 6;
  const handleRadius = Math.max(size * 0.34, 7);
  const totalHeight = bodyHeight + handleHeight;

  const material = new THREE.MeshStandardMaterial({
    color: 0xc9c9c9
  });

  // -------------------------
  // MAIN STAMP BODY
  // -------------------------

  const bodyGeometry = new THREE.CylinderGeometry(
    bodyRadius,
    bodyRadius,
    bodyHeight,
    96
  );

  const bodyBrush = new Brush(bodyGeometry, material);
  bodyBrush.position.y = bodyHeight / 2;
  bodyBrush.updateMatrixWorld(true);

  // -------------------------
  // HANDLE
  // -------------------------

  const handleGeometry = new THREE.CylinderGeometry(
    handleRadius,
    handleRadius * 1.08,
    handleHeight,
    64
  );

  const handleBrush = new Brush(handleGeometry, material);
  handleBrush.position.y = bodyHeight + handleHeight / 2;
  handleBrush.updateMatrixWorld(true);

  // -------------------------
  // JOIN BODY + HANDLE
  // -------------------------

  let stampBrush = evaluator.evaluate(
    bodyBrush,
    handleBrush,
    ADDITION
  );

  // -------------------------
  // GET FONT GLYPH
  // -------------------------

  const glyph = currentFont.charToGlyph(char);

  if (!glyph) {
    throw new Error(
      `Character "${char}" was not found in the uploaded font.`
    );
  }

  const path = glyph.getPath(0, 0, 100);
  const shapes = pathToShapes(path);

  if (!shapes.length) {
    throw new Error(
      `Could not create a shape for "${char}".`
    );
  }

  // -------------------------
  // RAISED STAMPING LETTER
  // -------------------------

  const letterGeometry = new THREE.ExtrudeGeometry(shapes, {
    depth: depth,
    bevelEnabled: false,
    curveSegments: 8
  });

  letterGeometry.computeBoundingBox();

  const letterBox = letterGeometry.boundingBox;
  const letterWidth =
    letterBox.max.x - letterBox.min.x;

  const letterScale =
    (size * 0.65) /
    Math.max(letterWidth, 0.001);

  letterGeometry.scale(
    letterScale,
    letterScale,
    1
  );

letterGeometry.center();

// Rotate the font extrusion so it runs vertically.
letterGeometry.rotateX(Math.PI / 2);

const letterBrush = new Brush(
  letterGeometry,
  material
);

// Put the raised letter below the bottom of the stamp.
letterBrush.position.y = -depth / 2;

letterBrush.updateMatrixWorld(true);

stampBrush = evaluator.evaluate(
  stampBrush,
  letterBrush,
  ADDITION
);


  // -------------------------
  // RECESSED IDENTIFICATION LETTER
  // -------------------------

const engravingGeometry =
  new THREE.ExtrudeGeometry(shapes, {
    depth: engravingDepth + 2,
    bevelEnabled: false,
    curveSegments: 8
  });
  engravingGeometry.computeBoundingBox();

  const engravingBox =
    engravingGeometry.boundingBox;

  const engravingWidth =
    engravingBox.max.x -
    engravingBox.min.x;

  const engravingScale =
    (handleRadius * 1.35) /
    Math.max(engravingWidth, 0.001);

  engravingGeometry.scale(
    engravingScale,
    engravingScale,
    1
  );

engravingGeometry.center();

// Rotate the font extrusion so it runs vertically.
engravingGeometry.rotateX(Math.PI / 2);

const engravingBrush = new Brush(
  engravingGeometry,
  material
);

// Position the engraving cutter so it starts
// inside the top of the handle and extends upward.
engravingBrush.position.y =
  bodyHeight + handleHeight;

engravingBrush.updateMatrixWorld(true);

  // -------------------------
  // CUT IDENTIFICATION LETTER
  // -------------------------

  stampBrush = evaluator.evaluate(
    stampBrush,
    engravingBrush,
    SUBTRACTION
  );

  // -------------------------
  // RETURN FINISHED STAMP
  // -------------------------

  stampBrush.material = material;

  return stampBrush;
}

function pathToShapes(path) {
  const shapePath = new THREE.ShapePath();

  for (const command of path.commands) {
    switch (command.type) {
      case "M":
        shapePath.moveTo(
          command.x,
          command.y
        );
        break;

      case "L":
        shapePath.lineTo(
          command.x,
          command.y
        );
        break;

      case "C":
        shapePath.bezierCurveTo(
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          command.x,
          command.y
        );
        break;

      case "Q":
        shapePath.quadraticCurveTo(
          command.x1,
          command.y1,
          command.x,
          command.y
        );
        break;

      case "Z":
        break;
    }
  }

  return shapePath.toShapes(true);
}



function buildPreview() {
  if (currentSceneGroup) scene.remove(currentSceneGroup);
  currentSceneGroup = createStamp();
  scene.add(currentSceneGroup);

  const box = new THREE.Box3().setFromObject(currentSceneGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();

  controls.target.copy(center);
  camera.position.set(size * 0.9, size * 0.8, size * 1.05);
  camera.lookAt(center);
}
