from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request
from items import HDock, Design, Energy
from alignment import pymol_align_global
from dssp import get_ss_from_pymol
from dfire.calene import DFIRE
from tools.df_times import load_config
from pathlib import Path
import subprocess
import tempfile
import config

import os


app = FastAPI()
templates = Jinja2Templates(directory="../client/templates")
app.mount("/static", StaticFiles(directory="../client/static"), name="static")


# dfire
dfire_model = DFIRE()


# load config.json


@app.post("/dfire")
async def h_dock(response: Energy):
    pdb_str = response.pdb_string
    energy = dfire_model.calc_energy(pdb_str)
    score = "{:.3f}".format(energy)
    return JSONResponse(content=score)


def h_dock_cmd(receptor, ligand):
    path = 'hdockData'
    command1 = f"hdock {receptor} {ligand}"
    command2 = f"createpl Hdock.out {path}/top10.pdb -nmax 10 -complex -models"

    # Execute the command
    subprocess.run(command1, shell=True)
    subprocess.run(command2, shell=True)
    return path


# 添加cors中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=config.cors_methods,
    allow_headers=config.cors_headers,
)


@app.get("/")
async def read_root(request: Request):
    context = {"request": request, "message": "Hello, FastAPI with Jinja2!"}
    return templates.TemplateResponse("index.html", {"request": request, "context": context})


@app.post("/hdock")
async def h_dock(response: HDock):
    receptor = response.receptor
    ligand = response.ligand

    with tempfile.NamedTemporaryFile(delete=False) as receptor_file:
        receptor_file_path = receptor_file.name
        receptor_file.write(receptor.encode())
    with tempfile.NamedTemporaryFile(delete=False) as ligand_file:
        ligand_file_path = ligand_file.name
        ligand_file.write(ligand.encode())

    file_path = h_dock_cmd(receptor_file_path, ligand_file_path)

    os.unlink(receptor_file_path)
    os.unlink(ligand_file_path)
    context = {"filePath": file_path}

    return JSONResponse(content=context)


@app.post("/design")
async def abacus(response: Design):
    pdb_string = response.pdb_string
    test_list = ''
    with tempfile.NamedTemporaryFile(dir=test_list, delete=False) as pdb_file:
        pdb_file.write(pdb_string.encode())
    # scuba-d
    command = [
        'python3.8', 'inference_par.py',
        '--test_list', test_list,
        '--write_pdbfile',
        '--batch_size', '1',
        '--sample_from_raw_pdbfile',
        '--diff_noising_scale', '0.1'
    ]
    # 运行命令
    subprocess.run(command)
    input_pdb = ""
    output_pdb = ""
    log_file = ""
    # abacus
    subprocess.run(['ABACUS-DesignSeq', '-in', input_pdb, '-out', output_pdb, '-log', log_file])
    pass


@app.post("/align")
async def align(response: HDock):
    receptor = response.receptor
    ligand = response.ligand

    path_data = "./data/"

    with open(path_data+'receptor.pdb', 'w', encoding='utf-8') as fw1:
        fw1.writelines(receptor)
    with open(path_data+'ligand.pdb', 'w', encoding='utf-8') as fw2:
        fw2.writelines(ligand)

    pymol_align_global(path_data+'receptor.pdb', path_data+'ligand.pdb')
    # result = ligand
    result = get_ss_from_pymol(path_data + 'aligned_mobile.pdb')
    print(result)
    return JSONResponse(content={"rotation": result})


@app.post("/pdb_path")
async def pdb_path(request: Request):
    config = load_config()
    files = [f for f in Path(config[]).iterdir() if f.is_file()]