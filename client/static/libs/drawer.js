import * as THREE from '../js/three.module.js';
import {w3m} from "./web3D/w3m.js";
import {df} from './core.js';
import {CubicBezierCurve3, QuadraticBezierCurve3} from "../js/three.module.js";

df.drawer = {
    drawSphere: function (pdbId, type, chain, point, color, radius, atom, w) {
        let alpha = 0.5;
        // 物体表面的反射率，控制镜面反射的强度，值范围一般在0到1之间
        let beta = 0.5;
        // 凹凸贴图的缩放因子，控制凹凸的强度
        let bumpScale = 1;
        // 镜面高光的强度，值越高，高光范围越小，看起来越集中
        let specularShininess = Math.pow(2, alpha * 10);
        // 镜面高光颜色，即光照射到物体表面产生的高光部分的颜色
        let specularColor = new THREE.Color(beta * 0.2, beta * 0.2, beta * 0.2);
        let geometry = new THREE.SphereGeometry(radius, w, w);
        let material = new THREE.MeshPhongMaterial({
            bumpScale: bumpScale,
            color: color,
            specular: specularColor,
            reflectivity: beta,
            shininess: specularShininess
        });

        let mesh = new THREE.Mesh(geometry, material);
        mesh.name = df.tool.atomCaId(atom);
        mesh.position.copy(point);
        mesh.userData = {
            presentAtom: atom
        };
        // het
        df.GROUP[pdbId][type][chain].add(mesh);
    },
    drawStick: function (pdbId, type, chain, start, end, radius, color, atom) {
        let distance = start.distanceTo(end);
        let geometry = new THREE.CylinderGeometry(
            radius,
            radius,
            distance,
            df.config.stick_radius,
            1,
            false);
        let material = new THREE.MeshPhongMaterial({
            color: color,
            // wireframe: false
        });
        geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, distance / 2, 0));
        geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(90)));
        let mesh = new THREE.Mesh(geometry, material);
        mesh.name = df.tool.atomCaId(atom);
        mesh.position.copy(start);
        mesh.lookAt(end);
        mesh.userData = {
            presentAtom: atom
        };
        df.GROUP[pdbId][type][chain].add(mesh);
    },
    drawTube: function (path, radius, color, atom, pdbId, type, chain) {
        let Catmull = new THREE.CatmullRomCurve3(path);
        let step = path.length - 1;
        let geometry = new THREE.TubeGeometry(Catmull, step, radius, df.config.tubesegment, false);
        let materials = new THREE.MeshPhongMaterial({
            color: color,
            // transparent: true, opacity: 0.8
        });
        materials.side = THREE.FrontSide;
        let mesh = new THREE.Mesh(geometry, materials);
        mesh.name = atom.id;
        mesh.userData = {
            presentAtom: atom,
            repType: "tube"
        };
        df.GROUP[pdbId][type][chain].add(mesh);
    },
    drawEllipse: function (path, radius, color, object, pdbId, type, chain, resId, step) {
        let Catmull = new THREE.CatmullRomCurve3(path);
        let extrudeSettings = {
            steps: step,
            bevelEnabled: true,
            extrudePath: Catmull,
            // frames: object
        };
        const shape = new THREE.Shape();
        const width = 0.5, height = 2.5;
        shape.moveTo(-width / 2, -height / 2);
        shape.lineTo(-width / 2, height / 2);
        shape.lineTo(width / 2, height / 2);
        shape.lineTo(width / 2, -height / 2);
        shape.lineTo(-width / 2, -height / 2);

        // shape.curves.push(curve);
        let geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        let material = new THREE.MeshPhongMaterial({
            color: color,
            wireframe: false
        });
        geometry.computeBoundingSphere();
        geometry.computeVertexNormals();
        material.side = THREE.FrontSide;
        let mesh = new THREE.Mesh(geometry, material);
        let atom = df.tool.getMainAtom(pdbId, resId);
        mesh.name = atom.id;
        mesh.userData = {
            presentAtom: atom,
            repType: "tube"
        };
        df.GROUP[pdbId][type][chain].add(mesh);
    },
    drawArrowByPaths: function (pdbId, type, chain, paths, color, atomId) {

        let geometry = new THREE.BufferGeometry();
        let vertices = [];
        let indices = [];

        // 将路径点添加到顶点数组
        paths.forEach(function (path) {
            vertices.push(path.x, path.y, path.z);
        });
        for (let i = 0; i < paths.length; i = i + 4) {
            if (paths[i + 7] !== undefined) {
                let facesIndices = [
                    // 箭头A面
                    [i, i + 4, i + 5],
                    [i + 5, i + 1, i],
                    // 箭头B面
                    [i + 3, i + 7, i + 6],
                    [i + 6, i + 2, i + 3],
                    // 箭头C面
                    [i + 2, i + 6, i + 5],
                    [i + 5, i + 1, i + 2],
                    // 箭头D面
                    [i + 3, i + 7, i + 4],
                    [i + 4, i, i + 3],

                ]
                facesIndices.forEach(function (face) {
                    indices.push(...face);
                });
            }
        }
        // 添加前后面的索引
        indices.push(
            0, 3, 2,
            2, 1, 0,
        );
        // 将顶点和索引添加到geometry
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);

        // 计算几何体的边界和法线
        geometry.computeBoundingSphere();
        geometry.computeVertexNormals();

        // 创建材料
        let materials = new THREE.MeshPhongMaterial({
            color: color,
            side: THREE.DoubleSide
        });


        let mesh = new THREE.Mesh(geometry, materials);
        mesh.name = atomId;
        let atom = df.tool.getMainAtom(pdbId, atomId);
        mesh.userData = {
            presentAtom: atom,
            repType: "tube",
            realType: "arrow"
        };
        df.GROUP[pdbId][type][chain].add(mesh);


    }
}

