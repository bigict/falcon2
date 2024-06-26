import * as THREE from '../js/three.module.js';
import {df} from './core.js';
import {w3m} from "./web3D/w3m.js";
import {camera, canon, scene} from "./render.js";

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

// 初始化menu菜单
let menuOpen = false;
// df.drawer.createMenu();
df.drawer.createMenuButton();
df.painter.constructMenu();

// for (let i in df.menuList) {
//     let pos = new THREE.Vector3(0, -1, -4);
//     let height = -i * (df.textMenuHeight + 0.05);
//     pos.y = -1 + height;
//     let label = df.MAIN_MENU;
//     let mesh = df.drawer.createTextButton(df.menuList[i], pos, label);
// }
df.GROUP['menu'].visible = df.showMenu;

df.loader.load('1cbs', 'name', function () {
    df.controller.drawGeometry(df.config.mainMode, '1cbs');
    // for (let i in df.GROUP['7fjc']['main']) {
    //     let aaa = df.GROUP['7fjc']['main'][i];
    //     aaa.scale.set(0.01, 0.01, 0.01);
    // }
});
df.SelectedPDBId = '7fjc';




