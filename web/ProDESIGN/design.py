import time

import torch
from ProDESIGN.common.protein import from_pdb_string
from ProDESIGN.common import residue_constants
from config import args
from ProDESIGN.data.dataset import select_residue
from ProDESIGN.model import ProDesign
import numpy as np
from copy import deepcopy


def get_identity(a, b):
    assert len(a) == len(b)
    identity = sum(a[i] == b[i] for i in range(len(a))) / len(a)
    return identity


def get_feature(pdb_file, chain_id=None, device='cpu'):
    '''
     for design
    '''
    with open(pdb_file, 'r') as f:
        pdb_str = f.read()
    protein = from_pdb_string(pdb_str, chain_id)
    seq = torch.tensor(protein.aatype, dtype=torch.int64).to(device)
    coord = torch.from_numpy(protein.atom_positions).to(device)
    coord_mask = torch.from_numpy(protein.atom_mask).to(device)
    ret = dict(seq=seq, str_seq=protein.str_aatype, coord=coord, coord_mask=coord_mask)
    return ret


def update_feature(ret, is_begin=False):
    if is_begin:
        random_seq = torch.tensor([np.random.randint(20) for _ in range(ret['seq'].size(0))], dtype=torch.int64,
                                  device=ret['seq'].device)
        seq_mask = torch.zeros(ret['seq'].size(0), device=ret['seq'].device)
        seq_mask[fixed] = 1
        random_seq = torch.where(seq_mask == 1, ret['seq'], random_seq)
        ret['seq'] = random_seq
        # if fixed
    idx = None
    while idx is None or idx in fixed:
        ret = select_residue(ret)
        idx = ret['select_idx']
    # else
    # ret = select_residue(ret)

    ret['nei_feature'] = ret['nei_feature'].unsqueeze(0).float()
    ret['nei_mask'] = ret['nei_mask'].unsqueeze(0)
    return ret


def from_aatype_to_strtype(seq):
    restype_idx = ''
    for idx in seq:
        restype_idx = restype_idx + (residue_constants.restypes_with_x[idx])
    return restype_idx


def str_to_fasta(fasta_str, des):
    with open(f'fasta/{des}.fasta', 'w') as f:
        f.write(fasta_str)


def main(pdb_file):
    default_ret = get_feature(pdb_file, device=args.device)
    default_seq = from_aatype_to_strtype(default_ret['seq'])
    print('True seq:\n', default_seq)
    # str_to_fasta(ret['str_seq'],f'4eul')

    model = ProDesign(dim=args.dim, device=args.device)
    model.load_state_dict(torch.load(f'{args.save_file}.pt', map_location=torch.device('cpu')))

    fasta_str = ''
    model.eval()
    with torch.no_grad():
        for i in range(num):
            ret = update_feature(deepcopy(default_ret), is_begin=True)

            assert ret != default_ret

            # str_to_fasta(from_aatype_to_strtype(ret['seq']),f'num{i}_init')
            # init_seq=from_aatype_to_strtype(ret['seq'])
            # print('Init seq:\n',init_seq)
            # print('identity',get_identity(default_seq,init_seq))

            for step in range(total_step):
                preds = model(ret)
                res = preds.argmax(-1)[0].item()
                # res=torch.multinomial(torch.softmax(preds,-1),1).item()
                idx = ret['select_idx']
                # if (ret['seq'][idx]).item()!=res:
                #    print('index %d change from %s to %s'%(idx,(ret['seq'][idx]).item(),res))
                ret['seq'][idx] = res
                update_feature(ret)
                if (step + 1) % save_step == 0:
                    str_seq = from_aatype_to_strtype(ret['seq'])
                    identity = get_identity(default_seq, str_seq)
                    fasta_str += f'> {pdb_file} {args.save_file}_num{i}_step{step + 1} identity:{identity}\n{str_seq}\n'
                    print(f'num {i} step {step + 1} identity {identity}\n', str_seq)

    str_to_fasta(fasta_str, f'{pdb_file} {args.save_file}_{num}_{info}')


if __name__ == '__main__':
    num = 1
    total_step = 10
    save_step = 10
    pdb_file = "1cbs.pdb"
    info = '6A'
    # fixed=[38, 40, 42, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 80, 84, 88, 90, 91, 92, 104, 105, 106, 108, 115, 116, 117, 119, 120, 141, 177, 179, 180, 181, 216, 218]
    # fixed = [i for i in range(136)]
    fixed = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30,
             31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
             58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84,
             85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108,
             109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
             130, 131, 132, 133, 134, 135]
    # fixed = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132]
    start = time.time()
    main(pdb_file)
    end = time.time()
    print(end - start)

