from protein.bonds.hydrogen_bonds import pyrosetta_hbonds
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fast_item import Hbonds
from pyrosetta import init

# 允许的源列表。这里是一个例子，它允许所有源。
origins = [
    "*"
]

app = FastAPI()
init()

# 添加中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # 允许的源列表
    allow_credentials=True,  # 允许携带凭证
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/hbonds/")
async def calc_hbond(hbond: Hbonds):
    pdb_content = hbond.data_base
    hbonds_set = pyrosetta_hbonds(pdb_content)
    return {"hbonds": hbonds_set}
