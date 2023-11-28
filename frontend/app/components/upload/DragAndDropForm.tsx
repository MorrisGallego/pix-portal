import { Transition } from "@headlessui/react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { ArrowDownIcon } from "@heroicons/react/24/solid";
import { Form, useNavigation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import EventLogColumnMappingDialog from "~/components/upload/EventLogColumnMappingDialog";
import { EventLogColumnMapping } from "~/components/upload/column_mapping";
import { AssetTypeBackend, assetTypeToString } from "~/shared/AssetTypeBackend";

export function DragAndDropForm({ assetType }: { assetType: AssetTypeBackend }) {
  // DragAndDrop component is used to upload files to the server. It keeps track of three different asset types:
  // Event Log, Process Model, Simulation Model. All asset types have a corresponding drag and drop area and a hidden
  // input element to store the actual file. The Simulation Model consists of two assets, thus, it has two drag and drop
  // areas and two hidden input elements to store the Process Model and Simulation Model files.

  const navigation = useNavigation();

  // These are used to store the actual files and are hidden from the user.
  const eventLogInputRef = useRef<any>(null);
  const processModelInputRef = useRef<any>(null);
  const simulationModelInputRef = useRef<any>(null);

  // These are used only for UI purposes to update the state of drag and drop areas.
  const [eventLogFile, setEventLogFile] = useState<any>(null);
  const [processModelFile, setProcessModelFile] = useState<any>(null);
  const [simulationModelFile, setSimulationModelFile] = useState<any>(null);

  // Drag and drop areas' states
  const [eventLogDragActive, setEventLogDragActive] = useState<boolean>(false);
  const [processModelDragActive, setProcessModelDragActive] = useState<boolean>(false);
  const [simulationModelDragActive, setSimulationModelDragActive] = useState<boolean>(false);

  // Event log column mapping value, states, and effects
  const [eventLogColumnMappingEnabled, setEventLogColumnMappingEnabled] = useState<boolean>(false);
  const [eventLogColumnMappingFilledIn, setEventLogColumnMappingFilledIn] = useState<boolean>(false);
  const [eventLogColumnMapping, setEventLogColumnMapping] = useState<EventLogColumnMapping>(
    EventLogColumnMapping.default()
  );

  // Submit button enabled state and effects
  const [submitEnabled, setSubmitEnabled] = useState<boolean>(false);
  useEffect(() => {
    if (navigation.state === "submitting") {
      setSubmitEnabled(false);
      return;
    }

    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        setEventLogColumnMappingEnabled(!!eventLogFile);
        setSubmitEnabled(!!eventLogFile && eventLogColumnMappingFilledIn);
        break;
      case AssetTypeBackend.PROCESS_MODEL:
        setSubmitEnabled(!!processModelFile);
        break;
      case AssetTypeBackend.SIMULATION_MODEL:
        setSubmitEnabled(!!processModelFile && !!simulationModelFile);
        break;
    }
  }, [assetType, eventLogFile, processModelFile, simulationModelFile, eventLogColumnMappingFilledIn, navigation.state]);

  function getValidFileTypes(assetType: AssetTypeBackend) {
    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        return [".csv", ".gz"].join(", "); // it's .gz and not .csv.gz because only the last suffix is considered by the browser
      case AssetTypeBackend.PROCESS_MODEL:
        return [".bpmn"].join(", ");
      case AssetTypeBackend.SIMULATION_MODEL:
        return [".json"].join(", ");
    }
  }

  function preventDefaultStopPropagation(e: any) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onHiddenInputChange(e: any, assetType: AssetTypeBackend) {
    e.preventDefault();
    const file = e.target.files[0];
    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        setEventLogFile(file);
        break;
      case AssetTypeBackend.PROCESS_MODEL:
        setProcessModelFile(file);
        break;
      case AssetTypeBackend.SIMULATION_MODEL:
        setSimulationModelFile(file);
        break;
    }
  }

  function onDragEnterOrLeaveOrOver(e: any, assetType: AssetTypeBackend, dragActive: boolean) {
    preventDefaultStopPropagation(e);

    let fileExists = false;
    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        fileExists = !!eventLogFile;
        setEventLogDragActive(dragActive);
        break;
      case AssetTypeBackend.PROCESS_MODEL:
        fileExists = !!processModelFile;
        setProcessModelDragActive(dragActive);
        break;
      case AssetTypeBackend.SIMULATION_MODEL:
        fileExists = !!simulationModelFile;
        setSimulationModelDragActive(dragActive);
        break;
    }

    if (fileExists) {
      e.dataTransfer.dropEffect = "none";
    }
  }

  function onDragDrop(e: any, assetType: AssetTypeBackend) {
    onDragEnterOrLeaveOrOver(e, assetType, false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      switch (assetType) {
        case AssetTypeBackend.EVENT_LOG:
          setEventLogFile(file);
          eventLogInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetTypeBackend.PROCESS_MODEL:
          setProcessModelFile(file);
          processModelInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetTypeBackend.SIMULATION_MODEL:
          setSimulationModelFile(file);
          simulationModelInputRef.current.files = e.dataTransfer.files;
          break;
      }
    }
  }

  function onRemoveClick(assetType: AssetTypeBackend) {
    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        setEventLogFile(null);
        eventLogInputRef.current.value = "";
        break;
      case AssetTypeBackend.PROCESS_MODEL:
        setProcessModelFile(null);
        processModelInputRef.current.value = "";
        break;
      case AssetTypeBackend.SIMULATION_MODEL:
        setSimulationModelFile(null);
        simulationModelInputRef.current.value = "";
        break;
    }
  }

  function openFileBrowser(assetType: AssetTypeBackend) {
    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        eventLogInputRef.current.value = "";
        eventLogInputRef.current.click();
        break;
      case AssetTypeBackend.PROCESS_MODEL:
        processModelInputRef.current.value = "";
        processModelInputRef.current.click();
        break;
      case AssetTypeBackend.SIMULATION_MODEL:
        simulationModelInputRef.current.value = "";
        simulationModelInputRef.current.click();
        break;
    }
  }

  function handleSubmit() {
    // Clean up inputs
    switch (assetType) {
      case AssetTypeBackend.EVENT_LOG:
        processModelInputRef.current.value = "";
        simulationModelInputRef.current.value = "";
        break;
      case AssetTypeBackend.PROCESS_MODEL:
        eventLogInputRef.current.value = "";
        simulationModelInputRef.current.value = "";
        break;
      case AssetTypeBackend.SIMULATION_MODEL:
        eventLogInputRef.current.value = "";
        break;
    }
  }

  return (
    <div className="flex items-center justify-center">
      <Form method="post" encType="multipart/form-data" className="flex flex-col items-center justify-center space-y-8">
        <input type="hidden" name="assetType" value={assetType} />
        {/* Hidden input element that hold actual files and allows and allow to select files for upload on the button click. */}
        <input
          type="file"
          name="eventLogFile"
          ref={eventLogInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetTypeBackend.EVENT_LOG)}
          onChange={(e: any) => onHiddenInputChange(e, AssetTypeBackend.EVENT_LOG)}
        />
        <input
          type="text"
          name="eventLogColumnMapping"
          className="hidden"
          value={eventLogColumnMapping.toString()}
          readOnly={true}
        />
        <input
          type="file"
          name="processModelFile"
          ref={processModelInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetTypeBackend.PROCESS_MODEL)}
          onChange={(e: any) => onHiddenInputChange(e, AssetTypeBackend.PROCESS_MODEL)}
        />
        <input
          type="file"
          name="simulationModelFile"
          ref={simulationModelInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetTypeBackend.SIMULATION_MODEL)}
          onChange={(e: any) => onHiddenInputChange(e, AssetTypeBackend.SIMULATION_MODEL)}
        />

        {assetType === AssetTypeBackend.EVENT_LOG && (
          <div className="flex flex-col items-center justify-center space-y-2 my-4">
            <DragAndDropContainer
              file={eventLogFile}
              assetType={assetType}
              dragActiveFlag={eventLogDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
              onDrop={(e) => onDragDrop(e, assetType)}
              onSelectFile={() => openFileBrowser(assetType)}
              onRemove={() => onRemoveClick(assetType)}
            />
            {/* Event log mapping */}
            <Transition
              show={eventLogColumnMappingEnabled}
              enter="transition-opacity duration-1000"
              enterFrom="opacity-0"
              enterTo="opacity-100"
            >
              {eventLogColumnMappingEnabled && (
                <div className="flex flex-col space-y-2 mb-4">
                  <ArrowDownIcon className="h-10 w-auto text-blue-200" aria-hidden="true" />
                  <EventLogColumnMappingDialog
                    trigger={
                      <button
                        type="button"
                        className={`${
                          eventLogColumnMappingFilledIn
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-green-50 hover:bg-green-100 text-green-900"
                        } border-2 border-green-500 px-5 py-3 w-80 text-lg font-semibold`}
                      >
                        Specify column mapping
                      </button>
                    }
                    columnMapping={eventLogColumnMapping}
                    setColumnMapping={setEventLogColumnMapping}
                    setColumnMappingFilledIn={setEventLogColumnMappingFilledIn}
                  />
                </div>
              )}
            </Transition>
          </div>
        )}

        {assetType === AssetTypeBackend.PROCESS_MODEL && (
          <DragAndDropContainer
            className="m-4"
            file={processModelFile}
            assetType={assetType}
            dragActiveFlag={processModelDragActive}
            onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
            onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
            onDrop={(e) => onDragDrop(e, assetType)}
            onSelectFile={() => openFileBrowser(assetType)}
            onRemove={() => onRemoveClick(assetType)}
          />
        )}

        {assetType === AssetTypeBackend.SIMULATION_MODEL && (
          <div className="flex flex-wrap items-center justify-center">
            {/* Process Model */}
            <DragAndDropContainer
              className="m-4"
              file={processModelFile}
              assetType={AssetTypeBackend.PROCESS_MODEL}
              dragActiveFlag={processModelDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, AssetTypeBackend.PROCESS_MODEL, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, AssetTypeBackend.PROCESS_MODEL, false)}
              onDrop={(e) => onDragDrop(e, AssetTypeBackend.PROCESS_MODEL)}
              onSelectFile={() => openFileBrowser(AssetTypeBackend.PROCESS_MODEL)}
              onRemove={() => onRemoveClick(AssetTypeBackend.PROCESS_MODEL)}
            />

            {/* Simulation Parameters */}
            <DragAndDropContainer
              className="m-4"
              file={simulationModelFile}
              assetType={assetType}
              dragActiveFlag={simulationModelDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
              onDrop={(e) => onDragDrop(e, assetType)}
              onSelectFile={() => openFileBrowser(assetType)}
              onRemove={() => onRemoveClick(assetType)}
            />
          </div>
        )}

        <button className="w-48" type="submit" onClick={handleSubmit} disabled={!submitEnabled}>
          {navigation.state === "submitting" ? "Uploading..." : "Upload"}
        </button>
      </Form>
    </div>
  );
}

function DragAndDropContainer(props: {
  file: any;
  assetType: AssetTypeBackend;
  dragActiveFlag: boolean;
  onDragEnter: (e: any) => void;
  onDragLeave: (e: any) => void;
  onDrop: (e: any) => void;
  onSelectFile: () => void;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <div
      className={`${
        props.dragActiveFlag ? `bg-blue-100 ${props.className}` : `bg-gray-50 ${props.className}`
      } border-4 border-blue-100 hover:border-blue-500 py-3 px-4 rounded-lg text-center flex flex-col items-center justify-center space-y-5`}
      onDragEnter={props.onDragEnter}
      onDragOver={props.onDragEnter}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <DragAndDropHeader assetType={props.assetType} onSelectFile={props.onSelectFile} />
      <DroppedFile file={props.file} onRemove={props.onRemove} />
    </div>
  );
}

function DragAndDropHeader(props: { assetType: AssetTypeBackend; onSelectFile: () => void }) {
  // Header of the drag-and-drop area, additional instructions, and controls.

  return (
    <div>
      <p className="text-lg mb-4 font-semibold">Add {assetTypeToString(props.assetType)}</p>
      <p className="">
        Drag & Drop or{" "}
        <span
          className="border border-blue-500 bg-white hover:bg-blue-50 rounded-md px-2 py-1 font-normal text-blue-600 cursor-pointer"
          onClick={props.onSelectFile}
        >
          {`select a file`}
        </span>{" "}
        to upload
      </p>
    </div>
  );
}

function DroppedFile(props: { file?: any; onRemove: () => void }) {
  if (props.file) {
    return (
      <div className="flex flex-col items-center p-3 mt-4">
        <div className="border-4 border-blue-100 bg-indigo-50 w-72 px-4 py-2 rounded-2xl flex space-x-2 my-1">
          <div className="flex items-center">
            <DocumentArrowUpIcon className="h-10 w-auto text-blue-500" />
          </div>
          <div className="flex flex-column flex-wrap max-w-sm overflow-hidden">
            <p className="truncate font-semibold text-blue-900">{props.file.name}</p>
            <div
              className="flex text-blue-500 hover:text-blue-600 cursor-pointer text-sm font-semibold"
              onClick={props.onRemove}
            >
              Remove
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
