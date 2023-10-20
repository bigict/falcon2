w3m.design = function (text, drugname) {

    console.log("w3m.design");
    //console.log(text);
    var o = {
        type: 'pdb',
        id: '',
        //xukui add
        drug: false,
        //ranx add
        res: false,
        info: {},
        journal: [],
        atom: {
            main: [],
            het: []
        },
        tree: {
            main: {},
            het: {}
        },
        residue: {},
        chain: {},
        anisou: {},
        single: {},
        connect: {},
        ssbond: [],
        ss: {},
        helix: {},
        sheet: {},
        rep: {},
        rep_real: {},
        label_area: {},
        label_content: {},
        label_area_real: {},
        color: {
            main: [],
            het: []
        },
        color_real: [],
        highlight: {},
        hide: {},
        residue_detail: {},
        //ranx add
        residueData: {},
        residueTypeList: {},
        getMain: function (id) {
            return [id, o.atom.main[id][6], o.color_real[id]];
        },
        getHet: function (id) {
            return [id, o.atom.het[id][6], o.color_real[id]];
        },
        getAtom: function (id) {
            return o.atom.main[id] ? this.getMain(id) : (o.atom.het[id] ? this.getHet(id) : null);
        },
        getAtomEx: function (id) {
            return o.atom.main[id] || (o.atom.het[id] || null);
        }

    };
    if (drugname && w3m.mol[drugname] !== undefined && w3m.mol[drugname].res) {
        o.id = drugname;
    }

    var parse = function (text) {

        //init drug limit
        w3m.global.drugLimit = {
            x: [],
            y: [],
            z: []
        }

        text = text.split('\n');
        // var preResidueID,nextResidueID;
        if (PDB.proDesign) {
            var afterText = '';
            for (var i = 0, l = text.length; i < l; i++) {
                var s = text[i].toLowerCase();
                switch (w3m_sub(s, 0, 6)) {
                    case 'atom':
                        s = doEditAtom(s);
                        if (s) {
                            s = s.toUpperCase();
                            afterText = afterText + s + "\n";
                        } else {
                            //afterText = afterText + s+"\n";
                        }
                        break;
                    case 'hetatm':
                        s = doeEitHet(s);
                        s = s.toUpperCase();
                        if (s) {
                            afterText = afterText + s + "\n";
                        } else {
                            afterText = afterText + s + "\n";
                        }
                        break;
                    default:
                        s = s.toUpperCase();
                        afterText = afterText + s + "\n";
                        break;
                }
            }

            {
                var formdata = new FormData();
                formdata.append('pdb_str', afterText);
                formdata.append('res_id', PDB.CHANGERESID);
                console.log("w3m")
                $.ajax({
                    url: "/design",
                    // url: "/result",
                    type: "post",
                    data: formdata,
                    processData: false,
                    contentType: false,
                    success: function (data) {
                        job_id = data.job_id
                        checking_module = data.module
                        console.log("success")
                        console.log(job_id)
                        window.open(checking_module + "/checking/" + job_id);
                    },
                    error: function () {
                        console.log("error")
                    }
                });

            }
            PDB.proDesign = false;
            return;
        } else {
            console.log("走到了else这里");
        }
    }
    /* 下面有一系列的函数*/
    {
        //ranx add 20200222
        var doLink = function (s) {
            if (!o.linkData) {
                o.linkData = {};
            }
            var randomAtom = {};
            randomAtom.atom_name = w3m_sub(s, 13, 16);
            randomAtom.residue_name = w3m_sub(s, 18, 20) || 'xxx';
            randomAtom.chain_id = w3m_sub(s, 22) || 'x';
            randomAtom.residue_id = parseInt(w3m_sub(s, 23, 26)) || 0;
            var normalAtom = {};
            normalAtom.atom_name = w3m_sub(s, 43, 46);
            normalAtom.residue_name = w3m_sub(s, 48, 50) || 'xxx';
            normalAtom.chain_id = w3m_sub(s, 52) || 'x';
            normalAtom.residue_id = parseInt(w3m_sub(s, 53, 56)) || 0;
            var linkData = {
                randomAtom: randomAtom,
                normalAtom: normalAtom
            }
            var rid = normalAtom.residue_id;
            if (!o.linkData[normalAtom.chain_id]) {

                o.linkData[normalAtom.chain_id] = {};
                o.linkData[normalAtom.chain_id][rid] = linkData;
            } else {
                o.linkData[normalAtom.chain_id][rid] = linkData;
            }

        }
        var doHeader = function (s) {
            o.id = w3m_sub(s, 63, 66);
            o.info.id = w3m_sub(s, 63, 66).toUpperCase();
            if (o.id === "none") {
                o.id = drugname;
                o.info.id = drugname;
            }
            o.info.classification = w3m_capword(w3m_sub(s, 11, 50));
        };
        var doTitle = function (s) {
            w3m_isset(o.info.title) ? void (0) : o.info.title = '';
            o.info.title += (w3m_sub(s, 9, 10) && o.info.title[o.info.title.length - 1] == '-') ? ' ' + w3m_capword(w3m_sub(s, 12, 80)) : w3m_capword(w3m_sub(s, 11, 80));
        };
        var doSource = function (s) {
            if (!w3m_isset(o.info.source)) {
                var sub = w3m_sub(s, 11, 79);
                if (w3m_start_with(sub, 'organism_common')) {
                    var source = sub.split(' ').slice(1).join(' ');
                    source[source.length - 1] == ';' ? source = source.slice(0, source.length - 1) : void (0);
                    o.info.source = w3m_capword(source);
                }
            }
        };
        var doExpdata = function (s) {
            o.info.expdata = w3m_capword(w3m_sub(s, 11, 79));
        };
        var doAuthor = function (s) {
            var author_list = w3m_sub(s, 11, 79).split(',');
            o.info.author = w3m_capword(author_list.join(', '));
        };
        var doJrnl = function (s) {
            switch (w3m_sub(s, 13, 16).toLowerCase()) {
                case 'ref':
                    o.info.journal = w3m_capword(w3m_sub(s, 20, 47));
                    o.info.volume = w3m_sub(s, 52, 55);
                    o.info.page = w3m_sub(s, 57, 61);
                    break;
                case 'pmid':
                    o.info.pmid = w3m_sub(s, 20, 79);
                    break;
                case 'doi':
                    o.info.doi = w3m_sub(s, 20, 79);
                    break;
            }
        };
        var doRemark = function (s) {
            var remark_id = w3m_sub(s, 8, 10);
            switch (remark_id) {
                case '2':
                    o.info.resolution = w3m_sub(s, 24, 30);
                    break;
            }
        };
        var doCryst = function (s) {
            o.info.cell = {},
                o.info.cell.len = [parseFloat(w3m_sub(s, 7, 15)), parseFloat(w3m_sub(s, 16, 24)), parseFloat(w3m_sub(s, 25, 33))];
            o.info.cell.angle = [parseFloat(w3m_sub(s, 34, 40)), parseFloat(w3m_sub(s, 41, 47)), parseFloat(w3m_sub(s, 48, 54))];
            o.info.cell.space_group = w3m_trim(w3m_sub(s, 56, 66));
        };
        var doEditAtom = function (s) {
            var atom_alt = w3m_sub(s, 17);
            if (atom_alt != '' && atom_alt != 'a') {
                return;
            }
            // if this is not AA or NA
            var chain_type = w3m.tool.getChainType(w3m_sub(s, 18, 20));
            if (chain_type == w3m.CHAIN_UNK) {
                s = doeEitHet(s);
                return s;
            }
            var atom_id = parseInt(w3m_sub(s, 7, 11)),
                atom_name = w3m_sub(s, 13, 16),
                residue_name = w3m_sub(s, 18, 20) || 'xxx',
                chain_id = w3m_sub(s, 22) || 'x',
                residue_id = parseInt(w3m_sub(s, 23, 26)) || 0,
                xyz = [parseFloat(w3m_sub(s, 31, 38)), parseFloat(w3m_sub(s, 39, 46)), parseFloat(w3m_sub(s, 47, 54))],
                occupancy = parseFloat(w3m_sub(s, 55, 60)),
                b_factor = parseFloat(w3m_sub(s, 61, 66)) || 0.0,
                element = w3m_sub(s, 77, 78);
            if (residue_id < 0) return;
            math.limit(xyz[0], w3m.global.limit.x);
            math.limit(xyz[1], w3m.global.limit.y);
            math.limit(xyz[2], w3m.global.limit.z);
            if (PDB.residueGroupObject[chain_id][residue_id].moveVec) {
                var v = PDB.residueGroupObject[chain_id][residue_id].moveVec;
                math.limit(v.x, w3m.global.limit.x);
                math.limit(v.y, w3m.global.limit.y);
                math.limit(v.z, w3m.global.limit.z);
                xyz[0] = xyz[0] + v.x;
                xyz[1] = xyz[1] + v.y;
                xyz[2] = xyz[2] + v.z;
                s = s.replace(w3m_sub(s, 31, 38), Math.floor(xyz[0] * 1000) / 1000);
                s = s.replace(w3m_sub(s, 39, 46), Math.floor(xyz[1] * 1000) / 1000);
                s = s.replace(w3m_sub(s, 47, 54), Math.floor(xyz[2] * 1000) / 1000);
            }

            if (PDB.allMainToms && PDB.allMainToms[chain_id][residue_id]) {
                var state = PDB.allMainToms[chain_id][residue_id]['state'];
                if (state == 'editRes') {
                    var nowEndID = w3m.structure.enum[residue_name].length + PDB.allMainToms[chain_id][residue_id].startAtomID - 1;
                    if (!PDB.allMainToms[chain_id][residue_id].tempID) {
                        PDB.allMainToms[chain_id][residue_id].tempID = PDB.allMainToms[chain_id][residue_id].startAtomID;
                    } else if (PDB.allMainToms[chain_id][residue_id].tempID < nowEndID) {
                        PDB.allMainToms[chain_id][residue_id].tempID++;
                    }
                    if (PDB.allMainToms[chain_id][residue_id].tempID == nowEndID) {
                        var _t_ = "";
                        var atoms = PDB.allMainToms[chain_id][residue_id].atoms;
                        var sss_ = new Array(atoms.length);


                        for (var i = 0; i < sss_.length; i++) {
                            sss_[i] = s;
                        }

                        for (var i in atoms) {
                            var atom_ = atoms[i];
                            var startAtomID = PDB.allMainToms[chain_id][residue_id].startAtomID;
                            var endAtomID = PDB.allMainToms[chain_id][residue_id].endAtomID;
                            atom_id = startAtomID + Number(i);
                            atom_id = (atom_id + "").length < 4 ? PDB.tool.fillSpace(atom_id, 4) : atom_id;
                            atom_name = atom_[2];
                            atom_name = atom_name.length < 3 ? PDB.tool.fillSpace(atom_name, 3, 'hou') : atom_name;
                            residue_name = atom_[3];
                            chain_id = atom_[4];
                            residue_id_ = residue_id + "";
                            residue_id_ = residue_id_.length < 3 ? PDB.tool.fillSpace(residue_id_, 3) : residue_id_;
                            var _x_ = Number(atom_[6][0]).toFixed(3);
                            var _y_ = Number(atom_[6][1]).toFixed(3);
                            var _z_ = Number(atom_[6][2]).toFixed(3);
                            var _o_ = Number(atom_[7]).toFixed(2);
                            var _b_ = Number(atom_[8]).toFixed(2);
                            //xyz          	= [x,y,z];
                            occupancy = _o_;
                            b_factor = _b_;
                            element = atom_[9];
                            //element = element.length<2?PDB.tool.fillSpace(element,1):element;
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 7, 11, atom_id);
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 13, 16, atom_name);
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 17, 20, residue_name);


                            sss_[i] = PDB.tool.replacePos(sss_[i], 22, chain_id);
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 23, 26, residue_id_);

                            _x_ = (_x_ + "").length < 7 ? PDB.tool.fillSpace((_x_ + ""), 7) : (_x_ + "");
                            _y_ = (_y_ + "").length < 7 ? PDB.tool.fillSpace((_y_ + ""), 7) : (_y_ + "");
                            _z_ = (_z_ + "").length < 7 ? PDB.tool.fillSpace((_z_ + ""), 7) : (_z_ + "");

                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 31, 38, _x_);
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 39, 46, _y_);
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 47, 54, _z_);

                            occupancy = (occupancy + "").length < 5 ? PDB.tool.fillSpace((occupancy + ""), 5) : (occupancy + "");
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 55, 60, occupancy);

                            b_factor = (b_factor + "").length < 5 ? PDB.tool.fillSpace((b_factor + ""), 5) : (b_factor + "");
                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 61, 66, b_factor);

                            sss_[i] = PDB.tool.replacePosByStartEnd(sss_[i], 77, 78, element);

                        }

                        for (var i in sss_) {
                            _t_ = _t_ + sss_[i] + "\n";
                            ;

                        }
                        _t_ = _t_.substring(0, _t_.length - 1);
                        //console.log(_t_);
                        PDB.allMainToms[chain_id][residue_id].tempID = undefined;
                        return _t_;

                    } else {
                        return null;
                    }

                } else if (state == 'justID') {
                    if (!PDB.allMainToms[chain_id][residue_id].tempID) {
                        PDB.allMainToms[chain_id][residue_id].tempID = PDB.allMainToms[chain_id][residue_id].startAtomID;
                    } else if (PDB.allMainToms[chain_id][residue_id].tempID < PDB.allMainToms[chain_id][residue_id].endAtomID) {
                        PDB.allMainToms[chain_id][residue_id].tempID++;
                    }
                    var tempID = PDB.allMainToms[chain_id][residue_id].tempID;
                    tempID = PDB.tool.fillSpace(tempID, 4);
                    s = PDB.tool.replacePosByStartEnd(s, 7, 11, tempID);

                    //s = s.replace(w3m_sub(s, 7, 11),PDB.allMainToms[chain_id][residue_id].tempID);
                }
            }

            return s;

        }
        // var doAtom = function (s) {
        //
        //     // omit alternate location
        //     var atom_alt = w3m_sub(s, 17);
        //     if (atom_alt != '' && atom_alt != 'a') {
        //         return;
        //     }
        //     // if this is not AA or NA
        //     var chain_type = w3m.tool.getChainType(w3m_sub(s, 18, 20));
        //     if (chain_type == w3m.CHAIN_UNK) {
        //         doHet(s);
        //         return;
        //     }
        //     // data
        //     var atom_id = parseInt(w3m_sub(s, 7, 11)),
        //         atom_name = w3m_sub(s, 13, 16),
        //         residue_name = w3m_sub(s, 18, 20) || 'xxx',
        //         chain_id = w3m_sub(s, 22) || 'x',
        //         residue_id = parseInt(w3m_sub(s, 23, 26)) || 0,
        //         xyz = [parseFloat(w3m_sub(s, 31, 38)), parseFloat(w3m_sub(s, 39, 46)), parseFloat(w3m_sub(s, 47, 54))],
        //         occupancy = parseFloat(w3m_sub(s, 55, 60)),
        //         b_factor = parseFloat(w3m_sub(s, 61, 66)) || 0.0,
        //         element = w3m_sub(s, 77, 78);
        //     if (residue_id < 0) return;
        //     math.limit(xyz[0], w3m.global.limit.x);
        //     math.limit(xyz[1], w3m.global.limit.y);
        //     math.limit(xyz[2], w3m.global.limit.z);
        //
        //
        //     //get Residue types
        //     if (o.residueTypeList.residue_name == undefined) {
        //         o.residueTypeList[residue_name] = residue_name;
        //     }
        //     if (b_factor) {
        //         math.average(b_factor, w3m.global.average.b_factor);
        //         math.limit(b_factor, w3m.global.limit.b_factor);
        //         if (chain_type == w3m.CHAIN_AA && w3m.structure.backbone.amino_acid.indexOf(atom_name) >= 0) {
        //             math.average(b_factor, w3m.global.average.b_factor_backbone);
        //             math.limit(b_factor, w3m.global.limit.b_factor_backbone);
        //         } else if ((chain_type == w3m.CHAIN_NA && w3m.structure.backbone.nucleic_acid.indexOf(atom_name) >= 0)) {
        //             math.average(b_factor, w3m.global.average.b_factor_backbone);
        //             math.limit(b_factor, w3m.global.limit.b_factor_backbone);
        //         }
        //     }
        //     // o.mol
        //     w3m_isset(o.tree.main[chain_id]) ? void (0) : o.tree.main[chain_id] = [];
        //     w3m_isset(o.tree.main[chain_id][residue_id]) ? void (0) : o.tree.main[chain_id][residue_id] = {};
        //     o.tree.main[chain_id][residue_id][atom_name] = atom_id;
        //     // o.chain
        //     w3m_isset(o.chain[chain_id]) ? void (0) : o.chain[chain_id] = chain_type;
        //     // o.residue
        //     w3m_isset(o.residue[chain_id]) ? void (0) : o.residue[chain_id] = [];
        //     w3m_isset(o.residue[chain_id][residue_id]) ? void (0) : o.residue[chain_id][residue_id] = residue_name;
        //     // o.ss
        //     w3m_isset(o.ss[chain_id]) ? void (0) : o.ss[chain_id] = [];
        //     w3m_isset(o.ss[chain_id][residue_id]) ? void (0) : o.ss[chain_id][residue_id] = w3m.LOOP;
        //     // o.rep
        //     w3m_isset(o.rep[chain_id]) ? void (0) : o.rep[chain_id] = [];
        //     w3m_isset(o.rep[chain_id][residue_id]) ? void (0) : o.rep[chain_id][residue_id] = w3m.config.rep_mode_main;
        //     // o.label
        //     w3m_isset(o.label_area[chain_id]) ? void (0) : o.label_area[chain_id] = [];
        //     w3m_isset(o.label_area[chain_id][residue_id]) ?
        //         void (0) : o.label_area[chain_id][residue_id] = w3m.config.label_area_main;
        //     w3m_isset(o.label_content[chain_id]) ? void (0) : o.label_content[chain_id] = [];
        //     w3m_isset(o.label_content[chain_id][residue_id]) ?
        //         void (0) : o.label_content[chain_id][residue_id] = w3m.config.label_content_main;
        //     // o.atom
        //     o.atom.main[atom_id] = [w3m.ATOM_MAIN, atom_id, atom_name, residue_name, chain_id, residue_id, xyz, occupancy, b_factor, element];
        //
        //     //console.log(chain_id+"|"+residue_id+"|"+sse);
        //     if (o.residueData[chain_id] == undefined) {
        //         o.residueData[chain_id] = {};
        //     }
        //
        //     if (o.residueData[chain_id][residue_id] == undefined) {
        //         // if(preResidueID){
        //         // o.residueData[chain_id][residue_id].preResidueID = preResidueID;
        //         // preResidueID = 	residue_id;
        //         // }
        //         var residueArray = Object.keys(o.residueData[chain_id]);
        //         if (residueArray.length > 0) {
        //             o.residueData[chain_id][residueArray[residueArray.length - 1]].laid = atom_id - 1;
        //         }
        //
        //         var sse = o.ss[chain_id][residue_id];
        //         o.residueData[chain_id][residue_id] = {
        //             id: residue_id,
        //             name: residue_name,
        //             chain: chain_id,
        //             sse: sse,
        //             faid: atom_id, //first atom id
        //             //laid	:   //last atom id
        //             //caid	:   //Ca atom id
        //             bbond: [], //Backbone id arrays
        //             lines: [], //paired id arrays
        //             path: [], //path to draw TUBE-style
        //             tangents: [],
        //             normals: [],
        //             binormals: [],
        //             arrow: [], //if sse is arrow
        //             issel: false
        //         }
        //
        //
        //     }
        //     if (atom_name == 'ca') {
        //         o.residueData[chain_id][residue_id].caid = atom_id;
        //     } else if (o.residueData[chain_id][residue_id].caid == undefined) {
        //         o.residueData[chain_id][residue_id].caid = atom_id;
        //     }
        //
        // };

        var doeEitHet = function (s) {
            //console.log(s);
            var atom_id = parseInt(w3m_sub(s, 7, 11)),
                atom_name = w3m_sub(s, 13, 16),
                residue_name = w3m_sub(s, 18, 20) || 'xxx',
                chain_id = w3m_sub(s, 22) || 'x',
                residue_id = parseInt(w3m_sub(s, 23, 26)) || 0,
                xyz = [parseFloat(w3m_sub(s, 31, 38)), parseFloat(w3m_sub(s, 39, 46)), parseFloat(w3m_sub(s, 47, 54))],
                occupancy = parseFloat(w3m_sub(s, 55, 60)),
                b_factor = parseFloat(w3m_sub(s, 61, 66)) || 0.0,
                element = w3m_sub(s, 77, 78);
            if (residue_id < 0) return;
            math.limit(xyz[0], w3m.global.limit.x);
            math.limit(xyz[1], w3m.global.limit.y);
            math.limit(xyz[2], w3m.global.limit.z);
            return s;

        }
        var doHet = function (s) {
            var atom_id = parseInt(w3m_sub(s, 7, 11)),
                atom_name = w3m_sub(s, 13, 16),
                residue_name = w3m_sub(s, 18, 20) || 'xxx',
                chain_id = w3m_sub(s, 22) || 'x',
                residue_id = parseInt(w3m_sub(s, 23, 26)) || 0,
                xyz = [parseFloat(w3m_sub(s, 31, 38)), parseFloat(w3m_sub(s, 39, 46)), parseFloat(w3m_sub(s, 47, 54))],
                occupancy = parseFloat(w3m_sub(s, 55, 60)),
                b_factor = parseFloat(w3m_sub(s, 61, 66)) || 0.0,
                element = w3m_sub(s, 77, 78);
            if (residue_id < 0) return;
            math.limit(xyz[0], w3m.global.limit.x);
            math.limit(xyz[1], w3m.global.limit.y);
            math.limit(xyz[2], w3m.global.limit.z);

            math.limit(xyz[0], w3m.global.drugLimit.x);
            math.limit(xyz[1], w3m.global.drugLimit.y);
            math.limit(xyz[2], w3m.global.drugLimit.z);

            if (b_factor) {
                math.average(b_factor, w3m.global.average.b_factor);
                math.limit(b_factor, w3m.global.limit.b_factor);
            }
            // o.tree.het
            w3m_isset(o.tree.het[chain_id]) ? void (0) : o.tree.het[chain_id] = [];
            o.tree.het[chain_id].push(atom_id);
            // o.atom
            o.atom.het[atom_id] = [w3m.ATOM_HET, atom_id, atom_name, residue_name, chain_id, residue_id, xyz, occupancy, b_factor, element];

            // o.single
            o.single[atom_id] = element;

        };
        var doConnect = function (s) {
            var atom_id_main = parseInt(w3m_sub(s, 7, 11));
            w3m_isset(o.connect[atom_id_main]) ? void (0) : o.connect[atom_id_main] = [];
            var other = function (start, stop) {
                var atom_id_other = parseInt(w3m_sub(s, start, stop));
                if (atom_id_other && o.getAtom(atom_id_other)) {
                    w3m_isset(o.connect[atom_id_other]) && o.connect[atom_id_other].indexOf(atom_id_main) >= 0 ?
                        void (0) :
                        o.connect[atom_id_main].push(atom_id_other);
                    delete o.single[atom_id_other];
                }
            };
            other(12, 16);
            other(17, 21);
            other(22, 26);
            other(27, 31);
            delete o.single[atom_id_main];
        };
        var doSSBond = function (s) {
            var chain_id_1 = w3m_sub(s, 16),
                residue_id_1 = w3m_sub(s, 18, 21),
                chain_id_2 = w3m_sub(s, 30),
                residue_id_2 = w3m_sub(s, 32, 35);
            o.ssbond.push([chain_id_1, residue_id_1, chain_id_2, residue_id_2]);
        };
        var doHelix = function (s) {
            var chain_id = w3m_sub(s, 20),
                helix_start = parseInt(w3m_sub(s, 22, 25)),
                helix_stop = parseInt(w3m_sub(s, 34, 37));
            w3m_isset(o.helix[chain_id]) ? void (0) : o.helix[chain_id] = [];
            o.helix[chain_id].push([helix_start, helix_stop]);
        };
        var doSheet = function (s) {
            var chain_id = w3m_sub(s, 22),
                sheet_id = w3m_sub(s, 12, 14),
                strand_start = parseInt(w3m_sub(s, 23, 26)),
                strand_stop = parseInt(w3m_sub(s, 34, 37));
            w3m_isset(o.sheet[chain_id]) ? void (0) : o.sheet[chain_id] = {};
            w3m_isset(o.sheet[chain_id][sheet_id]) ? void (0) : o.sheet[chain_id][sheet_id] = [];
            o.sheet[chain_id][sheet_id].push([strand_start, strand_stop]);
        };
        var doLaterWork = function () {
            // quality adjust
            var main_atom_total = o.atom.main.length;
            if (main_atom_total > 30000) {
                w3m.config.geom_tube_segment = 6;
                w3m.config.geom_stick_round_end = false;
            } else if (main_atom_total > 20000) {
                w3m.config.geom_tube_segment = 8;
                w3m.config.geom_stick_round_end = false;
            } else if (main_atom_total > 10000) {
                w3m.config.geom_tube_segment = 10;
            }
            // highlight & hide
            for (var i in o.chain) {
                o.highlight[i] = [];
                o.hide[i] = [];
            }
            // SSBond
            for (var i = 0, l = o.ssbond.length; i < l; i++) {
                var bond = o.ssbond[i],
                    atom_id_1,
                    atom_id_2;


                if (o.tree.main[bond[0]]) {
                    atom_id_1 = o.atom.main[o.tree.main[bond[0]][bond[1]].sg][1];
                }
                if (o.tree.main[bond[2]]) {
                    atom_id_2 = o.atom.main[o.tree.main[bond[2]][bond[3]].sg][1];
                }


                if (atom_id_1 && w3m_isset(o.connect[atom_id_1])) {
                    var index = o.connect[atom_id_1].indexOf(atom_id_2);
                    index >= 0 ? o.connect[atom_id_1].splice(index, 1) : void (0);
                }
                if (atom_id_1 && w3m_isset(o.connect[atom_id_2])) {
                    var index = o.connect[atom_id_2].indexOf(atom_id_1);
                    index >= 0 ? o.connect[atom_id_2].splice(index, 1) : void (0);
                }
            }
            // Connect
            for (var i in o.connect) {
                if (!o.connect[i].length) {
                    delete (o.connect[i]);
                }
            }
            // Split helix and sheet
            for (var i in o.chain) {
                if (o.chain[i] != w3m.CHAIN_AA) {
                    continue;
                }
                // helix
                if (w3m_isset(o.helix[i])) {
                    for (var ii = 0, ll = o.helix[i].length; ii < ll; ii++) {
                        var helix = o.helix[i][ii];
                        for (var iii = helix[0]; iii <= helix[1]; iii++) {
                            o.ss[i][iii] = w3m.HELIX;
                            if (o.residueData[i][iii]) {
                                o.residueData[i][iii].sse = w3m.HELIX;
                            }

                        }
                    }
                }
                // sheet
                if (w3m_isset(o.sheet[i])) {
                    for (var j in o.sheet[i]) {
                        var sheet = o.sheet[i][j];
                        for (var ii = 0, ll = sheet.length; ii < ll; ii++) {
                            var strand = sheet[ii];
                            for (var iii = strand[0]; iii <= strand[1]; iii++) {
                                o.ss[i][iii] = w3m.SHEET;
                                if (o.residueData[i][iii]) {
                                    o.residueData[i][iii].sse = w3m.SHEET;
                                }

                            }
                        }
                    }
                }
                // merge
                var ss_fragment = w3m_split_by_difference(o.ss[i]);
                ss_fragment.forEach(function (fg) {
                    var fg_start = fg[0],
                        fg_stop = fg[1],
                        fg_range = [fg[0], fg[1]];
                    switch (fg[2]) {
                        case w3m.HELIX:
                            var head = w3m.HELIX_HEAD,
                                body = w3m.HELIX_BODY,
                                foot = w3m.HELIX_FOOT;
                            break;
                        case w3m.SHEET:
                            var head = w3m.SHEET_HEAD,
                                body = w3m.SHEET_BODY,
                                foot = w3m.SHEET_FOOT;
                            break;
                        case w3m.LOOP:
                            var head = w3m.LOOP_HEAD,
                                body = w3m.LOOP_BODY,
                                foot = w3m.LOOP_FOOT;
                            break;
                    }
                    o.ss[i][fg_start] = [head, fg_range];
                    if (o.residueData[i][fg_start]) {
                        o.residueData[i][fg_start].sse = head;
                    }

                    for (var ii = fg[0] + 1; ii <= fg[1] - 1; ii++) {
                        o.ss[i][ii] = [body, fg_range];
                        if (o.residueData[i][ii]) {
                            o.residueData[i][ii].sse = body;
                        }

                    }
                    o.ss[i][fg_stop] = [foot, fg_range];
                    if (o.residueData[i][fg_stop]) {
                        o.residueData[i][fg_stop].sse = foot;
                    }

                });
            }
        };


        /* 这个函数该死的只能再IE浏览器中使用*/
        var JsExecCmd = function (value) {

            var cmd = new ActiveXObject("WScript.Shell");

            cmd.run("cmd.exe /k " + value);

            cmd.run("cmd.exe /k " + value);

            cmd = null;

        }

        var run = function () {

            var command = "echo lance  shuai  i love  !" //这里是执行的DOS命令

            JsExecCmd(command);

        }
    }

    switch (typeof text) {
        case 'string':
            parse(text);
            break;
        default:
            return false;
    }
    return o;


}
