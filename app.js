import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/TextGeometry.js";
import { STLExporter } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/STLExporter.js";
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

  const group = new THREE.Group();

  // Simple cylindrical stamp body + handle.
  // Coordinates: bottom stamping face is at Z=0.
  const bodyRadius = size / 2;
  const bodyHeight = 6;
  const handleRadius = Math.max(size * 0.34, 7);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 96),
    new THREE.MeshStandardMaterial({ color: 0xc9c9c9 })
  );
  body.rotation.x = 0;
  body.position.z = bodyHeight / 2;
  group.add(body);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(handleRadius, handleRadius * 1.08, handleHeight, 64),
    new THREE.MeshStandardMaterial({ color: 0xb9b9b9 })
  );
  handle.position.z = bodyHeight + handleHeight / 2;
  group.add(handle);

  // The visible stamping letter is a real 3D raised piece.
  const raised = makeTextMesh(char, depth, size * 0.65, true);
  raised.position.z = 0.01;
  group.add(raised);

  // Identification letter: visually recessed in the preview.
  // For the first prototype this is represented by a dark inset mesh.
  const idLetter = makeTextMesh(char, Math.max(0.05, engravingDepth), handleRadius * 1.35, false);
  idLetter.material = new THREE.MeshStandardMaterial({ color: 0x555555 });
  idLetter.position.z = bodyHeight + handleHeight - engravingDepth + 0.02;
  group.add(idLetter);

  return group;
}

function makeTextMesh(char, extrusion, targetWidth, raised) {
  // opentype gives us exact font outlines. Three.js ShapeGeometry is used
  // for the preview prototype; STL export will be improved in the next step
  // to use the actual font contour directly.
  const fontJson = currentFont.toFont({
    familyName: "UploadedFont",
    styleName: "Regular"
  });
  const loader = new FontLoader();
  const threeFont = loader.parse(fontJson);

  const geometry = new TextGeometry(char, {
    font: threeFont,
    size: 10,
    depth: extrusion,
    curveSegments: 8,
    bevelEnabled: false
  });
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  const width = box.max.x - box.min.x;
  const scale = targetWidth / Math.max(width, 0.001);
  geometry.scale(scale, scale, 1);
  geometry.center();

  const material = new THREE.MeshStandardMaterial({
    color: raised ? 0x777777 : 0x555555
  });

  return new THREE.Mesh(geometry, material);
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
