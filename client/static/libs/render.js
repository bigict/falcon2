// initVR
import * as THREE from '../js/three.module.js';
import {VRButton} from '../js/webxr/VRButton.js';
import {OrbitControls} from '../js/controls/OrbitControls.js';
import {OculusHandModel} from '../js/webxr/OculusHandModel.js';
import {XRControllerModelFactory} from '../js/webxr/XRControllerModelFactory.js';
import {df} from './core.js';
import {onTriggerDown} from './gamepad.js';

var container;
var camera, scene, renderer, rayCaster;
var canon = new THREE.Object3D();
var lightType = 0;
// initVR -- controls
var controls, leftController, leftControllerGrip, rightController, rightControllerGrip, leftHand, rightHand;


df.render = {
    vrScene: function () {
        let newScene = new THREE.Scene();
        // 背景: 深蓝色
        newScene.background = new THREE.Color(0x17202A);
        // 创建一个半球光源 HemisphereLight(skyColor, groundColor)
        const hemisphereLight = new THREE.HemisphereLight(0x74B9FF, 0x2C3E50);
        newScene.add(hemisphereLight);
        return newScene;
    },
    vrCamera: function () {
        // 创建透视相机，参数分别是：视场角，宽高比，近剪裁面距离，远剪裁面距离
        let newCamera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.1, 50000);
        // 设置相机初始位置
        newCamera.position.set(0, 1.6, 300);
        return newCamera;
    },
    nonVrControls: function (cameras, divs) {
        return new OrbitControls(cameras, divs);
    },
    addLightsByType: function (lightType) {
        if (lightType === 0) {
            let light = new THREE.DirectionalLight(0xF8D5A3, 1.2);
            light.position.copy(camera.position);
            camera.add(light);
        }
    },
    initSceneGroup: function () {
        // df.group
        // for (let gName in df.GROUP_DICT) {
        //     df.GROUP[gName] = new THREE.Group();
        // }
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
        line.visible = false;
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

        document.body.appendChild(VRButton.createButton(renderer));
        // 监听 vr
        let isImmersive = false;
        renderer.xr.addEventListener('sessionstart', () => {
            isImmersive = true;
        });
        renderer.xr.addEventListener('sessionend', () => {
            isImmersive = false;
        });

        // xr
        // leftController = this.createController(renderer, canon, 1);
        // rightController = this.createController(renderer, canon, 0);
        rayCaster = new THREE.Raycaster();

        // Hand
        leftController = this.createHandController(renderer, canon, 1);
        rightController = this.createHandController(renderer, canon, 0);

        let controllerModelFactory = new XRControllerModelFactory();
        leftControllerGrip = this.createControllerGrip(renderer, canon, controllerModelFactory, 0);
        rightControllerGrip = this.createControllerGrip(renderer, canon, controllerModelFactory, 1);
        // 射线
        let leftLine = this.createControllerLine();
        let rightLine = this.createControllerLine();
        leftController.add(leftLine);
        rightController.add(rightLine);



        leftController.addEventListener('selectstart', function (event) {
            onTriggerDown(event, rayCaster);
        });
        // rightController.addEventListener('selectstart', function (event) {
        //     onTriggerDown(event, rayCaster)
        // });
        leftController.addEventListener('selectend', function (event) {
            // onTriggerUp
            for (let i = 0; i < df.pdbId.length; i++) {
                let pdbId = df.pdbId[i];
                for (let index in df.pdbInfoList) {
                    let name = df.pdbInfoList[index];
                    for (let chain in df.GROUP[pdbId][name]) {
                        // if (!df.GROUP[pdbId][name][chain].visible) continue;
                        let objects = df.GROUP[pdbId][name][chain].children;
                        df.tool.colorIntersectObjectRed(df.GROUP[pdbId][name][chain], 0);
                        // if (objects.length === 0) continue;
                        // let intersected = raster.intersectObjects(objects, true);
                        // if (intersected.length > 0) {

                            // intersected[0].object.material.color.set(0xff0000);
                            // return intersected;
                        // }
                    }
                }
            }
        });

        window.addEventListener('resize', onWindowResize, false);

        // camera.updateProjectionMatrix();

        function animate() {
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
                for (let modeKey in df.GROUP_MAIN_INDEX[pdbId]) {
                    df.tool.clearGroupIndex(df.GROUP_MAIN_INDEX[pdbId]);
                }
                break;
            case 1:
                df.tool.clearGroupIndex(df.GROUP_HET);
                break;
        }
    },
}

export {container, camera, scene, renderer, rayCaster, canon, controls, leftController, leftControllerGrip, rightController, rightControllerGrip, leftHand, rightHand}