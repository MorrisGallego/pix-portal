import uuid
from typing import AsyncGenerator, Optional

from fastapi import Depends

from .asset import AssetService, get_asset_service
from .user import UserService, get_user_service
from ..repositories.models import Project
from ..repositories.project_repository import get_project_repository, ProjectRepository
from ..repositories.project_repository_interface import ProjectRepositoryInterface


class UserNotFound(Exception):
    pass


class AssetNotFound(Exception):
    pass


class AssetDeletionFailed(Exception):
    pass


class LastUserInProject(Exception):
    pass


class ProjectHasNoUsers(Exception):
    pass


class ProjectService:
    def __init__(
        self,
        project_repository: ProjectRepository,
        asset_service: AssetService,
        user_service: UserService,
    ) -> None:
        self._project_repository = project_repository
        self._asset_service = asset_service
        self._user_service = user_service

    async def get_projects(self) -> list[Project]:
        return await self._project_repository.get_projects()

    async def get_projects_by_user_id(self, user_id: uuid.UUID) -> list[Project]:
        return await self._project_repository.get_projects_by_user_id(user_id)

    async def create_project(
        self,
        name: str,
        users_ids: list[uuid.UUID],
        token: str,
        current_user: dict,
        assets_ids: list[uuid.UUID] = [],
        processing_requests_ids: list[uuid.UUID] = [],
        description: Optional[str] = None,
    ) -> Project:
        if current_user["id"] not in users_ids:
            users_ids.insert(0, current_user["id"])

        for user_id in users_ids:
            ok = await self._user_service.does_user_exist(user_id, token)
            if not ok:
                raise UserNotFound()

        for asset_id in assets_ids:
            ok = await self._asset_service.does_asset_exist(asset_id, token)
            if not ok:
                raise AssetNotFound()

        # TODO: check if processing requests exist

        project = await self._project_repository.create_project(
            name,
            users_ids,
            assets_ids=assets_ids,
            processing_requests_ids=processing_requests_ids,
            description=description,
        )
        return project

    async def get_project(self, project_id: uuid.UUID) -> Project:
        return await self._project_repository.get_project(project_id)

    async def get_project_users(self, project_id: uuid.UUID, token: str) -> list[dict]:
        project = await self._project_repository.get_project(project_id)
        return await self._user_service.get_users_by_ids(project.users_ids, token=token)

    async def get_project_assets(self, project_id: uuid.UUID, token: str) -> list[dict]:
        project = await self._project_repository.get_project(project_id)
        return await self._asset_service.get_assets_by_ids(project.assets_ids, token=token)

    async def update_project(
        self,
        project_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Project:
        return await self._project_repository.update_project(project_id, name, description)

    async def add_user_to_project(self, project_id: uuid.UUID, user_id: uuid.UUID, token: str) -> Project:
        ok = await self._user_service.does_user_exist(user_id, token)
        if not ok:
            raise UserNotFound()

        return await self._project_repository.add_user_to_project(project_id, user_id)

    async def remove_user_from_project(self, project_id: uuid.UUID, user_id: uuid.UUID, token: str) -> Project:
        ok = await self._user_service.does_user_exist(user_id, token)
        if not ok:
            raise UserNotFound()

        project = await self._project_repository.get_project(project_id)
        if len(project.users_ids) == 1:
            raise LastUserInProject()
        elif len(project.users_ids) <= 0:
            raise ProjectHasNoUsers()

        return await self._project_repository.remove_user_from_project(project_id, user_id)

    async def add_asset_to_project(self, project_id: uuid.UUID, asset_id: uuid.UUID, token: str) -> Project:
        ok = await self._asset_service.does_asset_exist(asset_id, token)
        if not ok:
            raise AssetNotFound()

        return await self._project_repository.add_asset_to_project(project_id, asset_id)

    async def remove_asset_from_project(self, project_id: uuid.UUID, asset_id: uuid.UUID, token: str) -> Project:
        ok = await self._asset_service.delete_asset(asset_id, token)
        if not ok:
            raise AssetDeletionFailed()

        # TODO: check if there are any processing requests with this asset

        return await self._project_repository.remove_asset_from_project(project_id, asset_id)

    async def add_processing_request_to_project(
        self, project_id: uuid.UUID, processing_request_id: uuid.UUID, token: str
    ) -> Project:
        # TODO: check if processing request exists

        return await self._project_repository.add_processing_request_to_project(project_id, processing_request_id)

    async def delete_project(self, project_id: uuid.UUID, token: str) -> None:
        # TODO: cancel processing requests

        assetes_deleted = await self._asset_service.delete_assets_by_project_id(project_id, token)
        if not assetes_deleted:
            raise AssetDeletionFailed()

        await self._project_repository.delete_project(project_id)


async def get_project_service(
    project_repository: ProjectRepositoryInterface = Depends(get_project_repository),
    asset_service: AssetService = Depends(get_asset_service),
    user_service: UserService = Depends(get_user_service),
) -> AsyncGenerator[ProjectService, None]:
    yield ProjectService(project_repository, asset_service, user_service)