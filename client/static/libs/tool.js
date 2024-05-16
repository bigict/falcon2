/**
 * tools for Protein
 */
import * as THREE from '../js/three.module.js';
import {w3m} from "./web3D/w3m.js";
import {df} from './core.js';
import {camera, canon, renderer} from "./render.js";

df.tool = {
    // color
    colorIntersectObjectRed: function (obj, value) {
        if (obj.type === "Group") {
            obj.traverse(function (child) {
                if (child.isMesh) {
                    df.tool.colorIntersectObjectRed(child, value);
                }
            });
        } else if (obj.material) {
            if (typeof (obj.material) === "object" && obj.material.emissive) {
                obj.material.emissive.b = value;
            } else if (obj.material.length !== undefined && obj.material.length >= 0 && obj.material[0].emissive !== undefined) {
                obj.material[0].emissive.b = value;
            }
        }
    },
    getMainAtom: function (pdbId, id) {
        let atom = w3m.mol[pdbId].atom.main[id];
        if (atom !== undefined) {
            return this.getAtomById(pdbId, atom, 'main');
        } else {
            return undefined;
        }
    },
    getAtomById: function (pdbId, atom, structure) {
        // 从pdb文件中获取属性
        let danFeng = this;
        let atomID = atom[1];
        let atomName = atom[2];
        let residueName = atom[3];
        let chainName = atom[4];
        let residueID = atom[5];
        let xyz = atom[6];
        let b_factor = atom[7];
        let coe = atom[8];
        let atomType = atom[9];
        let radius = w3m.geometry["radius"][atomType];
        let pos = new THREE.Vector3(xyz[0], xyz[1], xyz[2]);
        // Center of the geometry
        let pos_centered = new THREE.Vector3(
            xyz[0],
            xyz[1],
            xyz[2]);
        let color = danFeng.getColorByIndex(pdbId, atomID, structure);
        // let color = new THREE.Color(0x8787a5);

        return {
            id: atomID,
            name: atomName,
            resName: residueName,
            chainName: chainName,
            resId: residueID,
            pos: pos,
            posCentered: pos_centered,
            bFactor: b_factor,
            coe: coe,
            type: atomType,
            radius: radius,
            color: color,
            pdbId: pdbId,
            typeName: structure,
        };
    },
    isDictEmpty: function (dict) {
        return Object.keys(dict).length === 0;
    },
    getFirstAtomIdByChain: function (pdbId, chainName) {
        let first_resid = Object.keys(w3m.mol[pdbId].rep[chainName])[0];
        return this.getFirstAtomByResidueId(pdbId, first_resid, chainName)[0];
    },
    getFirstAtomByResidueId: function (pdbId, residueId, chainName) {
        let atoms = w3m.mol[pdbId].atom.main;
        let atom = [];
        for (let atomId in atoms) {
            if (atoms[atomId][4] === chainName) {
                let p_residueId = atoms[atomId][5];
                if (residueId === p_residueId) {
                    atom = atoms[atomId];
                    break;
                }
            }
        }
        return atom;
    },
    getColorByIndex: function (pdbId, id, structure) {
        let rId = w3m.mol[pdbId].color[structure][id];
        if (rId) {
            let C_color = w3m.rgb[rId][0];
            let N_color = w3m.rgb[rId][1];
            let O_color = w3m.rgb[rId][2];
            return new THREE.Color(C_color, N_color, O_color);

        } else {
            return new THREE.Color("#ccc");
        }
    },
    savePDB: function (text, filename) {
        let blob = new Blob([text], {
            type: 'text/plain;charset=UTF-8'
        });
        let link = document.createElement('');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.href = URL.createObjectURL(blob);
        link.download = filename || 'ydf.pdb'
        link.click();
    },
    getHetAtom: function (molId, id) {
        let atom = w3m.mol[molId].atom.het[id];
        if (atom !== undefined) {
            return this.getAtomById(molId, atom, 'het');
        } else {
            return this.getMainAtom(molId, id);
        }
    },
    getHetAtomOnly: function (molId, id) {
        let atom = w3m.mol[molId].atom.het[id];
        if (atom !== undefined) {
            return this.getAtomById(molId, atom, 'het');
        }
    },

    // clear tools
    clearMesh: function (mesh) {
        if (mesh.geometry) {
            mesh.geometry.dispose();
        }
        if (mesh.material && mesh.material.dispose) {
            mesh.material.dispose();
        }
        mesh = null;
        return undefined;
    },
    clearChainIndex: function (group) {
        if (group.children !== undefined && group.children.length > 0) {
            let child = group.children;
            for (let i = 0; i < child.length; i++) {
                if (child[i] instanceof THREE.Mesh) {
                    this.clearMesh(child[i]);
                }
            }
            group.children = [];
        }
    },
    clearGroupIndex: function (group) {
        if (group !== undefined) {
            for (let chainId in group) {
                let chain = group[chainId];
                this.clearChainIndex(chain);
            }
        }
    },
    midPoint: function (point1, point2) {
        return new THREE.Vector3((point1.x + point2.x) / 2, (point1.y + point2.y) / 2, (point1.z + point2.z) / 2);
    },
    showSegmentHolder: function (show, callback) {
        let segmentHolder = document.getElementById("segmentHolder");
        if (show) {
            segmentHolder.style.display = "table";
            segmentHolder.innerHTML = "<div class=\"holderClass\"> Just a moment, please. </div>";
        } else {
            segmentHolder.style.display = "none";
        }
        if (typeof callback === 'function') {
            callback();
        }
    },
    atomCaId: function (atom) {
        if (atom.caid) {
            return atom.caid;
        } else {
            return atom.id;
        }
    },
    vrCameraCenter: function (canon, object, isBox = false) {
        let box;
        if (!isBox) {
            box = new THREE.Box3().setFromObject(object);
        } else {
            box = object;
        }
        let center = box.getCenter(new THREE.Vector3());
        // distance
        let distance = 0.5;
        // let cameraPosition = new THREE.Vector3(center.x - camera.position.x, center.y - camera.position.y, center.z - distance - camera.position.z);
        let cameraPosition = new THREE.Vector3(center.x - camera.position.x, center.y - camera.position.y, center.z + distance  - camera.position.z);
        // df.tool.smoothMoveObject(camera.position, cameraPosition, camera);
        console.log(camera.position);
        canon.position.copy(cameraPosition);
        // canon.lookAt(center);
        camera.lookAt(center);

    },
    smoothMoveObject: function (stPos, edPos, object) {
        let duration = 1000;
        let startTime = performance.now();

        function animate(time) {
            const elapsedTime = time - startTime;
            const fraction = elapsedTime / (duration * 2);
            // 计算新位置
            object.position.lerpVectors(stPos, edPos, fraction);
            if (fraction < 1) {
                renderer.xr.getSession().requestAnimationFrame(animate);
            }
        }

        // 启动动画循环
        renderer.xr.getSession().requestAnimationFrame(animate);
    },
    combineMeshCenterBox: function (dict) {
        let combineBox = new THREE.Box3();
        for (let box of dict) {
            let mesh = dict[box];
            combineBox.expandByObject(mesh);
        }
        return combineBox;
    },
    nearToMesh: function (mesh1, mesh2, distance) {
        // const distanceInFrontOfCamera = 0.5;
        const direction = new THREE.Vector3();
        mesh1.getWorldDirection(direction);
        direction.normalize();
        direction.multiplyScalar(distance);
        mesh2.position.copy(mesh1.position).add(direction);
    },
    similarScore: function (pdbId) {
        let score_compare = [
            16.293839910905366,
            15.180229290437994,
            13.389622324243334,
            9.194340543904312,
            8.715518545599428,
            11.516203968813885,
            12.758191878279273,
            12.36486776209635,
            14.264266018442765,
            16.016765091063863
        ];

        function extractList(mesh, num0, num1, list) {
            let resId = parseInt(mesh.userData.presentAtom.resId);
            if (resId > num0 && resId < num1) {
                // 抽取矩阵
                let boundingBox = new THREE.Box3().setFromObject(mesh);
                let center = new THREE.Vector3();
                boundingBox.getCenter(center);
                list.push([center.x, center.y, center.z]);
            }
        }

        let hChainList = []
        for (let num in df.GROUP[pdbId]['main']['h'].children) {
            let mesh = df.GROUP[pdbId]['main']['h'].children[num];
            if (mesh.userData) {
                extractList(mesh, 99, 110, hChainList);
            }
        }
        let eChainList = []
        for (let num in df.GROUP[pdbId]['main']['e'].children) {
            let mesh = df.GROUP[pdbId]['main']['e'].children[num];
            if (mesh.userData) {
                extractList(mesh, 344, 350, eChainList);
                extractList(mesh, 444, 451, eChainList);
            }
        }
        let sum = [];
        for (let i = 0; i < hChainList.length; i++) {
            let x = Math.pow(hChainList[i][0] - eChainList[i][0], 2);
            let y = Math.pow(hChainList[i][1] - eChainList[i][1], 2);
            let z = Math.pow(hChainList[i][2] - eChainList[i][2], 2);
            let score = Math.sqrt(x + y + z) / df.GROUP['7fjc']['main']['h'].scale.x;
            sum.push(score);
        }
        let all_score = 0
        for (let i = 0; i < sum.length; i++) {
            let x1 = Math.pow(sum[i] - score_compare[i], 2);
            let score1 = Math.sqrt(x1);
            all_score = all_score + score1;
        }
        all_score = 100 - (all_score / sum.length) * 2;
        all_score = Math.round(all_score);
        return all_score;
    },
    initPDBView: function (pdbId) {
        let combineBox = new THREE.Box3();
        let combineList = [];
        let scaleAmount = 0.01; // 缩小的倍数
        for (let key in df.GROUP[pdbId]['main']) {
            let group = df.GROUP[pdbId]['main'][key];
            group.scale.set(scaleAmount, scaleAmount, scaleAmount);
            combineBox.expandByObject(group);

            // df.tool.nearToMesh(canon, group, key);
        }

        df.tool.vrCameraCenter(canon, combineBox, true);
        // df.tool.vrCameraCenter(canon, combineList, true);
    }

}

