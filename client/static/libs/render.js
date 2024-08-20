// initVR
import * as THREE from '../js/three.module.js';
import {VRButton} from '../js/webxr/VRButton.js';
import {OrbitControls} from '../js/controls/OrbitControls.js';
import {OculusHandModel} from '../js/webxr/OculusHandModel.js';
import {XRControllerModelFactory} from '../js/webxr/XRControllerModelFactory.js';
import {df} from './core.js';
import {onTriggerDown, onTriggerUp} from './gamepad.js';
import {OculusHandPointerModel} from "../js/webxr/OculusHandPointerModel.js";

var container;
var camera, scene, renderer, rayCaster;
var canon = new THREE.Object3D();
var lightType = 0;
// initVR -- controls
var controls, leftController, leftControllerGrip, rightController, rightControllerGrip, leftHand, rightHand;


const createGrid = (size, divisions, position, rotation, grids, scene) => {
    const gridHelper = new THREE.GridHelper(size, divisions);
    gridHelper.position.copy(position);
    gridHelper.rotation.set(rotation.x, rotation.y, rotation.z);
    // gridHelper.visible = false;
    scene.add(gridHelper);
    grids.push(gridHelper);
};


df.dfRender = {
    vrScene: function () {
        let newScene = new THREE.Scene();
        // 背景: 深蓝色
        newScene.background = new THREE.Color(0x17202A);
        // newScene.background = new THREE.Color(0xcccccc);
        // 创建一个半球光源 HemisphereLight(skyColor, groundColor)
        const hemisphereLight = new THREE.HemisphereLight(0x74B9FF, 0x2C3E50);
        newScene.add(hemisphereLight);
        // 创建网格背景
        const size = 20;
        const divisions = 20;
        // const gridHelper = new THREE.GridHelper(size, divisions);
        // newScene.add(gridHelper);
        let grids = []
        // 添加各个方向的网格
        createGrid(size, divisions, new THREE.Vector3(0, 0, 0), new THREE.Euler(0, 0, 0), grids, newScene);
        createGrid(size, divisions, new THREE.Vector3(0, size, 0), new THREE.Euler(0, 0, 0), grids, newScene);
        createGrid(size, divisions, new THREE.Vector3(size / 2, size / 2, 0), new THREE.Euler(0, 0, Math.PI / 2), grids, newScene);
        createGrid(size, divisions, new THREE.Vector3(-size / 2, size / 2, 0), new THREE.Euler(0, 0, -Math.PI / 2), grids, newScene);
        createGrid(size, divisions, new THREE.Vector3(0, size / 2, size / 2), new THREE.Euler(-Math.PI / 2, 0, 0), grids, newScene);
        createGrid(size, divisions, new THREE.Vector3(0, size / 2, -size / 2), new THREE.Euler(Math.PI / 2, 0, 0), grids, newScene);
        return newScene;
    },
    vrCamera: function () {
        // 创建透视相机，参数分别是：视场角，宽高比，近剪裁面距离，远剪裁面距离
        let newCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50000);
        // 设置相机初始位置
        // newCamera.position.set(0, 1.6, 300);
        newCamera.position.set(0, 1.6, 3);
        return newCamera;
    },
    nonVrControls: function (cameras, divs) {
        return new OrbitControls(cameras, divs);
    },
    addLightsByType: function (lightType) {
        if (lightType === 0) {
            let light = new THREE.DirectionalLight(0xF8D5A3, 1.2);
            // let light = new THREE.DirectionalLight(0xFFFFFF, 1.2);
            light.position.copy(camera.position);
            camera.add(light);
        }
    },
    initSceneGroup: function () {
        // df.GROUP.init
        for (let idx in df.GROUP_INDEX) {
            let gName = df.GROUP_INDEX[idx];
            df.GROUP[gName] = new THREE.Group();
            df.GROUP[gName].name = gName;
            if (gName === 'menu') {
                camera.add(df.GROUP[gName]);
            } else {
                scene.add(df.GROUP[gName]);
            }
        }
    },
    initRender: function () {
        let renderer = new THREE.WebGLRenderer({
            antialias: true,
            gammaOutput: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        renderer.xr.enabled = true;
        return renderer;
    },
    createController: function (renderer, camera, num) {
        let controller = renderer.xr.getController(num);
        camera.add(controller);
        return controller;
    },
    createControllerGrip: function (renderer, camera, modelFactory, num) {
        let controllerGrip = renderer.xr.getControllerGrip(num);
        controllerGrip.add(modelFactory.createControllerModel(controllerGrip));
        camera.add(controllerGrip);
        return controllerGrip;
    },
    createControllerLine: function () {
        let geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
        let material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 100,
            blending: THREE.AdditiveBlending
        });
        let line = new THREE.Line(geometry, material);
        line.name = 'line';
        line.scale.z = 5;
        line.visible = true;
        return line;
    },
    createHandController: function (renderer, camera, num) {
        let hand = renderer.xr.getHand(num);
        let handModel = new OculusHandModel(hand);

        hand.add(handModel);
        camera.add(hand);
        return hand;
    },
    initVR: function () {
        // 创建一个模块
        container = document.createElement('div');
        document.body.appendChild(container);
        // Scene
        scene = this.vrScene();
        // Camera
        camera = this.vrCamera();
        // 移动 Camera
        canon.add(camera);
        scene.add(canon);
        // 在 web 页面中旋转移动 pdb
        controls = this.nonVrControls(camera, container);
        controls.target.set(0, 1.6, 0);
        controls.update();
        // 初始化 scene group;
        this.initSceneGroup();
        this.addLightsByType(lightType);
        // init VR render
        renderer = this.initRender();

        const sessionInit = {
            requiredFeatures: ['hand-tracking']
        };

        document.body.appendChild(VRButton.createButton(renderer, sessionInit));
        // 监听 vr
        let isImmersive = false;
        renderer.xr.addEventListener('sessionstart', () => {
            df.scale = 1;
            // df.scale = 1
            for (let argumentsKey in df.pdbText) {
                for (let i in df.GROUP[argumentsKey]['main']) {
                    let aaa = df.GROUP[argumentsKey]['main'][i];
                    aaa.scale.set(df.scale, df.scale, df.scale);
                    // df.tool.vrCameraCenter(canon, camera, aaa);
                }
            }
            isImmersive = true;
        });
        renderer.xr.addEventListener('sessionend', () => {
            isImmersive = false;
        });

        // xr
        leftController = this.createController(renderer, canon, 1);
        rightController = this.createController(renderer, canon, 0);
        rayCaster = new THREE.Raycaster();

        // Hand
        leftHand = this.createHandController(renderer, canon, 1);
        rightHand = this.createHandController(renderer, canon, 0);

        let controllerModelFactory = new XRControllerModelFactory();
        leftControllerGrip = this.createControllerGrip(renderer, canon, controllerModelFactory, 1);
        rightControllerGrip = this.createControllerGrip(renderer, canon, controllerModelFactory, 0);
        const leftControllerPointer = new OculusHandPointerModel(leftHand, leftController);
        const rightControllerPointer = new OculusHandPointerModel(rightHand, rightController);
        leftHand.add(leftControllerPointer);
        rightHand.add(rightControllerPointer);
        // 射线
        let leftLine = this.createControllerLine();
        let rightLine = this.createControllerLine();
        leftController.add(leftLine);
        rightController.add(rightLine);

        leftController.addEventListener('selectstart', function (event) {
            let leftTempMatrix = new THREE.Matrix4();
            df.tool.initPDBView(df.SelectedPDBId);
            // df.tool.vrCameraCenter(canon, df.GROUP['1cbs']['main']['a'].children[10]);
            onTriggerDown(event, rayCaster, leftTempMatrix);
        });
        rightController.addEventListener('selectstart', function (event) {
            let rightTempMatrix = new THREE.Matrix4();
            onTriggerDown(event, rayCaster, rightTempMatrix)
        });
        leftController.addEventListener('selectend', function (event) {
            onTriggerUp(event);
        });
        rightController.addEventListener('selectend', function (event) {
            onTriggerUp(event);
        });
        window.addEventListener('resize', onWindowResize, false);

        // camera.updateProjectionMatrix();
        function animate() {
            // 选中 residue 并拖拽
            if (df.selection === df.select_residue) {
                if (df.SELECTED_RESIDUE.type === df.MeshType) {
                    if (df.config.mainMode === df.CARTOON_SSE) {
                        // 根据 select residue 获取 residue信息
                        let meshInfo = df.SELECTED_RESIDUE.userData.presentAtom
                        let meshId = meshInfo.id;
                        let meshPos = new THREE.Vector3(meshInfo.pos.x, meshInfo.pos.y, meshInfo.pos.z);
                        let molId = meshInfo.pdbId;
                        let controller_mesh = df.SELECTED_RESIDUE.matrixWorld;
                        // if (df.SELECTED_RESIDUE.controller) {
                        //     controller_mesh = df.SELECTED_RESIDUE.controller
                        // }
                        meshPos.applyMatrix4(controller_mesh);
                        let x = meshPos.x / ((df.scale));
                        let y = meshPos.y / ((df.scale));
                        let z = meshPos.z / ((df.scale));

                        // console.log("xyz", x, y, z)
                        // 修改 df.PathList 对应坐标
                        for (let k in df.PathList[0]) {
                            if (df.PathList[0][k][0] === meshId) {
                                df.PathList[0][k][1][0] = parseFloat(x.toFixed(3));
                                df.PathList[0][k][1][1] = parseFloat(y.toFixed(3));
                                df.PathList[0][k][1][2] = parseFloat(z.toFixed(3));
                            }
                        }
                        // let posDIct = {'matrixWorld': df.SELECTED_RESIDUE.matrixWorld}
                        let posDIct = {}
                        posDIct = df.tool.getResidueNewPos(df.SELECTED_RESIDUE, posDIct)
                        df.dfRender.changePDBData(posDIct);
                        df.tool.changeFrame(molId, meshId);
                        df.dfRender.clear(0);
                        // 重新生成 residue 结构
                        // df.painter.showAllResidues(df.config.mainMode, df.SelectedPDBId);
                        df.controller.drawGeometry(df.config.mainMode, df.SelectedPDBId);
                        for (let i in df.GROUP[df.SelectedPDBId]['main']) {
                            let aaa = df.GROUP[df.SelectedPDBId]['main'][i];
                            aaa.scale.set(df.scale, df.scale, df.scale);
                            // df.tool.vrCameraCenter(camera, aaa.children[10]);
                        }
                    }
                }
            }
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
        }

        controls.update();
        renderer.setAnimationLoop(animate);

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    },
    // todo
    clear: function (mode, pdbId) {
        THREE.Cache.clear();
        switch (mode) {
            case 0:
                for (let modeKey in df.GROUP[df.SelectedPDBId]) {
                    df.tool.clearGroupIndex(df.GROUP[df.SelectedPDBId][modeKey]);
                }
                break;
            case 1:
                df.tool.clearGroupIndex(df.GROUP_HET);
                break;
        }
    },
    changePDBData: function (resDict) {
        let key = Object.keys(resDict)
        console.log("resDict", resDict)
        if (!key || key.length === 0) {
            return ''
        }
        let pdbId = key[0].split("_")[0];
        let PDBFormat = "";
        if (df.pdbText[pdbId].length > 0) {
            const text = df.pdbText[pdbId].split('\n');
            for (let i = 0; i < text.length; i++) {
                let line = text[i];
                let line_atom = w3m_sub(line, 0, 6).toLowerCase();
                switch (line_atom) {
                    case 'atom':
                        const residue_id = w3m_sub(line, 23, 27);
                        const atom_name = w3m_sub(line, 13, 16).toLowerCase();
                        const atom_chain = w3m_sub(line, 22) || 'x';
                        let keys = pdbId + "_" + atom_chain + "_" + residue_id + "_" + atom_name;
                        if (resDict.hasOwnProperty(keys)) {
                            const b_x = (resDict[keys].x / df.scale).toFixed(3);
                            const b_y = (resDict[keys].y / df.scale).toFixed(3);
                            const b_z = (resDict[keys].z / df.scale).toFixed(3);
                            line = line.replace(w3m_sub(line, 31, 38).padStart(8, ' '), b_x.padStart(8, ' '));
                            line = line.replace(w3m_sub(line, 39, 46).padStart(8, ' '), b_y.padStart(8, ' '));
                            line = line.replace(w3m_sub(line, 47, 54).padStart(8, ' '), b_z.padStart(8, ' '));
                        }
                        PDBFormat = PDBFormat + line + "\n";
                        break;
                    case 'hetatm':
                        PDBFormat = PDBFormat + line + "\n";
                        break;
                    default:
                        PDBFormat = PDBFormat + line + "\n";
                        break;
                }
                // switch (df.config.mainMode) {
                //     case df.BALL_AND_ROD:
                //
                //         break;
                //     case df.CARTOON_SSE:
                //         switch (line_atom) {
                //             case 'atom':
                //                 const residue_id = w3m_sub(line, 23, 27);
                //                 const atom_name = w3m_sub(line, 13, 16).toLowerCase();
                //                 const atom_chain = w3m_sub(line, 22) || 'x';
                //                 let keys = pdbId + "_" + atom_chain + "_" + residue_id + "_" + atom_name;
                //                 let subkeys = pdbId + "_" + atom_chain + "_" + residue_id;
                //                 if (resDict.hasOwnProperty(keys)) {
                //                     const b_x = (resDict[keys].x / df.scale).toFixed(3);
                //                     const b_y = (resDict[keys].y / df.scale).toFixed(3);
                //                     const b_z = (resDict[keys].z / df.scale).toFixed(3);
                //                     line = line.replace(w3m_sub(line, 31, 38).padStart(8, ' '), b_x.padStart(8, ' '));
                //                     line = line.replace(w3m_sub(line, 39, 46).padStart(8, ' '), b_y.padStart(8, ' '));
                //                     line = line.replace(w3m_sub(line, 47, 54).padStart(8, ' '), b_z.padStart(8, ' '));
                //                 } else if (Object.keys(resDict).some(key => key.includes(subkeys))) {
                //                     const b_x = (resDict[keys].x / df.scale).toFixed(3);
                //                     const b_y = (resDict[keys].y / df.scale).toFixed(3);
                //                     const b_z = (resDict[keys].z / df.scale).toFixed(3);
                //                     line = line.replace(w3m_sub(line, 31, 38).padStart(8, ' '), b_x.padStart(8, ' '));
                //                     line = line.replace(w3m_sub(line, 39, 46).padStart(8, ' '), b_y.padStart(8, ' '));
                //                     line = line.replace(w3m_sub(line, 47, 54).padStart(8, ' '), b_z.padStart(8, ' '));
                //                 }
                //                 // Object.keys(resDict).filter(key => key.includes(subkeys));
                //
                //                 PDBFormat = PDBFormat + line + "\n";
                //                 break;
                //             case 'hetatm':
                //                 PDBFormat = PDBFormat + line + "\n";
                //                 break;
                //             default:
                //                 PDBFormat = PDBFormat + line + "\n";
                //                 break;
                //         }
                //         break;
                //         break;
                // }

            }
        }
        df.pdbText[pdbId] = PDBFormat;
        return PDBFormat;
    }
}

window.df = df;

export {
    container,
    camera,
    scene,
    renderer,
    rayCaster,
    canon,
    controls,
    leftController,
    leftControllerGrip,
    rightController,
    rightControllerGrip,
    leftHand,
    rightHand
}
