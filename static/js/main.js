import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

let camera, scene, renderer;
let plane;
let pointer, raycaster, isShiftDown = false;
let rollOverMesh, rollOverMaterial;
let cubeGeo, cubeMaterial;
let isCameraRotating = false;
let controls, gridHelper;
let toggleCameraControl = false;
let historyPointer = -1;
let deleteModeActive = false;

const objects = [];
const historyStack = [];

init();
animate();

function init() {

    //pull defaults from UI
    const transparencySlider = document.getElementById("transparencySlider");
    const initialOpacity = parseInt(transparencySlider.value) / 100;
    const colorPicker = document.getElementById("colorPicker");
    const initialColor = colorPicker.value;

    //camera
    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.set( 300, 1000, 1300 );
    camera.lookAt( 0, 0, 0 );

    //scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x333333 );
    updateControlPanelTextColor(scene.background.getHexString());

    // roll-over helpers
    const rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
    rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xFFFFFF, opacity: 0.5, transparent: true } );
    rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
    rollOverMesh.visible = false;
    scene.add( rollOverMesh );

    // cubes
    cubeGeo = new THREE.BoxGeometry( 50, 50, 50 );
    cubeMaterial = new THREE.MeshLambertMaterial({ color: initialColor, opacity: initialOpacity, transparent: true });
    document.getElementById("transparencySlider").addEventListener("input", onTransparencySliderChange);

    // grid
    gridHelper = new THREE.GridHelper( 1000, 20 );
    scene.add( gridHelper );

    // plane
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    const geometry = new THREE.PlaneGeometry( 1000, 1000 );
    geometry.rotateX( - Math.PI / 2 );
    plane = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { visible: false } ) );
    scene.add( plane );
    objects.push( plane );

    // lights
    const ambientLight = new THREE.AmbientLight( 0x606060 );
    scene.add( ambientLight );
    const directionalLight = new THREE.DirectionalLight( 0xffffff );
    directionalLight.position.set( 1, 0.75, 0.5 ).normalize();
    scene.add( directionalLight );

    // renderer
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.domElement.id = 'threejs-canvas';
    document.body.appendChild(renderer.domElement);

    // controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI;
    controls.enablePan = false;
    controls.mouseButtons = {
      LEFT: null,
      MIDDLE: null,
      RIGHT: THREE.MOUSE.ROTATE
    };
    controls.touches = {
        ONE: null,
        TWO: null
     };

    controls.addEventListener('start', () => isCameraRotating = true);
    controls.addEventListener('end', () => isCameraRotating = false);


    // listeners
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);
    document.getElementById("colorPicker").addEventListener("input", onColorPickerChange);
    document.getElementById("backgroundColorPicker").addEventListener("input", onBackgroundColorPickerChange);
    document.getElementById("saveButton").addEventListener("click", onSaveButtonClick);
    document.getElementById("loadButton").addEventListener("click", onLoadButtonClick);
    document.getElementById("clearAllButton").addEventListener("click", onClearAllButtonClick);
    document.getElementById("toggleGridButton").addEventListener("click", toggleGridVisibility);
    document.getElementById("undo").addEventListener("click", undo);
    document.getElementById("redo").addEventListener("click", redo);
    document.getElementById("toggleAutoRotate").addEventListener("click", toggleAutoRotate);
    document.getElementById("control-panel-toggle").addEventListener("click", controlPanelToggle);
    document.getElementById("globe").addEventListener("click", globeCameraToggle);
    document.getElementById("deleteModeToggle").addEventListener("click", toggleDeleteMode);
    document.getElementById('textureSelector').addEventListener('change', onTextureChange);
    window.addEventListener('beforeunload', autoSaveState);
    document.addEventListener('DOMContentLoaded', autoLoadState);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    render();

}

function onColorPickerChange(event) {
    const newColor = event.target.value;
    cubeMaterial.color.set(newColor);
    rollOverMaterial.color.set(newColor);
}

function onTextureChange(event) {
  const texturePath = event.target.value;
  const loader = new THREE.TextureLoader();

  if (texturePath === 'none') {
    cubeMaterial.map = null;
  } else {
    loader.load(texturePath, (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.NearestFilter;
      cubeMaterial.map = texture;
      cubeMaterial.blending = THREE.MultiplyBlending;
      cubeMaterial.needsUpdate = true;
    });
  }
}

function onTransparencySliderChange(event) {
    cubeMaterial.opacity = event.target.value / 100;
}

function onPointerMove(event) {

    if (deleteModeActive) {
    rollOverMesh.visible = false;
    return;
    }

    if (toggleCameraControl) {
    rollOverMesh.visible = false;
    return;
    }

    if (!event.target.closest('#threejs-canvas')) {
    rollOverMesh.visible = false;
    return;
    }

    if (isCameraRotating) {
        rollOverMesh.visible = false;
        return;
    }

    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0) {
        rollOverMesh.visible = true;

        const intersect = intersects[0];

        rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
        rollOverMesh.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);

        render();

    } else {
        rollOverMesh.visible = false;
    }
}

function onMouseDown(event) {
    if (!event.target.closest('#threejs-canvas')) return;

    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0 && event.button !== 2) {
        const intersect = intersects[0];

        // delete cube
        if (isShiftDown || deleteModeActive) {
            deleteCube(intersect);
        // create cube
        } else {
            createCube(intersect);
        }

        render();
    }
}

function onTouchStart(event) {
    if (!event.target.closest('#threejs-canvas')) return;

    pointer.set((event.touches[0].clientX / window.innerWidth) * 2 - 1, -(event.touches[0].clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0) {
        event.preventDefault();
        const intersect = intersects[0];

        if (deleteModeActive) {
            deleteCube(intersect);
        } else {
            createCube(intersect);
        }

        render();

    }

}

function onDocumentKeyDown( event ) {

    switch ( event.keyCode ) {

        case 16: isShiftDown = true; break;

    }

}

function onDocumentKeyUp( event ) {

    switch ( event.keyCode ) {

        case 16: isShiftDown = false; break;

    }

}

function render() {

    renderer.render( scene, camera );

}

function onBackgroundColorPickerChange(event) {
    const newColor = event.target.value;
    scene.background.set(newColor);
    render();

    updateControlPanelTextColor(newColor);
}

function updateControlPanelTextColor(backgroundColor) {
    const textColor = getContrastColor(backgroundColor.substring(1));
    const labels = document.querySelectorAll("#control-panel-content label");
    labels.forEach(label => {
        label.style.color = textColor;
    });
}

function getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function onSaveButtonClick() {
    saveState();

}

function onLoadButtonClick() {
    loadState();

}

function toggleGridVisibility() {
    gridHelper.visible = !gridHelper.visible;
    render();
}

function onClearAllButtonClick() {
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj !== plane) {
            scene.remove(obj);
            objects.splice(i, 1);
        }
    }
    render();
}

function saveState(key = 'craftCubeState') {
  const state = {
    backgroundColor: scene.background.getHexString(),
    cubes: objects.slice(1).map(object => {
      const textureSettings = object.material.map
        ? {
            src: object.material.map.image.src,
            wrapS: object.material.map.wrapS,
            wrapT: object.material.map.wrapT,
            generateMipmaps: object.material.map.generateMipmaps,
            minFilter: object.material.map.minFilter,
            magFilter: object.material.map.magFilter
          }
        : null;

      return {
        position: object.position.toArray(),
        color: object.material.color.getHexString(),
        opacity: object.material.opacity,
        textureSettings: textureSettings,
        blending: object.material.blending,
        transparent: object.material.transparent,
        needsUpdate: object.material.needsUpdate
      };
    })
  };
  const jsonString = JSON.stringify(state);
  localStorage.setItem(key, jsonString);
}

async function loadState(key = 'craftCubeState') {
  const jsonString = localStorage.getItem(key);
  if (jsonString) {
    const state = JSON.parse(jsonString);

    // Set background color
    scene.background = new THREE.Color(`#${state.backgroundColor}`);

    // Remove all existing cubes
    for (const object of objects.slice(1)) {
      scene.remove(object);
    }
    objects.length = 1; // Keep only the plane

    // Add cubes from the saved state
    for (const cubeState of state.cubes) {
      const material = new THREE.MeshLambertMaterial({
        color: `#${cubeState.color}`,
        opacity: cubeState.opacity,
        transparent: cubeState.transparent,
        blending: cubeState.blending
      });

      if (cubeState.textureSettings) {
        const loader = new THREE.TextureLoader();
        const texture = await new Promise((resolve) => {
          loader.load(cubeState.textureSettings.src, resolve);
        });
        texture.wrapS = cubeState.textureSettings.wrapS;
        texture.wrapT = cubeState.textureSettings.wrapT;
        texture.generateMipmaps = cubeState.textureSettings.generateMipmaps;
        texture.minFilter = cubeState.textureSettings.minFilter;
        texture.magFilter = cubeState.textureSettings.magFilter;
        material.map = texture;
        material.needsUpdate = cubeState.needsUpdate;
      }

      const cube = new THREE.Mesh(cubeGeo, material);
      cube.position.fromArray(cubeState.position);
      scene.add(cube);
      objects.push(cube);
    }
    render();
  }
}

function createCube(intersect) {
  if (deleteModeActive) {
    return;
  }

  if (toggleCameraControl) {
    return;
  }

  const newMaterial = new THREE.MeshLambertMaterial({
    color: cubeMaterial.color.clone(),
    opacity: cubeMaterial.opacity,
    transparent: true,
    map: cubeMaterial.map,
    blending: THREE.NormalBlending
  });

  const voxel = new THREE.Mesh(cubeGeo, newMaterial);
  voxel.position.copy(intersect.point).add(intersect.face.normal);
  voxel.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);
  scene.add(voxel);

  objects.push(voxel);

  // Add action to the history stack
  historyStack.splice(historyPointer + 1, historyStack.length);
  historyStack.push({ action: 'create', object: voxel });
  historyPointer++;
  saveState('autoSaveState');
}

function deleteCube(intersect) {
    if (intersect.object !== plane) {
        scene.remove(intersect.object);
        objects.splice(objects.indexOf(intersect.object), 1);

        // Add action to the history stack
        historyStack.splice(historyPointer + 1, historyStack.length);
        historyStack.push({ action: 'delete', object: intersect.object });
        historyPointer++;
        saveState('autoSaveState');
    }
}

function enableCameraControl() {
    controls.enablePan = true;

    controls.touches = {
	ONE: THREE.TOUCH.ROTATE,
	TWO: THREE.TOUCH.DOLLY_PAN
    }
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.TOUCH.DOLLY_PAN,
      RIGHT: THREE.MOUSE.ROTATE
    };
    const globeIcon = document.getElementById("globe");
    globeIcon.classList.add("icon-active");
}

function disableCameraControl() {
    controls.enablePan = false;

    controls.touches = {
        ONE: null,
        TWO: null
     };
    controls.mouseButtons = {
      LEFT: null,
      MIDDLE: null,
      RIGHT: THREE.MOUSE.ROTATE
    };
    const globeIcon = document.getElementById("globe");
    globeIcon.classList.remove("icon-active");
}

function undo() {
    if (historyPointer < 0) return;

    const action = historyStack[historyPointer];
    historyPointer--;

    if (action.action === 'create') {
        scene.remove(action.object);
        objects.splice(objects.indexOf(action.object), 1);
    } else if (action.action === 'delete') {
        objects.push(action.object);
        scene.add(action.object);
    }

    render();
}

function redo() {
    if (historyPointer >= historyStack.length - 1) return;

    historyPointer++;

    const action = historyStack[historyPointer];
    if (action.action === 'create') {
        objects.push(action.object);
        scene.add(action.object);
    } else if (action.action === 'delete') {
        scene.remove(action.object);
        objects.splice(objects.indexOf(action.object), 1);
    }

    render();
}

function toggleAutoRotate() {
    if (controls.autoRotate) {
        controls.autoRotate = false
    } else {
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.75;
    }
}

function controlPanelToggle() {
    const controlPanel = document.getElementById("control-panel");
    controlPanel.classList.toggle("expanded");
}

function globeCameraToggle() {
    toggleCameraControl = !toggleCameraControl;

    if (toggleCameraControl) {
        enableCameraControl();
    } else {
        disableCameraControl();
    }
}

function toggleDeleteMode() {
  deleteModeActive = !deleteModeActive;

  const deleteModeIcon = document.getElementById("deleteModeToggle");

  if (deleteModeActive){
      deleteModeIcon.classList.add("icon-active");
  }
  else {
      deleteModeIcon.classList.remove("icon-active");
  }

}

function autoSaveState() {
    saveState('autoSaveState');
}

function autoLoadState() {
    loadState('autoSaveState');
}