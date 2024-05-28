// var raster = new THREE.Raycaster();
import {df} from './core.js';
import {camera, canon, scene} from './render.js';
import * as THREE from '../js/three.module.js';

// var tempMatrix = new THREE.Matrix4();

function objectTransform(object, controller, tempMatrix) {
    switch (df.selection) {
        case df.select_residue:
            break;
        default:
            object.matrix.premultiply(tempMatrix);
            object.matrix.decompose(object.position, object.quaternion, object.scale);
            controller.add(object);
            break;
    }
}

function objectDeTrans(controller) {
    for (let i = controller.children.length - 1; i >= 0; i--) {
        let child = controller.children[i];
        switch (child.type) {
            case df.GroupType:
                child.matrix.premultiply(controller.matrixWorld);
                child.matrix.decompose(child.position, child.quaternion, child.scale);
                df.tool.colorIntersectObjectRed(child, 0);
                scene.add(child);
                break;
        }
    }
}

function onTriggerDown(event, raster, tempMatrix) {

    let controller = event.target;
    // open menu
    let menuList = getIntersections(controller, raster, tempMatrix, true);
    let menuObject = menuList[0]
    if (menuObject.length > 0) {
        df.showMenu = !df.showMenu;
        df.GROUP['menu'].visible = df.showMenu;
        return;
    }
    // 操作 Menu 模块
    if (df.showMenu) {
        dealWithMenu(object);
    } else {
        // 拖拽蛋白功能
        let interList = getIntersections(controller, raster, tempMatrix);
        let intersections = interList[0];
        let controllerTempMatrix = interList[1];
        if (intersections && intersections.length <= 0) {
            return;
        }
        controllerTempMatrix.copy(controller.matrixWorld).invert();
        // 说明：intersections = [group, group, group...]
        for (let per in intersections) {
            objectTransform(intersections[per], controller, controllerTempMatrix);
        }
    }
}


function onTriggerUp(event) {
    let controller = event.target;
    switch (df.selection) {
        case df.select_chain:
            objectDeTrans(controller);
            break;
    }
}


function rayCasterIntersect(raster) {
    for (let i = 0; i < df.pdbId.length; i++) {
        let pdbId = df.pdbId[i];
        for (let index in df.pdbInfoList) {
            let name = df.pdbInfoList[index];
            for (let chain in df.GROUP[pdbId][name]) {
                if (!df.GROUP[pdbId][name][chain].visible) continue;
                let objects = df.GROUP[pdbId][name][chain].children;
                let intersected = raster.intersectObjects(objects, true);
                if (intersected.length > 0) {
                    let selectedObject = intersected[0].object;
                    let selectInfo = selectedObject.userData.presentAtom;
                    let selectedPDBId = selectInfo.pdbId;
                    let selectedType = selectInfo.typeName;
                    let selectedChain = selectInfo.chainName;
                    df.tool.colorIntersectObjectRed(
                        df.GROUP[selectedPDBId][selectedType][selectedChain],
                        1);
                    return intersected;
                }
            }
        }
    }
    return [];
}


function getIntersections(controller, raster, tempMatrix, onMenuButton = false) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    let inters = [];
    // 打开 menu 菜单
    if (onMenuButton) {
        let selected = raster.intersectObjects(camera.children);
        for (let i = 0; i < selected.length; i++) {
            if (selected[i] && selected[i].object.name === 'menu-button') {
                inters.push(selected[i]);
                return [inters, tempMatrix];
            }
        }
        return [inters, tempMatrix];
    }
    if (df.showMenu) {
        let selected = raster.intersectObjects(df.GROUP['menu'].children, true);
        if (selected) {
            let selectedObject = selected[0].object;
            let name = selectedObject.name;
            return [name, selectedObject];
        }
    } else {
        let selected = rayCasterIntersect(raster);
        if (selected.length <= 0) return [inters, tempMatrix];
        let selectedObject = selected[0].object;
        let selectedPoint = selected[0].point;
        const localPoint = selectedObject.worldToLocal(selectedPoint.clone());

        let selectInfo = selectedObject.userData.presentAtom;
        let selectedPDBId = selectInfo.pdbId;
        let selectedType = selectInfo.typeName;
        let selectedChain = selectInfo.chainName;
        switch (df.selection) {
            case df.select_all:
                for (let num = 0; num < df.pdbId.length; num++) {
                    let pdbId = df.pdbId[num];
                    for (let index in df.pdbInfoList) {
                        let name = df.pdbInfoList[index];
                        for (let chain in df.GROUP[pdbId][name]) {
                            let objects = df.GROUP[pdbId][name][chain];
                            if (objects.length === 0) continue;
                            inters.push(objects);
                        }
                    }
                }
                break;
            case df.select_main:
                for (let index in df.pdbInfoList) {
                    let name = df.pdbInfoList[index];
                    for (let chain in df.GROUP[selectedPDBId][name]) {
                        let objects = df.GROUP[selectedPDBId][name][chain];
                        if (objects.length === 0) continue;
                        inters.push(objects);
                    }
                }
                break;
            case df.select_chain:
                if (df.tool.isDictEmpty(df.GROUP[selectedPDBId][selectedType])) return;
                let objects = df.GROUP[selectedPDBId][selectedType][selectedChain];
                inters.push(objects);
                break;
            case df.select_residue:
                // 拖拽氨基酸 略过
                break;
        }
        return [inters, tempMatrix];
    }
}

// function f() {
//
// }

function dealWithMenu(object) {
    // if click main-menu
    if (object.title && object.title === df.MAIN_MENU) {
        // get content
        let name = object.name;
        // show sub-menu
        // 1. sub-menu trd-menu visible false
        // 2. show sub-menu




    }




    // switch (firstName) {
    //     case 'Load PDB':
    //         df.loader.load(SecondName, 'name', function () {
    //             df.controller.drawGeometry(df.config.mainMode, SecondName);
    //             df.tool.initPDBView(SecondName);
    //             df.showMenu = false;
    //             df.GROUP['menu'].visible = df.showMenu;
    //         });
    //         break;
    //     case 'Sequence':
    //         if (!SecondName) {
    //         }
    //         // get SecondName pdb text
    //         let pdb_text = df.pdbText[SecondName];
    //         // api
    //         let tools = df.SELECTED_DESIGN;
    //         df.tool.designAPI(df.DESIGN_TOOLS[tools], SecondName, pdb_text);
    //         break;
    // }

}


export {onTriggerDown, onTriggerUp}
