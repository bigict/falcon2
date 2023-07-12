#!/bin/bash

start() {
	uwsgi --ini uwsgi.ini
	echo "falcon2 started~"
}

stop() {
	uwsgi --stop uwsgi.pid
	echo "falcon2 stopped~"
}

case "$1" in
start)
	start
	;;
stop)
	stop
	;;
*) ;;
esac
