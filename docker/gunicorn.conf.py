workers = 1
worker_class = 'gevent'
worker_connections = 500
bind = '0.0.0.0:8000'
timeout = 0
max_requests = 1000
max_requests_jitter = 100
accesslog = '-'
errorlog = '-'
loglevel = 'info'


def post_fork(server, worker):
    from gevent import monkey
    monkey.patch_all()
