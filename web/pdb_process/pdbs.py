#!/usr/bin/env python
# -*- coding: utf-8 -*-

from Bio import PDB
import numpy as np


parser = PDB.PDBParser()


def load_pdb(path):
    structure = parser.get_structure("my_structure", path)
    return structure


def get_coords_by_array(path, start, end, chain, res_atom):
    chain = chain.upper()
    res_atom = res_atom.upper()
    structure = load_pdb(path)
    # 创建一个空列表来保存符合条件的原子坐标
    selected_atoms = []
    # 遍历给定链中的每一个残基
    for residue in structure[0][chain]:
        # 获取残基的ID
        # res_id = residue.get_id()[1]
        hetflag, res_id, icode = residue.get_id()
        res_id = int(res_id)
        # 根据残基ID进行筛选
        if start <= res_id <= end:
            for atom in residue:
                if atom.name == res_atom:
                    selected_atoms.append(atom.get_coord().tolist())
    return selected_atoms


# 根据坐标以及位置修改atom坐标
def change_coords_by_atom(path, chain, res_array, coords):
    chain = chain.upper()
    newlines = ""
    with open(path, 'r') as infile:
        pdb_data = infile.readlines()
        number = -1
        res_number = 0
        for lines in pdb_data:
            # try:
            if lines.startswith("ATOM") and (lines[21] == chain):

                if res_array[0] <= int(lines[23:26]) <= res_array[-1]:
                    if res_number != int(lines[23:26]):
                        number += 1
                        res_number = int(lines[23:26])
                    # 获取原先的x,y,z
                    x_a = float(lines[30:38])
                    y_a = float(lines[38:46])
                    z_a = float(lines[46:54])
                    x, y, z = coords[number]
                    x = x + x_a
                    y = y + y_a
                    z = z + z_a
                    lines = lines[:30] + f"{x:8.3f}{y:8.3f}{z:8.3f}" + lines[54:]
            newlines += lines
            # except Exception as e:
            #     print(2)
            #     newlines += lines
                # break
    return newlines
