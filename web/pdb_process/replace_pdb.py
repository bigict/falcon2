# replace atom
from Bio import PDB
import numpy as np

parser = PDB.PDBParser()
pdbio = PDB.PDBIO

def align_peptides_by_three_points(point_a, point_b):
    # 通过三点对齐物体，返回旋转矩阵R和平移向量t
    # 起始点为指定点，后面点为起点终点
    # 设置不变点
    a_centered = point_a - point_a[0]
    b_centered = point_b - point_b[0]

    # 创建局部坐标系
    x_a = a_centered[1] / np.linalg.norm(a_centered[1])
    y_a = np.cross(x_a, a_centered[2])
    y_a /= np.linalg.norm(y_a)
    z_a = np.cross(x_a, y_a)

    x_b = b_centered[1] / np.linalg.norm(b_centered[1])
    y_b = np.cross(x_b, b_centered[2])
    y_b /= np.linalg.norm(y_b)
    z_b = np.cross(x_b, y_b)

    # 构建旋转矩阵
    r_a = np.vstack([x_a, y_a, z_a]).T
    r_b = np.vstack([x_b, y_b, z_b]).T
    r = r_b @ r_a.T

    # 计算平移向量
    t = point_b[0] - (r @ point_a[0])
    return r, t


# 对多肽做旋转平移
def move_peptides(peptides, rotation, transform):
    new_peptides = (rotation @ peptides.T).T + transform
    return new_peptides


def list_2_pdb(atom, numbers):
    line = f"ATOM  %5d  %-2s  %3s %s%4d    %8.3f%8.3f%8.3f  %4.2f  %4.2f\n" % (
        numbers, atom[1], atom[2], atom[3], atom[4], atom[5], atom[6], atom[7], atom[8], atom[9])
    return line


def change_residue_p(path):
    with open(path, "r") as fr:
        data = fr.readlines()
    data = "".join(data)
    pdb_header, pdb_end= return_coord(data)
    pdb_header = "\n".join(pdb_header)
    pdb_end = "\n".join(pdb_end)
    return pdb_header, pdb_end

    pass

class Select:
    """Select everything for PDB output (for use as a base class).

    Default selection (everything) during writing - can be used as base class
    to implement selective output. This selects which entities will be written out.
    """

    def __repr__(self):
        """Represent the output as a string for debugging."""
        return "<Select all>"

    def accept_model(self, model):
        """Overload this to reject models for output."""
        return 1

    def accept_chain(self, chain):
        """Overload this to reject chains for output."""
        return 1

    def accept_residue(self, residue):
        """Overload this to reject residues for output."""
        return 1

    def accept_atom(self, atom):
        """Overload this to reject atoms for output."""
        return 1

def save_pdb(structure):
    pdb_text_data = ""
    io = PDB.PDBIO()
    io.set_structure(structure)
    # io.save()
    preserve_atom_numbering = False
    select = Select()
    if len(structure) > 1 or io.use_model_flag:
        model_flag = 1
    else:
        model_flag = 0
    get_atom_line = io._get_atom_line
    for model in structure.get_list():
        if not select.accept_model(model):
            continue
        # necessary for ENDMDL
        # do not write ENDMDL if no residues were written
        # for this model
        model_residues_written = 0
        atom_number = 1
        if model_flag:
            pdb_text_data += "MODEL      %s\n" % model.serial_num
        for chain in model.get_list():
            if not select.accept_chain(chain):
                continue
            chain_id = chain.get_id()
            chain_residues_written = 0
            for residue in chain.get_unpacked_list():
                if not select.accept_residue(residue):
                    continue
                hetfield, resseq, icode = residue.get_id()
                resname = residue.get_resname()
                segid = residue.get_segid()
                for atom in residue.get_unpacked_list():
                    if select.accept_atom(atom):
                        chain_residues_written = 1
                        model_residues_written = 1
                        if preserve_atom_numbering:
                            atom_number = atom.get_serial_number()

                            # Check if the atom serial number is an integer
                            # Not always the case for mmCIF files.
                            try:
                                atom_number = int(atom_number)
                            except ValueError:
                                raise ValueError(
                                    f"{repr(atom_number)} is not a number."
                                    "Atom serial numbers must be numerical"
                                    " If you are converting from an mmCIF"
                                    " structure, try using"
                                    " preserve_atom_numbering=False"
                                )

                        s = get_atom_line(
                            atom,
                            hetfield,
                            segid,
                            atom_number,
                            resname,
                            resseq,
                            icode,
                            chain_id,
                        )
                        pdb_text_data += s
                        if not preserve_atom_numbering:
                            atom_number += 1
            if chain_residues_written:
                pdb_text_data += (
                        "TER   %5i      %3s %c%4i%c                                                      \n"% (atom_number, resname, chain_id, resseq, icode))
    return pdb_text_data


def load_residue(amino_acid):
    amino_acid = amino_acid.upper()
    res_path = "pdb_process/amino_acid/" + amino_acid + ".pdb"
    res_structure = parser.get_structure("my_structure", res_path)
    residue_change = res_structure[0]["A"][1]
    return residue_change


def load_pdb(path):
    structure = parser.get_structure("my_structure", path)
    return structure


def translate_residue(res_a, res_b, atom):
    res_a_array = []
    res_b_array = []
    for i in res_a:
        res_a_array.append(res_a[i.name].get_coord())
    for j in res_b:
        res_b_array.append(res_b[j.name].get_coord())
    res_a_array = np.array(res_a_array)
    res_b_array = np.array(res_b_array)

    indics = [1, 0, 4]
    pa = res_a_array[indics, :]
    pb = res_b_array[indics, :]
    r, t = align_peptides_by_three_points(pb, pa)
    get_atom = move_peptides(res_b_array, r, t).tolist()

    for number, atom in enumerate(res_b):
        atom.set_coord(get_atom[number])
    return res_b


def change_residue(path,
                   res_chain,
                   res_id,
                   res_name):
    res_id = int(res_id)
    res_chain = res_chain.upper()
    res_name = res_name.upper()
    structure = load_pdb(path)
    changed_residue = load_residue(res_name)

    # 获取chain和residue
    chain = structure[0][res_chain]
    residue = chain[res_id]

    # change atom coord
    changed_residue = translate_residue(residue, changed_residue, "CA")
    chain.detach_child(residue.id)
    changed_residue.id = residue.id
    chain.insert(res_id - 1, changed_residue)
    pdb_data = save_pdb(structure)
    return pdb_data


def return_coord(tmp):
    tmp = tmp.split("\n")
    atom_before = []
    atom_after = []
    action = 0
    for i in tmp:
        if i.startswith("ANISOU"):
            continue
        elif i.startswith("HETATM"):
            continue
        elif i.startswith("TER"):
            continue
        elif not i.startswith("ATOM"):
            if action == 0:
                atom_before.append(i)
            elif action == 1:
                atom_after.append(i)
        elif i.startswith("ATOM"):
            action = 1
    return atom_before, atom_after


if __name__ == '__main__':
    atom_data = change_residue("../1dfb.pdb", "H", "184", "ALA")
    pdb_header, pdb_end = change_residue_p("../1dfb.pdb")
    pdb_text = pdb_header + atom_data + pdb_end
    with open("ttt.pdb", "w") as fw:
        fw.write(pdb_text)
