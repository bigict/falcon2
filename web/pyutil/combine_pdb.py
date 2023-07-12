#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pyrosetta

# 初始化Pyrosetta
pyrosetta.init()


def cb_pdb(pdb_file_1, pdb_file_2):
    pose1 = pyrosetta.pose_from_pdb(pdb_file_1)
    pose2 = pyrosetta.pose_from_pdb(pdb_file_2)

    # 创建一个新的Pose对象作为合并后的蛋白质结构
    merged_protein = pyrosetta.Pose()

    # 将第一个蛋白质的结构复制到合并后的结构中
    merged_protein.assign(pose1)

    # 将第二个蛋白质的结构追加到合并后的结构中
    merged_protein.append_pose_by_jump(pose2, 1)
    merged_protein.dump_pdb("output.pdb")
