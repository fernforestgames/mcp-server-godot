import type { ProjectRun } from "../../types.js";

export async function sendInputAction(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    action,
    pressed = true,
    strength = 1.0
  }: {
    runId: string;
    action: string;
    pressed?: boolean;
    strength?: number;
  }
) {
  const project = runningProjects.get(runId);

  if (!project) {
    return {
      content: [{
        type: "text" as const,
        text: `No project found with run ID: ${runId}`
      }]
    };
  }

  if (project.status === 'exited') {
    return {
      content: [{
        type: "text" as const,
        text: `Project ${runId} has exited`
      }]
    };
  }

  if (!project.bridge || !project.bridgeConnected) {
    return {
      content: [{
        type: "text" as const,
        text: "MCP Bridge addon not connected. Ensure the addon is installed in your Godot project and the project was launched via run_project."
      }]
    };
  }

  if (!project.bridge.hasCapability("input")) {
    return {
      content: [{
        type: "text" as const,
        text: "Bridge does not support input capability"
      }]
    };
  }

  try {
    await project.bridge.sendRequest<{ success: boolean }>(
      "input_action",
      { action, pressed, strength }
    );

    return {
      content: [{
        type: "text" as const,
        text: `Input action '${action}' ${pressed ? "pressed" : "released"}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to send input action: ${error}`
      }]
    };
  }
}

export async function sendInputKey(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    keycode,
    pressed = true,
    shift = false,
    ctrl = false,
    alt = false,
    meta = false
  }: {
    runId: string;
    keycode: number;
    pressed?: boolean;
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    meta?: boolean;
  }
) {
  const project = runningProjects.get(runId);

  if (!project) {
    return {
      content: [{
        type: "text" as const,
        text: `No project found with run ID: ${runId}`
      }]
    };
  }

  if (project.status === 'exited') {
    return {
      content: [{
        type: "text" as const,
        text: `Project ${runId} has exited`
      }]
    };
  }

  if (!project.bridge || !project.bridgeConnected) {
    return {
      content: [{
        type: "text" as const,
        text: "MCP Bridge addon not connected. Ensure the addon is installed in your Godot project and the project was launched via run_project."
      }]
    };
  }

  if (!project.bridge.hasCapability("input")) {
    return {
      content: [{
        type: "text" as const,
        text: "Bridge does not support input capability"
      }]
    };
  }

  try {
    await project.bridge.sendRequest<{ success: boolean }>(
      "input_key",
      { keycode, pressed, shift, ctrl, alt, meta }
    );

    return {
      content: [{
        type: "text" as const,
        text: `Key ${keycode} ${pressed ? "pressed" : "released"}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to send key input: ${error}`
      }]
    };
  }
}

export async function sendInputMouseButton(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    button,
    pressed = true,
    x,
    y
  }: {
    runId: string;
    button: number;
    pressed?: boolean;
    x: number;
    y: number;
  }
) {
  const project = runningProjects.get(runId);

  if (!project) {
    return {
      content: [{
        type: "text" as const,
        text: `No project found with run ID: ${runId}`
      }]
    };
  }

  if (project.status === 'exited') {
    return {
      content: [{
        type: "text" as const,
        text: `Project ${runId} has exited`
      }]
    };
  }

  if (!project.bridge || !project.bridgeConnected) {
    return {
      content: [{
        type: "text" as const,
        text: "MCP Bridge addon not connected. Ensure the addon is installed in your Godot project and the project was launched via run_project."
      }]
    };
  }

  if (!project.bridge.hasCapability("input")) {
    return {
      content: [{
        type: "text" as const,
        text: "Bridge does not support input capability"
      }]
    };
  }

  try {
    await project.bridge.sendRequest<{ success: boolean }>(
      "input_mouse_button",
      { button, pressed, position: { x, y } }
    );

    return {
      content: [{
        type: "text" as const,
        text: `Mouse button ${button} ${pressed ? "pressed" : "released"} at (${x}, ${y})`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to send mouse button input: ${error}`
      }]
    };
  }
}

export async function sendInputMouseMotion(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    relativeX,
    relativeY,
    x,
    y
  }: {
    runId: string;
    relativeX: number;
    relativeY: number;
    x?: number;
    y?: number;
  }
) {
  const project = runningProjects.get(runId);

  if (!project) {
    return {
      content: [{
        type: "text" as const,
        text: `No project found with run ID: ${runId}`
      }]
    };
  }

  if (project.status === 'exited') {
    return {
      content: [{
        type: "text" as const,
        text: `Project ${runId} has exited`
      }]
    };
  }

  if (!project.bridge || !project.bridgeConnected) {
    return {
      content: [{
        type: "text" as const,
        text: "MCP Bridge addon not connected. Ensure the addon is installed in your Godot project and the project was launched via run_project."
      }]
    };
  }

  if (!project.bridge.hasCapability("input")) {
    return {
      content: [{
        type: "text" as const,
        text: "Bridge does not support input capability"
      }]
    };
  }

  try {
    const payload: {
      relative: { x: number; y: number };
      position?: { x: number; y: number };
    } = {
      relative: { x: relativeX, y: relativeY }
    };

    if (x !== undefined && y !== undefined) {
      payload.position = { x, y };
    }

    await project.bridge.sendRequest<{ success: boolean }>(
      "input_mouse_motion",
      payload
    );

    return {
      content: [{
        type: "text" as const,
        text: `Mouse motion: relative (${relativeX}, ${relativeY})${x !== undefined ? ` at (${x}, ${y})` : ""}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to send mouse motion input: ${error}`
      }]
    };
  }
}
