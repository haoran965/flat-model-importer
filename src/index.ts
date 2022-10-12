import type { NetlessApp } from "@netless/window-manager";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";

import styles from "./style.css?inline";

const ModelExporter: NetlessApp = {
  kind: "ModelExporter",
  setup(context) {
    const storage = context.createStorage("modelExporter", { cameraPosition: [0, 0, 0], cameraTarget: [0, 0, 0], operator: "none" });
    const box = context.getBox();
    box.mountStyles(styles);

    const $container = document.createElement('div');
    $container.className = 'model-importer-container';
    box.mountContent($container);

    const clock = new THREE.Clock();
    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClearColor = false;
    renderer.setSize($container.clientWidth, $container.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    $container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator( renderer );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xbfe3dd );
    scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;
    const camera = new THREE.PerspectiveCamera(45, box.width / box.height, 0.1, 1000);
    camera.position.set( 5, 2, 8 );
    camera.lookAt(0, 0.5, 0);
    scene.add(camera);

    // 半球光
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    // 平行光源
    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(- 3, 10, - 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = - 2;
    dirLight.shadow.camera.left = - 2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    scene.add(dirLight);
    const light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );

    let mixer: THREE.AnimationMixer | undefined;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://threejs.org/examples/js/libs/draco/gltf/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load( 'https://threejs.org/examples/models/gltf/LittlestTokyo.glb', function ( gltf ) {
      const model = gltf.scene;
      model.position.set( 1, 1, 0 );
      model.scale.set( 0.01, 0.01, 0.01 );
      scene.add( model );

      mixer = new THREE.AnimationMixer( model );
      mixer.clipAction( gltf.animations[ 0 ] ).play();
    }, undefined, function ( e ) {
      console.error( e );
    } );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;
    controls.minDistance = 0.1;
    controls.maxDistance = 1000;
    controls.target.set(0, 0, 0);
    controls.update();

    let isUserHandler = false;
    const setIsUserHandlerFalse = () => {
      isUserHandler = false;
      if (storage.state.operator !== "none" && storage.state.operator !== context.getRoom()?.uid) {
        return;
      }
      storage.setState({ operator: "none" });
    }
    const setIsUserHandlerTrue = () => {
      if (storage.state.operator !== "none" && storage.state.operator !== context.getRoom()?.uid) {
        return;
      }
      storage.setState({ operator: context.getRoom()?.uid });
      isUserHandler = true;
    }
    controls.addEventListener('start', setIsUserHandlerTrue);
    controls.addEventListener('end', setIsUserHandlerFalse);
    controls.addEventListener('change', (event) => {
      if (!isUserHandler) {
        return;
      }

      let isNeedUpdate = false;
      const { cameraPosition, cameraTarget } = storage.state;
      if (camera.position.x !== cameraPosition[0] || camera.position.y !== cameraPosition[1] || camera.position.z !== cameraPosition[2]) {
        isNeedUpdate = true;
      }

      const target = event.target.target;
      if (target.x !== cameraTarget[0] || target.y !== cameraTarget[1] || target.z !== cameraTarget[2]) {
        isNeedUpdate = true
      }

      if (isNeedUpdate) {
        storage.setState({
          operator: context.getRoom()?.uid,
          cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
          cameraTarget: [target.x, target.y, target.z]
        });
      }

    });

    storage.addStateChangedListener((diff) => {
      if (isUserHandler) {
        return;
      }
      if (diff.operator?.newValue) {
        controls.enabled = diff.operator?.newValue === "none" || diff.operator?.newValue === context.getRoom()?.uid;
      }

      let isUpdate = false;
      if (diff.cameraPosition?.newValue) {
        const [x, y, z] = diff.cameraPosition.newValue;
        if (camera.position.x !== x || camera.position.y !== y || camera.position.z !== z) {
          camera.position.set(x, y, z);
          isUpdate = true;
        }
      }

      if (diff.cameraTarget?.newValue) {
        const [x, y, z] = diff.cameraTarget.newValue;
        if (controls.target.x !== x || controls.target.y !== y || controls.target.z !== z) {
          controls.target.set(x, y, z);
          isUpdate = true;
        }
      }

      if (isUpdate) {
        controls.update();
      }
    });
    

    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        const delta = clock.getDelta();
        mixer?.update(delta)
    };
    animate();

    // resize
    function onWindowResize() {
      camera.aspect = $container.clientWidth / $container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize($container.clientWidth, $container.clientHeight);
      renderer.render(scene, camera);
    }
    const resizeObserver = new ResizeObserver(onWindowResize);
    resizeObserver.observe($container);

    context.emitter.on("destroy", () => {
      resizeObserver.unobserve($container);
      $container.remove();
    });
  },
};

export default ModelExporter;
