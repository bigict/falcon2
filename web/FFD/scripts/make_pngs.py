#!/usr/bin/env python
import os
import re
import math

from tqdm import tqdm

data_dir, name = os.environ["DATA_DIR"], os.environ["NAME"]


def load_step(step):
    cmd.load(f"{data_dir}/{name}_{step}.pdb")
    k = (step // 1000) % 2
    if k == 0:
        cmd.color("green")
    else:
        cmd.color("red")
    cmd.ray(500, 500)
    cmd.png("tmp/%04i.png" % step)
    cmd.delete(f"{name}_{step}")


def dump_png(pdb, path):
    cmd.load(pdb)
    cmd.color("green")
    cmd.ray(500, 500)
    cmd.png(path)
    cmd.delete(os.path.splitext(os.path.basename(pdb))[0])


def main():
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    start_step, end_step = 0, math.inf
    if len(sys.argv) > 3:
        start_step = int(sys.argv[3])
        end_step = int(sys.argv[4])
    files = []
    for path in os.listdir(input_dir):
        try:
            step = int(re.search(r"step_(\d+).pdb", path).group(1))
            if start_step <= step <= end_step:
                files += [(step, os.path.join(input_dir, path))]
        except:
            continue
    files.sort(key=lambda x: x[0])
    for step, path in tqdm(files):
        outpath = os.path.join(output_dir, "%05i.png" % step)
        dump_png(path, outpath)


main()
