import logging
import uuid
from typing import AsyncGenerator, Optional, Sequence

from fastapi import Depends
from kafka.errors import KafkaTimeoutError
from pix_portal_lib.service_clients.asset import AssetServiceClient
from pix_portal_lib.service_clients.asset_fastapi_utils import get_asset_service_client
from pix_portal_lib.service_clients.project import ProjectServiceClient
from pix_portal_lib.service_clients.project_fastapi_utils import get_project_service_client

from .kafka_producer import KafkaProducerService, get_kafka_service
from .user import UserService, get_user_service
from ..repositories.models import ProcessingRequest, ProcessingRequestType, ProcessingRequestStatus
from ..repositories.processing_requests_repository import get_processing_request_repository, ProcessingRequestRepository

logger = logging.getLogger()


class UserNotFound(Exception):
    pass


class ProjectNotFound(Exception):
    pass


class AssetNotFound(Exception):
    pass


class AssetDoesNotBelongToProject(Exception):
    pass


class AssetAlreadyExists(Exception):
    pass


class AssetAlreadyInInputAssets(Exception):
    pass


class AssetAlreadyInOutputAssets(Exception):
    pass


class AssetDeletionFailed(Exception):
    pass


class LastUserInProject(Exception):
    pass


class ProjectHasNoUsers(Exception):
    pass


class NotEnoughPermissions(Exception):
    pass


class QueueNotAvailable(Exception):
    pass


class ProcessingRequestService:
    def __init__(
        self,
        processing_request_repository: ProcessingRequestRepository,
        asset_service_client: AssetServiceClient,
        user_service: UserService,
        project_service_client: ProjectServiceClient,
        kafka_service: KafkaProducerService,
    ) -> None:
        self._processing_request_repository = processing_request_repository
        self._asset_service_client = asset_service_client
        self._user_service = user_service
        self._project_service_client = project_service_client
        self._kafka_service = kafka_service

    async def get_processing_requests(self) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests()

    async def get_processing_requests_by_user_id(self, user_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_user_id(user_id)

    async def get_processing_requests_by_project_id(
        self, project_id: uuid.UUID, current_user: dict, token: str
    ) -> Sequence[ProcessingRequest]:
        if not await self.does_user_have_access_to_project(current_user, project_id, token):
            raise NotEnoughPermissions()
        return await self._processing_request_repository.get_processing_requests_by_project_id(project_id)

    async def get_processing_requests_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_asset_id(asset_id)

    async def get_processing_requests_by_input_asset_id(self, asset_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_input_asset_id(asset_id)

    async def get_processing_requests_by_output_asset_id(self, asset_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_output_asset_id(asset_id)

    async def does_user_have_access_to_project(self, user: dict, project_id: uuid.UUID, token: str) -> bool:
        if user["is_superuser"]:
            return True
        return await self._project_service_client.does_user_have_access_to_project(user["id"], project_id, token)

    async def create_processing_request(
        self,
        type: ProcessingRequestType,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        input_assets_ids: list[uuid.UUID],
        output_assets_ids: list[uuid.UUID],
        token: str,
        current_user: dict,
    ) -> ProcessingRequest:
        ok = await self._user_service.does_user_exist(user_id, token)
        if not ok:
            raise UserNotFound()

        ok = await self._project_service_client.does_project_exist(project_id, token)
        if not ok:
            raise ProjectNotFound()

        for asset_id in input_assets_ids:
            ok = await self._asset_service_client.does_asset_exist(asset_id, token)
            if not ok:
                raise AssetNotFound()

        for asset_id in output_assets_ids:
            ok = await self._asset_service_client.does_asset_exist(asset_id, token)
            if not ok:
                raise AssetNotFound()

        if not await self.does_user_have_access_to_project(current_user, project_id, token):
            raise NotEnoughPermissions()

        processing_request = await self._processing_request_repository.create_processing_request(
            type,
            user_id,
            project_id,
            input_assets_ids,
            output_assets_ids,
        )

        try:
            self._kafka_service.send_message(
                type,
                {
                    "processing_request_id": str(processing_request.id),
                    "user_id": str(user_id),
                    "project_id": str(project_id),
                    "input_assets_ids": [str(aid) for aid in input_assets_ids],
                    "output_assets_ids": [str(aid) for aid in output_assets_ids],
                    "jwt_token": token,
                },
            )
        except KafkaTimeoutError as e:
            logger.error(
                f"Failed to send a message to Kafka. "
                f"Details: "
                f"type={type}, "
                f"user_id={user_id}, "
                f"project_id={project_id}, "
                f"input_assets_ids={input_assets_ids}, "
                f"output_assets_ids={output_assets_ids}, "
                f"error: {e}"
            )
            raise QueueNotAvailable()

        return processing_request

    async def get_processing_request(self, processing_request_id: uuid.UUID) -> ProcessingRequest:
        return await self._processing_request_repository.get_processing_request(processing_request_id)

    async def update_processing_request(
        self,
        processing_request_id: uuid.UUID,
        status: Optional[ProcessingRequestStatus] = None,
        message: Optional[str] = None,
    ) -> ProcessingRequest:
        return await self._processing_request_repository.update_processing_request(
            processing_request_id, status, message
        )

    async def add_input_asset_to_processing_request(
        self, processing_request_id: uuid.UUID, asset_id: uuid.UUID, token: str
    ) -> ProcessingRequest:
        if not await self._asset_service_client.does_asset_exist(asset_id, token):
            raise AssetNotFound()

        if not await self.does_asset_belong_to_project(processing_request_id, asset_id, token):
            raise AssetDoesNotBelongToProject()

        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        processing_request_input_assets_ids = [str(aid) for aid in processing_request.input_assets_ids]
        if str(asset_id) in processing_request_input_assets_ids:
            raise AssetAlreadyExists()

        # An asset cannot be both input and output assets
        processing_request_output_assets_ids = [str(aid) for aid in processing_request.output_assets_ids]
        if str(asset_id) in processing_request_output_assets_ids:
            raise AssetAlreadyInInputAssets()

        return await self._processing_request_repository.add_input_asset_to_processing_request(
            processing_request_id, asset_id
        )

    async def add_output_asset_to_processing_request(
        self, processing_request_id: uuid.UUID, asset_id: uuid.UUID, token: str
    ) -> ProcessingRequest:
        if not await self._asset_service_client.does_asset_exist(asset_id, token):
            raise AssetNotFound()

        if not await self.does_asset_belong_to_project(processing_request_id, asset_id, token):
            raise AssetDoesNotBelongToProject()

        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        processing_request_output_assets_ids = [str(aid) for aid in processing_request.output_assets_ids]
        if str(asset_id) in processing_request_output_assets_ids:
            raise AssetAlreadyExists()

        # An asset cannot be both input and output assets
        processing_request_input_assets_ids = [str(aid) for aid in processing_request.input_assets_ids]
        if str(asset_id) in processing_request_input_assets_ids:
            raise AssetAlreadyInOutputAssets()

        return await self._processing_request_repository.add_output_asset_to_processing_request(
            processing_request_id, asset_id
        )

    async def does_asset_belong_to_project(
        self, processing_request_id: uuid.UUID, asset_id: uuid.UUID, token: str
    ) -> bool:
        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        project = await self._project_service_client.get_project(processing_request.project_id, token=token)
        project_assets_ids = [str(pid) for pid in project["assets_ids"]]
        return str(asset_id) in project_assets_ids


async def get_processing_request_service(
    processing_request_repository: ProcessingRequestRepository = Depends(get_processing_request_repository),
    asset_service: AssetServiceClient = Depends(get_asset_service_client),
    user_service: UserService = Depends(get_user_service),
    project_service: ProjectServiceClient = Depends(get_project_service_client),
    kafka_service: KafkaProducerService = Depends(get_kafka_service),
) -> AsyncGenerator[ProcessingRequestService, None]:
    yield ProcessingRequestService(
        processing_request_repository, asset_service, user_service, project_service, kafka_service
    )
