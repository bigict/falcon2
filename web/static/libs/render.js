/**
 * Created by Kui XU on 2017/07/08.
 * mail: xukui.cs@gmail.com
 */
var container;
var camera, scene, renderer, statsVR;
var splineCamera, parent, group;
var cameraEye, menu_panel;
var binormal = new THREE.Vector3();
var normal = new THREE.Vector3();
var scale = 4;
var controls, controller1, controllerGrip1, vrEffect, vrControls, controller2;

var XR_VERSION = 1;
var raycasterFor3;
var mouse = new THREE.Vector2(),
    INTERSECTED;
var radius = 100,
    theta = 0;
var raycaster, intersected = [];
var tempMatrix = new THREE.Matrix4();

// add more 3 lights
var lightType = 0;
// controls type
var controlsType = 0;
//
var showMenu = false;

//======= Travel in the VR =======
var curve0, train0;

var position0 = new THREE.Vector3();
var tangent0 = new THREE.Vector3();

var lookAt0 = new THREE.Vector3();

var velocity0 = 0;
var progress0 = 0;

var prevTime0 = performance.now();
//================================
var tmpTime = 0;

var ThumbpadAxes = [];
var id = 0;


let train = new THREE.Object3D();

var ChangePDBLock = 0;


//=======webxr=====

let isImmersive = false;
let revocationFrame = 0;
const type_a = "button_a";
const type_b = "button_b";

var DOING = 0;
var STATE = {};


function process_button(type, component) {
    if (component.values.state === Constants.ComponentState.DEFAULT && PDB.HANDLER_ROTATION !== 0) {
        switch (component.gamepadIndices.button) {
            case 4:
                if (component.values.state === "default") {
                    PDB.HANDLER_ROTATION = 0;
                }
                break;
        }
    }
    if (component.values.state === Constants.ComponentState.PRESSED && DOING === 0) {
        switch (type) {
            case Constants.ComponentType.TRIGGER:
                break;
            case Constants.ComponentType.SQUEEZE:
                onMenuDown();
                DOING = 1;
                STATE[type] = 1;
                break;
            case Constants.ComponentType.BUTTON:
                switch (component.gamepadIndices.button) {
                    case 4:
                        onRotationDown();
                        DOING = 1;
                        STATE[type_a] = 1;
                        break;
                    case 5:
                        revocationFrame += 1
                        if (revocationFrame === 1) {
                            revocation();
                        }
                        DOING = 1;
                        STATE[type_b] = 1;
                        break;
                }
                break;
            // default:
            //     throw new Error(`Unexpected ComponentType ${type}`);
        }

    } else if (component.values.state === Constants.ComponentState.TOUCHED) {
        switch (type) {
            case Constants.ComponentType.THUMBSTICK:
                ThumbpadAxes = [component.values.xAxis, component.values.yAxis]
                onThumbpadDown(event);
                // DOING = 1;
                // STATE[type] = 1;
                break;
        }
        // else if (component.values.state === Constants.ComponentState.TOUCHED && DOING === 0) {
        //     switch (type) {
        //         case Constants.ComponentType.THUMBSTICK:
        //             ThumbpadAxes = [component.values.xAxis, component.values.yAxis]
        //             onThumbpadDown(event);
        //             // DOING = 1;
        //             // STATE[type] = 1;
        //             break;
        //     }
        //     console.log(ThumbpadAxes);
    } else if (component.values.state === Constants.ComponentState.DEFAULT && DOING === 1) {
        switch (type) {
            case Constants.ComponentType.TRIGGER:
                break;
            case Constants.ComponentType.SQUEEZE:
                if (STATE[type] === 1) {
                    DOING = 0;
                    STATE[type] = 0;
                }
                break;
            // case Constants.ComponentType.TOUCHPAD:
            //     if (STATE[type] === 1) {
            //         onThumbpadUp(event);
            //         DOING = 0;
            //         STATE[type] = 0;
            //     }
            //     break;
            // case Constants.ComponentType.THUMBSTICK:
            //     if (STATE[type] === 1) {
            //         onThumbpadUp(event);
            //         DOING = 0;
            //         STATE[type] = 0;
            //     }
            //     break;
            case Constants.ComponentType.BUTTON:
                switch (component.gamepadIndices.button) {
                    case 5:
                        if (STATE[type_b] === 1) {
                            STATE[type_b] = 0;
                            DOING = 0;
                            revocationFrame = 0;
                        }
                        break;
                }
                break;
            // default:
            //     throw new Error(`Unexpected ComponentType ${type}`);
        }
    }
}


function listen_button() {
    if (controllerGrip1 !== null && controllerGrip1.children.length > 0 && controllerGrip1.children[0].motionController !== null) {
        components = controllerGrip1.children[0].motionController.components;
        Object.keys(components).forEach((componentId) => {
            type = components[componentId].type;
            process_button(type, components[componentId]);
        });
    }
}

function onAxisChanged(event) {
    var controller = event.target;
    ThumbpadAxes = event.axes;
}

function onMenuUp(event) {
    // var controller = event.target;
}

function onMenuDown() {
    if (PDB.TravelMode) {
        PDB.render.changeToVrMode(PDB.MODE_VR, false);
    } else {
        if (!PDB.isShowMenu) {
            PDB.isShowMenu = true;
            PDB.render.showMenu();
            PDB.painter.showMenu(PDB.MENU_TYPE_CURRENT);
        } else {
            PDB.isShowMenu = false;
            PDB.render.hideMenu();
        }
    }
    PDB.render.clearGroupIndex(PDB.GROUP_INFO);
}


var action = 0;

function onThumbpadUp(event) {
    window.clearInterval(id);
    PDB.ROTATION_START_FLAG = false;
}

function onXDown(event) {
    if (PDB.OITYPE === false) {
        PDB.OITYPE = true;
        OperatingInstructions()
        PDB.render.hideStructure();
    } else {
        PDB.OITYPE = false;
        PDB.render.showStructure();
        scene.remove(PDB.OPERAINS);
        PDB.OPERAINS = 0
    }
}

function onThumbpadDown(event) {
    // window.clearInterval(id);
    let x = ThumbpadAxes[0];
    let y = ThumbpadAxes[1];

    const speed = 1;

    const moveX = x * speed;
    const moveZ = y * speed;

    train.position.x += moveX;
    train.position.z += moveZ;

    // if ((y <= -0.5 && x >= -0.5 && x <= 0) || (y <= -0.5 && x <= 0.5 && x >= 0)) {
    // if (y > 0.7) {
    // if (y > 1) {
    //     action = 1;
    //     // } else if ((y >= 0.5 && x >= -0.5 && x <= 0) || (y >= 0.5 && x <= 0.5 && x >= 0)) {
    //     // } else if (y <-0.7) {
    // } else if (y < -1) {
    //     action = 2;
    //     // } else if ((x <= -0.5 && y >= -0.5 && y <= 0) || (x <= -0.5 && y <= 0.5 && y >= 0)) {
    //     // } else if (x < -0.7) {
    // } else if (x < -1) {
    //     action = 3;
    //     // } else if ((x >= 0.5 && y >= -0.5 && y <= 0) || (x >= 0.5 && y <= 0.5 && y >= 0)) {
    //     // } else if (x > 0.7 ) {
    // } else if (x > 1) {
    //     action = 4;
    // }

    // switch (action) {
    //     case 0:
    //         break;
    //     case 1:
    //         id = self.setInterval("PDB.painter.near()", 20);
    //         break;
    //     case 2:
    //         id = self.setInterval("PDB.painter.far()", 20);
    //         break;
    //     case 3:
    //         PDB.ROTATION_DIRECTION = 0;
    //         id = self.setInterval("PDB.painter.rotate()", 20);
    //         break;
    //     case 4:
    //         PDB.ROTATION_DIRECTION = 1;
    //         id = self.setInterval("PDB.painter.rotate()", 20);
    //         break;
    // }


}

function dealwithMenu(object) {
    if (object === undefined || object.userData === undefined) {
        return;
    }
    var groupindex = "";
    if (object.userData.group !== undefined) {
        groupindex = object.userData["group"];
    } else {
        return;
    }

    if (object.name !== undefined) {
        if (groupindex == PDB.GROUP_KEYBOARD) {
            PDB.painter.showInput(object.name);
        }
    }
    var curr_reptype = "";
    if (object.userData.reptype !== undefined && object.userData.reptype !== "") {
        curr_reptype = object.userData.reptype;
    } else {
        return;
    }

    switch (groupindex) {
        case PDB.GROUP_MENU:
            if (!PDB.isShowMenu) {
                PDB.render.showMenu();
            } else {
                PDB.render.hideSubMenu();
                PDB.MENU_TYPE_CURRENT = curr_reptype;
                PDB.painter.showMenu(curr_reptype);
            }
            break;
        case PDB.GROUP_MENU_VIS:
            var type = object.userData.reptype;
            switch (type) {
                case 0:
                    document.getElementById("vrMode2").style.display = "none";
                    window.location.href = "index.html?vmode=desktop";
                    break;
                case 1:
                    document.getElementById("vrMode2").style.display = "none";
                    window.location.href = "index.html?vmode=vr";
                    break;
                case 2:
                    if (PDB.loadType === PDB.bigmodel) {
                        PDB.loadType = PDB.smallmodel;
                    } else if (!this.checked) {
                        PDB.loadType = PDB.bigmodel;
                    }
                    PDB.render.clear(2);
                    PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
                    PDB.render.clear(5);
                    PDB.config.hetMode = PDB.config.hetMode;
                    PDB.controller.refreshGeometryByMode(PDB.config.hetMode);
                    break;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_MAIN:
            if (curr_reptype !== PDB.HIDE) {
                PDB.render.clear(5);
                PDB.config.mainMode = curr_reptype;
                PDB.controller.refreshGeometryByMode(curr_reptype);
            } else {
                PDB.render.clear(0);
                PDB.render.clear(1);
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_SPEECH:
            switch (curr_reptype) {
                case 0:
                    console.log("----------------startRecording")
                    startRecording();
                    break;
                case 1:
                    endRecord();
                    onMenuDown();
                    break;
                case 2:
                    voiceControl.language = "Chinese";
                    break;
                case 3:
                    voiceControl.language = "English";
                    break;
            }
            break;
        case PDB.GROUP_MENU_HET:
            if (curr_reptype !== PDB.HIDE) {
                PDB.render.clear(5);
                PDB.config.hetMode = curr_reptype;
                PDB.controller.refreshGeometryByMode(curr_reptype);
            } else {
                PDB.render.clear(1);
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_LABEL:
            PDB.trigger = PDB.TRIGGER_EVENT_LABEL;
            PDB.selection_mode = curr_reptype;
            onMenuDown();
            break;
        case PDB.GROUP_MENU_TRAVEL:
            onMenuDown();
            PDB.CHANGESTYLE = 6;
            PDB.render.changeToVrMode(PDB.MODE_TRAVEL_VR, true);
            PDB.painter.showResidueByThreeTravel();
            break;
        case PDB.GROUP_MENU_EX_HET:
            switch (curr_reptype) {
                case 1:
                    if (PDB.isShowWater) {
                        PDB.isShowWater = !PDB.isShowWater;
                    } else {
                        PDB.isShowWater = !PDB.isShowWater;
                        PDB.painter.showWater();
                    }
                    break;
                case 2:
                    PDB.isShowWater = !PDB.isShowAxis;
                    PDB.tool.showAxis(PDB.isShowAxis);
                    break;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_COLOR:
            if (curr_reptype == 'Conservation') {
                var chain = "A";
                var url = PDB.CONSERVATION_URL + "&pdbid=" + PDB.pdbId.toUpperCase() + "&chain=" + chain;
                if (ServerType != 2) {
                    url = SERVERURL + "/data/conservation.json";
                }
                PDB.tool.ajax.get(url, function (text) {
                    PDB.controller.clear(4, undefined);
                    PDB.painter.showConservation(text);
                    PDB.render.clearMain();
                    PDB.controller.drawGeometry(PDB.config.mainMode);
                    onMenuDown();
                })
            } else {
                PDB.controller.switchColorBymode(object.userData.reptype);
                onMenuDown();
            }
            break;
        case PDB.GROUP_MENU_MEASURE:
            PDB.controller.switchMeasureByMode(object.userData.reptype);
            onMenuDown();
            break;
        case PDB.GROUP_MENU_DRAG:
            var type = object.userData.reptype;
            if (curr_reptype === "exit") {
                PDB.trigger = PDB.TRIGGER_EVENT_LABEL;
            } else if (type === 0) {
                PDB.tool.backToInitialPositionForVr();
            } else {
                PDB.controller.switchDragByMode(object.userData.reptype);
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_FRAGMENT:
            if (curr_reptype !== "exit") {
                PDB.selection_mode = PDB.SELECTION_RESIDUE;
                PDB.controller.switchFragmentByMode(curr_reptype);
            } else {
                PDB.trigger = PDB.TRIGGER_EVENT_LABEL;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_EDITING:
            if (curr_reptype !== "exit") {
                PDB.controller.switchEditingByMode(curr_reptype);
            } else {
                PDB.trigger = PDB.TRIGGER_EVENT_LABEL;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_SURFACE:
            PDB.render.clear(5);
            var type = object.userData.reptype;
            switch (type) {
                case 0:
                    PDB.GROUP[PDB.GROUP_SURFACE].visible = false;
                    PDB.render.clearGroupIndex(PDB.GROUP_SURFACE);
                    break;
                case 1:
                    PDB.GROUP[PDB.GROUP_SURFACE].visible = true;
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, 1, PDB.SURFACE_OPACITY, PDB.SURFACE_WIREFRAME);
                    break;
                case 2:
                    PDB.GROUP[PDB.GROUP_SURFACE].visible = true;
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, 2, PDB.SURFACE_OPACITY, PDB.SURFACE_WIREFRAME);
                    break;
                case 3:
                    PDB.GROUP[PDB.GROUP_SURFACE].visible = true;
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, 3, PDB.SURFACE_OPACITY, PDB.SURFACE_WIREFRAME);
                    break;
                case 4:
                    PDB.GROUP[PDB.GROUP_SURFACE].visible = true;
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, 4, PDB.SURFACE_OPACITY, PDB.SURFACE_WIREFRAME);
                    break;
                case 5:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, 1.0, PDB.SURFACE_WIREFRAME);
                    break;
                case 6:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, 0.9, PDB.SURFACE_WIREFRAME);
                    break;
                case 7:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, 0.8, PDB.SURFACE_WIREFRAME);
                    break;
                case 8:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, 0.7, PDB.SURFACE_WIREFRAME);
                    break;
                case 9:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, 0.6, PDB.SURFACE_WIREFRAME);
                    break;
                case 10:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, 0.5, PDB.SURFACE_WIREFRAME);
                    break;
                case 11:
                    PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, PDB.SURFACE_OPACITY, !PDB.SURFACE_WIREFRAME);
                    break;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_MUTATION:
            var type = object.userData.reptype;
            var mutationType = 1;
            switch (type) {
                case 1:
                    PDB.render.clearGroupIndex(PDB.GROUP_MUTATION);
                    break;
                case 2:
                    mutationType = 2;
                    var url = PDB.MUTATION_URL + "&pdbid=" + PDB.pdbId.toUpperCase() + "&ds=tcga";
                    if (ServerType !== 2) {
                        url = SERVERURL + "/data/mutation.json";
                    }
                    PDB.tool.ajax.get(url, function (text) {
                        PDB.controller.clear(4, undefined);
                        PDB.painter.showMutation(text);
                    })
                    break;
                case 3:
                    mutationType = 3;
                    var url = PDB.MUTATION_URL + "&pdbid=" + PDB.pdbId.toUpperCase() + "&ds=ccle";
                    if (ServerType !== 2) {
                        url = SERVERURL + "/data/mutation.json";
                    }
                    PDB.tool.ajax.get(url, function (text) {
                        PDB.controller.clear(4, undefined);
                        PDB.painter.showMutation(text);
                    })
                    break;
                case 4:
                    mutationType = 4;
                    var url = PDB.MUTATION_URL + "&pdbid=" + PDB.pdbId.toUpperCase() + "&ds=exac";
                    if (ServerType !== 2) {
                        url = SERVERURL + "/data/mutation.json";
                    }
                    PDB.tool.ajax.get(url, function (text) {
                        PDB.controller.clear(4, undefined);
                        PDB.painter.showMutation(text);
                    })
                    break;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_ROTATION:
            PDB.ROTATION_AXIS = object.userData.reptype;
            if (PDB.ROTATION_AXIS == 1) {
                PDB.MOVE_AXIS = 2;
            } else if (PDB.ROTATION_AXIS == 2) {
                PDB.MOVE_AXIS = 1;
            } else if (PDB.ROTATION_AXIS == 3) {
                PDB.MOVE_AXIS = 3;
            }
            //PDB.MOVE_DIRECTION = PDB.ROTATION_AXIS;
            onMenuDown();
            break;
        case PDB.GROUP_MENU_DIRECTION:
            var type = object.userData.reptype;
            switch (type) {
                case 1:
                    PDB.MOVE_AXIS = type;
                    break;
                case 2:
                    PDB.MOVE_AXIS = type;
                    break;
                case 3:
                    PDB.MOVE_AXIS = type;
                    break;
                case 4:
                    PDB.ZOOM_TIMES = 1;
                    break;
                case 5:
                    PDB.ZOOM_TIMES = 2;
                    break;
                case 6:
                    PDB.ZOOM_TIMES = 4;
                    break;
            }
            onMenuDown();
            break;
        case PDB.GROUP_MENU_OUTBALL:
            PDB.loadType = object.userData.reptype;
            if (PDB.loadType == PDB.bigmodel) {
                document.getElementById("isLow").checked = true;
            } else {
                document.getElementById("isLow").checked = false;
            }

            onMenuDown();
            PDB.render.clear(2);
            PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
            break;
        case PDB.GROUP_MENU_DRUG:
            switch (curr_reptype) {
                case 1:
                    // PDB.GROUP[PDB.GROUP_DRUG].visible = false;
                    // if(PDB.GROUP[PDB.GROUP_DRUG].visible === false){
                    // PDB.DRUGMOVE = false;
                    // }
                    PDB.DRUGMOVE = false;
                    PDB.render.clearGroupIndex(PDB.GROUP_DRUG);
                    PDB.render.clearGroupIndex(PDB.GROUP_VR_MENU_DOCKING);
                    PDB.render.clearGroupIndex(PDB.GROUP_VR_MENU_DRUG);
                    PDB.selection_mode = PDB.SELECTION_RESIDUE;
                    break;
                case 2:
                    var url = API_URL + "/server/api.php?taskid=12&pdbid=" + PDB.pdbId.toUpperCase();
                    if (ServerType !== 2) {
                        url = SERVERURL + "/data/drug.json";
                    }
                    PDB.selection_mode = PDB.SELECTION_DRUG_LIST;
                    PDB.tool.showDrugMenuForVr(url);
                    break;
                case 3:
                    PDB.tool.generateDrugMigrationPath();
                    PDB.DRUGMOVE = true;
                    PDB.drugMoveTime = new Date();
                    break;
                case 4:
                    if (PDB.GROUP[PDB.GROUP_BOX_HELPER] !== undefined && PDB.GROUP[PDB.GROUP_BOX_HELPER].visible) {
                        PDB.GROUP[PDB.GROUP_BOX_HELPER].visible = false;
                    } else if (PDB.GROUP[PDB.GROUP_BOX_HELPER] !== undefined && !PDB.GROUP[PDB.GROUP_BOX_HELPER].visible) {
                        PDB.GROUP[PDB.GROUP_BOX_HELPER].visible = true;
                    }
                    break;
                case 5:
                    if (PDB.GROUP[PDB.GROUP_SURFACE_HET] !== undefined
                        && PDB.GROUP[PDB.GROUP_SURFACE_HET].children != undefined
                        && PDB.GROUP[PDB.GROUP_SURFACE_HET].children.length > 0) {
                        PDB.render.clearGroupIndex(PDB.GROUP_SURFACE_HET);
                    } else {
                        PDB.painter.showDrugSurface(PDB.config.selectedDrug);
                    }
                    break;
            }
            onMenuDown();
            break;
        case PDB.GROUP_VR_MENU_DRUG:
            console.log(object.userData.reptype);
            break;
        case PDB.GROUP_MENU_DENSITYMAP:
            var type = object.userData.reptype;
            if (PDB.EMMAP.DATA != undefined && PDB.EMMAP.DATA.data != undefined) {
                var emmap = PDB.EMMAP.DATA;
                if (type === 1) {
                    PDB.SHOWSOLID = true;
                    PDB.map_surface_show = 0;
                    PDB.render.clearGroupIndex(PDB.GROUP_MAP);
                    PDB.painter.showMapSolid(emmap, emmap.threshold);
                } else if (type === 2) {
                    if (PDB.map_surface_show === 0) {
                        PDB.render.clearGroupIndex(PDB.GROUP_MAP);
                        PDB.painter.showMapSurface(emmap, emmap.threshold, false);
                    } else {
                        var surfaceGroup = PDB.GROUP[PDB.GROUP_MAP];
                        if (surfaceGroup !== undefined && surfaceGroup.children != undefined && surfaceGroup.children.length > 0 &&
                            surfaceGroup.children[0] instanceof THREE.Mesh) {
                            var mesh = PDB.GROUP[PDB.GROUP_MAP].children[0];
                            if (mesh.material !== undefined) {
                                mesh.material.wireframe = false;
                            }
                        }
                    }
                    PDB.map_surface_show = 1;
                } else if (type === 3) {
                    if (PDB.map_surface_show === 0) {
                        PDB.render.clearGroupIndex(PDB.GROUP_MAP);
                        PDB.painter.showMapSurface(emmap, emmap.threshold, true);
                    } else {
                        var surfaceGroup = PDB.GROUP[PDB.GROUP_MAP];
                        if (surfaceGroup !== undefined && surfaceGroup.children != undefined && surfaceGroup.children.length > 0 &&
                            surfaceGroup.children[0] instanceof THREE.Mesh) {
                            var mesh = PDB.GROUP[PDB.GROUP_MAP].children[0];
                            if (mesh.material !== undefined) {
                                mesh.material.wireframe = true;
                            }
                        }
                    }
                    PDB.map_surface_show = 1;
                } else if (type === 4) {
                    PDB.map_surface_show = 0;
                    PDB.render.clearGroupIndex(PDB.GROUP_MAP);
                }
                onMenuDown();
            } else {
                var url = API_URL_EMMAP + PDB.pdbId.toUpperCase();
                PDB.tool.ajax.get(url, function (text) {
                    //PDB.render.clear(2);
                    PDB.MATERIALLIST = [];
                    if (PDB.MATERIALLIST.length == 0) {
                        for (var i = 1000; i < 1100; i++) {
                            var material = new THREE.MeshPhongMaterial({
                                color: new THREE.Color(w3m.rgb[i][0], w3m.rgb[i][1], w3m.rgb[i][2]),
                                wireframe: false,
                                side: THREE.DoubleSide
                            });
                            PDB.MATERIALLIST.push(material);
                        }
                    }
                    var jsonObj = JSON.parse(text);
                    if (jsonObj.code === 1 && jsonObj.data !== undefined) {

                        var data = jsonObj.data;

                        if (PDB.EMMAP.FIRST_ID === 0 && data.length > 0) {
                            PDB.EMMAP.FIRST_ID = data[0];
                        }

                        var mapserver = jsonObj.method;
                        if (PDB.DEBUG_MODE == 1) {
                            mapserver = "map-local";
                        }

                        PDB.controller.emmapLoad(PDB.EMMAP.FIRST_ID, mapserver, function (emmap) {
                            // PDB.render.clearStructure();
                            if (type === 1) {
                                PDB.SHOWSOLID = true;
                                PDB.map_surface_show = 0;
                                PDB.painter.showMapSolid(emmap, emmap.threshold);
                            } else if (type === 2) {
                                PDB.painter.showMapSurface(emmap, emmap.threshold, false);
                                PDB.map_surface_show = 1;
                            } else if (type === 3) {
                                PDB.painter.showMapSurface(emmap, emmap.threshold, true);
                                PDB.map_surface_show = 1;
                            } else if (type === 4) {
                                PDB.map_surface_show = 0;
                                PDB.render.clearGroupIndex(PDB.GROUP_MAP);
                            }
                            onMenuDown();
                        })
                    }
                })
            }
            break;
        case PDB.GROUP_MENU_CONSERVATION:
            var type = object.userData.reptype;
            var chain = "A";
            var url = PDB.CONSERVATION_URL + "&pdbid=" + PDB.pdbId.toUpperCase() + "&chain=" + chain;
            PDB.tool.ajax.get(url, function (text) {
                PDB.controller.clear(4, undefined);
                PDB.painter.showConservation(text);
                PDB.render.clearMain();
                PDB.controller.drawGeometry(PDB.config.mainMode);
                onMenuDown();
            });
            break;
        case PDB.GROUP_MENU_HBOND:
            var type = object.userData.reptype;
            switch (type) {
                case PDB.BOND_TYPE_NONE:
                    PDB.render.clearGroupIndex(PDB.GROUP_BOND);
                    break;
                case PDB.BOND_TYPE_SSBOND:
                    PDB.render.clearGroupIndex(PDB.GROUP_BOND);
                    PDB.painter.showBond(PDB.BOND_TYPE_SSBOND);
                    break;
                case PDB.BOND_TYPE_COVALENT:
                    PDB.render.clearGroupIndex(PDB.GROUP_BOND);
                    PDB.painter.showBond(PDB.BOND_TYPE_COVALENT);
                    break;
                case PDB.BOND_TYPE_HBOND:
                    PDB.render.clearGroupIndex(PDB.GROUP_BOND);
                    PDB.painter.showBond(PDB.BOND_TYPE_HBOND);
                    break;
            }
            onMenuDown();
            break;
    }
}

function onRotationDown() {
    if (PDB.HANDLER_ROTATION === 0) {
        PDB.HANDLER_ROTATION = controller1.quaternion.clone();
    }
    let rotationChange = controller1.quaternion.clone();
    rotationChange.premultiply(PDB.HANDLER_ROTATION.inverse());
    train.applyQuaternion(rotationChange);
    PDB.HANDLER_ROTATION = controller1.quaternion.clone();
}


function OperatingInstructions() {
    if (PDB.OPERAINS === 0) {
        var geometry = new THREE.PlaneGeometry(16, 9);
        // geometry.scale(-1, 1, 1);
        var url = SERVERURL + '/data/' + "oculusquest.png";
        var material = new THREE.MeshBasicMaterial({
            map: THREE.ImageUtils.loadTexture(url)
        })
        PDB.OPERAINS = new THREE.Mesh(geometry, material);
    }

    scene.add(PDB.OPERAINS);
    PDB.OPERAINS.position.set(0, 0, -5);
}


// DINGWEI
function PDBFormatEr(coords) {
    // 修改PDB坐标
    let PDBFormat = "";
    if (PDB.textData.length > 0) {
        const text = PDB.textData.split('\n');
        let axis_x = 0;
        let axis_y = 0;
        let axis_z = 0;
        for (let i = 0; i < text.length; i++) {
            let line = text[i].toLowerCase();
            switch (w3m_sub(line, 0, 6)) {
                case 'atom':
                    const residue_id = parseInt(w3m_sub(line, 23, 26)) || 0;
                    const atom_name = w3m_sub(line, 13, 16);
                    const atom_chain = w3m_sub(line, 22) || 'x';
                    const residueKey = "chain" + "_" + atom_chain + "_" + residue_id;
                    const resNameKey = "chain" + "_" + atom_chain + "_" + residue_id + "_" + atom_name;
                    const resNameMainKey = "chain" + "_" + atom_chain + "_" + residue_id + "_" + "ca";

                    // 添加侧链移动
                    if (coords[residueKey]) {
                        if ((axis_x === 0) && (axis_y === 0)) {
                            axis_x = parseFloat(coords[residueKey].x) - PDB.PDBPOS[resNameMainKey][0];
                            axis_y = parseFloat(coords[residueKey].y) - PDB.PDBPOS[resNameMainKey][1];
                            axis_z = parseFloat(coords[residueKey].z) - PDB.PDBPOS[resNameMainKey][2];
                        }

                        const b_x = (PDB.PDBPOS[resNameKey][0] + axis_x).toFixed(3);
                        const b_y = (PDB.PDBPOS[resNameKey][1] + axis_y).toFixed(3);
                        const b_z = (PDB.PDBPOS[resNameKey][2] + axis_z).toFixed(3);
                        line = line.replace(w3m_sub(line, 31, 38).padStart(8, ' '), b_x.padStart(8, ' '));
                        line = line.replace(w3m_sub(line, 39, 46).padStart(8, ' '), b_y.padStart(8, ' '));
                        line = line.replace(w3m_sub(line, 47, 54).padStart(8, ' '), b_z.padStart(8, ' '));
                    }

                    // 只改变Ca坐标
                    // if (coords[residueKey] && atom_name === "ca") {
                    //     line = line.replace(w3m_sub(line, 31, 38).padStart(8, ' '), coords[residueKey].x.padStart(8, ' '));
                    //     line = line.replace(w3m_sub(line, 39, 46).padStart(8, ' '), coords[residueKey].y.padStart(8, ' '));
                    //     line = line.replace(w3m_sub(line, 47, 54).padStart(8, ' '), coords[residueKey].z.padStart(8, ' '));
                    // }

                    line = line.toUpperCase();
                    PDBFormat = PDBFormat + line + "\n";
                    break;
                case 'hetatm':
                    line = line.toUpperCase();
                    PDBFormat = PDBFormat + line + "\n";
                    break;
                default:
                    line = line.toUpperCase();
                    PDBFormat = PDBFormat + line + "\n";
                    break;
            }
        }
    }
    return PDBFormat;
}


function onTriggerDown(event) {
    if (Object.getOwnPropertyNames(PDB.PDBPOS).length === 0) {
        const pdb_text = PDB.PDBRESET.split('\n');
        for (let i = 0; i < pdb_text.length; i++) {
            let line = pdb_text[i].toLowerCase();
            switch (w3m_sub(line, 0, 6)) {
                case 'atom':
                    const residue_id = parseInt(w3m_sub(line, 23, 26)) || 0;
                    const atom_name = w3m_sub(line, 13, 16);
                    const atom_chain = w3m_sub(line, 22) || 'x';
                    const residueKey = "chain" + "_" + atom_chain + "_" + residue_id + "_" + atom_name;
                    const pdb_x = parseFloat(w3m_sub(line, 31, 38));
                    const pdb_y = parseFloat(w3m_sub(line, 39, 46));
                    const pdb_z = parseFloat(w3m_sub(line, 47, 54));
                    PDB.PDBPOS[residueKey] = [pdb_x, pdb_y, pdb_z];
            }
        }
    }


    if (PDB.BODY_STYLE.length === 0) {
        PDB.BODY_STYLE.push(PDB.textData)
    }

    // camera
    // train.position.add(new THREE.Vector3(1, 0, 0))


    var controller = event.target;
    PDB.HELIX_SHEET_ARRAY = [];
    PDB.HELIX_SHEET_index = [];
    var intersections = getIntersections(controller);
    if (intersections.length <= 0) {
        return;
    }
    tempMatrix.getInverse(controller.matrixWorld);
    var intersection = intersections[0];

    var object = intersection.object;
    var pos = intersection.pos;

    // rotation

    if (PDB.selection_mode === PDB.SELECTION_HELIX_SHEET) {
        var object_1 = intersection.userdata_o;
        object.userData = object_1.userData;
        object.material = object_1.material;
        object.type = "Group";
    }


    // console.log("----------------" + object.name);
    // ================================ Deal with Menu ===
    if (PDB.isShowMenu) {
        dealwithMenu(object);
    } else {

        // ================================ Deal with Selection mode ===
        if (object.userData !== undefined && object.userData.reptype === 'mutation') {
            atom = object.userData.presentAtom;
            atom["pos_curr"] = pos;
            PDB.painter.showMutationInfo(atom, object.userData.mutation, pos);
            return;
        }
        switch (PDB.selection_mode) {
            case PDB.SELECTION_MODEL:
                break;
            case PDB.SELECTION_MAIN:
                break;
            case PDB.SELECTION_HET:
                break;
            case PDB.SELECTION_CHAIN:
                if (object.userData.presentAtom !== undefined) {
                    object.userData.presentAtom["pos_curr"] = pos;
                    // console.log(object.userData.presentAtom);
                    PDB.painter.showChainInfo(object.userData.presentAtom);
                }
                break;
            case PDB.SELECTION_DRUG:
                if (object.userData.presentAtom !== undefined) {
                    PDB.painter.showChainInfo(object.userData.presentAtom);
                }
                break;
            case PDB.SELECTION_RESIDUE:
                if (object.userData.presentAtom !== undefined) {
                    atom = object.userData.presentAtom;
                    atom["pos_curr"] = pos;
                    PDB.painter.showAtomInfo(atom);
                    if (PDB.trigger === PDB.TRIGGER_EVENT_FRAGMENT) {
                        // console.log(object);
                        PDB.fragmentArray.push(object);
                    } else if (PDB.trigger === PDB.TRIGGER_EVENT_EDITING) {
                        PDB.editingArray.push(object);
                    }
                }
                break;
            case PDB.SELECTION_HELIX_SHEET:
                if (object.userData.presentAtom !== undefined) {
                    object.userData.presentAtom["pos_curr"] = pos;
                    PDB.painter.showChainInfo(object.userData.presentAtom);
                }
                break;
            case PDB.SELECTION_ATOM:
                if (object.userData.presentAtom !== undefined) {
                    atom = object.userData.presentAtom;
                    atom["pos_curr"] = pos;
                    PDB.painter.showAtomInfo(atom);
                    if (PDB.trigger === PDB.TRIGGER_EVENT_DISTANCE || PDB.trigger === PDB.TRIGGER_EVENT_ANGLE) {
                        if (PDB.distanceArray.length > 0) {
                            if (!PDB.tool.equalAtom(PDB.distanceArray[PDB.distanceArray.length - 1], atom)) {
                                PDB.distanceArray.push(atom);
                            }
                        } else {
                            PDB.distanceArray.push(atom);
                        }
                    }
                }
                break;
            case PDB.SELECTION_OBJECT:
                objectTrans(controller, object, event);
                break;
            case PDB.SELECTION_DRUG_LIST:
                if (object) {
                    var userData = object.userData;
                    var repList = userData.reptype.split(',');

                    if ("drugListMenu" === repList[0]) {
                        var drugId = userData.name;
                        PDB.loader.loadDrug(drugId, repList[1], function () {
                            w3m.mol[drugId].drug = true;
                            PDB.render.clearGroupIndex(PDB.GROUP_DRUG);
                            PDB.painter.showHet(drugId);
                            PDB.tool.generateDrugMigrationPath();
                            PDB.GROUP[PDB.GROUP_DRUG].position.copy(PDB.GROUP[PDB.GROUP_MAIN].position);
                            PDB.GROUP[PDB.GROUP_DRUG].visible = true;
                        });
                    } else if ("Docking" === repList[0]) {
                        PDB.DRUGMOVE = true;
                        PDB.drugMoveTime = new Date();
                        PDB.render.clearGroupIndex(PDB.GROUP_VR_MENU_DOCKING);
                        PDB.tool.showDockingMenuForVr(repList[1]);
                    } else if ("dockingMenu" === repList[0]) {
                        var drugId = repList[1].replace(".pdb", "");
                        PDB.config.selectedDrug = drugId;
                        PDB.DRUBDB_URL.docking = repList[2] + "/";
                        PDB.loader.loadDrug(drugId, "docking", function () {
                            w3m.mol[drugId].drug = true;
                            PDB.render.clearGroupIndex(PDB.GROUP_DOCKING);
                            PDB.render.clearGroupIndex(PDB.GROUP_DRUG);
                            PDB.DRUGMOVE = false;
                            var docking = true;
                            PDB.painter.showHet(drugId, docking);
                        });
                    } else if ("menuOn" === repList[0]) {
                        PDB.GROUP[PDB.GROUP_VR_MENU_DRUG].visible = true;
                        PDB.GROUP[PDB.GROUP_VR_MENU_DOCKING].visible = true;
                    } else if ("menuOff" === repList[0]) {
                        PDB.GROUP[PDB.GROUP_VR_MENU_DRUG].visible = false;
                        PDB.GROUP[PDB.GROUP_VR_MENU_DOCKING].visible = false;
                    } else if ("DockingResultLink" === repList[0]) {
                        window.location.href = repList[1];
                    }
                }
                break;
            // case PDB.SELECTION_ROTATION:
        }

        // ================================ Deal with Trigger mode ===
        switch (PDB.trigger) {
            case PDB.TRIGGER_EVENT_DRAG:
                if (PDB.config.mainMode === PDB.BALL_AND_ROD) {
                    objectTrans(controller, intersections, event);
                } else {
                    objectTrans(controller, object, event);
                }
                break;
        }
    }
}


function revocation() {
    if (PDB.BODY_STYLE.length > 1) {
        PDB.BODY_STYLE.pop();
    }
    PDB.textData = PDB.BODY_STYLE[PDB.BODY_STYLE.length - 1];
    PDB.render.clear(0);
    PDB.loader.loadData(PDB.textData);
    PDB.controller.drawGeometry(PDB.config.mainMode);
}

function onTriggerUp(event) {

    // 撤销模块
    if (PDB.BODY_STYLE.length > 6) {
        PDB.BODY_STYLE.shift()
    }
    PDB.BODY_STYLE.push(PDB.textData);

    //console.log("onTriggerUp");
    PDB.firstTimeNum = [];
    PDB.changeData = "";
    PDB.HS_FIRSTTIMENUMBER = [];
    switch (PDB.selection_mode) {
        case PDB.SELECTION_MODEL:
            break;
        case PDB.SELECTION_MAIN:
            break;
        case PDB.SELECTION_HET:
            break;
        case PDB.SELECTION_CHAIN:
            PDB.render.clearGroupIndex(PDB.GROUP_INFO);
            break;
        case PDB.SELECTION_DRUG:
            PDB.render.clearGroupIndex(PDB.GROUP_INFO);
            break;
        case PDB.SELECTION_RESIDUE:
            PDB.render.clearGroupIndex(PDB.GROUP_INFO);
            break;
        case PDB.SELECTION_ATOM:
            PDB.render.clearGroupIndex(PDB.GROUP_INFO);
            break;
        case PDB.SELECTION_OBJECT:
            break;

    }

    var controller = event.target;
    if (controller.userData !== undefined && controller.userData.selected !== undefined) {
        var intersections = controller.userData.selected;
        var object = intersections;
        objectDeTrans(controller, object);
        controller.userData.selected = undefined;
    }

    switch (PDB.trigger) {
        case PDB.GROUP_MENU_DRAG:
            break;
        case PDB.TRIGGER_EVENT_DISTANCE:
            if (PDB.distanceArray.length === 2) {
                var locationStart = PDB.distanceArray[0];
                var locationEnd = PDB.distanceArray[1];
                PDB.painter.showDistance(locationStart, locationEnd);
                PDB.distanceArray = [];
            }
            break;
        case PDB.TRIGGER_EVENT_ANGLE:

            if (PDB.distanceArray.length === 1) {
            } else if (PDB.distanceArray.length === 2) {
                var locationStart = PDB.distanceArray[0];
                var locationEnd = PDB.distanceArray[1];
                PDB.painter.showDistance(locationStart, locationEnd);
            } else if (PDB.distanceArray.length === 3) {
                var locationStart = PDB.distanceArray[1];
                var locationEnd = PDB.distanceArray[2];
                PDB.painter.showDistance(locationStart, locationEnd);
                var anglePoint = locationStart;
                var edgePoint1 = PDB.distanceArray[0];
                var edgePoint2 = locationEnd;
                var anglePointPos = [anglePoint.pos_curr.x, anglePoint.pos_curr.y, anglePoint.pos_curr.z];
                var edgePoint1Pos = [edgePoint1.pos_curr.x, edgePoint1.pos_curr.y, edgePoint1.pos_curr.z];
                var edgePoint2Pos = [edgePoint2.pos_curr.x, edgePoint2.pos_curr.y, edgePoint2.pos_curr.z];
                var ms = PDB.tool.getAngleMeasurement(anglePointPos, edgePoint1Pos, edgePoint2Pos);

                var limit = w3m.global.limit;
                var x = limit.x[1] + PDB.GeoCenterOffset.x;
                var z = limit.z[1] + PDB.GeoCenterOffset.z;
                var pos = new THREE.Vector3(x * 0.02, 3.0, z * 0.02);

                var labelPos = locationStart.pos_curr;
                var pos = PDB.tool.getAtomInfoPosition(labelPos, camera.position);
                // PDB.drawer.drawTextForAngle(PDB.GROUP_MAIN, pos,ms.result, "", anglePoint.color, 180);
                PDB.drawer.drawTextForAngle(PDB.GROUP_MAIN, pos, ms.result, "", anglePoint.color, 180);

                PDB.distanceArray = [];
            }
            break;
        case PDB.TRIGGER_EVENT_ATOM:
            var controller = event.target;
            if (controller.userData.selected !== undefined) {
                var object = controller.userData.selected;
                PDB.tool.colorIntersectObjectBlue(object, 0);
                //PDB.GROUP[PDB.GROUP_MAIN].add( object );
                controller.userData.selected = undefined;
            }
            break;
        case PDB.TRIGGER_EVENT_FRAGMENT:
            var controller = event.target;
            if (controller.userData.selected !== undefined) {
                var object = controller.userData.selected;
                PDB.tool.colorIntersectObjectBlue(object, 0);
                PDB.GROUP[PDB.GROUP_MAIN].add(object);
                controller.userData.selected = undefined;
            }
            if (PDB.fragmentArray.length === 2) {
                var startAtom = PDB.fragmentArray[0];
                var endAtom = PDB.fragmentArray[1];
                if (startAtom.name <= endAtom.name) {
                    PDB.controller.fragmentPainter(startAtom.name, endAtom.name, PDB.fragmentMode);
                } else {
                    PDB.controller.fragmentPainter(endAtom.name, startAtom.name, PDB.fragmentMode);
                }
                PDB.fragmentArray = [];
            }
            break;
        case PDB.TRIGGER_EVENT_EDITING:
            var controller = event.target;
            if (controller.userData.selected !== undefined) {
                var object = controller.userData.selected;
                PDB.tool.colorIntersectObjectBlue(object, 0);
                PDB.GROUP[PDB.GROUP_MAIN].add(object);
                controller.userData.selected = undefined;
            }
            if (PDB.editingArray.length === 1) {
                var atom = PDB.editingArray[0].userData.presentAtom;
                var residueId = PDB.tool.getResidueId(atom);
                // chain有问题
                PDB.tool.editingReplace("a", residueId, atom.pos_curr, PDB.fragmentMode);
                PDB.editingArray = [];
            }
            break;
        case PDB.TRIGGER_EVENT_LABEL:
            break;
    }
}

// function addToDictionary(dictionary, key, value) {
//   if (!dictionary.has(key)) {
//     dictionary.set(key, new Set());
//   }
//   dictionary.get(key).add(value);
// }

function objectTrans(controller, object, event) {
    if (PDB.config.mainMode === PDB.BALL_AND_ROD) {
        if (object[0].object != undefined && (object[0].object.material != undefined || object[0].object.type === "Group")) {
            var object_list = []
            for (let objectListKey in object) {
                object_list.push(object[objectListKey].object)
            }
            if (object_list.length > 0) {

                for (let objMesh in object_list) {
                    let new_object = object_list[objMesh];
                    PDB.tool.colorIntersectObjectBlue(new_object, 1);
                    var groupindex = new_object.userData["group"];
                    var mtx = new THREE.Vector3()
                    new_object.matrix.premultiply(tempMatrix);
                    new_object.matrix.decompose(new_object.position, new_object.quaternion, new_object.scale);

                    controller.add(new_object);
                    controller.userData.selected = new_object;
                }
                PDB.ProDESIGNPosition.push([PDB.pdbId, object_list[0].userData.presentAtom.chainname, object_list[0].userData.presentAtom.resid])
                PDB.DFMATRIX1 = controller.matrixWorld.clone();
            }
        }
        // PDB.tool.colorIntersectObjectBlue(object, 1);
    } else {
        if (object != undefined && (object.material != undefined || object.type === "Group")) {


            PDB.tool.colorIntersectObjectBlue(object, 1);

            // yangdanfeng ID说明功能
            // console.log(object);
            // PDB.painter.showDFIREInfo(object.userData.presentAtom,
            //     "chain: " + object.userData.presentAtom.chainname + " Res ID: " + object.userData.presentAtom.resid);
            var groupindex = object.userData["group"];
            if (groupindex != undefined) {

                // HELIX_SHEET 拖动
                if (PDB.selection_mode === PDB.SELECTION_HELIX_SHEET) {
                    console.log(scene.children)

                    PDB.HS_FIRSTTIMENUMBER = [];
                    PDB.CHANGE_DICT = {};
                    PDB.HS_ATOM = "";


                    for (var per_object in object) {
                        if (object[per_object].type === "Mesh") {
                            // 拖拽代码 ---费了好大劲
                            object[per_object].matrix.premultiply(tempMatrix);
                            object[per_object].matrix.decompose(object[per_object].position, object[per_object].quaternion, object[per_object].scale);

                            controller.add(object[per_object]);
                            controller.userData.selected = object;
                        }
                    }


                    PDB.DFMATRIX1 = controller.matrixWorld.clone();

                } else {

                    var mtx = new THREE.Vector3()

                    // 拖拽代码 ---费了好大劲
                    object.matrix.premultiply(tempMatrix);
                    object.matrix.decompose(object.position, object.quaternion, object.scale);

                    controller.add(object);
                    controller.userData.selected = object;
                    PDB.NEWOBJ = object.clone();


                    PDB.ProDESIGNPosition.push([PDB.pdbId, object.userData.presentAtom.chainname, object.userData.presentAtom.resid])

                    if (PDB.selection_mode === PDB.SELECTION_RESIDUE) {

                        PDB.DFMATRIX1 = controller.matrixWorld.clone();

                        for (var num = object.userData.presentAtom.resid - 5; num < atom.resid + 5; num++) {
                            PDB.firstTimeNum.push(num);
                            if (PDB.FFDPosition.indexOf(num) < 0) {
                                PDB.FFDPosition.push(num);
                            }
                        }

                    }
                }


                // object.visible = false;

                if (object.type == 'Mesh') {
                    if (groupindex.search('_low') > 0) {
                        var n_groupindex = groupindex.substring(0, groupindex.length - 4);
                        for (var i in PDB.GROUP[n_groupindex].children) {
                            if (PDB.GROUP[n_groupindex].children[i].id == object.id) {
                                var _h = PDB.GROUP[n_groupindex].children[i]
                                _h.matrix.premultiply(tempMatrix);
                                _h.matrix.decompose(_h.position, _h.quaternion, _h.scale);
                                controller.add(_h);
                                break;
                            }
                        }
                        //PDB.GROUP[n_groupindex].getObjectById(object.id);
                    } else {
                        if (PDB.GROUP[groupindex + '_low'] && PDB.GROUP[groupindex + '_low'].children.length > 0) {
                            for (var i in PDB.GROUP[groupindex + '_low'].children) {
                                if (PDB.GROUP[groupindex + '_low'].children[i].id == object.id) {
                                    var _h = PDB.GROUP[groupindex + '_low'].children[i]
                                    _h.matrix.premultiply(tempMatrix);
                                    _h.matrix.decompose(_h.position, _h.quaternion, _h.scale);
                                    controller.add(_h);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (object.userData["type"]) {
                    var ot_index = '';
                    if (object.userData["type"] == 'low') {
                        ot_index = groupindex.substring(0, groupindex.length - 4);
                    } else if (object.userData["type"] == 'normal') {
                        ot_index = groupindex + '_low';
                    }
                    //console.log(ot_index);
                    PDB.tool.colorIntersectObjectBlue(PDB.GROUP[ot_index], 1);
                    PDB.GROUP[ot_index].matrix.premultiply(tempMatrix);
                    PDB.GROUP[ot_index].matrix.decompose(PDB.GROUP[ot_index].position, PDB.GROUP[ot_index].quaternion, PDB.GROUP[ot_index].scale);

                    controller.add(PDB.GROUP[ot_index]);
                }

            }
        }
    }
}

function objectDeTrans(controller, object) {
    // let new_array = object.clone();
    if (object != undefined && (object.material != undefined || object.type === "Group")) {
        var groupindex = object.userData["group"];

        object.matrix.premultiply(controller.matrixWorld);
        object.matrix.decompose(object.position, object.quaternion, object.scale);
        PDB.tool.colorIntersectObjectBlue(object, 0);


        switch (PDB.selection_mode) {
            case PDB.SELECTION_HELIX_SHEET:
                break;
            case PDB.SELECTION_RESIDUE:
                break;
            default:

                let coords = {};

                for (let i = 0; i < object.children.length; i++) {
                    let ob_selected = object.children[i];
                    const ob_residue = ob_selected.userData.presentAtom;
                    const ob_pos_center = new THREE.Vector3(
                        ob_residue.pos_centered.x,
                        ob_residue.pos_centered.y,
                        ob_residue.pos_centered.z,
                    )

                    const ob_resid = ob_residue.resid;
                    const groupindex = ob_selected.userData["group"];

                    ob_pos_center.applyMatrix4(object.matrixWorld);

                    let residue_x = (ob_pos_center.x - PDB.GeoCenterOffset.x).toFixed(3);
                    let residue_y = (ob_pos_center.y - PDB.GeoCenterOffset.y).toFixed(3);
                    let residue_z = (ob_pos_center.z - PDB.GeoCenterOffset.z).toFixed(3);

                    let coord = new THREE.Vector3(
                        residue_x,
                        residue_y,
                        residue_z);

                    // 坐标存储字典
                    let chainName = groupindex;
                    if (chainName.search('_low') > 0) {
                        chainName = chainName.split('_low')[0].toLowerCase();
                    }

                    let cdKey = chainName + "_" + ob_resid;
                    console.log(cdKey);
                    coords[cdKey] = coord;

                }
                // 重新加载PDB结构数据
                const PDBText = PDBFormatEr(coords);
                if (PDBText !== "") {
                    PDB.textData = PDBText;
                }
                // 重新加载模型
                // PDB.render.clear(0);
                for (var i in PDB.GROUP_MAIN_INDEX) {
                    PDB.render.clearGroupIndex(PDB.GROUP_MAIN_INDEX[i]);
                }
                PDB.loader.loadData(PDB.textData);
                PDB.controller.drawGeometry(PDB.config.mainMode);
        }


        if (object.type != "Group") {
            if (groupindex != undefined) {
                //console.log(groupindex); // || groupindex == PDB.GROUP_MENU
                PDB.GROUP[groupindex].add(object);
                if (groupindex.search('_low') > 0) {
                    // -----------不运行-------------
                    var n_groupindex = groupindex.substring(0, groupindex.length - 4);
                    for (var i in PDB.GROUP[n_groupindex].children) {
                        if (PDB.GROUP[n_groupindex].children[i].id == object.id) {
                            var _h = PDB.GROUP[n_groupindex].children[i]
                            _h.matrix.premultiply(controller.matrixWorld);
                            _h.matrix.decompose(_h.position, _h.quaternion, _h.scale);
                            PDB.GROUP[n_groupindex].add(object);
                            break;
                        }
                    }
                    PDB.GROUP[n_groupindex].getObjectById(object.id);
                } else {
                    if (PDB.GROUP[groupindex + '_low'] && PDB.GROUP[groupindex + '_low'].children.length > 0) {
                        for (var i in PDB.GROUP[groupindex + '_low'].children) {
                            if (PDB.GROUP[groupindex + '_low'].children[i].id == object.id) {
                                // -----------不运行-------------
                                var _h = PDB.GROUP[groupindex + '_low'].children[i]
                                _h.matrix.premultiply(controller.matrixWorld);
                                _h.matrix.decompose(_h.position, _h.quaternion, _h.scale);
                                PDB.GROUP[groupindex + '_low'].add(object);
                                break;
                            }
                        }
                    }
                }
            }
            //console.log('------------------------------------');
            //console.log(object.position);
            if (object.userData['presentAtom'] && object.userData['presentAtom']['chainname'] && object.userData['presentAtom']['resid'] && PDB.residueGroupObject[object.userData['presentAtom']['chainname']][object.userData['presentAtom']['resid']]) {
                // ontriggerUp 操作模块
                if (!PDB.residueGroupObject[object.userData['presentAtom']['chainname']][object.userData['presentAtom']['resid']].moveVec) {
                    PDB.residueGroupObject[object.userData['presentAtom']['chainname']][object.userData['presentAtom']['resid']].moveVec = new THREE.Vector3(0, 0, 0);
                }
                PDB.residueGroupObject[object.userData['presentAtom']['chainname']][object.userData['presentAtom']['resid']].moveVec.copy(object.position);
            }


        } else {
            if (object.userData["type"]) {
                // -----------不运行-------------
                var ot_index = '';
                if (object.userData["type"] == 'low') {
                    ot_index = groupindex.substring(0, groupindex.length - 4);
                } else if (object.userData["type"] == 'normal') {
                    ot_index = groupindex + '_low';
                }
                PDB.GROUP[ot_index].matrix.premultiply(controller.matrixWorld);
                PDB.GROUP[ot_index].matrix.decompose(PDB.GROUP[ot_index].position, PDB.GROUP[ot_index].quaternion, PDB.GROUP[ot_index].scale);
                PDB.tool.colorIntersectObjectBlue(PDB.GROUP[ot_index], 0);
                scene.add(PDB.GROUP[ot_index]);
            }
            // scene.add(object);
            controller.remove(object);
        }
    }
}


function getIntersections(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    var inters = [];
    // if(PDB.trigger === PDB.TRIGGER_EVENT_DRAG){
    if (PDB.isShowMenu) {
        var gIndexies = [PDB.GROUP_MENU_VIS, PDB.GROUP_MENU_MAIN, PDB.GROUP_MENU_HET, PDB.GROUP_MENU_COLOR, PDB.GROUP_MENU_MEASURE,
            PDB.GROUP_MENU_DRAG, PDB.GROUP_MENU_FRAGMENT, PDB.GROUP_MENU, PDB.GROUP_MENU_LABEL, PDB.GROUP_MENU_EX_HET,
            PDB.GROUP_MENU_TRAVEL, PDB.GROUP_MENU_SURFACE, PDB.GROUP_MENU_MUTATION, PDB.GROUP_MENU_ROTATION,
            PDB.GROUP_MENU_DRUG, PDB.GROUP_MENU_HBOND, PDB.GROUP_MENU_CONSERVATION, PDB.GROUP_MENU_DENSITYMAP, PDB.GROUP_MENU_EDITING,
            PDB.GROUP_MENU_DIRECTION, PDB.GROUP_MENU_EXPORT, PDB.GROUP_MENU_SPEECH, PDB.GROUP_MENU_OUTBALL, PDB.GROUP_KEYBOARD
        ];
        for (var i = gIndexies.length - 1; i >= 0; i--) {
            if (!PDB.GROUP[gIndexies[i]].visible) continue;
            var tmp_inters = raycaster.intersectObjects(PDB.GROUP[gIndexies[i]].children);
            for (var j = 0; j < tmp_inters.length; j++) {
                inters.push(tmp_inters[j]);
            }
        }
    } else {
        var groupMutation = PDB.GROUP[PDB.GROUP_MUTATION];
        if (groupMutation.children != undefined && groupMutation.children.length > 0) {
            var tmp_inters = raycaster.intersectObjects(groupMutation.children);
            if (tmp_inters.length > 0) {
                object = tmp_inters[0].object;
                point = tmp_inters[0].point;
                if (object.userData !== undefined && object.userData.reptype === 'mutation') {
                    inters.push({
                        "object": object,
                        "pos": point
                    });
                    return inters;
                }
            }
        }
        // console.log(PDB.selection_mode)
        switch (PDB.selection_mode) {
            case PDB.SELECTION_MODEL:
                for (var i in PDB.GROUP_STRUCTURE_INDEX) {
                    inters.push({
                        "object": PDB.GROUP[PDB.GROUP_STRUCTURE_INDEX[i]]
                    });
                }
                break;
            case PDB.SELECTION_MAIN:
                for (var i in PDB.GROUP_MAIN_INDEX) {
                    inters.push({
                        "object": PDB.GROUP[PDB.GROUP_MAIN_INDEX[i]]
                    });
                }
                break;
            case PDB.SELECTION_HET:
                var gIndexies = PDB.GROUP_HET_INDEX;
                for (var key in gIndexies) {
                    var groupindex = gIndexies[key];
                    if (!PDB.GROUP[groupindex].visible) continue;
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[groupindex].children);
                    if (tmp_inters.length <= 0) continue;
                    object = tmp_inters[0].object;
                    if (object.name != undefined && object.name != "" && object.userData.presentAtom !== undefined) {
                        inters.push({
                            "object": PDB.GROUP[groupindex]
                        });
                    }
                }
                break;
            case PDB.SELECTION_CHAIN:
                var gIndexies = PDB.GROUP_STRUCTURE_INDEX;
                for (var key in gIndexies) {
                    var groupindex = gIndexies[key];
                    if (!PDB.GROUP[groupindex].visible) continue;
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[groupindex].children);

                    if (tmp_inters.length <= 0) continue;
                    object = tmp_inters[0].object;
                    if (object.name != undefined && object.name != "" && object.userData.presentAtom !== undefined) {
                        inters.push({
                            "object": PDB.GROUP[groupindex],
                            "pos": tmp_inters[0].point
                        });
                    }
                }
                break;
            case PDB.SELECTION_DRUG:
                //var gIndexies = PDB.GROUP_STRUCTURE_INDEX;
                //for (var key in gIndexies) {
                var groupindex = PDB.GROUP_DRUG;
                if (!PDB.GROUP[groupindex].visible) break;
                var tmp_inters = raycaster.intersectObjects(PDB.GROUP[groupindex].children);
                if (tmp_inters.length <= 0) break;
                object = tmp_inters[0].object;
                if (object.name != undefined && object.name != "" && object.userData.presentAtom !== undefined) {
                    inters.push({
                        "object": PDB.GROUP[groupindex]
                    });
                }
                //}
                break;
            case PDB.SELECTION_RESIDUE:
                if (PDB.config.mainMode === PDB.BALL_AND_ROD) {
                    var gIndexies = PDB.GROUP_STRUCTURE_INDEX;
                    for (var i = gIndexies.length - 1; i >= 0; i--) {
                        if (!PDB.GROUP[gIndexies[i]].visible) continue;
                        var tmp_inters = raycaster.intersectObjects(PDB.GROUP[gIndexies[i]].children);
                        if (tmp_inters.length <= 0) continue;
                        object = tmp_inters[0].object;
                        point = tmp_inters[0].point;
                        if (object.name != undefined && object.name != "" && object.userData.presentAtom !== undefined) {
                            var atomObjects = []
                            // var atomObjects = PDB.GROUP[gIndexies[i]].getChildrenByName(object.userData.presentAtom.caid);
                            for (const tmpIntersKey in PDB.GROUP[gIndexies[i]].children) {
                                var childrenMesh = PDB.GROUP[gIndexies[i]].children[tmpIntersKey];
                                if (childrenMesh.userData?.presentAtom?.resid === object.userData.presentAtom.resid) {
                                    atomObjects.push(childrenMesh);
                                }
                            }
                            for (var a = 0; a < atomObjects.length; a++) {
                                // 更改坐标
                                inters.push({
                                    "object": atomObjects[a],
                                    "pos": point,
                                    "center": object.userData.presentAtom.name
                                });
                            }
                        }
                    }
                    break;
                }
                if (PDB.config.mainMode === PDB.CARTOON_SSE) {
                    var gIndexies = PDB.GROUP_STRUCTURE_INDEX;
                    for (var i = gIndexies.length - 1; i >= 0; i--) {
                        if (!PDB.GROUP[gIndexies[i]].visible) continue;

                        // 鼠标射线，选择器
                        var tmp_inters = raycaster.intersectObjects(PDB.GROUP[gIndexies[i]].children);
                        // console.log("tmp_inters", tmp_inters);
                        if (tmp_inters.length <= 0) continue;
                        object = tmp_inters[0].object;
                        point = tmp_inters[0].point;
                        // console.log(point)
                        if (object.name != undefined && object.name != "" && object.userData.presentAtom !== undefined) {
                            if (object.userData.reptype === "tube") {
                                //if (object.userData.realtype !== undefined && object.userData.realtype === "arrow") {
                                //console.log(object.userData);
                                //}
                                var atomObjects = PDB.GROUP[gIndexies[i]].getChildrenByName(object.userData.presentAtom.id);

                                for (var a = 0; a < atomObjects.length; a++) {
                                    // 更改坐标

                                    inters.push({
                                        "object": atomObjects[a],
                                        "pos": point
                                    });
                                }
                            } else {

                                var resAtoms = PDB.tool.getMainResAtomsByAtom(object.userData.presentAtom);
                                for (var k = 0; k < resAtoms.length; k++) {
                                    var atomObjects = PDB.GROUP[gIndexies[i]].getChildrenByName(resAtoms[k].id);
                                    for (var a = 0; a < atomObjects.length; a++) {
                                        inters.push({
                                            "object": atomObjects[a],
                                            "pos": point
                                        });
                                    }
                                }

                            }
                        }
                    }
                    break;
                }


            case PDB.SELECTION_HELIX_SHEET:
                var gIndexies = PDB.GROUP_STRUCTURE_INDEX;

                // console.log("sheet",w3m.mol[PDB.pdbId].sheet)
                for (var key in gIndexies) {
                    var groupindex = gIndexies[key];
                    if (!PDB.GROUP[groupindex].visible) continue;
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[groupindex].children);

                    if (tmp_inters.length <= 0) continue;

                    object = tmp_inters[0].object;
                    point = tmp_inters[0].point;
                    if (object.name != undefined && object.name != "" && object.userData.presentAtom !== undefined) {
                        // console.log(object);

                        // 先判断选定的是否属于HELIX和SHEET
                        if (PDB.HELIX_SHEET_ARRAY.length <= 0) {
                            for (let i = 0; i < w3m.mol[PDB.pdbId].helix[object.userData.presentAtom.chainname].length; i++) {

                                // console.log(i)
                                // console.log(w3m.mol[PDB.pdbId].helix[object.userData.presentAtom.chainname][i])
                                PDB.HELIX_SHEET_ARRAY.push(w3m.mol[PDB.pdbId].helix[object.userData.presentAtom.chainname][i])
                            }

                            // console.log("ls", w3m.mol[PDB.pdbId].sheet[object.userData.presentAtom.chainname])


                            for (var j in w3m.mol[PDB.pdbId].sheet[object.userData.presentAtom.chainname]) {
                                for (let o = 0; o < w3m.mol[PDB.pdbId].sheet[object.userData.presentAtom.chainname][j].length; o++) {
                                    // console.log("o", w3m.mol[PDB.pdbId].sheet[object.userData.presentAtom.chainname][j][o])
                                    PDB.HELIX_SHEET_ARRAY.push(w3m.mol[PDB.pdbId].sheet[object.userData.presentAtom.chainname][j][o])

                                }
                                // console.log(j)
                                // console.log(w3m.mol[PDB.pdbId].helix[object.userData.presentAtom.chainname][j])
                                // PDB.HELIX_SHEET_ARRAY.push(w3m.mol[PDB.pdbId].sheet[object.userData.presentAtom.chainname][object.userData.presentAtom.chainname][j])
                            }
                        }

                        // 获取helix和sheet的id集合

                        for (let j = 0; j < PDB.HELIX_SHEET_ARRAY.length; j++) {
                            if (PDB.HELIX_SHEET_ARRAY[j][0] <= object.userData.presentAtom.resid && object.userData.presentAtom.resid <= PDB.HELIX_SHEET_ARRAY[j][1]) {
                                PDB.HELIX_SHEET_index = PDB.HELIX_SHEET_ARRAY[j]
                            }
                        }
                        var interDex = []
                        // console.log("PDB.HELIX_SHEET_ARRAY", PDB.HELIX_SHEET_index)
                        // console.log("HELIX_SHEET_ARRAY", PDB.HELIX_SHEET_ARRAY)

                        for (let i = 0; i < PDB.GROUP[groupindex].children.length; i++) {
                            var index_id = PDB.GROUP[groupindex].children[i].userData.presentAtom.resid
                            if (PDB.HELIX_SHEET_index[0] <= index_id && index_id <= PDB.HELIX_SHEET_index[1]) {
                                interDex.push(PDB.GROUP[groupindex].children[i])
                            }
                        }


                        inters.push({
                            "object": interDex,
                            "userdata_o": object,
                            "pos": point
                        });

                    }
                }

                break;

            case PDB.SELECTION_ATOM:
                var gIndexies = PDB.GROUP_STRUCTURE_INDEX;
                for (var i = gIndexies.length - 1; i >= 0; i--) {
                    if (!PDB.GROUP[gIndexies[i]].visible) continue;
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[gIndexies[i]].children);
                    if (tmp_inters.length <= 0) continue;
                    j = 0;
                    var object = tmp_inters[j].object;
                    var point = tmp_inters[0].point;

                    inters.push({
                        "object": object,
                        "pos": point
                    });
                    var atomObjects = PDB.GROUP[gIndexies[i]].getChildrenByName(object.name);

                    for (var a in atomObjects) {
                        if (object.userData.presentAtom && object.userData.presentAtom.id == atomObjects[a].userData.presentAtom.id) {
                            inters.push({
                                "object": atomObjects[a],
                                "pos": point
                            });
                        }
                    }
                }
                break;
            case PDB.SELECTION_OBJECT:
                for (var i in PDB.GROUP_STRUCTURE_INDEX) {
                    var group = PDB.GROUP[PDB.GROUP_STRUCTURE_INDEX[i]];
                    var tmp_inters = raycaster.intersectObjects(group.children);
                    for (var j = 0; j < tmp_inters.length; j++) {
                        inters.push(tmp_inters[j]);
                    }
                }
                break;
            case PDB.SELECTION_DRUG_LIST:
                if (PDB.GROUP[PDB.GROUP_VR_MENU_DRUG] !== undefined && PDB.GROUP[PDB.GROUP_VR_MENU_DRUG].children.length > 0) {
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[PDB.GROUP_VR_MENU_DRUG].children);
                    for (var j = 0; j < tmp_inters.length; j++) {
                        inters.push(tmp_inters[j]);
                    }
                }
                if (PDB.GROUP[PDB.GROUP_VR_MENU_DOCKING] !== undefined && PDB.GROUP[PDB.GROUP_VR_MENU_DOCKING].children.length > 0) {
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[PDB.GROUP_VR_MENU_DOCKING].children);
                    for (var j = 0; j < tmp_inters.length; j++) {
                        inters.push(tmp_inters[j]);
                    }
                }
                if (PDB.GROUP[PDB.GROUP_VR_MENU_SWITCH] !== undefined && PDB.GROUP[PDB.GROUP_VR_MENU_SWITCH].children.length > 0) {
                    var tmp_inters = raycaster.intersectObjects(PDB.GROUP[PDB.GROUP_VR_MENU_SWITCH].children);
                    for (var j = 0; j < tmp_inters.length; j++) {
                        inters.push(tmp_inters[j]);
                    }
                }
                break;
        }

    }
    return inters;
}

function changeMeshPerFrame(groupIndex, ca_residue, rs_showLow) {
    for (let i = PDB.GROUP[groupIndex].children.length - 1; i >= 0; i--) {
        const child = PDB.GROUP[groupIndex].children[i];
        if (child instanceof THREE.Mesh) {
            if (child?.userData?.presentAtom?.caid === ca_residue.caid) {
                PDB.GROUP[groupIndex].remove(child);
                scene.remove(child);
                // 清理资源
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        }
    }
    PDB.loader.loadData(PDB.textData);

    let chainName = groupIndex;
    if (chainName.search('_low') > 0) {
        chainName = chainName[0].toLowerCase();
    }

    let cn = chainName.split("_")[1]
    const ob_resid = ca_residue.resid;

    PDB.painter.showResidue(cn, ob_resid, PDB.config.mainMode, ca_residue.color, rs_showLow);

}


function intersectObjects(controller) {

    // train.rotation.copy(controller.rotation);

    if (controller.userData.selected !== undefined) {

        // 二级结构编辑
        if (PDB.selection_mode === PDB.SELECTION_HELIX_SHEET) {
            if (!PDB.DFMATRIX1.equals(controller.matrixWorld)) {
                PDB.DFMATRIX1 = controller.matrixWorld.clone();

                // 坐标存储字典
                let coords = {};
                let chain_list = {};

                for (var number in controller.children) {
                    var ob_selected = controller.children[number];


                    if (ob_selected.type === "Mesh") {
                        if (ob_selected.geometry.type !== "TubeGeometry") {
                            PDB.HS_ATOM = ob_selected.userData;

                            if (PDB.HS_FIRSTTIMENUMBER.indexOf(ob_selected.userData.presentAtom.resid) < 0) {
                                PDB.HS_FIRSTTIMENUMBER.push(ob_selected.userData.presentAtom.resid)
                            }

                            const ob_residue = ob_selected.userData.presentAtom;
                            const ob_pos_center = ob_residue.pos_centered.clone();

                            const ob_resid = ob_residue.resid;

                            const groupIndex = ob_selected.userData["group"];


                            ob_pos_center.applyMatrix4(ob_selected.matrixWorld);

                            let residue_x = (ob_pos_center.x - PDB.GeoCenterOffset.x).toFixed(3);
                            let residue_y = (ob_pos_center.y - PDB.GeoCenterOffset.y).toFixed(3);
                            let residue_z = (ob_pos_center.z - PDB.GeoCenterOffset.z).toFixed(3);

                            let coord = new THREE.Vector3(residue_x, residue_y, residue_z);

                            let chainName = groupIndex;
                            if (chainName.search('_low') > 0) {
                                chainName = chainName[0].toLowerCase();
                            }

                            if (chain_list.hasOwnProperty(ob_resid) === false) {
                                coords[chainName + "_" + ob_resid] = coord;
                            }
                        }
                        ob_selected.visible = false;
                    }
                }

                // 重新加载PDB结构数据
                const PDBText = PDBFormatEr(coords);
                if (PDBText !== "") {
                    PDB.textData = PDBText;
                }

                // 修改为io 做一个python的io接口

                console.log("HS_FIRSTTIMENUMBER", PDB.HS_FIRSTTIMENUMBER)

                if (PDB.HS_FIRSTTIMENUMBER.indexOf(PDB.HS_FIRSTTIMENUMBER[PDB.HS_FIRSTTIMENUMBER.length - 1] + 1) < 0) {
                    PDB.HS_FIRSTTIMENUMBER.push(PDB.HS_FIRSTTIMENUMBER[PDB.HS_FIRSTTIMENUMBER.length - 1] + 1)
                }
                if (PDB.HS_FIRSTTIMENUMBER.indexOf(PDB.HS_FIRSTTIMENUMBER[0] - 1) < 0) {
                    PDB.HS_FIRSTTIMENUMBER.push(PDB.HS_FIRSTTIMENUMBER[0] - 1)
                }


                if (PDB.HS_ATOM.group != undefined && PDB.HS_ATOM.presentAtom.chainname != undefined) {
                    groupindex = PDB.HS_ATOM.group
                    var children1 = PDB.GROUP[groupindex].children;
                    var newChildren = []
                    for (var i = 0; i < children1.length; i++) {
                        if (children1[i] instanceof THREE.Mesh) {
                            var meshObj = children1[i];
                            if (PDB.HS_FIRSTTIMENUMBER.indexOf(meshObj.userData.presentAtom.resid) < 0) {
                                // children1.remove(children1[i]);
                                if (newChildren.indexOf(meshObj) < 0) {
                                    newChildren.push(meshObj);
                                }
                            }
                        }
                    }

                    var rs_showLow = 0;
                    if (groupindex.search('_low') > 0) {
                        rs_showLow = 1;
                    }


                    PDB.loader.loadData(PDB.textData);
                    var residueData = w3m.mol[PDB.pdbId].residueData;
                    console.log(residueData);

                    for (var number in PDB.HS_FIRSTTIMENUMBER) {
                        var resid = PDB.HS_FIRSTTIMENUMBER[number];
                        // PDB.painter.showResidue(PDB.HS_ATOM.presentAtom.chainname, resid, PDB.CARTOON_SSE, PDB.HS_ATOM.presentAtom.color, rs_showLow);
                        PDB.painter.showResidue(PDB.HS_ATOM.presentAtom.chainname, resid, PDB.config.mainMode, PDB.HS_ATOM.presentAtom.color, rs_showLow);
                    }


                    for (let i = 0; i < scene.children.length; i++) {
                        if (scene.children[i].name === PDB.HS_ATOM.presentAtom.chainname) {
                            if (scene.children[i].children.length !== PDB.GROUP[groupindex].children.length) {
                                scene.remove(scene.children[i])
                            }
                        }
                    }

                    for (var i = 0; i < newChildren.length; i++) {
                        var meshObjPdb = newChildren[i];
                        // PDB.GROUP[groupindex].children.push(meshObjPdb);
                        PDB.GROUP[groupindex].add(meshObjPdb);
                    }
                }
            }
        }
        // 拖拽单体
        if ((PDB.selection_mode === PDB.SELECTION_RESIDUE) && (PDB.trigger === PDB.TRIGGER_EVENT_DRAG)) {
            if (PDB.config.mainMode === PDB.CARTOON_SSE) {
                var ob_selected = controller.children[1];

                if (!PDB.DFMATRIX1.equals(controller.matrixWorld)) {
                    PDB.DFMATRIX1 = controller.matrixWorld.clone();

                    // 求出当前氨基酸的三维坐标
                    const ob_residue = ob_selected.userData.presentAtom;
                    ob_selected.visible = false;

                    const ob_pos_center = new THREE.Vector3(
                        ob_residue.pos_centered.x,
                        ob_residue.pos_centered.y,
                        ob_residue.pos_centered.z,
                    )


                    const ob_resid = ob_residue.resid;
                    const groupIndex = ob_selected.userData["group"];

                    ob_pos_center.applyMatrix4(ob_selected.matrixWorld);

                    let residue_x = (ob_pos_center.x - PDB.GeoCenterOffset.x).toFixed(3);
                    let residue_y = (ob_pos_center.y - PDB.GeoCenterOffset.y).toFixed(3);
                    let residue_z = (ob_pos_center.z - PDB.GeoCenterOffset.z).toFixed(3);

                    let coord = new THREE.Vector3(
                        residue_x,
                        residue_y,
                        residue_z);
                    let coord_list = [residue_x, residue_y, residue_z]

                    // 坐标存储字典
                    let chainName = groupIndex;
                    if (chainName.search('_low') > 0) {
                        chainName = chainName[0].toLowerCase();
                    }

                    let coords = {};
                    let cdKey = chainName + "_" + ob_resid;
                    coords[cdKey] = coord;
                    let cn = chainName.split("_")[1]
                    console.log(coord_list)

                    // 使用接口重新加载PDB结构
                    $.ajax({
                        url: "spring",
                        type: "POST",
                        dataType: "json",
                        data: {
                            "pdb_str": PDB.textData,
                            "res_id": ob_resid,
                            "res_chain": cn,
                            "res_atom": ob_residue.name,
                            "atom_coord": JSON.stringify(coord_list),
                            "res_number": w3m.mol[PDB.pdbId].residue[cn].length,
                            "second_structure": JSON.stringify({
                                'helix': w3m.mol[PDB.pdbId].helix,
                                'sheet': w3m.mol[PDB.pdbId].sheet
                            })
                        },
                        success: function (data) {
                            console.log(data)
                        }
                    });

                    // 重新加载PDB结构数据
                    const PDBText = PDBFormatEr(coords);
                    if (PDBText !== "") {
                        PDB.textData = PDBText;
                    }

                    // PDB.GROUP.children
                    let resData = PDB.GROUP[groupIndex].clone();
                    let newChildren = [];
                    for (let i = 0; i < resData.children.length; i++) {
                        if (resData.children[i] instanceof THREE.Mesh) {
                            let meshobj = resData.children[i];
                            if (PDB.firstTimeNum.indexOf(meshobj.userData.presentAtom.resid) < 0) {
                                if (newChildren.indexOf(meshobj) < 0) {
                                    newChildren.push(meshobj)
                                }
                            }
                        }
                    }

                    // reload PDB
                    PDB.loader.loadData(PDB.textData);

                    // 判断是否为多链;
                    let resShowLow = 0;
                    if (groupIndex.search('_low') > 0) {
                        resShowLow = 1;
                    }

                    for (const number in PDB.firstTimeNum) {
                        let resId = PDB.firstTimeNum[number];
                        PDB.painter.showResidue(ob_residue.chainname,
                            resId,
                            PDB.config.mainMode,
                            ob_residue.color,
                            resShowLow);
                    }


                    for (let i = 0; i < scene.children.length; i++) {
                        if (scene.children[i].name === ob_residue.chainname) {
                            if (scene.children[i].children.length !== PDB.GROUP[groupIndex].children.length) {
                                scene.remove(scene.children[i])
                            }
                        }
                    }

                    for (let i = 0; i < newChildren.length; i++) {
                        PDB.GROUP[groupIndex].children.push(newChildren[i]);
                    }
                }

                // 接口
                // 防止多次触发
                if (PDB.DFIRE_INFO !== PDB.textData) {
                    $.ajax({
                        url: "dfire",
                        type: "POST",
                        dataType: "json",
                        data: {
                            "pdb_file": PDB.textData,
                            "pdb_position": PDB.FFDPosition
                        },
                        success: function (data) {
                            var atom_0 = ob_selected.userData.presentAtom

                            // if (PDB.DFIRE_SCORE != data["result"]) {
                            // 删除原有的mesh
                            var groupindex = ob_selected.userData["group"];
                            var children2 = PDB.GROUP[groupindex].children;

                            let inline = " dDFIRE: " + data["result"] + "\n" +
                                " binding_affinity: " + data["binding_affinity"]

                            PDB.painter.showDFIREInfo(atom_0,
                                inline);

                            PDB.DFIRE_INFO = PDB.textData;
                        }
                    })
                }
                return;
            }
            if (PDB.config.mainMode === PDB.BALL_AND_ROD) {
                // 拖拽BALL_AND_ROD情况
                // 侧链旋转

                // 在controller中选中侧链，并实现侧链绕Ca做旋转
                // 选中的氨基酸
                var ob_selected = controller.userData.selected;
                if (!PDB.DFMATRIX1.equals(controller.matrixWorld)) {
                    PDB.DFMATRIX1 = controller.matrixWorld.clone();
                    // 如果选中的氨基酸是 N Ca C等 则计算Ca的坐标变换，做蛋白质位移
                    if (ob_selected) {
                        // 获取Ca的实时坐标
                        let caSelectedMesh = '';
                        for (const clNum in controller.children) {
                            let currentMesh = controller.children[clNum];
                            if (currentMesh?.userData?.presentAtom?.name === "ca") {
                                if (currentMesh.geometry.type === "SphereBufferGeometry") {
                                    caSelectedMesh = currentMesh;
                                }
                            }
                            currentMesh.visible = false;
                        }
                        if (caSelectedMesh !== '') {
                            let ca_residue = caSelectedMesh.userData.presentAtom;

                            const ob_pos_center = new THREE.Vector3(
                                ca_residue.pos_centered.x,
                                ca_residue.pos_centered.y,
                                ca_residue.pos_centered.z,
                            )

                            const ob_resid = ca_residue.resid;

                            const groupIndex = caSelectedMesh.userData["group"];

                            // 坐标存储字典
                            let chainName = groupIndex;
                            if (chainName.search('_low') > 0) {
                                chainName = chainName[0].toLowerCase();
                            }

                            let cn = chainName.split("_")[1]

                            ob_pos_center.applyMatrix4(caSelectedMesh.matrixWorld);
                            let residue_x = (ob_pos_center.x - PDB.GeoCenterOffset.x).toFixed(3);
                            let residue_y = (ob_pos_center.y - PDB.GeoCenterOffset.y).toFixed(3);
                            let residue_z = (ob_pos_center.z - PDB.GeoCenterOffset.z).toFixed(3);
                            let ca_coord = JSON.stringify([residue_x, residue_y, residue_z]);
                            var rs_showLow = 0;

                            // 将坐标通过ajax传递给后台，获取新的蛋白质PDB文件
                            if (ChangePDBLock === 0) {
                                ChangePDBLock = 1;
                                $.ajax({
                                    url: "cgpdb",
                                    type: "POST",
                                    dataType: "json",
                                    data: {
                                        "pdb_content": PDB.textData,
                                        "pdb_resid": ob_resid,
                                        "pdb_chain": cn,
                                        "pdb_ca_coords": ca_coord,
                                    },
                                    success: function (data) {
                                        ChangePDBLock = 1;
                                        PDB.textData = data["result"];
                                        changeMeshPerFrame(groupIndex, ca_residue, rs_showLow)
                                    }
                                });
                            }
                        }
                    }
                    // 如果是侧链蛋白，则以Ca为圆心，转动，转动后坐标更新到PDB中
                    // if () {
                    //     pass
                    // }

                }
            }
        }
    }

    var line = controller.getObjectByName('line');
    var intersections = getIntersections(controller);
    if (intersections != undefined && intersections.length > 0) {
        var intersection = intersections[0];
        if (intersection.type === "Group") {
            line.scale.z = intersection.children[0].distance;
        } else {
            line.scale.z = intersection.distance;
        }

        for (var i = 0; i < intersections.length; i++) {
            var intersection = intersections[i];
            if (intersection.object.type === "Group") {
                var ot_index = '';
                var groupindex = intersection.object.userData["group"];
                if (intersection.object.userData["type"] == 'low') {
                    ot_index = groupindex.substring(0, groupindex.length - 4);
                } else if (intersection.object.userData["type"] == 'normal') {
                    ot_index = groupindex + '_low';
                }
                if (ot_index != '') {
                    PDB.tool.colorIntersectObjectRed(PDB.GROUP[ot_index], 1);
                }
            }
            var object = intersection.object;
            intersected.push(object);
            PDB.tool.colorIntersectObjectRed(object, 1);


            if (!PDB.isShowMenu && object.userData.presentAtom) {
                let resid = findKeyByValue(PDB.RESIDUEID[object.userData.presentAtom.chainname.toLowerCase()], object.userData.presentAtom.resid);
                if (resid) {
                    if (resid != PDB.GLOBAL_ID) {
                        PDB.GLOBAL_ID = resid;
                        setTimeout(function () {
                            // 在这里编写需要延迟执行的代码
                            let message = object.userData.presentAtom.chainname.toUpperCase() + "." + resid + "." + object.userData.presentAtom.resname.toUpperCase();
                            message = message + "." + object.userData.presentAtom.name.toUpperCase();
                            let atom_color = object.userData.presentAtom.color
                            let new_color = new THREE.Color(1 - atom_color.r, 1 - atom_color.g, 1 - atom_color.b);
                            PDB.painter.showDFIREInfo(object.userData.presentAtom, message, new_color);


                        }, 100);


                        // "chain: " + object.userData.presentAtom.chainname.toUpperCase() + " " + "Residue ID: " + object.userData.presentAtom.resid);)
                    }

                }

            }
        }
    } else {
        line.scale.z = 10;
    }

}

function findKeyByValue(obj, value) {
    for (let key in obj) {
        if (obj[key] === value) {
            return key;
        }
    }
    return null;
}

function cleanIntersected() {
    while (intersected.length) {
        var object = intersected.pop();
        PDB.tool.colorIntersectObjectRed(object, 0);
        if (object.type === "Group") {
            var ot_index = '';
            var groupindex = object.userData["group"];
            if (object.userData["type"] == 'low') {
                ot_index = groupindex.substring(0, groupindex.length - 4);
            } else if (object.userData["type"] == 'normal') {
                ot_index = groupindex + '_low';
            }
            if (ot_index != '') {
                PDB.tool.colorIntersectObjectRed(PDB.GROUP[ot_index], 0);
            }
        }
        //PDB.render.clearGroupIndex(PDB.GROUP_INFO);
    }
}


function onDocumentMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}


PDB.render = {
    animationView: false,
    currentNodeIndex: 0,
    init: function () {
        scene = new THREE.Scene();
        raycasterFor3 = new THREE.Raycaster();
        container = document.createElement('div');
        document.body.appendChild(container);
        camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.1, 50000);
        camera.position.set(PDB.cameraPosition.x, PDB.cameraPosition.y, PDB.cameraPosition.z);
        scene.background = new THREE.Color(0x000000);
        scene.add(camera);
        document.addEventListener('mousemove', onDocumentMouseMove, false);
        this.addLightsByType(lightType);

        for (var i = 0; i < PDB.GROUP_COUNT; i++) {
            PDB.GROUP[i] = new THREE.Group();
            PDB.GROUP[i].userData["group"] = i;
            scene.add(PDB.GROUP[i]);
        }
        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;

        container.appendChild(renderer.domElement);


        if (controlsType == 0) {
            controls = new THREE.TrackballControls(camera, renderer.domElement);
            controls.minDistance = 10;
            controls.maxDistance = 50000;
            controls.staticMoving = false;
            controls.dynamicDampingFactor = 0.3;
            controls.rotateSpeed = 5;
        } else if (controlsType == 1) {
            stats = new Stats();
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.right = '0px';
            stats.domElement.style.left = 'inherit';
            container.appendChild(stats.dom);
            controls = new THREE.OrbitControls(camera);

            controls.target.set(0, 0, 0);
            //controls.update();
        } else {
            controls = new THREE.OrbitControls(camera, renderer.domElement);

        }

        window.addEventListener('resize', this.onWindowResize, false);
    },
    initVR: function () {
        container = document.createElement('div');
        document.body.appendChild(container);
        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x808080);
        scene.add(new THREE.HemisphereLight(0x808080, 0x606060));
        // Camera
        camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.1, 50000);
        // camera.position.copy(new THREE.Vector3(0, 0, 0));
        camera.position.set(0, 1.6, 300);
        //camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 50 );
        train.add(camera);
        scene.add(train);
        //controls
        controls = new THREE.OrbitControls(camera, container);

        controls.target.set(0, 1.6, 0);
        controls.update();

        // Group
        for (var i = 0; i < PDB.GROUP_COUNT; i++) {
            PDB.GROUP[i] = new THREE.Group();
            PDB.GROUP[i].userData["group"] = i;
            scene.add(PDB.GROUP[i]);
        }

        this.addLightsByType(lightType);


        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        renderer.xr.enabled = true;

        //vr
        document.body.appendChild(VRButton.createButton(renderer));
        renderer.xr.addEventListener('sessionstart', () => {
            isImmersive = true;
        });
        renderer.xr.addEventListener('sessionend', () => {
            isImmersive = false;
        });


        if (XR_VERSION == 1) {

            // controller1 手柄
            controller1 = renderer.xr.getController(0);

            controller1.addEventListener('selectstart', onTriggerDown);
            controller1.addEventListener('selectend', onTriggerUp);

            train.add(controller1);
            // scene.add();
            // scene.add(controller2);

            var controllerModelFactory = new THREE.XRControllerModelFactory();
            controllerGrip1 = renderer.xr.getControllerGrip(0);
            controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
            // scene.add(controllerGrip1);
            train.add(controllerGrip1);

            // helpers
            var geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
            var material = new THREE.LineBasicMaterial({
                vertexColors: true,
                linewidth: 100,
                blending: THREE.AdditiveBlending
            });
            var line = new THREE.Line(geometry, material);
            line.name = 'line';
            line.scale.z = 5;
            controller1.add(line.clone());
            // controller2.add(line.clone());
        } else {
            window.addEventListener('vr controller connected', function (event) {
                controller1 = event.detail;
                console.log("style:" + controller1.style + " " + controller1.gamepad.hand);
                console.log(controller1);
                //controller1 = new THREE.VRController( 0 );
                controller1.standingMatrix = renderer.vr.getStandingMatrix();
                controller1.addEventListener('thumbstick touch began', function (event) {
                    // console.log("-----------------------thumbstick touch began");
                    //onThumbpadDown(event);
                })
                controller1.addEventListener('thumbstick touch ended', function (event) {
                    // console.log("-----------------------thumbstick touch end");
                    //onThumbpadUp(event);
                })
                controller1.addEventListener('thumbpad touch began', function (event) {
                    // console.log("-----------------------thumbpad touch began");
                    //onThumbpadDown(event);
                })
                controller1.addEventListener('thumbpad touch ended', function (event) {
                    // console.log("-----------------------thumbpad touch end");
                    //onThumbpadUp(event);
                })
                controller1.addEventListener('thumbpad press began', function (event) {
                    // console.log("-----------------------thumbpad press began");
                    onThumbpadDown(event);
                })
                controller1.addEventListener('thumbpad press ended', function (event) {
                    // console.log("-----------------------thumbpad press end");
                    onThumbpadUp(event);
                })
                // Trigger (vive and microsoft ok)
                controller1.addEventListener('primary press began', function (event) {
                    onTriggerDown(event);
                })
                // Trigger (vive and microsoft ok)
                controller1.addEventListener('primary press ended', function (event) {
                    onTriggerUp(event);
                })
                // menu (vive and microsoft ok)
                controller1.addEventListener('menu press began', function (event) {
                    onMenuDown(event);
                })
                // menu (vive and microsoft ok)
                controller1.addEventListener('menu press ended', function (event) {
                    onMenuUp(event);
                })
                controller1.addEventListener('thumbstick axes changed', function (event) {
                    //console.log("thumbstick axes end");
                    onAxisChanged(event);
                    //onThumbpadDown(event)
                })
                controller1.addEventListener('thumbpad axes changed', function (event) {
                    onAxisChanged(event);
                })
                controller1.addEventListener('primary axes changed', function (event) {
                    onAxisChanged(event);
                })

                scene.add(controller1);
                var objname = 'vr_controller_vive_1_5.obj';
                var path = 'js/models/vive-controller/';
                if (controller1.style === "microsoft") {
                    objname = controller1.gamepad.hand + '.obj';
                    path = 'js/models/microsoft-controller/';
                }
                var loader = new THREE.OBJLoader();
                loader.setPath(path);

                loader.load(objname, function (object) {
                    var loader = new THREE.TextureLoader();
                    loader.setPath(path);
                    var controller = object.children[0];
                    if (controller1.style === "microsoft") {
                        console.log("onepointfive_texture png")
                    } else {
                        controller.material.map = loader.load('onepointfive_texture.png');
                        controller.material.specularMap = loader.load('onepointfive_spec.png');
                    }
                    controller1.add(object.clone());
                    //controller2.add( object.clone() );
                });

                // helpers
                var geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
                var material = new THREE.LineBasicMaterial({
                    vertexColors: true,
                    linewidth: 2,
                    blending: THREE.AdditiveBlending
                });
                var line = new THREE.Line(geometry, material);
                line.name = 'line';
                line.scale.z = 5;
                controller1.add(line.clone());
                //controller2.add( line.clone() );
            });
        }


        raycaster = new THREE.Raycaster();
        window.addEventListener('resize', onWindowResize, false);

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    },
    changeToThreeMode: function (mode, travelMode) {
        var scope = this;
        PDB.tool.hideGroup(PDB.GROUP_VR_MENU_DOCKING);
        PDB.tool.hideGroup(PDB.GROUP_VR_MENU_DRUG);
        PDB.mode = mode;
        PDB.TravelMode = travelMode;
        scope.removeCamera(scene);
        camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.1, 50000);
        camera.position.set(0, 0, 300);
        scene.background = new THREE.Color(0x000000);
        scene.add(camera);
        console.log("lightType:" + lightType);

        scope.clearRender();
        scope.generateRender();
        //all the group position back the initial location
        PDB.tool.backToInitialPositonForDesktop();
        console.log("lightType:" + lightType);
        this.addLightsByType(lightType);

        if (controlsType == 0) {
            controls = new THREE.TrackballControls(camera, renderer.domElement);
            controls.minDistance = 10;
            controls.maxDistance = 50000;
        } else if (controlsType == 1) {
            stats = new Stats();
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.right = '0px';
            stats.domElement.style.left = 'inherit';
            container.appendChild(stats.dom);
            controls = new THREE.OrbitControls(camera);
            controls.target.set(0, 0, 0);
            controls.update();
        } else {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
        }

        if (PDB.TravelMode === true) {
            scope.openTrackMode();
        } else {
            PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
            PDB.controller.refreshGeometryByMode(PDB.config.hetMode);
        }
    },
    changeToVrMode: function (mode, travelMode) {
        if (PDB.mode !== mode) {
            var scope = this;
            PDB.mode = mode;
            PDB.TravelMode = travelMode;
            scope.clearStructure();
            scope.removeCamera(scene);
            PDB.tool.showGroup(PDB.GROUP_VR_MENU_DOCKING);
            PDB.tool.showGroup(PDB.GROUP_VR_MENU_DRUG);
            scope.initVR();
            if (PDB.TravelMode === true) {
                // PDB.controller.refreshGeometryByMode(PDB.TUBE);
                scope.openTrackMode();
            } else {
                PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
                PDB.controller.refreshGeometryByMode(PDB.config.hetMode);
            }
        }
    },
    openTrackMode: function () {

        PDB.parent = new THREE.Object3D();
        scene.add(PDB.parent);
        splineCamera = new THREE.PerspectiveCamera(84, window.innerWidth / window.innerHeight, 0.01, 1000);
        PDB.parent.add(splineCamera);

        var light = new THREE.PointLight(0xffffff, 1, 0);
        light.position.copy(splineCamera.position);
        //camera.add( light );
        splineCamera.add(light);

        cameraEye = new THREE.Mesh(new THREE.SphereGeometry(5), new THREE.MeshBasicMaterial({
            color: 0xdddddd
        }));
        //PDB.parent.add( cameraEye );
        // console.log(PDB.TravelGeometry);
        if (PDB.TravelGeometry != "") {
            var time = Date.now();
            var looptime = 200 * 1000;
            var t = (time % looptime) / looptime;

            var pos = PDB.TravelGeometry.parameters.path.getPointAt(t);
            pos.multiplyScalar(PDB.TravelScale);

            // interpolation
            var segments = PDB.TravelGeometry.tangents.length;
            var pickt = t * segments;
            var pick = Math.floor(pickt);
            var pickNext = (pick + 1) % segments;
            if (typeof binormal != THREE.Vector3) {
                binormal = new THREE.Vector3();
            }
            if (typeof normal != THREE.Vector3) {
                normal = new THREE.Vector3();
            }
            binormal.subVectors(PDB.TravelGeometry.binormals[pickNext], PDB.TravelGeometry.binormals[pick]);
            binormal.multiplyScalar(pickt - pick).add(PDB.TravelGeometry.binormals[pick]);

            var dir = PDB.TravelGeometry.parameters.path.getTangentAt(t);
            var offset = 5;
            normal.copy(binormal).cross(dir);

            // we move on a offset on its binormal
            pos.add(normal.clone().multiplyScalar(offset));

            splineCamera.position.copy(pos);
            cameraEye.position.copy(pos);

            // using arclength for stablization in look ahead
            var lookAt = PDB.TravelGeometry.parameters.path.getPointAt((t + 5 / PDB.TravelGeometry.parameters.path.getLength()) % 1).multiplyScalar(PDB.TravelScale);

            // camera orientation 2 - up orientation via normal
            //if ( ! params.lookAhead ) lookAt.copy( pos ).add( dir );
            splineCamera.matrix.lookAt(splineCamera.position, lookAt, normal);
            splineCamera.rotation.setFromRotationMatrix(splineCamera.matrix, splineCamera.rotation.order);
            //cameraHelper.update();
            //params.animationView === true ? splineCamera : camera
        }

    },
    addLightsByType: function (lightType) {
        if (lightType == 0) {
            var light = new THREE.DirectionalLight(0xffffff, 1.2);
            light.position.copy(camera.position);
            camera.add(light);
        } else if (lightType == 1) {
            var light = new THREE.DirectionalLight(0xffffff);
            light.position.set(0, 6, 0);
            light.castShadow = true;
            light.shadow.camera.top = 2;
            light.shadow.camera.bottom = -2;
            light.shadow.camera.right = 2;
            light.shadow.camera.left = -2;
            light.shadow.mapSize.set(4096, 4096);
            scene.add(light);
        } else if (lightType == 2) {
            var lights = [];
            lights[0] = new THREE.PointLight(0xffffff, 1, 0);
            lights[1] = new THREE.PointLight(0xffffff, 1, 0);
            lights[2] = new THREE.PointLight(0xffffff, 1, 0);

            lights[0].position.set(0, 200, 0);
            lights[1].position.set(100, 200, 100);
            lights[2].position.set(-100, -200, -100);

            scene.add(lights[0]);
            scene.add(lights[1]);
            scene.add(lights[2]);
        } else if (lightType == 3) {
            particleLight = new THREE.Mesh(new THREE.SphereBufferGeometry(0, 0, 0), new THREE.MeshBasicMaterial({
                color: 0xffffff
            }));
            scene.add(particleLight);
            // Lights
            scene.add(new THREE.AmbientLight(0x222222));
            var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(1, 1, 1).normalize();
            scene.add(directionalLight);

            var pointLight = new THREE.PointLight(0xffffff, 2, 800);
            particleLight.add(pointLight);
        }
    },
    render: function () {
        if (PDB.mode === PDB.MODE_VR || PDB.mode === PDB.MODE_TRAVEL_VR) {

            //if(controller1!=undefined){controller1.update();}
            //controller2.update();
            //THREE.VRController.update();
            //vrControls.update();
            // statsVR.msStart();
            // statsVR.update();
            // statsVR.setCustom1("x:" + camera.position.x.toFixed(2));
            // statsVR.setCustom2("y:" + camera.position.y.toFixed(2));
            // statsVR.setCustom3("z:" + camera.position.z.toFixed(2));

            if (menu_panel != undefined) {
                menu_panel.lookAt(camera.position);
            }

            cleanIntersected();
            // yang dan feng
            if (controller1 != undefined) {
                intersectObjects(controller1);

                // controller1.update();
            }
            //intersectObjects( THREE.VRController.prototype );

            // 用不到--杨丹枫
            if (PDB.TravelMode === true && PDB.TravelGeometry !== "") {

                var time = Date.now();
                var looptime = 200 * 1000;
                var t = (time % looptime) / looptime;

                var pos = PDB.TravelGeometry.parameters.path.getPointAt(t);
                pos.multiplyScalar(PDB.TravelScale);

                // interpolation

                var segments = PDB.TravelGeometry.tangents.length;
                var pickt = t * segments;
                var pick = Math.floor(pickt);
                var pickNext = (pick + 1) % segments;
                if (typeof binormal != THREE.Vector3) {
                    binormal = new THREE.Vector3();
                }
                if (typeof normal != THREE.Vector3) {
                    normal = new THREE.Vector3();
                }
                binormal.subVectors(PDB.TravelGeometry.binormals[pickNext], PDB.TravelGeometry.binormals[pick]);
                binormal.multiplyScalar(pickt - pick).add(PDB.TravelGeometry.binormals[pick]);

                var dir = PDB.TravelGeometry.parameters.path.getTangentAt(t);
                var offset = 10;

                normal.copy(binormal).cross(dir);

                // we move on a offset on its binormal
                pos.add(normal.clone().multiplyScalar(offset));

                PDB.parent.position.copy(pos);
                //cameraEye.position.copy( pos );
                // using arclength for stablization in look ahead

                var lookAt = PDB.TravelGeometry.parameters.path.getPointAt((t + 5 / PDB.TravelGeometry.parameters.path.getLength()) % 1).multiplyScalar(PDB.TravelScale);

                // camera orientation 2 - up orientation via normal
                //if ( ! params.lookAhead ) lookAt.copy( pos ).add( dir );
                // PDB.parent.matrix.lookAt( PDB.parent.position, lookAt, normal );
                // PDB.parent.rotation.setFromRotationMatrix( PDB.parent.matrix, PDB.parent.rotation.order );

                PDB.parent.matrix.lookAt(PDB.parent.position, lookAt, normal);
                PDB.parent.rotation.setFromRotationMatrix(PDB.parent.matrix, PDB.parent.rotation.order);

                //cameraEye.matrix.lookAt( cameraEye.position, lookAt, normal );
                //cameraEye.rotation.setFromRotationMatrix( cameraEye.matrix, cameraEye.rotation.order );

                //cameraHelper.update();
                //params.animationView === true ? splineCamera : camera
                //renderer.render( scene, splineCamera );

                //renderer.render( scene, splineCamera );
                camera = splineCamera;
                //
                //camera.position.copy(pos);
                //renderer.render( scene, camera );

                //vrEffect.render( scene, camera );
            }
            // else{
            // vrEffect.render( scene, camera );
            // }
            //camera.updateProjectionMatrix();

            if (PDB.DRUGMOVE) {
                var now = new Date();
                //console.log(PDB.drugMoveTime - now);
                if (PDB.drugMoveTime - now < -500) {
                    PDB.tool.migrationDrug();
                    PDB.drugMoveTime = new Date();
                }
            }
            // PDB.render.showMenu();
            // PDB.painter.showMenu(PDB.MENU_TYPE_CURRENT);
            listen_button();
            renderer.render(scene, camera);

            // PDB.painter.showTubeByResdue(atom.chainname, atom.resid, true, true, true);
            //statsVR.msEnd();

        } else if (PDB.mode === PDB.MODE_THREE || PDB.MODE_TRAVEL_THREE) {
            // 用不到这里--杨丹枫
            if (PDB.TravelMode === true && PDB.TravelGeometry != "") {
                var time = Date.now();
                var looptime = 200 * 1000;
                var t = (time % looptime) / looptime;

                var pos = PDB.TravelGeometry.parameters.path.getPointAt(t);
                pos.multiplyScalar(PDB.TravelScale);

                // interpolation
                var segments = PDB.TravelGeometry.tangents.length;
                var pickt = t * segments;
                var pick = Math.floor(pickt);
                var pickNext = (pick + 1) % segments;
                if (typeof binormal != THREE.Vector3) {
                    binormal = new THREE.Vector3();
                }
                if (typeof normal != THREE.Vector3) {
                    normal = new THREE.Vector3();
                }
                binormal.subVectors(PDB.TravelGeometry.binormals[pickNext], PDB.TravelGeometry.binormals[pick]);
                binormal.multiplyScalar(pickt - pick).add(PDB.TravelGeometry.binormals[pick]);

                var dir = PDB.TravelGeometry.parameters.path.getTangentAt(t);
                var offset = 10;

                normal.copy(binormal).cross(dir);

                // we move on a offset on its binormal
                pos.add(normal.clone().multiplyScalar(offset));

                splineCamera.position.copy(pos);
                cameraEye.position.copy(pos);

                // using arclength for stablization in look ahead

                var lookAt = PDB.TravelGeometry.parameters.path.getPointAt((t + 5 / PDB.TravelGeometry.parameters.path.getLength()) % 1).multiplyScalar(PDB.TravelScale);
                // camera orientation 2 - up orientation via normal

                //if ( ! params.lookAhead ) lookAt.copy( pos ).add( dir );
                splineCamera.matrix.lookAt(splineCamera.position, lookAt, normal);
                splineCamera.rotation.setFromRotationMatrix(splineCamera.matrix, splineCamera.rotation.order);

                //cameraHelper.update();
                //params.animationView === true ? splineCamera : camera
                renderer.render(scene, splineCamera);
            } else {
                raycasterFor3.setFromCamera(mouse, camera);
                var allObjs = [];

                var groupHet = PDB.GROUP[PDB.GROUP_HET];
                var groupMutation = PDB.GROUP[PDB.GROUP_MUTATION];

                // ranx edit on 20200226 for lable show on all chain
                if (w3m.mol[PDB.pdbId] && w3m.mol[PDB.pdbId].chain) {
                    var chains = w3m.mol[PDB.pdbId].chain;
                    if (chains && Object.keys(chains).length > 0) {
                        var chainsID = Object.keys(chains);
                        for (var i in chainsID) {
                            var groupMain_h = PDB.GROUP["chain_" + chainsID[i]];
                            if (groupMain_h) {
                                for (var k = 0; k < groupMain_h.children.length; k++) {
                                    allObjs.push(groupMain_h.children[k]);
                                }
                            }
                            var groupMain_l = PDB.GROUP["chain_" + chainsID[i] + "_low"];
                            if (groupMain_l) {
                                for (var j = 0; j < groupMain_l.children.length; j++) {
                                    allObjs.push(groupMain_l.children[j]);
                                }
                            }

                        }
                    }
                }

                // for(var i in chains){
                //   var groupMain = PDB.GROUP[PDB.GROUP_STRUCTURE_INDEX[PDB.GROUP_MAIN]];
                //   if (groupMain != undefined && groupMain.children != undefined && groupMain.children.length > 0) {
                //     for (var i = 0; i < groupMain.children.length; i++) {
                //       allObjs.push(groupMain.children[i]);
                //     }
                //   }
                // }
                if (groupHet != undefined && groupHet.children != undefined && groupHet.children.length > 0) {
                    for (var i = 0; i < groupHet.children.length; i++) {
                        allObjs.push(groupHet.children[i]);
                    }
                }
                if (groupMutation != undefined && groupMutation.children != undefined && groupMutation.children.length > 0) {
                    for (var i = 0; i < groupMutation.children.length; i++) {
                        allObjs.push(groupMutation.children[i]);
                    }
                }
                var intersects = raycasterFor3.intersectObjects(allObjs);
                if (intersects.length > 0) {
                    if (INTERSECTED != intersects[0].object) {
                        PDB.render.clearGroupIndex(PDB.GROUP_INFO);
                        if (INTERSECTED && INTERSECTED.material != undefined && INTERSECTED.material.emissive != undefined) {
                            INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
                        }
                        INTERSECTED = intersects[0].object;
                        if (INTERSECTED.material != undefined && INTERSECTED.material.emissive != undefined) {
                            INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
                            INTERSECTED.material.emissive.setHex(0xff0000);
                        }

                        //deal with mutation
                        //console.log(INTERSECTED.userData);
                        if (INTERSECTED.userData.mutation != undefined) {
                            var atom = INTERSECTED.userData.presentAtom;
                            var mutation = INTERSECTED.userData.mutation;
                            var message = mutation.pos + " " + mutation.p_change + " " + mutation.v_class + " " + mutation.v_type;
                            var pos = PDB.tool.getAtomInfoPosition(atom.pos_centered, camera.position);
                            PDB.drawer.drawTextForDesktop(PDB.GROUP_INFO, pos,
                                message, "", atom.color, 180);
                            if (PDB.mode == PDB.MODE_THREE) {
                                PDB.tool.showInfoPanel(true, message);
                            }
                            var selectedMutation = document.getElementById(PDB.SELECTED_MUTATION);
                            if (selectedMutation) {
                                selectedMutation.style.background = "transparent";
                            }
                            var tr = document.getElementById(mutation.pos + mutation.p_change);
                            if (tr) {
                                tr.style.background = "red";
                                PDB.SELECTED_MUTATION = mutation.pos + mutation.p_change;
                                window.location.hash = "#" + PDB.SELECTED_MUTATION;
                            }
                        } else if (INTERSECTED.userData.presentAtom != undefined) {
                            // PDB.painter.showAtomLabel(INTERSECTED.userData.presentAtom);
                            var atom = INTERSECTED.userData.presentAtom;
                            var message = "";
                            var pos = PDB.tool.getAtomInfoPosition(atom.pos_centered, camera.position);
                            switch (PDB.label_type) {
                                case PDB.SELECTION_MODEL:
                                    message = atom.chainname.toUpperCase() + "." +
                                        atom.resname.substring(0, 1).toUpperCase() + atom.resname.substring(1) + "." + atom.resid +
                                        "." + atom.name.substring(0, 1).toUpperCase() + atom.name.substring(1);
                                    break;
                                case PDB.SELECTION_CHAIN:
                                    message = atom.chainname.toUpperCase();
                                    break;
                                case PDB.SELECTION_RESIDUE:
                                    message = atom.chainname.toUpperCase() + "." +
                                        atom.resname.substring(0, 1).toUpperCase() + atom.resname.substring(1) + "." + atom.resid;
                                    break;
                                case PDB.SELECTION_ATOM:
                                    message = atom.chainname.toUpperCase() + "." +
                                        atom.resname.substring(0, 1).toUpperCase() + atom.resname.substring(1) + "." + atom.resid +
                                        "." + atom.name.substring(0, 1).toUpperCase() + atom.name.substring(1);
                                    break;
                            }
                            PDB.drawer.drawTextForDesktop(PDB.GROUP_INFO, pos,
                                message, "", atom.color, 180);
                            if (PDB.mode == PDB.MODE_THREE) {
                                PDB.tool.showInfoPanel(true, message);
                            }
                        }
                        if (INTERSECTED.userData.mutation != undefined) {
                            // PDB.painter.showAtomLabel(INTERSECTED.userData.presentAtom);
                        }
                    }
                } else {
                    var selectedMutation = document.getElementById(PDB.SELECTED_MUTATION);
                    if (selectedMutation) {
                        selectedMutation.style.background = "transparent";
                    }
                    if (INTERSECTED && INTERSECTED.material != undefined && INTERSECTED.material.emissive != undefined) {
                        INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
                    }
                    INTERSECTED = null;
                    PDB.render.clearGroupIndex(PDB.GROUP_INFO);
                    if (PDB.mode == PDB.MODE_THREE) {
                        PDB.tool.showInfoPanel(false);
                    }
                }
                renderer.render(scene, camera);
            }
            camera.updateProjectionMatrix();
            controls.update();
        }
        //mutation effect

        //rotation effect
        // 用不到--杨丹枫
        if (PDB.ROTATION_START_FLAG) {
            PDB.tool.rotation(PDB.GROUP_STRUCTURE_INDEX, PDB.ROTATION_DIRECTION);
        }
    },
    showDemo: function () {
        if (PDB.DEMO.FLAG) {
            var time = Date.now();
            if (time - PDB.DEMO.LAST_EXE_TIME >= 8000 && PDB.DEMO.INDEX != PDB.DEMO.PRE_INDEX) {

                console.log(PDB.DEMO.INDEX);
                console.log("start----");
                PDB.DEMO.PRE_INDEX = PDB.DEMO.INDEX;
                switch (PDB.DEMO.INDEX) {
                    case 0:
                        PDB.config.mainMode = PDB.SPHERE;
                        PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
                        break;
                    case 1:
                        PDB.config.mainMode = PDB.TUBE;
                        PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
                        break;
                    case 2:
                        PDB.config.mainMode = PDB.RIBBON_ELLIPSE;
                        PDB.controller.refreshGeometryByMode(PDB.config.mainMode);
                        break;
                    case 3:
                        PDB.config.hetMode = PDB.HET_SPHERE;
                        PDB.controller.refreshGeometryByMode(PDB.config.hetMode);
                        break;
                    case 4:
                        PDB.config.hetMode = PDB.HET_BALL_ROD;
                        PDB.controller.refreshGeometryByMode(PDB.config.hetMode);
                        break;
                    case 5:
                        PDB.controller.clear(4, undefined);
                        PDB.CONFIG.startSegmentSurfaceID = 0;
                        PDB.CONFIG.endSegmentSurfaceID = 0;
                        PDB.SURFACE_WIREFRAME = true;
                        PDB.SURFACE_OPACITY = 0.5;
                        PDB.SURFACE_TYPE = 1;
                        PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, PDB.SURFACE_OPACITY, PDB.SURFACE_WIREFRAME);
                        break;
                    case 6:
                        PDB.controller.clear(4, undefined);
                        PDB.SURFACE_WIREFRAME = false;
                        PDB.SURFACE_OPACITY = 0.6;
                        PDB.SURFACE_TYPE = 3;
                        PDB.controller.refreshSurface(PDB.config.surfaceMode, PDB.SURFACE_TYPE, PDB.SURFACE_OPACITY, PDB.SURFACE_WIREFRAME);
                        break;
                    case 7:
                        //hide surface
                        PDB.GROUP[PDB.GROUP_SURFACE].visible = false;
                        PDB.controller.switchColorBymode(602);
                        break;
                    case 8:
                        PDB.controller.switchColorBymode(603);
                        break;
                    case 9:
                        PDB.controller.switchColorBymode(606);
                        break;
                    case 10:
                        PDB.controller.switchColorBymode(609);
                        break;
                    case 11:
                        PDB.render.clear(3);
                        var startid = PDB.tool.getFirstAtomByResidueId(10, "a")[1];
                        var endid = PDB.tool.getLastAtomByResidueId(80, "a")[1];
                        PDB.controller.fragmentPainter(startid, endid, "Rectangle");
                        break;
                    case 12:
                        PDB.render.clear(3);
                        var startid = PDB.tool.getFirstAtomByResidueId(50, "a")[1];
                        var endid = PDB.tool.getLastAtomByResidueId(55, "a")[1];
                        PDB.SURFACE_OPACITY = 0.7;
                        PDB.controller.fragmentPainter(startid, endid, "Surface");
                        break;
                    case 13:
                        //hide surface
                        PDB.GROUP[PDB.GROUP_SURFACE].visible = false;
                        //show mutation
                        PDB.controller.clear(4, undefined);
                        PDB.painter.showMutation(PDB.mutation);
                        break;
                    case 14:
                        //hide surface
                        PDB.GROUP[PDB.GROUP_SURFACE].visible = false;
                        //hide mutation
                        PDB.render.clearGroupIndex(PDB.GROUP_MUTATION);

                        var locationStart = PDB.tool.getMainAtom(PDB.pdbId, 700);
                        locationStart.pos_curr = locationStart.pos_centered;
                        var locationEnd = PDB.tool.getMainAtom(PDB.pdbId, 750);
                        locationEnd.pos_curr = locationEnd.pos_centered;
                        PDB.painter.showDistance(locationStart, locationEnd);

                        break;
                    case 15:
                        PDB.render.clearGroupIndex(PDB.GROUP_INFO);
                        PDB.controller.clear(4, undefined);
                        PDB.DEMO.INDEX = -1;
                        break;
                }
                PDB.DEMO.INDEX = PDB.DEMO.INDEX + 1;
                //PDB.DEMO.PRE_INDEX =
                PDB.DEMO.LAST_EXE_TIME = time = Date.now();
                console.log("end----");
            }

        }
    },
    animate: function () {
        if (PDB.mode === PDB.MODE_VR || PDB.mode === PDB.MODE_TRAVEL_VR) {
            renderer.setAnimationLoop(PDB.render.render);
        } else if (PDB.mode === PDB.MODE_THREE || PDB.MODE_TRAVEL_THREE) {
            //zdw three mode
            PDB.render.render();
            requestAnimationFrame(PDB.render.animate);
        }
        //
        var offset = camera.position;
        if (!PDB.offset) {
            PDB.offset = offset.clone();
        }
        var movenlength = Math.sqrt(Math.pow(offset.x - PDB.offset.x, 2) + Math.pow(offset.y - PDB.offset.y, 2) + Math.pow(offset.z - PDB.offset.z, 2));
        if (movenlength > 0.01) { //0.01, speci
            var vec = {
                x: offset.x - PDB.offset.x * 10,
                y: offset.y - PDB.offset.y * 10,
                z: offset.z - PDB.offset.z * 10
            }
            PDB.tool.getRealVectorForRepeatPainter(vec);
        }
        PDB.offset = offset.clone();
        //====add the random  migration path and scope of drug
        if (PDB.DRUGMOVE) {
            var now = new Date();
            //console.log(PDB.drugMoveTime - now);
            if (PDB.drugMoveTime - now < -2000) {
                PDB.tool.migrationDrug();
                PDB.drugMoveTime = new Date();
            }
        }
    },
    onWindowResize: function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        // if (PDB.VRMode) {
        //     vrEffect.setSize( window.innerWidth, window.innerHeight );
        // }
    },
    hideMenu: function () {
        PDB.SHOW_MUTATION_WHEN_SWITCH_VR_MENU = 1;
        PDB.render.clearGroupIndex(PDB.GROUP_MENU);
        PDB.render.clearGroupIndex(PDB.GROUP_KEYBOARD);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_VIS);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_MAIN);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_LABEL);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_TRAVEL);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_EX_HET);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_HET);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_COLOR);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_MEASURE);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DRAG);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_FRAGMENT);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_EDITING);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_SURFACE);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_MUTATION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_ROTATION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DIRECTION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_EXPORT);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_SPEECH);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_OUTBALL);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DRUG);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DENSITYMAP);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_CONSERVATION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_HBOND);
        PDB.render.clearGroupIndex(PDB.GROUP_INPUT);
        PDB.render.showStructure();

    },
    hideSubMenu: function () {
        PDB.SHOW_MUTATION_WHEN_SWITCH_VR_MENU = 1;
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_VIS);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_MAIN);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_HET);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_LABEL);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_TRAVEL);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_SURFACE);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_MUTATION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_ROTATION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DIRECTION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_SPEECH);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_EXPORT);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_OUTBALL);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_EDITING);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DRUG);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DENSITYMAP);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_CONSERVATION);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_HBOND);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_EX_HET);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_COLOR);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_MEASURE);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_DRAG);
        PDB.render.clearGroupIndex(PDB.GROUP_MENU_FRAGMENT);
    },
    showMenu: function () {
        PDB.SHOW_MUTATION_WHEN_SWITCH_VR_MENU = 0;
        PDB.painter.showKeyboard();
        PDB.painter.showMenu(PDB.MENU_TYPE_FIRST);
        menu_panel = new THREE.Object3D();
        // scene.add(menu_panel);
        train.add(menu_panel);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_KEYBOARD]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_VIS]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_MAIN]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_LABEL]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_EX_HET]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_TRAVEL]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_SURFACE]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_MUTATION]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_ROTATION]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_DIRECTION]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_EXPORT]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_SPEECH]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_OUTBALL]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_EDITING]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_DRUG]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_DENSITYMAP]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_CONSERVATION]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_HBOND]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_HET]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_COLOR]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_MEASURE]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_DRAG]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_MENU_FRAGMENT]);
        menu_panel.add(PDB.GROUP[PDB.GROUP_INPUT]);

        menu_panel.position.set(0, 0, -3);
        showMenu = true;
        PDB.render.hideStructure();

        // TODO 关闭图片说明
        // if () {
        //
        // }
    },
    hideStructure: function () {
        for (var i in PDB.GROUP_STRUCTURE_INDEX) {
            PDB.GROUP[PDB.GROUP_STRUCTURE_INDEX[i]].visible = false;
        }
    },
    showStructure: function () {
        for (var i in PDB.GROUP_STRUCTURE_INDEX) {
            if (PDB.GROUP_STRUCTURE_INDEX[i] === PDB.GROUP_BOX_HELPER) {
                continue;
            }
            PDB.GROUP[PDB.GROUP_STRUCTURE_INDEX[i]].visible = true;
        }
    },
    clearStructure: function () {
        for (var i = 0; i < PDB.GROUP_STRUCTURE_INDEX.length; i++) {
            this.clearGroupIndex(PDB.GROUP_STRUCTURE_INDEX[i]);
        }

        PDB.parent = "";
    },
    clearMain: function () {
        for (var i = 0; i < PDB.GROUP_MAIN_INDEX.length; i++) {
            this.clearGroupIndex(PDB.GROUP_MAIN_INDEX[i]);
        }
        PDB.allMainToms = undefined;
    },
    clearGroup: function (group) {
        if (group != undefined && group.children != undefined && group.children.length > 0) {
            group.children = [];
        }
    },
    clearGroupIndex0: function (group) {
        if (PDB.GROUP[group] != undefined && PDB.GROUP[group].children != undefined && PDB.GROUP[group].children.length > 0) {
            PDB.GROUP[group].children = [];
        }
    },
    clearGroupIndex: function (groupIndex) {
        if (PDB.GROUP[groupIndex] != undefined && PDB.GROUP[groupIndex].children != undefined && PDB.GROUP[groupIndex].children.length > 0) {
            var children = PDB.GROUP[groupIndex].children;
            for (var i = 0; i < children.length; i++) {
                if (children[i] instanceof THREE.Mesh) {
                    var meshObj = children[i];
                    if (meshObj.geometry) {
                        meshObj.geometry.dispose();
                    }
                    if (meshObj.material && meshObj.material.dispose) {
                        meshObj.material.dispose();
                    }
                    delete (meshObj);
                    meshObj = undefined;
                }
            }
            PDB.GROUP[groupIndex].children = [];
        }
    },
    clear: function (mode) {
        THREE.Cache.clear();
        switch (mode) {
            case 0:
                for (var i in PDB.GROUP_MAIN_INDEX) {
                    PDB.render.clearGroupIndex(PDB.GROUP_MAIN_INDEX[i]);
                }
                break;
            case 1:
                PDB.render.clearGroupIndex(PDB.GROUP_HET);
                break;
            case 2:
                for (var i in PDB.GROUP_STRUCTURE_INDEX) {
                    PDB.render.clearGroupIndex(PDB.GROUP_STRUCTURE_INDEX[i]);
                }
                PDB.allMainToms = undefined;
                PDB.TravelGeometry = "";

                if (scene !== undefined && scene.children.length > 0) {
                    scene.children.forEach(function (object) {
                        if (object instanceof THREE.Mesh) {
                            scene.remove(object);
                        }
                    })
                }
                //PDB.GROUP[PDB.GROUP_WATER].position.copy(new THREE.Vector3(0,0,0));
                break;
            case 3:
                PDB.render.clearGroupIndex(PDB.GROUP_SURFACE);
            case 4:
                PDB.render.clearGroupIndex(PDB.GROUP_MUTATION);
                break;
            case 5:
                //clear destiny map structure and menu panel.
                PDB.render.clearGroupIndex(PDB.GROUP_SLICE);
                PDB.render.clearGroupIndex(PDB.GROUP_MAP);
                break;
            case 6:
                var rightMenu = document.getElementById("rightmenu");
                if (rightMenu) {
                    rightMenu.innerHTML = "";
                }
                break;
        }
    },
    generateRender: function () {
        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        renderer.vr.enabled = true;
        renderer.vr.standing = true;
    },
    clearRender: function () {
        if (container.children.length > 0) {
            container.removeChild(container.childNodes[0]);
        }
        //delete Enter vr/exit vr button
        if (document.body.childNodes.length > 0) {
            var obj = document.body.childNodes[document.body.childNodes.length - 1];
            if (obj.innerHTML === "ENTER VR" || obj.innerHTML === "EXIT VR") {
                document.body.removeChild(obj);
            }
        }
        if (PDB.parent instanceof THREE.Object3D && PDB.parent.children.length > 0) {
            var size = PDB.parent.children.length;
            var deleteArray = [];
            for (var i = 0; i < size; i++) {
                deleteArray.push(PDB.parent.children[i]);
            }
            deleteArray.forEach(function (obj) {
                PDB.parent.remove(obj);
            })
        }
    },
    removeCamera: function (scene) {
        var count = scene.children.length;
        var deleteArray = [];
        for (var i = 0; i < count; i++) {
            var obj = scene.children[i];
            if (obj instanceof THREE.PerspectiveCamera) {
                deleteArray.push(obj);
            }
            if (obj instanceof THREE.PerspectiveCamera) {
                deleteArray.push(obj);
            }
            if (obj instanceof THREE.HemisphereLight) {
                deleteArray.push(obj);
            }
            if (obj instanceof THREE.PointLight) {
                deleteArray.push(obj);
            }
            if (obj instanceof THREE.ViveController) {
                deleteArray.push(obj);
            }
        }
        deleteArray.forEach(function (obj) {
            scene.remove(obj);
        })
    },
    exportToObj: function (type) {
        var exporter = new THREE.OBJExporter();
        switch (type) {
            case 'MainStructure':
                var residueData = w3m.mol[PDB.pdbId].residueData;
                for (var chain in residueData) {
                    var output = exporter.parse(PDB.GROUP['chain_' + chain]);
                    PDB.tool.saveString(output, PDB.pdbId + '_' + chain + '.obj');
                }
                break;
            case 'Map':
                var output = exporter.parse(PDB.GROUP[PDB.GROUP_MAP]);
                PDB.tool.saveString(output, PDB.pdbId + '.obj');
                break;
            case 'LigandStructure':
                if (PDB.GROUP[PDB.GROUP_HET]) {
                    var output = exporter.parse(PDB.GROUP[PDB.GROUP_HET]);
                    PDB.tool.saveString(output, 'het.obj');
                }
                break;
        }
    }
};
