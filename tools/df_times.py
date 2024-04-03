import datetime

def create_timestamp():
    current_time = datetime.datetime.now()
    time_stamp = current_time.timestamp()
    return time_stamp