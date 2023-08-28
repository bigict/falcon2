#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 氢键 Hydrogen bonds
from pyrosetta import pose_from_pdb
from pyrosetta.rosetta.core.scoring.hbonds import HBondSet
import tempfile
import os


def pyrosetta_hbonds(pdb_data):
    temp_pdb = tempfile.NamedTemporaryFile(delete=False, suffix=".pdb")
    temp_pdb.write(pdb_data.encode())
    temp_pdb.close()
    pose = pose_from_pdb(temp_pdb.name)
    os.unlink(temp_pdb.name)
    pose_info = pose.pdb_info()
    hbond_set = HBondSet(pose, False)
    hydrogen_set = list()
    for hd in range(1, hbond_set.nhbonds() + 1):
        hydrogen_bond = {}
        hbond = hbond_set.hbond(hd)
        print(hbond)
        hydrogen_bond["donor"] = hbond.don_res()
        hydrogen_bond["acc"] = hbond.acc_res()
        hydrogen_bond["donor_chain"] = pose_info.chain(hydrogen_bond["donor"])
        hydrogen_bond["donor_id"] = pose_info.number(hydrogen_bond["donor"])
        hydrogen_bond["acc_chain"] = pose_info.chain(hydrogen_bond["acc"])
        hydrogen_bond["acc_id"] = pose_info.number(hydrogen_bond["acc"])
        if hydrogen_bond["donor_chain"] == hydrogen_bond["acc_chain"]:
            continue
        hydrogen_set.append(hydrogen_bond)
    return hydrogen_set
