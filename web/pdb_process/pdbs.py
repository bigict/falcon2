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
        res_id = residue.get_id()[1]
        # 根据残基ID进行筛选
        if start <= res_id <= end:
            for atom in residue:
                if atom.name == res_atom:
                    selected_atoms.append(atom.get_coord().tolist())
    return selected_atoms


# 根据坐标以及位置修改atom坐标
def change_coords_by_atom(path, chain, res_array, residue_atom, coords, output):
    chain = chain.upper()
    residue_atom = residue_atom.upper()
    newlines = ""
    with open(path, 'r') as infile:
        pdb_data = infile.readlines()
        number = 0
        for lines in pdb_data:
            try:
                if lines.startswith("ATOM") and (lines[21] == chain):
                    # if (lines[13:15] == residue_atom) and (res_array[0] <= int(lines[22:25]) <= res_array[1]):
                    if res_array[0] <= int(lines[22:25]) <= res_array[1]:
                        # 获取原先的x,y,z

                        x, y, z = coords[number]
                        number += 1
                        lines = lines[:30] + f"{x:8.3f}{y:8.3f}{z:8.3f}" + lines[54:]
                newlines += lines
            except:
                newlines += lines
                break
    return newlines
