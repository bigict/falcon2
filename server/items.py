from pydantic import BaseModel


class HDock(BaseModel):
    receptor: str
    ligand: str

