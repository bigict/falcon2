import * as THREE from '../js/three.module.js';
import {df} from './core.js';
import {w3m} from "./web3D/w3m.js";
import {scene} from "./render.js";

df.loader = {
    load: function (file, type, callback) {
        let pdbId;
        switch (type) {
            case 'file':
                pdbId = file.name.split(".")[0].trim();
                pdbId = pdbId.toLowerCase();
                if (!pdbId) {
                    pdbId = 'yang'
                }
                this.loadTextFromPDB(pdbId, file, this.callBackLoading, callback);
                break;
            case 'name':
                pdbId = file.split(".")[0].trim();
                pdbId = pdbId.toLowerCase();
                if (!pdbId) {
                    pdbId = 'yang'
                }
                this.loadTextFromRequest(pdbId, file, this.callBackLoading, callback);
                break;
        }
    },
    // todo 需要想一想 如何限制空间
    getCenterOffset: function () {
        let limit = w3m.global.limit;
        let x = -(limit.x[0] + limit.x[1]) / 2;
        let y = -(limit.y[0] + limit.y[1]) / 2;
        let z = -(limit.z[0] + limit.z[1]) / 2;
        df.GeoCenterOffset = new THREE.Vector3(x, y, z);
    },
    callBackLoading: function (pdbId, error, content, callback) {
        if (error) {
            console.log(error);
        }
        // 处理 pdb
        df.pdbContent[pdbId] = content;
        df.pdbText[pdbId] = content;
        df.loader.loadSaveCoord(pdbId, content);
        w3m.pdb(content, pdbId);
        console.log(2)
        w3m.api.switchRepModeMain(w3m.LINE);
        w3m.api.switchRepModeMain(w3m.BACKBONE);
        w3m.api.switchRepModeMain(w3m.CUBE);
        w3m.api.switchRepModeMain(w3m.CARTOON);

        df.GROUP[pdbId] = {};
        // init dict
        df.pdbInfoList.forEach(function (name) {
            df.GROUP[pdbId][name] = {}
        });
        // df.GROUP_MAIN_INDEX[pdbId] = [];
        // df.GROUP_HET_INDEX[pdbId] = [];
        // df.GROUP_STRUCTURE_INDEX[pdbId] = [];

        for (let chain in w3m.mol[pdbId].chain) {
            let firstAtomId = df.tool.getFirstAtomIdByChain(pdbId, chain);
            df.pdbInfoList.forEach(function (name) {
                df.GROUP[pdbId][name][chain] = new THREE.Group();
                df.GROUP[pdbId][name][chain].surface = new THREE.Group();
                scene.add(df.GROUP[pdbId][name][chain].surface);
                df.GROUP[pdbId][name][chain].name = pdbId + '_' + name + '_' + chain;
            });
            df.GROUP[pdbId]['main'][chain].userData["presentAtom"] = df.tool.getMainAtom(pdbId, firstAtomId);
            if (!df.pptShow) {
                df.pdbInfoList.forEach(function (name) {
                    scene.add(df.GROUP[pdbId][name][chain]);
                });
            }
            // df.GROUP_MAIN_INDEX[pdbId].push(chain);
            // df.GROUP_STRUCTURE_INDEX[pdbId].push(chain);
        }
        // Main Het
        // df.GROUP_MAIN_INDEX[pdbId].push(df.GROUP_MAIN);
        // df.GROUP_HET_INDEX[pdbId].push(df.GROUP_HET);
        // df.GROUP_HET_INDEX[pdbId].push(df.GROUP_WATER);
        // structure
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_MAIN);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_WATER);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_HET);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_SURFACE);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_AXIS);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_INFO);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_MUTATION);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_DRUG);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_SLICE);
        // df.GROUP_STRUCTURE_INDEX[pdbId].push(df.GROUP_BOND);
        callback();
    },
    loadTextFromPDB: function (pdbId, file, callback, loadBack) {
        let io = new FileReader();
        io.onload = function (event) {
            let e = event || window.event;
            let textContent = e.target.result;
            callback(pdbId, null, textContent, loadBack);
        };
        io.onerror = function (event) {
            callback(pdbId, 'File Error: ' + event.target.error, null, loadBack);
        };
        io.readAsText(file);
    },
    loadTextFromRequest: function (pdbId, file, callback, loadBack) {
        let url_index = 0;
        let io = new XMLHttpRequest();
        io.onload = function () {
            if (io.status === 200) {
                let responseText = io.responseText;
                callback(pdbId, null, responseText, loadBack);
            }
        }
        io.onerror = function (event) {
            if (url_index <= df.remoteUrl.length) {
                url_index++;
                this.loadTextFromRequest(pdbId, file, callback, loadBack);
            } else {
                callback(pdbId, 'File Error: ' + event.target.error, null, loadBack);
            }
        }
        let url = df.remoteUrl[url_index] + file + ".pdb";
        io.open('GET', url, true);
        io.send();
    },
    loadSaveCoord: function (pdbId, text) {
        df.PDBPOS[pdbId] = {}
        const pdb_text = text.split('\n');
        for (let i = 0; i < pdb_text.length; i++) {
            let line = pdb_text[i];
            let a = w3m_sub(line, 0, 6).toLowerCase()
            switch (a) {
                case 'atom':
                    const residue_id = w3m_sub(line, 23, 26) || 0;
                    const atom_name = w3m_sub(line, 13, 16).toLowerCase();
                    const atom_chain = w3m_sub(line, 22) || 'x';
                    const residueKey = atom_chain + "_" + residue_id + "_" + atom_name;
                    const pdb_x = parseFloat(w3m_sub(line, 31, 38));
                    const pdb_y = parseFloat(w3m_sub(line, 39, 46));
                    const pdb_z = parseFloat(w3m_sub(line, 47, 54));
                    df.PDBPOS[pdbId][residueKey] = [pdb_x, pdb_y, pdb_z];
            }
        }
    }
}