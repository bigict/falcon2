"""task db module
"""
import os
import json
import logging

from mysql.connector import (connection, Error)
import shortuuid

from profold2.data.parsers import parse_fasta
from web.utils import serving_data, serving_log

# pylint: disable=line-too-long,pointless-string-statement
"""
+-------------+------------------+------+-----+-------------------+----------------+
| Field       | Type             | Null | Key | Default           | Extra          |
+-------------+------------------+------+-----+-------------------+----------------+
| id          | int(10) unsigned | NO   | PRI | NULL              | auto_increment |
| job_id      | varchar(20)      | NO   | UNI | NULL              |                |
| app         | varchar(64)      | NO   |     | NULL              |                |
| email       | varchar(128)     | NO   |     | NULL              |                |
| inputs      | text             | NO   |     | NULL              |                |
| status      | varchar(10)      | NO   |     | NULL              |                |
| time_create | datetime         | YES  |     | CURRENT_TIMESTAMP |                |
| time_run    | datetime         | YES  |     | NULL              |                |
| time_done   | datetime         | YES  |     | NULL              |                |
| ip          | varchar(20)      | NO   |     | NULL              |                |
+-------------+------------------+------+-----+-------------------+----------------+

+-------------+------------------+------+-----+-------------------+----------------+
| Field       | Type             | Null | Key | Default           | Extra          |
+-------------+------------------+------+-----+-------------------+----------------+
| id          | int(10) unsigned | NO   | PRI | NULL              | auto_increment |
| description | varchar(1024)    | NO   |     | NULL              |                |
| content     | text             | NO   |     | NULL              |                |
| status      | varchar(10)      | NO   |     | NULL              |                |
| time_create | datetime         | YES  |     | CURRENT_TIMESTAMP |                |
| time_run    | datetime         | YES  |     | NULL              |                |
| time_done   | datetime         | YES  |     | NULL              |                |
| job_id      | varchar(20)      | NO   | MUL | NULL              |                |
+-------------+------------------+------+-----+-------------------+----------------+
"""
# pylint: enable=line-too-long,pointless-string-statement

logger = logging.getLogger(__file__)

STATUS_RUNNING = 'Running'
STATUS_QUEUING = 'Queuing'
STATUS_DONE = 'Done'
STATUS_ERROR = 'Error'

APP_LIST = {'profold2': 'ProFOLD-single', 'prodesign': 'ProDESIGN-LEFT', 'proaffinity': 'ProAffinity'}
_cnx = None

def _task_preprocess_fasta(job_id, content, params):
  if params:
    with open(os.path.join(serving_data(job_id), f'input.params'), 'w') as f:
      f.write(json.dumps(params))

  sequences, descriptions = parse_fasta(content)
  assert len(sequences) >= 1 and len(sequences) == len(descriptions)
  for i, (sequence, description) in enumerate(zip(sequences, descriptions)):
    with open(os.path.join(serving_data(job_id), f'input_{i}.task'), 'w') as f:
      f.write(f'>{description}\n')
      f.write(sequence)
    params.append((description, STATUS_QUEUING, job_id, i))
  return params

def _task_preprocess_pdb(job_id, content, params):
  if params:
    with open(os.path.join(serving_data(job_id), f'input.params'), 'w') as f:
      f.write(json.dumps(params))

  with open(os.path.join(serving_data(job_id), f'input_0.task'), 'w') as f:
    f.write(content)
  params = [('pdb', STATUS_QUEUING, job_id, 0)]
  return params

def _task_postprocess(task):
  if task and task['metrics']:
    task['metrics'] = json.loads(task['metrics'])
  job_id, task_id = task['job_id'], task['task_id']
  with open(os.path.join(serving_data(job_id), f'input_{task_id}.task')) as f:
    task['content'] = f.read()
  return task

APP_TASK_PREPROCESS = {'profold2': _task_postprocess, 'prodesign': _task_preprocess_pdb, 'proaffinity': _task_preprocess_pdb}

def db_get():
  # global _cnx
  # try:
  #   if _cnx:
  #     _cnx.ping(reconnect=True)
  #   else:
  #     raise Exception('Connect to database')
  # except Exception as e:  # pylint: disable=broad-except
  #   del e
  #   _cnx = connection.MySQLConnection(user='protein', password='folding',
  #                              host='127.0.0.1',
  #                              database='protein',
  #                              autocommit=False)
  # return _cnx
  return connection.MySQLConnection(user='protein', password='folding',
                                    host='127.0.0.1',
                                    database='protein',
                                    autocommit=False)

def app_list():
  return [dict(id=key, name=value) for key, value in APP_LIST.items()]

def app_get(app_id):
  return dict(id=app_id,
            name=APP_LIST.get(app_id, 'Unknown'))

def job_status(app_id):
  cnx = db_get()

  query = 'select status,count(*) as c from jobs where app=%s group by status'  # pylint: disable=line-too-long
  with cnx.cursor() as cursor:
    cursor.execute(query, (app_id,))
    for status, c in cursor:
      yield status, c

def job_get(with_tasks=True, logic_op='and', **kwargs):
  cnx = db_get()

  cond = f' {logic_op} '.join(f'{c}=%s' for c in kwargs)
  query = f'select job_id,app,email,status,time_create,time_run,time_done from jobs where {cond}'  # pylint: disable=line-too-long
  with cnx.cursor(dictionary=True) as cursor:
    cursor.execute(query, tuple(kwargs.values()))
    job_list = cursor.fetchall()
  if job_list:
    for job in job_list:
      job_id = job['job_id']
      if with_tasks:
        query = 'select * from tasks where job_id=%s'
        with cnx.cursor(dictionary=True) as cursor:
          cursor.execute(query, (job_id,))
          job['tasks'] = list(map(_task_postprocess,
                  cursor.fetchall()))
      with open(os.path.join(serving_data(job_id), 'input.job'), 'r') as f:
        job['inputs'] = f.read()
      log_file = serving_log(job_id)
      if os.path.exists(log_file):
        with open(log_file, 'r') as f:
          job['logs'] = f.read()
  if job_list and 'job_id' in kwargs and logic_op == 'and':
    assert len(job_list) == 1
    return job_list[0]
  return job_list

def task_get(job_id, task_id, **kwargs):
  del kwargs
  cnx = db_get()

  query = 'select * from tasks where job_id=%s and id=%s'
  with cnx.cursor(dictionary=True) as cursor:
    cursor.execute(query, (job_id, task_id))
    return _task_postprocess(cursor.fetchone())

def job_set(job_id, task_id=None, **kwargs):
  cnx = db_get()

  params = ','.join([f'{c}=%s' for c in kwargs])
  cond = (job_id,)
  if task_id is None:
    query = f'update jobs set {params} where job_id=%s'
  else:
    query = f'update tasks set {params} where job_id=%s and id=%s'
    cond += (task_id,)
  logger.debug('[db.job_set] query=%s, args=%s', query, kwargs)

  if not cnx.in_transaction:
    # cnx.start_transaction(isolation_level='READ COMMITTED')
    cnx.start_transaction()
  with cnx.cursor(dictionary=True) as cursor:
    cursor.execute(query, tuple(kwargs.values()) + cond)
  cnx.commit()

  return job_id, task_id

def job_new(app, content, params, job_id=None, email=None):
  cnx = db_get()

  try:
    query = 'insert into jobs (`job_id`,`app`,`email`,`status`,`ip`) values (%s,%s,%s,%s,%s)'  # pylint: disable=line-too-long
    if not job_id:
      job_id = shortuuid.uuid()[:10]
    if email is None:
      email = ''
    if not cnx.in_transaction:
      # cnx.start_transaction(isolation_level='READ COMMITTED')
      cnx.start_transaction()
    with cnx.cursor() as cursor:
      cursor.execute(query, (job_id, app, email, STATUS_QUEUING, ''))
      with open(os.path.join(serving_data(job_id), 'input.job'), 'w') as f:
        f.write(content)

      query = 'insert into tasks (`description`,`status`,`job_id`,`task_id`) values (%s,%s,%s,%s)'  # pylint: disable=line-too-long
      params = APP_TASK_PREPROCESS[app](job_id, content, params)
      cursor.executemany(query, params)

    cnx.commit()

    logger.info('job_new: commit app=%s, job_id=%s, email=%s',
                app, job_id, email)
  except Error as e:
    logger.error('job_new: rollback app=%s, job_id=%s, email=%s, error=%s',
                 app, job_id, email, e)
    cnx.rollback()
    raise e

  return job_id

if __name__ == '__main__':
  print(job_get(job_id='LVsZ3ZvHay'))
  print(job_set(job_id='LVsZ3ZvHay', status=STATUS_RUNNING))
  print(job_get(job_id='LVsZ3ZvHay'))
  print(job_set(job_id='LVsZ3ZvHay', status=STATUS_QUEUING))
  print(job_get(job_id='LVsZ3ZvHay'))
