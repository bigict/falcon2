#!/usr/bin/env python
# -*- coding:utf-8 -*-
from pymol import cmd


def pymol_align_global(pdb_a, pdb_b):
    cmd.load(pdb_a, 'receptor')
    cmd.load(pdb_b, 'ligand')
    cmd.align('receptor', 'ligand')
    cmd.save('data/align.pdb')
    cmd.quit()


def pymol_align_chain(
        pdb_a,
        pdb_b,
        chain_a,
        chain_b,
        res_st_a,
        res_st_b,
        res_ed_a,
        res_ed_b):
    cmd.load(pdb_a, 'receptor')
    cmd.load(pdb_b, 'ligand')
    receptor = "receptor and chain {} and resi {}-{}".format(chain_a, res_st_a, res_ed_a)
    ligand = "ligand and chain {} and resi {}-{}".format(chain_b, res_st_b, res_ed_b)
    cmd.align(receptor, ligand)
    cmd.save('data/align.pdb')
    cmd.quit()


if __name__ == '__main__':
    pymol_align_global('data/1cbs.pdb', 'data/1cbs.pdb')
