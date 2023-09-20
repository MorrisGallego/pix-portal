import threading
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .controllers import assets
from .repositories.init_db import migrate_to_latest

app = FastAPI(
    title="PIX Portal Assets",
    description="Asset service for PIX Portal.",
    # TODO: update version programmatically
    version="0.1.0",
)


app.include_router(
    assets.router,
    prefix="/assets",
    tags=["assets"],
)


@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    traceback_str = "".join(
        traceback.format_exception(etype=type(exc), value=exc, tb=exc.__traceback__)
    )
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal server error",
            "detail": f"{exc}",
            "traceback": traceback_str,
        },
    )


@app.on_event("startup")
async def on_startup():
    try:
        # We need the lock to avoid the warning because of concurrent run.
        # See more at https://stackoverflow.com/questions/54351783/duplicate-key-value-violates-unique-constraint-postgres-error-when-trying-to-c
        lock = threading.Lock()
        with lock:
            await migrate_to_latest()
    except Exception as e:
        print(e)
