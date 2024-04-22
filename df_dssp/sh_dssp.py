# from tools.df_times import create_timestamp
import subprocess


import datetime

def create_timestamp():
    current_time = datetime.datetime.now()
    time_stamp = current_time.timestamp()
    time_stamp = str(time_stamp).replace('.', '-')
    return time_stamp


def mk_dssp(text):
    # 生成一个pdb文件
    timestamp = create_timestamp()
    name = f"data/{timestamp}"
    with open(name+'.pdb', 'w', encoding='utf-8') as fw:
        fw.writelines(text)
    command = f'mkdssp --output-format mmcif {name}.pdb {name}.cif'
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    print(result.stdout)


if __name__ == '__main__':
    with open('data/7fjc.pdb', 'r', encoding='utf-8') as fr:
        data = fr.readlines()
    mk_dssp(data)