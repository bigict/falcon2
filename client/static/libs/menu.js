import * as THREE from '../js/three.module.js';
import {df} from "./core.js";
import {w3m} from "./web3D/w3m.js";


class ButtonFactory {
    createButton(type, options) {
        let button;
        switch (type) {
            case df.DEFBUTTON:
                button = new DefaultButton(options);
                df.DFBUTTONS.push(button);
                break;
        }
        return button;
    }
}


class Button {
    constructor(options) {
        this.text = options.text;
        this.position = options.position;
        this.action = options.action || null;
        this.label = options.label;
        this.length = options.length;
        this.position.x = (this.length - 1) * df.lineSpacing + options.position.x;
        this.params = options.params || null;
        this.subMenu = options.subMenu || null;
        this.lastButton = options.lastButton || null;
        this.parentButton = options.parentButton || null;
        this.updateSubMenu = options.updateSubMenu || null;
        this.mesh = df.drawer.createTextButton(
            this.text, this.position, this.label
        );
    }

    hideAllSubButtons() {
        if (this.subMenu) {
            this.subMenu.buttons.forEach(button => {
                button.mesh.visible = false;
                button.hideAllSubButtons(); // 递归隐藏所有子按钮
            });
        }
    }

    onSelect() {
        df.tool.handleButtonSelection(this, df.LASTSELECTEDBUTTON);
        if (this.updateSubMenu) {
            this.updateSubMenu();
        }
        if (this.subMenu) {
            this.subMenu.toggleVisibility();
        } else if (typeof this.action === 'function') {
            if (this.params) {
                this.action(this.params);
            } else {
                this.action();
            }
        }
        if (this.lastButton) {
            this.parentButton.hideAllSubButtons();
        }
        df.LASTSELECTEDBUTTON = this;
    }
}

class DefaultButton extends Button {
    constructor(options) {
        super(options);
    }
}

class SubMenu {
    constructor(options) {
        this.buttons = options.buttons || [];
        this.visible = false;
        this.parent = options.parent || null;
        this.createSubMenu();
    }

    createSubMenu() {
        this.buttons.forEach((button, index) => {
            button.mesh.position.set(button.mesh.position.x, button.mesh.position.y + (-index * (df.textMenuHeight + df.letterSpacing)), button.mesh.position.z);
            button.mesh.visible = this.visible;
            button.parentButton = this.parent;
        });
    }

    toggleVisibility() {
        this.visible = !this.visible;
        this.buttons.forEach(button => {
            button.mesh.visible = this.visible;
        });
    }

    addButton(button) {
        this.buttons.push(button);
        button.mesh.visible = this.visible;
    }
}

let buttonFactory = new ButtonFactory();

function submitAPI(data, url) {
    data = JSON.stringify(data);
    df.api.apiRequest(url, data, (response) => {
        let pdbId = response['pdbId'];
        df.loader.load(pdbId, 'name', function () {
            df.controller.drawGeometry(df.config.mainMode, pdbId);
        });
    });
}

df.actionManager = {
    closeMenu: function () {
        df.showMenu = false;
        df.GROUP['menu'].visible = df.showMenu;
    },
    hide: function (group) {
        group.visible = false;
        df.actionManager.closeMenu();
    },
    // drag Action
    dragAction: function (select_type) {
        // 切换为 drag mode
        df.selection = select_type;
        df.actionManager.closeMenu();
    },
    // docking action
    dockingSubmitAction: function () {
        // 提交到 docking api
        df.actionManager.closeMenu();
        let url = df.dockingDict[df.SELECTED_DOCKING];
        let data = {
            'receptor': df.DOCKING_RECEPTOR,
            'ligand': df.DOCKING_LIGAND
        };
        submitAPI(data, url);
    },
    dockingToolsAction: function (param) {
        df.SELECTED_DOCKING = param;
    },
    dockingReceptorAction: function (param) {
        df.DOCKING_RECEPTOR = param;
    },
    dockingLigandAction: function (param) {
        df.DOCKING_LIGAND = param;
    },
    // align
    alignSubmitAction: function () {
        // 提交到 docking api
        df.actionManager.closeMenu();
        let url = df.ALIGN_TOOLS[df.SELECTED_ALIGN];
        let data = {
            'receptor': df.ALIGN_RECEPTOR,
            'ligand': df.ALIGN_LIGAND
        };
        data = JSON.stringify(data);
        submitAPI(data, url);
    },
    alignToolsAction: function (param) {
        df.SELECTED_ALIGN = param;
    },
    alignReceptorAction: function (param) {
        df.ALIGN_RECEPTOR = param;
    },
    alignLigandAction: function (param) {
        df.ALIGN_LIGAND = param;
    },
    energyAction: function (param) {
        df.SELECTED_ENERGY = param;
    },
    // structure
    structureAction: function (type) {
        if (type !== df.HIDE) {
            df.config.mainMode = type;
            df.painter.refreshGeometryByMode(type);
        } else {
            for (let child in df.GROUP[df.SelectedPDBId].children) {
                let group = df.GROUP[df.SelectedPDBId].children[child]
                group.visible = false;
            }
        }
        df.actionManager.closeMenu();
    },
    // ligand
    ligandAction: function (type) {
        if (type !== df.HIDE) {
            df.config.hetMode = type;
            df.painter.refreshGeometryByMode(type);
        } else {
            for (let child in df.GROUP[df.SelectedPDBId]) {
                let group = df.GROUP[df.SelectedPDBId][child]
                if (child !== 'main') {
                    group.visible = false;
                }
            }
        }
        df.actionManager.closeMenu();
    },
    // surface
    surfaceHideAction: function () {
    },
    surfaceAction: function (type) {
        df.painter.refreshSurface(type);
        df.actionManager.closeMenu();
    },
    designSelectAction: function () {
        df.actionManager.closeMenu();
        df.selection = df.select_region;

        // df.actionManager.closeMenu();
    },
    designToolAction: function (param) {
        df.SELECTED_DESIGN = param;
    },
    designSubmitAction: function () {
        df.actionManager.closeMenu();
        // 请求design接口
        let url = df.DESIGN_TOOLS[df.SELECTED_DESIGN];
        let data = df.pdbText[df.SelectedPDBId];
        df.api.apiRequest(url, data, df.loader.load('pred', 'name', function () {
            df.controller.drawGeometry(df.config.mainMode, 'pred');
        }));

        df.SelectedPDBId = "pred";
    },
    // color action
    colorAction: function (param) {
        w3m.config.color_mode_main = Number(param);
        w3m.tool.updateMolColorMap(df.SelectedPDBId);
        df.dfRender.clear(0);
        df.controller.drawGeometry(df.config.mainMode, df.SelectedPDBId);
        df.actionManager.closeMenu();
    },
    // Export pdb
    exportPDBAction: function (param) {
        let text = df.pdbText[param]
        df.tool.savePDB(text, df.SelectedPDBId + '.pdb');
    },
}

function createThirdButton(dicts, position, action, parentButton, length) {
    if (parentButton.subMenu) {
        parentButton.subMenu.buttons.forEach(button => {
            if (button && button.mesh) {
                df.GROUP['menu'].remove(button.mesh);
                button.mesh.geometry.dispose();
                button.mesh.material.dispose();
                // 清除引用
                button.mesh = null;
            }
        });
        parentButton.subMenu.buttons = [];
    } else {
        parentButton.subMenu = new SubMenu({buttons: [], parent: parentButton});
    }
    // position.x = position.x + (length - 2) * df.lineSpacing;
    for (let dkt in dicts) {
        let button = buttonFactory.createButton(df.DEFBUTTON, {
            text: dkt,
            position: position,
            label: dkt,
            action: action,
            params: dkt,
            lastButton: true,
            length: length,
            parentButton: parentButton
        });
        parentButton.subMenu.addButton(button);
    }
    return parentButton.subMenu
}


function createMenuButton(group) {
    // 创建初始化 button
    let x = -0.5,
        y = 0.25,
        z = -1;
    let number = 0;

    // length 1
    // load button
    let loadPDB = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Load PDB",
        position: new THREE.Vector3(x, y, z),
        label: "",
        length: 1,
        action: ""
    });
    // Drag
    number += 1;
    let drag = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "drag",
        length: 1,
    });
    number += 1;
    let design = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Design",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "design",
        length: 1,
    });
    // Structure
    number += 1;
    let structure = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Structure",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "structure",
        length: 1,
    });
    // Structure
    number += 1;
    let ligand = buttonFactory.createButton(df.DEFBUTTON, {
        text: "ligand",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "ligand",
        length: 1,
    });
    // Scuba
    number += 1;
    let surface = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Surface",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "surface",
        length: 1,
    });
    number += 1;
    let color = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Color",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "color",
        length: 1,
    });
    number += 1;
    let toolkits = buttonFactory.createButton(df.DEFBUTTON, {
        text: "toolkits",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "toolkits",
        length: 1,
        action: ""
    });
    number += 1;
    let exportPDB = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Export PDB",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "export PDB",
        length: 1,
        state: 1,
        action: "",
        updateSubMenu: function () {
            createThirdButton(
                df.pdbText,
                new THREE.Vector3(x, y, z),
                df.actionManager.exportPDBAction,
                exportPDB,
                2);
        }
    });
    number += 1;
    let exit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Exit",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "exit",
        length: 1,
        action: ""
    });


    // number += 1;
    number = 0;
    // x = x + df.lineSpacing;
    let align = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Align",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "align",
        length: 2,
        action: ""
    });
    // number += 1;
    let docking = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Docking",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "docking",
        length: 2,
        action: ""
    });
    // number += 1;
    let energy = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Energy",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "energy",
        length: 2,
        action: ""
    });

    // number += 1;
    let refineStructure = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Refine Structure",
        position: new THREE.Vector3(x, y + (-number * (df.textMenuHeight + df.letterSpacing)), z),
        label: "refineStructure",
        length: 2,
    });

    toolkits.subMenu = new SubMenu({
        buttons: [
            align,
            docking,
            energy,
            refineStructure
        ],
        parent: structure
    });



    // init sub-button
    // general button
    // drag sub-button
    // x = x + df.lineSpacing;
    let dragInit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Init PDB",
        position: new THREE.Vector3(x, y, z),
        label: "init",
        action: df.actionManager.dragAction,
        params: df.select_all,
        length: 2,
    });
    let dragMultiChain = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag Multi Chain",
        position: new THREE.Vector3(x, y, z),
        label: "dragMultiChain",
        action: df.actionManager.dragAction,
        params: df.select_multi_chain,
        length: 2,
    });
    let dragMain = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag PDB",
        position: new THREE.Vector3(x, y, z),
        label: "dragPDB",
        action: df.actionManager.dragAction,
        params: df.select_main,
        length: 2,
    });
    let dragChain = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag Chain",
        position: new THREE.Vector3(x, y, z),
        label: "dragChain",
        action: df.actionManager.dragAction,
        params: df.select_chain,
        length: 2,
    });
    let dragResidue = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag Residue",
        position: new THREE.Vector3(x, y, z),
        label: "dragResidue",
        action: df.actionManager.dragAction,
        params: df.select_residue,
        length: 2,
    });
    let dragAtom = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag Atom",
        position: new THREE.Vector3(x, y, z),
        label: "dragAtom",
        action: df.actionManager.dragAction,
        params: df.select_atom,
        length: 2,
    });
    let dragLigand = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Drag Ligand",
        position: new THREE.Vector3(x, y, z),
        label: "dragLigand",
        action: df.actionManager.dragAction,
        params: df.select_ligand,
        length: 2,
    });
    drag.subMenu = new SubMenu({
        buttons: [
            dragInit,
            dragMain,
            dragChain,
            dragMultiChain,
            dragResidue,
            dragAtom,
            dragLigand
        ],
        parent: drag,
    });
    // structure
    let structureHide = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Hide",
        position: new THREE.Vector3(x, y, z),
        label: "hide",
        action: df.actionManager.structureAction,
        params: df.HIDE,
        length: 2,
    });
    // let structureLine = buttonFactory.createButton(df.DEFBUTTON, {
    //     text: "Line",
    //     position: new THREE.Vector3(x, y, z),
    //     label: "line",
    //     action: df.actionManager.structureAction,
    //     params: df.LINE,
    // length: 2,
    // });
    // let structureDot = buttonFactory.createButton(df.DEFBUTTON, {
    //     text: "Dot",
    //     position: new THREE.Vector3(x, y, z),
    //     label: "dot",
    //     action: df.actionManager.structureAction,
    //     params: df.DOT,
    // });
    // let structureBackbone = buttonFactory.createButton(df.DEFBUTTON, {
    //     text: "BackBone",
    //     position: new THREE.Vector3(x, y, z),
    //     label: "backbone",
    //     action: df.actionManager.structureAction,
    //     params: df.BACKBONE,
    // });
    // let structureSphere = buttonFactory.createButton(df.DEFBUTTON, {
    //     text: "Sphere",
    //     position: new THREE.Vector3(x, y, z),
    //     label: "sphere",
    //     action: df.actionManager.structureAction,
    //     params: df.SPHERE,
    // });
    let structureBallRod = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Ball & Rod",
        position: new THREE.Vector3(x, y, z),
        label: "ballrod",
        action: df.actionManager.structureAction,
        params: df.BALL_AND_ROD,
        length: 2,
    });
    let structureCartoon = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Cartoon",
        position: new THREE.Vector3(x, y, z),
        label: "cartoon",
        action: df.actionManager.structureAction,
        params: df.CARTOON_SSE,
        length: 2,
    });
    // let structureHBond = buttonFactory.createButton(df.DEFBUTTON, {
    //     text: "Hydrogen Bond",
    //     position: new THREE.Vector3(x, y, z),
    //     label: "hydrogenBond",
    //     action: df.actionManager.structureAction,
    //     params: df.HIDE,
    // });
    let structureExit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Exit",
        position: new THREE.Vector3(x, y, z),
        label: "subExit",
        lastButton: true,
        length: 2,
        parentButton: structure
    });
    structure.subMenu = new SubMenu({
        buttons: [
            structureHide,
            // structureLine,
            // structureDot,
            // structureBackbone,
            // structureSphere,
            structureBallRod,
            structureCartoon,
            // structureHBond,
            structureExit
        ],
        parent: structure
    });
    // ligand
    let ligandHide = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Hide",
        position: new THREE.Vector3(x, y, z),
        label: "hide",
        action: df.actionManager.ligandAction,
        params: df.HIDE,
        length: 2,
    });
    let ligandLine = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Line",
        position: new THREE.Vector3(x, y, z),
        label: "line",
        action: df.actionManager.ligandAction,
        params: df.LINE,
        length: 2,
    });
    let ligandDot = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Dot",
        position: new THREE.Vector3(x, y, z),
        label: "dot",
        action: df.actionManager.ligandAction,
        params: df.DOT,
        length: 2,
    });
    let ligandBackbone = buttonFactory.createButton(df.DEFBUTTON, {
        text: "BackBone",
        position: new THREE.Vector3(x, y, z),
        label: "backbone",
        action: df.actionManager.ligandAction,
        params: df.BACKBONE,
        length: 2,
    });
    let ligandSphere = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Sphere",
        position: new THREE.Vector3(x, y, z),
        label: "sphere",
        action: df.actionManager.ligandAction,
        params: df.SPHERE,
        length: 2,
    });
    let ligandBallRod = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Ball & Rod",
        position: new THREE.Vector3(x, y, z),
        label: "ballrod",
        action: df.actionManager.ligandAction,
        params: df.BALL_AND_ROD,
        length: 2,
    });
    let ligandExit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Exit",
        position: new THREE.Vector3(x, y, z),
        label: "subExit",
        lastButton: true,
        length: 2,
        parentButton: structure
    });
    ligand.subMenu = new SubMenu({
        buttons: [
            ligandHide,
            ligandLine,
            ligandDot,
            ligandBackbone,
            ligandSphere,
            ligandBallRod,
            ligandExit
        ],
        parent: ligand,
    });
    // surface
    let surfaceHide = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Hide",
        position: new THREE.Vector3(x, y, z),
        label: "hide",
        action: df.actionManager.surfaceHideAction,
        params: df.HIDE,
        length: 2,
    });
    let surface10 = buttonFactory.createButton(df.DEFBUTTON, {
        text: "1.0",
        position: new THREE.Vector3(x, y, z),
        label: "1.0",
        action: df.actionManager.surfaceAction,
        params: 1.0,
        length: 2,
    });
    let surface08 = buttonFactory.createButton(df.DEFBUTTON, {
        text: "0.8",
        position: new THREE.Vector3(x, y, z),
        label: "0.8",
        action: df.actionManager.surfaceAction,
        params: 0.8,
        length: 2,
    });
    let surface06 = buttonFactory.createButton(df.DEFBUTTON, {
        text: "0.6",
        position: new THREE.Vector3(x, y, z),
        label: "0.6",
        action: df.actionManager.surfaceAction,
        params: 0.6,
        length: 2,
    });
    let surface04 = buttonFactory.createButton(df.DEFBUTTON, {
        text: "0.4",
        position: new THREE.Vector3(x, y, z),
        label: "0.4",
        action: df.actionManager.surfaceAction,
        params: 0.4,
        length: 2,
    });
    let surface02 = buttonFactory.createButton(df.DEFBUTTON, {
        text: "0.2",
        position: new THREE.Vector3(x, y, z),
        label: "0.2",
        action: df.actionManager.surfaceAction,
        params: 0.2,
        length: 2,
    });
    surface.subMenu = new SubMenu({
        buttons: [
            surfaceHide,
            surface10,
            surface08,
            surface06,
            surface04,
            surface02,
        ],
        parent: surface,
    });
    // color
    let colorByElement = buttonFactory.createButton(df.DEFBUTTON, {
        text: "By Element",
        position: new THREE.Vector3(x, y, z),
        label: "byElement",
        action: df.actionManager.colorAction,
        params: 601,
        length: 2,
    });
    let colorByResidue = buttonFactory.createButton(df.DEFBUTTON, {
        text: "By Residue",
        position: new THREE.Vector3(x, y, z),
        label: "byResidue",
        action: df.actionManager.colorAction,
        params: 602,
        length: 2,
    });
    let colorBySecStructure = buttonFactory.createButton(df.DEFBUTTON, {
        text: "By Sec Structure",
        position: new THREE.Vector3(x, y, z),
        label: "bySecStructure",
        action: df.actionManager.colorAction,
        params: 603,
        length: 2,
    });
    let colorByChain = buttonFactory.createButton(df.DEFBUTTON, {
        text: "By Chain",
        position: new THREE.Vector3(x, y, z),
        label: "byChain",
        action: df.actionManager.colorAction,
        params: 604,
        length: 2,
    });
    let colorByPDB = buttonFactory.createButton(df.DEFBUTTON, {
        text: "By PDB",
        position: new THREE.Vector3(x, y, z),
        label: "byPDB",
        action: df.actionManager.colorAction,
        params: 607,
        length: 2,

    });
    let colorByHYDROPHOBICITY = buttonFactory.createButton(df.DEFBUTTON, {
        text: "By Hydrophobicity",
        position: new THREE.Vector3(x, y, z),
        label: "byHydrophobicity",
        action: df.actionManager.colorAction,
        params: 609,
        length: 2,
    });
    color.subMenu = new SubMenu({
        buttons: [
            colorByElement,
            colorByResidue,
            colorBySecStructure,
            colorByChain,
            colorByPDB,
            colorByHYDROPHOBICITY,
        ]
    });
    // docking
    let dockingTools = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Tools",
        position: new THREE.Vector3(x, y, z),
        label: "tools",
        length: 3,
    });
    let dockingReceptor = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Receptor",
        position: new THREE.Vector3(x, y, z),
        label: "receptor",
        length: 3,
        updateSubMenu: function () {
            // docking Receptor
            createThirdButton(
                df.pdbText,
                new THREE.Vector3(x, y, z),
                df.actionManager.dockingReceptorAction,
                dockingReceptor,
                4);
        }
    });
    let dockingLigand = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Ligand",
        position: new THREE.Vector3(x, y, z),
        label: "ligand",
        length: 3,
        updateSubMenu: function () {
            // docking Ligand
            createThirdButton(
                df.pdbText,
                new THREE.Vector3(x, y, z),
                df.actionManager.dockingLigandAction,
                dockingLigand,
                4);
        }
    });
    let dockingSubmit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Submit",
        position: new THREE.Vector3(x, y, z),
        label: "submit",
        length: 3,
        action: df.actionManager.dockingSubmitAction
    });
    let dockingExit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Exit",
        position: new THREE.Vector3(x, y, z),
        label: "exit",
        lastButton: true,
        length: 3,
        parentButton: docking
    });
    // docking tool sub
    createThirdButton(
        df.dockingDict,
        new THREE.Vector3(x, y, z),
        df.actionManager.dockingToolsAction,
        dockingTools,
        4);


    docking.subMenu = new SubMenu({
        buttons: [
            dockingTools,
            dockingReceptor,
            dockingLigand,
            dockingSubmit,
            dockingExit
        ],
        parent: docking,
    });
    // design sub-button
    let designTools = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Tools",
        position: new THREE.Vector3(x, y, z),
        label: "tools",
        length: 3,
    })
    let designSelect = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Select Range",
        position: new THREE.Vector3(x, y, z),
        label: "select",
        length: 3,
        action: df.actionManager.designSelectAction
    });
    let designSubmit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Submit",
        position: new THREE.Vector3(x, y, z),
        label: "submit",
        length: 3,
        action: df.actionManager.designSubmitAction
    });
    // docking tool sub
    createThirdButton(
        df.DESIGN_TOOLS,
        new THREE.Vector3(x, y, z),
        df.actionManager.designToolAction,
        designTools,
        4);
    design.subMenu = new SubMenu({
        buttons: [
            designTools,
            designSelect,
            designSubmit,
            dockingExit
        ],
        parent: design,
    });

    // align
    let alignTools = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Tools",
        position: new THREE.Vector3(x, y, z),
        label: "tools",
        length: 3,
    });
    let alignReceptor = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Receptor",
        position: new THREE.Vector3(x, y, z),
        label: "receptor",
        length: 3,
        updateSubMenu: function () {
            createThirdButton(
                df.pdbText,
                new THREE.Vector3(x, y, z),
                df.actionManager.alignReceptorAction,
                alignReceptor,
                4);
        }
    });
    let alignLigand = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Ligand",
        position: new THREE.Vector3(x, y, z),
        label: "ligand",
        length: 3,
        updateSubMenu: function () {
            createThirdButton(
                df.pdbText,
                new THREE.Vector3(x, y, z),
                df.actionManager.alignLigandAction,
                alignLigand,
                4);
        }
    });
    let alignSubmit = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Submit",
        position: new THREE.Vector3(x, y, z),
        label: "submit",
        length: 3,
        action: df.actionManager.alignSubmitAction
    });
    // docking tool sub
    createThirdButton(
        df.dockingDict,
        new THREE.Vector3(x, y, z),
        df.actionManager.alignToolsAction,
        alignTools,
        4);
    align.subMenu = new SubMenu({
        buttons: [
            alignTools,
            alignReceptor,
            alignLigand,
            alignSubmit,
        ],
        parent: align,
    });
    // Energy
    let energyTools = buttonFactory.createButton(df.DEFBUTTON, {
        text: "Tools",
        position: new THREE.Vector3(x, y, z),
        label: "tools",
        length: 3,
    });
    createThirdButton(
        df.ENERGY_TOOLS,
        new THREE.Vector3(x, y, z),
        df.actionManager.energyAction,
        energyTools,
        4);
    energy.subMenu = new SubMenu({
        buttons: [
            energyTools
        ],
        parent: energy,
    });
    // refine Structure
    // createThirdButton(
    //     df.ENERGY_TOOLS,
    //     new THREE.Vector3(x, y, z),
    //     df.actionManager.energyAction,
    //     refineStructure,
    //     2);
    // Export PDB
    createThirdButton(
        df.pdbText,
        new THREE.Vector3(x, y, z),
        df.actionManager.exportPDBAction,
        exportPDB,
        2);
}

export {createMenuButton}