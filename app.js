import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

import {
  OrbitControls
} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

import {
  STLExporter
} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/STLExporter.js";

import {
  Brush,
  Evaluator,
  ADDITION,
  SUBTRACTION
} from "https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.17/+esm";

import opentype from "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm";

import {
  zipSync,
  strToU8
} from "https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm";


// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------

const fontFile =
  document.getElementById("fontFile");

const letterInput =
  document.getElementById("letter");

const stampSizeInput =
  document.getElementById("stampSize");

const letterDepthInput =
  document.getElementById("letterDepth");

const handleHeightInput =
  document.getElementById("handleHeight");

const engravingDepthInput =
  document.getElementById("engravingDepth");

const previewButton =
  document.getElementById("previewButton");

const generateButton =
  document.getElementById("generate");

const generateBatchButton =
  document.getElementById("generateBatch");

const viewer =
  document.getElementById("viewer");

const status =
  document.getElementById("status");

const fontName =
  document.getElementById("fontName");


// ------------------------------------------------------------
// Three.js setup
// ------------------------------------------------------------

const scene =
  new THREE.Scene();

scene.background =
  new THREE.Color(0xf0f0f0);


const camera =
  new THREE.PerspectiveCamera(
    45,
    viewer.clientWidth /
      viewer.clientHeight,
    0.1,
    1000
  );

camera.position.set(
  0,
  80,
  120
);


const renderer =
  new THREE.WebGLRenderer({
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


const controls =
  new OrbitControls(
    camera,
    renderer.domElement
  );

controls.enableDamping =
  true;


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


  for (
    const command of path.commands
  ) {

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

function createStamp(character) {

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


  // ----------------------------------------------------------
  // Main dimensions
  // ----------------------------------------------------------

  const bodyHeight =
    10;

  const bodyRadius =
    size / 2;

  const handleRadius =
    size * 0.30;


  // Height of the tapered transition.
  //
  // This creates a sloped connection between
  // the main disc and the narrower handle.
  const transitionHeight =
    Math.min(
      5,
      handleHeight * 0.30
    );


  const handleActualHeight =
    handleHeight -
    transitionHeight;


  const totalHeight =
    bodyHeight +
    handleHeight;


  // ----------------------------------------------------------
  // CSG evaluator
  // ----------------------------------------------------------

  const evaluator =
    new Evaluator();


  // ----------------------------------------------------------
  // Main stamp body
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

  bodyBrush.updateMatrixWorld(
    true
  );


  // ----------------------------------------------------------
  // Tapered handle transition
  // ----------------------------------------------------------
  //
  // The bottom is wider.
  // The top is narrower.
  //
  // This creates a support-free slope.
  // ----------------------------------------------------------

  const transitionBottomRadius =
    handleRadius * 1.35;

  const transitionTopRadius =
    handleRadius;


  const transitionGeometry =
    new THREE.CylinderGeometry(
      transitionTopRadius,
      transitionBottomRadius,
      transitionHeight,
      64
    );


  const transitionBrush =
    new Brush(
      transitionGeometry,
      material
    );


  transitionBrush.position.y =
    bodyHeight +
    transitionHeight / 2;


  transitionBrush.updateMatrixWorld(
    true
  );


  // ----------------------------------------------------------
  // Join body + tapered transition
  // ----------------------------------------------------------

  stampBrush =
    evaluator.evaluate(
      bodyBrush,
      transitionBrush,
      ADDITION
    );


  // ----------------------------------------------------------
  // Straight handle
  // ----------------------------------------------------------

  const handleGeometry =
    new THREE.CylinderGeometry(
      handleRadius,
      handleRadius,
      handleActualHeight,
      64
    );


  const handleBrush =
    new Brush(
      handleGeometry,
      material
    );


  handleBrush.position.y =
    bodyHeight +
    transitionHeight +
    handleActualHeight / 2;


  handleBrush.updateMatrixWorld(
    true
  );


  // ----------------------------------------------------------
  // Join handle
  // ----------------------------------------------------------

  stampBrush =
    evaluator.evaluate(
      stampBrush,
      handleBrush,
      ADDITION
    );


  // ----------------------------------------------------------
  // Selected character
  // ----------------------------------------------------------

  const glyph =
    currentFont.charToGlyph(
      character
    );


  if (!glyph) {
    throw new Error(
      `Could not find "${character}" in the font.`
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
      `Could not create a shape from "${character}".`
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
  // vertically along Y.
  letterGeometry.rotateX(
    Math.PI / 2
  );


  const letterBrush =
    new Brush(
      letterGeometry,
      material
    );


  // Put the raised letter
  // below the bottom of the stamp.
  letterBrush.position.y =
    -depth / 2;


  letterBrush.updateMatrixWorld(
    true
  );


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
      `Could not create the engraving shape for "${character}".`
    );
  }


  const engravingGeometry =
    new THREE.ExtrudeGeometry(
      engravingShapes,
      {
        depth:
          engravingDepth + 2,

        bevelEnabled:
          false,

        curveSegments:
          8
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


  // Rotate engraving cutter
  // vertically along Y.
  engravingGeometry.rotateX(
    Math.PI / 2
  );


  const engravingBrush =
    new Brush(
      engravingGeometry,
      material
    );


  // Put the cutter through
  // the top surface of the handle.
  engravingBrush.position.y =
    totalHeight -
    engravingDepth / 2;


  engravingBrush.updateMatrixWorld(
    true
  );


  // Subtract the actual
  // letter-shaped cutter.
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

    status.textContent =
      "Choose a font first.";

    return;
  }


  try {

    status.textContent =
      "Generating preview…";


    const character =
      letterInput.value || "A";


    const newStamp =
      createStamp(
        character
      );


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
    // Center model
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
      "Preview ready.";

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
        "Font loaded. Set your options, then preview.";

    } catch (err) {

      console.error(err);

      currentFont =
        null;


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
  }
);


// ------------------------------------------------------------
// Preview button
// ------------------------------------------------------------

previewButton.addEventListener(
  "click",
  () => {

    buildPreview();
  }
);


// ------------------------------------------------------------
// Generate single STL
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

      status.textContent =
        "Generating STL…";


      const character =
        letterInput.value || "A";


      const stamp =
        createStamp(
          character
        );


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


      const safeCharacter =
        character.replace(
          /[^a-z0-9_-]+/gi,
          "_"
        );


      const a =
        document.createElement(
          "a"
        );


      a.href =
        url;


      a.download =
        `${safeFont}_${safeCharacter}_clay_stamp.stl`;


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
// Generate alphabet + numbers ZIP
// ------------------------------------------------------------

generateBatchButton.addEventListener(
  "click",
  async () => {

    if (!currentFont) {

      status.textContent =
        "Choose a TTF or OTF font first.";

      return;
    }


    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";


    try {

      generateBatchButton.disabled =
        true;

      generateButton.disabled =
        true;

      previewButton.disabled =
        true;


      const exporter =
        new STLExporter();


      const files = {};


      const fontBaseName =
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


      for (
        let i = 0;
        i < characters.length;
        i++
      ) {

        const character =
          characters[i];


        status.textContent =
          `Generating ${character} (${i + 1} of ${characters.length})…`;


        // Give the browser a chance to update
        // the status message between stamps.
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              20
            )
        );


        const stamp =
          createStamp(
            character
          );


        const stl =
          exporter.parse(
            stamp,
            {
              binary: false
            }
          );


        files[
          `${fontBaseName}_${character}_clay_stamp.stl`
        ] =
          strToU8(
            stl
          );
      }


      status.textContent =
        "Creating ZIP file…";


      const zipData =
        zipSync(
          files,
          {
            level: 6
          }
        );


      const zipBlob =
        new Blob(
          [zipData],
          {
            type: "application/zip"
          }
        );


      const zipUrl =
        URL.createObjectURL(
          zipBlob
        );


      const a =
        document.createElement(
          "a"
        );


      a.href =
        zipUrl;


      a.download =
        `${fontBaseName}_clay_stamps.zip`;


      a.click();


      URL.revokeObjectURL(
        zipUrl
      );


      status.textContent =
        "Alphabet + numbers ZIP generated.";

    } catch (err) {

      console.error(err);

      status.textContent =
        "Something went wrong while generating the ZIP.";

    } finally {

      generateBatchButton.disabled =
        false;

      generateButton.disabled =
        false;

      previewButton.disabled =
        false;
    }
  }
);


// ------------------------------------------------------------
// Window resize
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
