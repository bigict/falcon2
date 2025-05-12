#!/usr/bin/env python
# -*- coding:utf-8 -*-


def reindex_pdb(input_pdb, output_pdb):
    new_lines = []
    atom_id = 1  # 原子ID的初始编号
    res_id = 0  # 残基ID的初始编号
    last_res_name = None  # 记录前一个残基名，以便判断是否需要增加res_id

    with open(input_pdb, 'r') as infile:
        for line in infile:
            if not line.startswith("ATOM") and not line.startswith("HETATM"):
                # 保留非原子行（如TER、END）
                new_lines.append(line)
                continue

            # 解析行中的信息
            atom_name = line[12:16]
            res_name = line[17:20]
            chain_id = line[21:22]  # 统一链ID为A
            x, y, z = line[30:38], line[38:46], line[46:54]  # 坐标
            occupancy = line[54:60]
            temp_factor = line[60:66]
            element = line[76:78].strip()

            atom_name_1 = atom_name.strip()
            chain_id_1 = chain_id.strip()

            if last_res_name != chain_id_1:
                res_id = 0
                last_res_name = chain_id_1

            # 检查是否需要增加res_id（根据res_name是否变化）
            if atom_name_1 == 'N':
                res_id += 1


            # 构造新的PDB行并对齐格式
            new_line = (
                f"ATOM  {atom_id:5d} {atom_name:<4} {res_name:>3} {chain_id:>1}"
                f"{res_id:4d}    {x}{y}{z}{occupancy}{temp_factor}           {element:<2}\n"
            )
            new_lines.append(new_line)
            atom_id += 1  # 增加atom_id

    # 将处理后的内容写入新的PDB文件
    with open(output_pdb, 'w') as outfile:
        outfile.writelines(new_lines)


# 示例用法
# reindex_pdb('input.pdb', 'output_reindexed.pdb')

# 使用示例：重编号并保存到新文件
input_filename = "can1.pdb"   # 原PDB文件
output_filename = "can2.pdb"  # 重编号后的PDB文件
reindex_pdb(input_filename, output_filename)
