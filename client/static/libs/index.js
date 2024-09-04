import * as THREE from '../js/three.module.js';
import {df} from './core.js';
import {w3m} from "./web3D/w3m.js";
import {camera, canon, scene} from "./render.js";
import {createMenuButton} from "./menu.js";


// hide submenu
function switchMenu(obj) {
    if (document.getElementById) {
        let el = document.getElementById(obj);
        let ar = document.getElementById("SideToolbar").getElementsByTagName("span");
        if (el.style.display !== "block") {
            for (let i = 0; i < ar.length; i++) {
                if (ar[i].className === "subMenu")
                    ar[i].style.display = "none";
            }
            el.style.display = "block";
        } else {
            el.style.display = "none";
        }
    }
}

df.controller.init();
df.leftRing = df.drawer.Ring();
df.rightRing = df.drawer.Ring();


// 初始化menu菜单
let menuOpen = false;
df.drawer.createMenuButton();

// for (let i in df.menuList) {
//     let pos = new THREE.Vector3(0, -1, -4);
//     let height = -i * (df.textMenuHeight + df.letterSpacing);
//     pos.y = -1 + height;
//     let label = df.MAIN_MENU;
//     let mesh = df.drawer.createTextButton(df.menuList[i], pos, label);
// }
df.GROUP['menu'].visible = df.showMenu;
createMenuButton();

df.lfpt = df.drawer.createSprite()
df.drawer.updateText('1', df.lfpt)


// load config


df.loader.load('4eu2', 'name', function () {
    df.controller.drawGeometry(df.config.mainMode, '4eu2');
    // df.painter.showSurface('aaaa', 'A', 1);
    df.SelectedPDBId = '4eu2';
    for (let index in df.GROUP['4eu2']) {
        for (let i in df.GROUP['4eu2'][index]) {
            let aaa = df.GROUP['4eu2'][index][i];
            df.tool.addIndex(aaa);
        }
    }
});


df.loader.load('4eul', 'name', function () {
    df.controller.drawGeometry(df.config.mainMode, '4eul');
    df.controller.drawGeometry(df.config.hetMode, '4eul');
    df.painter.showSurface('4eul', 'A', 1);
});



