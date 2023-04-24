import os
import sys
import argparse
import base64
import contextlib
from datetime import datetime
import functools
import io
import json
from urllib.parse import urlparse
import time
import logging

import matplotlib.pyplot as plt
import torch
import requests

from web import db
from web.utils import (serving_data,
        serving_log,
        serving_meta,
        serving_pdb,
        serving_svg)
import relaxer

logger = logging.getLogger(__file__)

def to_log_file(text, f=sys.stdout):
    print(text, file=f, flush=True)

def to_fasta_str(description, sequence):
    return f'>{description}\n{sequence}'

@contextlib.contextmanager
def timing(msg, log_func, prefix=''):
    log_func(f'{prefix}Started {msg}')
    tic = time.time()
    yield
    toc = time.time()
    log_func(f'{prefix}Finished {msg} in {(toc-tic):>.3f} seconds')


def do_task(task, uri, args, log_func=print):
    db.job_set(job_id=task['job_id'], task_id=task['id'], status=db.STATUS_RUNNING, time_run=datetime.now())

    headers = {'Content-Type': 'plain/text'}
    fasta_str = to_fasta_str(task['description'], task['sequence'])#description参数内容？

    logger.info('Request: %s@%s begin', task['job_id'], task['id'])# 日志输出组件
    with timing(f'requesting serving', log_func, prefix='   '):
        r = requests.post(uri, data=fasta_str)#向服务器提交数据
    logger.info('Request: %s@%s end (%s)', task['job_id'], task['id'], r.status_code)
    if r.status_code != 200: # 报错
        logger.error('Request: %s@%s error: %s', task['job_id'], task['id'], r.status_code)
        db.job_set(job_id=task['job_id'], task_id=task['id'], status=db.STATUS_ERROR, time_done=datetime.now())
        return False

    results = r.json() # result
    assert 'pdb' in results and 'headers' in results
    assert 1 == len(results['pdb'])# assert断言
    assert 1 == len(results['headers'])
    pdb, header = results['pdb'][0], results['headers'][0]
    metrics = {}

    with io.BytesIO(base64.b64decode(header)) as f:
        header = torch.load(f, map_location='cpu')

    with open(serving_meta(task['job_id'], task['id']), 'w') as log:
        print('======================', file=log)
        print(fasta_str, file=log)

        if 'confidence' in header:
          if 'loss' in header['confidence']:
            plddt = header['confidence']['loss'].tolist()
            metrics['pLDDT'] = plddt
            print('-------------', file=log)
            print(f'pLDDT: {plddt}', file=log)
          if 'plddt' in header['confidence']:
            print(header['confidence']['plddt'], file=log)

        if 'distogram' in header:
            logits = torch.squeeze(header['distogram']['logits'])
            logits = torch.argmax(logits, dim=-1)
            plt.matshow(-logits)
            # plt.tight_layout()
            with io.BytesIO() as f:
              plt.savefig(f, format='svg', dpi=100)
              t = io.TextIOWrapper(io.BytesIO(f.getvalue()))
            plt.close()

            svg = t.read()
            print('-------------', file=log)
            print(svg, file=log)
            if args.dump_contact:
                with open(serving_svg(task['job_id'], task['id']), 'w') as f:
                    f.write(svg)

        print('-------------', file=log)
        print(f'{pdb}', file=log)
        if args.dump_pdb:
            with open(serving_pdb(task['job_id'], task['id']), 'w') as f:
                f.write(pdb)
            if args.run_relaxer:
                c = argparse.Namespace(
                        use_gpu_relax=args.use_gpu_relax,
                        pdb_files=[serving_pdb(task['job_id'], task['id'])],
                        output=serving_data(task['job_id']),
                        prefix='relax_')
                retry = 0
                while retry < args.relax_retry:
                    try:
                        with timing(f'relaxing pdb', log_func, prefix='   '):
                            relaxer.main(c)
                        break
                    except Exception as e:
                        print('', file=log)
                    retry += 1
                if retry >= args.relax_retry:
                    db.job_set(job_id=task['job_id'], task_id=task['id'], status=db.STATUS_ERROR, time_done=datetime.now())
                    return False

    db.job_set(job_id=task['job_id'], task_id=task['id'],
            metrics=json.dumps(metrics),
            status=db.STATUS_DONE, time_done=datetime.now())
    return True


def do_job(job, uri, args):
    with open(serving_log(job['job_id']), 'w') as f:
        log_func = functools.partial(to_log_file, f=f)

        db.job_set(job_id=job['job_id'], status=db.STATUS_RUNNING, time_run=datetime.now())
        with timing('job', log_func=log_func):
            n = 0
            for task in job['tasks']:
                if args.skip_task_done and task['status'] == db.STATUS_DONE:
                    n += 1
                    continue

                with timing(f'task: `>{task["description"]}`', log_func=log_func):
                    if do_task(task, uri, args, log_func=log_func):
                        log_func(f'Run task: `>{task["description"]}` succeed.')
                        n += 1
                    else:
                        log_func(f'Run task: `>{task["description"]}` failed.')
            if n == len(job['tasks']):
                db.job_set(job_id=job['job_id'], status=db.STATUS_DONE, time_done=datetime.now())
                log_func('Job has done ...')
            else:
                db.job_set(job_id=job['job_id'], status=db.STATUS_ERROR, time_done=datetime.now())
                log_func('Job has done with errors ...')

def run_jobs(args):
    o = urlparse(args.uri)
    app = o.scheme

    o = o._replace(scheme='http')
    uri = o.geturl()

    if args.job_list:
        job_list = [db.job_get(app=app, job_id=job_id) for job_id in args.job_list]
    else:
        job_list = db.job_get(app=app, status=db.STATUS_QUEUING)
    for job in job_list:
        do_job(job, uri, args)

def list_jobs(args):
    kwargs = dict(map(lambda x: x.split('=', 1), args.job_kwargs))
    job_list = db.job_get(with_tasks=False, logic_op=args.logic_op, **kwargs)
    for job in job_list:
        print(f'{job["app"]}\t{job["job_id"]}\t{job["status"]}')

'''
def main(args):
    logger.info(args)#日志

    o = urlparse(args.uri)#将url分为6个部分，返回一个包含6个字符串项目的元组：协议、位置、路径、参数、查询、片段。
    app = o.scheme# 协议

    o = o._replace(scheme='http')
    uri = o.geturl() # ？？？
    if args.job_list:
        job_list = [db.job_get(app=app, job_id=job_id) for job_id in args.job_list]
    else:
        job_list = db.job_get(app=app, status=db.STATUS_QUEUING)
    for job in job_list:
        do_job(job, uri, args)

'''
def main(args):
    logger.info(args)# 日志
    if args.cmd == 'run': #args.cmd是什么？？
        run_jobs(args) #这个是原代码的部分
    elif args.cmd == 'list': 
        list_jobs(args)

# 主要是上面这行的，下面这个是代码入口吧，调用关系是什么样子的呢
if __name__ == '__main__':
    parser = argparse.ArgumentParser() # 创建一个参数解析实例,命令行参数解析
    parser.add_argument('job_list', type=str, nargs='*',help='job list') # 调用 add_argument() 方法添加参数
    parser.add_argument('--uri', type=str, default='profold0://127.0.0.1:8080/predictions/profold0_0', help='uri')# 这行怎么改？
    parser.add_argument('--dump_pdb', action='store_true', help='dump pdb files')
    parser.add_argument('--dump_contact', action='store_true', help='dump contact images')
    parser.add_argument('--run_relaxer', action='store_true', help='dump relaxed pdb files')
    parser.add_argument('--use_gpu_relax', action='store_true', help='run relax on gpu')
    parser.add_argument('--relax_retry', type=int, default=2, help='try to run relax `n` times')
    parser.add_argument('--skip_task_done', action='store_true', help='skip tasks done')
    parser.add_argument('-v', '--verbose', action='store_true', help='verbose')
    args = parser.parse_args() # 使用 parse_args() 解析添加的参数

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO)

    main(args)

# argparse 是 Python 内置的一个用于命令项选项与参数解析的模块，通过在程序中定义好我们需要的参数，argparse 将会从 sys.argv 中解析出这些参数，
# 并自动生成帮助和使用信息。当然，Python 也有第三方的库可用于命令行解析，而且功能也更加强大，比如 docopt，Click。
