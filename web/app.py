"""web entry point
"""
import collections
import os
import io
import zipfile
import re
import sys

from flask import (Flask, jsonify, redirect, request, render_template, send_file)
from dfire.calene import read_lib, calc_energy
from ProDESIGN.fal_sign import falcon2_design
from FFD.ffd_ppl import get_ffd_short
# from web import db, form, utils
from dfprodigy import execute_prodigy

module = os.environ.get('Falcon_MODULE', '')

app = Flask(__name__, static_url_path='')


# icon


@app.route('/search/', methods=['POST'])
def search():
    app_id = request.args.get('app', 'profold2')
    query = form.var_get('job_search', request.form)
    job_list = db.job_get(with_tasks=False,
                          logic_op='or',
                          job_id=query,
                          email=query)
    job_status = dict(db.job_status(app_id))
    return render_template('search.html',
                           module=module,
                           app=db.app_get(app_id),
                           app_list=db.app_list(),
                           job_search=query,
                           job_list=job_list,
                           job_status=job_status)


@app.route('/checking/<job_id>/', methods=['GET'])
def checking(job_id):
    refresh = request.args.get('refresh', 30)
    app_id = request.args.get('app', 'profold2')
    templ = os.path.join(app_id, 'checking.html')

    job = db.job_get(job_id=job_id)
    if not job:
        return redirect(f'{module}/error?app={app_id}&id={job_id}')
    # if job['status'] == 'Done':
    #    return redirect(f'result?app={app}&id={job_id}')

    job_status = dict(db.job_status(app_id))
    return render_template(templ,
                           module=module,
                           refresh=refresh,
                           app=db.app_get(app_id),
                           app_list=db.app_list(),
                           job=job,
                           job_status=job_status)


@app.route('/result/<job_id>/<task_id>/', methods=['GET'])
def result(job_id, task_id):
    app_id = request.args.get('app', 'profold2')
    templ = os.path.join(app_id, 'result.html')

    job_status = dict(db.job_status(app_id))
    return render_template(templ,
                           module=module,
                           app=db.app_get(app_id),
                           app_list=db.app_list(),
                           job=db.job_get(job_id=job_id),
                           task=db.task_get(job_id=job_id, task_id=task_id),
                           job_status=job_status)


@app.route('/resource/<job_id>/<data>/',
           methods=['GET'],
           defaults={'task_id': None})
@app.route('/resource/<job_id>/<task_id>/<data>/', methods=['GET'])
def resource(data, job_id, task_id=None):
    def task_zip(f, task):
        task_id, description, sequence = (task['id'], task['description'],
                                          task['sequence'])
        f.writestr(f'{task_id}.fasta', f'>{description}\n{sequence}')

        # pdb
        p = utils.serving_pdb(job_id, task_id)
        if not os.path.exists(p):
            return redirect(f'{module}/error?app={app_id}')
        f.write(p, arcname=os.path.basename(p))
        # relax_pdb
        p = utils.serving_pdb(job_id, task_id, prefix='relax_')
        if not os.path.exists(p):
            return redirect(f'{module}/error?app={app_id}')
        f.write(p, arcname=os.path.basename(p))
        # svg
        p = utils.serving_svg(job_id, task_id)
        if not os.path.exists(p):
            return redirect(f'{module}/error?app={app_id}')
        f.write(p, arcname=os.path.basename(p))

    app_id = request.args.get('app', 'profold2')
    mimetype = None
    if task_id is None:
        if data == 'zip':
            job = db.job_get(job_id=job_id, app=app_id)
            if not job or 'tasks' not in job or not job['tasks']:
                return redirect(f'{module}/error?app={app_id}')
            with io.BytesIO() as f:
                with zipfile.ZipFile(f, 'w') as obj:
                    for task in job['tasks']:
                        task_zip(obj, task)
                return send_file(io.BytesIO(f.getvalue()),
                                 mimetype='application/zip, application/octet-stream',
                                 as_attachment=True,
                                 attachment_filename=f'{job_id}.zip')
    else:
        if data == 'pdb':
            p = utils.serving_pdb(job_id, task_id)
        elif data == 'relaxed_pdb':
            p = utils.serving_pdb(job_id, task_id, prefix='relax_')
        elif data == 'svg':
            p, mimetype = utils.serving_svg(job_id, task_id), 'image/svg+xml'
        if data == 'fasta':
            p = os.path.join(utils.serving_data(job_id), f'output_{task_id}.fasta')
        elif data == 'zip':
            task = db.task_get(job_id=job_id, task_id=task_id)
            if not task:
                return redirect(f'{module}/error?app={app_id}')
            with io.BytesIO() as f:
                with zipfile.ZipFile(f, 'w') as obj:
                    task_zip(obj, task)
                return send_file(io.BytesIO(f.getvalue()),
                                 mimetype='application/zip, application/octet-stream',
                                 as_attachment=True,
                                 attachment_filename=f'{job_id}_{task_id}.zip')
        else:
            return redirect(f'{module}/error?app={app_id}')

        if os.path.exists(p):
            return send_file(p, mimetype=mimetype, as_attachment=True)

    return redirect(f'{module}/error?app={app_id}')


@app.route('/diff/<exp_name>/', methods=['GET'])
def diff(exp_name):
    diff_list = []
    num_pred = 0

    static_folder = app.static_folder if app.has_static_folder else 'static'
    exp_file = os.path.join(static_folder, f'{exp_name}.diff')
    if os.path.exists(exp_file):
        with open(exp_file, 'r') as f:
            for line in filter(lambda x: len(x) > 0, map(lambda x: x.strip(), f)):
                desc, seq, truth_pdb, truth_svg, pred_list = line.split('\t', 4)
                if desc.startswith('>'):
                    desc = desc[1:]
                pid = desc.split()[0]
                pred_list = pred_list.split('\t')
                assert len(pred_list) % 3 == 0
                pred_list = [
                    dict(desc=pred_list[3 * i],
                         pred_pdb=pred_list[2 * i + 1],
                         pred_svg=pred_list[2 * i + 2])
                    for i in range(len(pred_list) // 3)
                ]
                if num_pred == 0:
                    num_pred = len(pred_list)
                assert len(pred_list) == num_pred
                diff_list.append(
                    dict(pid=pid,
                         desc=desc,
                         seq=seq,
                         pred_list=pred_list,
                         truth_pdb=truth_pdb,
                         truth_svg=truth_svg))

    return render_template('diff.html',
                           module=module,
                           exp_name=exp_name,
                           num_pred=num_pred,
                           diff_list=diff_list)


@app.route('/error/', methods=['GET'])
def error():
    app_id = request.args.get('app', 'profold2')
    job_status = dict(db.job_status(app_id))
    return render_template('error.html',
                           module=module,
                           app=db.app_get(app_id),
                           job_status=job_status)


@app.route('/', defaults={'job_id': None}, methods=['GET', 'POST'])
@app.route('/index/', defaults={'job_id': None}, methods=['GET', 'POST'])
@app.route('/submit/<job_id>/', methods=['GET', 'POST'])
def submit(job_id):
    app_id = request.args.get('app', 'profold2')
    templ = os.path.join(app_id, 'index.html')

    job_status = dict(db.job_status(app_id))
    if request.method == 'GET':
        if job_id:
            job = db.job_get(with_tasks=False, job_id=job_id, app=app_id)
            del job['job_id']
        else:
            job = None
        return render_template(templ,
                               module=module,
                               args=job,
                               app=db.app_get(app_id),
                               app_list=db.app_list(),
                               job_status=job_status)
    elif request.method == 'POST':
        errors = form.validate(request.values, request.files)
        if errors:
            return render_template(templ,
                                   module=module,
                                   args=request.values,
                                   app=db.app_get(app_id),
                                   app_list=db.app_list(),
                                   job_status=job_status,
                                   errors=errors)
        job_id = db.job_new(app_id,
                            form.var_get(('sequences', 'sequence_file'),
                                         request.values,
                                         files=request.files),
                            form.var_match('job_params_(.*)',
                                           request.values,
                                           files=request.files),
                            job_id=form.var_get('job_id', request.values),
                            email=form.var_get('email', request.values))
        return redirect(f'{module}/checking/{job_id}/?app={app_id}')


@app.route("/ffd/", methods=["GET", "POST"])
def ffd():
    pdb_content = request.values.get("pdb_file")
    pdb_position = request.values.get("pdb_position")

    outdir = "output"
    n_structs = 1
    pool_size = -1
    device = 0
    snapshot = 0

    result = get_ffd_short(pdb_content, pdb_position, outdir, n_structs, pool_size, device, snapshot)
    result = {"result": result}
    return jsonify(result)


edfire, ATOM_TYPE = read_lib()
PDB_FILE_CHANGE = ""
RESULT_CHANGE = 0
prodigy_CHANGE = 0


@app.route("/dfire", methods=["GET", "POST"])
def dDfire():
    global PDB_FILE_CHANGE
    global RESULT_CHANGE
    global prodigy_CHANGE
    PDB_FILE = request.values.get("pdb_file")
    pdb_position = request.values.get("pdb_position")

    # pdb_files_list = request.values.get("pdb_files")
    pdb_file_name = 'protein_db/protein_prodigy.pdb'

    # if len(pdb_files_list) > 1:
    #     # 合并两个蛋白质文件为一个蛋白质文件
    #     pass
    # else:
    # pdb_file = pdb_files_list[0]

    # ba_result = {}

    if PDB_FILE_CHANGE == PDB_FILE:
        result_score = RESULT_CHANGE
        binding_affinity = prodigy_CHANGE
    else:
        # 将pdb转化为CA
        PDB_FILE_CHANGE = PDB_FILE
        pdb_dt = PDB_FILE.split("\n")
        pdb_data = []
        for res in pdb_dt:
            if res.startswith("ATOM"):
                line = res.split()
                if line[2] == "CA":
                    pdb_data.append(res)

        result_score = calc_energy(edfire, ATOM_TYPE, fp=pdb_data)
        result_score = "{:.3f}".format(result_score)
        RESULT_CHANGE = result_score

        with open(pdb_file_name, 'w') as fw:
            fw.writelines(PDB_FILE)
        binding_affinity = execute_prodigy(pdb_file_name)
        prodigy_CHANGE = binding_affinity
    result = {"result": str(result_score), "binding_affinity": str(binding_affinity)}
    return jsonify(result)


@app.route("/falcon2", methods=["GET", "POST"])
def falcon2():
    return render_template("falcon2.html", module=module)


# @app.route('/prodigy', methods=["GET", "POST"])
def calc_prodigy():
    pdb_files_list = request.values.get("pdb_files")
    pdb_file_name = 'protein_db/protein_prodigy.pdb'

    if len(pdb_files_list) > 1:
        # 合并两个蛋白质文件为一个蛋白质文件
        pass
    else:
        pdb_file = pdb_files_list[0]
        with open(pdb_file_name, 'w') as fw:
            fw.writelines(pdb_file)

    binding_affinity = execute_prodigy(pdb_file_name)
    ba_result = {"binding_affinity": str(binding_affinity)}
    return jsonify(ba_result)


@app.route("/design", methods=["GET", "POST"])
def pro_design_v1():
    pdb_str = request.form.get("pdb_str")
    res_dict = request.form.get("res_id")
    pdb_id = request.form.get("pdb_id")
    print(pdb_id)
    res_dict = eval(res_dict)
    res_id = collections.defaultdict(list)
    for i in res_dict:
        if i[0] == pdb_id:
            res_id[i[1].upper()].append(str(i[2]))
    print("res_id", res_id)

    # 获取所有res number链长
    residue_numbers = {}
    # 遍历每一行数据

    for line in pdb_str.split("\n"):
        if line.startswith("ATOM"):
            chain_number = line[21].upper()
            residue_number = line[22:26].strip()
            if chain_number in residue_numbers.keys():
                if residue_number not in residue_numbers[chain_number]:
                    residue_numbers[chain_number].append(residue_number)
            else:
                residue_numbers[chain_number] = list()
                residue_numbers[chain_number].append(residue_number)

    # 将两条链合并成一条链
    # config
    fasta_name = 'DFProDESIGN'
    fixed_dict = collections.defaultdict(list)

    for key, values in residue_numbers.items():
        for num, j in enumerate(values):
            if key in res_id.keys():
                if j not in res_id[key]:
                    fixed_dict[key].append(num)
                else:
                    continue
            if key not in res_id.keys():
                fixed_dict[key].append(num)
    if len(res_id.keys()) == 0:
        # fixed_len = len(residue_numbers[[i for i in residue_numbers.keys()][0]])
        data = falcon2_design(pdb_str,
                              fasta_name,
                              num=2,
                              fixed_dict=fixed_dict,
                              total_step=3,
                              save_step=3, )

    else:
        data = falcon2_design(pdb_str,
                              fasta_name,
                              num=1,
                              fixed_dict=fixed_dict,
                              total_step=3,
                              save_step=3, )
    design_result = {"result": data}
    print(data)
    return jsonify(design_result)


if __name__ == '__main__':
    app.config['DEBUG'] = True
    app.run(host='0.0.0.0', port=9098, threaded=True)

    # app.run(host='172.20.10.2', port=9098, threaded=True,
    #         ssl_context=("server/server.crt", "server/server.key"))
