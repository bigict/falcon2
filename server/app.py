from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request
from items import HDock
import subprocess
import tempfile
import config
import os


app = FastAPI()
templates = Jinja2Templates(directory="../client/templates")
app.mount("/static", StaticFiles(directory="../client/static"), name="static")


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


