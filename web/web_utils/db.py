import os
import json
import logging
from mysql.connector import (connection, Error)
import shortuuid
#from .utils import serving_log
from .utils import serving_log


'''
jobs:
+-------------+------------------+------+-----+-------------------+----------------+
| Field       | Type             | Null | Key | Default           | Extra          |
+-------------+------------------+------+-----+-------------------+----------------+
| id          | int(10) unsigned | NO   | PRI | NULL              | auto_increment |
| job_id      | varchar(20)      | NO   | UNI | NULL              |                |
| sequences   | text             | YES  |     | NULL              |                |
| status      | varchar(10)      | NO   | MUL | NULL              |                |
| time_create | datetime         | YES  |     | CURRENT_TIMESTAMP |                |
| time_run    | datetime         | YES  |     | NULL              |                |
| time_done   | datetime         | YES  |     | NULL              |                |
+-------------+------------------+------+-----+-------------------+----------------+
tasks:
+-------------+------------------+------+-----+-------------------+----------------+
| Field       | Type             | Null | Key | Default           | Extra          |
+-------------+------------------+------+-----+-------------------+----------------+
| id          | int(10) unsigned | NO   | PRI | NULL              | auto_increment |
| job_id      | varchar(20)      | NO   | MUL | NULL              |                |
| descripton  | varchar(1024)    | NO   |     | NULL              |                |
| sequence    | varchar(4096)    | NO   |     | NULL              |                |
| status      | varchar(10)      | NO   |     | NULL              |                |
| metrics     | varchar(1024)    | YES  |     | NULL              |                |
| time_create | datetime         | YES  |     | CURRENT_TIMESTAMP |                |
| time_run    | datetime         | YES  |     | NULL              |                |
| time_done   | datetime         | YES  |     | NULL              |                |
+-------------+------------------+------+-----+-------------------+----------------+
'''

logger = logging.getLogger(__file__)

STATUS_RUNNING = 'Running'
STATUS_QUEUING = 'Queuing'
STATUS_DONE = 'Done'
STATUS_ERROR = 'Error'

cnx = connection.MySQLConnection(user='protein', password='folding',
                                 host='127.0.0.1',
                                 database='prodesign_vr_db',
                                 autocommit=False)


def job_new(job_id=None, email=None):
    cnx.ping(reconnect=True)
    try:
        query = 'insert into jobs (`job_id`,`status`,`email`) values (%s,%s,%s)'
        if not job_id:
            job_id = shortuuid.uuid()[:10]
        if email is None:
            email = ''
        
        with cnx.cursor() as mycursor:
            mycursor.execute(query, (job_id,STATUS_QUEUING,email))
        cnx.commit()
        logger.info('job_new: commit job_id=%s, email=%s', job_id, email)
    except Error as e:
        logger.error('job_new: rollback job_id=%s, email=%s, error=%s', job_id, email, e)
        cnx.rollback()
        raise e
    return job_id


def job_status():
    cnx.ping(reconnect=True)

    query = 'select status,count(*) as c from jobs group by status'
    with cnx.cursor() as mycursor:
        mycursor.execute(query)
        for status, cnt in mycursor:
            yield status, cnt

def task_status():
    cnx.ping(reconnect=True)

    query = 'select status,count(*) as c from tasks group by status'
    with cnx.cursor() as mycursor:
        mycursor.execute(query)
        for status, cnt in mycursor:
            yield status, cnt


def job_get(with_tasks=False,logic_op='and',**kwargs):
    cnx.ping(reconnect=True)

    cond = f' {logic_op} '.join(f'{c}=%s' for c in kwargs.keys())
    query = f'select job_id,sequences,status,time_create,time_run,time_done from jobs where {cond}'
    with cnx.cursor(dictionary=True) as cursor:
        cursor.execute(query, tuple(kwargs.values()))
        job_list = cursor.fetchall()
    if job_list:
        '''
        for job in job_list:
            job_id = job['job_id']
            if with_tasks:
                query = 'select * from tasks where job_id=%s'
                with cnx.cursor(dictionary=True) as cursor:
                    cursor.execute(query, (job_id,))
                    job['tasks'] = list(map(_task_post_process, cursor.fetchall()))
            log_file = serving_log(job_id)
            if os.path.exists(log_file):
                with open(log_file, 'r') as f:
                    job['logs'] = f.read()
    '''
    if job_list and 'job_id' in kwargs and logic_op == 'and':
        assert len(job_list) == 1
        return job_list[0]
    return job_list

def task_get(**kwargs): #job_id, task_id, **kwargs
    cnx.ping(reconnect=True)
    cond = ' and '.join(f'{c}=%s' for c in kwargs.keys())
    query = f'select job_id,sequences,status,time_create,time_run,time_done from tasks where {cond}'
    #query = 'select * from tasks where job_id=%s' #select * from tasks where job_id=%s and id=%s
    with cnx.cursor(dictionary=True) as cursor:
        cursor.execute(query, tuple(kwargs.values()))
        #cursor.execute(query, job_id)
        task_list = cursor.fetchall() 
    if task_list and 'job_id' in kwargs:
        assert len(task_list) == 1
        return task_list[0]
    return task_list

#待修改
def task_get1(job_id,**kwargs): #job_id, task_id, **kwargs
    cnx.ping(reconnect=True)
    print(job_id)
    cond = ' and '.join(f'{c}=%s' for c in kwargs.keys())
    query = 'select * from tasks where job_id=%s' #select * from tasks where job_id=%s and id=%s
    with cnx.cursor(dictionary=True) as cursor:
        cursor.execute(query, (job_id,))
        task_list = cursor.fetchall()
        '''
    if task_list and 'job_id' in kwargs and logic_op == 'and':
        assert len(job_list) == 1
        return job_list[0]
        '''
    
    if task_list and 'job_id' in kwargs:
        assert len(task_list) == 1
        return task_list[0]
    return task_list

def job_set(job_id, task_id=None, **kwargs): 
    cnx.ping(reconnect=True)

    params = ','.join([f'{c}=%s' for c in kwargs.keys()])
    cond = (job_id,)
    if task_id is None:
        query = f'update jobs set {params} where job_id=%s'
    else:
        query = f'update tasks set {params} where job_id=%s and id=%s'
        cond += (task_id,)
    logger.debug('[db.job_set] query=%s, args=%s', query, kwargs)

    with cnx.cursor(dictionary=True) as cursor:
        cursor.execute(query, tuple(kwargs.values()) + cond)
    cnx.commit()

    return job_id, task_id

def get_pdb():
    cnx.ping(reconnect=True)

    query = 'select * from jobs where status="Queuing"'
    with cnx.cursor(dictionary=True,buffered=True) as mycursor:
        mycursor.execute(query)
        records=mycursor.fetchall()
        return records

def get_seq():
    cnx.ping(reconnect=True)

    query='select * from tasks where status="Queuing"'
    with cnx.cursor(dictionary=True,buffered=True) as mycursor:
        mycursor.execute(query)
        records=mycursor.fetchall()
        return records

def task_set(id,**kwargs): 
    cnx.ping(reconnect=True)

    params = ','.join([f'{c}=%s' for c in kwargs.keys()])
    cond = (id,)
    query = f'update tasks set {params} where id=%s'

    with cnx.cursor(dictionary=True) as cursor:
        cursor.execute(query, tuple(kwargs.values()) + cond)
    cnx.commit()

    return id



def task_new(job_id,sequence,email):
    cnx.ping(reconnect=True)

    query = 'insert into tasks (job_id,status,sequences,email) values (%s,%s,%s,%s)'
    with cnx.cursor() as mycursor:
        mycursor.execute(query, (job_id, STATUS_QUEUING,sequence,email))
    cnx.commit()


def _task_post_process(task):
    if task and task['metrics']:
        task['metrics'] = json.loads(task['metrics'])
    return task


if __name__ == '__main__':
    print(job_set(job_id='QWpMdemY9M', status=STATUS_DONE))
    print(job_status())


