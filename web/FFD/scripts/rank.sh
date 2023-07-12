#!/bin/bash
set -e

decoy_dir=$1

ls $decoy_dir/*.pdb | while read LINE; do
   echo $LINE $(tail -1 $LINE | awk '{print $NF}')
done | sort -k 2 -n
