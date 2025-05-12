#!/usr/bin/env python
# -*- coding:utf-8 -*-

from pdbfixer import PDBFixer
from openmm.app import PDBFile


# 读取PDB文件
input_pdb = 'final.pdb'  # 替换为你的PDB文件路径
fixer = PDBFixer(filename=input_pdb)

# 选择修复链的选项。这一步可以根据需要修改。
fixer.findMissingResidues()
fixer.findMissingAtoms()
fixer.addMissingAtoms()
fixer.addMissingHydrogens(pH=7.0)  # 在pH 7.0条件下添加氢原子

# 保存修复后的PDB文件
with open('can3.pdb', 'w') as file:
    PDBFile.writeFile(fixer.topology, fixer.positions, file)