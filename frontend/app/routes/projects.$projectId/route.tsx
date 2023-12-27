import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Outlet, useLoaderData, useMatches } from "@remix-run/react";
import { useEffect, useState } from "react";
import Header from "~/components/Header";
import { UserContext } from "~/routes/projects.$projectId.$processingType/components/contexts";
import { getProject } from "~/services/projects.server";
import { handleNewAssets } from "~/shared/file_upload_handler.server";
import { requireLoggedInUser, requireProjectIdInParams } from "~/shared/guards.server";
import { ProcessingTypes } from "~/shared/processing_type";
import { handleThrow } from "~/shared/utils";
import { ProcessingCard } from "./ProcessingCard";
import { ProcessingCardMini } from "./ProcessingCardMini";
import ProjectNav from "./ProjectNav";
import { ProjectContext } from "./contexts";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const projectId = params.projectId;
  if (!projectId) {
    return redirect("/projects");
  }

  const user = await requireLoggedInUser(request);

  return handleThrow(request, async () => {
    const project = await getProject(projectId, user.token!);
    return json({ user, project });
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireLoggedInUser(request);
  const projectId = await requireProjectIdInParams(params);

  await handleThrow(request, async () => {
    return await handleNewAssets(request, projectId, user.token!);
  });

  return redirect(`/projects/${params.projectId}`);
}

export default function ProjectPage() {
  const { user, project } = useLoaderData<typeof loader>();

  const matches = useMatches();
  const [isProcessingPageActive, setIsProcessingPageActive] = useState(false);
  useEffect(() => {
    setIsProcessingPageActive(matches.some((match) => match.id === "routes/projects.$projectId.$processingType"));
  }, [matches]);

  return (
    <div className="h-full flex flex-col">
      <Header userEmail={user.email} />
      <UserContext.Provider value={user}>
        <ProjectContext.Provider value={project}>
          <ProjectNav project={project} />
          {!isProcessingPageActive && (
            <div className="p-6 grid lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 gap-6">
              {ProcessingTypes.map((processingType) => (
                <ProcessingCard key={processingType} projectId={project.id} processingType={processingType} />
              ))}
            </div>
          )}
          {isProcessingPageActive && (
            <div className="grid lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2">
              {ProcessingTypes.map((processingType) => (
                <ProcessingCardMini key={processingType} projectId={project.id} processingType={processingType} />
              ))}
            </div>
          )}
          <Outlet context={{ user, project }} />
        </ProjectContext.Provider>
      </UserContext.Provider>
    </div>
  );
}