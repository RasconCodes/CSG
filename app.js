import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/STLExporter.js";
import {
  Brush,
  Evaluator,
  ADDITION,
  SUBTRACTION
} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/STLExporter.js";
import opentype from "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm";


// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------

const fontFile = document.getElementById("fontFile");
const letterInput = document.getElementById("letter");
const stampSizeInput = document.getElementById("stampSize");
const letterDepthInput = document.getElementById("letterDepth");
const handleHeightInput = document.getElementById("handleHeight");
const engravingDepthInput = document.getElementById("engravingDepth");

const generateButton = document.getElementById("generate");
const viewer = document.getElementById("viewer");
const status = document.getElementById("status");
const fontName = document.getElementById("fontName");


// ------------------------------------------------------------
// Three.js setup
// ------------------------------------------------------------

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(
  45,
  viewer.clientWidth / viewer.clientHeight,
  0.1,
  1000
);

camera.position.set(0, 80, 120);


const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(
  window.devicePixelRatio
);

renderer.setSize(
  viewer.clientWidth,
  viewer.clientHeight
);

viewer.appendChild(
  renderer.domElement
);


const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;


// ------------------------------------------------------------
// Lighting
// ------------------------------------------------------------

const ambientLight =
  new THREE.HemisphereLight(
    0xffffff,
    0x888888,
    2
  );

scene.add(
  ambientLight
);


const directionalLight =
  new THREE.DirectionalLight(
    0xffffff,
    2
  );

directionalLight.position.set(
  50,
  100,
  80
);

scene.add(
  directionalLight
);


// ------------------------------------------------------------
// Material
// ------------------------------------------------------------

const material =
  new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.75,
    metalness: 0
  });


// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let currentFont = null;
let previewObject = null;
let stampBrush = null;


// ------------------------------------------------------------
// Convert OpenType path to Three.js shapes
// ------------------------------------------------------------

function pathToShapes(path) {
  const shapePath =
    new THREE.ShapePath();

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


// ------------------------------------------------------------
// Create stamp
// ------------------------------------------------------------

function createStamp() {

  const size =
    parseFloat(
      stampSizeInput.value
    );

  const depth =
    parseFloat(
      letterDepthInput.value
    );

  const handleHeight =
    parseFloat(
      handleHeightInput.value
    );

  const engravingDepth =
    parseFloat(
      engravingDepthInput.value
    );


  const bodyHeight = 10;

  const bodyRadius =
    size / 2;

  const handleRadius =
    size * 0.30;

  const totalHeight =
    bodyHeight +
    handleHeight;


  const evaluator =
    new Evaluator();


  // ----------------------------------------------------------
  // Main body
  // ----------------------------------------------------------

  const bodyGeometry =
    new THREE.CylinderGeometry(
      bodyRadius,
      bodyRadius,
      bodyHeight,
      96
    );

  const bodyBrush =
    new Brush(
      bodyGeometry,
      material
    );

  bodyBrush.position.y =
    bodyHeight / 2;

  bodyBrush.updateMatrixWorld(true);


  // ----------------------------------------------------------
  // Handle
  // ----------------------------------------------------------

  const handleGeometry =
    new THREE.CylinderGeometry(
      handleRadius,
      handleRadius * 1.08,
      handleHeight,
      64
    );

  const handleBrush =
    new Brush(
      handleGeometry,
      material
    );

  handleBrush.position.y =
    bodyHeight +
    handleHeight / 2;

  handleBrush.updateMatrixWorld(true);


  // ----------------------------------------------------------
  // Join body and handle
  // ----------------------------------------------------------

  stampBrush =
    evaluator.evaluate(
      bodyBrush,
      handleBrush,
      ADDITION
    );


  // ----------------------------------------------------------
  // Get selected letter
  // ----------------------------------------------------------

  const char =
    letterInput.value || "A";

  const glyph =
    currentFont.charToGlyph(
      char
    );

  if (!glyph) {
    throw new Error(
      "Could not find that character in the font."
    );
  }


  // ----------------------------------------------------------
  // Raised clay-facing letter
  // ----------------------------------------------------------

  const path =
    glyph.getPath(
      0,
      0,
      100
    );

  const shapes =
    pathToShapes(
      path
    );

  if (!shapes.length) {
    throw new Error(
      "Could not create a shape from that letter."
    );
  }


  const letterGeometry =
    new THREE.ExtrudeGeometry(
      shapes,
      {
        depth: depth,
        bevelEnabled: false,
        curveSegments: 8
      }
    );


  letterGeometry.computeBoundingBox();

  const letterBox =
    letterGeometry.boundingBox;

  const letterWidth =
    letterBox.max.x -
    letterBox.min.x;


  const letterScale =
    (size * 0.65) /
    Math.max(
      letterWidth,
      0.001
    );


  letterGeometry.scale(
    letterScale,
    letterScale,
    1
  );

  letterGeometry.center();


  // Rotate the font extrusion
  // so it runs vertically through Y.
  letterGeometry.rotateX(
    Math.PI / 2
  );


  const letterBrush =
    new Brush(
      letterGeometry,
      material
    );


  // Put raised letter below
  // the bottom of the stamp.
  letterBrush.position.y =
    -depth / 2;

  letterBrush.updateMatrixWorld(true);


  stampBrush =
    evaluator.evaluate(
      stampBrush,
      letterBrush,
      ADDITION
    );


  // ----------------------------------------------------------
  // Top recessed identification letter
  // ----------------------------------------------------------

  const engravingPath =
    glyph.getPath(
      0,
      0,
      100
    );

  const engravingShapes =
    pathToShapes(
      engravingPath
    );

  if (!engravingShapes.length) {
    throw new Error(
      "Could not create the engraving shape."
    );
  }


  const engravingGeometry =
    new THREE.ExtrudeGeometry(
      engravingShapes,
      {
        depth:
          engravingDepth + 2,
        bevelEnabled: false,
        curveSegments: 8
      }
    );


  engravingGeometry.computeBoundingBox();

  const engravingBox =
    engravingGeometry.boundingBox;

  const engravingWidth =
    engravingBox.max.x -
    engravingBox.min.x;


  const engravingScale =
    (handleRadius * 1.25) /
    Math.max(
      engravingWidth,
      0.001
    );


  engravingGeometry.scale(
    engravingScale,
    engravingScale,
    1
  );

  engravingGeometry.center();


  // Rotate the font extrusion
  // vertically along Y.
  engravingGeometry.rotateX(
    Math.PI / 2
  );


  const engravingBrush =
    new Brush(
      engravingGeometry,
      material
    );


  // Position the cutter through
  // the top of the handle.
  engravingBrush.position.y =
    totalHeight -
    engravingDepth / 2;

  engravingBrush.updateMatrixWorld(true);


  // Subtract the letter-shaped cutter.
  stampBrush =
    evaluator.evaluate(
      stampBrush,
      engravingBrush,
      SUBTRACTION
    );


  return stampBrush;
}


// ------------------------------------------------------------
// Build preview
// ------------------------------------------------------------

function buildPreview() {

  if (!currentFont) {
    return;
  }


  try {

    const newStamp =
      createStamp();


    if (previewObject) {
      scene.remove(
        previewObject
      );
    }


    previewObject =
      new THREE.Mesh(
        newStamp.geometry,
        material
      );

    scene.add(
      previewObject
    );


    stampBrush =
      newStamp;


    // --------------------------------------------------------
    // Center the model
    // --------------------------------------------------------

    const box =
      new THREE.Box3()
        .setFromObject(
          previewObject
        );

    const center =
      box.getCenter(
        new THREE.Vector3()
      );

    const modelSize =
      box.getSize(
        new THREE.Vector3()
      );


    previewObject.position.sub(
      center
    );


    const maxDimension =
      Math.max(
        modelSize.x,
        modelSize.y,
        modelSize.z
      );


    camera.position.set(
      maxDimension * 1.5,
      maxDimension * 1.3,
      maxDimension * 1.8
    );


    camera.lookAt(
      0,
      0,
      0
    );


    controls.target.set(
      0,
      0,
      0
    );

    controls.update();


    status.textContent =
      "Preview updated.";

  } catch (err) {

    console.error(err);

    status.textContent =
      "Could not build the preview.";
  }
}


// ------------------------------------------------------------
// Font loading
// ------------------------------------------------------------

fontFile.addEventListener(
  "change",
  async () => {

    const file =
      fontFile.files[0];

    if (!file) {
      return;
    }


    status.textContent =
      "Reading font…";


    try {

      const buffer =
        await file.arrayBuffer();

      currentFont =
        opentype.parse(
          buffer
        );


      fontName.textContent =
        file.name;


      status.textContent =
        "Font loaded. Pick a letter and generate.";


      buildPreview();

    } catch (err) {

      console.error(err);

      currentFont = null;

      status.textContent =
        "Could not read that font. Please choose a valid TTF or OTF.";
    }
  }
);


// ------------------------------------------------------------
// Letter input
// ------------------------------------------------------------

letterInput.addEventListener(
  "input",
  () => {

    letterInput.value =
      [...letterInput.value]
        .slice(0, 1)
        .join("");


    if (currentFont) {
      buildPreview();
    }
  }
);


// ------------------------------------------------------------
// Other settings
// ------------------------------------------------------------

for (
  const element of [
    stampSizeInput,
    letterDepthInput,
    handleHeightInput,
    engravingDepthInput
  ]
) {

  element.addEventListener(
    "input",
    () => {

      if (currentFont) {
        buildPreview();
      }
    }
  );
}


// ------------------------------------------------------------
// Generate STL
// ------------------------------------------------------------

generateButton.addEventListener(
  "click",
  () => {

    if (!currentFont) {

      status.textContent =
        "Choose a TTF or OTF font first.";

      return;
    }


    try {

      const stamp =
        createStamp();


      const exporter =
        new STLExporter();


      const stl =
        exporter.parse(
          stamp,
          {
            binary: false
          }
        );


      const blob =
        new Blob(
          [stl],
          {
            type: "model/stl"
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      const letter =
        letterInput.value ||
        "stamp";


      const safeFont =
        (
          fontFile.files[0]?.name ||
          "font"
        )
          .replace(
            /\.(ttf|otf)$/i,
            ""
          )
          .replace(
            /[^a-z0-9_-]+/gi,
            "_"
          );


      const a =
        document.createElement(
          "a"
        );


      a.href = url;

      a.download =
        `${safeFont}_${letter}_clay_stamp.stl`;


      a.click();


      URL.revokeObjectURL(
        url
      );


      status.textContent =
        "STL generated.";

    } catch (err) {

      console.error(err);

      status.textContent =
        "Something went wrong while generating the STL.";
    }
  }
);


// ------------------------------------------------------------
// Resize
// ------------------------------------------------------------

window.addEventListener(
  "resize",
  () => {

    const width =
      viewer.clientWidth;

    const height =
      viewer.clientHeight;


    camera.aspect =
      width / height;

    camera.updateProjectionMatrix();


    renderer.setSize(
      width,
      height
    );
  }
);


// ------------------------------------------------------------
// Render loop
// ------------------------------------------------------------

function animate() {

  requestAnimationFrame(
    animate
  );


  controls.update();


  renderer.render(
    scene,
    camera
  );
}


animate();
