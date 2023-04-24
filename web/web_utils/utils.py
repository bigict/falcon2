import os

def serving_dir():
    return os.path.join(
            '/home/ysbgs/prodesignv1/web/',
            'serving')

def serving_log(job_id):
    p = os.path.join(
            serving_dir(), 'logs')
    os.makedirs(p, exist_ok=True)
    return os.path.join(p, f'{job_id}.log')

def serving_data(job_id):
    p = os.path.join(
            serving_dir(), 'data', job_id) # 创建文件目录
    os.makedirs(p, exist_ok=True)
    return p

def serving_pdb(job_id,prefix=''): #保存pdb文件的函数
    return os.path.join(
            serving_data(job_id), f'{prefix}.pdb')

def del_pdb(job_id,prefix=''):
    return os.remove(os.path.join(
            serving_data(job_id), f'{prefix}.pdb'))

'''
'os.environ.get('ProDesgin_HOME', '.')'
/home/ysbgs/prodesignv1/web/serving
def serving_pdb(job_id, task_id, prefix=''): #保存pdb文件的函数
    return os.path.join(
            serving_data(job_id), f'{prefix}{task_id}.pdb')

def serving_svg(job_id, task_id, prefix=''):
    return os.path.join(
            serving_data(job_id), f'{prefix}{task_id}.svg')

def serving_meta(job_id, task_id, prefix=''):
    return os.path.join(
            serving_data(job_id), f'{prefix}{task_id}.log')
'''