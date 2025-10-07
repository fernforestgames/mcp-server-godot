// Configuration validation and setup

// Get Godot project path from command line arguments, default to cwd
const projectPath = process.argv[2] || process.cwd();

// Get Godot executable path from environment variable
const godotPath = process.env['GODOT_PATH'];
if (!godotPath) {
  console.error("Error: GODOT_PATH environment variable must be set");
  process.exit(1);
}

export { projectPath, godotPath };
