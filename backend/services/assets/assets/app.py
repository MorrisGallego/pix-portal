import threading
import traceback
from pathlib import Path

from assets.controllers import assets
from assets.settings import settings
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from pix_portal_lib.exceptions.fastapi_handlers import general_exception_handler, http_exception_handler
from pix_portal_lib.middleware.request_logging import RequestLoggingMiddleware
from pix_portal_lib.open_telemetry_utils import instrument_app
from pix_portal_lib.persistence.alembic import migrate_to_latest
from pix_portal_lib.service_clients.fastapi import add_user_to_app_state_if_present
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PIX Portal Assets",
    description="""Asset service for PIX Portal manages assets and corresponding files. 
    One asset can have multiple files.""",
    # TODO: update version programmatically
    version="0.1.0",
    dependencies=[Depends(add_user_to_app_state_if_present)],
)


app.include_router(assets.router, prefix="/assets", tags=["assets"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.add_middleware(RequestLoggingMiddleware)
app.add_exception_handler(Exception, general_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)


@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    traceback_str = "".join(traceback.format_exception(etype=type(exc), value=exc, tb=exc.__traceback__))
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
        config_path = Path(__file__).parent.parent / "alembic.ini"
        alembic_root = Path(__file__).parent.parent / "alembic"
        # We need the lock to avoid the warning because of concurrent run.
        # See more at https://stackoverflow.com/questions/54351783/duplicate-key-value-violates-unique-constraint-postgres-error-when-trying-to-c
        lock = threading.Lock()
        with lock:
            await migrate_to_latest(alembic_config_path=config_path, alembic_root_path=alembic_root)
    except Exception as e:
        print(e)


instrument_app(app, service_name="assets")
