#!/bin/bash
set -e

outdir=output
#name=1ctfA
name=1ctf
#name=1cbs


mkdir -p $outdir

../run_builder.py \
  --fasta_path $name.fasta \
  --geo_path $name.npz \
  --outdir $outdir \
  --n_structs 1 \
  --device -1

