#!/usr/bin/env python  -*-
# -*- coding: utf-8    -*-
# -*- Author: DanFeng  -*-
from pathlib import Path
from tools.df_times import load_config
import glob
import os


a = load_config()
print( a['pdb_path'])
directory = a['pdb_path']
def list_all_files(directory):
    all_files = {}
    # 遍历目录树
    for root, dirs, files in os.walk(directory):
        # 将每个文件的完整路径添加到列表中
        for file in files:
            all_files.append({os.path.join(root, file))
    return all_files

# 示例：获取当前目录及其子目录下的所有文件
all_files = list_all_files(directory)
print(all_files)
# files = [f for f in Path(a['pdb_path']).iterdir() if f.is_file()]