#!/usr/bin/env python  -*- 
# -*- coding: utf-8    -*-
# -*- Author: DanFeng  -*-
import os

from flask import Flask, jsonify, send_file, redirect, request, render_template, url_for
from Bio.PDB import PDBParser
from Bio.PDB.DSSP import DSSP
from Bio.PDB.DSSP import dssp_dict_from_pdb_file
import logging
from .task.prediction import Prediction
from .task.task import Task
import numpy as np
import torch

app = Flask(__name__)

_aa_1_3_dict = {
    'A': 'ALA',
    'C': 'CYS',
    'D': 'ASP',
    'E': 'GLU',
    'F': 'PHE',
    'G': 'GLY',
    'H': 'HIS',
    'I': 'ILE',
    'K': 'LYS',
    'L': 'LEU',
    'M': 'MET',
    'N': 'ASN',
    'P': 'PRO',
    'Q': 'GLN',
    'R': 'ARG',
    'S': 'SER',
    'T': 'THR',
    'V': 'VAL',
    'W': 'TRP',
    'Y': 'TYR',
    '-': 'GAP'
}

_aa_3_1_dict = {v: k for k, v in _aa_1_3_dict.items()}


class FastaData(object):

    def __init__(self, pdb):
        self.pdb = pdb.split("\n")
        self.pdb_info = [lines.split() for lines in self.pdb if lines.startswith("ATOM")]
        self.pdb_info = [lines for lines in self.pdb_info]

    def get_fasta(self):
        res_name = [_aa_3_1_dict[i[3]] for i in self.pdb_info if i[2].upper() == "CA"]
        print(res_name)
        fasta = "".join(res_name)
        return fasta


def parse_pdb(lines):
    # N = np.array([[float(l[30:38]), float(l[38:46]), float(l[46:54])]
    #               for l in lines if l[:4] == "ATOM" and l[12:16].strip() == "N"])
    # Ca = np.array([[float(l[30:38]), float(l[38:46]), float(l[46:54])]
    #                for l in lines if l[:4] == "ATOM" and l[12:16].strip() == "CA"])
    # C = np.array([[float(l[30:38]), float(l[38:46]), float(l[46:54])]
    #               for l in lines if l[:4] == "ATOM" and l[12:16].strip() == "C"])
    # xyz = np.stack([N, Ca, C], axis=0)
    # # indices of residues observed in the structure
    # idx = np.array([int(l[22:26]) for l in lines if l[:4] == "ATOM" and l[12:16].strip() == "CA"])
    # return xyz, idx
    N = np.array([[float(l[6]), float(l[7]), float(l[8])] for l in lines if l[2].strip() == "N"])
    Ca = np.array([[float(l[6]), float(l[7]), float(l[8])] for l in lines if l[2].strip() == "CA"])
    C = np.array([[float(l[6]), float(l[7]), float(l[8])] for l in lines if l[2].strip() == "C"])
    xyz = np.stack([N, Ca, C], axis=0)
    # indices of residues observed in the structure
    idx = np.array([l[5] for l in lines if l[2].strip() == "CA"])
    return xyz, idx


def to_len(a_coords, b_coords, exp_shape=None):
    a_coords = torch.tensor(a_coords)
    b_coords = torch.tensor(b_coords)

    dist_mat = (a_coords - b_coords).norm(dim=-1)
    dist_mat = dist_mat.detach().numpy()

    return dist_mat


def to_dih(a, b, c, d):
    D = lambda x, y: np.sum(x * y, axis=-1)
    N = lambda x: x / np.sqrt(np.square(x).sum(-1, keepdims=True) + 1e-8)
    bc = N(b - c)
    n1 = np.cross(N(a - b), bc)
    n2 = np.cross(bc, N(c - d))
    return np.arctan2(D(np.cross(n1, bc), n2), D(n1, n2))


def to_ang(a, b, c):
    D = lambda x, y: np.sum(x * y, axis=-1)
    N = lambda x: x / np.sqrt(np.square(x).sum(-1, keepdims=True) + 1e-8)
    return np.arccos(D(N(b - a), N(b - c)))


def norm_fun(x, mu, sigma):
    pdf = np.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / (sigma * np.sqrt(2 * np.pi))
    return pdf


def extend(a, b, c, L, A, D):
    N = lambda x: x / np.sqrt(np.square(x).sum(-1, keepdims=True) + 1e-8)
    bc = N(b - c)
    n = N(np.cross(b - a, bc))
    m = [bc, np.cross(n, bc), n]
    d = [L * np.cos(A), L * np.sin(A) * np.cos(D), -L * np.sin(A) * np.sin(D)]
    return c + sum([m * d for m, d in zip(m, d)])


def mtx2bins(x_ref, start, end, nbins):
    if nbins == 37:
        bin_set = []
        bins = np.array([0] + np.linspace(2.5, 20, num=36).tolist(), dtype=np.float32)
        print(bins)
        for i in range(len(bins)):
            result = np.random.normal(i + 1, 7, 1000)  # 均值为0.5,方差为1
            x = np.arange(0, nbins)
            y = norm_fun(x, result.mean(), result.std())
            bin_set.append(y)
        bin_set = np.array(bin_set)

        x_true = np.digitize(x_ref, bins).astype(np.uint8) - 1
        x_true = bin_set[x_true]
        return x_true
    else:
        bin_set = []
        bins = np.linspace(start, end, nbins)
        for i in range(len(bins)):
            result = np.random.normal(i + 1, 7, 1000)  # 均值为0.5,方差为1
            x = np.arange(0, nbins)
            y = norm_fun(x, result.mean(), result.std())
            bin_set.append(y)
        bin_set = np.array(bin_set)

        x_true = np.digitize(x_ref, bins).astype(np.uint8) - 1
        x_true = bin_set[x_true]
        return x_true


def get_structure_info(pdb=None):
    assert pdb != None
    (N, CA, C), idx = parse_pdb(lines=pdb)
    CB = extend(C, N, CA, 1.522, 1.927, -2.143)
    dist_ref = to_len(CB[:, None], CB[None, :])
    omega_ref = to_dih(CA[:, None], CB[:, None], CB[None, :], CA[None, :])
    theta_ref = to_dih(N[:, None], CA[:, None], CB[:, None], CB[None, :])
    phi_ref = to_ang(CA[:, None], CB[:, None], CB[None, :])

    p_dist = mtx2bins(dist_ref, 2.5, 20.0, 37)
    p_omega = mtx2bins(omega_ref, -np.pi, np.pi, 25)
    p_theta = mtx2bins(theta_ref, -np.pi, np.pi, 25)
    p_phi = mtx2bins(phi_ref, 0.0, np.pi, 13)
    npz_dict = dict(cbcb=p_dist, omega=p_omega, theta=p_theta, phi=p_phi)

    return npz_dict


def add_o(ffd_str, list_pdb):
    # 获取o与Ca的坐标差
    o_d_value = []
    ca_xyz = np.array([0, 0, 0])
    o_xyz = np.array([0, 0, 0])
    res_num = 0
    o_list = []
    numbers = 1
    o_num = 0
    new_list = []

    # 通过N, CA, C,计算O的坐标

    for res in list_pdb:
        if res[2] == 'CA':
            res_num = res[5]
            ca_xyz[0] = float(res[6])
            ca_xyz[1] = float(res[7])
            ca_xyz[2] = float(res[8])
        elif res[2] == 'O' and res[5] == res_num:
            o_xyz[0] = float(res[6])
            o_xyz[1] = float(res[7])
            o_xyz[2] = float(res[8])
        o_list.append(ca_xyz - o_xyz)
    for data in ffd_str:
        if data[:4] == "ATOM":
            res_info = data.split()
            if res_info[2] == "CA":
                o_res = res_info.copy()
                o_res[6] = str(float(o_res[6]) + o_list[o_num][0])
                o_res[7] = str(float(o_res[7]) + o_list[o_num][1])
                o_res[8] = str(float(o_res[8]) + o_list[o_num][2])
                res_str = res_info[0] + str(numbers).rjust(7) + res_info[2].rjust(4) + res_info[3].rjust(5) + res_info[
                    4].rjust(2) \
                          + res_info[5].rjust(4) + res_info[6].rjust(12) + res_info[7].rjust(8) + res_info[8].rjust(8) \
                          + res_info[9].rjust(6) + res_info[10].rjust(6) + res_info[11].rjust(12) + "  " + "\n"
                numbers += 1
                o_str = o_res[0] + str(numbers).rjust(7) + "O".rjust(4) + o_res[3].rjust(5) + o_res[4].rjust(2) \
                        + o_res[5].rjust(4) + o_res[6].rjust(12) + o_res[7].rjust(8) + o_res[8].rjust(8) \
                        + o_res[9].rjust(6) + o_res[10].rjust(6) + "O".rjust(12) + "  " + "\n"
                numbers += 1
                new_list.append(res_str)
                new_list.append(o_str)
            else:
                res_str = res_info[0] + str(numbers).rjust(7) + res_info[2].rjust(4) + res_info[3].rjust(5) + res_info[
                    4].rjust(2) \
                          + res_info[5].rjust(4) + res_info[6].rjust(12) + res_info[7].rjust(8) + res_info[8].rjust(8) \
                          + res_info[9].rjust(6) + res_info[10].rjust(6) + res_info[11].rjust(12) + "  " + "\n"
                numbers += 1
                new_list.append(res_str)
        else:
            new_list.append(data)
    return "".join(new_list)


def place_fourth_atom(a_coord: torch.Tensor,
                      b_coord: torch.Tensor,
                      c_coord: torch.Tensor,
                      length: torch.Tensor,
                      planar: torch.Tensor,
                      dihedral: torch.Tensor):
    bc_vec = b_coord - c_coord
    bc_vec = bc_vec / bc_vec.norm(dim=-1, keepdim=True)

    n_vec = (b_coord - a_coord).expand(bc_vec.shape).cross(bc_vec)
    n_vec = n_vec / n_vec.norm(dim=-1, keepdim=True)

    m_vec = [bc_vec, n_vec.cross(bc_vec), n_vec]
    d_vec = [
        length * torch.cos(planar),
        length * torch.sin(planar) * torch.cos(dihedral),
        -length * torch.sin(planar) * torch.sin(dihedral)
    ]

    d_coord = c_coord + sum([m * d for m, d in zip(m_vec, d_vec)])

    return d_coord


def calc_o_coords(ffd_str):
    coord_n = []
    coord_ca = []
    coord_c = []
    for data in ffd_str:
        if data[:4] == "ATOM":
            coords = [0, 0, 0]
            res_info = data.split()
            coords[0] = float(res_info[6])
            coords[1] = float(res_info[7])
            coords[2] = float(res_info[8])
            if res_info[2] == "N":
                coord_n.append(coords)
            elif res_info[2] == "CA":
                coord_ca.append(coords)
            elif res_info[2] == "C":
                coord_c.append(coords)
    coord_n = torch.tensor(coord_n)
    coord_ca = torch.tensor(coord_ca)
    coord_c = torch.tensor(coord_c)
    coord_o = place_fourth_atom(torch.roll(coord_n, -1, 0), coord_ca, coord_c,
                                torch.tensor(1.231), torch.tensor(2.108), torch.tensor(-3.142))
    return coord_o.tolist()


# 普鲁克分析
def proc_analysis(X0, X1):
    t0 = X0.mean(dim=0, keepdim=True)
    t1 = X1.mean(dim=0, keepdim=True)

    X0c = X0 - t0
    X1c = X1 - t1

    s0 = (X0c ** 2).sum(dim=-1).mean().sqrt()
    s1 = (X1c ** 2).sum(dim=-1).mean().sqrt()
    X0cs = X0c / s0
    X1cs = X1c / s1

    U, S, V = (X0cs.t()@X1cs).double().svd(some=True)
    R = (U@V.t()).float()

    return t0[0], t1[0], s0, s1, R


def get_ffd_short(pdb, nums, outdir, n_structs, pool_size, device, snapshot):

    # 从pdb中提取拖动的残基
    pdb_dt = pdb.split("\n")
    pdb_cg = []
    pdb_bf = []
    pdb_af = []

    for res in pdb_dt:
        if res.startswith("ATOM"):
            line = res.split()
            if line[5] in nums:
                if line[2] in ["N", "CA", "C", "O", "CB"]:
                    pdb_cg.append(res)
                pass
            elif int(line[5]) < nums[0]:
                pdb_bf.append(res)
            else:
                pdb_af.append(res)

    pdb_cg_str = "".join(pdb_cg)
    pdb_bf_str = "".join(pdb_bf)
    pdb_af_str = "".join(pdb_af)

    # 从pdb中获取fasta
    fasta_data = FastaData(pdb_cg_str)
    fasta = fasta_data.get_fasta()

    # 将 get_structure_info的输出转化为 geo_npz
    geo_npz = get_structure_info(fasta_data.pdb_info)

    if device == -1:
        device = "cpu"
    pred = Prediction(geo_npz)
    if pool_size == -1:
        pool_size = n_structs
    assert not snapshot or n_structs == 1, "n_structs must be set to 1 if snapshot"
    task = Task(fasta=fasta,
                prediction=pred,
                outdir=outdir,
                n_structs=n_structs,
                pool_size=pool_size,
                device=device,
                is_snapshot=snapshot)
    task.start()
    path = outdir + "/decoys/dssp.pdb"

    with open(path, "r") as fr:
        result = "".join([i for i in fr if i.startswith("ATOM")])

    pdb_bf_data = []
    pdb_af_data = []
    pdb_af_data_oth = []

    for i in pdb_cg:
        res_dt = i.split()
        if res_dt[2] in ["N", "CA", "C", "O", "CB"]:
            axis = [float(res_dt[6]), float(res_dt[7]), float(res_dt[8])]
            pdb_bf_data.append(axis)

    for j in result:
        result_dt = j.split()
        if result_dt[2] in ["N", "CA", "C", "O", "CB"]:
            axis = [float(result_dt[6]), float(result_dt[7]), float(result_dt[8])]
            pdb_af_data_oth.append([result_dt[0],result_dt[1],result_dt[2],result_dt[3],result_dt[4],
                               result_dt[5],result_dt[6],result_dt[7],result_dt[8],result_dt[9],
                               result_dt[10],result_dt[11]])
            pdb_af_data.append(axis)


    axis1 = torch.tensor(pdb_bf_data, dtype=torch.float)
    axis2 = torch.tensor(pdb_af_data, dtype=torch.float)

    t0, t1, s0, s1, R = proc_analysis(axis1, axis2)
    t_aligned = (axis2 - t1) / s1 @ R.t() * s0 + t0

    for num in range(len(t_aligned)):
        pdb_af_data_oth[num][6] = t_aligned[num][0]
        pdb_af_data_oth[num][7] = t_aligned[num][1]
        pdb_af_data_oth[num][8] = t_aligned[num][2]
    result_1 = ""
    for i in pdb_af_data_oth:
        # ATOM      1  N   PRO A   1      -4.917 -17.281  -2.857  1.00  0.00           N
        new_line = i[0] + i[1].rjust(7) + i[2].rjust(3) + i[3].rjust(6) + i[4].rjust(2)\
                   +i[5].rjust(4) + i[6].rjust(12) +i[7].rjust(8) +i[8].rjust(8) + \
                   i[9].rjust(6) + i[10].rjust(6) + i[11].rjust(12)
        result_1 += new_line + '\n'


    result = pdb_bf_str + result_1 + pdb_af_str
    path_pdb = outdir + "/decoys/format.pdb"
    with open(path_pdb, "w") as fw:
        fw.writelines(result)

'''
    dssp = dssp_dict_from_pdb_file(path_pdb, DSSP="mkdssp")
    dssp = dssp[0]
    for k, i in dssp.items():
        print(k, i)
    helix_num = dict()

    pdb_dssp_list = []

    for keys, values in dssp.items():
        each_line = [keys[0], str(keys[1][1]), _aa_1_3_dict[values[0]], values[1]]
        pdb_dssp_list.append(each_line)

    helix_start = []
    helix_end = []

    helix_start_status = ""

    sheet_list = []
    for index, el in enumerate(pdb_dssp_list):
        if el[3] in ["H", "G", "I"] and len(helix_start_status) == 0:
            if index > 1 and pdb_dssp_list[index - 1][3] != "E":
                helix_start_status = pdb_dssp_list[index - 1]
                helix_start.append(helix_start_status)
        elif el[3] not in ["H", "G", "I"] and len(helix_start_status) != 0:
            if el[3] != "E":
                helix_start_status = ""
                helix_end_status = pdb_dssp_list[index]
                helix_end.append(helix_end_status)
            else:
                helix_start_status = ""
                if len(helix_start) > len(helix_end):
                    helix_start = helix_start[:len(helix_end)]
        if el[3] == "E":
            sheet_list.append(el)

    nums = 1

    # helix_str = "HELIX" + str(nums).ljust(4) + str(nums).ljust(4) + ASN

    start_number = 0
    dssp_h_s = []
    # print(len(helix_start))
    # print(helix_start)
    # print(helix_end)
    # print(len(helix_end))
    if len(helix_start) == len(helix_end):
        for helix_index in range(len(helix_start)):
            helix_str = "HELIX" + str(nums).rjust(5) + str(nums).rjust(4) + \
                        helix_start[helix_index][2].rjust(4) + helix_start[helix_index][0].rjust(2) + \
                        helix_start[helix_index][1].rjust(5) + helix_end[helix_index][2].rjust(5) + \
                        helix_end[helix_index][0].rjust(2) + \
                        helix_end[helix_index][1].rjust(5) + "0".rjust(39) + "    " + "\n"
            dssp_h_s.append(helix_str)
    nums = 1

    sheet_start = []
    sheet_end = []
    sheet_before = ""
    for sls in sheet_list:
        if start_number == 0:
            start_number = int(sls[1])
            sheet_start.append(sls)
        if start_number != int(sls[1]):
            start_number = int(sls[1])
            sheet_end.append(sheet_before)
            sheet_start.append(sls)
        if sls == sheet_list[-1] and (sls not in sheet_end):
            sheet_end.append(sls)
        start_number += 1
        sheet_before = sls
    print(len(sheet_start))
    print(len(sheet_end))
    if len(sheet_start) == len(sheet_end):
        for sl in range(len(sheet_start)):
            sheet_str = "SHEET" + str(nums).rjust(5) + sheet_start[sl][0].rjust(4) + str(nums).rjust(2) + \
                        sheet_start[sl][2].rjust(4) + sheet_start[sl][0].rjust(2) + \
                        sheet_start[sl][1].rjust(4) + sheet_end[sl][2].rjust(5) + \
                        sheet_end[sl][0].rjust(2) + \
                        sheet_end[sl][1].rjust(4) + "  \n"
            dssp_h_s.append(sheet_str)
    print("dssp_h_s", dssp_h_s)
    print("sheet_list", sheet_list)
    print("pdb_dssp_list", pdb_dssp_list)
    h_sh = "".join(dssp_h_s)
    new_data = h_sh + result
    with open(path, "w") as fw1:
        fw1.write(new_data)
    # dssp

    return h_sh + result
    # return path
    # if len(result) == len(fasta_data.pdb_info):

    pass

'''


def get_ffd(pdb, outdir, n_structs, pool_size, device, snapshot):
    # 从pdb中获取fasta
    fasta_data = FastaData(pdb)
    path_pdb = outdir + "/decoys/format.pdb"
    with open(path_pdb, "w") as fw:
        fw.write(pdb)
    fasta = fasta_data.get_fasta()
    # 将 get_structure_info 的输出转换为 geo_npz
    geo_npz = get_structure_info(fasta_data.pdb_info)
    if device == -1:
        device = "cpu"
    pred = Prediction(geo_npz)
    if pool_size == -1:
        pool_size = n_structs
    assert not snapshot or n_structs == 1, "n_structs must be set to 1 if snapshot"
    task = Task(fasta=fasta,
                prediction=pred,
                outdir=outdir,
                n_structs=n_structs,
                pool_size=pool_size,
                device=device,
                is_snapshot=snapshot)
    task.start()

    path = outdir + "/decoys/dssp.pdb"

    with open(path, "r") as fr:
        result = "".join([i for i in fr if i.startswith("ATOM")])
    # path_pdb = "1cbs.pdb"

    # print(result)
    # parser = PDBParser()
    # structure = parser.get_structure("dssp", path)
    # model = structure[0]

    dssp = dssp_dict_from_pdb_file(path_pdb, DSSP="mkdssp")
    dssp = dssp[0]
    for k, i in dssp.items():
        print(k, i)
    helix_num = dict()

    pdb_dssp_list = []

    for keys, values in dssp.items():
        each_line = [keys[0], str(keys[1][1]), _aa_1_3_dict[values[0]], values[1]]
        pdb_dssp_list.append(each_line)

    helix_start = []
    helix_end = []

    helix_start_status = ""

    sheet_list = []
    for index, el in enumerate(pdb_dssp_list):
        if el[3] in ["H", "G", "I"] and len(helix_start_status) == 0:
            if index > 1 and pdb_dssp_list[index - 1][3] != "E":
                helix_start_status = pdb_dssp_list[index - 1]
                helix_start.append(helix_start_status)
        elif el[3] not in ["H", "G", "I"] and len(helix_start_status) != 0:
            if el[3] != "E":
                helix_start_status = ""
                helix_end_status = pdb_dssp_list[index]
                helix_end.append(helix_end_status)
            else:
                helix_start_status = ""
                if len(helix_start) > len(helix_end):
                    helix_start = helix_start[:len(helix_end)]
        if el[3] == "E":
            sheet_list.append(el)

    nums = 1

    # helix_str = "HELIX" + str(nums).ljust(4) + str(nums).ljust(4) + ASN

    start_number = 0
    dssp_h_s = []
    # print(len(helix_start))
    # print(helix_start)
    # print(helix_end)
    # print(len(helix_end))
    if len(helix_start) == len(helix_end):
        for helix_index in range(len(helix_start)):
            helix_str = "HELIX" + str(nums).rjust(5) + str(nums).rjust(4) + \
                        helix_start[helix_index][2].rjust(4) + helix_start[helix_index][0].rjust(2) + \
                        helix_start[helix_index][1].rjust(5) + helix_end[helix_index][2].rjust(5) + \
                        helix_end[helix_index][0].rjust(2) + \
                        helix_end[helix_index][1].rjust(5) + "0".rjust(39) + "    " + "\n"
            dssp_h_s.append(helix_str)
    nums = 1

    sheet_start = []
    sheet_end = []
    sheet_before = ""
    for sls in sheet_list:
        if start_number == 0:
            start_number = int(sls[1])
            sheet_start.append(sls)
        if start_number != int(sls[1]):
            start_number = int(sls[1])
            sheet_end.append(sheet_before)
            sheet_start.append(sls)
        if sls == sheet_list[-1] and (sls not in sheet_end):
            sheet_end.append(sls)
        start_number += 1
        sheet_before = sls
    print(len(sheet_start))
    print(len(sheet_end))
    if len(sheet_start) == len(sheet_end):
        for sl in range(len(sheet_start)):
            sheet_str = "SHEET" + str(nums).rjust(5) + sheet_start[sl][0].rjust(4) + str(nums).rjust(2) + \
                        sheet_start[sl][2].rjust(4) + sheet_start[sl][0].rjust(2) + \
                        sheet_start[sl][1].rjust(4) + sheet_end[sl][2].rjust(5) + \
                        sheet_end[sl][0].rjust(2) + \
                        sheet_end[sl][1].rjust(4) + "  \n"
            dssp_h_s.append(sheet_str)
    print("dssp_h_s", dssp_h_s)
    print("sheet_list", sheet_list)
    print("pdb_dssp_list", pdb_dssp_list)
    h_sh = "".join(dssp_h_s)
    new_data = h_sh + result
    with open(path, "w") as fw1:
        fw1.write(new_data)
    # dssp

    return h_sh + result
    # return path
    # if len(result) == len(fasta_data.pdb_info):


@app.route('/ffd/', methods=['GET', 'POST'])
def ffd():
    pdb_file = request.values.get("pdb_file")
    pdb_position = request.values.get("pdb_position")
    outdir = "output"
    n_structs = 1
    pool_size = -1
    device = 0
    snapshot = 0
    result = main(pdb_file, outdir, n_structs, pool_size, device, snapshot)
    return jsonify(result)


if __name__ == '__main__':
    # app.run(host="127.0.0.1", threaded=True)
    with open("1cbs1.pdb", "r") as fr:
        pdb = "".join([i for i in fr])
    #
    outdir = "output"
    n_structs = 1
    pool_size = -1
    device = 0
    snapshot = 0
    data = get_ffd_short(pdb,[], outdir, n_structs, pool_size, device, snapshot)
    print(data)
