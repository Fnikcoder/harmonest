import os, json, logging

def setup():
    level = os.getenv("LOG_LEVEL","INFO").upper()
    logging.basicConfig(level=getattr(logging, level, logging.INFO))
    return logging.getLogger()
