#!/bin/bash
set -e

HERE="$(readlink -f "$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)")"

export NAME=T1000-D2
export DATA_DIR=$(readlink -f ${NAME}_default)



# rm -r tmp
# mkdir tmp
pymol -c make_pngs.py -- $1 $2 $3 $4
# mencoder "mf://tmp/*.png" -mf type=png:fps=60 -ovc lavc -o $DATA_DIR.avi
