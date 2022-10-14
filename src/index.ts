import type { NetlessApp } from "@netless/window-manager";
import { ModelShow } from "./ModelShow";

import styles from "./style.css?inline";

const ModelExporter: NetlessApp = {
  kind: "ModelExporter",
  setup(context) {
    const $container = document.createElement('div');
    $container.className = 'model-importer-container';
    const modelShow = new ModelShow({ $container, context });

    modelShow.box.mountStyles(styles);
    modelShow.box.mountContent($container);

    modelShow.loaderExampleModel('https://threejs.org/examples/models/gltf/LittlestTokyo.glb', 'https://threejs.org/examples/js/libs/draco/gltf/')

    context.emitter.on("destroy", () => {
      modelShow.destroy();
    });
  },
};

export default ModelExporter;
