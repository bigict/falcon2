from Bio.PDB.MMCIFParser import MMCIFParser
from Bio.PDB.MMCIF2Dict import MMCIF2Dict

def extract_secondary_structure_from_cif(cif_file):
    # 使用MMCIFParser解析CIF文件
    parser = MMCIFParser()
    structure = parser.get_structure("structure", cif_file)

    # 使用MMCIF2Dict直接从CIF文件读取字典
    mmcif_dict = MMCIF2Dict(cif_file)

    secondary_structure = {
        'helices': [],
        'sheets': []
    }

    # 提取α-螺旋信息
    if '_struct_conf.conf_type_id' in mmcif_dict:
        helix_types = mmcif_dict['_struct_conf.conf_type_id']
        helix_starts = mmcif_dict['_struct_conf.beg_label_seq_id']
        helix_ends = mmcif_dict['_struct_conf.end_label_seq_id']
        helix_chain = mmcif_dict['_struct_conf.beg_label_asym_id']
        for i, helix_type in enumerate(helix_types):
            if helix_type.strip().startswith('HELX'):
                secondary_structure['helices'].append({
                    'type': helix_type.strip(),
                    'chain': helix_chain[i],
                    'start': helix_starts[i],
                    'end': helix_ends[i]
                })

    # 提取β-折叠信息
    if '_struct_sheet_range.sheet_id' in mmcif_dict:
        sheet_starts = mmcif_dict['_struct_sheet_range.beg_label_seq_id']
        sheet_ends = mmcif_dict['_struct_sheet_range.end_label_seq_id']
        sheet_chain = mmcif_dict['_struct_sheet_range.beg_label_asym_id']
        for i in range(len(sheet_starts)):
            secondary_structure['sheets'].append({
                'chain': sheet_chain[i],
                'start': sheet_starts[i],
                'end': sheet_ends[i]
            })

    return secondary_structure

if __name__ == '__main__':
    # 指定你的CIF文件路径
    cif_file_path = 'data/1711099216-808675.cif'
    secondary_structure_info = extract_secondary_structure_from_cif(cif_file_path)
    # print(secondary_structure_info)
    for i in secondary_structure_info['sheets']:
        print(i)