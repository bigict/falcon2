#!/usr/bin/env python  -*- 
# -*- coding: utf-8    -*-
# -*- Author: DanFeng  -*-
#使用python代码发生https请求
import requests
requests.packages.urllib3.disable_warnings()#忽略警告
def login(data):
    url="https://172.16.10.22:9098/token"


    res=requests.post(url,data=data,verify = False)#verify = False关闭认证
    print(res.text)

if __name__=="__main__":
    data={"name":"lili"}
    login(data)