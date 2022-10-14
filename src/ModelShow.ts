import * as THREE from "three";
import { AppContext } from "@netless/window-manager/dist/App/AppContext";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import * as dat from "dat.gui";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";

interface ModelShowProps {
	$container: HTMLDivElement;
	context: AppContext;
}

interface PanelData {
	state: boolean;
	handleState: boolean;
	isAutoRotate: boolean;
}

interface syncState {
	cameraPosition: [number, number, number];
	cameraTarget: [number, number, number];
	operator: string;
	panelData: PanelData;
}

export class ModelShow {
	private context: AppContext;
	storage;
	box;
	private readonly $container: HTMLDivElement;
	private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
	private camera = new THREE.PerspectiveCamera();
	private scene = new THREE.Scene();
	private controls = new OrbitControls(this.camera, this.renderer.domElement);
	private exampleMixer: THREE.AnimationMixer | undefined;
	private stats = Stats();
	private clock = new THREE.Clock();
	private resizeObserver: ResizeObserver | undefined;
	private panelGUI: dat.GUI;
	private panelData: PanelData = {
		state: false, // isClosed
		handleState: false,
		isAutoRotate: false,
	}
	private isUserHandler = false;
	private debounceTimer: number | null = null;

	constructor(props: ModelShowProps) {
		this.context = props.context;
		this.box = this.context.getBox();
		this.storage = this.context.createStorage<syncState>("modelExporter", { cameraPosition: [0, 0, 0], cameraTarget: [0, 0, 0], operator: "none", panelData: this.panelData });
		this.$container = props.$container;

		this.panelGUI = new dat.GUI({
			name: "场景控制器",
		});
		this.init();
	}

	private initRenderer() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.autoClearColor = false;
		this.renderer.setSize(this.$container.clientWidth, this.$container.clientHeight);
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		this.$container.appendChild(this.renderer.domElement);
	}

	private initCamera() {
		this.camera = new THREE.PerspectiveCamera(45, this.box.width / this.box.height, 0.1, 1000);
		this.camera.position.set( 5, 2, 8 );
		this.camera.lookAt(0, 0, 0);
	}

	private initScene() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0xbfe3dd );
		const pmremGenerator = new THREE.PMREMGenerator( this.renderer );
		this.scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;
		this.scene.add(this.camera);
	}

	private initLight() {
		// 半球光
		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
		hemiLight.position.set(0, 20, 0);
		this.scene.add(hemiLight);
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
		this.scene.add(dirLight);
		// soft white light
		const light = new THREE.AmbientLight( 0x404040 );
		this.scene.add( light );
	}

	private initControls() {
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.enableZoom = true;
		this.controls.enablePan = true;
		this.controls.enableRotate = true;
		this.controls.autoRotate = false;
		this.controls.autoRotateSpeed = 1;
		this.controls.minDistance = 0.1;
		this.controls.maxDistance = 1000;
		this.controls.enabled = this.context.getIsWritable();
		this.controls.target.set(0, 0, 0);
		this.controls.update();
	}

	private initStats() {
		this.stats.dom.style.position = 'absolute';
		this.$container.appendChild(this.stats.dom);
	}

	private initControllerPanel() {
		this.panelGUI.close();
		this.panelGUI.domElement.style.position = 'absolute';
		this.panelGUI.domElement.style.top = '0px';
		this.panelGUI.domElement.style.right = '0px';
		this.$container.appendChild(this.panelGUI.domElement);
		const handleFolder = this.panelGUI.addFolder('操作');
		const panelObject = {
			'自动旋转': false,
		}
		handleFolder.add(panelObject, '自动旋转', false).onChange((value) => {
			if (this.panelData.isAutoRotate === value) {
				return;
			}
			this.storage.setState({
				panelData: {
					...this.panelData,
					isAutoRotate: value,
				}
			})
		});
		this.panelGUI.domElement.addEventListener('click', () => {
			let isNeedUpdate = false;
			if (this.panelData.state !== this.panelGUI.closed) {
				this.panelData.state = this.panelGUI.closed;
				isNeedUpdate = true;
			}
			if (this.panelData.handleState !== handleFolder.closed) {
				this.panelData.handleState = handleFolder.closed;
				isNeedUpdate = true;
			}
			if (!isNeedUpdate) {
				return;
			}

			this.storage.setState({
				panelData: {
					...this.panelData,
				},
			});
		})
	}

	private init() {
		this.initRenderer();
		this.initCamera();
		this.initScene();
		this.initLight();
		this.initControls();
		this.initStats();
		this.addEvents();
		this.initControllerPanel();
	}

	private setControlsEnabled = (enabled: boolean) => {
		this.controls.enabled = enabled;
	}

	private onWindowResize = () => {
		this.camera.aspect = this.$container.clientWidth / this.$container.clientHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(this.$container.clientWidth, this.$container.clientHeight);
		this.renderer.render(this.scene, this.camera);
	}

	private setUserHandlerFalse = () => {
		this.isUserHandler = false;
		if (this.storage.state.operator == "none" || this.storage.state.operator != this.context.getRoom()?.uid) {
			return;
		}
		this.storage.setState({ operator: "none" });
	}
	private setUserHandlerTrue = () => {
		if (this.storage.state.operator === "none" || this.storage.state.operator == this.context.getRoom()?.uid) {
			this.isUserHandler = true;
		}
	}
	
	private sendSceneData = (event: any) => {
		if (!this.isUserHandler) {
			return;
		}

		let isNeedUpdate = false;
		const { cameraPosition, cameraTarget } = this.storage.state;

		if (this.camera.position.x !== cameraPosition[0] || this.camera.position.y !== cameraPosition[1] || this.camera.position.z !== cameraPosition[2]) {
			isNeedUpdate = true;
		}

		const target = event.target.target;
		if (target.x !== cameraTarget[0] || target.y !== cameraTarget[1] || target.z !== cameraTarget[2]) {
			isNeedUpdate = true
		}

		if (!isNeedUpdate) {
			return;
		}

		if (this.debounceTimer) {
			return;
		} else {
			this.debounceTimer = setTimeout(() => {
				this.storage.setState({
					operator: this.context.getRoom()?.uid,
					cameraPosition: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
					cameraTarget: [target.x, target.y, target.z]
				});
				this.debounceTimer = null;
			}, 50);
		}
	}

	private syncPanelState = (panelData: PanelData) => {
		const { state, handleState, isAutoRotate } = panelData;
		if (state) {
			this.panelGUI.close();
		} else {
			this.panelGUI.open();
		}

		if (handleState) {
			this.panelGUI.__folders['操作'].close();
		} else {
			this.panelGUI.__folders['操作'].open();
		}

		if (this.panelData.isAutoRotate !== isAutoRotate) {
			this.panelData.isAutoRotate = isAutoRotate;
			this.panelGUI.__folders['操作'].__controllers[0].setValue(isAutoRotate);
			this.controls.autoRotate = isAutoRotate;
		}

	}
	
	private receiveSetSceneData = (diff: any) => {
		if (this.isUserHandler) {
			return;
		}
		if (diff.operator?.newValue) {
			this.controls.enabled = diff.operator?.newValue === "none" || diff.operator?.newValue === this.context.getRoom()?.uid;
		}

		if (diff.panelData?.newValue) {
			this.syncPanelState(diff.panelData.newValue);
		}

		let isUpdateScene = false;
		let finaleCameraPosition: THREE.Vector3 | undefined;
		let finaleCameraTarget: THREE.Vector3 | undefined;
		if (diff.cameraPosition?.newValue) {
			const [x, y, z] = diff.cameraPosition.newValue;
			finaleCameraPosition = new THREE.Vector3(x, y, z);
			isUpdateScene = true;
		}

		if (diff.cameraTarget?.newValue) {
			const [x, y, z] = diff.cameraTarget.newValue;
			finaleCameraTarget = new THREE.Vector3(x, y, z);
			isUpdateScene = true;
		}

		if (isUpdateScene) {
			if (finaleCameraPosition) {
				this.camera.position.lerp(finaleCameraPosition, 1);
			}
			if (finaleCameraTarget) {
				this.controls.target.lerp(finaleCameraTarget, 1);
			}
			this.controls.update();
		}
	}

	private addEvents() {
		const animate = () => {
			requestAnimationFrame(animate);
			this.renderer.render(this.scene, this.camera);
			const delta = this.clock.getDelta();
			this.exampleMixer?.update(delta)
			this.controls.update();
			this.stats.update();
		};
		animate();
		this.context.emitter.on("writableChange", this.setControlsEnabled);
		this.resizeObserver = new ResizeObserver(this.onWindowResize);
		this.resizeObserver.observe(this.$container);
		this.controls.addEventListener('start', this.setUserHandlerTrue);
		this.controls.addEventListener('end', this.setUserHandlerFalse);
		this.controls.addEventListener('change', this.sendSceneData);
		this.storage.addStateChangedListener(this.receiveSetSceneData);
	}


	loaderExampleModel(modelUrl: string, decoderUrl: string) {
		const dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath(decoderUrl);
		const loader = new GLTFLoader();
		loader.setDRACOLoader(dracoLoader);
		loader.load( modelUrl, (gltf) => {
			const model = gltf.scene;
			model.position.set( 1, 1, 0 );
			model.scale.set( 0.01, 0.01, 0.01 );
			this.scene.add( model );

			this.exampleMixer = new THREE.AnimationMixer( model );
			this.exampleMixer.clipAction( gltf.animations[ 0 ] ).play();
		}, undefined, function ( e ) {
			console.error( e );
		});
	}

	private loadGLTFModel(modelUrl: string) {
		const loader = new GLTFLoader();
		loader.load(modelUrl, (gltf) => {
			const model = gltf.scene;
			this.scene.add( model );
		})
	}

	private loadOBJModel(modelUrl: string, option?: Option) {
		const mtlUrl = option?.mtlUrl;
		const loader = new OBJLoader();
		if (mtlUrl) {
			const mtlLoader = new MTLLoader();
			mtlLoader.load(mtlUrl, (materials) => {
				loader.setMaterials(materials);
				loader.load(modelUrl, (obj) => {
					this.scene.add(obj);
				})
			});
		} else {
			loader.load(modelUrl, (obj) => {
				this.scene.add(obj);
			})
		}
	}

	loadModel(modelUrl: string, option?: Option) {
		const modelLoaderRelation: { [key: string]: (modelUrl: string, option?: Option) => void } = {
			glb: this.loadGLTFModel,
			gltf: this.loadGLTFModel,
			obj: this.loadOBJModel,
		}
		const modelType = modelUrl.split('.').pop();
		if (modelType && modelLoaderRelation[modelType]) {
			modelLoaderRelation[modelType].call(this, modelUrl, option);
		}
	}

	private removeEvents() {
		this.resizeObserver?.unobserve(this.$container);
	}

	destroy() {
		this.removeEvents();
		this.$container.remove();
	}
}

interface Option {
	mtlUrl?: string;
}