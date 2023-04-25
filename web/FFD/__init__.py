#!/usr/bin/env python  -*- 
# -*- coding: utf-8    -*-
# -*- Author: DanFeng  -*-

a = "ATOM     50  CB  GLU A  13     -11.278   1.918   6.958  1.00  0.00           C  "
e = "ATOM     50  CB  GLU A  13     -11.278   1.918   6.958  1.00  0.00           C  "
a = a.split()
c = a.copy()
c[1] = 100
b = a[0] + a[1].rjust(7) + a[2].rjust(4) + a[3].rjust(5) + a[4].rjust(2) \
+ a[5].rjust(4) + a[6].rjust(12) + a[7].rjust(8) + a[8].rjust(8) \
+ a[9].rjust(6) + a[10].rjust(6) + a[11].rjust(12) + "  " + "\n"
print(b)
print(c)