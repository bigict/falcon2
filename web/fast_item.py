#!/usr/bin/env python
# -*- coding: utf-8 -*-
from pydantic import BaseModel


class Hbonds(BaseModel):
    data_base: str
