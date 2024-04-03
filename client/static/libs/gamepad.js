// var raster = new THREE.Raycaster();
import {df} from './core.js';
import {w3m} from "./web3D/w3m.js";
import * as THREE from '../js/three.module.js';
var tempMatrix = new THREE.Matrix4();

function onTriggerDown(event, raster) {
    let controller = event.target;
    let intersections = getIntersections(controller, raster);

}


function rayCasterIntersect(raster) {
    for (let i = 0; i < df.pdbId.length; i++) {
        let pdbId = df.pdbId[i];
        for (let index in df.pdbInfoList) {
            let name = df.pdbInfoList[index];
            for (let chain in df.GROUP[pdbId][name]) {
                // if (!df.GROUP[pdbId][name][chain].visible) continue;
                let objects = df.GROUP[pdbId][name][chain].children;
                df.tool.colorIntersectObjectRed(df.GROUP[pdbId][name][chain], 1);
                // if (objects.length === 0) continue;
                let intersected = raster.intersectObjects(objects, true);
                if (intersected.length > 0) {

                    // intersected[0].object.material.color.set(0xff0000);
                    return intersected;
                }
            }
        }
    }
    return [];
}


function getIntersections(controller, raster) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    let inters = [];
    if (df.showMenu) {
    } else {
        let selected = rayCasterIntersect(raster);
        if (selected.length <= 0) return;
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
        }
        return inters;
    }
}


export {onTriggerDown}