import * as THREE from '../js/three.module.js';

import {df} from './core.js';
import {camera, scene} from "./render.js";


df.drawer = {
    drawDot: function (pdbId, type, chain, point, atom) {
        // 创建点的几何体
        let geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0.0, 0.0, 0.0,  // 点的坐标
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

        // 创建点的材料
        let material = new THREE.PointsMaterial({color: 0xff0000, size: 0.01});
        // 创建点对象
        let mesh = new THREE.Points(geometry, material);
        mesh.position.copy(point);
        mesh.name = atom.name;
        mesh.userData = {
            presentAtom: atom
        };
        df.GROUP[pdbId][type][chain].add(mesh);
    },
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
        mesh.position.copy(point);
        mesh.name = df.tool.atomCaId(atom);
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
        // Catmull.closed = true
        let extrudeSettings = {
            steps: step,
            bevelEnabled: true,
            extrudePath: Catmull,
            frames: object
        };
        let t = df.config.ellipse_radius_multiple;
        let curve = new THREE.EllipseCurve(
            0, 0,            // 中心点
            5 * radius, radius, // x轴半径和y轴半径
            0, Math.PI * 2,  // 开始和结束角度
            false,            // 是否逆时针方向
            0
        );
        let shape = new THREE.Shape();
        shape.curves.push(curve);
        let geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        let material = new THREE.MeshLambertMaterial({
            color: color,
            wireframe: false
        });
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
    },
    // createMenu: function () {
    //     let geometry = new THREE.PlaneGeometry(6.4, 3.2);
    //     let material = new THREE.MeshBasicMaterial({
    //         color: 0xffffff, // 白色
    //         transparent: true, // 设置材质为半透明
    //         opacity: 0.8 // 设置透明度
    //     });
    //     let mesh = new THREE.Mesh(geometry, material);
    //     mesh.position.set(0, -1, -4);
    //     if (df.GROUP['menu'] !== undefined) {
    //         df.GROUP['menu'].add(mesh);
    //     }
    // },
    createMenuButton: function () {
        let textureLoader = new THREE.TextureLoader();
        let texture = textureLoader.load('/static/imgs/cate.png'); // 替换为你的图像文件路径

        let geometry = new THREE.CircleGeometry(0.1, 32);
        let material = new THREE.MeshBasicMaterial({
            color: 0xffffff, // 白色
            transparent: true, // 设置材质为半透明
            opacity: 0.5, // 设置透明度
            map: texture
        }); // 使用贴图
        let mesh = new THREE.Mesh(geometry, material);
        let offset = new THREE.Vector3(-0.8, 0.8, -4);
        mesh.position.copy(offset);
        mesh.name = 'menu-button';
        camera.add(mesh);
        return mesh;
    },
    createTextTexture: function (text) {
        // canvas create text
        const scale = window.devicePixelRatio;
        let canvas = document.createElement('canvas');
        canvas.width = scale * df.textContentWidth;
        canvas.height = scale * df.textContentHeight;
        let context = canvas.getContext('2d');
        // bg color
        context.fillStyle = df.textMenuBgColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
        // text
        context.font = 'Bold 100px "SAO"';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'black'; // 文本颜色
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    },
    createTextButton: function (text) {
        let geometry = new THREE.PlaneGeometry(df.textMenuWidth, df.textMenuHeight);
        let texture = df.drawer.createTextTexture(text);
        texture.minFilter = THREE.LinearFilter;
        let material = new THREE.MeshBasicMaterial({
            map: texture
        });
        let mesh = new THREE.Mesh(geometry, material);
        mesh.name = text;
        mesh.position.set(0, -1, -4);
        if (df.GROUP['menu'] !== undefined) {
            df.GROUP['menu'].add(mesh);
        }
        return mesh;
    },
    createSprite: function () {
        const spriteMaterial = new THREE.SpriteMaterial({color: 0xffffff});
        const sprite = new THREE.Sprite(spriteMaterial);
        let offset = new THREE.Vector3(0.9, 0.9, -2);
        sprite.position.copy(offset);
        sprite.visible = false;
        if (df.GROUP["score"] !== undefined) {
            df.GROUP["score"].add(sprite);
        }
        return sprite
    },
    // 更新文本内容的函数
    updateText: function (text, mesh) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = 'Bold 40px Arial';
        context.fillStyle = 'white';
        context.fillText(text, 0, 40);

        const texture = new THREE.CanvasTexture(canvas);
        mesh.material.map = texture;
        texture.needsUpdate = true;
        if (!mesh.visible) {
            mesh.visible = true;
        }
    },
}

