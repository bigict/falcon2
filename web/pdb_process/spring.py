#!/usr/bin/env python
# -*- coding: utf-8 -*-

import numpy as np


# 单位向量
def normalize_vec(vec):
    return vec / np.linalg.norm(vec)


# 使用FABRIK调整主链Ca之间的距离
def adjust_positions(points, fixed_index=None, fixed_value=None, iter_count=5, dist=3.8):
    original_points = points[:]

    if fixed_index:
        points[fixed_index] = fixed_value
    # FABRIK
    for _ in range(iter_count):
        # 从终点到起点
        for i in range(len(points) - 2, 0, -1):
            if i == fixed_index:
                continue
            dir_vec = normalize_vec(np.array(points[i]) - np.array(points[i+1]))
            points[i] = np.array(points[i + 1]) + dir_vec * dist

        for i in range(1, len(points) - 1):
            if i == fixed_index:  # 跳过固定的点
                continue
            dir_vec = normalize_vec(np.array(points[i]) - np.array(points[i-1]))
            points[i] = np.array(points[i-1]) + dir_vec * dist
    points_np = np.array(points)
    op_np = np.array(original_points)
    res_np = (points_np - op_np).tolist()
    return points, res_np
