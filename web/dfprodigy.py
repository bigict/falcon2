#!/usr/bin/env python
# -*- coding: utf-8 -*-

import subprocess


def execute_prodigy(pdb_file):

    command = f"prodigy {pdb_file}"
    stdout_line = "[++] Predicted binding affinity (kcal.mol-1):"
    binding_affinity = 0

    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    # 读取输出
    while True:
        output = process.stdout.readline().decode().strip()

        if output == '' and process.poll() is not None:
            break
        if stdout_line in output:
            binding_affinity = output.replace(stdout_line, '').strip()

    # 等待命令执行完成
    process.communicate()
    return binding_affinity
