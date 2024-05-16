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
// df.painter.showMenu();

df.drawer.createMenuButton();
for (let i in df.menuList) {
    let mesh = df.drawer.createTextButton(df.menuList[i]);
    let height = -i * (df.textMenuHeight + 0.05);
    mesh.position.y = -1 + height;
}
df.SCORE = df.drawer.createSprite();
df.GROUP['menu'].visible = df.showMenu;


df.loader.load('7fjc', 'name', function () {
    df.controller.drawGeometry(df.config.mainMode, '7fjc');
    // df.controller.drawGeometry(df.DOT, '7fjc');
    // df.painter.showSurface('7fjc', 300, 600, true, ['e']);
    // df.painter.showSurface('7fjc', 300, 600, true, ['h', 'l']);
});
df.SelectedPDBId = '7fjc';

