// Configuration validation and setup

// Get Godot project path from command line arguments
const projectPath = process.argv[2];
if (!projectPath) {
  console.error("Error: Godot project path must be provided as a command line argument");
  process.exit(1);
}

// Get Godot executable path from environment variable
const godotPath = process.env['GODOT_PATH'];
if (!godotPath) {
  console.error("Error: GODOT_PATH environment variable must be set");
  process.exit(1);
}

export { projectPath, godotPath };
