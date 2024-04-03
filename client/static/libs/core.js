/**
 * init pdb
 */

var df;
df = {
    remoteUrl: ['https://www.rcsb.org/pdb/files/', 'data/'],
    isShowWater: false,

    // SURFACE
    SURFACE: 14,
    SURFACE_TYPE: 1,
    CURRENT_SURFACE_TYPE: 1,
    SURFACE_OPACITY: 1.0,
    SURFACE_WIREFRAME: false,

    // 重新加载时需要初始化的参数
    pdbId: [],
    SelectedPDBId: '',
    pdbInfoList: ['main', 'het', 'water', 'surface'],
    pdbContent: {},

    // gamepad
    selection: 0,
    select_all: 100,
    select_main: 101,
    select_chain: 102,


    // menu
    showMenu: false,


    // all pdb info group, 这里包含 pdb 用于展示的全部属性
    GROUP: {},
    GROUP_HET_INDEX: {},
    GROUP_MAIN_INDEX: {},
    GROUP_STRUCTURE_INDEX: {},

    // GROUP-MAIN
    GROUP_COUNT: 46,
    GROUP_MAIN: 0,
    GROUP_HET: 1,
    GROUP_WATER: 2,
    GROUP_SURFACE: 3,

    pptShow: false,
    GeoCenterOffset: "",

    // residue
    residue: '',

    exportPDB: false,
    // 0: 3D mode, 1: vr mode,
    mode: 1,
    //Mode
    MODE_THREE: 0,
    MODE_VR: 1,

    // representation Mode
    HIDE: 0,
    LINE: 1,
    DOT: 2,
    BACKBONE: 3,
    SPHERE: 4,
    STICK: 5,
    BALL_AND_ROD: 6,
    TUBE: 7,
    RIBBON_FLAT: 8,
    RIBBON_ELLIPSE: 9,
    RIBBON_RECTANGLE: 10,
    RIBBON_STRIP: 11,
    RIBBON_RAILWAY: 12,
    CARTOON_SSE: 13,

    HET: 50,
    HET_LINE: 51,
    HET_SPHERE: 52,
    HET_STICK: 53,
    HET_BALL_ROD: 54,
    HET_WATER: 55,
    HET_IRON: 56,

    // docking
    dockingDict: {'HDock': window.location.href+'hdock'},
}

// config
df.config = {
    mainMode: df.CARTOON_SSE,
    hetMode: df.HET_BALL_ROD,
    water_sphere_w: 8,
    surface: df.SURFACE,
    stick_sphere_w: 12,
    stick_radius: 3,
    ball_rod_radius: 0.12,
    tube_radius: 0.2,
    tubesegment: 5,
    ellipse_radius: 0.21,
    ellipse_radius_multiple: 5,
}

export {df};