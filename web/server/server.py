#!/usr/bin/env python  -*- 
# -*- coding: utf-8    -*-
# -*- Author: DanFeng  -*-
from flask import Flask, request
import json
import time
import random


app = Flask(__name__)

#sever_crt=open("sever.crt","r")
#sever_key=open("sever.key", "r")

@app.route("/<inscode>",methods=["GET","POST"])
def mock_request(inscode):
    if request.method=="POST":
        if inscode=="token":
            data={"token":"1234"}
        return data
    else:
        return "请求异常"



if __name__=="__main__":
    app.run(debug=True, host='0.0.0.0', port='9098', ssl_context=("server.crt","server.key"))