#!/usr/bin/env python
# -*- coding:utf-8 -*-

def filter_and_replace_resname(input_pdb, output_pdb):
    # 定义我们想保留的原子名称
    valid_atoms = {"N", "CA", "C", "O"}

    with open(input_pdb, 'r') as infile, open(output_pdb, 'w') as outfile:
        for line in infile:
            # 检查行是否以 'ATOM' 或 'HETATM' 开头
            if line.startswith("ATOM") or line.startswith("HETATM"):
                # 获取原子名称（在PDB格式中，原子名称通常从第13到16列）
                atom_name = line[12:16].strip()

                # 如果原子名称在我们允许的列表中，则进行处理
                if atom_name in valid_atoms:
                    # 替换残基名称为 'GLY'（残基名称通常位于第18到20列）
                    new_line = line[:17] + "GLY" + line[20:]  # 保留原行的其余部分
                    outfile.write(new_line)
                    # outfile.write(line)
            else:
                # 保留非原子行（如 'TER', 'END', 其他注释行）
                outfile.write(line)


# 调用函数，传入输入和输出PDB文件路径
filter_and_replace_resname('output_1.pdb', 'can1.pdb')
