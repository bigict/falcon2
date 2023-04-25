import os

import numpy as np
import Bio.PDB
from Bio.PDB.Structure import Structure
from Bio.PDB.Atom import Atom
from Bio.PDB.Chain import Chain
from Bio.PDB.Model import Model
from Bio.PDB.Residue import Residue
import torch


def read_fasta(fasta_path):
    lines = open(fasta_path).readlines()
    assert len(lines) == 2, "Only single line sequence is supported"
    return lines[1].strip()


# def write_pdb(seq, N, CA, C, CB, path, info=None):
# def write_pdb(seq, N, CA, C, CB, info=None):
#     chain = Chain("A")
#     for i in range(len(seq)):
#         resname = Bio.PDB.Polypeptide.one_to_three(seq[i])
#         residue = Residue((" ", i + 1, " "), resname, "    ")
#         residue.add(Atom("N", N[i], 0.0, 1.0, " ", " N", 0, "N"))
#         residue.add(Atom("CA", CA[i], 0.0, 1.0, " ", " CA", 0, "C"))
#         if seq[i] != "G":
#             residue.add(Atom("CB", CB[i], 0.0, 1.0, " ", " CB", 0, "C"))
#         residue.add(Atom("C", C[i], 0.0, 1.0, " ", " C", 0, "C"))
#         chain.add(residue)
#     model = Model(0)
#     model.add(chain)
#     structure = Structure("X")
#     structure.add(model)
#     io = Bio.PDB.PDBIO()
#     io.set_structure(structure)
#     result = io.get_data()
#     return result

    # io = Bio.PDB.PDBIO()
    # io.set_structure(structure)
    # io.save(path)
    # if info:
    #     with open(path, "a") as fp:
    #         fp.write(f"# {info}\n")


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
    coord_o = place_fourth_atom(coord_n, torch.roll(coord_ca, -1, 0), torch.roll(coord_c, -1, 0),
                                torch.tensor(1.231), torch.tensor(2.108), torch.tensor(-3.142))
    return coord_o.tolist()


def write_pdb(seq, N, CA, C, CB, path, info=None):

    coord_n = torch.tensor(N)
    coord_ca = torch.tensor(CA)
    coord_c = torch.tensor(C)
    # coord_o = place_fourth_atom(torch.roll(coord_n, -1, 0), coord_ca, coord_c,
    # coord_o = place_fourth_atom(coord_n, torch.roll(coord_ca, -1, 0), torch.roll(coord_c, -1, 0),
    coord_o = place_fourth_atom(torch.roll(coord_n, -1, 0), torch.roll(coord_ca, -1, 0), torch.roll(coord_c, -1, 0),
    # coord_o = place_fourth_atom(coord_n, coord_ca, coord_c,
    # coord_o = place_fourth_atom(torch.roll(coord_n, -1, 0), coord_ca, coord_c,
                                torch.tensor(1.231), torch.tensor(2.108), torch.tensor(-3.142))
    coord_o = coord_o.numpy()

    chain = Chain("A")
    for i in range(len(seq)):
        resname = Bio.PDB.Polypeptide.one_to_three(seq[i])
        residue = Residue((" ", i + 1, " "), resname, "    ")
        residue.add(Atom("N", N[i], 0.0, 1.0, " ", " N", 0, "N"))
        residue.add(Atom("CA", CA[i], 0.0, 1.0, " ", " CA", 0, "C"))
        residue.add(Atom("C", C[i], 0.0, 1.0, " ", " C", 0, "C"))
        residue.add(Atom("O", coord_o[i], 0.0, 1.0, " ", " O", 0, "O"))
        if seq[i] != "G":
            residue.add(Atom("CB", CB[i], 0.0, 1.0, " ", " CB", 0, "C"))


        chain.add(residue)
    model = Model(0)
    model.add(chain)
    structure = Structure("X")
    structure.add(model)
    io = Bio.PDB.PDBIO()

    io.set_structure(structure)
    # result = io.get_data()
    io.save(path)

    if info:
        with open(path, "a") as fp:
            fp.write(f"# {info}\n")
    # return result