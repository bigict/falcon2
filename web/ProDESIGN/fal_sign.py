#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time

import torch
from ProDESIGN.common.protein import from_pdb_string
from ProDESIGN.common import residue_constants
from ProDESIGN.config import args
from ProDESIGN.data.dataset import select_residue
from ProDESIGN.model import ProDesign
import numpy as np
from copy import deepcopy
from Bio.PDB import PDBParser
import random
import io
import os


def get_feature(chain, modtype, modres, header, device="cpu"):
    protein = from_pdb_string(chain, modtype, modres, header)
    seq = torch.tensor(protein.aatype, dtype=torch.int64).to(device)
    coord = torch.from_numpy(protein.atom_positions).to(device)
    coord_mask = torch.from_numpy(protein.atom_mask).to(device)
    ret = dict(seq=seq, str_seq=protein.str_aatype, coord=coord, coord_mask=coord_mask)
    return ret


def from_aatype_to_strtype(seq):
    restype_idx = ''
    for idx in seq:
        restype_idx = restype_idx + (residue_constants.restypes_with_x[idx])
    return restype_idx


def update_feature(ret, fixed, is_begin=False):
    if is_begin:
        random_seq = torch.tensor([np.random.randint(20) for _ in range(ret['seq'].size(0))], dtype=torch.int64,
                                  device=ret['seq'].device)
        seq_mask = torch.zeros(ret['seq'].size(0), device=ret['seq'].device)
        seq_mask[fixed] = 1
        random_seq = torch.where(seq_mask == 1, ret['seq'], random_seq)
        ret['seq'] = random_seq
    idx = None
    while idx is None or idx in fixed:
        ret = select_residue(ret)
        idx = ret['select_idx']

    ret['nei_feature'] = ret['nei_feature'].unsqueeze(0).float()
    ret['nei_mask'] = ret['nei_mask'].unsqueeze(0)
    return ret


def get_identity(a, b):
    assert len(a) == len(b)
    identity = sum(a[i] == b[i] for i in range(len(a))) / len(a)
    return identity


def str_to_fasta(fasta_str, fasta_name):
    with open(f'{fasta_name}.fasta', 'w') as f:
        f.writelines(fasta_str)


def additional(tensors, res_state, idx, chain_id):
    # 氨基酸属性
    is_type = ''
    index_dict = torch.tensor([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    if chain_id in res_state.keys():
        chain_state = res_state[chain_id]
        if idx in chain_state.keys():
            is_type = chain_state[idx]
    # 含芳香族的氨基酸
    if is_type == "Nonpolar":
        index_dict = torch.tensor([0, 7, 9, 10, 12, 19])
    # 亲水性氨基酸
    if is_type == "Polar uncharged":
        index_dict = torch.tensor([2, 4, 5, 14, 15, 16])
    elif is_type == "Positively charged":
        index_dict = torch.tensor([1, 8, 11])
    elif is_type == "Negatively charged":
        index_dict = torch.tensor([3, 6])
    elif is_type == "Sulfur-containing":
        index_dict = torch.tensor([4, 12])
    elif is_type == "Aromatic":
        index_dict = torch.tensor([13, 17, 18])
    select_pred = torch.index_select(tensors, 1, index_dict)
    return index_dict, select_pred


def falcon2_design(pdb_file,
                   fasta_name,
                   num=None,
                   fixed_dict=None,
                   total_step=None,
                   save_step=None,
                   res_state=None
                   ):
    current_directory = os.getcwd()

    # fasta_con = ""

    pdb_fh = io.StringIO(pdb_file)
    parser = PDBParser(QUIET=True, get_header=True)
    structure = parser.get_structure('none', pdb_fh)
    header = parser.get_header()

    modres = {}
    modtype = set()
    if 'MODRES' in header:
        for mod in header['MODRES']:
            mod_info = mod.split()
            key, val = tuple(mod_info[1:4]), mod_info[4]
            if key not in modres:
                modres[key] = []
            modres[key].append(val)
            modtype.add(mod_info[1])

    models = list(structure.get_models())
    if len(models) != 1:
        raise ValueError(
            f'Only single model PDBs are supported. Found {len(models)} models.')
    model = models[0]

    chains = list(model.get_chains())
    fasta_str = ''

    for number in range(len(chains)):
        chain = chains[number]
        chain_id = chain.id
        if chain_id not in fixed_dict.keys():
            continue
        else:
            fixed = fixed_dict[chain_id]

        default_ret = get_feature(chain, modtype, modres, header, device=args.device)
        if len(fixed) == len(default_ret["str_seq"]):
            fasta_str += f'{chain.id}>\n{default_ret["str_seq"]}\n'
        else:
            default_seq = from_aatype_to_strtype(default_ret['seq'])

            model = ProDesign(dim=args.dim, device=args.device)
            model.load_state_dict(
                torch.load(f'E:\\git-hub\\falcon2\\web\\ProDESIGN\\{args.save_file}.pt',
                           map_location=torch.device('cpu')))
            model.eval()
            with torch.no_grad():
                for i in range(num):
                    ret = update_feature(deepcopy(default_ret), fixed, is_begin=True)
                    assert ret != default_ret

                    for step in range(total_step):
                        preds = model(ret)
                        # 根据约束求res
                        idx = ret['select_idx']
                        print(idx)
                        index_id, preds = additional(preds, res_state, idx, chain_id)
                        print(preds)
                        res = index_id[preds.argmax(-1)].item()
                        ret['seq'][idx] = res
                        update_feature(ret, fixed)
                        if (step + 1) % save_step == 0:
                            str_seq = from_aatype_to_strtype(ret["seq"])
                            identity = get_identity(default_seq, str_seq)
                            # fasta_str += f'> {pdb_file} {args.save_file}_num{i}_step{step + 1} identity:{identity}\n{str_seq}\n'
                            fasta_str += f'{chain.id}> \n{str_seq}\n'
                            print(f'num {i} step {step + 1} identity {identity}\n', str_seq)
    str_to_fasta(fasta_str, fasta_name)
    return fasta_str
