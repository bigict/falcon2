#!/usr/bin/env python
# -*- coding:utf-8 -*-
from simtk.openmm.app import *
from simtk.openmm import *
from simtk.unit import *

# 第一步：加载原始的 PDB 文件（假设文件名为 'input.pdb'）
pdb = PDBFile('can3.pdb')

# 第二步：选择力场
# 您可以根据需要选择不同的力场，这里以 AMBER14 为例
forcefield = ForceField('amber14-all.xml', 'amber14/tip3pfb.xml')

# 第三步：创建 Modeller 对象并添加缺失的氢原子
modeller = Modeller(pdb.topology, pdb.positions)
modeller.addHydrogens(forcefield)

# 第四步：创建系统
system = forcefield.createSystem(modeller.topology,
                                 nonbondedMethod=NoCutoff,
                                 constraints=HBonds)

# 第五步：设置积分器
integrator = LangevinIntegrator(300*kelvin, 1/picosecond, 0.002*picoseconds)

# 第六步：创建模拟对象
simulation = Simulation(modeller.topology, system, integrator)
simulation.context.setPositions(modeller.positions)

# 第七步：能量最小化
print('正在进行能量最小化...')
simulation.minimizeEnergy()

# 第八步：获取最小化后的坐标
positions = simulation.context.getState(getPositions=True).getPositions()

# 第九步：保存修正后的 PDB 文件（假设文件名为 'output.pdb'）
with open('can4.pdb', 'w') as f:
    PDBFile.writeFile(simulation.topology, positions, f)

print('修正后的 PDB 文件已保存为 output1.pdb')