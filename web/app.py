import time
from crypt import methods
import os
from typing import Union, Any

from flask import Flask, jsonify, send_file, redirect, request, render_template, url_for
# import web_utils.db as db, web_utils.form as form, web_utils.utils as utils
# from web_utils.utils import serving_pdb
from FFD.ffd_ppl import get_ffd, get_ffd_short
from Bio.PDB.PDBParser import PDBParser
from dfire.calene import read_lib, calc_energy
import logging

module = os.environ.get('ProDESIGN_MODULE', '')
app = Flask(__name__, static_url_path='')

logging.basicConfig(level=logging.INFO)


@app.route('/ffd/', methods=['GET', 'POST'])
def ffd():
    pdb_file = request.values.get("pdb_file")
    pdb_position = request.values.get("pdb_position")
    outdir = "output"
    n_structs = 1
    pool_size = -1
    device = 0
    snapshot = 0
    # result = get_ffd(pdb_file, outdir, n_structs, pool_size, device, snapshot)
    result = get_ffd_short(pdb_file, pdb_position, outdir, n_structs, pool_size, device, snapshot)
    result = {"result": result}
    return jsonify(result)


@app.route('/search/', methods=['POST'])
def search():
    # sapp_id = request.args.get('app', 'profold0')
    query = request.form.get('job_search')
    job_list = db.job_get(with_tasks=False, logic_op='or', job_id=query, email=query)
    job_status = dict(db.job_status())
    # job_id=request.form.get('job_search')
    print(job_list)

    # return redirect(f'{module}/checking/{job_id}')
    return render_template('search.html', module=module,
                           job_search=query,
                           job_list=job_list,
                           job_status=job_status)


@app.route('/error/', methods=['GET'])
def error():
    job_status = dict(db.job_status())
    return render_template('error.html', module=module, job_status=job_status)


@app.route('/checking/<job_id>/', methods=['GET'])
def checking(job_id=None):
    print(job_id)
    job = db.job_get(job_id=job_id)
    if not job:
        return redirect(f'{module}/error?id={job_id}')
    job_status = dict(db.job_status())
    return render_template('checking.html', module=module, job=job, job_status=job_status)


# profold页面
@app.route('/submit_profold/<job_id>/', methods=['GET'])  # 响应页面
def submit_profold(job_id=None):
    task = db.task_get(job_id=job_id)
    task_status = dict(db.task_status())  # 这个是什么意思
    if not task:
        return redirect(f'{module}/error?id={job_id}')
    print("yoriko:")
    print(task)
    return render_template('temp.html', module=module, task=task, task_status=task_status)  # 原本是job_status


# yoriko
@app.route('/resource/<job_id>/<data>/', defaults={'task_id': None}, methods=['GET'])
@app.route('/resource/<job_id>/<data>/', methods=['GET'])
def resource(data, job_id):
    mimetype = None
    if data == 'pdb':
        p = serving_pdb(job_id, "target")  # 坑啊
    elif data == 'relaxed_pdb':
        p = serving_pdb(job_id, "relax_predicted")  # 坑啊
    else:
        return render_template("error.html")
    print(p)
    return send_file(p, mimetype=mimetype, as_attachment=True)
    '''
    if os.path.exists(p):
        print("获取到了pdb文件")
        return send_file(p, mimetype=mimetype, as_attachment=True)

    return render_template("error.html")
    '''
    # return redirect(f'{module}/error?app={app_id}')


#  with open(serving_pdb(job_id, "target"), 'w') as f:
#                f.write(pdb)


@app.route('/submit/<job_id>/', methods=['GET', 'POST'])
def submit(job_id=None, email=None):
    job_status = dict(db.job_status())
    if request.method == 'GET':
        if job_id:
            job = db.job_get(with_tasks=False, job_id=job_id)
            del job['job_id']  # del原本函数
        else:
            job = None
        return render_template('index.html', module=module, args=job, job_status=job_status)

    elif request.method == 'POST':
        pdb = request.form.get('sequences')
        # print(pdb)
        if pdb == "":
            file = request.files['sequence_file']
            pdb = file.read()  # 文件内容
            pdb = pdb.decode('utf8')
            # print(pdb)

        with open(serving_pdb("1all", "target"), 'w') as f:
            f.write(pdb)
        # 对pdb文件先进行检测
        path = serving_pdb("1all", "target")
        p = PDBParser()
        if (p.get_structure('', path)):
            print("yyy")  # 是pdb文件
            print(request.values['email'])
            print(request.values['job_id'])
            job_id = db.job_new(job_id=request.values['job_id'], email=request.values['email'])  # 有问题

            with open(serving_pdb(job_id, "target"), 'w') as f:
                f.write(pdb)
            return redirect(f'{module}/checking/{job_id}')  # 重定向的位置也得改
        else:
            errors = "请输入正确的pdb文件"
            return render_template('index.html', module=module, errors=errors, job_status=job_status)


@app.route('/resubmit/job/<job_id>/', methods=['GET', 'POST'])  # 响应页面
def resubmit_job(job_id=None):
    if job_id:
        job = db.job_get(with_tasks=False, job_id=job_id)
        del job['job_id']  # del原本函数
    else:
        job = None
    return render_template('index.html', module=module, args=job, job_status=job_status)


@app.route('/index/', methods=['GET', 'POST'])
def index():
    return submit()


@app.route('/', methods=['GET', 'POST'])
def main():
    return index()


@app.route("/result", methods=["GET", "POST"])  # 表单提交的响应函数
def result():
    if request.method == 'POST':
        job_id = db.job_new()
        pdb = request.values.get('pdbstr')
        with open(serving_pdb(job_id, "target"), 'w') as f:
            # with open("serving_pdb(job_id", 'w') as f:
            f.write(pdb)
        data = {'job_id': job_id, "module": module}
        return jsonify(data)
    elif request.method == 'GET':
        return render_template("result.html")
    else:
        return render_template("error.html")


@app.route("/test", methods=["GET", "POST"])  # 表单提交的响应函数
def test():
    if request.method == 'POST':
        job_id = "all"
        pdb = request.values.get('pdbstr')

        p = serving_pdb(job_id, "target")
        if os.path.exists(p):
            # 这里应该加个检测数据格式的
            utils.del_pdb(job_id, "target")

        with open(serving_pdb(job_id, "target"), 'w') as f:
            f.write(pdb)
        data = {'job_id': job_id, "module": module}
        return jsonify(data)
    elif request.method == 'GET':
        return render_template("result.html")
    else:
        return render_template("error.html")


@app.route("/yoriko", methods=["GET", "POST"])  # 测试用
def yoriko():
    return render_template('yoriko.html')


@app.route("/check", methods=["GET", "POST"])  # 测试用
def check():
    return render_template('check.html')


@app.route("/vrmol", methods=["GET", "POST"])  # vrmol暂时用
def vrmol():
    return render_template('vrmol.html', module=module)


edfire, ATOM_TYPE = read_lib()
PDB_FILE_CHANGE = ""
RESULT_CHANGE = 0


@app.route("/changeCoord", methods=["GET", "POST"])
def change_coord():
    pdb_text = request.values.get("pdb_file")
    pdb_list = request.values.get("pdb_position")

    pdb_text = pdb_text.split("\n")
    pdb_list = pdb_list.split("\n")

    res_key = []
    res_value = []

    for aim_res in pdb_list:
        pdb_key = aim_res[17:26]
        pdb_x = aim_res[30:54]
        if pdb_key in res_key:
            pdb_index = res_key.index(pdb_key)
            x, y, z = pdb_x.split()
            x1, y1, z1 = res_value[pdb_index].split()
            x_new = "%.2f" % ((float(x) + float(x1)) / 2)
            y_new = "%.2f" % ((float(y) + float(y1)) / 2)
            z_new = "%.2f" % ((float(z) + float(z1)) / 2)
            res_value[pdb_index] = x_new.rjust(8) + y_new.rjust(8) + z_new.rjust(8)
        else:
            res_key.append(pdb_key)
            res_value.append(pdb_x)

    number = 0
    for num in range(len(pdb_text)):
        if (pdb_text[num][0:4] == "ATOM") and ("CA" in pdb_text[num]):
            if pdb_text[num][17:26] == res_key[number]:
                pdb_text[num] = pdb_text[num][:30] + res_value[number] + pdb_text[num][54:]
                number += 1
                if number > len(res_key):
                    break
    result = "\n".join(pdb_text)
    # print(result)
    result = {"result": result}
    return jsonify(result)


@app.route("/dfire", methods=["GET", "POST"])
def dDfire():
    global PDB_FILE_CHANGE
    global RESULT_CHANGE
    PDB_FILE = request.values.get("pdb_file")
    pdb_position = request.values.get("pdb_position")
    if PDB_FILE_CHANGE == PDB_FILE:
        result_score = RESULT_CHANGE
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
        # print(result_score)
        result_score = "{:.3f}".format(result_score)
        RESULT_CHANGE = result_score
        # print(result_score)
    # time.sleep(0.2)
    result = {"result": str(result_score)}
    return jsonify(result)


def main():
    return index()


if __name__ == '__main__':
    app.config['DEBUG'] = True

    app.run(host='0.0.0.0', port=9098, threaded=True,
            ssl_context=("server/server.crt", "server/server.key"))
    # app.run(host='0.0.0.0', port=9098, threaded=True)
