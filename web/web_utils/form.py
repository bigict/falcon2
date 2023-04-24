import io
import re
import web_utils.db as db

_JOBID_RE = re.compile('[a-zA-Z0-9_]+', re.I)
_EMAIL_RE = re.compile('^[^@\s]+@([-a-z0-9]+\.)+[a-z]{2,}$', re.I)

valid_content = ['A','B','C']

def prodesign_func(tmp):
    # parse data
    # return：sequence_result、 erro(or correct) descriptions
    print("hello world")
    return 'temp', 'correct'

def bytes_to_string(byte_values):
    t = io.TextIOWrapper(io.BytesIO(byte_values))
    return t.read()

def var_get(var, args, files=None, defval=None, func=lambda x: x.strip()):
    val = defval
    var_file = None
    if isinstance(var, tuple): # sequence_file
        var, var_file = var

    if not val and var in args: # job_id、sequqnce、sequence_file
        val = args[var]

    if not val and files and var_file and var_file in files:
        f = files[var_file]
        val = bytes_to_string(f.read())
        f.seek(0)

    if val and func:
        val = func(val)
    return val

#检测是否合法
def validate(args, files=None):
    erros = []

    # validate job id
    job_id = var_get('job_id', args, files=files)
    if job_id:
        if len(job_id) < 4:
            erros.append('The length of `Job ID` should be at least 4!')
        elif len(job_id) > 20:
            erros.append('The length of `Job ID` should be less than 20!')
        elif not _JOBID_RE.match(job_id):
            erros.append('`Job ID` should only contains alphanumeric characters and \'_\'!')
        elif db.job_get(job_id):
            erros.append('`Job ID` is already used!')

    # validate sequence
    try:
        sequences = var_get(('sequences', 'sequence_file'), args, files=files, func= prodesign_func)
        if sequences:
            sequences, descriptions = sequences
            for sequence, description in zip(sequences, descriptions):
                if len(sequence) > 1024:
                    erros.append('each `protein sequence` length should be less than 1024!')
                if len(sequence) <= 0:
                    erros.append('each `protein sequence` length should NOT be EMPTY!')
                if len(description) > 1024:
                    erros.append('each `protein id` length should be less than 1024!')
                for j, aa in enumerate(sequence):
                    if not aa in valid_content:
                        i, k = min(0, j - 20), max(len(sequence), j + 20)
                        erros.append((f'In the following sequence, the blue character is invalid.<br> {description} <br>'
                                   f'...{sequence[i:j]}<font color="blue">{aa}</font>{sequence[j+1:k]} ...'))
        if not sequences:
            erros.append('`sequences` requires and should be FASTA!')

    except Exception as e:
        erros.append('`sequences` requires and should be FASTA! %s' % (str(e)))

    return erros


if __name__ == '__main__':
    value = {'id':'2', 'ip':'192.158.0.1', 'job_id':'KMahg1', 'sequence':'aaa', 'status': 'Done' }
    var_get(('sequences', 'sequence_file'), value, files='/home/ysbgs/prodesignv1/web/tmp.txt')
    var_get('job_id', "bbb")